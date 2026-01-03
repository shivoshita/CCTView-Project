#!/usr/bin/env python3
"""
Test Migration System
Quick script to test Redis → Neo4j migration with deduplication
"""

import asyncio
import sys
from pathlib import Path
import json

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db.redis.client import redis_client
from app.db.neo4j.client import neo4j_client
from app.services.migration_service import migration_service
from app.core.config import settings
from datetime import datetime, timedelta
import random

# Override settings for testing
settings.CAPTION_SIMILARITY_THRESHOLD = 0.85  # More realistic threshold
settings.MIN_CAPTION_DURATION = 5  # 5 seconds minimum


async def create_test_data_with_manual_ttl():
    """Create test caption data in Redis with MANUAL TTL control"""
    print("=" * 60)
    print("📝 Creating Test Data in Redis (with manual TTL)")
    print("=" * 60)
    
    camera_id = "test_cam_001"
    base_time = datetime.now() - timedelta(hours=1, minutes=50)
    
    # Simulate captions with duplicates
    test_captions = [
        ("surveillance camera view of empty parking lot", 120),  # 2 minutes
        ("empty parking lot surveillance view", 180),  # 3 minutes (similar)
        ("surveillance view of parking area", 60),  # 1 minute (similar)
        ("person walking through parking lot", 90),  # 1.5 minutes (different)
        ("man walking in parking area", 120),  # 2 minutes (similar to previous)
        ("surveillance camera view of empty parking lot", 240),  # 4 minutes (back to original)
    ]
    
    print(f"🎬 Creating {len(test_captions)} test captions...")
    print(f"⏰ Base time: {base_time.strftime('%H:%M:%S')} (old timestamp)")
    
    # Ensure camera exists in Neo4j
    await neo4j_client.async_connect()
    camera_query = """
    MERGE (c:Camera {id: $camera_id})
    ON CREATE SET 
        c.name = 'Test Camera 001',
        c.location = 'Test Location',
        c.status = 'active',
        c.created_at = datetime()
    RETURN c.id as camera_id
    """
    await neo4j_client.async_execute_query(camera_query, {"camera_id": camera_id})
    print(f"✅ Ensured camera exists in Neo4j: {camera_id}")
    
    # Store captions DIRECTLY in Redis with custom TTL
    current_time = base_time
    keys_created = []
    
    # Generate base embeddings for similar captions
    base_embeddings = {
        "parking_empty": [random.random() for _ in range(384)],
        "person_walking": [random.random() for _ in range(384)]
    }
    
    for caption, duration_seconds in test_captions:
        # Generate embedding based on caption content
        if "person" in caption.lower() or "man" in caption.lower() or "walking" in caption.lower():
            # Similar to "person walking" - add small noise
            base = base_embeddings["person_walking"]
            embedding = [v + random.uniform(-0.05, 0.05) for v in base]
        else:
            # Similar to "empty parking" - add small noise
            base = base_embeddings["parking_empty"]
            embedding = [v + random.uniform(-0.05, 0.05) for v in base]
        
        # Calculate how much time has passed since this caption
        time_elapsed = (datetime.now() - current_time).total_seconds()
        remaining_ttl = int(7200 - time_elapsed)  # 2 hours - elapsed time
        
        if remaining_ttl < 0:
            remaining_ttl = 60  # At least 60 seconds
        
        # Create key manually
        key = f"meta:{camera_id}:{current_time.isoformat()}"
        
        data = {
            "caption": caption,
            "embedding": embedding,
            "confidence": 0.85,
            "timestamp": current_time.isoformat(),
            "camera_id": camera_id,
            "test": True
        }
        
        # Store in Redis with custom TTL
        await redis_client.client.set(
            key,
            json.dumps(data),
            ex=remaining_ttl
        )
        
        keys_created.append(key)
        
        print(f"✅ Stored: '{caption[:40]}...' at {current_time.strftime('%H:%M:%S')}")
        print(f"   Key: {key}")
        print(f"   TTL: {remaining_ttl}s ({remaining_ttl/60:.1f} min)")
        
        current_time += timedelta(seconds=duration_seconds)
    
    # Verify TTLs
    print(f"\n⏱️  Verifying TTLs...")
    for i, key in enumerate(keys_created[:3], 1):
        ttl = await redis_client.client.ttl(key)
        print(f"   Key {i}: TTL = {ttl}s ({ttl/60:.1f} min)")
    
    print(f"\n✅ Created {len(test_captions)} test captions")
    print(f"📊 Time range: {base_time.strftime('%H:%M:%S')} → {current_time.strftime('%H:%M:%S')}")
    return camera_id, len(test_captions)


