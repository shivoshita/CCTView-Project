# FILE LOCATION: backend/app/video/frame_extractor.py

"""
Frame Extractor
Intelligent keyframe extraction using time-based and motion-based methods
"""

import cv2
import numpy as np
import logging
from datetime import datetime
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


class FrameExtractor:
    """
    Extracts keyframes from video stream using hybrid approach:
    1. Time-based extraction (every N seconds)
    2. Motion-based extraction (when significant change detected)
    3. Blur detection (skip poor quality frames)
    """
    
    def __init__(self):
        self.frame_extraction_interval = settings.FRAME_EXTRACTION_INTERVAL  # 2.5 seconds
        self.motion_threshold = settings.MOTION_DETECTION_THRESHOLD  # 15%
        self.blur_threshold = settings.BLUR_DETECTION_THRESHOLD  # 100.0
        logger.info(f"📸 Frame Extractor initialized")
        logger.info(f"   Time interval: {self.frame_extraction_interval}s")
        logger.info(f"   Motion threshold: {self.motion_threshold}%")
        logger.info(f"   Blur threshold: {self.blur_threshold}")
    
    def should_extract_frame(
        self,
        frame: np.ndarray,
        prev_frame: Optional[np.ndarray],
        current_time: datetime,
        last_extract_time: datetime,
        frame_count: int,
        fps: int
    ) -> bool:
        """
        Decide if frame should be extracted
        
        Args:
            frame: Current frame (OpenCV BGR format)
            prev_frame: Previous frame for motion detection
            current_time: Current timestamp
            last_extract_time: Last time we extracted a frame
            frame_count: Total frames processed
            fps: Stream FPS
        
        Returns:
            True if frame should be extracted, False otherwise
        """
        
        # Method 1: Time-based extraction (every 2.5 seconds)
        time_diff = (current_time - last_extract_time).total_seconds()
        
        if time_diff >= self.frame_extraction_interval:
            # Check if frame is blurry before extracting
            if self.is_blurry(frame):
                logger.debug(f"⚠️ Skipping blurry frame #{frame_count} (time-based)")
                return False
            
            logger.debug(f"✅ Time-based extraction (frame #{frame_count})")
            return True
        
        # Method 2: Motion-based extraction
        if prev_frame is not None:
            if self.detect_motion(frame, prev_frame):
                # Check if frame is blurry
                if self.is_blurry(frame):
                    logger.debug(f"⚠️ Skipping blurry frame #{frame_count} (motion-based)")
                    return False
                
                logger.debug(f"🏃 Motion detected in frame #{frame_count}")
                return True
        
        return False
    
    def is_blurry(self, frame: np.ndarray) -> bool:
        """
        Detect if frame is blurry using Laplacian variance
        
        Args:
            frame: OpenCV frame (BGR)
        
        Returns:
            True if frame is blurry (should be skipped)
        """
        try:
            # Convert to grayscale
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            
            # Calculate Laplacian variance
            laplacian = cv2.Laplacian(gray, cv2.CV_64F)
            variance = laplacian.var()
            
            is_blurry = variance < self.blur_threshold
            
            if is_blurry:
                logger.debug(f"Blur detected: variance={variance:.2f} (threshold={self.blur_threshold})")
            
            return is_blurry
            
        except Exception as e:
            logger.error(f"Error detecting blur: {e}")
            return False  # Don't skip frame on error
    
    def detect_motion(
        self, 
        frame: np.ndarray, 
        prev_frame: np.ndarray
    ) -> bool:
        """
        Detect motion between two frames using frame differencing
        
        Args:
            frame: Current frame (BGR)
            prev_frame: Previous frame (BGR)
        
        Returns:
            True if significant motion detected
        """
        try:
            # Convert both frames to grayscale
            gray1 = cv2.cvtColor(prev_frame, cv2.COLOR_BGR2GRAY)
            gray2 = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            
            # Calculate absolute difference
            diff = cv2.absdiff(gray1, gray2)
            
            # Threshold to find changed pixels (intensity change > 30)
            _, thresh = cv2.threshold(diff, 30, 255, cv2.THRESH_BINARY)
            
            # Calculate percentage of changed pixels
            changed_pixels = np.count_nonzero(thresh)
            total_pixels = thresh.size
            percent_change = (changed_pixels / total_pixels) * 100
            
            motion_detected = percent_change > self.motion_threshold
            
            if motion_detected:
                logger.debug(f"Motion: {percent_change:.2f}% changed (threshold={self.motion_threshold}%)")
            
            return motion_detected
            
        except Exception as e:
            logger.error(f"Error detecting motion: {e}")
            return False  # Don't extract frame on error
    
    def extract_frame_opencv(
        self,
        video_path: str,
        timestamp_seconds: float
    ) -> Optional[np.ndarray]:
        """
        Extract a specific frame from video file by timestamp
        
        Args:
            video_path: Path to video file
            timestamp_seconds: Time position in seconds
        
        Returns:
            Frame as numpy array or None if failed
        """
        try:
            cap = cv2.VideoCapture(video_path)
            
            if not cap.isOpened():
                logger.error(f"Failed to open video: {video_path}")
                return None
            
            # Set position to timestamp
            fps = cap.get(cv2.CAP_PROP_FPS)
            frame_number = int(timestamp_seconds * fps)
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
            
            # Read frame
            ret, frame = cap.read()
            cap.release()
            
            if not ret:
                logger.error(f"Failed to read frame at {timestamp_seconds}s")
                return None
            
            return frame
            
        except Exception as e:
            logger.error(f"Error extracting frame: {e}")
            return None
    
    def get_extraction_stats(self) -> dict:
        """
        Get current extraction configuration
        """
        return {
            "time_interval_seconds": self.frame_extraction_interval,
            "motion_threshold_percent": self.motion_threshold,
            "blur_threshold": self.blur_threshold,
            "method": "hybrid (time + motion + blur detection)"
        }