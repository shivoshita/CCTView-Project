# FILE LOCATION: backend/app/api/v1/endpoints/events.py

"""
Events API Endpoints
Handles event retrieval, search, and statistics from Neo4j
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime, timedelta

from app.db.neo4j.client import neo4j_client
from app.models.event import (
    EventResponse,
    EventListResponse,
    EventSearchRequest
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/", response_model=Dict[str, Any])
async def get_events(
    camera_id: Optional[str] = Query(None, description="Filter by camera ID"),
    limit: int = Query(10, ge=1, le=100, description="Number of events to return"),
    offset: int = Query(0, ge=0, description="Pagination offset")
):
    """
    Get events with optional camera filter
    
    Args:
        camera_id: Optional camera ID to filter events
        limit: Maximum number of events (1-100)
        offset: Pagination offset
    
    Returns:
        Dict with events list and metadata
    """
    try:
        logger.info(f"📋 Fetching events: camera_id={camera_id}, limit={limit}, offset={offset}")
        
        if camera_id:
            # Get events for specific camera
            query = """
            MATCH (c:Camera {id: $camera_id})-[:CAPTURED]->(e:Event)
            RETURN 
                e.id as id,
                e.timestamp as timestamp,
                e.start_time as start_time,
                e.end_time as end_time,
                e.caption as caption,
                e.confidence as confidence,
                e.duration as duration,
                e.frame_count as frame_count,
                e.retention_until as retention_until,
                e.video_reference as video_reference,
                c.id as camera_id,
                c.name as camera_name,
                c.location as camera_location
            ORDER BY e.timestamp DESC
            SKIP $offset
            LIMIT $limit
            """
            params = {
                "camera_id": camera_id,
                "limit": limit,
                "offset": offset
            }
        else:
            # Get events from all cameras
            query = """
            MATCH (c:Camera)-[:CAPTURED]->(e:Event)
            RETURN 
                e.id as id,
                e.timestamp as timestamp,
                e.start_time as start_time,
                e.end_time as end_time,
                e.caption as caption,
                e.confidence as confidence,
                e.duration as duration,
                e.frame_count as frame_count,
                e.retention_until as retention_until,
                e.video_reference as video_reference,
                c.id as camera_id,
                c.name as camera_name,
                c.location as camera_location
            ORDER BY e.timestamp DESC
            SKIP $offset
            LIMIT $limit
            """
            params = {
                "limit": limit,
                "offset": offset
            }
        
        # Execute query
        results = await neo4j_client.async_execute_query(query, params)
        
        # Format events
        events = []
        for record in results:
            # Handle Neo4j DateTime objects
            timestamp = record.get('timestamp')
            start_time = record.get('start_time')
            end_time = record.get('end_time')
            retention_until = record.get('retention_until')
            
            # Convert to ISO format if needed
            if timestamp and hasattr(timestamp, 'isoformat'):
                timestamp = timestamp.isoformat()
            elif timestamp and hasattr(timestamp, 'to_native'):
                timestamp = timestamp.to_native().isoformat()
            
            if start_time and hasattr(start_time, 'isoformat'):
                start_time = start_time.isoformat()
            elif start_time and hasattr(start_time, 'to_native'):
                start_time = start_time.to_native().isoformat()
            
            if end_time and hasattr(end_time, 'isoformat'):
                end_time = end_time.isoformat()
            elif end_time and hasattr(end_time, 'to_native'):
                end_time = end_time.to_native().isoformat()
            
            if retention_until and hasattr(retention_until, 'isoformat'):
                retention_until = retention_until.isoformat()
            elif retention_until and hasattr(retention_until, 'to_native'):
                retention_until = retention_until.to_native().isoformat()
            
            event = {
                "id": record.get('id'),
                "timestamp": timestamp,
                "start_time": start_time,
                "end_time": end_time,
                "caption": record.get('caption'),
                "confidence": record.get('confidence', 0.0),
                "duration": record.get('duration'),
                "frame_count": record.get('frame_count'),
                "retention_until": retention_until,
                "video_reference": record.get('video_reference'),
                "camera_id": record.get('camera_id'),
                "camera_name": record.get('camera_name'),
                "camera_location": record.get('camera_location')
            }
            events.append(event)
        
        logger.info(f"✅ Retrieved {len(events)} events")
        
        return {
            "success": True,
            "count": len(events),
            "events": events,
            "camera_id": camera_id,
            "limit": limit,
            "offset": offset
        }
        
    except Exception as e:
        logger.error(f"❌ Error fetching events: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{event_id}", response_model=Dict[str, Any])
async def get_event_detail(event_id: str):
    """
    Get detailed information for a specific event
    
    Args:
        event_id: Event identifier
    
    Returns:
        Event details with camera info
    """
    try:
        logger.info(f"📋 Fetching event detail: {event_id}")
        
        query = """
        MATCH (c:Camera)-[:CAPTURED]->(e:Event {id: $event_id})
        OPTIONAL MATCH (e)-[:SHOWS]->(p:TrackedPerson)
        OPTIONAL MATCH (e)-[:TRIGGERED]->(a:Anomaly)
        RETURN 
            e.id as id,
            e.timestamp as timestamp,
            e.start_time as start_time,
            e.end_time as end_time,
            e.caption as caption,
            e.confidence as confidence,
            e.duration as duration,
            e.frame_count as frame_count,
            e.retention_until as retention_until,
            e.video_reference as video_reference,
            c.id as camera_id,
            c.name as camera_name,
            c.location as camera_location,
            collect(DISTINCT p.id) as tracked_persons,
            collect(DISTINCT a.id) as anomalies
        """
        
        results = await neo4j_client.async_execute_query(query, {"event_id": event_id})
        
        if not results:
            raise HTTPException(status_code=404, detail="Event not found")
        
        record = results[0]
        
        # Handle DateTime conversions
        timestamp = record.get('timestamp')
        start_time = record.get('start_time')
        end_time = record.get('end_time')
        retention_until = record.get('retention_until')
        
        if timestamp and hasattr(timestamp, 'isoformat'):
            timestamp = timestamp.isoformat()
        elif timestamp and hasattr(timestamp, 'to_native'):
            timestamp = timestamp.to_native().isoformat()
        
        if start_time and hasattr(start_time, 'isoformat'):
            start_time = start_time.isoformat()
        elif start_time and hasattr(start_time, 'to_native'):
            start_time = start_time.to_native().isoformat()
        
        if end_time and hasattr(end_time, 'isoformat'):
            end_time = end_time.isoformat()
        elif end_time and hasattr(end_time, 'to_native'):
            end_time = end_time.to_native().isoformat()
        
        if retention_until and hasattr(retention_until, 'isoformat'):
            retention_until = retention_until.isoformat()
        elif retention_until and hasattr(retention_until, 'to_native'):
            retention_until = retention_until.to_native().isoformat()
        
        event = {
            "id": record.get('id'),
            "timestamp": timestamp,
            "start_time": start_time,
            "end_time": end_time,
            "caption": record.get('caption'),
            "confidence": record.get('confidence', 0.0),
            "duration": record.get('duration'),
            "frame_count": record.get('frame_count'),
            "retention_until": retention_until,
            "video_reference": record.get('video_reference'),
            "camera": {
                "id": record.get('camera_id'),
                "name": record.get('camera_name'),
                "location": record.get('camera_location')
            },
            "tracked_persons": [p for p in record.get('tracked_persons', []) if p],
            "anomalies": [a for a in record.get('anomalies', []) if a]
        }
        
        logger.info(f"✅ Retrieved event detail: {event_id}")
        
        return {
            "success": True,
            "event": event
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching event detail: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/camera/{camera_id}/recent", response_model=Dict[str, Any])
async def get_recent_events_by_camera(
    camera_id: str,
    limit: int = Query(10, ge=1, le=50, description="Number of recent events")
):
    """
    Get most recent events for a specific camera
    
    Args:
        camera_id: Camera identifier
        limit: Number of events to return (1-50)
    
    Returns:
        List of recent events
    """
    try:
        logger.info(f"📋 Fetching recent events for camera: {camera_id}")
        
        query = """
        MATCH (c:Camera {id: $camera_id})-[:CAPTURED]->(e:Event)
        RETURN 
            e.id as id,
            e.timestamp as timestamp,
            e.start_time as start_time,
            e.end_time as end_time,
            e.caption as caption,
            e.confidence as confidence,
            e.duration as duration,
            e.frame_count as frame_count
        ORDER BY e.timestamp DESC
        LIMIT $limit
        """
        
        results = await neo4j_client.async_execute_query(query, {
            "camera_id": camera_id,
            "limit": limit
        })
        
        events = []
        for record in results:
            timestamp = record.get('timestamp')
            start_time = record.get('start_time')
            end_time = record.get('end_time')
            
            if timestamp and hasattr(timestamp, 'isoformat'):
                timestamp = timestamp.isoformat()
            elif timestamp and hasattr(timestamp, 'to_native'):
                timestamp = timestamp.to_native().isoformat()
            
            if start_time and hasattr(start_time, 'isoformat'):
                start_time = start_time.isoformat()
            elif start_time and hasattr(start_time, 'to_native'):
                start_time = start_time.to_native().isoformat()
            
            if end_time and hasattr(end_time, 'isoformat'):
                end_time = end_time.isoformat()
            elif end_time and hasattr(end_time, 'to_native'):
                end_time = end_time.to_native().isoformat()
            
            events.append({
                "id": record.get('id'),
                "timestamp": timestamp,
                "start_time": start_time,
                "end_time": end_time,
                "caption": record.get('caption'),
                "confidence": record.get('confidence', 0.0),
                "duration": record.get('duration'),
                "frame_count": record.get('frame_count')
            })
        
        logger.info(f"✅ Retrieved {len(events)} recent events for {camera_id}")
        
        return {
            "success": True,
            "camera_id": camera_id,
            "count": len(events),
            "events": events
        }
        
    except Exception as e:
        logger.error(f"❌ Error fetching recent events: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/statistics/summary", response_model=Dict[str, Any])
async def get_event_statistics(
    camera_id: Optional[str] = Query(None, description="Filter by camera"),
    days: int = Query(7, ge=1, le=90, description="Number of days to analyze")
):
    """
    Get event statistics
    
    Args:
        camera_id: Optional camera filter
        days: Number of days to analyze (1-90)
    
    Returns:
        Statistics summary
    """
    try:
        logger.info(f"📊 Fetching event statistics: camera_id={camera_id}, days={days}")
        
        start_time = datetime.now() - timedelta(days=days)
        
        if camera_id:
            query = """
            MATCH (c:Camera {id: $camera_id})-[:CAPTURED]->(e:Event)
            WHERE e.timestamp >= datetime($start_time)
            RETURN 
                count(e) as total_events,
                avg(e.confidence) as avg_confidence,
                min(e.timestamp) as first_event,
                max(e.timestamp) as last_event,
                sum(e.frame_count) as total_frames
            """
            params = {
                "camera_id": camera_id,
                "start_time": start_time.isoformat()
            }
        else:
            query = """
            MATCH (c:Camera)-[:CAPTURED]->(e:Event)
            WHERE e.timestamp >= datetime($start_time)
            RETURN 
                count(e) as total_events,
                avg(e.confidence) as avg_confidence,
                min(e.timestamp) as first_event,
                max(e.timestamp) as last_event,
                count(DISTINCT c.id) as active_cameras,
                sum(e.frame_count) as total_frames
            """
            params = {
                "start_time": start_time.isoformat()
            }
        
        results = await neo4j_client.async_execute_query(query, params)
        
        if results:
            stats = results[0]
            
            first_event = stats.get('first_event')
            last_event = stats.get('last_event')
            
            if first_event and hasattr(first_event, 'isoformat'):
                first_event = first_event.isoformat()
            elif first_event and hasattr(first_event, 'to_native'):
                first_event = first_event.to_native().isoformat()
            
            if last_event and hasattr(last_event, 'isoformat'):
                last_event = last_event.isoformat()
            elif last_event and hasattr(last_event, 'to_native'):
                last_event = last_event.to_native().isoformat()
            
            return {
                "success": True,
                "period_days": days,
                "camera_id": camera_id,
                "statistics": {
                    "total_events": stats.get('total_events', 0),
                    "avg_confidence": round(stats.get('avg_confidence', 0.0), 3),
                    "first_event": first_event,
                    "last_event": last_event,
                    "active_cameras": stats.get('active_cameras', 0) if not camera_id else 1,
                    "total_frames": stats.get('total_frames', 0)
                }
            }
        
        return {
            "success": True,
            "period_days": days,
            "camera_id": camera_id,
            "statistics": {
                "total_events": 0,
                "avg_confidence": 0.0,
                "first_event": None,
                "last_event": None,
                "active_cameras": 0,
                "total_frames": 0
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Error fetching statistics: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))