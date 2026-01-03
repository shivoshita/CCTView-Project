# FILE LOCATION: backend/app/api/v1/endpoints/cameras.py

import subprocess
import asyncio
import os
import shutil
from pathlib import Path
from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from fastapi.responses import StreamingResponse, FileResponse, JSONResponse
from typing import List, Dict, Any, Tuple
import logging
from datetime import datetime, timedelta
import cv2
import io
import numpy as np
from PIL import Image
import uuid
import httpx
from app.core.config import settings

from app.models.camera import CameraCreate, CameraResponse, CameraUpdate
from app.db.neo4j.client import neo4j_client
from app.db.redis.client import redis_client
from app.video.stream_manager import stream_manager

router = APIRouter()
logger = logging.getLogger(__name__)

# Store active HLS processes
active_hls_processes = {}
HLS_OUTPUT_DIR = Path("temp/hls_streams")
HLS_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def convert_neo4j_datetime(camera_data: dict) -> dict:
    """Convert Neo4j DateTime objects to ISO strings"""
    if 'created_at' in camera_data and camera_data['created_at']:
        created_at = camera_data['created_at']
        if hasattr(created_at, 'isoformat'):
            camera_data['created_at'] = created_at.isoformat()
        elif hasattr(created_at, 'to_native'):
            camera_data['created_at'] = created_at.to_native().isoformat()
    return camera_data


async def start_hls_transcoding(camera_id: str, rtsp_url: str):
    """
    Start FFmpeg HLS transcoding for RTSP stream
    Creates .m3u8 playlist and .ts segment files
    """
    try:
        # Stop existing process if any
        await stop_hls_transcoding(camera_id)
        
        # Create camera-specific output directory
        output_dir = HLS_OUTPUT_DIR / camera_id
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Output playlist path
        playlist_path = output_dir / "stream.m3u8"
        
        logger.info(f"🎬 Starting HLS transcoding for camera {camera_id}")
        logger.info(f"   RTSP URL: {rtsp_url}")
        logger.info(f"   Output: {playlist_path}")
        
        # FFmpeg command for HLS transcoding (OPTIMIZED FOR H.265)
        cmd = [
            'ffmpeg',
            '-rtsp_transport', 'tcp',
            '-i', rtsp_url,
            '-c:v', 'copy',              # ⚡ COPY video stream (no re-encoding!)
            '-an',                        # No audio
            '-f', 'hls',                  # HLS format
            '-hls_time', '2',             # 2 second segments
            '-hls_list_size', '5',        # Keep 5 segments in playlist (increased from 3)
            '-hls_flags', 'delete_segments+independent_segments',  # Removed append_list
            '-hls_delete_threshold', '3', # Delete segments after 3 times list_size
            '-hls_segment_type', 'mpegts',
            '-hls_segment_filename', str(output_dir / 'segment_%03d.ts'),
            '-start_number', '0',         # Start segment numbering at 0
            '-reconnect', '1',            # Auto-reconnect on stream failure
            '-reconnect_streamed', '1',
            '-reconnect_delay_max', '5',
            '-loglevel', 'info',
            '-y',                         # Overwrite output files
            str(playlist_path)
        ]
        
        # Start FFmpeg process
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        # Store process reference
        active_hls_processes[camera_id] = {
            'process': process,
            'output_dir': output_dir,
            'playlist_path': playlist_path,
            'started_at': datetime.now()
        }
        
        logger.info(f"✅ HLS transcoding started for {camera_id} (PID: {process.pid})")
        
        # Monitor stderr in background
        async def monitor_stderr():
            try:
                while True:
                    line = await process.stderr.readline()
                    if not line:
                        break
                    msg = line.decode('utf-8', errors='ignore').strip()
                    if 'error' in msg.lower() or 'warning' in msg.lower():
                        logger.warning(f"📺 FFmpeg [{camera_id}]: {msg}")
            except Exception as e:
                logger.error(f"Error monitoring FFmpeg stderr: {e}")
        
        # Monitor process health
        async def monitor_process():
            try:
                await process.wait()
                logger.warning(f"⚠️ FFmpeg process ended for {camera_id}")
                # Auto-restart if process dies unexpectedly
                if camera_id in active_hls_processes:
                    logger.info(f"🔄 Restarting HLS transcoding for {camera_id}")
                    await asyncio.sleep(2)  # Brief delay before restart
                    await start_hls_transcoding(camera_id, rtsp_url)
            except Exception as e:
                logger.error(f"Error monitoring FFmpeg process: {e}")
        
        asyncio.create_task(monitor_stderr())
        asyncio.create_task(monitor_process())
        
        # Wait a moment for playlist to be created
        for i in range(10):  # Wait up to 10 seconds
            if playlist_path.exists():
                logger.info(f"✅ HLS playlist created: {playlist_path}")
                return True
            await asyncio.sleep(1)
        
        logger.warning(f"⚠️ HLS playlist not created after 10 seconds")
        return False
        
    except Exception as e:
        logger.error(f"❌ Error starting HLS transcoding: {e}")
        return False
    
# Chair tracking states - now includes visual history + temporal smoothing
chair_tracking_states: Dict[str, Dict[int, dict]] = {}
chair_visual_history: Dict[str, Dict[int, List[np.ndarray]]] = {}
chair_occupancy_buffer: Dict[str, Dict[int, List[bool]]] = {}  # Temporal smoothing buffer

def calculate_iou(box1: List[float], box2: List[float]) -> float:
    """Calculate Intersection over Union between two bounding boxes"""
    x1_min, y1_min, x1_max, y1_max = box1
    x2_min, y2_min, x2_max, y2_max = box2
    
    inter_x_min = max(x1_min, x2_min)
    inter_y_min = max(y1_min, y2_min)
    inter_x_max = min(x1_max, x2_max)
    inter_y_max = min(y1_max, y2_max)
    
    if inter_x_max < inter_x_min or inter_y_max < inter_y_min:
        return 0.0
    
    inter_area = (inter_x_max - inter_x_min) * (inter_y_max - inter_y_min)
    box1_area = (x1_max - x1_min) * (y1_max - y1_min)
    box2_area = (x2_max - x2_min) * (y2_max - y2_min)
    union_area = box1_area + box2_area - inter_area
    
    return inter_area / union_area if union_area > 0 else 0.0

