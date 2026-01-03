"""
Panoramic Stream Manager
Collects frames from multiple cameras and stitches them into panoramic view
"""

import asyncio
import cv2
import numpy as np
import logging
from datetime import datetime
from typing import Dict, List, Tuple
from PIL import Image

from app.video.stream_manager import stream_manager
from app.services.ai_service_client import ai_service

logger = logging.getLogger(__name__)


class PanoramicStreamManager:
    """Manages panoramic stitching from multiple camera streams"""
    
    def __init__(self):
        self.active_panoramas: Dict[str, Dict] = {}  # panorama_id -> config
        self.latest_stitched_frames: Dict[str, Tuple] = {}  # panorama_id -> (frame, timestamp)
        logger.info("🎭 Panoramic Stream Manager initialized")
    
    async def create_panorama(
        self,
        panorama_id: str,
        camera_ids: List[str],
        stitch_mode: str = "panorama"
    ):
        """
        Start panoramic stitching from camera IDs
        
        Args:
            panorama_id: Unique identifier
            camera_ids: List of 2-6 camera IDs (in stitching order)
            stitch_mode: 'panorama' or 'scans'
        """
        if len(camera_ids) < 2:
            raise ValueError("Need at least 2 cameras")
        
        logger.info(f"🎬 Creating panorama {panorama_id} from {len(camera_ids)} cameras")
        
        self.active_panoramas[panorama_id] = {
            "camera_ids": camera_ids,
            "stitch_mode": stitch_mode,
            "active": True,
            "frames_stitched": 0,
            "started_at": datetime.now()
        }
        
        # Start stitching loop
        task = asyncio.create_task(
            self._panoramic_stitching_loop(panorama_id)
        )
        self.active_panoramas[panorama_id]["task"] = task
    
    async def _panoramic_stitching_loop(self, panorama_id: str):
        """Main loop: collect frames and stitch"""
        try:
            while self.active_panoramas.get(panorama_id, {}).get("active", False):
                pano_config = self.active_panoramas[panorama_id]
                camera_ids = pano_config["camera_ids"]
                
                # Collect latest frame from each camera
                frames = []
                for cam_id in camera_ids:
                    if cam_id in stream_manager.latest_frames:
                        frame, _ = stream_manager.latest_frames[cam_id]
                        frames.append(frame.copy())
                    else:
                        logger.warning(f"⚠️ No frame available for {cam_id}")
                
                # Need all frames
                if len(frames) != len(camera_ids):
                    await asyncio.sleep(0.5)
                    continue
                
                # Stitch frames using AI service (model_manager)
                from app.services.ai_service_client import ai_service
                
                result = await asyncio.get_event_loop().run_in_executor(
                    None,
                    self._stitch_frames_sync,
                    frames,
                    pano_config["stitch_mode"]
                )
                
                if result.get("success"):
                    stitched = result["stitched_frame"]
                    self.latest_stitched_frames[panorama_id] = (stitched, datetime.now())
                    self.active_panoramas[panorama_id]["frames_stitched"] += 1
                    logger.debug(f"✅ Panorama {panorama_id} stitched")
                else:
                    logger.warning(f"⚠️ Stitching failed: {result.get('error')}")
                
                # Stitch at ~2 FPS
                await asyncio.sleep(0.5)
        
        except Exception as e:
            logger.error(f"❌ Panoramic loop error: {e}")
    
    def _stitch_frames_sync(self, frames: List, mode: str):
        """Synchronous stitching (runs in executor)"""
        from app.services.ai_service_client import ai_service
        return ai_service.stitch_panoramic_frames(frames, mode)
    
    async def stop_panorama(self, panorama_id: str):
        """Stop panoramic stitching"""
        if panorama_id in self.active_panoramas:
            logger.info(f"🛑 Stopping panorama {panorama_id}")
            self.active_panoramas[panorama_id]["active"] = False
            
            task = self.active_panoramas[panorama_id].get("task")
            if task:
                task.cancel()
            
            del self.active_panoramas[panorama_id]
            
            if panorama_id in self.latest_stitched_frames:
                del self.latest_stitched_frames[panorama_id]


# Singleton
panoramic_stream_manager = PanoramicStreamManager()