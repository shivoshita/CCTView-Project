# FILE LOCATION: backend/app/services/dashboard_service.py

from datetime import datetime, timedelta
from typing import Dict, Any, List
import logging
from neo4j.time import DateTime as Neo4jDateTime

from app.db.neo4j.client import neo4j_client
from app.db.redis.client import redis_client

logger = logging.getLogger(__name__)


class DashboardService:
    def __init__(self):
        self.db = neo4j_client
        self.cache = redis_client

    async def get_dashboard_stats(self) -> Dict[str, Any]:
        """Get all dashboard statistics"""
        try:
            # Get all stats in parallel
            cameras_stats = await self._get_camera_stats()
            events_stats = await self._get_events_stats()
            recent_activity = await self._get_recent_activity()
            anomalies_stats = await self._get_anomalies_stats()
            tracked_persons_stats = await self._get_tracked_persons_stats()

            return {
                "cameras": cameras_stats,
                "events": events_stats,
                "recent_activity": recent_activity,
                "anomalies": anomalies_stats,
                "tracked_persons": tracked_persons_stats,
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"Error getting dashboard stats: {e}")
            raise

    async def _get_camera_stats(self) -> Dict[str, Any]:
        """Get camera statistics"""
        try:
            query = """
            MATCH (c:Camera)
            WITH count(c) as total,
                 sum(CASE WHEN c.is_active = true THEN 1 ELSE 0 END) as active
            RETURN total, active
            """
            
            # FIX: Use async_execute_query instead of execute_query
            result = await self.db.async_execute_query(query)
            
            if result:
                record = result[0]
                total = record.get('total', 0)
                active = record.get('active', 0)
                
                # Get yesterday's count for comparison
                yesterday = datetime.now() - timedelta(days=1)
                yesterday_query = """
                MATCH (c:Camera)
                WHERE c.created_at < $yesterday
                RETURN count(c) as yesterday_total
                """
                yesterday_result = await self.db.async_execute_query(
                    yesterday_query,
                    {"yesterday": yesterday}
                )
                
                yesterday_total = yesterday_result[0].get('yesterday_total', total) if yesterday_result else total
                change = total - yesterday_total
                
                return {
                    "total": total,
                    "active": active,
                    "inactive": total - active,
                    "change_from_yesterday": change
                }
            
            return {
                "total": 0,
                "active": 0,
                "inactive": 0,
                "change_from_yesterday": 0
            }
        except Exception as e:
            logger.error(f"Error getting camera stats: {e}")
            return {
                "total": 0,
                "active": 0,
                "inactive": 0,
                "change_from_yesterday": 0
            }

    async def _get_events_stats(self) -> Dict[str, Any]:
        """Get events statistics"""
        try:
            # Use Neo4j's date() function to get today's date boundary
            query = """
            WITH date() as today, date() - duration('P1D') as yesterday
            MATCH (e:Event)
            WITH today, yesterday, e,
                 date(datetime(e.timestamp)) as event_date
            RETURN count(e) as total,
                   sum(CASE WHEN event_date = today THEN 1 ELSE 0 END) as today,
                   sum(CASE WHEN event_date = yesterday THEN 1 ELSE 0 END) as yesterday
            """
            
            result = await self.db.async_execute_query(query)
            
            if result:
                record = result[0]
                return {
                    "total": record.get('total', 0),
                    "today": record.get('today', 0),
                    "yesterday": record.get('yesterday', 0)
                }
            
            return {
                "total": 0,
                "today": 0,
                "yesterday": 0
            }
        except Exception as e:
            logger.error(f"Error getting events stats: {e}", exc_info=True)
            return {
                "total": 0,
                "today": 0,
                "yesterday": 0
            }

    async def _get_recent_activity(self, limit: int = 5) -> List[Dict[str, Any]]:
        """Get recent activity events"""
        try:
            query = """
            MATCH (c:Camera)-[:CAPTURED]->(e:Event)
            RETURN e.id as id,
                   e.event_type as event_type,
                   e.description as description,
                   e.caption as caption,
                   e.timestamp as timestamp,
                   c.name as camera_name,
                   c.location as camera_location
            ORDER BY e.timestamp DESC
            LIMIT $limit
            """
            
            # FIX: Use async_execute_query
            result = await self.db.async_execute_query(query, {"limit": limit})
            
            activities = []
            for record in result:
                # Convert Neo4j DateTime to Python datetime
                timestamp = record.get('timestamp')
                if isinstance(timestamp, Neo4jDateTime):
                    timestamp = timestamp.to_native()
                elif isinstance(timestamp, str):
                    try:
                        timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                    except:
                        timestamp = datetime.now()
                elif not isinstance(timestamp, datetime):
                    timestamp = datetime.now()
                
                # Determine status based on event type
                event_type = record.get('event_type', 'detection')
                
                # Use description if available, otherwise use caption
                description = record.get('description') or record.get('caption', 'Activity detected')
                
                # Ensure proper status mapping
                status = 'warning' if event_type in ['anomaly', 'alert', 'intrusion'] else 'normal'
                
                activity = {
                    "id": record.get('id'),
                    "event": description,
                    "event_type": event_type,
                    "camera": record.get('camera_name', 'Unknown Camera'),
                    "camera_location": record.get('camera_location'),
                    "timestamp": timestamp.isoformat(),
                    "status": status
                }
                activities.append(activity)
            
            return activities
        except Exception as e:
            logger.error(f"Error getting recent activity: {e}")
            return []

    async def _get_anomalies_stats(self) -> Dict[str, Any]:
        """Get anomalies statistics"""
        try:
            query = """
            MATCH (a:Anomaly)
            WITH count(a) as total_count,
                 sum(CASE WHEN a.status = 'new' OR a.status = 'investigating' THEN 1 ELSE 0 END) as active_count
            RETURN total_count, active_count
            """
            
            # FIX: Use async_execute_query
            result = await self.db.async_execute_query(query)
            
            if result:
                record = result[0]
                total = record.get('total_count', 0)
                active = record.get('active_count', 0)
                return {
                    "count": active,
                    "total": total,
                    "resolved": total - active
                }
            
            return {
                "count": 0,
                "total": 0,
                "resolved": 0
            }
        except Exception as e:
            logger.error(f"Error getting anomalies stats: {e}")
            return {
                "count": 0,
                "total": 0,
                "resolved": 0
            }

    async def _get_tracked_persons_stats(self) -> Dict[str, Any]:
        """Get tracked persons statistics"""
        try:
            today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            
            query = """
            MATCH (p:TrackedPerson)
            WITH count(p) as total,
                 sum(CASE WHEN p.first_seen >= $today_start THEN 1 ELSE 0 END) as new_today
            RETURN total, new_today
            """
            
            # FIX: Use async_execute_query
            result = await self.db.async_execute_query(query, {"today_start": today_start})
            
            if result:
                record = result[0]
                return {
                    "count": record.get('total', 0),
                    "new_today": record.get('new_today', 0)
                }
            
            return {
                "count": 0,
                "new_today": 0
            }
        except Exception as e:
            logger.error(f"Error getting tracked persons stats: {e}")
            return {
                "count": 0,
                "new_today": 0
            }


# Create singleton instance
dashboard_service = DashboardService()