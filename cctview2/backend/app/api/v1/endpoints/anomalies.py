# FILE LOCATION: backend/app/api/v1/endpoints/anomalies.py

"""
Anomaly Management API Endpoints
Handles anomaly rules, detections, and notification configurations
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime, timedelta
import uuid
import json

from app.db.neo4j.client import neo4j_client
from app.db.redis.client import redis_client

router = APIRouter()
logger = logging.getLogger(__name__)


# ==================== ANOMALY RULES (Tab 1: Configure) ====================

@router.get("/rules", response_model=Dict[str, Any])
async def get_all_anomaly_rules(
    enabled: Optional[bool] = Query(None, description="Filter by enabled status")
):
    """
    Get all anomaly rules
    
    Args:
        enabled: Optional filter by enabled status
    
    Returns:
        List of anomaly rules
    """
    try:
        logger.info(f"📋 Fetching anomaly rules (enabled={enabled})")
        
        if enabled is not None:
            query = """
            MATCH (r:AnomalyRule)
            WHERE r.enabled = $enabled
            RETURN r.id as id, r.name as name, r.description as description,
                   r.rule_type as rule_type, r.severity as severity, r.conditions as conditions,
                   r.enabled as enabled, r.priority as priority, r.created_by as created_by,
                   r.created_at as created_at
            ORDER BY r.priority DESC, r.created_at DESC
            """
            params = {"enabled": enabled}
        else:
            query = """
            MATCH (r:AnomalyRule)
            RETURN r.id as id, r.name as name, r.description as description,
                   r.rule_type as rule_type, r.severity as severity, r.conditions as conditions,
                   r.enabled as enabled, r.priority as priority, r.created_by as created_by,
                   r.created_at as created_at
            ORDER BY r.priority DESC, r.created_at DESC
            """
            params = {}
        
        results = await neo4j_client.async_execute_query(query, params)
        
        rules = []
        for record in results:
            rule_data = dict(record)
            
            # Deserialize conditions from JSON string
            if 'conditions' in rule_data and isinstance(rule_data['conditions'], str):
                try:
                    rule_data['conditions'] = json.loads(rule_data['conditions'])
                except (json.JSONDecodeError, TypeError):
                    rule_data['conditions'] = {}
            
            # Handle DateTime conversion
            if 'created_at' in rule_data and rule_data['created_at']:
                created_at = rule_data['created_at']
                if hasattr(created_at, 'isoformat'):
                    rule_data['created_at'] = created_at.isoformat()
                elif hasattr(created_at, 'to_native'):
                    rule_data['created_at'] = created_at.to_native().isoformat()
            
            rules.append(rule_data)
        
        logger.info(f"✅ Retrieved {len(rules)} anomaly rules")
        
        return {
            "success": True,
            "count": len(rules),
            "rules": rules
        }
        
    except Exception as e:
        logger.error(f"❌ Error fetching anomaly rules: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/rules/{rule_id}", response_model=Dict[str, Any])
async def get_anomaly_rule(rule_id: str):
    """Get single anomaly rule by ID"""
    try:
        logger.info(f"📋 Fetching anomaly rule: {rule_id}")
        
        query = """
        MATCH (r:AnomalyRule {id: $rule_id})
        OPTIONAL MATCH (r)-[:APPLIES_TO]->(c:Camera)
        RETURN r.id as id, r.name as name, r.description as description,
               r.rule_type as rule_type, r.severity as severity, r.conditions as conditions,
               r.enabled as enabled, r.priority as priority, r.created_by as created_by,
               r.created_at as created_at, collect(c.id) as camera_ids
        """
        
        results = await neo4j_client.async_execute_query(query, {"rule_id": rule_id})
        
        if not results:
            raise HTTPException(status_code=404, detail="Anomaly rule not found")
        
        record = results[0]
        rule_data = dict(record)
        
        # Deserialize conditions from JSON string
        if 'conditions' in rule_data and isinstance(rule_data['conditions'], str):
            try:
                rule_data['conditions'] = json.loads(rule_data['conditions'])
            except (json.JSONDecodeError, TypeError):
                rule_data['conditions'] = {}
        
        # Handle DateTime
        if 'created_at' in rule_data and rule_data['created_at']:
            created_at = rule_data['created_at']
            if hasattr(created_at, 'isoformat'):
                rule_data['created_at'] = created_at.isoformat()
            elif hasattr(created_at, 'to_native'):
                rule_data['created_at'] = created_at.to_native().isoformat()
        
        # Filter out None values from camera_ids
        camera_ids = record.get('camera_ids', [])
        rule_data['camera_ids'] = [cam_id for cam_id in camera_ids if cam_id]
        
        return {
            "success": True,
            "rule": rule_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching rule: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rules", response_model=Dict[str, Any])
async def create_anomaly_rule(rule_data: Dict[str, Any]):
    """
    Create new anomaly rule
    
    Expected payload:
    {
        "name": "After Hours Entry",
        "description": "Detect persons in restricted areas after 6 PM",
        "rule_type": "object_detection",
        "severity": "high",
        "conditions": {
            "object_class": "person",
            "zones": ["zone_A"],
            "time_range": {"start": "18:00", "end": "06:00"},
            "threshold": 0.75
        },
        "camera_ids": ["cam_001", "cam_003"],
        "enabled": true,
        "priority": 8
    }
    """
    try:
        logger.info(f"📝 Creating anomaly rule: {rule_data.get('name')}")
        
        rule_id = f"rule_{uuid.uuid4().hex[:8]}"
        
        # Create rule node
        query = """
        CREATE (r:AnomalyRule {
            id: $rule_id,
            name: $name,
            description: $description,
            rule_type: $rule_type,
            severity: $severity,
            conditions: $conditions,
            enabled: $enabled,
            priority: $priority,
            created_by: $created_by,
            created_at: datetime()
        })
        RETURN r.id as id, r.name as name, r.description as description,
               r.rule_type as rule_type, r.severity as severity, r.conditions as conditions,
               r.enabled as enabled, r.priority as priority, r.created_by as created_by,
               r.created_at as created_at
        """
        
        # Serialize conditions to JSON string (Neo4j doesn't support nested maps)
        conditions = rule_data.get("conditions", {})
        conditions_json = json.dumps(conditions) if conditions else "{}"
        
        params = {
            "rule_id": rule_id,
            "name": rule_data.get("name"),
            "description": rule_data.get("description", ""),
            "rule_type": rule_data.get("rule_type", "object_detection"),
            "severity": rule_data.get("severity", "medium"),
            "conditions": conditions_json,  # Store as JSON string
            "enabled": rule_data.get("enabled", True),
            "priority": rule_data.get("priority", 5),
            "created_by": rule_data.get("created_by", "system")
        }
        
        result = await neo4j_client.async_execute_query(query, params)
        
        if not result:
            raise HTTPException(status_code=500, detail="Failed to create rule")
        
        # Link to cameras if specified
        camera_ids = rule_data.get("camera_ids", [])
        if camera_ids:
            link_query = """
            MATCH (r:AnomalyRule {id: $rule_id})
            UNWIND $camera_ids as cam_id
            MATCH (c:Camera {id: cam_id})
            MERGE (r)-[:APPLIES_TO]->(c)
            """
            await neo4j_client.async_execute_query(link_query, {
                "rule_id": rule_id,
                "camera_ids": camera_ids
            })
        
        # Get the created rule - now returns properties directly
        record = result[0]
        created_rule = dict(record)
        
        # Deserialize conditions from JSON string
        if 'conditions' in created_rule and isinstance(created_rule['conditions'], str):
            try:
                created_rule['conditions'] = json.loads(created_rule['conditions'])
            except (json.JSONDecodeError, TypeError):
                created_rule['conditions'] = {}
        
        if 'created_at' in created_rule and created_rule['created_at']:
            created_at = created_rule['created_at']
            if hasattr(created_at, 'isoformat'):
                created_rule['created_at'] = created_at.isoformat()
        
        logger.info(f"✅ Created anomaly rule: {rule_id}")
        
        return {
            "success": True,
            "rule_id": rule_id,
            "rule": created_rule
        }
        
    except Exception as e:
        logger.error(f"❌ Error creating rule: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/rules/{rule_id}", response_model=Dict[str, Any])
async def update_anomaly_rule(rule_id: str, rule_data: Dict[str, Any]):
    """Update existing anomaly rule"""
    try:
        logger.info(f"📝 Updating anomaly rule: {rule_id}")
        
        # Check if rule exists
        check_query = """
        MATCH (r:AnomalyRule {id: $rule_id})
        RETURN r
        """
        check_result = await neo4j_client.async_execute_query(check_query, {"rule_id": rule_id})
        
        if not check_result:
            raise HTTPException(status_code=404, detail="Anomaly rule not found")
        
        # Build update query
        update_fields = []
        params = {"rule_id": rule_id}
        
        if "name" in rule_data:
            update_fields.append("r.name = $name")
            params["name"] = rule_data["name"]
        
        if "description" in rule_data:
            update_fields.append("r.description = $description")
            params["description"] = rule_data["description"]
        
        if "severity" in rule_data:
            update_fields.append("r.severity = $severity")
            params["severity"] = rule_data["severity"]
        
        if "conditions" in rule_data:
            update_fields.append("r.conditions = $conditions")
            # Serialize conditions to JSON string (Neo4j doesn't support nested maps)
            conditions = rule_data["conditions"]
            params["conditions"] = json.dumps(conditions) if conditions else "{}"
        
        if "enabled" in rule_data:
            update_fields.append("r.enabled = $enabled")
            params["enabled"] = rule_data["enabled"]
        
        if "priority" in rule_data:
            update_fields.append("r.priority = $priority")
            params["priority"] = rule_data["priority"]
        
        if update_fields:
            query = f"""
            MATCH (r:AnomalyRule {{id: $rule_id}})
            SET {', '.join(update_fields)}
            RETURN r.id as id, r.name as name, r.description as description,
                   r.rule_type as rule_type, r.severity as severity, r.conditions as conditions,
                   r.enabled as enabled, r.priority as priority, r.created_by as created_by,
                   r.created_at as created_at
            """
            
            result = await neo4j_client.async_execute_query(query, params)
            updated_rule = dict(result[0])
        else:
            # Get rule with properties directly
            get_query = """
            MATCH (r:AnomalyRule {id: $rule_id})
            RETURN r.id as id, r.name as name, r.description as description,
                   r.rule_type as rule_type, r.severity as severity, r.conditions as conditions,
                   r.enabled as enabled, r.priority as priority, r.created_by as created_by,
                   r.created_at as created_at
            """
            result = await neo4j_client.async_execute_query(get_query, {"rule_id": rule_id})
            updated_rule = dict(result[0]) if result else {}
        
        # Deserialize conditions from JSON string
        if 'conditions' in updated_rule and isinstance(updated_rule['conditions'], str):
            try:
                updated_rule['conditions'] = json.loads(updated_rule['conditions'])
            except (json.JSONDecodeError, TypeError):
                updated_rule['conditions'] = {}
        
        # Handle DateTime conversion
        if 'created_at' in updated_rule and updated_rule['created_at']:
            created_at = updated_rule['created_at']
            if hasattr(created_at, 'isoformat'):
                updated_rule['created_at'] = created_at.isoformat()
            elif hasattr(created_at, 'to_native'):
                updated_rule['created_at'] = created_at.to_native().isoformat()
        
        # Update camera relationships if provided
        if "camera_ids" in rule_data:
            # Remove old relationships
            await neo4j_client.async_execute_query(
                "MATCH (r:AnomalyRule {id: $rule_id})-[rel:APPLIES_TO]->() DELETE rel",
                {"rule_id": rule_id}
            )
            
            # Create new relationships
            if rule_data["camera_ids"]:
                link_query = """
                MATCH (r:AnomalyRule {id: $rule_id})
                UNWIND $camera_ids as cam_id
                MATCH (c:Camera {id: cam_id})
                MERGE (r)-[:APPLIES_TO]->(c)
                """
                await neo4j_client.async_execute_query(link_query, {
                    "rule_id": rule_id,
                    "camera_ids": rule_data["camera_ids"]
                })
        
        logger.info(f"✅ Updated anomaly rule: {rule_id}")
        
        return {
            "success": True,
            "rule_id": rule_id,
            "rule": updated_rule
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error updating rule: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/rules/{rule_id}")
async def delete_anomaly_rule(rule_id: str):
    """Delete anomaly rule"""
    try:
        logger.info(f"🗑️  Deleting anomaly rule: {rule_id}")
        
        # Check if rule exists
        check_query = """
        MATCH (r:AnomalyRule {id: $rule_id})
        RETURN r.name as name
        """
        check_result = await neo4j_client.async_execute_query(check_query, {"rule_id": rule_id})
        
        if not check_result:
            raise HTTPException(status_code=404, detail="Anomaly rule not found")
        
        rule_name = check_result[0]["name"]
        
        # Delete rule and relationships
        delete_query = """
        MATCH (r:AnomalyRule {id: $rule_id})
        DETACH DELETE r
        """
        await neo4j_client.async_execute_query(delete_query, {"rule_id": rule_id})
        
        logger.info(f"✅ Deleted anomaly rule: {rule_id}")
        
        return {
            "success": True,
            "message": "Anomaly rule deleted successfully",
            "rule_id": rule_id,
            "rule_name": rule_name
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error deleting rule: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ==================== ANOMALY DETECTIONS (Tab 2: History) ====================

@router.get("/detections", response_model=Dict[str, Any])
async def get_anomaly_detections(
    camera_id: Optional[str] = Query(None, description="Filter by camera"),
    severity: Optional[str] = Query(None, description="Filter by severity"),
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """
    Get anomaly detections with filters
    
    Args:
        camera_id: Optional camera filter
        severity: Optional severity filter (low, medium, high, critical)
        status: Optional status filter (new, acknowledged, resolved)
        limit: Max results
        offset: Pagination offset
    """
    try:
        logger.info(f"📋 Fetching anomaly detections")
        
        # Build query with filters
        where_clauses = []
        params = {"limit": limit, "offset": offset}
        
        if camera_id:
            where_clauses.append("c.id = $camera_id")
            params["camera_id"] = camera_id
        
        if severity:
            where_clauses.append("a.severity = $severity")
            params["severity"] = severity
        
        if status:
            where_clauses.append("a.status = $status")
            params["status"] = status
        
        where_clause = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""
        
        query = f"""
        MATCH (c:Camera)-[:CAPTURED]->(e:Event)-[:TRIGGERED]->(a:Anomaly)
        OPTIONAL MATCH (a)-[:MATCHED_RULE]->(r:AnomalyRule)
        {where_clause}
        RETURN 
            a.id as id,
            a.type as type,
            a.severity as severity,
            a.confidence as confidence,
            a.detected_at as detected_at,
            a.status as status,
            a.description as description,
            c.id as camera_id,
            c.name as camera_name,
            c.location as camera_location,
            e.id as event_id,
            e.caption as event_caption,
            r.id as rule_id,
            r.name as rule_name
        ORDER BY a.detected_at DESC
        SKIP $offset
        LIMIT $limit
        """
        
        results = await neo4j_client.async_execute_query(query, params)
        
        detections = []
        for record in results:
            detected_at = record.get('detected_at')
            if detected_at and hasattr(detected_at, 'isoformat'):
                detected_at = detected_at.isoformat()
            elif detected_at and hasattr(detected_at, 'to_native'):
                detected_at = detected_at.to_native().isoformat()
            
            detection = {
                "id": record.get('id'),
                "type": record.get('type'),
                "severity": record.get('severity'),
                "confidence": record.get('confidence'),
                "detected_at": detected_at,
                "status": record.get('status'),
                "description": record.get('description'),
                "camera": {
                    "id": record.get('camera_id'),
                    "name": record.get('camera_name'),
                    "location": record.get('camera_location')
                },
                "event": {
                    "id": record.get('event_id'),
                    "caption": record.get('event_caption')
                },
                "rule": {
                    "id": record.get('rule_id'),
                    "name": record.get('rule_name')
                } if record.get('rule_id') else None
            }
            detections.append(detection)
        
        logger.info(f"✅ Retrieved {len(detections)} anomaly detections")
        
        return {
            "success": True,
            "count": len(detections),
            "detections": detections,
            "filters": {
                "camera_id": camera_id,
                "severity": severity,
                "status": status
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Error fetching detections: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/detections/{detection_id}", response_model=Dict[str, Any])
async def get_anomaly_detection_detail(detection_id: str):
    """Get detailed information about a specific anomaly detection"""
    try:
        logger.info(f"📋 Fetching anomaly detection: {detection_id}")
        
        query = """
        MATCH (c:Camera)-[:CAPTURED]->(e:Event)-[:TRIGGERED]->(a:Anomaly {id: $detection_id})
        OPTIONAL MATCH (a)-[:MATCHED_RULE]->(r:AnomalyRule)
        OPTIONAL MATCH (a)-[:GENERATED_ALERT]->(alert:Alert)
        RETURN 
            a,
            c.id as camera_id,
            c.name as camera_name,
            c.location as camera_location,
            e.id as event_id,
            e.caption as event_caption,
            e.timestamp as event_timestamp,
            e.video_reference as video_reference,
            r.id as rule_id,
            r.name as rule_name,
            r.description as rule_description,
            collect(alert.id) as alert_ids
        """
        
        results = await neo4j_client.async_execute_query(query, {"detection_id": detection_id})
        
        if not results:
            raise HTTPException(status_code=404, detail="Anomaly detection not found")
        
        record = results[0]
        anomaly_data = dict(record['a'])
        
        # Handle DateTime
        if 'detected_at' in anomaly_data and anomaly_data['detected_at']:
            detected_at = anomaly_data['detected_at']
            if hasattr(detected_at, 'isoformat'):
                anomaly_data['detected_at'] = detected_at.isoformat()
            elif hasattr(detected_at, 'to_native'):
                anomaly_data['detected_at'] = detected_at.to_native().isoformat()
        
        event_timestamp = record.get('event_timestamp')
        if event_timestamp and hasattr(event_timestamp, 'isoformat'):
            event_timestamp = event_timestamp.isoformat()
        elif event_timestamp and hasattr(event_timestamp, 'to_native'):
            event_timestamp = event_timestamp.to_native().isoformat()
        
        detection = {
            **anomaly_data,
            "camera": {
                "id": record.get('camera_id'),
                "name": record.get('camera_name'),
                "location": record.get('camera_location')
            },
            "event": {
                "id": record.get('event_id'),
                "caption": record.get('event_caption'),
                "timestamp": event_timestamp,
                "video_reference": record.get('video_reference')
            },
            "rule": {
                "id": record.get('rule_id'),
                "name": record.get('rule_name'),
                "description": record.get('rule_description')
            } if record.get('rule_id') else None,
            "alerts_sent": [alert_id for alert_id in record.get('alert_ids', []) if alert_id]
        }
        
        return {
            "success": True,
            "detection": detection
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching detection detail: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/detections/{detection_id}/status")
async def update_anomaly_status(detection_id: str, status_data: Dict[str, str]):
    """
    Update anomaly detection status
    
    Expected payload: {"status": "acknowledged" | "resolved" | "new"}
    """
    try:
        logger.info(f"📝 Updating anomaly status: {detection_id}")
        
        new_status = status_data.get("status")
        if new_status not in ["new", "acknowledged", "resolved"]:
            raise HTTPException(status_code=400, detail="Invalid status")
        
        query = """
        MATCH (a:Anomaly {id: $detection_id})
        SET a.status = $status, a.updated_at = datetime()
        RETURN a
        """
        
        result = await neo4j_client.async_execute_query(query, {
            "detection_id": detection_id,
            "status": new_status
        })
        
        if not result:
            raise HTTPException(status_code=404, detail="Anomaly detection not found")
        
        logger.info(f"✅ Updated anomaly status to: {new_status}")
        
        return {
            "success": True,
            "detection_id": detection_id,
            "status": new_status
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error updating status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ==================== STATISTICS ====================

@router.get("/statistics", response_model=Dict[str, Any])
async def get_anomaly_statistics(
    days: int = Query(7, ge=1, le=90)
):
    """Get anomaly statistics for dashboard"""
    try:
        logger.info(f"📊 Fetching anomaly statistics (last {days} days)")
        
        start_time = datetime.now() - timedelta(days=days)
        
        query = """
        MATCH (a:Anomaly)
        WHERE a.detected_at >= datetime($start_time)
        WITH a
        RETURN 
            count(a) as total_anomalies,
            sum(CASE WHEN a.severity = 'critical' THEN 1 ELSE 0 END) as critical_count,
            sum(CASE WHEN a.severity = 'high' THEN 1 ELSE 0 END) as high_count,
            sum(CASE WHEN a.severity = 'medium' THEN 1 ELSE 0 END) as medium_count,
            sum(CASE WHEN a.severity = 'low' THEN 1 ELSE 0 END) as low_count,
            sum(CASE WHEN a.status = 'new' THEN 1 ELSE 0 END) as new_count,
            sum(CASE WHEN a.status = 'acknowledged' THEN 1 ELSE 0 END) as acknowledged_count,
            sum(CASE WHEN a.status = 'resolved' THEN 1 ELSE 0 END) as resolved_count
        """
        
        results = await neo4j_client.async_execute_query(query, {
            "start_time": start_time.isoformat()
        })
        
        if results:
            stats = results[0]
            return {
                "success": True,
                "period_days": days,
                "statistics": {
                    "total": stats.get('total_anomalies', 0),
                    "by_severity": {
                        "critical": stats.get('critical_count', 0),
                        "high": stats.get('high_count', 0),
                        "medium": stats.get('medium_count', 0),
                        "low": stats.get('low_count', 0)
                    },
                    "by_status": {
                        "new": stats.get('new_count', 0),
                        "acknowledged": stats.get('acknowledged_count', 0),
                        "resolved": stats.get('resolved_count', 0)
                    }
                }
            }
        
        return {
            "success": True,
            "period_days": days,
            "statistics": {
                "total": 0,
                "by_severity": {"critical": 0, "high": 0, "medium": 0, "low": 0},
                "by_status": {"new": 0, "acknowledged": 0, "resolved": 0}
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Error fetching statistics: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))