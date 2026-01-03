"""
Migration Background Task
Periodically checks Redis for keys near expiry and migrates to Neo4j
"""

import logging
from celery import shared_task
from datetime import datetime

from app.services.migration_service import migration_service

logger = logging.getLogger(__name__)


@shared_task(
    name="migration.check_and_migrate",
    bind=True,
    max_retries=3,
    default_retry_delay=60
)
def check_and_migrate_task(self):
    """
    Celery task: Check Redis for expiring keys and migrate to Neo4j
    
    Runs every 1 minute (configured in celery beat schedule)
    """
    try:
        logger.info("=" * 60)
        logger.info(f"🔄 Migration Task Started - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info("=" * 60)
        
        # Run migration check (async function needs to be wrapped)
        import asyncio
        
        # Get or create event loop
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        # Run migration
        stats = loop.run_until_complete(migration_service.run_migration_check())
        
        logger.info("=" * 60)
        logger.info("✅ Migration Task Complete")
        logger.info(f"   Cameras processed: {stats.get('cameras_processed', 0)}")
        logger.info(f"   Captions found: {stats.get('captions_found', 0)}")
        logger.info(f"   Events created: {stats.get('events_created', 0)}")
        logger.info(f"   Redis keys deleted: {stats.get('redis_keys_deleted', 0)}")
        logger.info(f"   Errors: {stats.get('errors', 0)}")
        logger.info("=" * 60)
        
        return {
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "stats": stats
        }
    
    except Exception as e:
        logger.error(f"❌ Migration task failed: {e}")
        
        # Retry on failure
        try:
            self.retry(exc=e)
        except self.MaxRetriesExceededError:
            logger.error("❌ Max retries exceeded for migration task")
        
        return {
            "status": "error",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }


@shared_task(
    name="migration.force_migrate_camera",
    bind=True
)
def force_migrate_camera_task(self, camera_id: str):
    """
    Celery task: Force migration for a specific camera
    
    Args:
        camera_id: Camera to migrate
    """
    try:
        logger.info(f"🔄 Force migration started for camera: {camera_id}")
        
        import asyncio
        
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        # Run migration with force=True
        stats = loop.run_until_complete(
            migration_service.migrate_camera_history(camera_id, force=True)
        )
        
        logger.info(f"✅ Force migration complete for {camera_id}: {stats}")
        
        return {
            "status": "success",
            "camera_id": camera_id,
            "stats": stats
        }
    
    except Exception as e:
        logger.error(f"❌ Force migration failed for {camera_id}: {e}")
        return {
            "status": "error",
            "camera_id": camera_id,
            "error": str(e)
        }


@shared_task(name="migration.get_migration_stats")
def get_migration_stats_task():
    """
    Celery task: Get migration statistics from Redis
    """
    try:
        import asyncio
        
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        from app.db.redis.client import redis_client
        
        # Get cache stats
        cache_stats = loop.run_until_complete(redis_client.get_cache_stats())
        
        # Get keys near expiry
        expiring_keys = loop.run_until_complete(
            redis_client.get_keys_near_expiry()
        )
        
        # Group by camera
        camera_counts = {}
        for item in expiring_keys:
            camera_id = item["camera_id"]
            camera_counts[camera_id] = camera_counts.get(camera_id, 0) + 1
        
        return {
            "status": "success",
            "cache_stats": cache_stats,
            "keys_near_expiry": len(expiring_keys),
            "cameras_affected": len(camera_counts),
            "camera_breakdown": camera_counts,
            "timestamp": datetime.now().isoformat()
        }
    
    except Exception as e:
        logger.error(f"❌ Failed to get migration stats: {e}")
        return {
            "status": "error",
            "error": str(e)
        }