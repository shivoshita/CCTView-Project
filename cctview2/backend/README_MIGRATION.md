# CCTView Migration System Documentation

## Overview

The CCTView migration system handles the transfer of caption data from Redis (hot cache) to Neo4j (permanent storage) with intelligent deduplication.

## Architecture Flow
```
┌─────────────────────────────────────────────────────────────┐
│ 1. FRAME CAPTURE (Real-time)                                │
│    Camera → Frame Extraction → AI Captioning → Redis        │
│    TTL: 2 hours (FIXED)                                      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. HOT CACHE (Redis)                                         │
│    Stores ALL captions for 2 hours                          │
│    No deduplication at this stage                            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. MIGRATION CHECK (Every 60 seconds)                       │
│    Celery task checks for keys with TTL < 5 minutes         │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. DEDUPLICATION                                             │
│    Groups similar consecutive captions                       │
│    Example: "man in fields" (1:00-1:03 PM) → 1 event       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. NEO4J STORAGE (Permanent)                                │
│    Stores deduplicated events with time ranges              │
│    Retention: 30/60/90 days or unlimited                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. REDIS CLEANUP                                             │
│    Deletes migrated keys from Redis                         │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

### Redis Settings
```env
REDIS_TTL_2HOUR=7200              # Fixed 2-hour TTL for all captions
REDIS_MIGRATION_THRESHOLD=300     # Migrate when TTL < 5 minutes
```

### Deduplication Settings
```env
CAPTION_SIMILARITY_THRESHOLD=0.95  # 95% similarity = duplicate
MIN_CAPTION_DURATION=60            # Min 1 minute per event
MAX_CAPTION_DURATION=300           # Max 5 minutes per event
```

## Deduplication Logic

### Example Scenario

**Input (Redis):**
```
1:00:00 PM - "surveillance camera view of man in fields"
1:00:30 PM - "man in fields surveillance view"
1:01:00 PM - "surveillance view of man in field"
1:01:30 PM - "man working in agricultural field"
1:02:00 PM - "man in fields"
1:03:00 PM - "person walking away from field"
```

**Output (Neo4j):**
```
Event 1:
  Caption: "surveillance camera view of man in fields"
  Start: 1:00:00 PM
  End: 1:02:00 PM
  Duration: 120 seconds
  Frame Count: 5

Event 2:
  Caption: "person walking away from field"
  Start: 1:03:00 PM
  End: 1:03:00 PM
  Duration: 0 seconds
  Frame Count: 1
```

### Algorithm

1. **Sort captions by timestamp**
2. **Compare consecutive captions**
   - Use embedding cosine similarity (if available)
   - Fallback to word overlap (80% threshold)
3. **Group similar captions**
   - If similarity > 95% AND duration < 5 minutes → Extend group
   - Otherwise → Create new group
4. **Apply duration constraints**
   - Minimum: 1 minute (60 seconds)
   - Maximum: 5 minutes (300 seconds)

## API Endpoints

### Get Migration Status
```bash
GET /api/v1/migration/status
```

**Response:**
```json
{
  "status": "active",
  "cache_stats": {
    "used_memory_mb": 45.2,
    "total_keys": 1247,
    "ttl_mode": "FIXED 2 HOURS"
  },
  "migration": {
    "keys_near_expiry": 234,
    "cameras_affected": 5,
    "next_check": "Every 60 seconds (automatic)"
  }
}
```

### Trigger Migration Manually
```bash
POST /api/v1/migration/trigger
```

### Preview Deduplication
```bash
GET /api/v1/migration/camera/cam_001/preview
```

**Response:**
```json
{
  "summary": {
    "original_captions": 150,
    "deduplicated_events": 42,
    "reduction": "72.0%"
  },
  "preview_events": [
    {
      "caption": "surveillance view of parking lot",
      "start_time": "2025-10-29 14:00:00",
      "end_time": "2025-10-29 14:03:45",
      "duration_seconds": 225,
      "frame_count": 15
    }
  ]
}
```

### Force Migrate Camera
```bash
POST /api/v1/migration/camera/cam_001/migrate?force=true
```

### View Migration History
```bash
GET /api/v1/migration/history?limit=50
```

### Clear Camera Cache
```bash
DELETE /api/v1/migration/camera/cam_001/cache?migrate_first=true
```

## Celery Tasks

### Automatic Migration Task
- **Task:** `migration.check_and_migrate`
- **Schedule:** Every 60 seconds
- **Function:** Checks all cameras for keys near expiry

### Migration Statistics Task
- **Task:** `migration.get_migration_stats`
- **Schedule:** Every 5 minutes
- **Function:** Collects statistics for monitoring

## Running the System

### Start Backend API
```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Start Celery Worker
```bash
celery -A app.workers.celery_app worker --loglevel=info
```

