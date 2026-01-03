# FILE LOCATION: backend/app/api/v1/endpoints/anomaly_notifications.py

"""
Anomaly Notification Triggers API
Manages how and when anomaly alerts are delivered (Email, WhatsApp, SMS, Push)
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime
import uuid
import json

from app.db.neo4j.client import neo4j_client
from app.services.notification_service import notification_service

router = APIRouter()
logger = logging.getLogger(__name__)


# ==================== NOTIFICATION CHANNELS (Tab 3: Triggers) ====================

@router.get("/channels", response_model=Dict[str, Any])
async def get_notification_channels():
    """
    Get all configured notification channels
    
    Returns:
        List of notification channels with their status
    """
    try:
        logger.info("📋 Fetching notification channels")
        
        query = """
        MATCH (nc:NotificationChannel)
        RETURN nc
        ORDER BY nc.channel_type, nc.name
        """
        
        results = await neo4j_client.async_execute_query(query)
        
        channels = []
        for record in results:
            channel_data = dict(record['nc'])
            # Deserialize JSON string properties
            for json_field in ["config", "filters", "rate_limiting"]:
                if json_field in channel_data and isinstance(channel_data[json_field], str):
                    try:
                        channel_data[json_field] = json.loads(channel_data[json_field])
                    except Exception:
                        channel_data[json_field] = {}
            
            # Handle DateTime
            if 'created_at' in channel_data and channel_data['created_at']:
                created_at = channel_data['created_at']
                if hasattr(created_at, 'isoformat'):
                    channel_data['created_at'] = created_at.isoformat()
                elif hasattr(created_at, 'to_native'):
                    channel_data['created_at'] = created_at.to_native().isoformat()
            
            channels.append(channel_data)
        
        logger.info(f"✅ Retrieved {len(channels)} notification channels")
        
        return {
            "success": True,
            "count": len(channels),
            "channels": channels
        }
        
    except Exception as e:
        logger.error(f"❌ Error fetching channels: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/channels", response_model=Dict[str, Any])
async def create_notification_channel(channel_data: Dict[str, Any]):
    """
    Create new notification channel
    
    Expected payload:
    {
        "name": "Critical Alerts Email",
        "channel_type": "email",  // email, sms, whatsapp, push, webhook
        "enabled": true,
        "config": {
            "recipients": ["admin@company.com", "security@company.com"],
            "subject_template": "🚨 Critical Anomaly Detected",
            "include_video": true
        },
        "filters": {
            "min_severity": "high",  // low, medium, high, critical
            "anomaly_types": ["unauthorized_entry", "loitering"],
            "camera_ids": ["cam_001", "cam_003"],
            "time_restrictions": {
                "start": "18:00",
                "end": "06:00"
            }
        },
        "rate_limiting": {
            "enabled": true,
            "max_per_hour": 10,
            "cooldown_minutes": 5
        }
    }
    """
    try:
        logger.info(f"📝 Creating notification channel: {channel_data.get('name')}")
        
        channel_id = f"nc_{uuid.uuid4().hex[:8]}"
        
        # Validate channel type
        valid_types = ["email", "sms", "whatsapp", "push", "webhook"]
        channel_type = channel_data.get("channel_type")
        if channel_type not in valid_types:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid channel_type. Must be one of: {', '.join(valid_types)}"
            )
        
        # Create channel node
        query = """
        CREATE (nc:NotificationChannel {
            id: $channel_id,
            name: $name,
            channel_type: $channel_type,
            enabled: $enabled,
            config: $config_json,
            filters: $filters_json,
            rate_limiting: $rate_limiting_json,
            created_at: datetime(),
            alerts_sent: 0,
            last_sent: null
        })
        RETURN nc
        """
        
        # Serialize map-like fields to JSON strings (Neo4j prop values cannot be nested maps)
        config_json = json.dumps(channel_data.get("config", {}))
        filters_json = json.dumps(channel_data.get("filters", {}))
        rate_limiting_json = json.dumps(channel_data.get("rate_limiting", {
            "enabled": False,
            "max_per_hour": 100,
            "cooldown_minutes": 0
        }))

        params = {
            "channel_id": channel_id,
            "name": channel_data.get("name"),
            "channel_type": channel_type,
            "enabled": channel_data.get("enabled", True),
            "config_json": config_json,
            "filters_json": filters_json,
            "rate_limiting_json": rate_limiting_json
        }
        
        result = await neo4j_client.async_execute_query(query, params)
        
        if not result:
            raise HTTPException(status_code=500, detail="Failed to create channel")
        
        created_channel = dict(result[0]['nc'])
        # Deserialize stored JSON strings
        for json_field in ["config", "filters", "rate_limiting"]:
            if json_field in created_channel and isinstance(created_channel[json_field], str):
                try:
                    created_channel[json_field] = json.loads(created_channel[json_field])
                except Exception:
                    created_channel[json_field] = {}
        if 'created_at' in created_channel and created_channel['created_at']:
            created_at = created_channel['created_at']
            if hasattr(created_at, 'isoformat'):
                created_channel['created_at'] = created_at.isoformat()
        
        logger.info(f"✅ Created notification channel: {channel_id}")
        
        return {
            "success": True,
            "channel_id": channel_id,
            "channel": created_channel
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error creating channel: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/channels/{channel_id}", response_model=Dict[str, Any])
async def get_notification_channel(channel_id: str):
    """Get single notification channel by ID"""
    try:
        logger.info(f"📋 Fetching notification channel: {channel_id}")
        
        query = """
        MATCH (nc:NotificationChannel {id: $channel_id})
        RETURN nc
        """
        
        results = await neo4j_client.async_execute_query(query, {"channel_id": channel_id})
        
        if not results:
            raise HTTPException(status_code=404, detail="Notification channel not found")
        
        channel_data = dict(results[0]['nc'])
        # Deserialize JSON strings
        for json_field in ["config", "filters", "rate_limiting"]:
            if json_field in channel_data and isinstance(channel_data[json_field], str):
                try:
                    channel_data[json_field] = json.loads(channel_data[json_field])
                except Exception:
                    channel_data[json_field] = {}
        
        # Handle DateTime
        for field in ['created_at', 'last_sent']:
            if field in channel_data and channel_data[field]:
                dt = channel_data[field]
                if hasattr(dt, 'isoformat'):
                    channel_data[field] = dt.isoformat()
                elif hasattr(dt, 'to_native'):
                    channel_data[field] = dt.to_native().isoformat()
        
        return {
            "success": True,
            "channel": channel_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching channel: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/channels/{channel_id}", response_model=Dict[str, Any])
async def update_notification_channel(channel_id: str, channel_data: Dict[str, Any]):
    """Update existing notification channel"""
    try:
        logger.info(f"📝 Updating notification channel: {channel_id}")
        
        # Check if exists
        check_query = """
        MATCH (nc:NotificationChannel {id: $channel_id})
        RETURN nc
        """
        check_result = await neo4j_client.async_execute_query(check_query, {"channel_id": channel_id})
        
        if not check_result:
            raise HTTPException(status_code=404, detail="Notification channel not found")
        
        # Build update query
        update_fields = []
        params = {"channel_id": channel_id}
        
        if "name" in channel_data:
            update_fields.append("nc.name = $name")
            params["name"] = channel_data["name"]
        
        if "enabled" in channel_data:
            update_fields.append("nc.enabled = $enabled")
            params["enabled"] = channel_data["enabled"]
        
        if "config" in channel_data:
            update_fields.append("nc.config = $config_json")
            params["config_json"] = json.dumps(channel_data["config"] or {})
        
        if "filters" in channel_data:
            update_fields.append("nc.filters = $filters_json")
            params["filters_json"] = json.dumps(channel_data["filters"] or {})
        
        if "rate_limiting" in channel_data:
            update_fields.append("nc.rate_limiting = $rate_limiting_json")
            params["rate_limiting_json"] = json.dumps(channel_data["rate_limiting"] or {})
        
        if update_fields:
            query = f"""
            MATCH (nc:NotificationChannel {{id: $channel_id}})
            SET {', '.join(update_fields)}, nc.updated_at = datetime()
            RETURN nc
            """
            result = await neo4j_client.async_execute_query(query, params)
        updated_channel = dict(result[0]['nc'])
        # Deserialize JSON strings
        for json_field in ["config", "filters", "rate_limiting"]:
            if json_field in updated_channel and isinstance(updated_channel[json_field], str):
                try:
                    updated_channel[json_field] = json.loads(updated_channel[json_field])
                except Exception:
                    updated_channel[json_field] = {}
        else:
            updated_channel = dict(check_result[0]['nc'])
        
        logger.info(f"✅ Updated notification channel: {channel_id}")
        
        return {
            "success": True,
            "channel_id": channel_id,
            "channel": updated_channel
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error updating channel: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/channels/{channel_id}")
async def delete_notification_channel(channel_id: str):
    """Delete notification channel"""
    try:
        logger.info(f"🗑️  Deleting notification channel: {channel_id}")
        
        # Check if exists
        check_query = """
        MATCH (nc:NotificationChannel {id: $channel_id})
        RETURN nc.name as name
        """
        check_result = await neo4j_client.async_execute_query(check_query, {"channel_id": channel_id})
        
        if not check_result:
            raise HTTPException(status_code=404, detail="Notification channel not found")
        
        channel_name = check_result[0]["name"]
        
        # Delete
        delete_query = """
        MATCH (nc:NotificationChannel {id: $channel_id})
        DETACH DELETE nc
        """
        await neo4j_client.async_execute_query(delete_query, {"channel_id": channel_id})
        
        logger.info(f"✅ Deleted notification channel: {channel_id}")
        
        return {
            "success": True,
            "message": "Notification channel deleted successfully",
            "channel_id": channel_id,
            "channel_name": channel_name
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error deleting channel: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/channels/{channel_id}/test")
async def test_notification_channel(channel_id: str):
    """
    Send a test notification through this channel
    
    Returns status of test notification
    """
    try:
        logger.info(f"🧪 Testing notification channel: {channel_id}")
        
        # Get channel
        query = """
        MATCH (nc:NotificationChannel {id: $channel_id})
        RETURN nc
        """
        results = await neo4j_client.async_execute_query(query, {"channel_id": channel_id})
        
        if not results:
            raise HTTPException(status_code=404, detail="Notification channel not found")
        
        channel = dict(results[0]['nc'])
        # Deserialize JSON string properties
        for json_field in ["config", "filters", "rate_limiting"]:
            if json_field in channel and isinstance(channel[json_field], str):
                try:
                    channel[json_field] = json.loads(channel[json_field])
                except Exception:
                    channel[json_field] = {}
        
        if not channel.get('enabled'):
            raise HTTPException(status_code=400, detail="Channel is disabled")
        
        # Attempt to actually send a test message for SMS channels
        test_result = {
            "channel_type": channel.get('channel_type'),
            "status": "prepared",
            "message": "",
            "timestamp": datetime.now().isoformat()
        }

        try:
            if channel.get('channel_type') == 'sms':
                # Deliver a test SMS to configured numbers
                dummy_anomaly = {
                    "severity": "medium",
                    "rule_name": "Test Notification",
                    "rule_type": "test",
                    "camera_id": "test_camera",
                    "caption": "This is a test alert from CCTView.",
                    "timestamp": datetime.now().isoformat()
                }
                await notification_service._send_sms_via_twilio(
                    config=channel.get('config', {}),
                    anomaly=dummy_anomaly,
                    camera_name="Test Camera",
                    camera_location="Dashboard",
                )
                test_result["status"] = "sent"
                test_result["message"] = "Test SMS attempted via Twilio"
            else:
                test_result["status"] = "skipped"
                test_result["message"] = "Test sending implemented only for SMS for now"
        except Exception as send_err:
            test_result["status"] = "error"
            test_result["message"] = str(send_err)
        
        logger.info(f"✅ Test notification sent for channel: {channel_id}")
        
        return {
            "success": True,
            "test_result": test_result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error testing channel: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ==================== NOTIFICATION TEMPLATES ====================

@router.get("/templates", response_model=Dict[str, Any])
async def get_notification_templates():
    """
    Get predefined notification templates
    
    Returns templates for different channels and severity levels
    """
    try:
        logger.info("📋 Fetching notification templates")
        
        # Predefined templates
        templates = {
            "email": {
                "critical": {
                    "subject": "🚨 CRITICAL ANOMALY DETECTED - Immediate Action Required",
                    "body": """
