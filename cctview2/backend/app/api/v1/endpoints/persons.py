# FILE LOCATION: backend/app/api/v1/endpoints/persons.py

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse, FileResponse
from typing import Optional
import logging
from datetime import datetime
import uuid
from pathlib import Path
import shutil

from app.db.neo4j.client import neo4j_client
from app.ai.models.reid_model import PersonReID

router = APIRouter()
logger = logging.getLogger(__name__)

# Initialize Re-ID model for feature extraction
reid_model = PersonReID()

# Directory for storing person photos
PERSON_PHOTOS_DIR = Path("data/person_photos")
PERSON_PHOTOS_DIR.mkdir(parents=True, exist_ok=True)


def serialize_neo4j_data(data):
    """Convert Neo4j data types to JSON-serializable formats"""
    if isinstance(data, dict):
        return {k: serialize_neo4j_data(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [serialize_neo4j_data(item) for item in data]
    elif hasattr(data, 'iso_format'):  # Neo4j DateTime
        return data.iso_format()
    elif hasattr(data, '__dict__'):  # Neo4j objects
        return str(data)
    return data


@router.post("/register")
async def register_person(
    image: UploadFile = File(...),
    name: str = Form(...),
    employee_id: str = Form(...),
    office: str = Form(...),
    blood_group: str = Form(...)
):
    """
    Register a new person with face photo and details
    
    - Extracts face features using Re-ID model
    - Stores photo in filesystem
    - Creates Person node in Neo4j
    """
    try:
        logger.info(f"📝 Registering new person: {name} ({employee_id})")
        
        # Generate unique person ID
        person_id = f"person_{uuid.uuid4().hex[:12]}"
        
        # Read image file
        contents = await image.read()
        
        # Save photo to filesystem
        photo_filename = f"{person_id}.jpg"
        photo_path = PERSON_PHOTOS_DIR / photo_filename
        
        with open(photo_path, 'wb') as f:
            f.write(contents)
        
        logger.info(f"💾 Photo saved: {photo_path}")
        
        # Extract face features using Re-ID model
        try:
            import cv2
            import numpy as np
            
            # Decode image
            nparr = np.frombuffer(contents, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if img is None:
                raise ValueError("Failed to decode image")
            
            # Extract features
            features = reid_model.extract_features(img)
            
            # Convert to list for JSON serialization
            features_list = features.tolist()
            
            logger.info(f"🧠 Face features extracted: {len(features_list)} dimensions")
            
        except Exception as e:
            logger.error(f"❌ Feature extraction failed: {e}")
            # Delete saved photo
            photo_path.unlink(missing_ok=True)
            raise HTTPException(
                status_code=400,
                detail=f"Failed to extract face features: {str(e)}"
            )
        
        # Create Person node in Neo4j
        query = """
        CREATE (p:TrackedPerson {
            id: $person_id,
            name: $name,
            employee_id: $employee_id,
            office: $office,
            blood_group: $blood_group,
            photo_path: $photo_path,
            appearance_features: $features,
            status: 'registered',
            registered_at: datetime($timestamp),
            first_seen: null,
            last_seen: null,
            total_appearances: 0
        })
        RETURN p
        """
        
        result = await neo4j_client.async_execute_query(query, {
            "person_id": person_id,
            "name": name,
            "employee_id": employee_id,
            "office": office,
            "blood_group": blood_group,
            "photo_path": str(photo_path),
            "features": features_list,
            "timestamp": datetime.now().isoformat()
        })
        
        if not result:
            raise HTTPException(status_code=500, detail="Failed to create person record")
        
        # Serialize the Neo4j response
        person_data = serialize_neo4j_data(dict(result[0]['p']))
        
        # Remove features from response (too large)
        person_data.pop('appearance_features', None)
        
        logger.info(f"✅ Person registered successfully: {person_id}")
        logger.info(f"   Name: {name}")
        logger.info(f"   Employee ID: {employee_id}")
        logger.info(f"   Office: {office}")
        logger.info(f"   Feature dimensions: {len(features_list)}")
        
        return {
            "success": True,
            "message": "Person registered successfully",
            "person_id": person_id,
            "data": person_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error registering person: {e}")
        # Cleanup photo if exists
        if 'photo_path' in locals():
            Path(photo_path).unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{person_id}")
async def get_person(person_id: str):
    """Get person details by ID"""
    try:
        query = """
        MATCH (p:TrackedPerson {id: $person_id})
        RETURN p
        """
        
        result = await neo4j_client.async_execute_query(query, {
            "person_id": person_id
        })
        
        if not result:
            raise HTTPException(status_code=404, detail="Person not found")
        
        person_data = serialize_neo4j_data(dict(result[0]['p']))
        
        # Remove features (too large for response)
        person_data.pop('appearance_features', None)
        
        return person_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching person: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/")
async def get_all_persons(
    status: Optional[str] = None,
    limit: int = 100,
    skip: int = 0
):
    """Get all registered persons"""
    try:
        # Build query with optional filters
        where_clause = ""
        if status:
            where_clause = "WHERE p.status = $status"
        
        query = f"""
        MATCH (p:TrackedPerson)
        {where_clause}
        RETURN p
        ORDER BY p.registered_at DESC
        SKIP $skip
        LIMIT $limit
        """
        
        result = await neo4j_client.async_execute_query(query, {
            "status": status,
            "skip": skip,
            "limit": limit
        })
        
        persons = []
        for record in result:
            person_data = serialize_neo4j_data(dict(record['p']))
            # Remove features
            person_data.pop('appearance_features', None)
            persons.append(person_data)
        
        logger.info(f"📋 Retrieved {len(persons)} persons")
        
        return {
            "total": len(persons),
            "persons": persons
        }
        
    except Exception as e:
        logger.error(f"Error fetching persons: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{person_id}")
async def delete_person(person_id: str):
    """Delete a registered person"""
    try:
        # Get person data first
        query_get = """
        MATCH (p:TrackedPerson {id: $person_id})
        RETURN p.photo_path as photo_path, p.name as name
        """
        
        result = await neo4j_client.async_execute_query(query_get, {
            "person_id": person_id
        })
        
        if not result:
            raise HTTPException(status_code=404, detail="Person not found")
        
        photo_path = result[0].get('photo_path')
        person_name = result[0].get('name')
        
        # Delete from Neo4j
        query_delete = """
        MATCH (p:TrackedPerson {id: $person_id})
        DETACH DELETE p
        """
        
        await neo4j_client.async_execute_query(query_delete, {
            "person_id": person_id
        })
        
        # Delete photo file
        if photo_path:
            photo_file = Path(photo_path)
            photo_file.unlink(missing_ok=True)
        
        logger.info(f"✅ Person deleted: {person_name} ({person_id})")
        
        return {
            "success": True,
            "message": "Person deleted successfully",
            "person_id": person_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting person: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{person_id}/photo")
async def get_person_photo(person_id: str):
    """Get person's photo"""
    try:
        query = """
        MATCH (p:TrackedPerson {id: $person_id})
        RETURN p.photo_path as photo_path
        """
        
        result = await neo4j_client.async_execute_query(query, {
            "person_id": person_id
        })
        
        if not result or not result[0].get('photo_path'):
            raise HTTPException(status_code=404, detail="Photo not found")
        
        photo_path = Path(result[0]['photo_path'])
        
        if not photo_path.exists():
            raise HTTPException(status_code=404, detail="Photo file not found")
        
        return FileResponse(photo_path, media_type="image/jpeg")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching photo: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{person_id}")
async def update_person(
    person_id: str,
    name: Optional[str] = Form(None),
    employee_id: Optional[str] = Form(None),
    office: Optional[str] = Form(None),
    blood_group: Optional[str] = Form(None),
    status: Optional[str] = Form(None)
):
    """Update person details"""
    try:
        # Check if person exists
        query_check = """
        MATCH (p:TrackedPerson {id: $person_id})
        RETURN p
        """
        
        result = await neo4j_client.async_execute_query(query_check, {
            "person_id": person_id
        })
        
        if not result:
            raise HTTPException(status_code=404, detail="Person not found")
        
        # Build update query
        update_fields = []
        params = {"person_id": person_id}
        
        if name is not None:
            update_fields.append("p.name = $name")
            params["name"] = name
        
        if employee_id is not None:
            update_fields.append("p.employee_id = $employee_id")
            params["employee_id"] = employee_id
        
        if office is not None:
            update_fields.append("p.office = $office")
            params["office"] = office
        
        if blood_group is not None:
            update_fields.append("p.blood_group = $blood_group")
            params["blood_group"] = blood_group
        
        if status is not None:
            update_fields.append("p.status = $status")
            params["status"] = status
        
        if not update_fields:
            person_data = serialize_neo4j_data(dict(result[0]['p']))
            person_data.pop('appearance_features', None)
            return person_data
        
        query_update = f"""
        MATCH (p:TrackedPerson {{id: $person_id}})
        SET {', '.join(update_fields)}
        RETURN p
        """
        
        result = await neo4j_client.async_execute_query(query_update, params)
        
        person_data = serialize_neo4j_data(dict(result[0]['p']))
        person_data.pop('appearance_features', None)
        
        logger.info(f"✅ Person updated: {person_id}")
        
        return person_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating person: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{person_id}/appearances")
async def get_person_appearances(
    person_id: str,
    limit: int = 50,
    skip: int = 0
):
    """Get person's appearance history across cameras"""
    try:
        query = """
        MATCH (p:TrackedPerson {id: $person_id})-[r:APPEARED_IN]->(e:Event)
        RETURN e, r
        ORDER BY e.timestamp DESC
        SKIP $skip
        LIMIT $limit
        """
        
        result = await neo4j_client.async_execute_query(query, {
            "person_id": person_id,
            "skip": skip,
            "limit": limit
        })
        
        appearances = []
        for record in result:
            event_data = serialize_neo4j_data(dict(record['e']))
            relationship_data = serialize_neo4j_data(dict(record['r']))
            
            appearances.append({
                "event": event_data,
                "confidence": relationship_data.get('confidence', 0.0),
                "timestamp": relationship_data.get('timestamp')
            })
        
        logger.info(f"📍 Retrieved {len(appearances)} appearances for person {person_id}")
        
        return {
            "person_id": person_id,
            "total": len(appearances),
            "appearances": appearances
        }
        
    except Exception as e:
        logger.error(f"Error fetching appearances: {e}")
        raise HTTPException(status_code=500, detail=str(e))