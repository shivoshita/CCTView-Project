"""
Celery Application Configuration
Manages background tasks including migration
"""

from celery import Celery
from celery.schedules import crontab
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

# Create Celery app
celery_app = Celery(
    "cctview_workers",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.workers.tasks.frame_processing",
        "app.workers.tasks.alert_delivery",
        "app.workers.tasks.batch_processing",
        "app.workers.tasks.cleanup",
        # "app.workers.tasks.camera_monitoring",  # DISABLED - not implemented yet
        "app.workers.tasks.migration_task"
    ]
)

# Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour max
    task_soft_time_limit=3000,  # 50 minutes soft limit
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1000,
)

# Celery Beat Schedule (Periodic Tasks)
celery_app.conf.beat_schedule = {
    # Migration task - runs every 1 minute
    "migrate-expiring-captions": {
        "task": "migration.check_and_migrate",
        "schedule": 60.0,
        "options": {
            "expires": 55.0
        }
    },
    
    # Migration stats - runs every 5 minutes
    "migration-statistics": {
        "task": "migration.get_migration_stats",
        "schedule": 300.0,
    },
    
    # DISABLED UNTIL IMPLEMENTED:
    # # Cleanup expired data from Neo4j - runs daily at 2 AM
    # "cleanup-expired-data": {
    #     "task": "cleanup.remove_expired_events",
    #     "schedule": crontab(hour=2, minute=0),
    # },
    
    # # Camera health monitoring - runs every 30 seconds
    # "monitor-camera-health": {
    #     "task": "camera.monitor_health",
    #     "schedule": 30.0,
    # },
}

logger.info("✅ Celery app configured with migration tasks")
logger.info(f"   Migration check: Every 60 seconds")
logger.info(f"   Migration stats: Every 5 minutes")