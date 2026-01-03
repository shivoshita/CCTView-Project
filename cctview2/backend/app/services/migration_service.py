"""
Migration Service - FIXED VERSION
Handles migration of caption data from Redis to Neo4j with intelligent deduplication
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

from app.core.config import settings
from app.db.redis.client import redis_client
from app.db.neo4j.client import neo4j_client

logger = logging.getLogger(__name__)


class MigrationService:
    """
    Service for migrating caption data from Redis to Neo4j
    """
    
    def __init__(self):
        # FIXED: Use more realistic similarity threshold
        # 0.95 is too high - similar captions typically have 0.85-0.95 similarity
        self.similarity_threshold = getattr(settings, 'CAPTION_SIMILARITY_THRESHOLD', 0.85)
        self.min_duration = getattr(settings, 'MIN_CAPTION_DURATION', 5)
        self.max_duration = getattr(settings, 'MAX_CAPTION_DURATION', 300)
        
        logger.info("🔄 Migration Service initialized")
        logger.info(f"   Similarity threshold: {self.similarity_threshold}")
        logger.info(f"   Min caption duration: {self.min_duration}s")
        logger.info(f"   Max caption duration: {self.max_duration}s")
    
    async def run_migration_check(self) -> Dict[str, Any]:
        """Main migration workflow"""
        logger.info("🔍 Starting migration check...")
        
        stats = {
            "cameras_processed": 0,
            "captions_found": 0,
            "events_created": 0,
            "redis_keys_deleted": 0,
            "errors": 0
        }
        
        try:
            # Find all keys near expiry
            expiring_keys = await redis_client.get_keys_near_expiry(
                threshold_seconds=settings.REDIS_MIGRATION_THRESHOLD
            )
            
            if not expiring_keys:
                logger.info("✅ No keys near expiry - nothing to migrate")
                return stats
            
            stats["captions_found"] = len(expiring_keys)
            logger.info(f"📋 Found {len(expiring_keys)} captions near expiry")
            
            # Group by camera
            camera_groups = self._group_by_camera(expiring_keys)
            stats["cameras_processed"] = len(camera_groups)
            
            # Process each camera
            for camera_id, captions in camera_groups.items():
                try:
                    logger.info(f"📹 Processing camera: {camera_id} ({len(captions)} captions)")
                    
                    events_created = await self._process_camera_captions(
                        camera_id,
                        captions
                    )
                    
                    stats["events_created"] += events_created
                    
                    # Clean up Redis
                    keys_to_delete = [item["key"] for item in captions]
                    deleted = await redis_client.mark_for_deletion(keys_to_delete)
                    stats["redis_keys_deleted"] += deleted
                    
                    logger.info(f"✅ Camera {camera_id}: Created {events_created} events, deleted {deleted} keys")
                
                except Exception as e:
                    logger.error(f"❌ Error processing camera {camera_id}: {e}")
                    stats["errors"] += 1
            
            logger.info(f"✅ Migration complete: {stats}")
            return stats
        
        except Exception as e:
            logger.error(f"❌ Migration check failed: {e}")
            stats["errors"] += 1
            return stats
    
    def _group_by_camera(
        self,
        expiring_keys: List[Dict[str, Any]]
    ) -> Dict[str, List[Dict[str, Any]]]:
        """Group expiring keys by camera_id"""
        camera_groups = {}
        
        for item in expiring_keys:
            camera_id = item["camera_id"]
            if camera_id not in camera_groups:
                camera_groups[camera_id] = []
            camera_groups[camera_id].append(item)
        
        return camera_groups
    
    async def _process_camera_captions(
        self,
        camera_id: str,
        captions: List[Dict[str, Any]]
    ) -> int:
        """Process captions for a single camera"""
        if not captions:
            logger.warning(f"⚠️  No captions to process for {camera_id}")
            return 0
        
        logger.info(f"📊 Processing {len(captions)} captions for {camera_id}")
        
        # Sort by timestamp
        captions.sort(key=lambda x: x["timestamp"])
        logger.info(f"✅ Sorted captions by timestamp")
        
        # Group similar consecutive captions
        grouped_events = self._deduplicate_captions(captions)
        
        logger.info(f"📊 Deduplication: {len(captions)} captions → {len(grouped_events)} events")
        
        if not grouped_events:
            logger.warning(f"⚠️  No events created after deduplication!")
            return 0
        
        # Store each grouped event in Neo4j
        events_created = 0
        for i, event in enumerate(grouped_events, 1):
            try:
                logger.debug(f"📝 Storing event {i}/{len(grouped_events)}")
                success = await self._store_event_in_neo4j(camera_id, event)
                if success:
                    events_created += 1
                else:
                    logger.error(f"❌ Failed to store event {i}")
            except Exception as e:
                logger.error(f"❌ Exception storing event {i}: {e}")
        
        logger.info(f"✅ Created {events_created}/{len(grouped_events)} events in Neo4j")
        return events_created
    
    def _deduplicate_captions(
        self,
        captions: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Group similar consecutive captions into time ranges
        
        FIXED: Always save groups with count > 1
        """
        if not captions:
            logger.warning("⚠️  No captions to deduplicate")
            return []
        
        logger.info(f"🔄 Starting deduplication of {len(captions)} captions")
        
        grouped_events = []
        current_group = {
            "caption": captions[0]["data"]["caption"],
            "confidence": captions[0]["data"]["confidence"],
            "start_time": captions[0]["timestamp"],
            "end_time": captions[0]["timestamp"],
            "embedding": captions[0]["data"].get("embedding", []),
            "count": 1
        }
        
        logger.debug(f"📝 Started first group: '{current_group['caption'][:50]}...'")
        
        for i in range(1, len(captions)):
            current_caption = captions[i]
            current_data = current_caption["data"]
            
            # Calculate time difference
            start = datetime.fromisoformat(current_group["start_time"])
            current_time = datetime.fromisoformat(current_caption["timestamp"])
            duration = (current_time - start).total_seconds()
            
            # Check if captions are similar
            is_similar = self._are_captions_similar(
                current_group["caption"],
                current_data["caption"],
                current_group.get("embedding", []),
                current_data.get("embedding", [])
            )
            
            # Decide: extend or start new
            if is_similar and duration <= self.max_duration:
                # Extend current group
                current_group["end_time"] = current_caption["timestamp"]
                current_group["count"] += 1
                current_group["confidence"] = (
                    current_group["confidence"] * (current_group["count"] - 1) +
                    current_data["confidence"]
                ) / current_group["count"]
                logger.debug(f"➕ Extended group to {current_group['count']} frames")
            else:
                # Save current group
                group_duration = (
                    datetime.fromisoformat(current_group["end_time"]) -
                    datetime.fromisoformat(current_group["start_time"])
                ).total_seconds()
                
                # FIXED: Save if multiple frames OR meets duration
                should_save = (current_group["count"] > 1 or 
                              group_duration >= self.min_duration)
                
                if should_save:
                    grouped_events.append(current_group.copy())
                    logger.debug(f"✅ Saved group: {current_group['count']} frames, {group_duration:.1f}s")
                else:
                    logger.debug(f"⏭️  Skipped single frame < min_duration: {group_duration:.1f}s")
                
                # Start new group
                current_group = {
                    "caption": current_data["caption"],
                    "confidence": current_data["confidence"],
                    "start_time": current_caption["timestamp"],
                    "end_time": current_caption["timestamp"],
                    "embedding": current_data.get("embedding", []),
                    "count": 1
                }
                logger.debug(f"📝 Started new group: '{current_group['caption'][:50]}...'")
        
        # CRITICAL FIX: Always save the last group if it has multiple frames
        group_duration = (
            datetime.fromisoformat(current_group["end_time"]) -
            datetime.fromisoformat(current_group["start_time"])
        ).total_seconds()
        
        should_save_last = (current_group["count"] > 1 or 
                           group_duration >= self.min_duration)
        
        if should_save_last:
            grouped_events.append(current_group)
            logger.debug(f"✅ Saved final group: {current_group['count']} frames, {group_duration:.1f}s")
        else:
            logger.debug(f"⏭️  Skipped final single frame < min_duration: {group_duration:.1f}s")
        
        logger.info(f"✅ Deduplication complete: {len(grouped_events)} events created")
        return grouped_events
    
    def _are_captions_similar(
        self,
        caption1: str,
        caption2: str,
        embedding1: List[float],
        embedding2: List[float]
    ) -> bool:
        """Check if two captions are similar"""
        # Try embedding similarity first
        if embedding1 and embedding2 and len(embedding1) == len(embedding2):
            try:
                emb1 = np.array(embedding1).reshape(1, -1)
                emb2 = np.array(embedding2).reshape(1, -1)
                similarity = cosine_similarity(emb1, emb2)[0][0]
                
                is_similar = similarity >= self.similarity_threshold
                logger.debug(f"📊 Embedding similarity: {similarity:.3f} → {'✓' if is_similar else '✗'}")
                return is_similar
            except Exception as e:
                logger.warning(f"⚠️ Embedding comparison failed: {e}")
        
        # Fallback: text comparison
        c1_norm = caption1.lower().strip()
        c2_norm = caption2.lower().strip()
        
        if c1_norm == c2_norm:
            logger.debug(f"✓ Exact text match")
            return True
        
        # Word overlap
        words1 = set(c1_norm.split())
        words2 = set(c2_norm.split())
        
        if not words1 or not words2:
            return False
        
        overlap = len(words1 & words2) / max(len(words1), len(words2))
        is_similar = overlap >= 0.8
        
        logger.debug(f"📊 Text overlap: {overlap:.2%} → {'✓' if is_similar else '✗'}")
        return is_similar
    
    async def _store_event_in_neo4j(
        self,
        camera_id: str,
        event_data: Dict[str, Any]
    ) -> bool:
        """
        Store a deduplicated event in Neo4j
        FIXED: Better error handling and logging
        """
        try:
            start_time = datetime.fromisoformat(event_data["start_time"])
            end_time = datetime.fromisoformat(event_data["end_time"])
            duration = (end_time - start_time).total_seconds()
            
            event_id = f"evt_{camera_id}_{int(start_time.timestamp())}"
            
            retention_days = settings.DEFAULT_RETENTION_DAYS
            retention_until = (
                datetime.now() + timedelta(days=retention_days)
            ).date().isoformat() if retention_days else None
            
            # Simplified Neo4j query
            query = """
            MATCH (c:Camera {id: $camera_id})
            CREATE (e:Event {
                id: $event_id,
                caption: $caption,
                timestamp: datetime($start_time),
                start_time: datetime($start_time),
                end_time: datetime($end_time),
                duration: $duration,
                confidence: $confidence,
                frame_count: $frame_count,
                retention_until: $retention_until
            })
            CREATE (c)-[:CAPTURED]->(e)
            RETURN e.id as event_id
            """
            
            params = {
                "camera_id": camera_id,
                "event_id": event_id,
                "caption": event_data["caption"],
                "start_time": start_time.isoformat(),
                "end_time": end_time.isoformat(),
                "duration": duration,
                "confidence": event_data["confidence"],
                "frame_count": event_data["count"],
                "retention_until": retention_until
            }
            
            logger.debug(f"📝 Executing Neo4j query with params: {params}")
            
            result = await neo4j_client.async_execute_query(query, params)
            
            if result:
                logger.info(f"✅ Created Neo4j event: {event_id}")
                logger.info(f"   Caption: \"{event_data['caption'][:50]}...\"")
                logger.info(f"   Duration: {duration:.1f}s ({event_data['count']} frames)")
                return True
            else:
                logger.error(f"❌ Neo4j query returned no result")
                return False
        
        except Exception as e:
            logger.error(f"❌ Failed to store event in Neo4j: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return False
    
    async def migrate_camera_history(
        self,
        camera_id: str,
        force: bool = False
    ) -> Dict[str, Any]:
        """Manually trigger migration for a specific camera"""
        logger.info(f"🔄 Manual migration triggered for camera: {camera_id}")
        
        try:
            threshold = settings.REDIS_TTL_2HOUR if force else settings.REDIS_MIGRATION_THRESHOLD
            
            logger.info(f"📋 Getting keys with threshold: {threshold}s")
            
            expiring_keys = await redis_client.get_keys_near_expiry(
                camera_id=camera_id,
                threshold_seconds=threshold
            )
            
            logger.info(f"📋 Found {len(expiring_keys)} keys for camera {camera_id}")
            
            if not expiring_keys:
                logger.info(f"✅ No captions to migrate for {camera_id}")
                return {"events_created": 0, "captions_processed": 0}
            
            events_created = await self._process_camera_captions(
                camera_id,
                expiring_keys
            )
            
            # Clean up
            keys_to_delete = [item["key"] for item in expiring_keys]
            deleted = await redis_client.mark_for_deletion(keys_to_delete)
            
            stats = {
                "camera_id": camera_id,
                "captions_processed": len(expiring_keys),
                "events_created": events_created,
                "redis_keys_deleted": deleted
            }
            
            logger.info(f"✅ Manual migration complete: {stats}")
            return stats
        
        except Exception as e:
            logger.error(f"❌ Manual migration failed: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return {"error": str(e)}


# Singleton instance
migration_service = MigrationService()