def extract_chair_region(frame: np.ndarray, bbox: List[float], expand_factor: float = 1.4) -> np.ndarray:
    """
    Extract and expand chair region from frame
    Expand to capture person sitting at desk (head/shoulders above chair)
    """
    x1, y1, x2, y2 = [int(coord) for coord in bbox]
    
    # Expand bounding box to capture area above chair (where person's head/shoulders would be)
    height = y2 - y1
    width = x2 - x1
    
    # Expand upward more (to catch head/shoulders) and slightly in all directions
    expand_h = int(height * (expand_factor - 1.0))
    expand_w = int(width * 0.15)
    
    # Adjust coordinates with bounds checking
    frame_h, frame_w = frame.shape[:2]
    new_x1 = max(0, x1 - expand_w)
    new_y1 = max(0, y1 - expand_h)  # Expand upward to catch person
    new_x2 = min(frame_w, x2 + expand_w)
    new_y2 = min(frame_h, y2 + int(expand_h * 0.3))
    
    region = frame[new_y1:new_y2, new_x1:new_x2]
    
    # Resize to standard size for comparison (prevents size variation issues)
    if region.size > 0:
        region = cv2.resize(region, (100, 100))
    
    return region

def compute_ssim_opencv(img1: np.ndarray, img2: np.ndarray) -> float:
    """
    Compute Structural Similarity Index using OpenCV only
    Returns value between 0 (different) and 1 (identical)
    """
    # Convert to float
    img1 = img1.astype(np.float64)
    img2 = img2.astype(np.float64)
    
    # Constants for SSIM
    C1 = (0.01 * 255) ** 2
    C2 = (0.03 * 255) ** 2
    
    # Compute means
    mu1 = cv2.GaussianBlur(img1, (11, 11), 1.5)
    mu2 = cv2.GaussianBlur(img2, (11, 11), 1.5)
    
    mu1_sq = mu1 ** 2
    mu2_sq = mu2 ** 2
    mu1_mu2 = mu1 * mu2
    
    # Compute variances and covariance
    sigma1_sq = cv2.GaussianBlur(img1 ** 2, (11, 11), 1.5) - mu1_sq
    sigma2_sq = cv2.GaussianBlur(img2 ** 2, (11, 11), 1.5) - mu2_sq
    sigma12 = cv2.GaussianBlur(img1 * img2, (11, 11), 1.5) - mu1_mu2
    
    # SSIM formula
    ssim_map = ((2 * mu1_mu2 + C1) * (2 * sigma12 + C2)) / \
               ((mu1_sq + mu2_sq + C1) * (sigma1_sq + sigma2_sq + C2))
    
    return float(np.mean(ssim_map))

