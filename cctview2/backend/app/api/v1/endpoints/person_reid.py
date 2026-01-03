# FILE LOCATION: backend/app/api/v1/endpoints/person_reid.py

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from typing import List, Dict, Any
import logging
from datetime import datetime
import numpy as np
import cv2
import io
import httpx
from PIL import Image
import uuid

from app.core.config import settings
from app.db.neo4j.client import neo4j_client
from app.video.stream_manager import stream_manager
from app.ai.models.reid_model import create_reid_model

router = APIRouter()
logger = logging.getLogger(__name__)

# Global Re-ID model instance
reid_model = None

# Global person tracking state
person_tracking_state: Dict[str, Dict[str, Any]] = {}
# Structure: {
#   "person_id": {
#       "features": np.ndarray,
#       "last_seen_camera": "camera_id",
#       "last_seen_time": datetime,
#       "bbox": [x1, y1, x2, y2],
#       "cameras_visited": ["cam1", "cam2"],
#       "transitions": [{"from": "cam1", "to": "cam2", "time": datetime}]
#   }
# }

# Track next person ID
next_person_id = 1


def initialize_reid_model():
    """Initialize Re-ID model on first use"""
    global reid_model
    if reid_model is None:
        logger.info("🚀 Initializing Person Re-ID model...")
        try:
            # Try to load pretrained weights if available
            model_path = settings.MODELS_DIR / "osnet_x1_0.pth"
            if model_path.exists():
                reid_model = create_reid_model(model_path=str(model_path))
            else:
                logger.warning("⚠️ No pretrained weights found, using random initialization")
                reid_model = create_reid_model()
            logger.info("✅ Re-ID model initialized")
        except Exception as e:
            logger.error(f"❌ Failed to initialize Re-ID model: {e}")
            raise


def extract_person_region(frame: np.ndarray, bbox: List[float]) -> np.ndarray:
    """Extract person region from frame"""
    try:
        x1, y1, x2, y2 = [int(coord) for coord in bbox]
        
        # Ensure coordinates are within frame bounds
        frame_h, frame_w = frame.shape[:2]
        x1 = max(0, min(x1, frame_w))
        y1 = max(0, min(y1, frame_h))
        x2 = max(0, min(x2, frame_w))
        y2 = max(0, min(y2, frame_h))
        
        # Extract region
        person_img = frame[y1:y2, x1:x2]
        
        if person_img.size == 0:
            logger.warning("Empty person region extracted")
            return None
        
        return person_img
        
    except Exception as e:
        logger.error(f"Error extracting person region: {e}")
        return None


def match_person_across_cameras(
    features: np.ndarray,
    camera_id: str,
    threshold: float = 0.7
) -> tuple:
    """
    Match person features against known persons
    
    Returns:
        (person_id, similarity, is_transition)
    """
    global person_tracking_state, next_person_id
    
    best_match = None
    best_similarity = 0.0
    is_transition = False
    
    for person_id, person_data in person_tracking_state.items():
        # Compute similarity
        similarity = reid_model.compute_similarity(features, person_data['features'])
        
        if similarity > threshold and similarity > best_similarity:
            best_match = person_id
            best_similarity = similarity
            
            # Check if this is a camera transition
            if person_data['last_seen_camera'] != camera_id:
                is_transition = True
    
    if best_match:
        return (best_match, best_similarity, is_transition)
    else:
        # New person
        new_person_id = f"person_{next_person_id:03d}"
        next_person_id += 1
        return (new_person_id, 1.0, False)


@router.post("/reid/start")
async def start_person_reid(camera_ids: List[str]):
    """
    Start person re-identification tracking across selected cameras
    
    Args:
        camera_ids: List of camera IDs to track
    """
    try:
        # Initialize Re-ID model if not already done
        initialize_reid_model()
        
        # Verify all cameras exist and are active
        for camera_id in camera_ids:
            if camera_id not in stream_manager.active_streams:
                return JSONResponse({
                    "success": False,
                    "error": f"Camera {camera_id} is not active"
                }, status_code=400)
        
        logger.info(f"🎯 Started Re-ID tracking for cameras: {camera_ids}")
        
        return {
            "success": True,
            "message": f"Re-ID tracking started for {len(camera_ids)} cameras",
            "camera_ids": camera_ids
        }
        
    except Exception as e:
        logger.error(f"Error starting Re-ID: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reid/track")
