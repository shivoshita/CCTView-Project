"""
Migration API Endpoints
Monitor and control Redis to Neo4j migration
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import Dict, Any, Optional
import logging
from datetime import datetime

from app.services.migration_service import migration_service
from app.db.redis.client import redis_client
from app.workers.tasks.migration_task import (
    check_and_migrate_task,
    force_migrate_camera_task,
    get_migration_stats_task
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/status", response_model=Dict[str, Any])
async def get_migration_status():
    """
    Get current migration status and statistics
    
    Returns:
        - Redis cache stats
        - Keys near expiry
        - Camera breakdown
        - Next migration time
    """
    try:
        logger.info("📊 Fetching migration status...")
        
        # Get cache stats
        cache_stats = await redis_client.get_cache_stats()
        
        # Get keys near expiry
        expiring_keys = await redis_client.get_keys_near_expiry()
        
        # Group by camera
        camera_breakdown = {}
        for item in expiring_keys:
            camera_id = item["camera_id"]
            if camera_id not in camera_breakdown:
                camera_breakdown[camera_id] = {
                    "camera_id": camera_id,
                    "keys_count": 0,
                    "oldest_ttl": float('inf'),
                    "newest_ttl": 0
                }
            
            camera_breakdown[camera_id]["keys_count"] += 1
            ttl = item["ttl_remaining"]
            camera_breakdown[camera_id]["oldest_ttl"] = min(
                camera_breakdown[camera_id]["oldest_ttl"], 
                ttl
            )
            camera_breakdown[camera_id]["newest_ttl"] = max(
                camera_breakdown[camera_id]["newest_ttl"], 
                ttl
            )
        
        # Convert to list
        camera_list = list(camera_breakdown.values())
        
        return {
            "status": "active",
            "cache_stats": cache_stats,
            "migration": {
                "keys_near_expiry": len(expiring_keys),
                "cameras_affected": len(camera_breakdown),
                "camera_breakdown": camera_list,
                "next_check": "Every 60 seconds (automatic)",
                "migration_threshold": f"{cache_stats.get('migration_threshold', '300s')}"
            },
            "timestamp": datetime.now().isoformat()
        }
    
    except Exception as e:
        logger.error(f"❌ Error fetching migration status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/trigger", response_model=Dict[str, Any])
async def trigger_migration_now(background_tasks: BackgroundTasks):
    """
    Manually trigger migration check immediately
    (Useful for testing or forced cleanup)
    
    Runs in background to avoid timeout
    """
    try:
        logger.info("🔄 Manual migration trigger requested")
        
        # Add to background tasks
        background_tasks.add_task(check_and_migrate_task.apply_async)
        
        return {
            "status": "triggered",
            "message": "Migration task started in background",
            "timestamp": datetime.now().isoformat()
        }
    
    except Exception as e:
        logger.error(f"❌ Error triggering migration: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/camera/{camera_id}/migrate", response_model=Dict[str, Any])
async def force_migrate_camera(
    camera_id: str,
    background_tasks: BackgroundTasks,
    force: bool = False
):
    """
    Force migration for a specific camera
    
    Args:
        camera_id: Camera to migrate
        force: If true, migrate all captions regardless of TTL
    
    Useful for:
    - Testing migration logic
    - Manual cleanup
    - Camera removal preparation
    """
    try:
        logger.info(f"🔄 Force migration requested for camera: {camera_id}")
        
        # Check if camera exists in Redis
        expiring_keys = await redis_client.get_keys_near_expiry(
            camera_id=camera_id,
            threshold_seconds=7200 if force else None
        )
        
        if not expiring_keys and not force:
            return {
                "status": "nothing_to_migrate",
                "camera_id": camera_id,
                "message": "No captions near expiry for this camera",
                "keys_found": 0
            }
        
        # Trigger migration in background
        background_tasks.add_task(
            force_migrate_camera_task.apply_async,
            args=[camera_id]
        )
        
        return {
            "status": "triggered",
            "camera_id": camera_id,
            "message": f"Migration started for {camera_id}",
            "keys_to_process": len(expiring_keys),
            "force": force,
            "timestamp": datetime.now().isoformat()
        }
    
    except Exception as e:
        logger.error(f"❌ Error force migrating camera {camera_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/camera/{camera_id}/preview", response_model=Dict[str, Any])
async def preview_camera_migration(camera_id: str):
    """
    Preview what will be migrated for a camera
    Shows deduplication preview without actually migrating
    
    Args:
        camera_id: Camera to preview
    
    Returns:
        - Current captions in Redis
        - Predicted deduplicated events
        - Estimated storage savings
    """
    try:
        logger.info(f"👀 Migration preview for camera: {camera_id}")
        
        # Get all expiring keys for camera
        expiring_keys = await redis_client.get_keys_near_expiry(
            camera_id=camera_id,
            threshold_seconds=7200  # Get everything
        )
        
        if not expiring_keys:
            return {
                "status": "no_data",
                "camera_id": camera_id,
                "message": "No captions found in Redis for this camera",
                "captions_found": 0
            }
        
        # Sort by timestamp
        expiring_keys.sort(key=lambda x: x["timestamp"])
        
        # Run deduplication preview (without storing)
        from app.services.migration_service import migration_service
        grouped_events = migration_service._deduplicate_captions(expiring_keys)
        
        # Calculate savings
        original_count = len(expiring_keys)
        deduplicated_count = len(grouped_events)
        savings_percent = ((original_count - deduplicated_count) / original_count * 100) if original_count > 0 else 0
        
        # Format events for display
        preview_events = []
        for event in grouped_events[:10]:  # Show first 10
            start = datetime.fromisoformat(event["start_time"])
            end = datetime.fromisoformat(event["end_time"])
            duration = (end - start).total_seconds()
            
            preview_events.append({
                "caption": event["caption"],
                "start_time": start.strftime("%Y-%m-%d %H:%M:%S"),
                "end_time": end.strftime("%Y-%m-%d %H:%M:%S"),
                "duration_seconds": duration,
                "frame_count": event["count"],
                "confidence": round(event["confidence"], 3)
            })
        
        return {
            "status": "preview",
            "camera_id": camera_id,
            "summary": {
                "original_captions": original_count,
                "deduplicated_events": deduplicated_count,
                "reduction": f"{savings_percent:.1f}%",
                "storage_savings": f"{original_count - deduplicated_count} fewer records"
            },
            "preview_events": preview_events,
            "showing": f"First {len(preview_events)} of {deduplicated_count} events",
            "timestamp": datetime.now().isoformat()
        }
    
    except Exception as e:
        logger.error(f"❌ Error previewing migration: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history", response_model=Dict[str, Any])
async def get_migration_history(limit: int = 50):
    """
    Get recent migration history from Neo4j
    Shows when events were created (migrated from Redis)
    
    Args:
        limit: Number of recent events to show
    """
    try:
        from app.db.neo4j.client import neo4j_client
        
        query = """
        MATCH (c:Camera)-[:CAPTURED]->(e:Event)
        WHERE e.start_time IS NOT NULL AND e.end_time IS NOT NULL
        RETURN 
            e.id as event_id,
            c.id as camera_id,
            c.name as camera_name,
            e.caption as caption,
            e.start_time as start_time,
            e.end_time as end_time,
            e.duration as duration,
            e.frame_count as frame_count,
            e.confidence as confidence
        ORDER BY e.start_time DESC
        LIMIT $limit
        """
        
        results = await neo4j_client.async_execute_query(query, {"limit": limit})
        
        events = []
        for record in results:
            start_time = record.get("start_time")
            end_time = record.get("end_time")
            
            events.append({
                "event_id": record.get("event_id"),
                "camera_id": record.get("camera_id"),
                "camera_name": record.get("camera_name"),
                "caption": record.get("caption"),
                "start_time": start_time.isoformat() if start_time else None,
                "end_time": end_time.isoformat() if end_time else None,
                "duration": record.get("duration"),
                "frame_count": record.get("frame_count"),
                "confidence": record.get("confidence")
            })
        
        return {
            "status": "success",
            "events": events,
            "count": len(events),
            "timestamp": datetime.now().isoformat()
        }
    
    except Exception as e:
        logger.error(f"❌ Error fetching migration history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/camera/{camera_id}/cache", response_model=Dict[str, Any])
async def clear_camera_cache(camera_id: str, migrate_first: bool = True):
    """
    Clear Redis cache for a camera
    
    Args:
        camera_id: Camera to clear
        migrate_first: If true, migrate data to Neo4j before clearing
    
    Warning: If migrate_first=False, data will be permanently lost!
    """
    try:
        logger.info(f"🗑️  Cache clear requested for camera: {camera_id}")
        
        if migrate_first:
            logger.info(f"📤 Migrating data before clearing...")
            
            # Force migration first
            stats = await migration_service.migrate_camera_history(
                camera_id=camera_id,
                force=True
            )
            
            logger.info(f"✅ Migration complete: {stats}")
        
        # Clear cache
        deleted = await redis_client.clear_camera_cache(camera_id)
        
        return {
            "status": "cleared",
            "camera_id": camera_id,
            "migrated_first": migrate_first,
            "migration_stats": stats if migrate_first else None,
            "keys_deleted": deleted,
            "timestamp": datetime.now().isoformat()
        }
    
    except Exception as e:
        logger.error(f"❌ Error clearing cache: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/config", response_model=Dict[str, Any])
async def get_migration_config():
    """
    Get current migration configuration
    """
    from app.core.config import settings
    
    return {
        "redis": {
            "ttl_seconds": settings.REDIS_TTL_2HOUR,
            "ttl_human": "2 hours",
            "migration_threshold": settings.REDIS_MIGRATION_THRESHOLD,
            "threshold_human": "5 minutes before expiry"
        },
        "deduplication": {
            "similarity_threshold": settings.CAPTION_SIMILARITY_THRESHOLD,
            "min_duration_seconds": settings.MIN_CAPTION_DURATION,
            "max_duration_seconds": settings.MAX_CAPTION_DURATION
        },
        "schedule": {
            "check_interval": "60 seconds",
            "stats_interval": "300 seconds (5 minutes)"
        },
        "neo4j": {
            "default_retention_days": settings.DEFAULT_RETENTION_DAYS
        }
    }