def detect_visual_occupancy(
    current_region: np.ndarray,
    reference_empty_region: np.ndarray,
    sensitivity: float = 0.15
) -> Tuple[bool, float]:
    """
    Detect if chair is occupied by comparing visual appearance
    Uses OpenCV only - no scikit-image required
    
    Returns: (is_occupied, change_score)
    """
    if current_region.size == 0 or reference_empty_region.size == 0:
        return False, 0.0
    
    try:
        # Ensure same dimensions
        if current_region.shape != reference_empty_region.shape:
            reference_empty_region = cv2.resize(reference_empty_region, 
                                                (current_region.shape[1], current_region.shape[0]))
        
        # Convert to grayscale for simpler comparison
        current_gray = cv2.cvtColor(current_region, cv2.COLOR_BGR2GRAY) if len(current_region.shape) == 3 else current_region
        reference_gray = cv2.cvtColor(reference_empty_region, cv2.COLOR_BGR2GRAY) if len(reference_empty_region.shape) == 3 else reference_empty_region
        
        # Method 1: OpenCV-based SSIM (Structural Similarity)
        ssim_score = compute_ssim_opencv(current_gray, reference_gray)
        
        # Method 2: Histogram comparison
        current_hist = cv2.calcHist([current_gray], [0], None, [32], [0, 256])
        reference_hist = cv2.calcHist([reference_gray], [0], None, [32], [0, 256])
        
        cv2.normalize(current_hist, current_hist, 0, 1, cv2.NORM_MINMAX)
        cv2.normalize(reference_hist, reference_hist, 0, 1, cv2.NORM_MINMAX)
        
        hist_correlation = cv2.compareHist(current_hist, reference_hist, cv2.HISTCMP_CORREL)
        
        # Method 3: Mean Absolute Difference
        mean_diff = np.mean(np.abs(current_gray.astype(float) - reference_gray.astype(float))) / 255.0
        
        # Method 4: Edge detection comparison (detects person outline)
        current_edges = cv2.Canny(current_gray, 50, 150)
        reference_edges = cv2.Canny(reference_gray, 50, 150)
        edge_diff = np.sum(current_edges != reference_edges) / current_edges.size
        
        # Combine metrics into change score
        change_score = (
            (1.0 - ssim_score) * 0.40 +           # Weight: 40% - structure changes
            (1.0 - hist_correlation) * 0.25 +     # Weight: 25% - color/brightness
            mean_diff * 0.20 +                     # Weight: 20% - pixel differences
            edge_diff * 0.15                       # Weight: 15% - edge/outline changes
        )
        
        is_occupied = change_score > sensitivity
        
        return is_occupied, change_score
        
    except Exception as e:
        logger.error(f"Error in visual occupancy detection: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False, 0.0

def smooth_occupancy_decision(
    camera_id: str,
    chair_id: int,
    current_occupied: bool,
    buffer_size: int = 6  # Require 6 consecutive frames (~3 seconds at 500ms polling)
) -> bool:
    """
    Apply temporal smoothing to reduce flicker and false positives
    Chair must be consistently occupied/empty over multiple frames
    """
    global chair_occupancy_buffer
    
    if camera_id not in chair_occupancy_buffer:
        chair_occupancy_buffer[camera_id] = {}
    
    if chair_id not in chair_occupancy_buffer[camera_id]:
        chair_occupancy_buffer[camera_id][chair_id] = []
    
    buffer = chair_occupancy_buffer[camera_id][chair_id]
    
    # Add current decision to buffer
    buffer.append(current_occupied)
    
    # Keep only last N frames
    if len(buffer) > buffer_size:
        buffer.pop(0)
    
    # Need at least half the buffer filled
    if len(buffer) < buffer_size // 2:
        return current_occupied  # Not enough data, trust current
    
    # Require majority vote (at least 60% agreement)
    occupied_count = sum(buffer)
    threshold = len(buffer) * 0.6
    
    smoothed_decision = occupied_count >= threshold
    
    return smoothed_decision

def is_person_on_chair_fallback(person_bbox: List[float], chair_bbox: List[float]) -> bool:
    """Fallback person-on-chair detection for when YOLO does detect persons"""
    px1, py1, px2, py2 = person_bbox
    cx1, cy1, cx2, cy2 = chair_bbox
    
    person_center_x = (px1 + px2) / 2
    chair_width = cx2 - cx1
    
    horizontal_margin = chair_width * 0.25
    horizontal_aligned = (
        person_center_x >= (cx1 - horizontal_margin) and 
        person_center_x <= (cx2 + horizontal_margin)
    )
    
    if not horizontal_aligned:
        return False
    
    iou = calculate_iou(person_bbox, chair_bbox)
    return iou > 0.12

def match_chairs_to_previous(
    current_chairs: List[dict],
    previous_states: Dict[int, dict]
) -> Dict[int, int]:
    """Match current chair detections to previous frame chairs using IoU"""
    if not previous_states:
        return {}
    
    matching = {}
    used_previous = set()
    match_candidates = []
    
    for curr_idx, curr_chair in enumerate(current_chairs):
        for prev_id, prev_state in previous_states.items():
            if prev_id in used_previous:
                continue
            
            iou = calculate_iou(curr_chair['bbox'], prev_state['bbox'])
            if iou > 0.5:  # High threshold for stable tracking
                match_candidates.append((iou, curr_idx, prev_id))
    
    match_candidates.sort(reverse=True, key=lambda x: x[0])
    
    for iou, curr_idx, prev_id in match_candidates:
        if curr_idx not in matching and prev_id not in used_previous:
            matching[curr_idx] = prev_id
            used_previous.add(prev_id)
    
    return matching

@router.get("/{camera_id}/chair-tracking")
async def get_chair_occupancy_tracking(camera_id: str):
    """
    HYBRID APPROACH: Visual change detection + person detection fallback
    Optimized for top-down camera angles - uses OpenCV only
    """
    try:
        if camera_id not in stream_manager.active_streams:
            return JSONResponse({
                "success": True,
                "chairs": [],
                "timestamp": datetime.now().isoformat(),
                "message": "Camera stream not active"
            })
        
        if camera_id not in stream_manager.latest_frames:
            return JSONResponse({
                "success": True,
                "chairs": [],
                "timestamp": datetime.now().isoformat(),
                "message": "No frames available yet"
            })
        
        latest_frame, timestamp = stream_manager.latest_frames[camera_id]
        
        # Convert frame to JPEG for detection
        try:
            frame_rgb = cv2.cvtColor(latest_frame, cv2.COLOR_BGR2RGB)
            pil_image = Image.fromarray(frame_rgb)
            
            img_byte_arr = io.BytesIO()
            pil_image.save(img_byte_arr, format='JPEG', quality=85)
            img_byte_arr.seek(0)
        except Exception as e:
            logger.error(f"Error converting frame: {e}")
            return JSONResponse({
                "success": False,
                "error": f"Frame conversion failed: {str(e)}"
            })
        
        # YOLO detection - focus on chairs
        try:
            files = {'image': ('frame.jpg', img_byte_arr, 'image/jpeg')}
            data = {'confidence': 0.40}
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{settings.AI_SERVICE_URL}/detect/yolo",
                    files=files,
                    data=data
                )
            
            if response.status_code != 200:
                return JSONResponse({
                    "success": False,
                    "error": f"AI service returned {response.status_code}"
                })
            
            detection_result = response.json()
            
            if not detection_result.get("success"):
                return JSONResponse({
                    "success": False,
                    "error": "Object detection failed"
                })
            
            all_detections = detection_result.get("detections", [])
            
            # Separate chairs and persons
            chairs = [d for d in all_detections if d['label'] == 'chair' and d['confidence'] >= 0.40]
            persons = [d for d in all_detections if d['label'] == 'person' and d['confidence'] >= 0.35]
            
            logger.info(f"🪑 Detected: {len(chairs)} chairs, {len(persons)} persons")
            
            # Initialize tracking states
            if camera_id not in chair_tracking_states:
                chair_tracking_states[camera_id] = {}
            if camera_id not in chair_visual_history:
                chair_visual_history[camera_id] = {}
            if camera_id not in chair_occupancy_buffer:
                chair_occupancy_buffer[camera_id] = {}
            
            current_time = datetime.now()
            previous_states = chair_tracking_states[camera_id]
            visual_history = chair_visual_history[camera_id]
            
            # Match chairs to previous frame
            matching = match_chairs_to_previous(chairs, previous_states)
            
            new_chair_states = {}
            new_visual_history = {}
            next_chair_id = max(previous_states.keys(), default=0) + 1
            
            tracked_chairs = []
            
            for chair_idx, chair in enumerate(chairs):
                chair_bbox = chair['bbox']
                chair_confidence = chair['confidence']
                
                # Extract current chair region
                current_region = extract_chair_region(latest_frame, chair_bbox, expand_factor=1.4)
                
                # Determine chair ID (new or matched)
                if chair_idx in matching:
                    chair_id = matching[chair_idx]
                    prev_state = previous_states[chair_id]
                    
                    # METHOD 1: Visual Change Detection (Primary)
                    if chair_id in visual_history and len(visual_history[chair_id]) > 0:
                        reference_region = visual_history[chair_id][0]
                        is_occupied_visual_raw, change_score = detect_visual_occupancy(
                            current_region, 
                            reference_region,
                            sensitivity=0.22  # Balanced threshold based on logs
                        )
                        
                        # Apply temporal smoothing to reduce false positives
                        is_occupied_visual = smooth_occupancy_decision(
                            camera_id, chair_id, is_occupied_visual_raw
                        )
                        
                        logger.info(f"   Chair {chair_id}: visual_change={change_score:.3f}, "
                                   f"raw={is_occupied_visual_raw}, smoothed={is_occupied_visual}")
                    else:
                        # First detection - assume empty and store as reference
                        is_occupied_visual = False
                        change_score = 0.0
                        logger.info(f"   Chair {chair_id}: NEW - storing as empty reference")
                    
                    # METHOD 2: Person Detection (Fallback/Confirmation)
                    persons_on_chair = [p for p in persons if is_person_on_chair_fallback(p['bbox'], chair_bbox)]
                    is_occupied_person = len(persons_on_chair) > 0
                    
                    # HYBRID DECISION
                    if is_occupied_person:
                        is_occupied = True
                        detection_method = "person_detection"
                        logger.info(f"   Chair {chair_id}: OCCUPIED via person detection")
                    else:
                        is_occupied = is_occupied_visual
                        detection_method = "visual_change"
                        logger.info(f"   Chair {chair_id}: {'OCCUPIED' if is_occupied else 'EMPTY'} "
                                   f"via visual (score={change_score:.3f})")
                    
                    # Update state
                    if prev_state['occupied'] != is_occupied:
                        chair_state = {
                            'chair_id': chair_id,
                            'bbox': chair_bbox,
                            'occupied': is_occupied,
                            'state_start_time': current_time,
                            'duration_seconds': 0,
                            'confidence': chair_confidence,
                            'detection_method': detection_method,
                            'change_score': change_score if detection_method == 'visual_change' else None
                        }
                        logger.info(f"🔄 Chair {chair_id}: {prev_state['occupied']} → {is_occupied} "
                                  f"(via {detection_method}, score={change_score:.3f})")
                    else:
                        duration = (current_time - prev_state['state_start_time']).total_seconds()
                        chair_state = {
                            'chair_id': chair_id,
                            'bbox': chair_bbox,
                            'occupied': is_occupied,
                            'state_start_time': prev_state['state_start_time'],
                            'duration_seconds': int(duration),
                            'confidence': chair_confidence,
                            'detection_method': detection_method,
                            'change_score': change_score if detection_method == 'visual_change' else None
                        }
                else:
                    # New chair - assume empty initially
                    chair_id = next_chair_id
                    next_chair_id += 1
                    
                    is_occupied = False
                    chair_state = {
                        'chair_id': chair_id,
                        'bbox': chair_bbox,
                        'occupied': is_occupied,
                        'state_start_time': current_time,
                        'duration_seconds': 0,
                        'confidence': chair_confidence,
                        'detection_method': 'initial',
                        'change_score': None
                    }
                    logger.info(f"✨ New chair {chair_id} - storing empty reference")
                
                new_chair_states[chair_id] = chair_state
                
                # Update visual history
                # Keep reference only if chair is currently empty or first time seeing it
                if chair_id not in visual_history or not is_occupied:
                    new_visual_history[chair_id] = [current_region]
                else:
                    new_visual_history[chair_id] = visual_history[chair_id]
                
                tracked_chairs.append({
                    'chair_id': int(chair_id),
                    'bbox': [float(x) for x in chair_bbox],
                    'occupied': bool(is_occupied),
                    'duration_seconds': int(chair_state['duration_seconds']),
                    'status': 'occupied' if is_occupied else 'empty',
                    'confidence': float(chair_confidence),
                    'detection_method': str(chair_state.get('detection_method', 'unknown')),
                    'change_score': round(float(chair_state.get('change_score', 0.0)), 3) if chair_state.get('change_score') is not None else None
                })
            
            # Update tracking states
            chair_tracking_states[camera_id] = new_chair_states
            chair_visual_history[camera_id] = new_visual_history
            
            occupied_count = sum(1 for c in tracked_chairs if c['occupied'])
            empty_count = sum(1 for c in tracked_chairs if not c['occupied'])
            
            logger.info(f"✅ {len(tracked_chairs)} chairs: {occupied_count} occupied, {empty_count} empty")
            
            formatted_persons = [
                {
                    'person_id': int(i + 1),
                    'bbox': [float(x) for x in person['bbox']],
                    'confidence': float(person['confidence'])
                }
                for i, person in enumerate(persons)
            ]
            
            return JSONResponse({
                "success": True,
                "chairs": tracked_chairs,
                "persons": formatted_persons,
                "total_chairs": int(len(tracked_chairs)),
                "occupied_chairs": int(occupied_count),
                "empty_chairs": int(empty_count),
                "timestamp": timestamp.isoformat(),
                "camera_id": str(camera_id),
                "debug_info": {
                    "total_detections": int(len(all_detections)),
                    "chairs_detected": int(len(chairs)),
                    "persons_detected": int(len(persons)),
                    "detection_method": "hybrid_visual_opencv",
                    "thresholds": {
                        "chair_confidence": 0.40,
                        "person_confidence": 0.35,
                        "visual_sensitivity": 0.22,
                        "temporal_smoothing": "6 frames (60% agreement)"
                    }
                }
            })
            
        except httpx.TimeoutException:
            return JSONResponse({
                "success": False,
                "error": "AI service timeout"
            })
        except Exception as e:
            logger.error(f"Error in chair tracking: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return JSONResponse({
                "success": False,
                "error": f"Detection error: {str(e)}"
            })
        
    except Exception as e:
        logger.error(f"Error in chair occupancy tracking: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return JSONResponse({
            "success": False,
            "error": str(e)
        })
        