CRITICAL SECURITY ALERT

A critical anomaly has been detected requiring immediate attention.

Anomaly: {anomaly_type}
Severity: CRITICAL
Location: {camera_name} ({camera_location})
Time: {detected_at}
Confidence: {confidence}%

Description:
{description}

Event Details:
{event_caption}

This is an automated alert from CCTView AI Surveillance System.
Please review the footage and take appropriate action.
                    """,
                    "include_video": True,
                    "priority": "high"
                },
                "high": {
                    "subject": "⚠️ High Priority Anomaly - {anomaly_type}",
                    "body": """
High Priority Security Alert

Anomaly Type: {anomaly_type}
Severity: HIGH
Camera: {camera_name}
Location: {camera_location}
Detected: {detected_at}

Description: {description}

Please review and acknowledge this alert.
                    """,
                    "include_video": True,
                    "priority": "normal"
                },
                "medium": {
                    "subject": "ℹ️ Anomaly Detected - {anomaly_type}",
                    "body": """
Anomaly Detection Report

Type: {anomaly_type}
Severity: MEDIUM
Camera: {camera_name}
Time: {detected_at}

Description: {description}

Review when convenient.
                    """,
                    "include_video": False,
                    "priority": "normal"
                }
            },
            "sms": {
                "critical": "🚨 CRITICAL: {anomaly_type} at {camera_name} - {detected_at}. Check CCTView immediately!",
                "high": "⚠️ HIGH: {anomaly_type} detected at {camera_name} - {detected_at}",
                "medium": "ℹ️ Anomaly at {camera_name}: {anomaly_type}"
            },
            "whatsapp": {
                "critical": """🚨 *CRITICAL ANOMALY*

