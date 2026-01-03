# FILE LOCATION: backend/app/video/stream_manager.py

"""
Stream Manager
Handles video stream processing using OpenCV/FFmpeg
"""

import asyncio
import cv2
import numpy as np
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List, Tuple
from PIL import Image
from app.api.v1.websockets.caption_manager import caption_manager

from app.core.config import settings
from app.db.neo4j.client import neo4j_client
from app.db.redis.client import redis_client
from app.services.camera_service import camera_service
from app.services.ai_service_client import ai_service
from app.video.frame_extractor import FrameExtractor

logger = logging.getLogger(__name__)


class StreamManager:
    """Manages video streams from cameras"""
    
    def __init__(self):
        self.active_streams: Dict[str, Dict[str, Any]] = {}
        self.frame_extractor = FrameExtractor()
        self.frame_buffers: Dict[str, List] = {}
        self.latest_frames: Dict[str, Tuple] = {}
        logger.info("🎥 Stream Manager initialized")
    
    async def start_camera_stream(
        self, 
        camera_id: str, 
        stream_url: str, 
        stream_type: str = "http"
    ):
        """
        Start processing a camera stream
        
        Args:
            camera_id: Unique camera identifier
            stream_url: HTTP/RTSP stream URL (e.g., http://192.168.1.100:8080/video)
            stream_type: 'http' or 'rtsp'
        """
        try:
            logger.info(f"🎬 Starting stream for camera: {camera_id}")
            logger.info(f"📡 Stream URL: {stream_url}")
            logger.info(f"📡 Stream Type: {stream_type}")
            
            # Mark as connecting
            await camera_service.update_camera_status(camera_id, "connecting")
            
            # Initialize stream data
            self.active_streams[camera_id] = {
                "camera_id": camera_id,
                "stream_url": stream_url,
                "stream_type": stream_type,
                "active": True,
                "frames_processed": 0,
                "errors": 0,
                "started_at": datetime.now(),
                "last_frame_time": None,
                "task": None
            }
            
            # Start stream processing loop
            task = asyncio.create_task(
                self._stream_processing_loop(camera_id, stream_url, stream_type)
            )
            self.active_streams[camera_id]["task"] = task
            
            logger.info(f"✅ Stream task started for {camera_id}")
            
        except Exception as e:
            logger.error(f"❌ Error starting stream for {camera_id}: {e}")
            await camera_service.update_camera_status(camera_id, "error")
            raise
    
    async def _stream_processing_loop(
        self,
        camera_id: str,
        stream_url: str,
        stream_type: str
    ):
        """
        Main loop for processing video stream
        Reads frames, extracts keyframes, sends to AI service
        """
        cap = None
        reconnect_attempts = 0
        max_reconnect_attempts = 5
        
        try:
            while self.active_streams.get(camera_id, {}).get("active", False):
                try:
                    # Open video capture (works with HTTP and RTSP)
                    logger.info(f"🔌 Connecting to stream: {stream_url}")
                    cap = cv2.VideoCapture(stream_url)
                    
                    if not cap.isOpened():
                        raise Exception(f"Failed to open video stream: {stream_url}")
                    
                    # Get stream properties
                    fps = int(cap.get(cv2.CAP_PROP_FPS)) or 30
                    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                    
                    logger.info(f"📺 Stream properties: {width}x{height} @ {fps} FPS")
                    
                    # Update camera with detected properties
                    await camera_service.update_camera_properties(
                        camera_id,
                        resolution=f"{width}x{height}",
                        fps=fps
                    )
                    
                    # Mark as active
                    await camera_service.update_camera_status(camera_id, "active")
                    reconnect_attempts = 0
                    
                    # Frame extraction state
                    frame_count = 0
                    last_extract_time = datetime.now()
                    prev_frame = None
                    
                    logger.info(f"🎬 Starting frame processing for {camera_id}")
                    
                    # Process frames continuously
                    while self.active_streams.get(camera_id, {}).get("active", False):
                        ret, frame = cap.read()
                        
                        if not ret:
                            logger.warning(f"⚠️ Failed to read frame from {camera_id}")
                            break
                        
                        frame_count += 1
                        current_time = datetime.now()
                        
                        # NEW: Store latest frame for real-time detections
                        self.latest_frames[camera_id] = (frame.copy(), current_time)
                        
                        # Update stream metadata
                        self.active_streams[camera_id]["last_frame_time"] = current_time.isoformat()
                        
                        # Decide if we should extract this frame FOR CAPTIONS
                        should_extract = self.frame_extractor.should_extract_frame(
                            frame=frame,
                            prev_frame=prev_frame,
                            current_time=current_time,
                            last_extract_time=last_extract_time,
                            frame_count=frame_count,
                            fps=fps
                        )
                        
                        if should_extract:
                            logger.info(f"📸 Extracting keyframe from {camera_id} (frame #{frame_count})")
                            
                            # Process frame in background (non-blocking) FOR CAPTIONS
                            asyncio.create_task(
                                self._process_frame(camera_id, frame.copy(), current_time)
                            )
                            
                            last_extract_time = current_time
                            self.active_streams[camera_id]["frames_processed"] += 1
                        
                        prev_frame = frame
                        
                        # Small delay to prevent CPU overload
                        await asyncio.sleep(0.01)
                
                except Exception as e:
                    logger.error(f"❌ Stream error for {camera_id}: {e}")
                    self.active_streams[camera_id]["errors"] += 1
                    
                    # Attempt reconnection
                    reconnect_attempts += 1
                    if reconnect_attempts >= max_reconnect_attempts:
                        logger.error(f"❌ Max reconnection attempts reached for {camera_id}")
                        await camera_service.update_camera_status(camera_id, "error")
                        break
                    
                    logger.info(f"🔄 Reconnecting... (attempt {reconnect_attempts}/{max_reconnect_attempts})")
                    await camera_service.update_camera_status(camera_id, "reconnecting")
                    await asyncio.sleep(5)  # Wait before reconnecting
                
                finally:
                    if cap:
                        cap.release()
        
        except Exception as e:
            logger.error(f"❌ Fatal error in stream loop for {camera_id}: {e}")
            await camera_service.update_camera_status(camera_id, "error")
        
        finally:
            if cap:
                cap.release()
            logger.info(f"🛑 Stream stopped for {camera_id}")
    
    async def _process_frame(
        self,
        camera_id: str,
        frame: np.ndarray,
        timestamp: datetime
    ):
        """
        Buffer frames and process in batches based on caption_interval
        Sends ALL accumulated frames to AI service for comprehensive caption
        """
        try:
            # Get camera's caption interval setting (default 15s)
            query = """
            MATCH (c:Camera {id: $camera_id})
            RETURN coalesce(c.caption_interval, 15) as interval
            """
            result = await neo4j_client.async_execute_query(query, {"camera_id": camera_id})
            caption_interval = result[0]["interval"] if result else 15
            
            # Initialize frame buffer for this camera if not exists
            if camera_id not in self.frame_buffers:
                self.frame_buffers[camera_id] = {
                    "frames": [],
                    "start_time": timestamp,
                    "interval": caption_interval,
                    "processing": False
                }
            
            buffer = self.frame_buffers[camera_id]
            
            # Update interval if changed
            if buffer["interval"] != caption_interval:
                buffer["interval"] = caption_interval
                logger.info(f"🔄 Caption interval updated for {camera_id}: {caption_interval}s")
            
            # Check if already processing - prevent concurrent processing
            if buffer.get("processing", False):
                logger.debug(f"⏭️ Skipping frame for {camera_id} - already processing")
                return
            
            # Add frame to buffer
            buffer["frames"].append((frame.copy(), timestamp))
            
            # Check if interval elapsed
            elapsed = (timestamp - buffer["start_time"]).total_seconds()
            
            logger.debug(f"📦 Buffered frame {len(buffer['frames'])} for {camera_id} (elapsed: {elapsed:.1f}s/{caption_interval}s)")
            
            # Check if we've reached the interval
            if elapsed < caption_interval:
                return  # Keep accumulating
            
            # INTERVAL REACHED - Set processing lock and process batch
            buffer["processing"] = True
            
            logger.info(f"⏰ Caption interval reached ({elapsed:.1f}s) - Processing {len(buffer['frames'])} frames for {camera_id}")
            
            # Process ALL accumulated frames
            await self._process_frame_batch(camera_id, buffer["frames"], caption_interval)
            
            # Reset buffer with current timestamp as new start time
            self.frame_buffers[camera_id] = {
                "frames": [],
                "start_time": datetime.now(),
                "interval": caption_interval,
                "processing": False
            }
            
            logger.info(f"🎉 Caption processing complete for {camera_id} (next caption in {caption_interval}s)")
            
        except Exception as e:
            logger.error(f"❌ Error processing frame: {e}")
            import traceback
            traceback.print_exc()
            # Reset buffer on error
            caption_interval_safe = 15  # Default fallback
            try:
                caption_interval_safe = caption_interval
            except:
                pass
            self.frame_buffers[camera_id] = {
                "frames": [],
                "start_time": datetime.now(),
                "interval": caption_interval_safe,
                "processing": False
            }

    async def _process_frame_batch(
        self,
        camera_id: str,
        frames_with_timestamps: List[Tuple[np.ndarray, datetime]],
        interval: int
    ):
        """
        Process batch of accumulated frames and generate comprehensive caption
        
        Args:
            camera_id: Camera identifier
            frames_with_timestamps: List of (frame, timestamp) tuples
            interval: Caption interval in seconds
        """
        try:
            if not frames_with_timestamps:
                logger.warning(f"⚠️ No frames to process for {camera_id}")
                return
            
            # Extract first and last timestamps
            first_frame, first_timestamp = frames_with_timestamps[0]
            last_frame, last_timestamp = frames_with_timestamps[-1]
            
            logger.info(f"🎬 Processing batch of {len(frames_with_timestamps)} frames")
            logger.info(f"   Start: {first_timestamp.isoformat()}")
            logger.info(f"   End: {last_timestamp.isoformat()}")
            
            # ADD THIS SMART SAMPLING CODE:
            # Smart sampling: select distributed frames instead of ALL frames
            max_frames_to_analyze = 8  # Analyze at most 4 frames per interval
            if len(frames_with_timestamps) > max_frames_to_analyze:
                # Select evenly distributed frames (first, middle points, last)
                indices = np.linspace(0, len(frames_with_timestamps) - 1, max_frames_to_analyze, dtype=int)
                frames_with_timestamps = [frames_with_timestamps[i] for i in indices]
                logger.info(f"🎯 Smart sampling: Selected {len(frames_with_timestamps)} representative frames from batch")

            # Continue with existing code...
            logger.info(f"🎬 Processing batch of {len(frames_with_timestamps)} frames")
            
            # Convert frames to PIL Images for AI service
            pil_images = []
            for frame, _ in frames_with_timestamps:
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                pil_image = Image.fromarray(frame_rgb)
                
                # Resize if too large
                max_size = 1920
                if pil_image.width > max_size or pil_image.height > max_size:
                    pil_image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
                
                pil_images.append(pil_image)
            
            # Send batch to AI service for comprehensive caption
            logger.info(f"📤 Sending {len(pil_images)} frames to AI service (192.168.0.9:8888)")
            
            caption_result = await ai_service.generate_batch_caption(
                images=pil_images
                # Prompt is now built into the client, no need to pass it here
            )
            
            if not caption_result.get("success"):
                logger.error(f"❌ AI service failed: {caption_result.get('error')}")
                return
            
            caption = caption_result.get("caption", "")
            confidence = caption_result.get("confidence", 0.0)
            
            logger.info(f"✅ Comprehensive caption generated:")
            logger.info(f"   '{caption[:150]}...'")
            logger.info(f"   Confidence: {confidence:.2%}")
            logger.info(f"   Frames analyzed: {len(pil_images)}")
            
            # Generate embedding
            embedding_result = await ai_service.generate_embedding(caption)
            embedding = embedding_result.get("embedding", []) if embedding_result.get("success") else []
            
            if embedding:
                logger.info(f"✅ Embedding generated: {len(embedding)} dimensions")
            
            # Store in Redis with metadata about the batch
            logger.info(f"💾 Storing in Redis (hot cache - 2 hours TTL)...")
            success = await redis_client.store_caption_with_metadata(
                camera_id=camera_id,
                timestamp=first_timestamp,  # Use first frame timestamp
                caption=caption,
                embedding=embedding,
                confidence=confidence,
                metadata={
                    "processing_time": caption_result.get("processing_time", 0),
                    "ai_model": "VILA_BATCH",
                    "frames_analyzed": len(pil_images),
                    "interval": interval,
                    "time_range": {
                        "start": first_timestamp.isoformat(),
                        "end": last_timestamp.isoformat()
                    }
                }
            )
            
            if success:
                logger.info(f"✅ Stored in Redis cache")
                
                # Broadcast to WebSocket
                caption_data = {
                    "type": "caption",
                    "camera_id": camera_id,
                    "timestamp": first_timestamp.isoformat(),
                    "caption": caption,
                    "confidence": confidence,
                    "stored": True,
                    "interval": interval,
                    "frames_analyzed": len(pil_images),
                    "time_range": {
                        "start": first_timestamp.isoformat(),
                        "end": last_timestamp.isoformat()
                    }
                }
                
                try:
                    await caption_manager.send_caption(camera_id, caption_data)
                    logger.info(f"📡 Caption broadcasted to WebSocket clients for {camera_id}")
                except Exception as broadcast_error:
                    logger.error(f"⚠️ Failed to broadcast caption: {broadcast_error}")
                
                # Update camera event count
                await camera_service.increment_camera_events(camera_id)
            else:
                logger.error(f"❌ Failed to store in Redis")
            
        except Exception as e:
            logger.error(f"❌ Error processing frame batch: {e}")
            import traceback
            traceback.print_exc()
    
    async def stop_camera_stream(self, camera_id: str):
        """Stop camera stream processing"""
        try:
            if camera_id in self.active_streams:
                logger.info(f"🛑 Stopping stream for {camera_id}")
                
                # Mark as inactive
                self.active_streams[camera_id]["active"] = False
                
                # Cancel task
                task = self.active_streams[camera_id].get("task")
                if task:
                    task.cancel()
                
                # Remove from active streams
                del self.active_streams[camera_id]
                
                await camera_service.update_camera_status(camera_id, "inactive")
                
                logger.info(f"✅ Stream stopped for {camera_id}")
                return True
            else:
                logger.warning(f"⚠️ Camera {camera_id} not in active streams")
                return False
        
        except Exception as e:
            logger.error(f"Error stopping stream: {e}")
            raise
    
    async def get_stream_status(self, camera_id: str) -> Dict[str, Any]:
        """Get current stream status"""
        if camera_id in self.active_streams:
            stream_data = self.active_streams[camera_id]
            uptime_seconds = (datetime.now() - stream_data["started_at"]).total_seconds()
            
            return {
                "active": stream_data["active"],
                "status": "streaming",
                "last_frame_time": stream_data.get("last_frame_time"),
                "frames_processed": stream_data["frames_processed"],
                "errors": stream_data["errors"],
                "uptime_seconds": int(uptime_seconds)
            }
        
        return {
            "active": False,
            "status": "inactive",
            "last_frame_time": None,
            "frames_processed": 0,
            "errors": 0,
            "uptime_seconds": 0
        }
    
    async def test_stream_connection(self, stream_url: str) -> Dict[str, Any]:
        """
        Test if stream URL is accessible before adding camera
        """
        try:
            logger.info(f"🧪 Testing stream connection: {stream_url}")
            
            cap = cv2.VideoCapture(stream_url)
            
            if not cap.isOpened():
                cap.release()
                return {
                    "success": False,
                    "error": "Failed to connect to stream"
                }
            
            # Get properties
            fps = int(cap.get(cv2.CAP_PROP_FPS)) or 30
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            
            # Try to read one frame
            ret, frame = cap.read()
            cap.release()
            
            if not ret:
                return {
                    "success": False,
                    "error": "Connected but failed to read frames"
                }
            
            logger.info(f"✅ Stream test successful: {width}x{height} @ {fps} FPS")
            
            return {
                "success": True,
                "message": "Stream is accessible",
                "properties": {
                    "resolution": f"{width}x{height}",
                    "fps": fps
                }
            }
        
        except Exception as e:
            logger.error(f"Error testing connection: {e}")
            return {
                "success": False,
                "error": str(e)
            }


# Singleton instance
stream_manager = StreamManager()