# FILE LOCATION: backend/app/rag/context_builder.py

"""
Context Builder for RAG Chatbot - WITH REDIS PRIORITY
Retrieves relevant events from Redis (hot cache) FIRST, then Neo4j
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

from app.db.neo4j.client import neo4j_client
from app.db.redis.client import redis_client

logger = logging.getLogger(__name__)


class ContextBuilder:
    """Build context from Redis + Neo4j events for RAG"""
    
    def __init__(self):
        logger.info("✅ Context Builder initialized (Redis-first strategy)")
    
    async def build_context(
        self,
        processed_query: Dict[str, Any],
        max_events: int = 10
    ) -> Dict[str, Any]:
        """
        Build context from Redis + Neo4j based on processed query
        
        STRATEGY:
        1. Check Redis first (hot cache, last 2 hours)
        2. If not enough data, query Neo4j
        3. Merge results
        
        Args:
            processed_query: Output from QueryProcessor
            max_events: Maximum number of events to retrieve
            
        Returns:
            Dict with events, context text, and metadata
        """
        logger.info(f"🔍 Building context for intent: {processed_query['intent']}")
        
        temporal = processed_query.get('temporal')
        cameras = processed_query.get('cameras')
        
        # Step 1: Try Redis first (fast, recent data)
        redis_events = await self._retrieve_from_redis(
            temporal,
            cameras,
            max_events
        )
        
        logger.info(f"📊 Redis returned {len(redis_events)} events")
        
        # Step 2: If not enough data, query Neo4j
        neo4j_events = []
        if len(redis_events) < max_events:
            remaining = max_events - len(redis_events)
            neo4j_events = await self._retrieve_from_neo4j(
                processed_query,
                remaining
            )
            logger.info(f"📊 Neo4j returned {len(neo4j_events)} events")
        
        # Step 3: Merge results (Redis first, then Neo4j)
        all_events = redis_events + neo4j_events
        
        if not all_events:
            logger.warning("⚠️ No events found in Redis or Neo4j")
            return {
                'events': [],
                'context_text': "No events found matching your query.",
                'event_count': 0,
                'time_range': temporal,
                'cameras': [],
                'source': 'none'
            }
        
        # Build formatted context
        context_text = self._format_context(all_events, processed_query)
        
        # Extract unique cameras
        cameras_found = list(set([event.get('camera_name', 'Unknown') for event in all_events]))
        
        result = {
            'events': all_events[:max_events],  # Limit to max_events
            'context_text': context_text,
            'event_count': len(all_events),
            'time_range': temporal,
            'cameras': cameras_found,
            'source': f"redis:{len(redis_events)}, neo4j:{len(neo4j_events)}"
        }
        
        logger.info(f"✅ Built context with {len(all_events)} events from {len(cameras_found)} cameras")
        logger.info(f"   Sources: {result['source']}")
        return result
    
    async def _retrieve_from_redis(
        self,
        temporal: Optional[Dict[str, Any]],
        cameras: Optional[List[str]],
        max_events: int
    ) -> List[Dict[str, Any]]:
        """
        Retrieve events from Redis (hot cache)
        
        Redis stores captions for last 2 hours with metadata
        """
        try:
            events = []
            
            # Determine time range
            if temporal and temporal.get('start_time') and temporal.get('end_time'):
                start_time = datetime.fromisoformat(temporal['start_time'])
                end_time = datetime.fromisoformat(temporal['end_time'])
            else:
                # Default: last 2 hours (Redis cache window)
                end_time = datetime.now()
                start_time = end_time - timedelta(hours=2)
            
            logger.info(f"🔴 Querying Redis from {start_time} to {end_time}")
            
            # Get all cameras or specific ones
            if cameras and len(cameras) > 0:
                camera_ids = cameras  # Already camera IDs or keywords
            else:
                # Get all available cameras (we'll need to scan Redis)
                camera_ids = await self._get_redis_camera_list()
            
            # Query each camera
            for camera_id in camera_ids[:5]:  # Limit to 5 cameras max
                try:
                    camera_events = await redis_client.get_camera_captions_in_range(
                        camera_id=camera_id,
                        start_time=start_time,
                        end_time=end_time
                    )
                    
                    # Convert Redis format to standard event format
                    for redis_event in camera_events:
                        event = self._convert_redis_to_event(redis_event, camera_id)
                        if event:
                            events.append(event)
                    
                    logger.debug(f"   Camera {camera_id}: {len(camera_events)} events")
                
                except Exception as e:
                    logger.error(f"❌ Error querying Redis for camera {camera_id}: {e}")
                    continue
            
            # Sort by timestamp (most recent first)
            events.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
            
            logger.info(f"✅ Redis query complete: {len(events)} events found")
            return events[:max_events]
        
        except Exception as e:
            logger.error(f"❌ Redis retrieval failed: {e}")
            return []
    
    async def _get_redis_camera_list(self) -> List[str]:
        """
        Get list of cameras that have data in Redis
        Scan Redis keys to find unique camera IDs
        """
        try:
            # Scan for metadata keys (format: meta:camera_id:timestamp)
            camera_ids = set()
            
            cursor = 0
            while True:
                cursor, keys = await redis_client.client.scan(
                    cursor,
                    match="meta:*",
                    count=100
                )
                
                for key in keys:
                    try:
                        key_str = key.decode() if isinstance(key, bytes) else key
                        parts = key_str.split(':')
                        if len(parts) >= 2:
                            camera_id = parts[1]
                            camera_ids.add(camera_id)
                    except Exception:
                        continue
                
                if cursor == 0:
                    break
            
            logger.debug(f"📋 Found {len(camera_ids)} cameras in Redis")
            return list(camera_ids)
        
        except Exception as e:
            logger.error(f"❌ Error getting Redis camera list: {e}")
            return []
    
    def _convert_redis_to_event(
        self,
        redis_data: Dict[str, Any],
        camera_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Convert Redis caption format to standard event format
        
        Redis format:
        {
            "camera_id": "cam_1",
            "timestamp": "2025-10-30T10:30:00",
            "caption": "A person walking",
            "confidence": 0.92,
            "metadata": {...}
        }
        
        Event format (needed by LLM):
        {
            "event_id": "evt_...",
            "timestamp": "2025-10-30T10:30:00",
            "camera_id": "cam_1",
            "camera_name": "Main Entrance",
            "camera_location": "Building A",
            "caption": "A person walking",
            "confidence": 0.92
        }
        """
        try:
            timestamp = redis_data.get('timestamp')
            if not timestamp:
                return None
            
            # Generate event ID
            event_id = f"redis_{camera_id}_{timestamp.replace(':', '_').replace('.', '_')}"
            
            # Try to get camera name (from metadata or use camera_id)
            metadata = redis_data.get('metadata', {})
            camera_name = metadata.get('camera_name', f"Camera {camera_id}")
            camera_location = metadata.get('camera_location', 'Unknown')
            
            return {
                'event_id': event_id,
                'timestamp': timestamp,
                'camera_id': camera_id,
                'camera_name': camera_name,
                'camera_location': camera_location,
                'caption': redis_data.get('caption', ''),
                'confidence': redis_data.get('confidence', 0.0),
                'source': 'redis'  # Mark as Redis source
            }
        
        except Exception as e:
            logger.error(f"❌ Error converting Redis event: {e}")
            return None
    
    async def _retrieve_from_neo4j(
        self,
        processed_query: Dict[str, Any],
        max_events: int
    ) -> List[Dict[str, Any]]:
        """
        Retrieve events from Neo4j (fallback for older data)
        """
        logger.info(f"🔵 Querying Neo4j for {max_events} events")
        
        temporal = processed_query.get('temporal')
        cameras = processed_query.get('cameras')
        keywords = processed_query.get('keywords', [])
        
        # Build Cypher query based on available information
        if temporal and temporal.get('start_time') and temporal.get('end_time'):
            # Time-based query
            events = await self._query_neo4j_by_timerange(
                temporal['start_time'],
                temporal['end_time'],
                cameras,
                max_events
            )
        elif temporal and temporal.get('date'):
            # Date-based query (entire day)
            events = await self._query_neo4j_by_date(
                temporal['date'],
                cameras,
                max_events
            )
        elif keywords:
            # Keyword-based query (recent events)
            events = await self._query_neo4j_by_keywords(
                keywords,
                cameras,
                max_events
            )
        else:
            # Fallback: recent events
            events = await self._query_neo4j_recent_events(max_events)
        
        # Mark events as from Neo4j
        for event in events:
            event['source'] = 'neo4j'
        
        return events
    
    async def _query_neo4j_by_timerange(
        self,
        start_time: str,
        end_time: str,
        cameras: Optional[List[str]] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Query Neo4j events within a specific time range"""
        
        query = """
        MATCH (c:Camera)-[:CAPTURED]->(e:Event)
        WHERE e.timestamp >= datetime($start_time)
        AND e.timestamp <= datetime($end_time)
        """
        
        params = {
            'start_time': start_time,
            'end_time': end_time,
            'limit': limit
        }
        
        # Add camera filter if specified
        if cameras:
            query += """
            AND (
                toLower(c.name) CONTAINS toLower($camera_keyword)
                OR toLower(c.location) CONTAINS toLower($camera_keyword)
            )
            """
            params['camera_keyword'] = cameras[0]
        
        query += """
        RETURN 
            e.id as event_id,
            e.timestamp as timestamp,
            e.caption as caption,
            e.confidence as confidence,
            c.id as camera_id,
            c.name as camera_name,
            c.location as camera_location
        ORDER BY e.timestamp DESC
        LIMIT $limit
        """
        
        try:
            results = await neo4j_client.async_execute_query(query, params)
            events = [dict(record) for record in results]
            logger.info(f"📊 Neo4j timerange query: {len(events)} events")
            return events
        except Exception as e:
            logger.error(f"❌ Error querying Neo4j by timerange: {e}")
            return []
    
    async def _query_neo4j_by_date(
        self,
        date: str,
        cameras: Optional[List[str]] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Query Neo4j events for a specific date"""
        
        # Create start and end times for the entire day
        start_datetime = datetime.strptime(date, '%Y-%m-%d')
        end_datetime = start_datetime.replace(hour=23, minute=59, second=59)
        
        return await self._query_neo4j_by_timerange(
            start_datetime.isoformat(),
            end_datetime.isoformat(),
            cameras,
            limit
        )
    
    async def _query_neo4j_by_keywords(
        self,
        keywords: List[str],
        cameras: Optional[List[str]] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Query Neo4j events matching keywords in captions"""
        
        query = """
        MATCH (c:Camera)-[:CAPTURED]->(e:Event)
        WHERE (
        """
        
        # Build keyword matching conditions
        keyword_conditions = []
        params = {'limit': limit}
        
        for i, keyword in enumerate(keywords[:3]):  # Limit to 3 keywords
            keyword_conditions.append(f"toLower(e.caption) CONTAINS toLower($keyword{i})")
            params[f'keyword{i}'] = keyword
        
        query += " OR ".join(keyword_conditions)
        query += ")"
        
        # Add camera filter if specified
        if cameras:
            query += """
            AND (
                toLower(c.name) CONTAINS toLower($camera_keyword)
                OR toLower(c.location) CONTAINS toLower($camera_keyword)
            )
            """
            params['camera_keyword'] = cameras[0]
        
        query += """
        RETURN 
            e.id as event_id,
            e.timestamp as timestamp,
            e.caption as caption,
            e.confidence as confidence,
            c.id as camera_id,
            c.name as camera_name,
            c.location as camera_location
        ORDER BY e.timestamp DESC
        LIMIT $limit
        """
        
        try:
            results = await neo4j_client.async_execute_query(query, params)
            events = [dict(record) for record in results]
            logger.info(f"📊 Neo4j keyword query: {len(events)} events")
            return events
        except Exception as e:
            logger.error(f"❌ Error querying Neo4j by keywords: {e}")
            return []
    
    async def _query_neo4j_recent_events(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Query recent Neo4j events (fallback)"""
        
        query = """
        MATCH (c:Camera)-[:CAPTURED]->(e:Event)
        RETURN 
            e.id as event_id,
            e.timestamp as timestamp,
            e.caption as caption,
            e.confidence as confidence,
            c.id as camera_id,
            c.name as camera_name,
            c.location as camera_location
        ORDER BY e.timestamp DESC
        LIMIT $limit
        """
        
        try:
            results = await neo4j_client.async_execute_query(
                query,
                {'limit': limit}
            )
            events = [dict(record) for record in results]
            logger.info(f"📊 Neo4j recent events query: {len(events)} events")
            return events
        except Exception as e:
            logger.error(f"❌ Error querying Neo4j recent events: {e}")
            return []
    
    def _format_context(
        self,
        events: List[Dict[str, Any]],
        processed_query: Dict[str, Any]
    ) -> str:
        """Format events into readable context for LLM"""
        
        if not events:
            return "No events found."
        
        context_parts = []
        
        # Add query summary
        temporal = processed_query.get('temporal')
        if temporal:
            if temporal.get('date'):
                context_parts.append(f"Events for date: {temporal['date']}")
            if temporal.get('time_of_day'):
                context_parts.append(f"Time: {temporal['time_of_day']}")
        
        context_parts.append(f"\nTotal events found: {len(events)}\n")
        
        # Add individual events
        context_parts.append("=" * 60)
        
        for i, event in enumerate(events, 1):
            timestamp = event.get('timestamp')
            if timestamp:
                # Parse timestamp
                try:
                    if isinstance(timestamp, str):
                        dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                    else:
                        dt = timestamp
                    time_str = dt.strftime('%Y-%m-%d %H:%M:%S')
                except Exception:
                    time_str = str(timestamp)
            else:
                time_str = "Unknown time"
            
            source_tag = f"[{event.get('source', 'unknown').upper()}]"
            
            event_text = f"""
Event {i}: {source_tag}
  Camera: {event.get('camera_name', 'Unknown')}
  Location: {event.get('camera_location', 'Unknown')}
  Time: {time_str}
  Description: {event.get('caption', 'No description')}
  Confidence: {event.get('confidence', 0):.2%}
"""
            context_parts.append(event_text)
            context_parts.append("-" * 60)
        
        return "\n".join(context_parts)
    
    async def get_event_statistics(
        self,
        processed_query: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Get statistics about events matching query"""
        
        temporal = processed_query.get('temporal')
        
        if not temporal or not temporal.get('start_time'):
            return {}
        
        query = """
        MATCH (c:Camera)-[:CAPTURED]->(e:Event)
        WHERE e.timestamp >= datetime($start_time)
        AND e.timestamp <= datetime($end_time)
        RETURN 
            count(e) as total_events,
            count(DISTINCT c) as cameras_involved,
            min(e.timestamp) as first_event,
            max(e.timestamp) as last_event
        """
        
        try:
            results = await neo4j_client.async_execute_query(query, {
                'start_time': temporal['start_time'],
                'end_time': temporal['end_time']
            })
            
            if results:
                stats = dict(results[0])
                logger.info(f"📊 Statistics: {stats}")
                return stats
            return {}
        except Exception as e:
            logger.error(f"❌ Error getting statistics: {e}")
            return {}