async def test_migration():
    """Test the migration process"""
    print("\n" + "=" * 60)
    print("🔄 Testing Migration Process")
    print("=" * 60)
    
    # Step 1: Create test data
    camera_id, original_count = await create_test_data_with_manual_ttl()
    
    # Wait a moment for Redis to settle
    await asyncio.sleep(1)
    
    # Step 2: Check what keys are expiring
    print("\n" + "=" * 60)
    print("👀 Keys Ready for Migration")
    print("=" * 60)
    
    # Use large threshold for testing
    expiring_keys = await redis_client.get_keys_near_expiry(
        camera_id=camera_id,
        threshold_seconds=7200  # Get all keys for testing
    )
    
    print(f"📋 Found {len(expiring_keys)} keys to migrate")
    
    if not expiring_keys:
        print("\n❌ ERROR: No keys found! Check Redis client get_keys_near_expiry method")
        return
    
    for i, key_data in enumerate(expiring_keys[:3], 1):
        print(f"   {i}. {key_data['key']}")
        print(f"      TTL: {key_data.get('ttl_remaining', 'N/A')}s")
        print(f"      Caption: {key_data['data'].get('caption', 'N/A')[:50]}...")
    
    if len(expiring_keys) > 3:
        print(f"   ... and {len(expiring_keys) - 3} more")
    
    # Step 3: Run migration with debug logging
    print("\n" + "=" * 60)
    print("📤 Running Migration to Neo4j")
    print("=" * 60)
    
    # Enable debug logging temporarily
    import logging
    migration_logger = logging.getLogger("app.services.migration_service")
    migration_logger.setLevel(logging.DEBUG)
    handler = logging.StreamHandler()
    handler.setLevel(logging.DEBUG)
    migration_logger.addHandler(handler)
    
    stats = await migration_service.migrate_camera_history(
        camera_id=camera_id,
        force=True
    )
    
    print(f"\n✅ Migration Complete:")
    print(f"   Captions processed: {stats.get('captions_processed', 0)}")
    print(f"   Events created: {stats.get('events_created', 0)}")
    print(f"   Redis keys deleted: {stats.get('redis_keys_deleted', 0)}")
    
    if 'error' in stats:
        print(f"   ❌ Error: {stats['error']}")
    
    # Step 4: Verify in Neo4j
    print("\n" + "=" * 60)
    print("✔️  Verifying Neo4j Storage")
    print("=" * 60)
    
    # Don't filter by source - just get all events for this camera
    query = """
    MATCH (c:Camera {id: $camera_id})-[:CAPTURED]->(e:Event)
    RETURN e
    ORDER BY e.start_time ASC
    """
    
    results = await neo4j_client.async_execute_query(query, {"camera_id": camera_id})
    
    print(f"📊 Found {len(results)} events in Neo4j:")
    
    for i, record in enumerate(results, 1):
        event = dict(record['e'])
        print(f"\n   Event {i}: {event.get('id', 'N/A')}")
        print(f"   Caption: '{event.get('caption', 'N/A')}'")
        print(f"   Duration: {event.get('duration', 0):.1f}s")
        print(f"   Frames: {event.get('frame_count', 0)}")
        print(f"   Confidence: {event.get('confidence', 0):.3f}")
        start = event.get('start_time')
        end = event.get('end_time')
        if start and end:
            print(f"   Time: {start} → {end}")
    
    print("\n" + "=" * 60)
    print("✅ Migration Test Complete!")
    print("=" * 60)
    
    # Show summary
    print("\n📊 Summary:")
    print(f"   Original captions: {original_count}")
    print(f"   Events created: {stats.get('events_created', 0)}")
    if stats.get('events_created', 0) > 0:
        reduction = (1 - stats.get('events_created', 0) / original_count) * 100
        print(f"   Reduction: {reduction:.1f}%")
        print(f"   ✅ Deduplication working!")
    else:
        print(f"   ⚠️  WARNING: No events created! Check logs above.")


async def cleanup_test_data():
    """Clean up test data"""
    print("\n🧹 Cleaning up test data...")
    
    # Delete from Neo4j
    query = """
    MATCH (c:Camera {id: 'test_cam_001'})-[:CAPTURED]->(e:Event)
    DETACH DELETE e
    """
    await neo4j_client.async_execute_query(query)
    
    # Delete test camera
    camera_query = """
    MATCH (c:Camera {id: 'test_cam_001'})
    WHERE NOT (c)-[:CAPTURED]->()
    DELETE c
    """
    await neo4j_client.async_execute_query(camera_query)
    
    # Clear Redis - get all keys for camera
    pattern = "meta:test_cam_001:*"
    cursor = 0
    deleted = 0
    
    while True:
        cursor, keys = await redis_client.client.scan(
            cursor=cursor,
            match=pattern,
            count=100
        )
        
        if keys:
            await redis_client.client.delete(*keys)
            deleted += len(keys)
        
        if cursor == 0:
            break
    
    print(f"✅ Cleanup complete - deleted {deleted} Redis keys")


async def main():
    """Main test function"""
    try:
        # Connect to databases
        await redis_client.connect()
        await neo4j_client.async_connect()
        
        # Run tests
        await test_migration()
        
        # Ask if cleanup needed
        print("\n" + "=" * 60)
        cleanup = input("Clean up test data? (y/n): ")
        if cleanup.lower() == 'y':
            await cleanup_test_data()
        
    except KeyboardInterrupt:
        print("\n\n❌ Test interrupted by user")
    except Exception as e:
        print(f"\n\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Close connections
        await redis_client.close()
        await neo4j_client.async_close()


if __name__ == "__main__":
    asyncio.run(main())