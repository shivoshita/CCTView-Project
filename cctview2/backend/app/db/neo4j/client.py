"""
Neo4j Client
Manages Neo4j graph database connections
"""

from neo4j import GraphDatabase, AsyncGraphDatabase
import logging
from typing import Dict, Any, List, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


class Neo4jClient:
    """Neo4j database client wrapper"""
    
    def __init__(self):
        self.driver = None
        self.async_driver = None
        logger.info("🟢 Neo4j Client initialized")
    
    def connect(self):
        """Create synchronous connection"""
        try:
            self.driver = GraphDatabase.driver(
                settings.NEO4J_URI,
                auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
                max_connection_lifetime=settings.NEO4J_MAX_CONNECTION_LIFETIME,
                max_connection_pool_size=settings.NEO4J_MAX_CONNECTION_POOL_SIZE
            )
            self.driver.verify_connectivity()
            logger.info("✅ Neo4j connected successfully")
        except Exception as e:
            logger.error(f"❌ Neo4j connection failed: {e}")
            raise
    
    async def async_connect(self):
        """Create asynchronous connection"""
        try:
            self.async_driver = AsyncGraphDatabase.driver(
                settings.NEO4J_URI,
                auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
                max_connection_lifetime=settings.NEO4J_MAX_CONNECTION_LIFETIME,
                max_connection_pool_size=settings.NEO4J_MAX_CONNECTION_POOL_SIZE
            )
            await self.async_driver.verify_connectivity()
            logger.info("✅ Neo4j async connected successfully")
        except Exception as e:
            logger.error(f"❌ Neo4j async connection failed: {e}")
            raise
    
    def close(self):
        """Close connection"""
        if self.driver:
            self.driver.close()
        logger.info("Neo4j connection closed")
    
    async def async_close(self):
        """Close async connection"""
        if self.async_driver:
            await self.async_driver.close()
        logger.info("Neo4j async connection closed")
    
    def verify_connectivity(self):
        """Test connection"""
        try:
            if not self.driver:
                self.connect()
            self.driver.verify_connectivity()
            return True
        except Exception as e:
            logger.error(f"Neo4j connectivity check failed: {e}")
            return False
        
    async def async_verify_connectivity(self):
        """Test async connection"""
        try:
            if not self.async_driver:
                await self.async_connect()
            await self.async_driver.verify_connectivity()
            return True
        except Exception as e:
            logger.error(f"Neo4j async connectivity check failed: {e}")
            return False
    
    def execute_query(self, query: str, parameters: Dict[str, Any] = None) -> List[Dict]:
        """Execute Cypher query (synchronous)"""
        try:
            if not self.driver:
                self.connect()
            
            with self.driver.session(database=settings.NEO4J_DATABASE) as session:
                result = session.run(query, parameters or {})
                return [dict(record) for record in result]
        except Exception as e:
            logger.error(f"Query execution failed: {e}")
            raise
    
    async def async_execute_query(
        self,
        query: str,
        parameters: Dict[str, Any] = None
    ) -> List[Dict]:
        """Execute Cypher query (asynchronous)"""
        try:
            if not self.async_driver:
                await self.async_connect()
            
            async with self.async_driver.session(database=settings.NEO4J_DATABASE) as session:
                result = await session.run(query, parameters or {})
                records = await result.data()
                return records
        except Exception as e:
            logger.error(f"Async query execution failed: {e}")
            raise
    
    # Schema Initialization
    def initialize_schema(self):
        """Create constraints and indexes"""
        logger.info("Initializing Neo4j schema...")
        
        constraints_and_indexes = [
            # Unique constraints
            "CREATE CONSTRAINT camera_id IF NOT EXISTS FOR (c:Camera) REQUIRE c.id IS UNIQUE",
            "CREATE CONSTRAINT event_id IF NOT EXISTS FOR (e:Event) REQUIRE e.id IS UNIQUE",
            "CREATE CONSTRAINT person_id IF NOT EXISTS FOR (p:TrackedPerson) REQUIRE p.id IS UNIQUE",
            "CREATE CONSTRAINT anomaly_id IF NOT EXISTS FOR (a:Anomaly) REQUIRE a.id IS UNIQUE",
            "CREATE CONSTRAINT user_email IF NOT EXISTS FOR (u:User) REQUIRE u.email IS UNIQUE",
            "CREATE CONSTRAINT rule_id IF NOT EXISTS FOR (r:AnomalyRule) REQUIRE r.id IS UNIQUE",
            
            # Indexes for performance
            "CREATE INDEX event_timestamp IF NOT EXISTS FOR (e:Event) ON (e.timestamp)",
            "CREATE INDEX event_camera IF NOT EXISTS FOR (e:Event) ON (e.camera_id)",
            "CREATE INDEX anomaly_detected IF NOT EXISTS FOR (a:Anomaly) ON (a.detected_at)",
            "CREATE INDEX person_last_seen IF NOT EXISTS FOR (p:TrackedPerson) ON (p.last_seen)",
            "CREATE INDEX camera_status IF NOT EXISTS FOR (c:Camera) ON (c.status)",
        ]
        
        for statement in constraints_and_indexes:
            try:
                self.execute_query(statement)
                logger.info(f"✅ Executed: {statement[:50]}...")
            except Exception as e:
                logger.warning(f"⚠️  Schema statement failed (may already exist): {e}")
        
        logger.info("Schema initialization complete")
    
    # Camera Operations
    async def create_camera(self, camera_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new camera node"""
        query = """
        CREATE (c:Camera {
            id: $id,
            name: $name,
            location: $location,
            rtsp_url: $rtsp_url,
            native_storage_path: $native_storage_path,
            status: $status,
            created_at: datetime()
        })
        RETURN c
        """
        
        result = await self.async_execute_query(query, camera_data)
        return result[0] if result else None
    
    async def get_camera(self, camera_id: str) -> Optional[Dict[str, Any]]:
        """Get camera by ID"""
        query = "MATCH (c:Camera {id: $camera_id}) RETURN c"
        result = await self.async_execute_query(query, {"camera_id": camera_id})
        return result[0]["c"] if result else None
    
    # Event Operations
    async def create_event(self, event_data: Dict[str, Any]) -> str:
        """Create an event node linked to a camera"""
        query = """
        MATCH (c:Camera {id: $camera_id})
        CREATE (e:Event {
            id: $event_id,
            timestamp: datetime($timestamp),
            caption: $caption,
            confidence: $confidence,
            video_reference: $video_reference,
            retention_until: date($retention_until)
        })
        CREATE (c)-[:CAPTURED]->(e)
        RETURN e.id as event_id
        """
        
        result = await self.async_execute_query(query, event_data)
        return result[0]["event_id"] if result else None
    
    async def get_events_by_camera(
        self,
        camera_id: str,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Get events for a specific camera"""
        query = """
        MATCH (c:Camera {id: $camera_id})-[:CAPTURED]->(e:Event)
        RETURN e
        ORDER BY e.timestamp DESC
        SKIP $offset
        LIMIT $limit
        """
        
        result = await self.async_execute_query(query, {
            "camera_id": camera_id,
            "limit": limit,
            "offset": offset
        })
        return [record["e"] for record in result]
    
    async def get_events_by_timerange(
        self,
        start_time: str,
        end_time: str,
        camera_ids: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """Get events within a time range"""
        if camera_ids:
            query = """
            MATCH (c:Camera)-[:CAPTURED]->(e:Event)
            WHERE c.id IN $camera_ids
            AND e.timestamp >= datetime($start_time)
            AND e.timestamp <= datetime($end_time)
            RETURN e, c.id as camera_id
            ORDER BY e.timestamp DESC
            """
            params = {
                "start_time": start_time,
                "end_time": end_time,
                "camera_ids": camera_ids
            }
        else:
            query = """
            MATCH (c:Camera)-[:CAPTURED]->(e:Event)
            WHERE e.timestamp >= datetime($start_time)
            AND e.timestamp <= datetime($end_time)
            RETURN e, c.id as camera_id
            ORDER BY e.timestamp DESC
            """
            params = {
                "start_time": start_time,
                "end_time": end_time
            }
        
        result = await self.async_execute_query(query, params)
        return result
    
    # Person Tracking Operations
    async def create_tracked_person(self, person_data: Dict[str, Any]) -> str:
        """Create a tracked person node"""
        query = """
        CREATE (p:TrackedPerson {
            id: $person_id,
            first_seen: datetime($first_seen),
            last_seen: datetime($last_seen),
            appearance_features: $appearance_features,
            status: 'active'
        })
        RETURN p.id as person_id
        """
        
        result = await self.async_execute_query(query, person_data)
        return result[0]["person_id"] if result else None
    
    async def link_person_to_event(
        self,
        person_id: str,
        event_id: str,
        confidence: float
    ):
        """Create relationship between person and event"""
        query = """
        MATCH (p:TrackedPerson {id: $person_id})
        MATCH (e:Event {id: $event_id})
        CREATE (p)-[:APPEARS_IN {confidence: $confidence, timestamp: datetime()}]->(e)
        CREATE (e)-[:SHOWS]->(p)
        """
        
        await self.async_execute_query(query, {
            "person_id": person_id,
            "event_id": event_id,
            "confidence": confidence
        })
    
    async def get_person_trajectory(self, person_id: str) -> List[Dict[str, Any]]:
        """Get movement trajectory for a person"""
        query = """
        MATCH (p:TrackedPerson {id: $person_id})-[:APPEARS_IN]->(e:Event)<-[:CAPTURED]-(c:Camera)
        RETURN e.timestamp as timestamp, c.id as camera_id, c.name as camera_name, e.caption as caption
        ORDER BY e.timestamp ASC
        """
        
        result = await self.async_execute_query(query, {"person_id": person_id})
        return result
    
    # Anomaly Operations
    async def create_anomaly(self, anomaly_data: Dict[str, Any]) -> str:
        """Create an anomaly node"""
        query = """
        MATCH (e:Event {id: $event_id})
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
        RETURN a.id as anomaly_id
        """
        
        result = await self.async_execute_query(query, anomaly_data)
        return result[0]["anomaly_id"] if result else None
    
    # Statistics
    async def get_statistics(self) -> Dict[str, Any]:
        """Get database statistics"""
        queries = {
            "total_events": "MATCH (e:Event) RETURN count(e) as count",
            "total_cameras": "MATCH (c:Camera) RETURN count(c) as count",
            "total_persons": "MATCH (p:TrackedPerson) RETURN count(p) as count",
            "total_anomalies": "MATCH (a:Anomaly) RETURN count(a) as count"
        }
        
        stats = {}
        for key, query in queries.items():
            result = await self.async_execute_query(query)
            stats[key] = result[0]["count"] if result else 0
        
        return stats


# Singleton instance
neo4j_client = Neo4jClient()