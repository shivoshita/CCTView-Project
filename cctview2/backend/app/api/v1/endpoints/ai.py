from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import Dict, Any
import httpx
import logging
import time
from datetime import datetime
import uuid

from app.core.config import settings
from app.db.redis.client import redis_client
from app.db.neo4j.client import neo4j_client

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/caption", response_model=Dict[str, Any])
async def generate_caption(file: UploadFile = File(...)):
    """
    Generate AI caption for uploaded image and store in Redis/Neo4j
    """
    start_time = time.time()
    
    try:
        # Validate file type
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Read file content
        image_bytes = await file.read()
        
        # Send to AI service
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{settings.AI_SERVICE_URL}/caption",
                files={"file": (file.filename, image_bytes, file.content_type)}
            )
            
            if response.status_code != 200:
                logger.error(f"AI Service error: {response.text}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"AI service error: {response.text}"
                )
            
            result = response.json()
            caption = result.get("caption", "")
            confidence = result.get("confidence", 0.0)
            
            # Generate unique IDs
            event_id = f"evt_{uuid.uuid4().hex[:12]}"
            timestamp = datetime.now()
            timestamp_str = timestamp.isoformat()
            
            logger.info(f"Starting storage - Event ID: {event_id}")
            
            # Store in Redis (hot cache)
            try:
                caption_key = f"caption:test_camera:{timestamp.timestamp()}"
                await redis_client.client.setex(caption_key, 3600, caption)
                logger.info(f"✅ Stored caption in Redis: {caption_key}")
                
            except Exception as e:
                logger.error(f"❌ Redis storage failed: {e}")
            
            # Store in Neo4j (permanent storage)
            try:
                # Create test camera if not exists
                camera_query = """
                    MERGE (c:Camera {id: 'test_camera'})
                    ON CREATE SET 
                        c.name = 'Test Upload Camera',
                        c.location = 'Dashboard',
                        c.status = 'active',
                        c.stream_url = 'test://upload',  # Add this line
                        c.stream_type = 'test',           # Add this line
                        c.created_at = datetime()
                    RETURN c.id as camera_id
                    """
                await neo4j_client.async_execute_query(camera_query)
                
                # Create event
                event_query = """
                MATCH (c:Camera {id: 'test_camera'})
                CREATE (e:Event {
                    id: $event_id,
                    timestamp: datetime($timestamp),
                    caption: $caption,
                    confidence: $confidence,
                    filename: $filename
                })
                CREATE (c)-[:CAPTURED]->(e)
                RETURN e.id as event_id
                """
                
                await neo4j_client.async_execute_query(event_query, {
                    "event_id": event_id,
                    "timestamp": timestamp_str,
                    "caption": caption,
                    "confidence": confidence,
                    "filename": file.filename
                })
                
                logger.info(f"✅ Stored event in Neo4j: {event_id}")

                # Simple rule matching and anomaly creation + basic notification
                try:
                    # Fetch enabled rules applicable to this camera (or global rules without camera link)
                    rules_query = """
                    MATCH (r:AnomalyRule)
                    WHERE r.enabled = true
                    OPTIONAL MATCH (r)-[:APPLIES_TO]->(cam:Camera)
                    WITH r, collect(cam.id) as cam_ids
                    RETURN r.id as id, r.name as name, r.rule_type as rule_type,
                           r.severity as severity, r.description as description,
                           r.conditions as conditions, cam_ids as camera_ids
                    """
                    rules = await neo4j_client.async_execute_query(rules_query)

                    # Iterate and find first matching rule (very basic: object_class substring in caption)
                    matched_rule = None
                    for rec in rules:
                        cond = rec.get("conditions")
                        # Rules may store conditions as JSON string
                        if isinstance(cond, str):
                            try:
                                import json
                                cond = json.loads(cond)
                            except Exception:
                                cond = {}
                        object_class = (cond or {}).get("object_class")
                        applies_to = rec.get("camera_ids") or []
                        applies_here = (not applies_to) or ("test_camera" in applies_to)
                        if applies_here and object_class and object_class.lower() in (caption or "").lower():
                            matched_rule = rec
                            break

                    if matched_rule:
                        anomaly_id = f"anom_{uuid.uuid4().hex[:10]}"
                        create_anomaly_query = """
                        MATCH (c:Camera {id: 'test_camera'})-[:CAPTURED]->(e:Event {id: $event_id})
                        MATCH (r:AnomalyRule {id: $rule_id})
                        CREATE (a:Anomaly {
                            id: $anomaly_id,
                            type: $type,
                            severity: $severity,
                            confidence: $confidence,
                            detected_at: datetime($detected_at),
                            status: 'new',
                            description: $description
                        })
                        CREATE (e)-[:TRIGGERED]->(a)
                        CREATE (a)-[:MATCHED_RULE]->(r)
                        RETURN a.id as anomaly_id
                        """
                        await neo4j_client.async_execute_query(create_anomaly_query, {
                            "event_id": event_id,
                            "rule_id": matched_rule.get("id"),
                            "anomaly_id": anomaly_id,
                            "type": matched_rule.get("rule_type") or "rule_match",
                            "severity": matched_rule.get("severity") or "medium",
                            "confidence": confidence,
                            "detected_at": timestamp_str,
                            "description": matched_rule.get("description") or caption
                        })

                        # Basic notification delivery record (log channel)
                        notify_query = """
                        CREATE (alert:AlertDelivery {
                            id: $alert_id,
                            channel_type: 'log',
                            status: 'delivered',
                            message: $message,
                            delivered_at: datetime($delivered_at)
                        })
                        WITH alert
                        MATCH (a:Anomaly {id: $anomaly_id})
                        CREATE (alert)-[:FOR_ANOMALY]->(a)
                        RETURN alert.id as alert_id
                        """
                        await neo4j_client.async_execute_query(notify_query, {
                            "alert_id": f"alert_{uuid.uuid4().hex[:10]}",
                            "message": f"Anomaly {matched_rule.get('rule_type')} detected at test_camera at {timestamp_str}",
                            "delivered_at": timestamp_str,
                            "anomaly_id": anomaly_id
                        })
                        logger.info("🔔 Basic notification delivered (log channel)")
                except Exception as notify_err:
                    logger.error(f"❌ Notification processing failed: {notify_err}")
                
            except Exception as e:
                logger.error(f"❌ Neo4j storage failed: {e}")
            
            processing_time = time.time() - start_time
            
            return {
                "caption": caption,
                "confidence": confidence,
                "processing_time": processing_time,
                "event_id": event_id,
                "timestamp": timestamp_str
            }
            
    except httpx.TimeoutException:
        logger.error("AI Service timeout")
        raise HTTPException(status_code=504, detail="AI service timeout")
    except httpx.RequestError as e:
        logger.error(f"AI Service connection error: {str(e)}")
        raise HTTPException(status_code=503, detail=f"Cannot connect to AI service: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
