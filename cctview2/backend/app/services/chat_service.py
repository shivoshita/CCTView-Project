# FILE LOCATION: backend/app/services/chat_service.py

"""
Chat Service
Business logic layer for RAG chatbot interactions
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
import uuid

from app.rag.response_generator import ResponseGenerator
from app.db.neo4j.client import neo4j_client

logger = logging.getLogger(__name__)


class ChatService:
    """Service for handling chat interactions"""
    
    def __init__(self):
        self.response_generator = ResponseGenerator()
        logger.info("💬 Chat Service initialized")
    
    async def send_message(
        self,
        message: str,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Process user message and generate response
        
        Args:
            message: User's message/query
            user_id: Optional user identifier
            session_id: Optional session identifier
            
        Returns:
            Complete chat response with answer and metadata
        """
        try:
            logger.info(f"💬 Received message: {message[:100]}...")
            
            # Generate or use existing session ID
            if not session_id:
                session_id = f"session_{uuid.uuid4().hex[:12]}"
            
            # Get conversation history for context
            conversation_history = await self.response_generator.get_conversation_history(
                session_id,
                limit=6  # Last 3 exchanges
            )
            
            # Generate response using RAG pipeline
            response = await self.response_generator.generate_response(
                user_query=message,
                user_id=user_id,
                session_id=session_id,
                conversation_history=conversation_history
            )
            
            # Add session info
            response['session_id'] = session_id
            
            logger.info(f"✅ Message processed successfully (session: {session_id})")
            return response
            
        except Exception as e:
            logger.error(f"❌ Error processing message: {e}")
            import traceback
            traceback.print_exc()
            
            return {
                'success': False,
                'error': str(e),
                'answer': 'I apologize, but I encountered an error. Please try again.',
                'session_id': session_id or f"session_{uuid.uuid4().hex[:12]}"
            }
    
    async def get_session_history(
        self,
        session_id: str,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Get conversation history for a session
        
        Args:
            session_id: Session identifier
            limit: Maximum number of messages to return
            
        Returns:
            List of messages with queries and responses
        """
        try:
            query = """
            MATCH (q:QueryLog {session_id: $session_id})
            RETURN 
                q.id as query_id,
                q.query_text as query,
                q.timestamp as timestamp,
                q.intent as intent,
                q.event_count as event_count,
                q.success as success
            ORDER BY q.timestamp ASC
            LIMIT $limit
            """
            
            results = await neo4j_client.async_execute_query(query, {
                'session_id': session_id,
                'limit': limit
            })
            
            history = []
            for record in results:
                timestamp = record.get('timestamp')
                if timestamp:
                    try:
                        if isinstance(timestamp, str):
                            dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                        else:
                            dt = timestamp
                        time_str = dt.strftime('%Y-%m-%d %H:%M:%S')
                    except Exception:
                        time_str = str(timestamp)
                else:
                    time_str = 'Unknown'
                
                history.append({
                    'query_id': record.get('query_id'),
                    'query': record.get('query'),
                    'timestamp': time_str,
                    'intent': record.get('intent'),
                    'event_count': record.get('event_count', 0),
                    'success': record.get('success', False)
                })
            
            logger.info(f"📜 Retrieved {len(history)} messages for session {session_id}")
            return history
            
        except Exception as e:
            logger.error(f"❌ Error getting session history: {e}")
            return []
    
    async def get_suggested_queries(
        self,
        context: Optional[str] = None
    ) -> List[str]:
        """
        Get suggested queries based on context or general suggestions
        
        Args:
            context: Optional context to tailor suggestions
            
        Returns:
            List of suggested query strings
        """
        default_suggestions = [
            "What happened today at the main entrance?",
            "Show me events from yesterday",
            "Any unusual activity in the past hour?",
            "What was happening at 5 PM?",
            "Show me all deliveries this week",
            "Were there any people detected in the parking lot?",
            "What happened between 2 PM and 4 PM?",
            "Show me activity from all cameras today"
        ]
        
        # If context provided, could use LLM to generate contextual suggestions
        # For now, return default suggestions
        return default_suggestions[:5]
    
    async def get_chat_statistics(
        self,
        user_id: Optional[str] = None,
        days: int = 7
    ) -> Dict[str, Any]:
        """
        Get statistics about chat usage
        
        Args:
            user_id: Optional user identifier for user-specific stats
            days: Number of days to analyze
            
        Returns:
            Statistics dictionary
        """
        try:
            stats = await self.response_generator.get_query_analytics(
                user_id=user_id,
                days=days
            )
            
            # Add additional statistics
            if user_id:
                # Get most active cameras
                query = """
                MATCH (u:User {id: $user_id})-[:ASKED]->(q:QueryLog)-[:REFERENCES]->(e:Event)<-[:CAPTURED]-(c:Camera)
                WHERE q.timestamp >= datetime() - duration({days: $days})
                RETURN c.name as camera, count(e) as events
                ORDER BY events DESC
                LIMIT 5
                """
                
                camera_results = await neo4j_client.async_execute_query(query, {
                    'user_id': user_id,
                    'days': days
                })
                
                stats['top_cameras'] = [
                    {'camera': r.get('camera'), 'events': r.get('events')}
                    for r in camera_results
                ]
            
            return stats
            
        except Exception as e:
            logger.error(f"❌ Error getting chat statistics: {e}")
            return {}
    
    async def clear_session(self, session_id: str) -> bool:
        """
        Clear/delete a conversation session
        
        Args:
            session_id: Session identifier to clear
            
        Returns:
            True if successful, False otherwise
        """
        try:
            query = """
            MATCH (q:QueryLog {session_id: $session_id})
            DETACH DELETE q
            RETURN count(q) as deleted_count
            """
            
            result = await neo4j_client.async_execute_query(query, {
                'session_id': session_id
            })
            
            deleted_count = result[0].get('deleted_count', 0) if result else 0
            logger.info(f"🗑️ Cleared session {session_id}: {deleted_count} queries deleted")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Error clearing session: {e}")
            return False
    
    async def get_popular_queries(
        self,
        limit: int = 10,
        days: int = 30
    ) -> List[Dict[str, Any]]:
        """
        Get most popular queries across all users
        
        Args:
            limit: Number of queries to return
            days: Time period to analyze
            
        Returns:
            List of popular queries with counts
        """
        try:
            query = """
            MATCH (q:QueryLog)
            WHERE q.timestamp >= datetime() - duration({days: $days})
            WITH toLower(q.query_text) as query_lower, 
                 q.query_text as original_query,
                 count(*) as query_count
            RETURN original_query as query, query_count
            ORDER BY query_count DESC
            LIMIT $limit
            """
            
            results = await neo4j_client.async_execute_query(query, {
                'days': days,
                'limit': limit
            })
            
            popular_queries = [
                {
                    'query': r.get('query'),
                    'count': r.get('query_count', 0)
                }
                for r in results
            ]
            
            logger.info(f"📊 Retrieved {len(popular_queries)} popular queries")
            return popular_queries
            
        except Exception as e:
            logger.error(f"❌ Error getting popular queries: {e}")
            return []
    
    async def export_conversation(
        self,
        session_id: str
    ) -> Dict[str, Any]:
        """
        Export conversation history in a structured format
        
        Args:
            session_id: Session identifier
            
        Returns:
            Structured conversation data
        """
        try:
            history = await self.get_session_history(session_id, limit=1000)
            
            export_data = {
                'session_id': session_id,
                'exported_at': datetime.now().isoformat(),
                'message_count': len(history),
                'messages': history
            }
            
            logger.info(f"📦 Exported conversation {session_id} with {len(history)} messages")
            return export_data
            
        except Exception as e:
            logger.error(f"❌ Error exporting conversation: {e}")
            return {
                'error': str(e),
                'session_id': session_id
            }


# Singleton instance
chat_service = ChatService()