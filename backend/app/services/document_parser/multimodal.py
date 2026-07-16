import os
import sys
import gc
import re
import json
import asyncio
import httpx
import torch
from pathlib import Path
import logging
logger = logging.getLogger(__name__)
import cv2
import numpy as np
from PIL import Image
from email import message_from_file
from email.policy import default

from app.core.config import settings
from app.services.document_parser.base import BaseDocumentParser
from app.services.models.parsed_document import ParsedDocument, EnrichedChunk, ExtractedImage

# Ensure local bin is on PATH for FFmpeg (Windows fallback)
local_bin = settings.BASE_DIR / "bin"
if local_bin.exists():
    os.environ["PATH"] = str(local_bin) + os.pathsep + os.environ["PATH"]

_WHISPER_MODEL = None
_EASYOCR_READER = None

def get_whisper_model():
    global _WHISPER_MODEL
    if _WHISPER_MODEL is None:
        import whisper
        device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Loading Whisper model on {device}...")
        _WHISPER_MODEL = whisper.load_model("base", device=device)
    return _WHISPER_MODEL

def get_easyocr_reader():
    global _EASYOCR_READER
    if _EASYOCR_READER is None:
        import easyocr
        gpu_avail = torch.cuda.is_available()
        logger.info(f"Loading EasyOCR reader (gpu={gpu_avail})...")
        _EASYOCR_READER = easyocr.Reader(['en'], gpu=gpu_avail)
    return _EASYOCR_READER

