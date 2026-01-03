# In the Event node creation part, update to:

event_schema = """
CREATE CONSTRAINT event_id IF NOT EXISTS 
FOR (e:Event) REQUIRE e.id IS UNIQUE
"""

# Event properties (updated):
# - id: Unique event ID
# - timestamp: Primary timestamp (for compatibility)
# - start_time: When caption period started (NEW)
# - end_time: When caption period ended (NEW)
# - duration: Duration in seconds (NEW)
# - frame_count: Number of merged captions (NEW)
# - caption: Text description
# - confidence: AI confidence
# - video_reference: Reference to CCTV storage
# - retention_until: Expiry date