async def get_reid_tracking(camera_ids: str = Query(..., description="Comma-separated camera IDs")):
    """
    Get person re-identification tracking data for selected cameras
    
    Returns:
        - Detected persons with bounding boxes
        - Person IDs and their movement across cameras
        - Transition events
    """
    try:
        # Initialize Re-ID model if not already done
        initialize_reid_model()
        
        # Parse camera IDs
        camera_id_list = [cid.strip() for cid in camera_ids.split(',')]
        
        # Track all persons across all cameras
        all_detections = []
        transitions = []
        
        for camera_id in camera_id_list:
            if camera_id not in stream_manager.latest_frames:
                continue
            
            latest_frame, timestamp = stream_manager.latest_frames[camera_id]
            
            # Convert frame to PIL for YOLO detection
            try:
                frame_rgb = cv2.cvtColor(latest_frame, cv2.COLOR_BGR2RGB)
                pil_image = Image.fromarray(frame_rgb)
                
                img_byte_arr = io.BytesIO()
                pil_image.save(img_byte_arr, format='JPEG', quality=85)
                img_byte_arr.seek(0)
            except Exception as e:
                logger.error(f"Error converting frame: {e}")
                continue
            
            # YOLO detection - only persons
            try:
                files = {'image': ('frame.jpg', img_byte_arr, 'image/jpeg')}
                data = {'confidence': 0.5}
                
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.post(
                        f"{settings.AI_SERVICE_URL}/detect/yolo",
                        files=files,
                        data=data
                    )
                
                if response.status_code != 200:
                    logger.error(f"YOLO detection failed for {camera_id}")
                    continue
                
                detection_result = response.json()
                
                if not detection_result.get("success"):
                    continue
                
                # Filter only person detections
                persons = [d for d in detection_result.get("detections", []) 
                          if d['label'] == 'person' and d['confidence'] >= 0.5]
                
                logger.info(f"📸 Camera {camera_id}: Detected {len(persons)} persons")
                
                # Process each detected person
                for person_det in persons:
                    bbox = person_det['bbox']
                    confidence = person_det['confidence']
                    
                    # Extract person region
                    person_img = extract_person_region(latest_frame, bbox)
                    
                    if person_img is None:
                        continue
                    
                    # Extract Re-ID features
                    features = reid_model.extract_features(person_img)
                    
                    # Match against known persons
                    person_id, similarity, is_transition = match_person_across_cameras(
                        features, camera_id, threshold=settings.REID_SIMILARITY_THRESHOLD
                    )
                    
                    # Update tracking state
                    if person_id in person_tracking_state:
                        # Existing person
                        prev_camera = person_tracking_state[person_id]['last_seen_camera']
                        
                        if is_transition:
                            # Person moved to new camera!
                            transition_event = {
                                "person_id": person_id,
                                "from_camera": prev_camera,
                                "to_camera": camera_id,
                                "time": timestamp.isoformat(),
                                "similarity": float(similarity)
                            }
                            transitions.append(transition_event)
                            
                            # Update cameras visited
                            if camera_id not in person_tracking_state[person_id]['cameras_visited']:
                                person_tracking_state[person_id]['cameras_visited'].append(camera_id)
                            
                            # Record transition
                            person_tracking_state[person_id]['transitions'].append(transition_event)
                            
                            logger.info(f"🚶 TRANSITION: {person_id} moved from {prev_camera} to {camera_id}")
                        
                        # Update state
                        person_tracking_state[person_id].update({
                            'features': features,
                            'last_seen_camera': camera_id,
                            'last_seen_time': timestamp,
                            'bbox': bbox
                        })
                    else:
                        # New person
                        person_tracking_state[person_id] = {
                            'features': features,
                            'last_seen_camera': camera_id,
                            'last_seen_time': timestamp,
                            'bbox': bbox,
                            'cameras_visited': [camera_id],
                            'transitions': []
                        }
                        logger.info(f"👤 NEW PERSON: {person_id} detected at {camera_id}")
                    
                    # Add to detections for this camera
                    all_detections.append({
                        'camera_id': camera_id,
                        'person_id': person_id,
                        'bbox': bbox,
                        'confidence': float(confidence),
                        'similarity': float(similarity),
                        'is_new': person_id not in person_tracking_state or len(person_tracking_state[person_id]['transitions']) == 0,
                        'cameras_visited': person_tracking_state[person_id]['cameras_visited']
                    })
                
            except Exception as e:
                logger.error(f"Error processing camera {camera_id}: {e}")
                continue
        
        # Return tracking data
        return {
            "success": True,
            "timestamp": datetime.now().isoformat(),
            "cameras": camera_id_list,
            "detections": all_detections,
            "transitions": transitions,
            "total_persons": len(person_tracking_state),
            "tracked_persons": [
                {
                    "person_id": pid,
                    "last_camera": data['last_seen_camera'],
                    "cameras_visited": data['cameras_visited'],
                    "transitions_count": len(data['transitions'])
                }
                for pid, data in person_tracking_state.items()
            ]
        }
        
    except Exception as e:
        logger.error(f"Error in Re-ID tracking: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return JSONResponse({
            "success": False,
            "error": str(e)
        }, status_code=500)


@router.delete("/reid/reset")
async def reset_reid_tracking():
    """Reset all person tracking state"""
    global person_tracking_state, next_person_id
    
    person_tracking_state = {}
    next_person_id = 1
    
    logger.info("🔄 Re-ID tracking state reset")
    
    return {
        "success": True,
        "message": "Re-ID tracking state reset"
    }


@router.get("/reid/history/{person_id}")
async def get_person_history(person_id: str):
    """Get movement history for a specific person"""
    if person_id not in person_tracking_state:
        raise HTTPException(status_code=404, detail="Person not found")
    
    person_data = person_tracking_state[person_id]
    
    return {
        "person_id": person_id,
        "cameras_visited": person_data['cameras_visited'],
        "transitions": person_data['transitions'],
        "last_seen_camera": person_data['last_seen_camera'],
        "last_seen_time": person_data['last_seen_time'].isoformat()
    }