@router.get("/{camera_id}/depth-map")
async def get_depth_map(camera_id: str):
    """
    Get depth map visualization for camera stream
    Returns depth-colored image overlaid on original frame
    """
    try:
        if camera_id not in stream_manager.active_streams:
            return JSONResponse({
                "success": False,
                "error": "Camera stream not active"
            })
        
        if camera_id not in stream_manager.latest_frames:
            return JSONResponse({
                "success": False,
                "error": "No frames available yet"
            })
        
        latest_frame, timestamp = stream_manager.latest_frames[camera_id]
        
        # Convert frame to PIL Image
        try:
            frame_rgb = cv2.cvtColor(latest_frame, cv2.COLOR_BGR2RGB)
            pil_image = Image.fromarray(frame_rgb)
        except Exception as e:
            logger.error(f"Error converting frame: {e}")
            return JSONResponse({
                "success": False,
                "error": f"Frame conversion failed: {str(e)}"
            })
        
        # Send to AI service for depth estimation
        try:
            from app.services.ai_service_client import ai_service
            
            async with ai_service as client:
                # Get depth map from AI service
                import io
                img_byte_arr = io.BytesIO()
                pil_image.save(img_byte_arr, format='JPEG', quality=90)
                img_byte_arr.seek(0)
                
                files = {'file': ('frame.jpg', img_byte_arr, 'image/jpeg')}
                params = {
                    'colormap': 'magma',
                    'return_image': False  # Get JSON with base64
                }
                
                async with httpx.AsyncClient(timeout=15.0) as http_client:
                    response = await http_client.post(
                        f"{settings.AI_SERVICE_URL}/depth",
                        files=files,
                        params=params
                    )
                
                if response.status_code != 200:
                    logger.error(f"AI service error: {response.status_code}")
                    return JSONResponse({
                        "success": False,
                        "error": f"AI service returned {response.status_code}"
                    })
                
                depth_result = response.json()
                
                if not depth_result.get("success"):
                    return JSONResponse({
                        "success": False,
                        "error": "Depth estimation failed"
                    })
                
                return JSONResponse({
                    "success": True,
                    "depth_image": depth_result["depth_image_base64"],
                    "depth_stats": depth_result["depth_stats"],
                    "timestamp": timestamp.isoformat(),
                    "camera_id": camera_id
                })
                
        except httpx.TimeoutException:
            logger.error(f"AI service timeout for camera {camera_id}")
            return JSONResponse({
                "success": False,
                "error": "AI service timeout"
            })
        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return JSONResponse({
                "success": False,
                "error": str(e)
            })
        
    except Exception as e:
        logger.error(f"Error in depth map endpoint: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return JSONResponse({
            "success": False,
            "error": str(e)
        })

