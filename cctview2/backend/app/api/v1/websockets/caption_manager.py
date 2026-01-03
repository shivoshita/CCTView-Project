# FILE LOCATION: backend/app/api/v1/websockets/caption_manager.py

"""
WebSocket Connection Manager for Camera Captions
Handles real-time caption broadcasting to connected clients
"""

from fastapi import WebSocket, WebSocketDisconnect
import logging
from typing import Dict, List

logger = logging.getLogger(__name__)


class CaptionConnectionManager:
    """Manages WebSocket connections for camera captions"""
    
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, camera_id: str):
        """Accept and register a new WebSocket connection"""
        await websocket.accept()
        if camera_id not in self.active_connections:
            self.active_connections[camera_id] = []
        self.active_connections[camera_id].append(websocket)
        logger.info(f"✅ WebSocket connected for camera: {camera_id}")
    
    def disconnect(self, websocket: WebSocket, camera_id: str):
        """Remove a WebSocket connection"""
        if camera_id in self.active_connections:
            if websocket in self.active_connections[camera_id]:
                self.active_connections[camera_id].remove(websocket)
            if not self.active_connections[camera_id]:
                del self.active_connections[camera_id]
        logger.info(f"❌ WebSocket disconnected for camera: {camera_id}")
    
    async def send_caption(self, camera_id: str, data: dict):
        """Broadcast caption to all connected clients for a camera"""
        if camera_id in self.active_connections:
            disconnected = []
            for connection in self.active_connections[camera_id]:
                try:
                    await connection.send_json(data)
                except Exception as e:
                    logger.error(f"Error sending caption to WebSocket: {e}")
                    disconnected.append(connection)
            
            # Remove disconnected clients
            for conn in disconnected:
                self.disconnect(conn, camera_id)


# Singleton instance
caption_manager = CaptionConnectionManager()