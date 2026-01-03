"""
CCTView Main Backend Service
Coordinates video processing, storage, and API endpoints
"""

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import asyncio

from app.core.config import settings
from app.core.logging_config import setup_logging
from app.api.v1.router import api_router
from app.db.redis.client import redis_client
from app.db.neo4j.client import neo4j_client


# Setup logging
setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    # Startup
    logger.info("=" * 60)
    logger.info("🚀 CCTView Backend Service Starting...")
    logger.info("=" * 60)
    
    # Initialize Redis connection
    try:
        await redis_client.ping()
        logger.info("✅ Redis connected")
    except Exception as e:
        logger.error(f"❌ Redis connection failed: {e}")
    
    # Initialize Neo4j connection
    try:
        neo4j_client.verify_connectivity()
        logger.info("✅ Neo4j connected")
    except Exception as e:
        logger.error(f"❌ Neo4j connection failed: {e}")
    
    # Check AI Service availability
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{settings.AI_SERVICE_URL}/health")
            if response.status_code == 200:
                logger.info(f"✅ AI Service connected at {settings.AI_SERVICE_URL}")
            else:
                logger.warning(f"⚠️  AI Service returned status {response.status_code}")
    except Exception as e:
        logger.warning(f"⚠️  AI Service not reachable: {e}")
    
    # Start HLS cleanup background task
    from app.api.v1.endpoints.cameras import cleanup_orphaned_hls_files
    cleanup_task = asyncio.create_task(cleanup_orphaned_hls_files())
    logger.info("✅ HLS cleanup task started")
    
    logger.info("=" * 60)
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down CCTView Backend Service...")
    
    # Cancel cleanup task
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        logger.info("✅ HLS cleanup task stopped")
    
    # Stop all active HLS streams
    from app.api.v1.endpoints.cameras import active_hls_processes, stop_hls_transcoding
    camera_ids = list(active_hls_processes.keys())
    for camera_id in camera_ids:
        try:
            await stop_hls_transcoding(camera_id)
            logger.info(f"✅ Stopped HLS transcoding for {camera_id}")
        except Exception as e:
            logger.error(f"Error stopping HLS for {camera_id}: {e}")
    
    await redis_client.close()
    neo4j_client.close()


# Initialize FastAPI app
app = FastAPI(
    title="CCTView Backend API",
    version="1.0.0",
    description="Smart AI-Based Surveillance System - Main Backend",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://10.215.101.38:3000",
        "http://10.215.101.38:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api/v1")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "CCTView Backend API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "api": "/api/v1"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    health_status = {
        "status": "healthy",
        "services": {}
    }
    
    # Check Redis
    try:
        await redis_client.ping()
        health_status["services"]["redis"] = "connected"
    except Exception as e:
        health_status["services"]["redis"] = f"error: {str(e)}"
        health_status["status"] = "degraded"
    
    # Check Neo4j
    try:
        neo4j_client.verify_connectivity()
        health_status["services"]["neo4j"] = "connected"
    except Exception as e:
        health_status["services"]["neo4j"] = f"error: {str(e)}"
        health_status["status"] = "degraded"
    
    # Check AI Service
    try:
        import httpx
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{settings.AI_SERVICE_URL}/health")
            if response.status_code == 200:
                health_status["services"]["ai_service"] = "connected"
            else:
                health_status["services"]["ai_service"] = f"status: {response.status_code}"
    except Exception as e:
        health_status["services"]["ai_service"] = f"unreachable: {str(e)}"
        health_status["status"] = "degraded"
    
    # Check HLS streams
    from app.api.v1.endpoints.cameras import active_hls_processes
    health_status["services"]["hls_streams"] = {
        "active_count": len(active_hls_processes),
        "cameras": list(active_hls_processes.keys())
    }
    
    return health_status


@app.get("/debug/hls-status")
async def debug_hls_status():
    """Debug endpoint to check HLS stream status"""
    from app.api.v1.endpoints.cameras import active_hls_processes, HLS_OUTPUT_DIR
    import os
    
    status = {
        "active_streams": len(active_hls_processes),
        "cameras": {}
    }
    
    for camera_id, info in active_hls_processes.items():
        output_dir = info['output_dir']
        segments = list(output_dir.glob("*.ts")) if output_dir.exists() else []
        
        status["cameras"][camera_id] = {
            "pid": info['process'].pid if info['process'] else None,
            "running": info['process'].returncode is None if info['process'] else False,
            "output_dir": str(output_dir),
            "segment_count": len(segments),
            "segments": [s.name for s in segments],
            "started_at": info.get('started_at').isoformat() if info.get('started_at') else None
        }
    
    # Check for orphaned directories
    orphaned = []
    if HLS_OUTPUT_DIR.exists():
        for camera_dir in HLS_OUTPUT_DIR.iterdir():
            if camera_dir.is_dir() and camera_dir.name not in active_hls_processes:
                orphaned.append({
                    "camera_id": camera_dir.name,
                    "segment_count": len(list(camera_dir.glob("*.ts"))),
                    "size_mb": sum(f.stat().st_size for f in camera_dir.glob("*")) / (1024 * 1024)
                })
    
    status["orphaned_directories"] = orphaned
    
    return status


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )