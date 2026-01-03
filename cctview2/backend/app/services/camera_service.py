# FILE LOCATION: backend/app/services/camera_service.py

"""
Camera Service
Handles camera CRUD operations and coordinates with stream_manager
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
import uuid

from app.db.neo4j.client import neo4j_client
from app.db.redis.client import redis_client

logger = logging.getLogger(__name__)


class CameraService:
    """Service for camera management operations"""
    
    def __init__(self):
        logger.info("📹 Camera Service initialized")
    
    async def get_all_cameras(self) -> List[Dict[str, Any]]:
        """
        Get all cameras from Neo4j
        """
        try:
            query = """
            MATCH (c:Camera)
            RETURN c
            ORDER BY c.created_at DESC
            """
            
            result = await neo4j_client.async_execute_query(query)
            
            cameras = []
            for record in result:
                camera_data = dict(record['c'])
                cameras.append(camera_data)
            
            logger.info(f"Retrieved {len(cameras)} cameras")
            return cameras
            
        except Exception as e:
            logger.error(f"Error fetching cameras: {e}")
            raise
    
    async def get_camera_by_id(self, camera_id: str) -> Optional[Dict[str, Any]]:
        """
        Get single camera by ID
        """
        try:
            camera = await neo4j_client.get_camera(camera_id)
            
            if not camera:
                logger.warning(f"Camera not found: {camera_id}")
                return None
            
            return camera
            
        except Exception as e:
            logger.error(f"Error fetching camera {camera_id}: {e}")
            raise
    
    async def create_camera(self, camera_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create new camera in Neo4j
        
        Args:
            camera_data: Dict with name, location, stream_url, etc.
        
        Returns:
            Created camera data with generated ID
        """
        try:
            # Generate unique camera ID
            camera_id = f"cam_{uuid.uuid4().hex[:8]}"
            
            logger.info(f"Creating camera: {camera_data['name']} ({camera_id})")
            
            # Prepare full camera data
            full_data = {
                "id": camera_id,
                "name": camera_data["name"],
                "location": camera_data["location"],
                "stream_url": camera_data["stream_url"],
                "stream_type": camera_data.get("stream_type", "http"),
                "description": camera_data.get("description", ""),
                "status": "connecting",
                "resolution": "1920x1080",  # Will be detected from stream
                "fps": 30,  # Will be detected from stream
                "uptime": "0%",
                "eventsToday": 0,
                "created_at": datetime.now().isoformat()
            }
            
            # Store in Neo4j using the client method
            created_camera = await neo4j_client.create_camera(full_data)
            
            logger.info(f"✅ Camera created: {camera_id}")
            
            return created_camera
            
        except Exception as e:
            logger.error(f"Error creating camera: {e}")
            raise
    
    async def update_camera(
        self, 
        camera_id: str, 
        update_data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        Update camera configuration
        """
        try:
            # Check if camera exists
            existing = await self.get_camera_by_id(camera_id)
            if not existing:
                return None
            
            # Build update query
            update_fields = []
            params = {"camera_id": camera_id}
            
            if "name" in update_data:
                update_fields.append("c.name = $name")
                params["name"] = update_data["name"]
            
            if "location" in update_data:
                update_fields.append("c.location = $location")
                params["location"] = update_data["location"]
            
            if "description" in update_data:
                update_fields.append("c.description = $description")
                params["description"] = update_data["description"]
            
            if "status" in update_data:
                update_fields.append("c.status = $status")
                params["status"] = update_data["status"]
            
            if not update_fields:
                return existing
            
            query = f"""
            MATCH (c:Camera {{id: $camera_id}})
            SET {', '.join(update_fields)}
            RETURN c
            """
            
            result = await neo4j_client.async_execute_query(query, params)
            updated_camera = dict(result[0]['c'])
            
            logger.info(f"✅ Updated camera: {camera_id}")
            
            return updated_camera
            
        except Exception as e:
            logger.error(f"Error updating camera: {e}")
            raise
    
    async def delete_camera(self, camera_id: str) -> bool:
        """
        Delete camera from Neo4j and clear Redis cache
        """
        try:
            # Check if camera exists
            existing = await self.get_camera_by_id(camera_id)
            if not existing:
                return False
            
            # Delete from Neo4j (will cascade delete relationships)
            query = """
            MATCH (c:Camera {id: $camera_id})
            DETACH DELETE c
            """
            
            await neo4j_client.async_execute_query(query, {"camera_id": camera_id})
            
            # Clear Redis cache
            await redis_client.clear_camera_cache(camera_id)
            
            logger.info(f"✅ Deleted camera: {camera_id}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error deleting camera: {e}")
            raise
    
    async def update_camera_status(self, camera_id: str, status: str):
        """
        Update camera status
        """
        try:
            query = """
            MATCH (c:Camera {id: $camera_id})
            SET c.status = $status
            """
            await neo4j_client.async_execute_query(query, {
                "camera_id": camera_id,
                "status": status
            })
            logger.debug(f"📊 Camera {camera_id} status: {status}")
        except Exception as e:
            logger.error(f"Error updating camera status: {e}")
    
    async def update_camera_properties(
        self,
        camera_id: str,
        resolution: Optional[str] = None,
        fps: Optional[int] = None
    ):
        """
        Update camera stream properties (detected from stream)
        """
        try:
            update_fields = []
            params = {"camera_id": camera_id}
            
            if resolution:
                update_fields.append("c.resolution = $resolution")
                params["resolution"] = resolution
            
            if fps:
                update_fields.append("c.fps = $fps")
                params["fps"] = fps
            
            if not update_fields:
                return
            
            query = f"""
            MATCH (c:Camera {{id: $camera_id}})
            SET {', '.join(update_fields)}
            """
            
            await neo4j_client.async_execute_query(query, params)
            logger.debug(f"📊 Updated camera properties: {camera_id}")
            
        except Exception as e:
            logger.error(f"Error updating camera properties: {e}")
    
    async def increment_camera_events(self, camera_id: str):
        """
        Increment today's event count
        """
        try:
            query = """
            MATCH (c:Camera {id: $camera_id})
            SET c.eventsToday = COALESCE(c.eventsToday, 0) + 1
            """
            await neo4j_client.async_execute_query(query, {
                "camera_id": camera_id
            })
        except Exception as e:
            logger.error(f"Error incrementing events: {e}")
    
    async def get_camera_statistics(self, camera_id: str) -> Dict[str, Any]:
        """
        Get camera statistics (events, uptime, etc.)
        """
        try:
            query = """
            MATCH (c:Camera {id: $camera_id})
            OPTIONAL MATCH (c)-[:CAPTURED]->(e:Event)
            WHERE date(e.timestamp) = date()
            RETURN c, count(e) as events_today
            """
            
            result = await neo4j_client.async_execute_query(query, {
                "camera_id": camera_id
            })
            
            if not result:
                return {}
            
            camera_data = dict(result[0]['c'])
            events_today = result[0]['events_today']
            
            return {
                "camera_id": camera_id,
                "status": camera_data.get("status"),
                "events_today": events_today,
                "uptime": camera_data.get("uptime", "0%"),
                "resolution": camera_data.get("resolution"),
                "fps": camera_data.get("fps")
            }
            
        except Exception as e:
            logger.error(f"Error fetching camera statistics: {e}")
            raise


# Singleton instance
camera_service = CameraService()