"""
Migration 004: Add Time Range Fields to Events
Adds start_time, end_time, duration, frame_count to existing Event nodes
"""

import logging
from app.db.neo4j.client import neo4j_client

logger = logging.getLogger(__name__)


async def upgrade():
    """
    Add time range fields to existing Event nodes
    For existing events without these fields, set:
    - start_time = timestamp
    - end_time = timestamp
    - duration = 0
    - frame_count = 1
    """
    
    logger.info("🔄 Migration 004: Adding time range fields to Event nodes...")
    
    try:
        # Check if migration already applied
        check_query = """
        MATCH (e:Event)
        WHERE e.start_time IS NOT NULL
        RETURN count(e) as migrated_count
        LIMIT 1
        """
        
        result = await neo4j_client.async_execute_query(check_query)
        if result and result[0].get('migrated_count', 0) > 0:
            logger.info("⚠️  Migration 004 already applied, skipping...")
            return
        
        # Apply migration
        migration_query = """
        MATCH (e:Event)
        WHERE e.start_time IS NULL
        SET 
            e.start_time = e.timestamp,
            e.end_time = e.timestamp,
            e.duration = 0,
            e.frame_count = 1
        RETURN count(e) as updated_count
        """
        
        result = await neo4j_client.async_execute_query(migration_query)
        updated_count = result[0].get('updated_count', 0) if result else 0
        
        logger.info(f"✅ Migration 004 complete: Updated {updated_count} events")
        
    except Exception as e:
        logger.error(f"❌ Migration 004 failed: {e}")
        raise


async def downgrade():
    """
    Remove time range fields (optional - for rollback)
    """
    
    logger.info("🔄 Rolling back Migration 004...")
    
    try:
        rollback_query = """
        MATCH (e:Event)
        WHERE e.start_time IS NOT NULL
        REMOVE e.start_time, e.end_time, e.duration, e.frame_count
        RETURN count(e) as rollback_count
        """
        
        result = await neo4j_client.async_execute_query(rollback_query)
        rollback_count = result[0].get('rollback_count', 0) if result else 0
        
        logger.info(f"✅ Migration 004 rolled back: {rollback_count} events")
        
    except Exception as e:
        logger.error(f"❌ Migration 004 rollback failed: {e}")
        raise


if __name__ == "__main__":
    import asyncio
    asyncio.run(upgrade())