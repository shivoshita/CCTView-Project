#!/usr/bin/env python3
"""
View all data stored in Neo4j
"""

from neo4j import GraphDatabase
from datetime import datetime
import json

# Connect to Neo4j
driver = GraphDatabase.driver(
    "bolt://localhost:7687",
    auth=("neo4j", "shivo@netweb12345")
)

print("=" * 80)
print("📊 NEO4J DATABASE VIEWER - CCTView")
print("=" * 80)

with driver.session() as session:
    # 1. Count all nodes by type
    print("\n📦 NODE COUNTS:")
    print("-" * 80)
    result = session.run("""
        MATCH (n)
        RETURN labels(n)[0] as NodeType, count(n) as Count
        ORDER BY Count DESC
    """)
    
    total_nodes = 0
    for record in result:
        node_type = record["NodeType"] or "Unknown"
        count = record["Count"]
        total_nodes += count
        print(f"   {node_type:20} : {count:5} nodes")
    
    print(f"\n   {'TOTAL':20} : {total_nodes:5} nodes")
    
    # 2. List all cameras
    print("\n" + "=" * 80)
    print("🎥 CAMERAS:")
    print("-" * 80)
    result = session.run("""
        MATCH (c:Camera)
        RETURN c.id, c.name, c.location, c.status, c.stream_url
        ORDER BY c.created_at DESC
    """)
    
    cameras = list(result)
    for i, record in enumerate(cameras, 1):
        print(f"\n   {i}. {record['c.name']}")
        print(f"      ID: {record['c.id']}")
        print(f"      Location: {record['c.location']}")
        print(f"      Status: {record['c.status']}")
        print(f"      Stream: {record['c.stream_url'][:60]}...")
    
    # 3. Count events per camera
    print("\n" + "=" * 80)
    print("📊 EVENTS PER CAMERA:")
    print("-" * 80)
    result = session.run("""
        MATCH (c:Camera)-[:CAPTURED]->(e:Event)
        RETURN c.id, c.name, count(e) as EventCount
        ORDER BY EventCount DESC
    """)
    
    for record in result:
        print(f"   {record['c.name']:30} : {record['EventCount']:5} events")
    
    # 4. Recent events with captions
    print("\n" + "=" * 80)
    print("🔥 RECENT EVENTS (Last 15):")
    print("-" * 80)
    result = session.run("""
        MATCH (c:Camera)-[:CAPTURED]->(e:Event)
        RETURN c.name, e.id, e.timestamp, e.caption, e.confidence
        ORDER BY e.timestamp DESC
        LIMIT 15
    """)
    
    for i, record in enumerate(result, 1):
        timestamp = record['e.timestamp']
        if hasattr(timestamp, 'isoformat'):
            timestamp_str = timestamp.isoformat()
        else:
            timestamp_str = str(timestamp)
        
        print(f"\n   {i}. Camera: {record['c.name']}")
        print(f"      Time: {timestamp_str}")
        print(f"      Caption: {record['e.caption']}")
        print(f"      Confidence: {record['e.confidence']:.2%}")
        print(f"      Event ID: {record['e.id']}")
    
    # 5. Check for other node types
    print("\n" + "=" * 80)
    print("🔍 OTHER DATA:")
    print("-" * 80)
    
    # Check for persons
    result = session.run("MATCH (p:TrackedPerson) RETURN count(p) as count")
    person_count = result.single()['count']
    if person_count > 0:
        print(f"   Tracked Persons: {person_count}")
    
    # Check for anomalies
    result = session.run("MATCH (a:Anomaly) RETURN count(a) as count")
    anomaly_count = result.single()['count']
    if anomaly_count > 0:
        print(f"   Anomalies: {anomaly_count}")
    
    # Check for users
    result = session.run("MATCH (u:User) RETURN count(u) as count")
    user_count = result.single()['count']
    if user_count > 0:
        print(f"   Users: {user_count}")
    
    # 6. Relationship counts
    print("\n" + "=" * 80)
    print("🔗 RELATIONSHIPS:")
    print("-" * 80)
    result = session.run("""
        MATCH ()-[r]->()
        RETURN type(r) as RelType, count(r) as Count
        ORDER BY Count DESC
    """)
    
    for record in result:
        print(f"   {record['RelType']:30} : {record['Count']:5}")

driver.close()

print("\n" + "=" * 80)
print("✅ Done!")
print("=" * 80)