# ===== PANORAMIC VIEW ENDPOINTS =====

@router.post("/panoramic/create")
async def create_panoramic_view(
    panorama_id: str = Query(..., description="Unique panorama identifier"),
    camera_ids: str = Query(..., description="Comma-separated camera IDs (e.g., 'cam1,cam2,cam3')"),
    stitch_mode: str = Query("panorama", regex="^(panorama|scans)$")
):
    """
    Create a new panoramic stitched view from multiple cameras
    
    Args:
        - panorama_id: Unique identifier for this panorama
        - camera_ids: Comma-separated list of camera IDs (e.g., "cam_001,cam_002,cam_003")
        - stitch_mode: 'panorama' (cylindrical) or 'scans' (planar)
    
    Example:
        POST /api/v1/cameras/panoramic/create?panorama_id=pano_123&camera_ids=cam_001,cam_002,cam_003&stitch_mode=panorama
    """
    try:
        from app.video.panoramic_stream_manager import panoramic_stream_manager
        
        # ✅ FIX: Parse comma-separated camera IDs into a list
        camera_id_list = [cid.strip() for cid in camera_ids.split(',')]
        
        # Validate camera count
        if len(camera_id_list) < 2:
            raise HTTPException(
                status_code=400,
                detail="Need at least 2 cameras for panoramic stitching"
            )
        
        if len(camera_id_list) > 6:
            raise HTTPException(
                status_code=400,
                detail="Maximum 6 cameras supported for panoramic stitching"
            )
        
        logger.info(f"Creating panorama {panorama_id} with cameras: {camera_id_list}")
        
        # Pass the parsed list to the panoramic stream manager
        await panoramic_stream_manager.create_panorama(
            panorama_id, camera_id_list, stitch_mode
        )
        
        return {
            "success": True,
            "panorama_id": panorama_id,
            "cameras": camera_id_list,
            "camera_count": len(camera_id_list),
            "stitch_mode": stitch_mode,
            "message": f"Panoramic stitching started with {len(camera_id_list)} cameras"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating panorama: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/panoramic/{panorama_id}/frame")
async def get_panoramic_frame(panorama_id: str):
    """Get latest stitched panoramic frame as JPEG"""
    try:
        from app.video.panoramic_stream_manager import panoramic_stream_manager
        
        if panorama_id not in panoramic_stream_manager.latest_stitched_frames:
            raise HTTPException(status_code=404, detail="Panorama not found")
        
        frame, timestamp = panoramic_stream_manager.latest_stitched_frames[panorama_id]
        
        # Convert to JPEG
        _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
        
        return StreamingResponse(
            io.BytesIO(buffer.tobytes()),
            media_type="image/jpeg",
            headers={"X-Timestamp": timestamp.isoformat()}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving panoramic frame: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/panoramic/{panorama_id}")
async def stop_panoramic_view(panorama_id: str):
    """Stop panoramic stitching"""
    try:
        from app.video.panoramic_stream_manager import panoramic_stream_manager
        await panoramic_stream_manager.stop_panorama(panorama_id)
        
        return {
            "success": True,
            "message": f"Panorama {panorama_id} stopped"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/panoramic/list")
async def list_panoramic_views():
    """List all active panoramic views"""
    from app.video.panoramic_stream_manager import panoramic_stream_manager
    
    return {
        "active_panoramas": [
            {
                "panorama_id": pid,
                "cameras": config["camera_ids"],
                "frames_stitched": config["frames_stitched"],
                "started_at": config["started_at"].isoformat()
            }
            for pid, config in panoramic_stream_manager.active_panoramas.items()
        ]
    }

async def stop_hls_transcoding(camera_id: str):
    """Stop HLS transcoding and cleanup files"""
    try:
        if camera_id in active_hls_processes:
            process_info = active_hls_processes[camera_id]
            process = process_info['process']
            
            if process.returncode is None:
                logger.info(f"🛑 Stopping HLS transcoding for {camera_id}")
                process.terminate()
                try:
                    await asyncio.wait_for(process.wait(), timeout=5.0)
                except asyncio.TimeoutError:
                    process.kill()
                    await process.wait()
            
            # Give FFmpeg time to finish writing
            await asyncio.sleep(0.5)
            
            # Cleanup files
            output_dir = process_info['output_dir']
            if output_dir.exists():
                # Remove all files in directory
                for file in output_dir.iterdir():
                    try:
                        file.unlink()
                    except Exception as e:
                        logger.warning(f"Could not delete {file}: {e}")
                
                # Remove directory
                try:
                    output_dir.rmdir()
                except Exception as e:
                    logger.warning(f"Could not remove directory {output_dir}: {e}")
                
                logger.info(f"🧹 Cleaned up HLS files for {camera_id}")
            
            del active_hls_processes[camera_id]
            
    except Exception as e:
        logger.error(f"Error stopping HLS transcoding: {e}")
        
async def cleanup_orphaned_hls_files():
    """Periodically clean up HLS directories that don't have active processes"""
    while True:
        try:
            await asyncio.sleep(10)  # Run every 10 seconds
            
            if not HLS_OUTPUT_DIR.exists():
                continue
            
            for camera_dir in HLS_OUTPUT_DIR.iterdir():
                if not camera_dir.is_dir():
                    continue
                
                camera_id = camera_dir.name
                
                # If camera not in active processes, clean it up
                if camera_id not in active_hls_processes:
                    logger.info(f"🧹 Cleaning up orphaned HLS directory: {camera_id}")
                    shutil.rmtree(camera_dir, ignore_errors=True)
                    continue
                
                # Check for old segment files (older than 30 seconds)
                current_time = datetime.now().timestamp()
                for file in camera_dir.glob("*.ts"):
                    try:
                        file_age = current_time - file.stat().st_mtime
                        if file_age > 30:  # 30 seconds old
                            file.unlink()
                            logger.debug(f"Deleted old segment: {file.name}")
                    except Exception as e:
                        logger.warning(f"Could not check/delete file {file}: {e}")
            
        except Exception as e:
            logger.error(f"Error in HLS cleanup task: {e}")


@router.get("/{camera_id}/stream")
async def get_camera_stream(camera_id: str):
    """
    Unified stream endpoint - returns HLS playlist for RTSP, proxies HTTP streams
    """
    try:
        # Get camera details
        query = """
        MATCH (c:Camera {id: $camera_id})
        RETURN c.stream_url as stream_url, c.stream_type as stream_type
        """
        result = await neo4j_client.async_execute_query(query, {"camera_id": camera_id})
        
        if not result or not result[0].get('stream_url'):
            raise HTTPException(status_code=404, detail="Camera not found")
        
        stream_url = result[0]['stream_url']
        stream_type = result[0].get('stream_type', 'http')
        
        if stream_type == 'rtsp':
            # Start HLS transcoding if not already running
            if camera_id not in active_hls_processes:
                success = await start_hls_transcoding(camera_id, stream_url)
                if not success:
                    raise HTTPException(status_code=500, detail="Failed to start HLS transcoding")
            
            # Return HLS playlist URL (without /api/v1 prefix - will be added by frontend)
            return {
                "type": "hls",
                "playlist_url": f"/cameras/{camera_id}/hls/stream.m3u8"
            }
        else:
            # Return HTTP stream info
            return {
                "type": "http",
                "stream_url": stream_url,
                "proxy_url": f"/api/v1/cameras/{camera_id}/proxy"
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting stream info: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{camera_id}/detections")
async def get_camera_detections(camera_id: str):
    """
    Get real-time object detections for camera stream
    Returns bounding boxes for detected objects
    """
    try:
        # Get latest frame from stream manager
        if camera_id not in stream_manager.active_streams:
            return JSONResponse({
                "success": True,
                "detections": [],
                "timestamp": datetime.now().isoformat(),
                "message": "Camera stream not active"
            })
        
        # Get the most recent frame from the real-time buffer
        if camera_id not in stream_manager.latest_frames:
            return JSONResponse({
                "success": True,
                "detections": [],
                "timestamp": datetime.now().isoformat(),
                "message": "No frames available yet"
            })
        
        # Get latest frame
        latest_frame, timestamp = stream_manager.latest_frames[camera_id]
        
        # Convert frame to JPEG bytes for API call
        try:
            # Convert BGR to RGB
            frame_rgb = cv2.cvtColor(latest_frame, cv2.COLOR_BGR2RGB)
            pil_image = Image.fromarray(frame_rgb)
            
            # Save to bytes buffer
            img_byte_arr = io.BytesIO()
            pil_image.save(img_byte_arr, format='JPEG', quality=85)
            img_byte_arr.seek(0)
            
        except Exception as e:
            logger.error(f"Error converting frame: {e}")
            return JSONResponse({
                "success": False,
                "error": f"Frame conversion failed: {str(e)}",
                "timestamp": datetime.now().isoformat()
            })
        
        # Send to AI service for detection
        try:
            files = {'image': ('frame.jpg', img_byte_arr, 'image/jpeg')}
            data = {'confidence': 0.5}
            
            logger.debug(f"Sending detection request to {settings.AI_SERVICE_URL}/detect/yolo")
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{settings.AI_SERVICE_URL}/detect/yolo",
                    files=files,
                    data=data
                )
            
            if response.status_code != 200:
                logger.error(f"AI service error: {response.status_code} - {response.text}")
                return JSONResponse({
                    "success": False,
                    "error": f"AI service returned {response.status_code}",
                    "timestamp": datetime.now().isoformat()
                })
            
            detection_result = response.json()
            
            if not detection_result.get("success"):
                return JSONResponse({
                    "success": False,
                    "error": "Object detection failed",
                    "timestamp": datetime.now().isoformat()
                })
            
            return JSONResponse({
                "success": True,
                "detections": detection_result.get("detections", []),
                "count": detection_result.get("count", 0),
                "timestamp": timestamp.isoformat(),
                "camera_id": camera_id
            })
            
        except httpx.TimeoutException:
            logger.error(f"AI service timeout for camera {camera_id}")
            return JSONResponse({
                "success": False,
                "error": "AI service timeout",
                "timestamp": datetime.now().isoformat()
            })
        except Exception as e:
            logger.error(f"Unexpected error calling AI service: {e}")
            return JSONResponse({
                "success": False,
                "error": f"Detection error: {str(e)}",
                "timestamp": datetime.now().isoformat()
            })
        
    except Exception as e:
        logger.error(f"Error getting detections: {e}")
        return JSONResponse({
            "success": False,
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        })
    
@router.get("/{camera_id}/hls/{filename}")
async def serve_hls_file(camera_id: str, filename: str):
    """
    Serve HLS playlist or segment files
    """
    try:
        if camera_id not in active_hls_processes:
            raise HTTPException(status_code=404, detail="HLS stream not found")
        
        output_dir = active_hls_processes[camera_id]['output_dir']
        file_path = output_dir / filename
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        
        # Determine content type
        if filename.endswith('.m3u8'):
            media_type = 'application/vnd.apple.mpegurl'
        elif filename.endswith('.ts'):
            media_type = 'video/mp2t'
        else:
            media_type = 'application/octet-stream'
        
        return FileResponse(
            file_path,
            media_type=media_type,
            headers={
                "Cache-Control": "no-cache",
                "Access-Control-Allow-Origin": "*"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving HLS file: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{camera_id}/proxy")
async def proxy_http_stream(camera_id: str):
    """Proxy HTTP/MJPEG streams"""
    try:
        query = """
        MATCH (c:Camera {id: $camera_id})
        RETURN c.stream_url as stream_url
        """
        result = await neo4j_client.async_execute_query(query, {"camera_id": camera_id})
        
        if not result or not result[0].get('stream_url'):
            raise HTTPException(status_code=404, detail="Camera not found")
        
        stream_url = result[0]['stream_url']
        
        async def generate():
            async with httpx.AsyncClient(timeout=30.0) as client:
                async with client.stream('GET', stream_url) as response:
                    if response.status_code != 200:
                        return
                    async for chunk in response.aiter_bytes(chunk_size=8192):
                        yield chunk
        
        return StreamingResponse(
            generate(),
            media_type="multipart/x-mixed-replace;boundary=frame",
            headers={
                "Cache-Control": "no-cache",
                "Access-Control-Allow-Origin": "*"
            }
        )
        
    except Exception as e:
        logger.error(f"Error proxying stream: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/", response_model=List[CameraResponse])
async def get_all_cameras():
    """Get all cameras"""
    try:
        query = """
        MATCH (c:Camera)
        RETURN c
        ORDER BY c.created_at DESC
        """
        result = await neo4j_client.async_execute_query(query)
        cameras = [convert_neo4j_datetime(dict(record['c'])) for record in result]
        return cameras
    except Exception as e:
        logger.error(f"Error fetching cameras: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{camera_id}", response_model=CameraResponse)
async def get_camera(camera_id: str):
    """Get single camera"""
    try:
        query = "MATCH (c:Camera {id: $camera_id}) RETURN c"
        result = await neo4j_client.async_execute_query(query, {"camera_id": camera_id})
        if not result:
            raise HTTPException(status_code=404, detail="Camera not found")
        return convert_neo4j_datetime(dict(result[0]['c']))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/", response_model=CameraResponse)
async def add_camera(camera: CameraCreate, background_tasks: BackgroundTasks):
    """Add new camera"""
    try:
        camera_id = f"cam_{uuid.uuid4().hex[:8]}"
        camera_data = {
            "id": camera_id,
            "name": camera.name,
            "location": camera.location,
            "stream_url": camera.stream_url,
            "stream_type": camera.stream_type,
            "description": camera.description or "",
            "status": "connecting",
            "resolution": "1920x1080",
            "fps": 30,
            "uptime": "0%",
            "eventsToday": 0,
            "created_at": datetime.now().isoformat()
        }
        
        query = """
        CREATE (c:Camera {
            id: $id, name: $name, location: $location,
            stream_url: $stream_url, stream_type: $stream_type,
            description: $description, status: $status,
            resolution: $resolution, fps: $fps,
            uptime: $uptime, eventsToday: $eventsToday,
            created_at: datetime($created_at)
        })
        RETURN c
        """
        result = await neo4j_client.async_execute_query(query, camera_data)
        created_camera = convert_neo4j_datetime(dict(result[0]['c']))
        
        background_tasks.add_task(
            stream_manager.start_camera_stream,
            camera_id, camera.stream_url, camera.stream_type
        )
        
        return created_camera
    except Exception as e:
        logger.error(f"Error adding camera: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{camera_id}")
async def delete_camera(camera_id: str, keep_events: bool = Query(True)):
    """Delete camera"""
    try:
        # Stop HLS transcoding if active
        await stop_hls_transcoding(camera_id)
        
        # Stop stream processing
        await stream_manager.stop_camera_stream(camera_id)
        
        # Delete from database
        if keep_events:
            query = "MATCH (c:Camera {id: $camera_id}) OPTIONAL MATCH (c)-[r:CAPTURED]->() DELETE r, c"
        else:
            query = "MATCH (c:Camera {id: $camera_id}) OPTIONAL MATCH (c)-[:CAPTURED]->(e:Event) DETACH DELETE e, c"
        
        await neo4j_client.async_execute_query(query, {"camera_id": camera_id})
        await redis_client.clear_camera_cache(camera_id)
        
        return {"message": "Camera deleted", "camera_id": camera_id}
    except Exception as e:
        logger.error(f"Error deleting camera: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{camera_id}", response_model=CameraResponse)
async def update_camera(camera_id: str, camera_update: CameraUpdate):
    """Update camera configuration"""
    try:
        query = "MATCH (c:Camera {id: $camera_id}) RETURN c"
        result = await neo4j_client.async_execute_query(query, {"camera_id": camera_id})
        if not result:
            raise HTTPException(status_code=404, detail="Camera not found")
        
        update_fields = []
        params = {"camera_id": camera_id}
        
        if camera_update.name is not None:
            update_fields.append("c.name = $name")
            params["name"] = camera_update.name
        if camera_update.location is not None:
            update_fields.append("c.location = $location")
            params["location"] = camera_update.location
        if camera_update.description is not None:
            update_fields.append("c.description = $description")
            params["description"] = camera_update.description
        if camera_update.status is not None:
            update_fields.append("c.status = $status")
            params["status"] = camera_update.status
        
        if update_fields:
            query = f"MATCH (c:Camera {{id: $camera_id}}) SET {', '.join(update_fields)} RETURN c"
            result = await neo4j_client.async_execute_query(query, params)
            return convert_neo4j_datetime(dict(result[0]['c']))
        
        return convert_neo4j_datetime(dict(result[0]['c']))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{camera_id}/start")
async def start_camera_stream(camera_id: str, background_tasks: BackgroundTasks):
    """Start camera stream"""
    try:
        query = "MATCH (c:Camera {id: $camera_id}) RETURN c"
        result = await neo4j_client.async_execute_query(query, {"camera_id": camera_id})
        if not result:
            raise HTTPException(status_code=404, detail="Camera not found")
        
        camera = dict(result[0]['c'])
        await neo4j_client.async_execute_query(
            "MATCH (c:Camera {id: $camera_id}) SET c.status = 'connecting'",
            {"camera_id": camera_id}
        )
        
        background_tasks.add_task(
            stream_manager.start_camera_stream,
            camera_id, camera.get('stream_url'), camera.get('stream_type', 'http')
        )
        
        return {"message": "Stream starting", "camera_id": camera_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{camera_id}/stop")
async def stop_camera_stream(camera_id: str):
    """Stop camera stream"""
    try:
        await stop_hls_transcoding(camera_id)
        await stream_manager.stop_camera_stream(camera_id)
        await neo4j_client.async_execute_query(
            "MATCH (c:Camera {id: $camera_id}) SET c.status = 'inactive'",
            {"camera_id": camera_id}
        )
        return {"message": "Stream stopped", "camera_id": camera_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{camera_id}/health")
async def get_camera_health(camera_id: str):
    """Get camera health status"""
    try:
        query = "MATCH (c:Camera {id: $camera_id}) RETURN c"
        result = await neo4j_client.async_execute_query(query, {"camera_id": camera_id})
        if not result:
            raise HTTPException(status_code=404, detail="Camera not found")
        
        camera = dict(result[0]['c'])
        stream_status = await stream_manager.get_stream_status(camera_id)
        
        return {
            "camera_id": camera_id,
            "status": camera.get('status'),
            "stream_active": stream_status.get('active', False),
            "hls_active": camera_id in active_hls_processes,
            "last_frame": stream_status.get('last_frame_time'),
            "frames_processed": stream_status.get('frames_processed', 0),
            "uptime": camera.get('uptime', '0%')
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{camera_id}/caption-interval")
async def update_caption_interval(camera_id: str, interval: int = Query(..., ge=15, le=60)):
    """Update caption generation interval"""
    try:
        query = "MATCH (c:Camera {id: $camera_id}) RETURN c"
        result = await neo4j_client.async_execute_query(query, {"camera_id": camera_id})
        if not result:
            raise HTTPException(status_code=404, detail="Camera not found")
        
        await neo4j_client.async_execute_query(
            "MATCH (c:Camera {id: $camera_id}) SET c.caption_interval = $interval RETURN c",
            {"camera_id": camera_id, "interval": interval}
        )
        
        return {"message": "Caption interval updated", "camera_id": camera_id, "interval": interval}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/test-connection")
async def test_stream_connection(data: Dict[str, str]):
    """Test stream connection"""
    try:
        stream_url = data.get('stream_url')
        stream_type = data.get('stream_type', 'http')
        
        if not stream_url:
            raise HTTPException(status_code=400, detail="stream_url required")
        
        if stream_type == 'rtsp':
            cmd = [
                'ffmpeg', '-rtsp_transport', 'tcp',
                '-i', stream_url, '-frames:v', '1',
                '-f', 'null', '-'
            ]
            process = await asyncio.create_subprocess_exec(
                *cmd, stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            await asyncio.wait_for(process.wait(), timeout=10.0)
            
            if process.returncode == 0:
                return {"success": True, "message": "RTSP stream accessible"}
            else:
                stderr = await process.stderr.read()
                return {"success": False, "error": stderr.decode('utf-8', errors='ignore')[:300]}
        else:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(stream_url)
                return {
                    "success": True,
                    "status_code": response.status_code,
                    "content_type": response.headers.get('content-type')
                }
    except Exception as e:
        return {"success": False, "error": str(e)}