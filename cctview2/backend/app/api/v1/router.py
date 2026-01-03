# FILE LOCATION: backend/app/api/v1/router.py

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.api.v1.endpoints import health, ai, cameras, dashboard, chat, migration, events, anomalies, persons, person_reid
from app.api.v1.endpoints import anomaly_notifications, anomaly_detection
from app.api.v1.websockets.caption_manager import caption_manager
from app.api.v1.websockets.alerts_ws import alerts_manager
import logging

api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])
api_router.include_router(cameras.router, prefix="/cameras", tags=["cameras"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(migration.router, prefix="/migration", tags=["migration"])
api_router.include_router(events.router, prefix="/events", tags=["events"])  # NEW - Events endpoint
api_router.include_router(anomalies.router, prefix="/anomalies", tags=["anomalies"])  # NEW - Anomalies endpoint
api_router.include_router(anomaly_notifications.router, prefix="/anomalies/notifications", tags=["anomaly_notifications"])  # NEW - Notifications
api_router.include_router(anomaly_detection.router, prefix="/anomaly-detection", tags=["anomaly_detection"])  # NEW - Anomaly Detection
api_router.include_router(persons.router, prefix="/persons", tags=["persons"])  # NEW - Persons endpoint
api_router.include_router(person_reid.router, prefix="/person-reid", tags=["person_reid"])
logger = logging.getLogger(__name__)


@api_router.websocket("/ws/camera/{camera_id}/captions")
async def camera_captions_websocket(websocket: WebSocket, camera_id: str):
    """WebSocket endpoint for real-time camera captions"""
    await caption_manager.connect(websocket, camera_id)
    try:
        while True:
            # Keep connection alive and respond to pings
            data = await websocket.receive_text()
            # Echo back for ping/pong
            await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        caption_manager.disconnect(websocket, camera_id)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        caption_manager.disconnect(websocket, camera_id)


@api_router.websocket("/ws/alerts")
async def alerts_websocket(websocket: WebSocket):
    """WebSocket endpoint for real-time anomaly alerts"""
    await alerts_manager.connect(websocket)
    try:
        while True:
            # Keep connection alive and respond to pings
            data = await websocket.receive_text()
            # Echo back for ping/pong
            await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        alerts_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"Alerts WebSocket error: {e}")
        alerts_manager.disconnect(websocket)