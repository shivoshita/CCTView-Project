# FILE LOCATION: backend/app/api/v1/endpoints/chat.py

"""
Chat API Endpoints
REST API for RAG chatbot interactions
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
import logging

from app.models.chat import (
    ChatMessageRequest,
    ChatMessageResponse,
    SessionHistoryResponse,
    SuggestedQueriesResponse,
    ChatStatisticsResponse
)
from app.services.chat_service import chat_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/message", response_model=ChatMessageResponse)
async def send_chat_message(request: ChatMessageRequest):
    """
    Send a message to the RAG chatbot and get a response
    
    **Example queries:**
    - "What happened today at the main entrance?"
    - "Show me events from yesterday between 2 PM and 4 PM"
    - "What was happening on July 14, 2025 at 5 PM?"
    - "Any unusual activity in the parking lot?"
    """
    try:
        logger.info(f"💬 Chat message received: {request.message[:100]}...")
        
        # Process message through RAG pipeline
        response = await chat_service.send_message(
            message=request.message,
            user_id=request.user_id,
            session_id=request.session_id
        )
        
        return response
        
    except Exception as e:
        logger.error(f"❌ Error processing chat message: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing message: {str(e)}"
        )


@router.get("/session/{session_id}/history", response_model=SessionHistoryResponse)
async def get_session_history(
    session_id: str,
    limit: int = Query(default=50, ge=1, le=1000)
):
    """
    Get conversation history for a session
    
    Args:
        session_id: Session identifier
        limit: Maximum number of messages to return (1-1000)
    """
    try:
        history = await chat_service.get_session_history(session_id, limit)
        
        return {
            'session_id': session_id,
            'message_count': len(history),
            'messages': history
        }
        
    except Exception as e:
        logger.error(f"❌ Error getting session history: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving history: {str(e)}"
        )


@router.delete("/session/{session_id}")
async def clear_session(session_id: str):
    """
    Clear/delete a conversation session
    
    Args:
        session_id: Session identifier to clear
    """
    try:
        success = await chat_service.clear_session(session_id)
        
        if success:
            return {
                'success': True,
                'message': f'Session {session_id} cleared successfully'
            }
        else:
            raise HTTPException(
                status_code=404,
                detail='Session not found or already cleared'
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error clearing session: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error clearing session: {str(e)}"
        )


@router.get("/suggestions", response_model=SuggestedQueriesResponse)
async def get_suggested_queries(
    context: Optional[str] = Query(None, description="Optional context for suggestions")
):
    """
    Get suggested queries for the user
    
    Args:
        context: Optional context to tailor suggestions
    """
    try:
        suggestions = await chat_service.get_suggested_queries(context)
        
        return {
            'suggestions': suggestions,
            'count': len(suggestions)
        }
        
    except Exception as e:
        logger.error(f"❌ Error getting suggestions: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error getting suggestions: {str(e)}"
        )


@router.get("/statistics", response_model=ChatStatisticsResponse)
async def get_chat_statistics(
    user_id: Optional[str] = Query(None, description="User ID for user-specific stats"),
    days: int = Query(default=7, ge=1, le=90, description="Number of days to analyze")
):
    """
    Get chat usage statistics
    
    Args:
        user_id: Optional user ID for user-specific statistics
        days: Number of days to analyze (1-90)
    """
    try:
        stats = await chat_service.get_chat_statistics(user_id, days)
        
        return stats
        
    except Exception as e:
        logger.error(f"❌ Error getting statistics: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving statistics: {str(e)}"
        )


@router.get("/popular-queries")
async def get_popular_queries(
    limit: int = Query(default=10, ge=1, le=50),
    days: int = Query(default=30, ge=1, le=90)
):
    """
    Get most popular queries
    
    Args:
        limit: Number of queries to return (1-50)
        days: Time period to analyze (1-90 days)
    """
    try:
        popular = await chat_service.get_popular_queries(limit, days)
        
        return {
            'queries': popular,
            'count': len(popular),
            'period_days': days
        }
        
    except Exception as e:
        logger.error(f"❌ Error getting popular queries: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving popular queries: {str(e)}"
        )


@router.get("/session/{session_id}/export")
async def export_conversation(session_id: str):
    """
    Export conversation history in JSON format
    
    Args:
        session_id: Session identifier to export
    """
    try:
        export_data = await chat_service.export_conversation(session_id)
        
        if 'error' in export_data:
            raise HTTPException(
                status_code=404,
                detail=export_data['error']
            )
        
        return export_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error exporting conversation: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error exporting conversation: {str(e)}"
        )


@router.post("/test")
async def test_chat_endpoint(query: str = Query(..., description="Test query")):
    """
    Test endpoint for quick chat queries
    
    Args:
        query: Test query string
    """
    try:
        response = await chat_service.send_message(
            message=query,
            user_id="test_user",
            session_id="test_session"
        )
        
        return {
            'query': query,
            'answer': response.get('answer'),
            'event_count': response.get('event_count', 0),
            'cameras': response.get('cameras', []),
            'success': response.get('success', False)
        }
        
    except Exception as e:
        logger.error(f"❌ Error in test endpoint: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Test failed: {str(e)}"
        )