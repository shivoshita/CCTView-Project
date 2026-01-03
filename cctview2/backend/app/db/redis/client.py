"""
Redis Client
Manages Redis connection pool and operations
HOT CACHE ONLY - Data migrates to Neo4j after 2 hours
"""

import redis.asyncio as aioredis
import logging
from typing import Optional, Any, List, Dict, Tuple
import json
import numpy as np
from datetime import datetime, timedelta

from app.core.config import settings

logger = logging.getLogger(__name__)


class RedisClient:
    """Async Redis client wrapper - Hot cache only (2 hours max)"""
    
    def __init__(self):
        self.pool = None
        self.client = None
        logger.info("🔴 Redis Client initialized (Hot Cache Only - 2hr TTL)")
    
    async def connect(self):
        """Create connection pool"""
        try:
            self.pool = aioredis.ConnectionPool(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                password=settings.REDIS_PASSWORD,
                db=settings.REDIS_DB,
                max_connections=settings.REDIS_MAX_CONNECTIONS,
                decode_responses=False  # Handle binary data
            )
            self.client = aioredis.Redis(connection_pool=self.pool)
            await self.ping()
            logger.info("✅ Redis connected successfully")
        except Exception as e:
            logger.error(f"❌ Redis connection failed: {e}")
            raise
    
    async def close(self):
        """Close connection pool"""
        if self.client:
            await self.client.close()
        if self.pool:
            await self.pool.disconnect()
        logger.info("Redis connection closed")
    
    async def ping(self) -> bool:
        """Test connection"""
        try:
            if not self.client:
                await self.connect()
            return await self.client.ping()
        except Exception as e:
            logger.error(f"Redis ping failed: {e}")
            return False
    
    # ==================== CAPTION STORAGE (NEW - WITH METADATA) ====================
    
    async def store_caption_with_metadata(
        self,
        camera_id: str,
        timestamp: datetime,
        caption: str,
        embedding: List[float],
        confidence: float = 0.0,
        metadata: Optional[dict] = None
    ) -> bool:
        """
        Store caption with full metadata for later deduplication
        
        Args:
            camera_id: Camera identifier
            timestamp: Frame timestamp
            caption: Generated caption text
            embedding: Caption embedding vector
            confidence: AI confidence score
            metadata: Additional metadata (detections, etc.)
        
        Returns:
            True if stored successfully
        """
        try:
            if not self.client:
                await self.connect()
            
            timestamp_key = timestamp.isoformat()
            ttl = settings.REDIS_TTL_2HOUR  # Fixed 2 hours
            
            # Prepare complete event data
            event_data = {
                "camera_id": camera_id,
                "timestamp": timestamp_key,
                "caption": caption,
                "confidence": confidence,
                "created_at": datetime.now().isoformat(),
                "metadata": metadata or {}
            }
            
            # Store caption (text)
            caption_key = f"caption:{camera_id}:{timestamp_key}"
            await self.client.setex(caption_key, ttl, caption)
            
            # Store embedding (binary)
            embedding_key = f"embedding:{camera_id}:{timestamp_key}"
            embedding_array = np.array(embedding, dtype=np.float32)
            await self.client.setex(embedding_key, ttl, embedding_array.tobytes())
            
            # Store full event metadata (JSON)
            metadata_key = f"meta:{camera_id}:{timestamp_key}"
            await self.client.setex(metadata_key, ttl, json.dumps(event_data))
            
            logger.debug(f"✅ Stored caption with metadata: {camera_id} at {timestamp_key}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to store caption: {e}")
            return False
    
    async def get_caption_with_metadata(
        self,
        camera_id: str,
        timestamp: str
    ) -> Optional[Dict[str, Any]]:
        """
        Retrieve caption with all metadata
        
        Returns:
            Dict with caption, embedding, confidence, metadata
        """
        try:
            if not self.client:
                await self.connect()
            
            # Get metadata
            metadata_key = f"meta:{camera_id}:{timestamp}"
            meta_json = await self.client.get(metadata_key)
            
            if not meta_json:
                return None
            
            event_data = json.loads(meta_json)
            
            # Get embedding
            embedding_key = f"embedding:{camera_id}:{timestamp}"
            embedding_bytes = await self.client.get(embedding_key)
            
            if embedding_bytes:
                event_data["embedding"] = np.frombuffer(
                    embedding_bytes, 
                    dtype=np.float32
                ).tolist()
            
            return event_data
            
        except Exception as e:
            logger.error(f"❌ Failed to get caption metadata: {e}")
            return None
    
    # ==================== MIGRATION DETECTION ====================
    
    async def get_keys_near_expiry(
        self,
        camera_id: Optional[str] = None,
        threshold_seconds: int = None
    ) -> List[Dict[str, Any]]:
        """
        Find caption keys that are about to expire (for migration to Neo4j)
        
        Args:
            camera_id: Optional - filter by camera
            threshold_seconds: Time before expiry to trigger migration (default: 5 minutes)
        
        Returns:
            List of keys with their TTL and metadata
        """
        try:
            if not self.client:
                await self.connect()
            
            threshold = threshold_seconds or settings.REDIS_MIGRATION_THRESHOLD
            expiring_keys = []
            
            # Search pattern
            if camera_id:
                pattern = f"meta:{camera_id}:*"
            else:
                pattern = "meta:*"
            
            cursor = 0
            while True:
                cursor, keys = await self.client.scan(
                    cursor,
                    match=pattern,
                    count=100
                )
                
                for key in keys:
                    try:
                        # Get TTL
                        ttl = await self.client.ttl(key)
                        
                        # Check if near expiry (within threshold)
                        if 0 < ttl <= threshold:
                            key_str = key.decode() if isinstance(key, bytes) else key
                            
                            # Parse camera_id and timestamp from key
                            parts = key_str.split(':')
                            if len(parts) >= 3:
                                cam_id = parts[1]
                                timestamp = ':'.join(parts[2:])
                                
                                # Get metadata
                                meta_data = await self.get_caption_with_metadata(
                                    cam_id, 
                                    timestamp
                                )
                                
                                if meta_data:
                                    expiring_keys.append({
                                        "key": key_str,
                                        "camera_id": cam_id,
                                        "timestamp": timestamp,
                                        "ttl_remaining": ttl,
                                        "data": meta_data
                                    })
                    
                    except Exception as e:
                        logger.error(f"Error processing key {key}: {e}")
                        continue
                
                if cursor == 0:
                    break
            
            logger.info(f"📋 Found {len(expiring_keys)} keys near expiry (< {threshold}s)")
            return expiring_keys
            
        except Exception as e:
            logger.error(f"❌ Failed to get keys near expiry: {e}")
            return []
    
    async def get_camera_captions_in_range(
        self,
        camera_id: str,
        start_time: datetime,
        end_time: datetime
    ) -> List[Dict[str, Any]]:
        """
        Get all captions for a camera within a time range (for deduplication)
        
        Args:
            camera_id: Camera identifier
            start_time: Start of time range
            end_time: End of time range
        
        Returns:
            List of caption events with metadata
        """
        try:
            if not self.client:
                await self.connect()
            
            pattern = f"meta:{camera_id}:*"
            captions = []
            
            cursor = 0
            while True:
                cursor, keys = await self.client.scan(
                    cursor,
                    match=pattern,
                    count=100
                )
                
                for key in keys:
                    try:
                        key_str = key.decode() if isinstance(key, bytes) else key
                        parts = key_str.split(':')
                        
                        if len(parts) >= 3:
                            timestamp_str = ':'.join(parts[2:])
                            timestamp = datetime.fromisoformat(timestamp_str)
                            
                            # Check if in range
                            if start_time <= timestamp <= end_time:
                                meta_data = await self.get_caption_with_metadata(
                                    camera_id,
                                    timestamp_str
                                )
                                
                                if meta_data:
                                    captions.append(meta_data)
                    
                    except Exception as e:
                        logger.debug(f"Skipping invalid key format: {key}")
                        continue
                
                if cursor == 0:
                    break
            
            # Sort by timestamp
            captions.sort(key=lambda x: x["timestamp"])
            
            logger.debug(f"📋 Found {len(captions)} captions in range")
            return captions
            
        except Exception as e:
            logger.error(f"❌ Failed to get captions in range: {e}")
            return []
    
    # ==================== LEGACY METHODS (Simplified) ====================
    
    async def store_caption(
        self,
        camera_id: str,
        timestamp: str,
        caption: str,
        ttl: Optional[int] = None
    ) -> bool:
        """Legacy method - redirects to new method"""
        try:
            ts = datetime.fromisoformat(timestamp)
            return await self.store_caption_with_metadata(
                camera_id=camera_id,
                timestamp=ts,
                caption=caption,
                embedding=[],  # Empty embedding
                confidence=0.0
            )
        except Exception as e:
            logger.error(f"Failed to store caption: {e}")
            return False
    
    async def get_caption(self, camera_id: str, timestamp: str) -> Optional[str]:
        """Legacy method - returns just caption text"""
        try:
            if not self.client:
                await self.connect()
            
            key = f"caption:{camera_id}:{timestamp}"
            value = await self.client.get(key)
            return value.decode() if value else None
        except Exception as e:
            logger.error(f"Failed to get caption: {e}")
            return None
    
    # ==================== DEDUPLICATION HELPERS ====================
    
    async def mark_for_deletion(self, keys: List[str]) -> int:
        """
        Mark keys for deletion after successful migration
        
        Args:
            keys: List of Redis keys to delete
        
        Returns:
            Number of keys deleted
        """
        try:
            if not self.client:
                await self.connect()
            
            if not keys:
                return 0
            
            # Delete all related keys (caption, embedding, metadata)
            all_keys = []
            for key in keys:
                # Get base key parts
                parts = key.split(':')
                if len(parts) >= 3:
                    camera_id = parts[1]
                    timestamp = ':'.join(parts[2:])
                    
                    # Add all related keys
                    all_keys.extend([
                        f"caption:{camera_id}:{timestamp}",
                        f"embedding:{camera_id}:{timestamp}",
                        f"meta:{camera_id}:{timestamp}"
                    ])
            
            deleted = await self.client.delete(*all_keys) if all_keys else 0
            logger.info(f"🗑️  Deleted {deleted} keys after migration")
            return deleted
            
        except Exception as e:
            logger.error(f"❌ Failed to delete keys: {e}")
            return 0
    
    # ==================== CACHE STATISTICS ====================
    
    async def get_cache_stats(self) -> dict:
        """Get Redis cache statistics"""
        try:
            if not self.client:
                await self.connect()
            
            info = await self.client.info()
            
            return {
                "used_memory_mb": info.get("used_memory", 0) / (1024 * 1024),
                "total_keys": await self.client.dbsize(),
                "connected_clients": info.get("connected_clients", 0),
                "uptime_seconds": info.get("uptime_in_seconds", 0),
                "ttl_mode": "FIXED 2 HOURS",
                "migration_threshold": f"{settings.REDIS_MIGRATION_THRESHOLD}s"
            }
        except Exception as e:
            logger.error(f"Failed to get cache stats: {e}")
            return {}
    
    async def clear_camera_cache(self, camera_id: str) -> int:
        """Clear all cached data for a camera"""
        try:
            if not self.client:
                await self.connect()
            
            patterns = [
                f"caption:{camera_id}:*",
                f"embedding:{camera_id}:*",
                f"meta:{camera_id}:*"
            ]
            
            deleted = 0
            for pattern in patterns:
                cursor = 0
                while True:
                    cursor, keys = await self.client.scan(
                        cursor,
                        match=pattern,
                        count=1000
                    )
                    
                    if keys:
                        deleted += await self.client.delete(*keys)
                    
                    if cursor == 0:
                        break
            
            logger.info(f"🗑️  Cleared {deleted} keys for camera {camera_id}")
            return deleted
            
        except Exception as e:
            logger.error(f"Failed to clear camera cache: {e}")
            return 0


# Singleton instance
redis_client = RedisClient()