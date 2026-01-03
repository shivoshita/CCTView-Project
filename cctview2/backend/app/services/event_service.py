"""
Event Service
Business logic for event operations
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import logging

from app.db.neo4j.client import neo4j_client
from app.db.redis.client import redis_client

logger = logging.getLogger(__name__)


class EventService:
    """Service for event-related operations"""
    
    async def get_events_by_camera(
        self,
        camera_id: str,
        limit: int = 10,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Get events for a specific camera with full details
        
        Args:
            camera_id: Camera identifier
            limit: Maximum number of events to return
            offset: Pagination offset
            
        Returns:
            List of event dictionaries with complete information
        """
        try:
            query = """
            MATCH (c:Camera {id: $camera_id})-[:CAPTURED]->(e:Event)
            RETURN 
                e.id as id,
                e.timestamp as timestamp,
                e.start_time as start_time,
                e.end_time as end_time,
                e.caption as caption,
                e.confidence as confidence,
                e.video_reference as video_reference,
                e.retention_until as retention_until,
                e.frame_count as frame_count,
                e.duration as duration
            ORDER BY e.timestamp DESC
            SKIP $offset
            LIMIT $limit
            """
            
            result = await neo4j_client.async_execute_query(query, {
                "camera_id": camera_id,
                "limit": limit,
                "offset": offset
            })
            
            events = []
            for record in result:
                # Calculate duration if not stored but start/end times available
                duration = record.get("duration")
                start_time = record.get("start_time")
                end_time = record.get("end_time")
                
                if not duration and start_time and end_time:
                    try:
                        start_dt = datetime.fromisoformat(start_time.replace('Z', '+00:00')) if isinstance(start_time, str) else start_time
                        end_dt = datetime.fromisoformat(end_time.replace('Z', '+00:00')) if isinstance(end_time, str) else end_time
                        duration = (end_dt - start_dt).total_seconds()
                    except:
                        duration = None
                
                event = {
                    "id": record.get("id"),
                    "timestamp": record.get("timestamp"),
                    "start_time": start_time,
                    "end_time": end_time,
                    "caption": record.get("caption"),
                    "confidence": record.get("confidence", 0.0),
                    "video_reference": record.get("video_reference"),
                    "retention_until": record.get("retention_until"),
                    "frame_count": record.get("frame_count"),
                    "duration": duration
                }
                events.append(event)
            
            logger.info(f"Retrieved {len(events)} events for camera {camera_id}")
            return events
            
        except Exception as e:
            logger.error(f"Failed to get events for camera {camera_id}: {e}")
            return []
    
    async def get_events_by_timerange(
        self,
        start_time: datetime,
        end_time: datetime,
        camera_ids: Optional[List[str]] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Get events within a time range with full details
        
        Args:
            start_time: Start of time range
            end_time: End of time range
            camera_ids: Optional list of camera IDs to filter
            limit: Maximum number of events
            
        Returns:
            List of events with camera information and complete data
        """
        try:
            if camera_ids:
                query = """
                MATCH (c:Camera)-[:CAPTURED]->(e:Event)
                WHERE c.id IN $camera_ids
                AND e.timestamp >= datetime($start_time)
                AND e.timestamp <= datetime($end_time)
                RETURN 
                    e.id as id,
                    e.timestamp as timestamp,
                    e.start_time as start_time,
                    e.end_time as end_time,
                    e.caption as caption,
                    e.confidence as confidence,
                    e.video_reference as video_reference,
                    e.frame_count as frame_count,
                    e.duration as duration,
                    c.id as camera_id,
                    c.name as camera_name
                ORDER BY e.timestamp DESC
                LIMIT $limit
                """
                params = {
                    "start_time": start_time.isoformat(),
                    "end_time": end_time.isoformat(),
                    "camera_ids": camera_ids,
                    "limit": limit
                }
            else:
                query = """
                MATCH (c:Camera)-[:CAPTURED]->(e:Event)
                WHERE e.timestamp >= datetime($start_time)
                AND e.timestamp <= datetime($end_time)
                RETURN 
                    e.id as id,
                    e.timestamp as timestamp,
                    e.start_time as start_time,
                    e.end_time as end_time,
                    e.caption as caption,
                    e.confidence as confidence,
                    e.video_reference as video_reference,
                    e.frame_count as frame_count,
                    e.duration as duration,
                    c.id as camera_id,
                    c.name as camera_name
                ORDER BY e.timestamp DESC
                LIMIT $limit
                """
                params = {
                    "start_time": start_time.isoformat(),
                    "end_time": end_time.isoformat(),
                    "limit": limit
                }
            
            result = await neo4j_client.async_execute_query(query, params)
            
            events = []
            for record in result:
                # Calculate duration if not stored but start/end times available
                duration = record.get("duration")
                start_time_val = record.get("start_time")
                end_time_val = record.get("end_time")
                
                if not duration and start_time_val and end_time_val:
                    try:
                        start_dt = datetime.fromisoformat(start_time_val.replace('Z', '+00:00')) if isinstance(start_time_val, str) else start_time_val
                        end_dt = datetime.fromisoformat(end_time_val.replace('Z', '+00:00')) if isinstance(end_time_val, str) else end_time_val
                        duration = (end_dt - start_dt).total_seconds()
                    except:
                        duration = None
                
                event = {
                    "id": record.get("id"),
                    "timestamp": record.get("timestamp"),
                    "start_time": start_time_val,
                    "end_time": end_time_val,
                    "caption": record.get("caption"),
                    "confidence": record.get("confidence", 0.0),
                    "video_reference": record.get("video_reference"),
                    "camera_id": record.get("camera_id"),
                    "camera_name": record.get("camera_name"),
                    "frame_count": record.get("frame_count"),
                    "duration": duration
                }
                events.append(event)
            
            logger.info(f"Retrieved {len(events)} events for time range")
            return events
            
        except Exception as e:
            logger.error(f"Failed to get events by timerange: {e}")
            return []
    
    async def get_event_detail(self, event_id: str) -> Optional[Dict[str, Any]]:
        """
        Get detailed information for a specific event
        
        Args:
            event_id: Event identifier
            
        Returns:
            Event details or None if not found
        """
        try:
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
                e.video_reference as video_reference,
                e.retention_until as retention_until,
                e.frame_count as frame_count,
                e.duration as duration,
                c.id as camera_id,
                c.name as camera_name,
                c.location as camera_location,
                collect(DISTINCT p.id) as tracked_persons,
                collect(DISTINCT a.id) as anomalies
            """
            
            result = await neo4j_client.async_execute_query(query, {
                "event_id": event_id
            })
            
            if not result:
                return None
            
            record = result[0]
            
            # Calculate duration if not stored but start/end times available
            duration = record.get("duration")
            start_time = record.get("start_time")
            end_time = record.get("end_time")
            
            if not duration and start_time and end_time:
                try:
                    start_dt = datetime.fromisoformat(start_time.replace('Z', '+00:00')) if isinstance(start_time, str) else start_time
                    end_dt = datetime.fromisoformat(end_time.replace('Z', '+00:00')) if isinstance(end_time, str) else end_time
                    duration = (end_dt - start_dt).total_seconds()
                except:
                    duration = None
            
            event_detail = {
                "id": record.get("id"),
                "timestamp": record.get("timestamp"),
                "start_time": start_time,
                "end_time": end_time,
                "caption": record.get("caption"),
                "confidence": record.get("confidence", 0.0),
                "video_reference": record.get("video_reference"),
                "retention_until": record.get("retention_until"),
                "frame_count": record.get("frame_count"),
                "duration": duration,
                "camera": {
                    "id": record.get("camera_id"),
                    "name": record.get("camera_name"),
                    "location": record.get("camera_location")
                },
                "tracked_persons": [p for p in record.get("tracked_persons", []) if p],
                "anomalies": [a for a in record.get("anomalies", []) if a]
            }
            
            return event_detail
            
        except Exception as e:
            logger.error(f"Failed to get event detail for {event_id}: {e}")
            return None
    
    async def search_events(
        self,
        query_text: str,
        camera_ids: Optional[List[str]] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Search events by caption text
        
        Args:
            query_text: Search query
            camera_ids: Optional camera filter
            start_time: Optional start time
            end_time: Optional end time
            limit: Maximum results
            
        Returns:
            List of matching events
        """
        try:
            # Build query conditions
            conditions = ["e.caption CONTAINS $query_text"]
            
            if camera_ids:
                conditions.append("c.id IN $camera_ids")
            
            if start_time:
                conditions.append("e.timestamp >= datetime($start_time)")
            
            if end_time:
                conditions.append("e.timestamp <= datetime($end_time)")
            
            where_clause = " AND ".join(conditions)
            
            query = f"""
            MATCH (c:Camera)-[:CAPTURED]->(e:Event)
            WHERE {where_clause}
            RETURN 
                e.id as id,
                e.timestamp as timestamp,
                e.start_time as start_time,
                e.end_time as end_time,
                e.caption as caption,
                e.confidence as confidence,
                e.frame_count as frame_count,
                e.duration as duration,
                c.id as camera_id,
                c.name as camera_name
            ORDER BY e.timestamp DESC
            LIMIT $limit
            """
            
            params = {
                "query_text": query_text,
                "limit": limit
            }
            
            if camera_ids:
                params["camera_ids"] = camera_ids
            if start_time:
                params["start_time"] = start_time.isoformat()
            if end_time:
                params["end_time"] = end_time.isoformat()
            
            result = await neo4j_client.async_execute_query(query, params)
            
            events = []
            for record in result:
                # Calculate duration if needed
                duration = record.get("duration")
                start_time_val = record.get("start_time")
                end_time_val = record.get("end_time")
                
                if not duration and start_time_val and end_time_val:
                    try:
                        start_dt = datetime.fromisoformat(start_time_val.replace('Z', '+00:00')) if isinstance(start_time_val, str) else start_time_val
                        end_dt = datetime.fromisoformat(end_time_val.replace('Z', '+00:00')) if isinstance(end_time_val, str) else end_time_val
                        duration = (end_dt - start_dt).total_seconds()
                    except:
                        duration = None
                
                events.append({
                    "id": record.get("id"),
                    "timestamp": record.get("timestamp"),
                    "start_time": start_time_val,
                    "end_time": end_time_val,
                    "caption": record.get("caption"),
                    "confidence": record.get("confidence"),
                    "frame_count": record.get("frame_count"),
                    "duration": duration,
                    "camera_id": record.get("camera_id"),
                    "camera_name": record.get("camera_name")
                })
            
            logger.info(f"Found {len(events)} events matching '{query_text}'")
            return events
            
        except Exception as e:
            logger.error(f"Event search failed: {e}")
            return []
    
    async def get_event_statistics(
        self,
        camera_id: Optional[str] = None,
        days: int = 7
    ) -> Dict[str, Any]:
        """
        Get event statistics
        
        Args:
            camera_id: Optional camera filter
            days: Number of days to analyze
            
        Returns:
            Statistics dictionary
        """
        try:
            start_time = datetime.now() - timedelta(days=days)
            
            if camera_id:
                query = """
                MATCH (c:Camera {id: $camera_id})-[:CAPTURED]->(e:Event)
                WHERE e.timestamp >= datetime($start_time)
                RETURN 
                    count(e) as total_events,
                    avg(e.confidence) as avg_confidence,
                    min(e.timestamp) as first_event,
                    max(e.timestamp) as last_event
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
                    count(DISTINCT c.id) as active_cameras
                """
                params = {
                    "start_time": start_time.isoformat()
                }
            
            result = await neo4j_client.async_execute_query(query, params)
            
            if result:
                stats = result[0]
                return {
                    "total_events": stats.get("total_events", 0),
                    "avg_confidence": stats.get("avg_confidence", 0.0),
                    "first_event": stats.get("first_event"),
                    "last_event": stats.get("last_event"),
                    "active_cameras": stats.get("active_cameras", 0) if not camera_id else 1,
                    "period_days": days
                }
            
            return {
                "total_events": 0,
                "avg_confidence": 0.0,
                "first_event": None,
                "last_event": None,
                "active_cameras": 0,
                "period_days": days
            }
            
        except Exception as e:
            logger.error(f"Failed to get event statistics: {e}")
            return {}


# Singleton instance
event_service = EventService()