*Type:* {anomaly_type}
*Location:* {camera_name}
*Time:* {detected_at}
*Confidence:* {confidence}%

_{description}_

Immediate action required!""",
                "high": """⚠️ *HIGH PRIORITY ANOMALY*

*Type:* {anomaly_type}
*Camera:* {camera_name}
*Detected:* {detected_at}

{description}""",
                "medium": """ℹ️ Anomaly Detected

Type: {anomaly_type}
Camera: {camera_name}
Time: {detected_at}"""
            },
            "push": {
                "critical": {
                    "title": "🚨 Critical Anomaly",
                    "body": "{anomaly_type} at {camera_name}",
                    "priority": "high",
                    "sound": "critical_alert.mp3"
                },
                "high": {
                    "title": "⚠️ High Priority Anomaly",
                    "body": "{anomaly_type} detected at {camera_name}",
                    "priority": "high",
                    "sound": "default"
                },
                "medium": {
                    "title": "ℹ️ Anomaly Detected",
                    "body": "{anomaly_type} at {camera_name}",
                    "priority": "normal",
                    "sound": "default"
                }
            }
        }
        
        return {
            "success": True,
            "templates": templates
        }
        
    except Exception as e:
        logger.error(f"❌ Error fetching templates: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ==================== DELIVERY HISTORY ====================

@router.get("/delivery-history", response_model=Dict[str, Any])
async def get_delivery_history(
    channel_id: Optional[str] = Query(None, description="Filter by channel"),
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=100)
):
    """
    Get notification delivery history
    
    Args:
        channel_id: Optional channel filter
        status: Optional status filter (sent, delivered, failed)
        limit: Max results
    """
    try:
        logger.info("📋 Fetching delivery history")
        
        where_clauses = []
        params = {"limit": limit}
        
        if channel_id:
            where_clauses.append("nc.id = $channel_id")
            params["channel_id"] = channel_id
        
        if status:
            where_clauses.append("alert.status = $status")
            params["status"] = status
        
        where_clause = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""
        
        query = f"""
        MATCH (a:Anomaly)-[:GENERATED_ALERT]->(alert:Alert)
        MATCH (alert)-[:SENT_VIA]->(nc:NotificationChannel)
        {where_clause}
        RETURN 
            alert.id as id,
            alert.status as status,
            alert.sent_at as sent_at,
            alert.delivered_at as delivered_at,
            alert.error_message as error_message,
            a.id as anomaly_id,
            a.type as anomaly_type,
            a.severity as severity,
            nc.id as channel_id,
            nc.name as channel_name,
            nc.channel_type as channel_type
        ORDER BY alert.sent_at DESC
        LIMIT $limit
        """
        
        results = await neo4j_client.async_execute_query(query, params)
        
        history = []
        for record in results:
            sent_at = record.get('sent_at')
            delivered_at = record.get('delivered_at')
            
            if sent_at and hasattr(sent_at, 'isoformat'):
                sent_at = sent_at.isoformat()
            elif sent_at and hasattr(sent_at, 'to_native'):
                sent_at = sent_at.to_native().isoformat()
            
            if delivered_at and hasattr(delivered_at, 'isoformat'):
                delivered_at = delivered_at.isoformat()
            elif delivered_at and hasattr(delivered_at, 'to_native'):
                delivered_at = delivered_at.to_native().isoformat()
            
            history.append({
                "id": record.get('id'),
                "status": record.get('status'),
                "sent_at": sent_at,
                "delivered_at": delivered_at,
                "error_message": record.get('error_message'),
                "anomaly": {
                    "id": record.get('anomaly_id'),
                    "type": record.get('anomaly_type'),
                    "severity": record.get('severity')
                },
                "channel": {
                    "id": record.get('channel_id'),
                    "name": record.get('channel_name'),
                    "type": record.get('channel_type')
                }
            })
        
        logger.info(f"✅ Retrieved {len(history)} delivery records")
        
        return {
            "success": True,
            "count": len(history),
            "history": history
        }
        
    except Exception as e:
        logger.error(f"❌ Error fetching delivery history: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ==================== STATISTICS ====================

@router.get("/statistics", response_model=Dict[str, Any])
async def get_notification_statistics():
    """Get notification delivery statistics"""
    try:
        logger.info("📊 Fetching notification statistics")
        
        query = """
        MATCH (nc:NotificationChannel)
        OPTIONAL MATCH (nc)<-[:SENT_VIA]-(alert:Alert)
        WITH nc, alert
        RETURN 
            nc.id as channel_id,
            nc.name as channel_name,
            nc.channel_type as channel_type,
            nc.enabled as enabled,
            count(alert) as total_sent,
            sum(CASE WHEN alert.status = 'delivered' THEN 1 ELSE 0 END) as delivered,
            sum(CASE WHEN alert.status = 'failed' THEN 1 ELSE 0 END) as failed
        """
        
        results = await neo4j_client.async_execute_query(query)
        
        channel_stats = []
        for record in results:
            channel_stats.append({
                "channel_id": record.get('channel_id'),
                "channel_name": record.get('channel_name'),
                "channel_type": record.get('channel_type'),
                "enabled": record.get('enabled'),
                "total_sent": record.get('total_sent', 0),
                "delivered": record.get('delivered', 0),
                "failed": record.get('failed', 0),
                "success_rate": round(
                    (record.get('delivered', 0) / record.get('total_sent', 1)) * 100, 2
                ) if record.get('total_sent', 0) > 0 else 0
            })
        
        return {
            "success": True,
            "channel_statistics": channel_stats,
            "summary": {
                "total_channels": len(channel_stats),
                "enabled_channels": sum(1 for c in channel_stats if c['enabled']),
                "total_notifications_sent": sum(c['total_sent'] for c in channel_stats)
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Error fetching statistics: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))