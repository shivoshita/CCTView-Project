# FILE LOCATION: backend/app/services/anomaly_detection_service.py

"""
Anomaly Detection Service
Checks captions from Redis against anomaly rules from Neo4j
Uses Ollama LLM for semantic similarity matching
"""

from typing import Dict, List, Optional, Any
import logging
import json
from datetime import datetime
import uuid
import ollama
from app.core.config import settings

from app.db.neo4j.client import neo4j_client
from app.db.redis.client import redis_client
from app.api.v1.websockets.alerts_ws import alerts_manager
from app.services.notification_service import notification_service

logger = logging.getLogger(__name__)


class AnomalyDetectionService:
    """Service for detecting anomalies by comparing captions with rules using semantic similarity"""
    
    def __init__(self):
        self.similarity_threshold = 0.75  # Semantic similarity threshold (cosine similarity)
        self.ollama_base_url = settings.OLLAMA_BASE_URL
        self.ollama_model = settings.OLLAMA_MODEL
    
    async def check_caption_for_anomalies(
        self,
        camera_id: str,
        caption: str,
        timestamp: str,
        confidence: float = 0.0
    ) -> Optional[Dict[str, Any]]:
        """
        Check if a caption matches any anomaly rules for the camera
        
        Args:
            camera_id: Camera identifier
            caption: Caption text to check
            timestamp: Timestamp of the caption
            confidence: AI confidence score
            
        Returns:
            Dict with anomaly details if match found, None otherwise
        """
        try:
            logger.info(f"🔍 Checking caption for anomalies: camera={camera_id}")
            
            # Get enabled anomaly rules for this camera
            rules = await self._get_anomaly_rules_for_camera(camera_id)
            
            if not rules:
                logger.debug(f"No enabled rules found for camera {camera_id}")
                return None
            
            # Check each rule for similarity
            for rule in rules:
                is_match = await self._check_rule_similarity(rule, caption)
                
                if is_match:
                    logger.warning(f"⚠️ Anomaly detected! Rule: {rule.get('name')}, Camera: {camera_id}")
                    
                    anomaly_data = {
                        "anomaly_id": f"anom_{uuid.uuid4().hex[:10]}",
                        "rule_id": rule.get("id"),
                        "rule_name": rule.get("name"),
                        "rule_type": rule.get("rule_type"),
                        "severity": rule.get("severity", "medium"),
                        "camera_id": camera_id,
                        "caption": caption,
                        "timestamp": timestamp,
                        "confidence": confidence,
                        "description": rule.get("description", caption)
                    }
                    
                    # Store anomaly in Neo4j for history
                    await self._store_anomaly_in_neo4j(anomaly_data)
                    
                    # Send alert via WebSocket
                    await self._send_alert(anomaly_data)
                    
                    # Deliver via configured channels (e.g., Twilio SMS)
                    await notification_service.deliver_alerts(anomaly_data)
                    
                    return anomaly_data
            
            return None
            
        except Exception as e:
            logger.error(f"❌ Error checking caption for anomalies: {e}", exc_info=True)
            return None
    
    async def _get_anomaly_rules_for_camera(self, camera_id: str) -> List[Dict[str, Any]]:
        """
        Get all enabled anomaly rules that apply to this camera
        
        Returns:
            List of rule dictionaries
        """
        try:
            query = """
            MATCH (r:AnomalyRule)
            WHERE r.enabled = true
            OPTIONAL MATCH (r)-[:APPLIES_TO]->(c:Camera {id: $camera_id})
            WITH r, c
            WHERE c IS NOT NULL OR NOT EXISTS((r)-[:APPLIES_TO]->(:Camera))
            RETURN r.id as id, r.name as name, r.description as description,
                   r.rule_type as rule_type, r.severity as severity, 
                   r.conditions as conditions, r.priority as priority
            ORDER BY r.priority DESC
            """
            
            results = await neo4j_client.async_execute_query(query, {"camera_id": camera_id})
            
            rules = []
            for record in results:
                rule_data = dict(record)
                
                # Deserialize conditions from JSON string
                if 'conditions' in rule_data and isinstance(rule_data['conditions'], str):
                    try:
                        rule_data['conditions'] = json.loads(rule_data['conditions'])
                    except (json.JSONDecodeError, TypeError):
                        rule_data['conditions'] = {}
                
                rules.append(rule_data)
            
            logger.debug(f"Found {len(rules)} enabled rules for camera {camera_id}")
            return rules
            
        except Exception as e:
            logger.error(f"Error fetching anomaly rules: {e}", exc_info=True)
            return []
    
    async def _check_rule_similarity(self, rule: Dict[str, Any], caption: str) -> bool:
        """
        Check if caption matches the rule conditions using Ollama LLM for semantic similarity
        
        Args:
            rule: Anomaly rule dictionary
            caption: Caption text to check
            
        Returns:
            True if caption matches rule, False otherwise
        """
        try:
            conditions = rule.get("conditions", {})
            rule_name = rule.get("name", "")
            
            # Build rule text for semantic comparison
            # Combine rule name, description, and conditions into a meaningful text
            rule_text_parts = []
            
            # Add rule name if available
            if rule_name:
                rule_text_parts.append(rule_name)
            
            # Add rule description
            rule_description = rule.get("description", "")
            if rule_description:
                rule_text_parts.append(rule_description)
            
            # Add object_class from conditions if available
            object_class = conditions.get("object_class")
            if object_class:
                rule_text_parts.append(f"object: {object_class}")
            
            # Combine into rule text
            rule_text = " ".join(rule_text_parts)
            
            if not rule_text:
                logger.warning(f"Rule {rule.get('id')} has no text for comparison")
                return False
            
            # Use Ollama LLM to check semantic similarity
            is_similar = await self._check_similarity_with_ollama(caption, rule_text)
            
            if is_similar:
                logger.info(f"✅ Semantic match found: rule='{rule_name}', caption='{caption[:50]}...'")
                return True
            else:
                logger.debug(f"No match: rule='{rule_name}', caption='{caption[:50]}...'")
                return False
            
        except Exception as e:
            logger.error(f"Error checking rule similarity: {e}", exc_info=True)
            # Fallback to simple keyword matching if Ollama fails
            return await self._fallback_keyword_match(rule, caption)
    
    async def _check_similarity_with_ollama(self, caption: str, rule_text: str) -> bool:
        """
        Use Ollama LLM to determine if caption and rule text are semantically similar
        
        Args:
            caption: Caption text from camera
            rule_text: Rule description/condition text
            
        Returns:
            True if similar, False otherwise
        """
        try:
            # Create a prompt for Ollama to compare the two texts
            prompt = f"""You are an anomaly detection system. Compare the following two descriptions and determine if they describe the same or similar scene/activity.

Anomaly Rule Description: "{rule_text}"

Camera Caption: "{caption}"

Are these describing the same or semantically similar scene/activity? Consider:
- Synonyms (e.g., "person" vs "woman" vs "man", "sofa" vs "couch" vs "settee")
- Similar actions (e.g., "sitting" vs "seated")
- Same context but different wording

Respond with ONLY "YES" if they are similar, or "NO" if they are not similar. Do not include any explanation."""

            # Call Ollama
            response = ollama.generate(
                model=self.ollama_model,
                prompt=prompt,
                options={
                    "temperature": 0.1,  # Low temperature for consistent results
                    "num_predict": 10,  # Short response (just YES or NO)
                }
            )
            
            if response and 'response' in response:
                answer = response['response'].strip().upper()
                is_similar = answer.startswith('YES')
                
                logger.debug(f"Ollama response: {answer}, Similar: {is_similar}")
                return is_similar
            else:
                logger.warning("Ollama response missing 'response' field, falling back to keyword matching")
                return False
                
        except Exception as e:
            logger.error(f"Error checking similarity with Ollama: {e}", exc_info=True)
            return False
    
    async def _fallback_keyword_match(self, rule: Dict[str, Any], caption: str) -> bool:
        """
        Fallback to simple keyword matching if Ollama LLM fails
        
        Args:
            rule: Anomaly rule dictionary
            caption: Caption text to check
            
        Returns:
            True if keywords match, False otherwise
        """
        try:
            conditions = rule.get("conditions", {})
            
            # Check for object_class in conditions
            object_class = conditions.get("object_class")
            if object_class:
                if object_class.lower() in caption.lower():
                    return True
            
            # Check for keywords in description
            rule_description = rule.get("description", "").lower()
            caption_lower = caption.lower()
            
            # Extract meaningful words
            words = rule_description.split()
            common_words = {"detect", "anomaly", "rule", "the", "a", "an", "at", "in", "on", "for", "to", "of", "and", "or", "is", "are", "was", "were"}
            keywords = [w for w in words if w not in common_words and len(w) > 3]
            
            matches = sum(1 for kw in keywords if kw in caption_lower)
            if matches > 0 and matches / max(len(keywords), 1) >= 0.5:
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error in fallback keyword match: {e}", exc_info=True)
            return False
    
    async def _store_anomaly_in_neo4j(self, anomaly_data: Dict[str, Any]):
        """
        Store detected anomaly in Neo4j for history tracking
        
        Args:
            anomaly_data: Dictionary containing anomaly details
        """
        try:
            camera_id = anomaly_data.get("camera_id")
            caption = anomaly_data.get("caption")
            timestamp_str = anomaly_data.get("timestamp")
            confidence = anomaly_data.get("confidence", 0.0)
            rule_id = anomaly_data.get("rule_id")
            anomaly_id = anomaly_data.get("anomaly_id")
            rule_type = anomaly_data.get("rule_type", "rule_match")
            severity = anomaly_data.get("severity", "medium")
            description = anomaly_data.get("description", caption)
            
            # Parse timestamp
            try:
                if isinstance(timestamp_str, str):
                    # Try parsing ISO format timestamp
                    try:
                        detected_at_dt = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                        detected_at_iso = detected_at_dt.isoformat()
                    except:
                        # Fallback to dateutil parser
                        from dateutil import parser
                        detected_at_dt = parser.isoparse(timestamp_str)
                        detected_at_iso = detected_at_dt.isoformat()
                else:
                    detected_at_iso = datetime.now().isoformat()
            except Exception as parse_error:
                logger.warning(f"Failed to parse timestamp {timestamp_str}, using current time: {parse_error}")
                detected_at_iso = datetime.now().isoformat()
            
            # Create Event node first (or find existing one)
            event_id = f"evt_{uuid.uuid4().hex[:12]}"
            
            # Create Event and Anomaly in one transaction
            # First ensure camera exists and get its details
            camera_check_query = """
            MATCH (c:Camera {id: $camera_id})
            RETURN c.id as id, c.name as name, c.location as location
            """
            
            camera_result = await neo4j_client.async_execute_query(camera_check_query, {"camera_id": camera_id})
            
            if not camera_result:
                logger.warning(f"Camera {camera_id} not found in Neo4j, creating basic camera node")
                # Create basic camera if it doesn't exist
                camera_create_query = """
                MERGE (c:Camera {id: $camera_id})
                ON CREATE SET c.name = $camera_id, c.location = 'Unknown', c.status = 'active'
                RETURN c.id as id, c.name as name, c.location as location
                """
                camera_result = await neo4j_client.async_execute_query(camera_create_query, {"camera_id": camera_id})
            
            # Create Event and Anomaly
            create_query = """
            MATCH (c:Camera {id: $camera_id})
            
            // Create Event node
            CREATE (e:Event {
                id: $event_id,
                timestamp: datetime($timestamp),
                caption: $caption,
                confidence: $confidence,
                created_at: datetime()
            })
            
            // Link camera to event
            CREATE (c)-[:CAPTURED]->(e)
            
            // Create Anomaly node
            CREATE (a:Anomaly {
                id: $anomaly_id,
                type: $type,
                severity: $severity,
                confidence: $confidence,
                detected_at: datetime($detected_at),
                status: 'new',
                description: $description
            })
            
            // Link event to anomaly
            CREATE (e)-[:TRIGGERED]->(a)
            
            // Link anomaly to rule if rule exists
            WITH a, e, c
            OPTIONAL MATCH (r:AnomalyRule {id: $rule_id})
            FOREACH (x IN CASE WHEN r IS NOT NULL THEN [1] ELSE [] END |
                CREATE (a)-[:MATCHED_RULE]->(r)
            )
            
            RETURN a.id as anomaly_id, e.id as event_id, c.id as camera_id, c.name as camera_name, c.location as camera_location
            """
            
            result = await neo4j_client.async_execute_query(create_query, {
                "camera_id": camera_id,
                "event_id": event_id,
                "timestamp": detected_at_iso,
                "caption": caption,
                "confidence": confidence,
                "anomaly_id": anomaly_id,
                "type": rule_type,
                "severity": severity,
                "detected_at": detected_at_iso,
                "description": description,
                "rule_id": rule_id
            })
            
            if result:
                logger.info(f"✅ Stored anomaly in Neo4j: {anomaly_id} for camera {camera_id}")
            else:
                logger.warning(f"⚠️ Failed to store anomaly in Neo4j: {anomaly_id}")
                
        except Exception as e:
            logger.error(f"❌ Error storing anomaly in Neo4j: {e}", exc_info=True)
    
    async def _send_alert(self, anomaly_data: Dict[str, Any]):
        """
        Send alert notification via WebSocket
        
        Args:
            anomaly_data: Dictionary containing anomaly details
        """
        try:
            alert_message = {
                "type": "anomaly",
                "anomaly_id": anomaly_data.get("anomaly_id"),
                "rule_id": anomaly_data.get("rule_id"),
                "rule_name": anomaly_data.get("rule_name"),
                "rule_type": anomaly_data.get("rule_type"),
                "severity": anomaly_data.get("severity"),
                "camera_id": anomaly_data.get("camera_id"),
                "caption": anomaly_data.get("caption"),
                "timestamp": anomaly_data.get("timestamp"),
                "confidence": anomaly_data.get("confidence"),
                "description": anomaly_data.get("description"),
                "detected_at": datetime.now().isoformat()
            }
            
            await alerts_manager.send_alert(alert_message)
            logger.info(f"✅ Alert sent via WebSocket: {anomaly_data.get('rule_name')}")
            
        except Exception as e:
            logger.error(f"❌ Error sending alert: {e}", exc_info=True)
    
    async def check_latest_caption_for_camera(self, camera_id: str) -> Optional[Dict[str, Any]]:
        """
        Check the latest caption from Redis for a camera against anomaly rules
        
        Args:
            camera_id: Camera identifier
            
        Returns:
            Dict with anomaly details if match found, None otherwise
        """
        try:
            # Get latest caption from Redis
            # We'll need to scan for the latest caption key
            # Format: caption:{camera_id}:{timestamp}
            
            # Get all caption keys for this camera
            pattern = f"caption:{camera_id}:*"
            keys = []
            
            try:
                # Use scan_iter to find all matching keys
                cursor = 0
                while True:
                    cursor, batch_keys = await redis_client.client.scan(
                        cursor=cursor,
                        match=pattern,
                        count=100
                    )
                    for key in batch_keys:
                        keys.append(key.decode() if isinstance(key, bytes) else key)
                    if cursor == 0:
                        break
            except Exception as e:
                logger.error(f"Error scanning Redis keys: {e}")
                return None
            
            if not keys:
                logger.debug(f"No captions found in Redis for camera {camera_id}")
                return None
            
            # Get the latest caption (by timestamp in key)
            # Sort keys to get the latest
            keys.sort(reverse=True)
            latest_key = keys[0]
            
            # Extract timestamp from key
            # Format: caption:{camera_id}:{timestamp}
            parts = latest_key.split(":")
            if len(parts) < 3:
                return None
            
            timestamp_str = ":".join(parts[2:])  # Handle timestamps with colons
            
            # Get caption from Redis
            caption = await redis_client.client.get(latest_key)
            if not caption:
                return None
            
            caption_text = caption.decode() if isinstance(caption, bytes) else caption
            
            # Get metadata if available
            metadata_key = f"meta:{camera_id}:{timestamp_str}"
            metadata_json = await redis_client.client.get(metadata_key)
            confidence = 0.0
            
            if metadata_json:
                try:
                    metadata = json.loads(metadata_json.decode() if isinstance(metadata_json, bytes) else metadata_json)
                    confidence = metadata.get("confidence", 0.0)
                except:
                    pass
            
            # Check for anomalies
            return await self.check_caption_for_anomalies(
                camera_id,
                caption_text,
                timestamp_str,
                confidence
            )
            
        except Exception as e:
            logger.error(f"Error checking latest caption: {e}", exc_info=True)
            return None


# Singleton instance
anomaly_detection_service = AnomalyDetectionService()

