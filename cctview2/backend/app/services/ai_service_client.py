"""
AI Service Client
Communicates with the GPU server (192.168.0.9:8888) for AI inference
"""

import httpx
import logging
import cv2  # ✅ ADDED: Missing import for panoramic stitching
from typing import Dict, Any, List, Optional
from PIL import Image
import io
import numpy as np

from app.core.config import settings

logger = logging.getLogger(__name__)


class AIServiceClient:
    """Client for communicating with AI Service on GPU server"""
    
    def __init__(self):
        self.base_url = settings.AI_SERVICE_URL
        self.timeout = settings.AI_SERVICE_TIMEOUT
        self.client = None
        logger.info(f"🤖 AI Service Client initialized: {self.base_url}")
    
    async def __aenter__(self):
        """Async context manager entry"""
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(self.timeout),
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=50)
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.client:
            await self.client.aclose()
    
    async def health_check(self) -> Dict[str, Any]:
        """Check AI service health"""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/health")
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"AI Service health check failed: {e}")
            return {"status": "unhealthy", "error": str(e)}
    
    async def get_gpu_info(self) -> Dict[str, Any]:
        """Get GPU information from AI service"""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/gpu-info")
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Failed to get GPU info: {e}")
            return {"error": str(e)}
    
    async def generate_caption(
        self,
        image: Image.Image,
        prompt: str = "a surveillance camera view of"
    ) -> Dict[str, Any]:
        """
        Generate caption for an image
        
        Args:
            image: PIL Image object
            prompt: Optional prompt to guide caption generation
            
        Returns:
            Dictionary with caption and metadata
        """
        try:
            # Convert PIL Image to bytes
            img_byte_arr = io.BytesIO()
            image.save(img_byte_arr, format='JPEG')
            img_byte_arr.seek(0)
            
            # Prepare multipart form data
            files = {
                'file': ('image.jpg', img_byte_arr, 'image/jpeg')
            }
            data = {
                'prompt': prompt
            }
            
            # Send request
            if not self.client:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.post(
                        f"{self.base_url}/caption",
                        files=files,
                        data=data
                    )
                    response.raise_for_status()
                    result = response.json()
            else:
                response = await self.client.post(
                    f"{self.base_url}/caption",
                    files=files,
                    data=data
                )
                response.raise_for_status()
                result = response.json()
            
            logger.info(f"✅ Caption generated: {result.get('caption', '')[:50]}...")
            return result
            
        except httpx.TimeoutException:
            logger.error("Caption generation timed out")
            return {"success": False, "error": "Request timed out"}
        except Exception as e:
            logger.error(f"Caption generation failed: {e}")
            return {"success": False, "error": str(e)}
    
    async def detect_objects(
        self,
        image: Image.Image,
        confidence_threshold: float = 0.5
    ) -> Dict[str, Any]:
        """
        Detect objects in an image using YOLO
        
        Args:
            image: PIL Image object
            confidence_threshold: Minimum confidence for detections
            
        Returns:
            Dictionary with detections list
        """
        try:
            # Convert PIL Image to bytes
            img_byte_arr = io.BytesIO()
            image.save(img_byte_arr, format='JPEG')
            img_byte_arr.seek(0)
            
            # Prepare request
            files = {
                'file': ('image.jpg', img_byte_arr, 'image/jpeg')
            }
            params = {
                'confidence': confidence_threshold
            }
            
            # Send request
            if not self.client:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.post(
                        f"{self.base_url}/detect",
                        files=files,
                        params=params
                    )
                    response.raise_for_status()
                    result = response.json()
            else:
                response = await self.client.post(
                    f"{self.base_url}/detect",
                    files=files,
                    params=params
                )
                response.raise_for_status()
                result = response.json()
            
            logger.info(f"✅ Detected {result.get('count', 0)} objects")
            return result
            
        except httpx.TimeoutException:
            logger.error("Object detection timed out")
            return {"success": False, "error": "Request timed out"}
        except Exception as e:
            logger.error(f"Object detection failed: {e}")
            return {"success": False, "error": str(e)}
    
    async def generate_embedding(self, text: str) -> Dict[str, Any]:
        """
        Generate embedding vector for text
        
        Args:
            text: Input text
            
        Returns:
            Dictionary with embedding vector
        """
        try:
            payload = {"text": text}
            
            if not self.client:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.post(
                        f"{self.base_url}/embed",
                        json=payload
                    )
                    response.raise_for_status()
                    result = response.json()
            else:
                response = await self.client.post(
                    f"{self.base_url}/embed",
                    json=payload
                )
                response.raise_for_status()
                result = response.json()
            
            logger.debug(f"✅ Generated {result.get('dimensions', 0)}-dim embedding")
            return result
            
        except httpx.TimeoutException:
            logger.error("Embedding generation timed out")
            return {"success": False, "error": "Request timed out"}
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            return {"success": False, "error": str(e)}

    async def generate_batch_caption(
        self,
        images: List[Image.Image],
        prompt: str = None
    ) -> Dict[str, Any]:
        """
        Generate a comprehensive caption from multiple frames (batch processing)
        
        Args:
            images: List of PIL Image objects (accumulated frames)
            prompt: Optional custom prompt (uses enhanced default on AI service if not provided)
            
        Returns:
            Dictionary with comprehensive caption and metadata
        """
        try:
            import time
            start_time = time.time()
            
            logger.info(f"🎬 Generating batch caption for {len(images)} frames")
            
            # Prepare multipart form data with multiple images
            files = []
            for i, image in enumerate(images):
                img_byte_arr = io.BytesIO()
                image.save(img_byte_arr, format='JPEG', quality=90)
                img_byte_arr.seek(0)
                files.append(('files', (f'frame_{i}.jpg', img_byte_arr, 'image/jpeg')))
            
            # Build data payload
            data = {
                'frame_count': len(images)
            }
            
            # Only include prompt if user explicitly provides one
            if prompt is not None:
                data['prompt'] = prompt
            
            # Send request to batch caption endpoint
            if not self.client:
                async with httpx.AsyncClient(timeout=self.timeout * 2) as client:
                    response = await client.post(
                        f"{self.base_url}/caption/batch",
                        files=files,
                        data=data
                    )
                    response.raise_for_status()
                    result = response.json()
            else:
                response = await self.client.post(
                    f"{self.base_url}/caption/batch",
                    files=files,
                    data=data
                )
                response.raise_for_status()
                result = response.json()
            
            processing_time = time.time() - start_time
            result["processing_time"] = processing_time
            
            logger.info(f"✅ Batch caption generated in {processing_time:.2f}s")
            logger.info(f"   Caption: {result.get('caption', '')[:100]}...")
            
            return result
            
        except httpx.TimeoutException:
            logger.error("Batch caption generation timed out")
            return {"success": False, "error": "Request timed out"}
        except Exception as e:
            logger.error(f"Batch caption generation failed: {e}")
            return {"success": False, "error": str(e)}
        
    def stitch_panoramic_frames(self, frames: List[np.ndarray], mode: str = "panorama"):
        """
        Stitch frames into panorama (runs locally, not via API)
        """
        try:
            if len(frames) < 2:
                return {"success": False, "error": "Need at least 2 frames"}
            
            logger.info(f"🎨 Stitching {len(frames)} frames in {mode} mode")
            
            # Use OpenCV Stitcher
            if mode == "scans":
                stitcher = cv2.Stitcher_create(cv2.Stitcher_SCANS)
            else:
                stitcher = cv2.Stitcher_create(cv2.Stitcher_PANORAMA)
            
            status, stitched = stitcher.stitch(frames)
            
            if status == cv2.Stitcher_OK:
                logger.info(f"✅ Panorama stitched successfully: {stitched.shape}")
                return {
                    "success": True,
                    "stitched_frame": stitched,
                    "width": stitched.shape[1],
                    "height": stitched.shape[0]
                }
            else:
                error_map = {
                    cv2.Stitcher_ERR_NEED_MORE_IMGS: "Need more images",
                    cv2.Stitcher_ERR_HOMOGRAPHY_EST_FAIL: "Homography estimation failed - cameras might not overlap",
                    cv2.Stitcher_ERR_CAMERA_PARAMS_ADJUST_FAIL: "Camera parameters adjustment failed"
                }
                error_msg = error_map.get(status, f"Stitching failed with status code: {status}")
                logger.warning(f"⚠️ {error_msg}")
                return {"success": False, "error": error_msg}
                
        except Exception as e:
            logger.error(f"❌ Stitching error: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return {"success": False, "error": str(e)}
    
    async def batch_generate_embeddings(
        self,
        texts: List[str],
        batch_size: int = 32
    ) -> Dict[str, Any]:
        """
        Generate embeddings for multiple texts
        
        Args:
            texts: List of input texts
            batch_size: Processing batch size
            
        Returns:
            Dictionary with embeddings list
        """
        try:
            payload = {
                "texts": texts,
                "batch_size": batch_size
            }
            
            if not self.client:
                async with httpx.AsyncClient(timeout=self.timeout * 2) as client:
                    response = await client.post(
                        f"{self.base_url}/embed/batch",
                        json=payload
                    )
                    response.raise_for_status()
                    result = response.json()
            else:
                response = await self.client.post(
                    f"{self.base_url}/embed/batch",
                    json=payload
                )
                response.raise_for_status()
                result = response.json()
            
            logger.info(f"✅ Generated {result.get('count', 0)} embeddings")
            return result
            
        except httpx.TimeoutException:
            logger.error("Batch embedding generation timed out")
            return {"success": False, "error": "Request timed out"}
        except Exception as e:
            logger.error(f"Batch embedding generation failed: {e}")
            return {"success": False, "error": str(e)}
    
    async def process_frame(
        self,
        image: Image.Image,
        camera_id: str,
        timestamp: str
    ) -> Dict[str, Any]:
        """
        Complete frame processing pipeline
        
        Args:
            image: PIL Image object
            camera_id: Camera identifier
            timestamp: Frame timestamp
            
        Returns:
            Dictionary with all processing results
        """
        results = {
            "camera_id": camera_id,
            "timestamp": timestamp,
            "success": False
        }
        
        try:
            # Step 1: Object Detection (fast pre-check)
            detection_result = await self.detect_objects(image)
            if detection_result.get("success"):
                results["detections"] = detection_result["detections"]
            
            # Step 2: Caption Generation
            caption_result = await self.generate_caption(image)
            if caption_result.get("success"):
                results["caption"] = caption_result["caption"]
                results["confidence"] = caption_result.get("confidence", 0.0)
                
                # Step 3: Generate Embedding
                embedding_result = await self.generate_embedding(caption_result["caption"])
                if embedding_result.get("success"):
                    results["embedding"] = embedding_result["embedding"]
                    results["success"] = True
            
            return results
            
        except Exception as e:
            logger.error(f"Frame processing failed: {e}")
            results["error"] = str(e)
            return results


# Singleton instance
ai_service = AIServiceClient()