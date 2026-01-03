# FILE LOCATION: backend/app/api/v1/endpoints/dashboard.py

from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import logging

from app.services.dashboard_service import dashboard_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/stats", response_model=Dict[str, Any])
async def get_dashboard_stats():
    """
    Get all dashboard statistics including:
    - Camera counts and status
    - Events today vs yesterday
    - Recent activity (last 5 events)
    - Anomalies (placeholder)
    - Tracked persons (placeholder)
    """
    try:
        stats = await dashboard_service.get_dashboard_stats()
        return stats
        
    except Exception as e:
        logger.error(f"Error fetching dashboard stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))