### Start Celery Beat (Scheduler)
```bash
celery -A app.workers.celery_app beat --loglevel=info
```

## Testing

### Run Migration Test Script
```bash
python backend/scripts/test_migration.py
```

This script will:
1. Create test captions with duplicates
2. Show deduplication preview
3. Run migration to Neo4j
4. Verify stored events
5. Optionally clean up test data

### Manual Testing via API

1. **Check current status:**
```bash
curl http://localhost:8000/api/v1/migration/status
```

2. **Preview deduplication:**
```bash
curl http://localhost:8000/api/v1/migration/camera/cam_001/preview
```

3. **Trigger migration:**
```bash
curl -X POST http://localhost:8000/api/v1/migration/trigger
```

## Monitoring

### Key Metrics to Watch

1. **Keys Near Expiry:** Should stay low (< 500)
2. **Migration Rate:** Events created vs captions processed
3. **Redis Memory:** Should stay stable (not growing indefinitely)
4. **Neo4j Events:** Should match expected deduplication rate

### Logs to Monitor
```bash
# Migration task logs
grep "Migration Task" backend/logs/cctview_*.log

# Deduplication stats
grep "Deduplication:" backend/logs/cctview_*.log

# Neo4j storage
grep "Created Neo4j event" backend/logs/cctview_*.log
```

## Troubleshooting

### Issue: No migrations happening

**Symptoms:** Keys accumulating in Redis, TTL expiring without migration

**Solutions:**
1. Check Celery worker is running: `celery -A app.workers.celery_app inspect active`
2. Check Celery beat is running: `celery -A app.workers.celery_app inspect scheduled`
3. Manually trigger: `POST /api/v1/migration/trigger`

### Issue: Too many duplicate events in Neo4j

**Symptoms:** More events than expected, similar captions not being grouped

**Solutions:**
1. Increase `CAPTION_SIMILARITY_THRESHOLD` (e.g., 0.98)
2. Increase `MAX_CAPTION_DURATION` (e.g., 600 seconds)
3. Check embeddings are being generated correctly

### Issue: Redis memory growing

**Symptoms:** Redis memory usage increasing over time

**Solutions:**
1. Check TTL is set correctly: `redis-cli TTL caption:cam_001:*`
2. Verify migration is running: Check Celery logs
3. Manually clear cache: `DELETE /api/v1/migration/camera/cam_001/cache`

### Issue: Neo4j storage failing

**Symptoms:** Migration task shows errors, events not appearing in Neo4j

**Solutions:**
1. Check Neo4j connection: `GET /api/v1/health`
2. Verify camera exists: `GET /api/v1/cameras/cam_001`
3. Check Neo4j logs: `docker logs neo4j`

## Performance Optimization

### For High-Volume Cameras (>100 frames/hour)

1. **Increase MIN_CAPTION_DURATION:**
```env
   MIN_CAPTION_DURATION=120  # 2 minutes minimum
```

2. **Decrease similarity threshold slightly:**
```env
   CAPTION_SIMILARITY_THRESHOLD=0.92  # More aggressive deduplication
```

3. **Increase max duration:**
```env
   MAX_CAPTION_DURATION=600  # 10 minutes maximum
```

### For Low-Volume Cameras (<20 frames/hour)

1. **Decrease MIN_CAPTION_DURATION:**
```env
   MIN_CAPTION_DURATION=30  # 30 seconds minimum
```

2. **Keep similarity threshold strict:**
```env
   CAPTION_SIMILARITY_THRESHOLD=0.95  # Keep high quality
```

## Best Practices

1. ✅ **Monitor migration task logs daily**
2. ✅ **Run preview before clearing cache**
3. ✅ **Test configuration changes on single camera first**
4. ✅ **Keep Redis memory below 80% capacity**
5. ✅ **Backup Neo4j before major changes**
6. ✅ **Use manual migration for camera removal**

## FAQ

**Q: Why 2 hours TTL?**
A: Balances real-time access (RAG queries) with storage efficiency. Most queries are for recent data.

**Q: Can I change TTL per camera?**
A: No, currently fixed at 2 hours for all cameras. This ensures consistent migration behavior.

**Q: What happens if migration fails?**
A: Keys remain in Redis until next migration check (60 seconds). After 3 retries, task fails but data preserved.

**Q: Can I disable deduplication?**
A: Set `CAPTION_SIMILARITY_THRESHOLD=1.0` to disable (requires 100% match = effectively disabled).

**Q: How to recover lost data?**
A: Data lost only if Redis cleared without migration. Always use `migrate_first=true` when clearing cache.

## Support

For issues or questions:
- Check logs: `backend/logs/cctview_*.log`
- Test migration: `python backend/scripts/test_migration.py`
- API status: `GET /api/v1/migration/status`