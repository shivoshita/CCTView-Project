# FILE LOCATION: backend/app/api/v1/endpoints/anomaly_detection.py

"""
Anomaly Detection API Endpoints
Triggers anomaly detection checks for captions
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import Dict, Any, Optional
import logging
from datetime import datetime

from app.services.anomaly_detection_service import anomaly_detection_service
from app.db.redis.client import redis_client

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/check-caption", response_model=Dict[str, Any])
async def check_caption_for_anomalies(
    data: Dict[str, Any],
    background_tasks: BackgroundTasks
):
    """
    Check a caption against anomaly rules
    
    Expected payload:
    {
        "camera_id": "cam_001",
        "caption": "A person is walking in the restricted area",
        "timestamp": "2025-11-05T14:20:00",
        "confidence": 0.9
    }
    """
    try:
        camera_id = data.get("camera_id")
        caption = data.get("caption")
        timestamp = data.get("timestamp") or datetime.now().isoformat()
        confidence = data.get("confidence", 0.0)
        
        if not camera_id or not caption:
            raise HTTPException(
                status_code=400,
                detail="camera_id and caption are required"
            )
        
        logger.info(f"🔍 Checking caption for anomalies: camera={camera_id}")
        
        # Check for anomalies
        anomaly = await anomaly_detection_service.check_caption_for_anomalies(
            camera_id,
            caption,
            timestamp,
            confidence
        )
        
        if anomaly:
            return {
                "success": True,
                "anomaly_detected": True,
                "anomaly": anomaly
            }
        else:
            return {
                "success": True,
                "anomaly_detected": False,
                "message": "No anomalies detected"
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error checking caption: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/check-latest/{camera_id}", response_model=Dict[str, Any])
async def check_latest_caption_for_anomalies(
    camera_id: str,
    background_tasks: BackgroundTasks
):
    """
    Check the latest caption from Redis for a camera against anomaly rules
    
    Args:
        camera_id: Camera identifier
    """
    try:
        logger.info(f"🔍 Checking latest caption for anomalies: camera={camera_id}")
        
        # Check for anomalies
        anomaly = await anomaly_detection_service.check_latest_caption_for_camera(
            camera_id
        )
        
        if anomaly:
            return {
                "success": True,
                "anomaly_detected": True,
                "anomaly": anomaly
            }
        else:
            return {
                "success": True,
                "anomaly_detected": False,
                "message": "No anomalies detected in latest caption"
            }
            
    except Exception as e:
        logger.error(f"❌ Error checking latest caption: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