class MultimodalDocumentParser(BaseDocumentParser):
    parser_name = "multimodal"

    @staticmethod
    def supported_extensions() -> set[str]:
        return {
            ".mp4", ".mkv", ".avi", ".mov", ".webm",
            ".mp3", ".wav", ".m4a", ".ogg",
            ".eml", ".msg",
            ".jpg", ".jpeg", ".png", ".webp"
        }

    def parse(
        self,
        file_path: str | Path,
        document_id: int,
        original_filename: str,
    ) -> ParsedDocument:
        file_path = Path(file_path)
        ext = file_path.suffix.lower()

        logger.info(f"MultimodalParser processing file {original_filename} (ext: {ext})")

        if ext in [".mp4", ".mkv", ".avi", ".mov", ".webm"]:
            return self._parse_video(file_path, document_id, original_filename)
        elif ext in [".mp3", ".wav", ".m4a", ".ogg"]:
            return self._parse_audio(file_path, document_id, original_filename)
        elif ext in [".eml", ".msg"]:
            return self._parse_email(file_path, document_id, original_filename)
        elif ext in [".jpg", ".jpeg", ".png", ".webp"]:
            return self._parse_image(file_path, document_id, original_filename)
        else:
            raise ValueError(f"Unsupported multimodal extension: {ext}")

    def _parse_video(self, file_path: Path, document_id: int, original_filename: str) -> ParsedDocument:
        logger.info(f"Starting Video Processing for {original_filename}")

        # 1. Transcribe Audio track via Whisper (if available)
        transcript_segments = []
        try:
            logger.info("Extracting audio transcription...")
            # For simplicity, whisper handles reading video files directly via ffmpeg
            model = get_whisper_model()
            result = model.transcribe(str(file_path), verbose=False, fp16=False)
            raw_segs = result.get("segments", [])
            for seg in raw_segs:
                text = seg.get("text", "").strip()
                if text and seg.get("no_speech_prob", 0.0) < 0.6:
                    transcript_segments.append({
                        "text": text,
                        "start": float(seg.get("start", 0.0)),
                        "end": float(seg.get("end", 0.0))
                    })
            logger.info(f"Extracted {len(transcript_segments)} speech segments.")
        except Exception as e:
            logger.warning(f"Whisper transcription failed or skipped: {e}")

        # 2. Extract Keyframes & Run EasyOCR
        frames_out_dir = settings.BASE_DIR / "data" / "frames"
        frames_out_dir.mkdir(parents=True, exist_ok=True)

        extracted_images = []
        cap = cv2.VideoCapture(str(file_path))
        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration_sec = total_frames / fps if fps else 0.0

        # Sample frame every 2 seconds
        frame_interval = int(fps * 2.0)
        frame_idx = 0
        saved_frames = 0
        max_keyframes = 30
        prev_frame = None

        logger.info(f"Scanning frames. Total duration: {duration_sec:.1f}s. Interval: {frame_interval} frames.")

        while cap.isOpened() and saved_frames < max_keyframes:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % frame_interval == 0:
                # Calculate pixel difference to detect scene changes/significant keyframes
                timestamp_sec = frame_idx / fps
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                
                is_significant = True
                if prev_frame is not None:
                    # Calculate difference
                    gray1 = cv2.cvtColor(prev_frame, cv2.COLOR_RGB2GRAY)
                    gray2 = cv2.cvtColor(frame_rgb, cv2.COLOR_RGB2GRAY)
                    diff = float(np.mean(cv2.absdiff(gray1, gray2)))
                    if diff < 3.0:  # Very static frame
                        is_significant = False

                if is_significant:
                    img_id = f"frame_{document_id}_{saved_frames}"
                    img_filename = f"{img_id}.png"
                    img_path = frames_out_dir / img_filename
                    
                    # Resize to keep file sizes small
                    h, w = frame_rgb.shape[:2]
                    if w > 1280:
                        scale = 1280.0 / w
                        frame_rgb = cv2.resize(frame_rgb, (1280, int(h * scale)))

                    pil_img = Image.fromarray(frame_rgb)
                    pil_img.save(img_path, "PNG")

                    # Try VLM OCR first, fallback to EasyOCR
                    ocr_text = ""
                    vlm_success = False
                    if settings.ORION_ENABLE_IMAGE_CAPTIONING:
                        logger.info(f"Attempting VLM OCR extraction for frame at {timestamp_sec:.1f}s...")
                        ocr_text = self._ocr_image_via_vlm(img_path, "image/png")
                        if ocr_text:
                            vlm_success = True
                            logger.info(f"VLM OCR successful for frame at {timestamp_sec:.1f}s!")

                    if not vlm_success:
                        logger.info(f"Falling back to EasyOCR for frame at {timestamp_sec:.1f}s...")
                        try:
                            reader = get_easyocr_reader()
                            ocr_res = reader.readtext(frame_rgb)
                            ocr_text = " ".join([r[1] for r in ocr_res if r[2] > 0.5])
                        except Exception as e:
                            logger.warning(f"OCR failed for frame at {timestamp_sec:.1f}s: {e}")

                    extracted_images.append(ExtractedImage(
                        image_id=img_id,
                        document_id=document_id,
                        page_no=1,
                        file_path=str(img_path.resolve()),
                        caption=f"Video Frame at {timestamp_sec:.1f}s. OCR Text: {ocr_text}" if ocr_text else f"Video Frame at {timestamp_sec:.1f}s",
                        width=w,
                        height=h,
                        mime_type="image/png"
                    ))
                    saved_frames += 1
                    prev_frame = frame_rgb

            frame_idx += 1

        cap.release()
        logger.info(f"Extracted and saved {len(extracted_images)} video keyframes.")

        # 3. Build Unified Timeline Markdown
        md = []
        md.append(f"# Video Timeline: {original_filename}")
        md.append(f"**Duration:** {duration_sec:.1f} seconds | **Parsed Keyframes:** {len(extracted_images)}")
        md.append("\n## timeline Activities & Dialogue")

        # Map frames and transcription segments into a sorted chronological list
        timeline_items = []
        for img in extracted_images:
            # Extract timestamp from image_id or caption
            match = re.search(r'at\s+([\d.]+)\s*s', img.caption)
            t_sec = float(match.group(1)) if match else 0.0
            timeline_items.append({
                "type": "frame",
                "time": t_sec,
                "data": img
            })

        for seg in transcript_segments:
            timeline_items.append({
                "type": "speech",
                "time": seg["start"],
                "data": seg
            })

        timeline_items.sort(key=lambda x: x["time"])

        chunks = []
        current_chunk_idx = 0

        # Construct markdown string and timeline chunks
        for item in timeline_items:
            t_sec = item["time"]
            m, s = divmod(int(t_sec), 60)
            time_tag = f"[{m:02d}:{s:02d}]"

            if item["type"] == "frame":
                img = item["data"]
                # Embed frame image tag in Markdown
                frame_url = f"/frames/frame_{document_id}_{extracted_images.index(img)}.png"
                md_line = f"### {time_tag} [Video Frame]\n\n{img.caption}\n\n![{img.caption}]({frame_url})"
                md.append(md_line)

                chunks.append(EnrichedChunk(
                    content=f"[{original_filename} - {time_tag}] Video visual frame activity:\n{img.caption}",
                    chunk_index=current_chunk_idx,
                    source_file=original_filename,
                    document_id=document_id,
                    page_no=1,
                    heading_path=["timeline Activities & Dialogue", f"{time_tag} [Video Frame]"],
                    image_refs=[img.image_id]
                ))
                current_chunk_idx += 1
            else:
                seg = item["data"]
                md_line = f"### {time_tag} [Speech/Dialogue]\n\n\"{seg['text']}\""
                md.append(md_line)

                chunks.append(EnrichedChunk(
                    content=f"[{original_filename} - {time_tag}] Dialogue spoken:\n\"{seg['text']}\"",
                    chunk_index=current_chunk_idx,
                    source_file=original_filename,
                    document_id=document_id,
                    page_no=1,
                    heading_path=["timeline Activities & Dialogue", f"{time_tag} [Speech/Dialogue]"]
                ))
                current_chunk_idx += 1

        full_md = "\n\n".join(md)
        return ParsedDocument(
            document_id=document_id,
            original_filename=original_filename,
            markdown=full_md,
            page_count=1,
            chunks=chunks,
            images=extracted_images,
            tables=[],
            tables_count=0
        )

    def _parse_audio(self, file_path: Path, document_id: int, original_filename: str) -> ParsedDocument:
        logger.info(f"Starting Audio Processing for {original_filename}")
        
        transcript_segments = []
        try:
            model = get_whisper_model()
            result = model.transcribe(str(file_path), verbose=False, fp16=False)
            raw_segs = result.get("segments", [])
            for seg in raw_segs:
                text = seg.get("text", "").strip()
                if text and seg.get("no_speech_prob", 0.0) < 0.6:
                    transcript_segments.append({
                        "text": text,
                        "start": float(seg.get("start", 0.0)),
                        "end": float(seg.get("end", 0.0))
                    })
        except Exception as e:
            logger.error(f"Whisper transcription failed: {e}")
            raise e

        md = []
        md.append(f"# Audio Transcript: {original_filename}")
        md.append(f"**Speech Segments:** {len(transcript_segments)}")
        md.append("\n## Audio Transcription Timeline")

        chunks = []
        for idx, seg in enumerate(transcript_segments):
            m, s = divmod(int(seg["start"]), 60)
            time_tag = f"[{m:02d}:{s:02d}]"

            md_line = f"### {time_tag} [Audio Dialogue]\n\n\"{seg['text']}\""
            md.append(md_line)

            chunks.append(EnrichedChunk(
                content=f"[{original_filename} - {time_tag}] Spoken audio dialogue:\n\"{seg['text']}\"",
                chunk_index=idx,
                source_file=original_filename,
                document_id=document_id,
                page_no=1,
                heading_path=["Audio Transcription Timeline", f"{time_tag} [Audio Dialogue]"]
            ))

        full_md = "\n\n".join(md)
        return ParsedDocument(
            document_id=document_id,
            original_filename=original_filename,
            markdown=full_md,
            page_count=1,
            chunks=chunks,
            images=[],
            tables=[],
            tables_count=0
        )

    def _parse_email(self, file_path: Path, document_id: int, original_filename: str) -> ParsedDocument:
        logger.info(f"Starting Email Parsing for {original_filename}")
        ext = file_path.suffix.lower()

        email_data = {}
        if ext == ".eml":
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                msg = message_from_file(f, policy=default)
            
            subject = msg.get("Subject", "No Subject")
            sender = msg.get("From", "Unknown Sender")
            recipient = msg.get("To", "Unknown Recipient")
            date_str = msg.get("Date", "Unknown Date")
            
            body = ""
            if msg.is_multipart():
                for part in msg.walk():
                    content_type = part.get_content_type()
                    content_disposition = str(part.get("Content-Disposition"))
                    if content_type == "text/plain" and "attachment" not in content_disposition:
                        body = part.get_payload(decode=True).decode("utf-8", errors="ignore")
                        break
            else:
                body = msg.get_payload(decode=True).decode("utf-8", errors="ignore")
                
            email_data = {
                "subject": subject,
                "from": sender,
                "to": recipient,
                "date": date_str,
                "body": body.strip()
            }
        elif ext == ".msg":
            try:
                import extract_msg
                msg = extract_msg.Message(str(file_path))
                email_data = {
                    "subject": msg.subject or "No Subject",
                    "from": msg.sender or "Unknown Sender",
                    "to": msg.to or "Unknown Recipient",
                    "date": msg.date or "Unknown Date",
                    "body": (msg.body or "").strip()
                }
            except ImportError:
                # Raw text scan fallback
                with open(file_path, "rb") as f:
                    raw_bytes = f.read()
                import string
                printable = set(string.printable.encode('ascii'))
                filtered = bytes([b for b in raw_bytes if b in printable])
                text_content = filtered.decode('ascii', errors='ignore')
                
                subject_match = re.search(r'Subject:\s*(.*)', text_content, re.IGNORECASE)
                from_match = re.search(r'From:\s*(.*)', text_content, re.IGNORECASE)
                
                email_data = {
                    "subject": subject_match.group(1).strip() if subject_match else "Outlook Email subject",
                    "from": from_match.group(1).strip() if from_match else "Outlook User",
                    "to": "Recipient",
                    "date": "2026-07-14",
                    "body": text_content[:5000].strip()
                }

        # Build Markdown representation
        md = []
        md.append(f"# Email: {email_data['subject']}")
        md.append(f"**From:** {email_data['from']}")
        md.append(f"**To:** {email_data['to']}")
        md.append(f"**Date:** {email_data['date']}")
        md.append("\n## Email Body")
        md.append(email_data["body"])

        full_md = "\n".join(md)

        # Build chunks: split body text by paragraphs
        paragraphs = [p.strip() for p in email_data["body"].split("\n\n") if p.strip()]
        if not paragraphs:
            paragraphs = [email_data["body"]]

        chunks = []
        for idx, para in enumerate(paragraphs):
            md_line = f"### Segment {idx + 1}\n\n{para}"
            md.append(md_line)

            chunks.append(EnrichedChunk(
                content=f"Email: {email_data['subject']}\nFrom: {email_data['from']}\nTo: {email_data['to']}\nDate: {email_data['date']}\n\nContent segment:\n{para}",
                chunk_index=idx,
                source_file=original_filename,
                document_id=document_id,
                page_no=1,
                heading_path=["Email Body", f"Segment {idx + 1}"]
            ))

        return ParsedDocument(
            document_id=document_id,
            original_filename=original_filename,
            markdown=full_md,
            page_count=1,
            chunks=chunks,
            images=[],
            tables=[],
            tables_count=0
        )

    def _ocr_image_via_vlm(self, image_path: Path, mime_type: str = "image/png") -> str:
        """Use the VLM provider to extract clean markdown text from the image."""
        from app.services.llm import get_llm_provider
        from app.services.llm.types import LLMImagePart, LLMMessage

        provider = get_llm_provider()
        if not provider.supports_vision():
            logger.warning("LLM provider does not support vision — falling back to standard OCR")
            return ""

        try:
            with open(image_path, "rb") as f:
                image_bytes = f.read()

            prompt = (
                "You are an expert document parser. Read this image and extract ALL text, formatting, "
                "tables, and lists. Reconstruct the layout exactly as clean Markdown.\n\n"
                "RULES:\n"
                "- Do NOT summarize, describe, or interpret. Transcribe the text literally.\n"
                "- Output ONLY the clean Markdown text. Do NOT wrap it in markdown code blocks like ```markdown. "
                "Output the raw markdown directly.\n"
                "- If there is no text in the image, return nothing."
            )

            message = LLMMessage(
                role="user",
                content=prompt,
                images=[LLMImagePart(data=image_bytes, mime_type=mime_type)],
            )
            result = provider.complete([message])
            if result:
                return result.strip()
        except Exception as e:
            logger.warning(f"VLM OCR failed for image {image_path.name}: {e}")
        return ""

    def _parse_image(self, file_path: Path, document_id: int, original_filename: str) -> ParsedDocument:
        logger.info(f"Starting Image Processing for {original_filename}")
        import uuid

        # 1. Read image dimensions and open it
        try:
            pil_img = Image.open(file_path)
            width, height = pil_img.size
        except Exception as e:
            logger.error(f"Failed to open image file {original_filename}: {e}")
            raise e

        # 2. Save the image to the docling output directory (kb_{workspace_id}/images/) so it leverages the static mount
        images_dir = settings.BASE_DIR / "data" / "docling" / f"kb_{self.workspace_id}" / "images"
        images_dir.mkdir(parents=True, exist_ok=True)
        
        image_id = str(uuid.uuid4())
        image_path = images_dir / f"{image_id}.png"

        try:
            # Convert and save as PNG
            if pil_img.mode not in ("RGB", "RGBA"):
                pil_img = pil_img.convert("RGB")
            pil_img.save(str(image_path), format="PNG")
        except Exception as e:
            logger.error(f"Failed to save image to {image_path}: {e}")
            raise e

        # 3. Extract text: Try VLM OCR first, fallback to EasyOCR
        ocr_text = ""
        vlm_success = False
        
        if settings.ORION_ENABLE_IMAGE_CAPTIONING:
            logger.info("Attempting VLM OCR extraction...")
            ocr_text = self._ocr_image_via_vlm(image_path, "image/png")
            if ocr_text:
                vlm_success = True
                logger.info(f"VLM OCR successful! Extracted {len(ocr_text)} characters.")

        if not vlm_success:
            logger.info("Falling back to EasyOCR...")
            try:
                reader = get_easyocr_reader()
                ocr_res = reader.readtext(str(file_path))
                ocr_text = " ".join([r[1] for r in ocr_res if r[2] > 0.4]).strip()
                logger.info(f"EasyOCR extracted text: {ocr_text[:200]}")
            except Exception as e:
                logger.warning(f"EasyOCR failed for image {original_filename}: {e}")

        # 4. Construct ExtractedImage
        img_caption = ocr_text if ocr_text else "Uploaded Image"
        extracted_img = ExtractedImage(
            image_id=image_id,
            document_id=document_id,
            page_no=1,
            file_path=str(image_path.resolve()),
            caption=img_caption,
            width=width,
            height=height,
            mime_type="image/png"
        )

        # 5. Caption with LLM provider (best-effort) if enabled and VLM OCR was NOT already run
        if settings.ORION_ENABLE_IMAGE_CAPTIONING and not vlm_success:
            logger.info("Attempting LLM image captioning...")
            self._caption_images([extracted_img])

        # 6. Build Markdown and chunks
        md = []
        md.append(f"# Image: {original_filename}")
        
        # If we ran VLM OCR, the extracted text itself is a rich Markdown document.
        # Otherwise, if we got a separate caption, we list that as visual description.
        if settings.ORION_ENABLE_IMAGE_CAPTIONING and not vlm_success and extracted_img.caption and extracted_img.caption != ocr_text:
            md.append(f"### Visual Content Description\n\n{extracted_img.caption}")
        
        if ocr_text:
            md.append(f"### OCR Extracted Text\n\n{ocr_text}")
        
        # Embed the image inline in the document markdown so the document viewer displays it!
        image_url = f"/static/doc-images/kb_{self.workspace_id}/images/{image_id}.png"
        md.append(f"\n![{original_filename}]({image_url})")

        full_md = "\n\n".join(md)

        # Build paragraph chunks
        chunk_content = f"Image [{original_filename}] content:\n"
        if settings.ORION_ENABLE_IMAGE_CAPTIONING and not vlm_success and extracted_img.caption and extracted_img.caption != ocr_text:
            chunk_content += f"Visual Description: {extracted_img.caption}\n"
        if ocr_text:
            chunk_content += f"Extracted Text: {ocr_text}"
        else:
            chunk_content += "No text extracted."

        chunks = [EnrichedChunk(
            content=chunk_content,
            chunk_index=0,
            source_file=original_filename,
            document_id=document_id,
            page_no=1,
            heading_path=["Image Content"],
            image_refs=[image_id]
        )]

        return ParsedDocument(
            document_id=document_id,
            original_filename=original_filename,
            markdown=full_md,
            page_count=1,
            chunks=chunks,
            images=[extracted_img],
            tables=[],
            tables_count=0
        )
