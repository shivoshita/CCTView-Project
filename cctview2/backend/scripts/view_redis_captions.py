#!/usr/bin/env python3
"""
View all captions and embeddings stored in Redis
"""

import redis
import numpy as np
from datetime import datetime

# Connect to Redis
r = redis.Redis(host='localhost', port=6379, db=0)

print("=" * 80)
print("📊 REDIS STORAGE VIEWER - CCTView")
print("=" * 80)

# Get all caption keys
caption_keys = r.keys('caption:*')
embedding_keys = r.keys('embedding:*')
meta_keys = r.keys('meta:*')

print(f"\n📝 Total Captions: {len(caption_keys)}")
print(f"🧠 Total Embeddings: {len(embedding_keys)}")
print(f"ℹ️  Total Metadata: {len(meta_keys)}")

# Group by camera
cameras = {}
for key in caption_keys:
    key_str = key.decode('utf-8')
    parts = key_str.split(':')
    if len(parts) >= 3:
        camera_id = parts[1]
        timestamp = parts[2]
        
        if camera_id not in cameras:
            cameras[camera_id] = []
        
        caption = r.get(key).decode('utf-8') if r.get(key) else "N/A"
        ttl = r.ttl(key)
        
        cameras[camera_id].append({
            'timestamp': timestamp,
            'caption': caption,
            'ttl': ttl
        })

# Display by camera
print("\n" + "=" * 80)
print("📹 CAPTIONS BY CAMERA")
print("=" * 80)

for camera_id, events in cameras.items():
    print(f"\n🎥 Camera: {camera_id}")
    print(f"   Events: {len(events)}")
    print("-" * 80)
    
    # Sort by timestamp (most recent first)
    events.sort(key=lambda x: x['timestamp'], reverse=True)
    
    # Show last 10 events
    for i, event in enumerate(events[:10], 1):
        ttl_mins = event['ttl'] // 60 if event['ttl'] > 0 else 0
        print(f"\n   {i}. Time: {event['timestamp']}")
        print(f"      Caption: {event['caption']}")
        print(f"      TTL: {event['ttl']}s ({ttl_mins} minutes remaining)")

# Memory stats
print("\n" + "=" * 80)
print("💾 MEMORY STATISTICS")
print("=" * 80)

info = r.info('memory')
used_memory_mb = info['used_memory'] / (1024 * 1024)
used_memory_human = info['used_memory_human']
peak_memory_mb = info['used_memory_peak'] / (1024 * 1024)

print(f"\nUsed Memory: {used_memory_mb:.2f} MB ({used_memory_human})")
print(f"Peak Memory: {peak_memory_mb:.2f} MB")
print(f"Total Keys: {r.dbsize()}")

# Check embedding dimensions
if embedding_keys:
    sample_key = embedding_keys[0]
    sample_embedding = r.get(sample_key)
    if sample_embedding:
        embedding_array = np.frombuffer(sample_embedding, dtype=np.float32)
        print(f"\nEmbedding Dimensions: {len(embedding_array)}")
        print(f"Sample embedding (first 5 values): {embedding_array[:5]}")

print("\n" + "=" * 80)