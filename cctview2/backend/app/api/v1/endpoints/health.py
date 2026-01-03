from fastapi import APIRouter
from typing import Dict, Any
import logging
import httpx

from app.db.redis.client import redis_client
from app.db.neo4j.client import neo4j_client
from app.core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/", response_model=Dict[str, Any])
async def health_check():
    """
    Comprehensive health check for all services
    """
    services = {}
    
    # Check Redis
    try:
        await redis_client.client.ping()
        services["redis"] = "connected"
    except Exception as e:
        logger.error(f"Redis health check failed: {e}")
        services["redis"] = "disconnected"
    
    # Check Neo4j
    try:
        await neo4j_client.async_verify_connectivity()
        services["neo4j"] = "connected"
    except Exception as e:
        logger.error(f"Neo4j health check failed: {e}")
        services["neo4j"] = "disconnected"
    
    # Check AI Service
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{settings.AI_SERVICE_URL}/health")
            if response.status_code == 200:
                services["ai_service"] = "connected"
            else:
                services["ai_service"] = "disconnected"
    except Exception as e:
        logger.error(f"AI Service health check failed: {e}")
        services["ai_service"] = "disconnected"
    
    # Determine overall status
    all_connected = all(status == "connected" for status in services.values())
    
    return {
        "status": "healthy" if all_connected else "degraded",
        "services": services
    }