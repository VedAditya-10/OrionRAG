import asyncio
import logging
import time
from sqlalchemy import select, update
from app.core.database import async_session_maker
from app.models.document import Document, DocumentStatus
from app.services.knowledge_graph_service import KnowledgeGraphService
from app.core.config import settings

logger = logging.getLogger(__name__)

class KGJobQueue:
    def __init__(self):
        self._worker_task = None
        self._running = False

    def start(self):
        if not self._running:
            self._running = True
            self._worker_task = asyncio.create_task(self._worker_loop())
            logger.info("KG-Queue: Background worker loop started.")

    def stop(self):
        self._running = False
        if self._worker_task:
            self._worker_task.cancel()
            logger.info("KG-Queue: Background worker loop stopped.")

    async def _worker_loop(self):
        # Allow the API server startup sequence to initialize first
        await asyncio.sleep(2.0)
        
        while self._running:
            try:
                await self._process_next_job()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"KG-Queue: Error in worker loop: {e}", exc_info=True)
            
            # Poll database every 5 seconds for new vector-ready documents
            await asyncio.sleep(5.0)

    async def _process_next_job(self):
        async with async_session_maker() as db:
            # Query for the oldest pending VECTOR_READY document
            result = await db.execute(
                select(Document)
                .where(Document.status == DocumentStatus.VECTOR_READY)
                .order_by(Document.created_at.asc())
                .limit(1)
            )
            doc = result.scalar_one_or_none()
            if not doc:
                return

            workspace_id = doc.workspace_id
            document_id = doc.id
            markdown_content = doc.markdown_content

            # Skip graph generation if disabled or document has no text content
            if not settings.ORION_ENABLE_KG or not markdown_content:
                doc.status = DocumentStatus.GRAPH_READY
                await db.commit()
                logger.info(f"KG-Queue: Skipping graph generation for doc {document_id} (KG Disabled).")
                return

            # Lock the document immediately to prevent parallel execution
            doc.status = DocumentStatus.GRAPH_PENDING
            await db.commit()
            logger.info(f"KG-Queue: Starting background KG indexing for document {document_id}.")

        # Ingest (outside session to prevent connection locks)
        try:
            from sqlalchemy import select as sa_select
            from app.models.knowledge_base import KnowledgeBase
            doc_select = sa_select(Document.id).where(Document.id == document_id)

            async with async_session_maker() as db:
                ws_result = await db.execute(
                    sa_select(KnowledgeBase.kg_language, KnowledgeBase.kg_entity_types)
                    .where(KnowledgeBase.id == workspace_id)
                )
                ws_row = ws_result.one_or_none()
                kg_language = ws_row.kg_language if ws_row else None
                kg_entity_types = ws_row.kg_entity_types if ws_row else None

            kg_service = KnowledgeGraphService(
                workspace_id=workspace_id,
                kg_language=kg_language,
                kg_entity_types=kg_entity_types,
            )

            start_time = time.time()
            await kg_service.ingest(markdown_content)
            elapsed_ms = int((time.time() - start_time) * 1000)

            # Success transition -> GRAPH_READY (only if document still exists)
            async with async_session_maker() as db:
                doc_check = await db.execute(doc_select)
                if doc_check.scalar_one_or_none() is None:
                    logger.warning(
                        f"KG-Queue: Document {document_id} was deleted during ingestion. "
                        f"Skipping status update."
                    )
                    # Check if workspace has any remaining documents; if empty, wipe stale LightRAG dir
                    from app.models.knowledge_base import KnowledgeBase
                    from sqlalchemy import func
                    count_result = await db.execute(
                        sa_select(func.count(Document.id)).where(
                            Document.workspace_id == workspace_id
                        )
                    )
                    remaining = count_result.scalar() or 0
                    if remaining == 0:
                        kg_service.delete_project_data()
                        logger.info(
                            f"KG-Queue: Cleaned up LightRAG directory for empty workspace {workspace_id} "
                            f"after mid-flight document deletion."
                        )
                else:
                    await db.execute(
                        update(Document)
                        .where(Document.id == document_id)
                        .values(status=DocumentStatus.GRAPH_READY)
                    )
                    await db.commit()
                    logger.info(f"KG-Queue: Document {document_id} fully indexed (KG + Vector) in {elapsed_ms}ms.")

        except Exception as e:
            err_msg = str(e)[:450]
            logger.error(f"KG-Queue: Ingestion failed for document {document_id}: {e}", exc_info=True)
            # Failure transition -> GRAPH_FAILED (stops retry loops, remains vector-searchable)
            try:
                async with async_session_maker() as db:
                    doc_check = await db.execute(doc_select)
                    if doc_check.scalar_one_or_none() is not None:
                        await db.execute(
                            update(Document)
                            .where(Document.id == document_id)
                            .values(
                                status=DocumentStatus.GRAPH_FAILED,
                                error_message=f"Graph extraction failed: {err_msg}"
                            )
                        )
                        await db.commit()
                    else:
                        logger.warning(
                            f"KG-Queue: Document {document_id} was deleted during failed ingestion. "
                            f"Skipping GRAPH_FAILED update."
                        )
                        # Check if workspace has any remaining documents; if empty, wipe stale LightRAG dir
                        from sqlalchemy import func
                        count_result = await db.execute(
                            sa_select(func.count(Document.id)).where(
                                Document.workspace_id == workspace_id
                            )
                        )
                        remaining = count_result.scalar() or 0
                        if remaining == 0:
                            kg_service = KnowledgeGraphService(workspace_id=workspace_id)
                            kg_service.delete_project_data()
                            logger.info(
                                f"KG-Queue: Cleaned up LightRAG directory for empty workspace {workspace_id} "
                                f"after mid-flight document deletion."
                            )
            except Exception as update_err:
                logger.error(f"KG-Queue: Failed to update status for document {document_id}: {update_err}")

kg_job_queue = KGJobQueue()
