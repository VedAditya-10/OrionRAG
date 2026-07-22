import asyncio
import logging

logger = logging.getLogger(__name__)

class GPUPriorityManager:
    def __init__(self):
        self.active_queries = 0
        self._lock = asyncio.Lock()

    async def start_query(self):
        async with self._lock:
            self.active_queries += 1
            if self.active_queries == 1:
                logger.info("GPU-Priority: Live query started. Pausing background ingestion tasks.")

    async def end_query(self):
        async with self._lock:
            self.active_queries = max(0, self.active_queries - 1)
            if self.active_queries == 0:
                logger.info("GPU-Priority: No active live queries. Resuming background tasks.")

    async def wait_if_priority_active(self):
        waited = False
        while self.active_queries > 0:
            if not waited:
                logger.info("GPU-Priority: Background task waiting for live query to complete...")
                waited = True
            await asyncio.sleep(0.5)

gpu_priority_manager = GPUPriorityManager()
