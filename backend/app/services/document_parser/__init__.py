"""
Document Parser Package
========================

Factory function to create document parsers based on config.

Usage::

    from app.services.document_parser import get_document_parser

    parser = get_document_parser(workspace_id=1)
    result = parser.parse(file_path, document_id, original_filename)
"""
from __future__ import annotations

from pathlib import Path
from typing import Optional

from app.services.document_parser.base import BaseDocumentParser


def get_document_parser(
    workspace_id: int,
    output_dir: Optional[Path] = None,
    file_path: Optional[str | Path] = None,
) -> BaseDocumentParser:
    """Create a document parser based on ``ORION_DOCUMENT_PARSER`` config or file extension."""
    if file_path:
        from app.services.document_parser.multimodal import MultimodalDocumentParser
        if MultimodalDocumentParser.is_supported(file_path):
            return MultimodalDocumentParser(workspace_id, output_dir)

    from app.core.config import settings

    provider = settings.ORION_DOCUMENT_PARSER.lower()

    if provider == "marker":
        from app.services.document_parser.marker_parser import MarkerDocumentParser

        return MarkerDocumentParser(workspace_id, output_dir)

    # Default: docling
    from app.services.document_parser.docling_parser import DoclingDocumentParser

    return DoclingDocumentParser(workspace_id, output_dir)


__all__ = [
    "get_document_parser",
    "BaseDocumentParser",
]
