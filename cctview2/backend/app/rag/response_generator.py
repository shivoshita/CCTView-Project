# FILE LOCATION: backend/app/rag/response_generator.py

"""
Response Generator for RAG Chatbot
Orchestrates the entire RAG pipeline: Query → Context → LLM → Response
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
import uuid

from app.rag.query_processor import QueryProcessor
from app.rag.context_builder import ContextBuilder
from app.rag.llm_integration import LLMIntegration
from app.db.neo4j.client import neo4j_client

logger = logging.getLogger(__name__)


class ResponseGenerator:
    """Main orchestrator for RAG pipeline"""
    
    def __init__(self):
        self.query_processor = QueryProcessor()
        self.context_builder = ContextBuilder()
        self.llm = LLMIntegration()
        
        logger.info("✅ Response Generator initialized")
    
    async def generate_response(
        self,
        user_query: str,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """
        Generate complete response for user query
        
        Args:
            user_query: User's natural language query
            user_id: User identifier for logging
            session_id: Conversation session ID
            conversation_history: Previous messages in conversation
            
        Returns:
            Complete response with answer, sources, and metadata
        """
        start_time = datetime.now()
        query_id = f"query_{uuid.uuid4().hex[:12]}"
        
        logger.info(f"🚀 Processing query [{query_id}]: {user_query[:100]}...")
        
        try:
            # Step 1: Process query
            logger.info(f"[{query_id}] Step 1/4: Processing query...")
            processed_query = self.query_processor.process_query(user_query)
            
            # Step 2: Build context from Neo4j
            logger.info(f"[{query_id}] Step 2/4: Building context from Neo4j...")
            context = await self.context_builder.build_context(
                processed_query,
                max_events=15
            )
            
            # Step 3: Generate LLM response
            logger.info(f"[{query_id}] Step 3/4: Generating LLM response...")
            llm_response = await self.llm.generate_response(
                user_query,
                context,
                conversation_history
            )
            
            # Step 4: Generate follow-up suggestions
            logger.info(f"[{query_id}] Step 4/4: Generating follow-up suggestions...")
            suggestions = await self.llm.generate_follow_up_suggestions(
                user_query,
                context
            )
            
            # Calculate processing time
            processing_time = (datetime.now() - start_time).total_seconds()
            
            # Build complete response
            response = {
                'query_id': query_id,
                'query': user_query,
                'answer': llm_response.get('answer', ''),
                'summary': llm_response.get('summary', ''),
                'key_events': llm_response.get('key_events', []),
                'sources': self._format_sources(context.get('events', [])),
                'event_count': context.get('event_count', 0),
                'cameras': context.get('cameras', []),
                'time_range': context.get('time_range'),
                'follow_up_suggestions': suggestions,
                'metadata': {
                    'intent': processed_query.get('intent'),
                    'tokens_used': llm_response.get('tokens_used', 0),
                    'model': llm_response.get('model', ''),
                    'processing_time_seconds': round(processing_time, 2),
                    'timestamp': datetime.now().isoformat()
                },
                'success': llm_response.get('success', False)
            }
            
            # Log query to Neo4j
            if user_id:
                await self._log_query(
                    query_id,
                    user_id,
                    user_query,
                    response,
                    session_id
                )
            
            logger.info(f"✅ [{query_id}] Response generated in {processing_time:.2f}s")
            return response
            
        except Exception as e:
            logger.error(f"❌ [{query_id}] Error generating response: {e}")
            import traceback
            traceback.print_exc()
            
            return {
                'query_id': query_id,
                'query': user_query,
                'answer': 'I apologize, but I encountered an error processing your request. Please try again or rephrase your question.',
                'summary': '',
                'key_events': [],
                'sources': [],
                'event_count': 0,
                'cameras': [],
                'follow_up_suggestions': [
                    'Show me recent events',
                    'What happened today?',
                    'List all active cameras'
                ],
                'metadata': {
                    'error': str(e),
                    'timestamp': datetime.now().isoformat()
                },
                'success': False
            }
    
    def _format_sources(self, events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Format event sources for frontend display"""
        formatted_sources = []
        
        for event in events:
            # Try to get start_time first (new format), fallback to timestamp (old format)
            timestamp = event.get('start_time') or event.get('timestamp')
            end_time = event.get('end_time')
            duration = event.get('duration', 0)
            frame_count = event.get('frame_count', 1)
            
            if timestamp:
                try:
                    if isinstance(timestamp, str):
                        dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                    else:
                        dt = timestamp
                    time_str = dt.strftime('%Y-%m-%d %H:%M:%S')
                    date_str = dt.strftime('%B %d, %Y')
                    time_only = dt.strftime('%I:%M %p')
                    
                    # Format time range if end_time exists (NEW)
                    if end_time:
                        try:
                            if isinstance(end_time, str):
                                dt_end = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
                            else:
                                dt_end = end_time
                            
                            # If same day, show time range: "2:00 PM - 2:05 PM"
                            if dt.date() == dt_end.date():
                                time_range = f"{dt.strftime('%I:%M %p')} - {dt_end.strftime('%I:%M %p')}"
                            else:
                                # Different days: show full range
                                time_range = f"{dt.strftime('%Y-%m-%d %I:%M %p')} - {dt_end.strftime('%Y-%m-%d %I:%M %p')}"
                        except Exception:
                            time_range = time_only
                    else:
                        time_range = time_only
                        
                except Exception:
                    time_str = str(timestamp)
                    date_str = 'Unknown date'
                    time_only = 'Unknown time'
                    time_range = 'Unknown time'
            else:
                time_str = 'Unknown time'
                date_str = 'Unknown date'
                time_only = 'Unknown time'
                time_range = 'Unknown time'
            
            formatted_sources.append({
                'event_id': event.get('event_id'),
                'timestamp': time_str,
                'date': date_str,
                'time': time_only,
                'time_range': time_range,  # NEW: Show time range for grouped events
                'duration': duration,       # NEW: Duration in seconds
                'frame_count': frame_count, # NEW: Number of frames merged
                'camera': {
                    'id': event.get('camera_id'),
                    'name': event.get('camera_name', 'Unknown'),
                    'location': event.get('camera_location', 'Unknown')
                },
                'caption': event.get('caption', 'No description'),
                'confidence': event.get('confidence', 0),
                'video_reference': event.get('video_reference')
            })
        
        return formatted_sources
    
    async def _log_query(
        self,
        query_id: str,
        user_id: str,
        query_text: str,
        response: Dict[str, Any],
        session_id: Optional[str] = None
    ):
        """Log query to Neo4j for analytics"""
        try:
            query = """
            MATCH (u:User {id: $user_id})
            CREATE (q:QueryLog {
                id: $query_id,
                query_text: $query_text,
                intent: $intent,
                event_count: $event_count,
                response_time_ms: $response_time_ms,
                success: $success,
                timestamp: datetime($timestamp),
                session_id: $session_id
            })
            CREATE (u)-[:ASKED]->(q)
            """
            
            # Link to events if available
            if response.get('sources'):
                query += """
                WITH q
                UNWIND $event_ids as event_id
                MATCH (e:Event {id: event_id})
                CREATE (q)-[:REFERENCES]->(e)
                """
            
            query += " RETURN q.id as query_id"
            
            params = {
                'query_id': query_id,
                'user_id': user_id,
                'query_text': query_text,
                'intent': response['metadata'].get('intent', 'unknown'),
                'event_count': response.get('event_count', 0),
                'response_time_ms': int(response['metadata'].get('processing_time_seconds', 0) * 1000),
                'success': response.get('success', False),
                'timestamp': datetime.now().isoformat(),
                'session_id': session_id or query_id,
                'event_ids': [s['event_id'] for s in response.get('sources', []) if s.get('event_id')]
            }
            
            await neo4j_client.async_execute_query(query, params)
            logger.debug(f"📝 Logged query {query_id} to Neo4j")
            
        except Exception as e:
            logger.error(f"❌ Error logging query: {e}")
    
    async def get_conversation_history(
        self,
        session_id: str,
        limit: int = 10
    ) -> List[Dict[str, str]]:
        """Retrieve conversation history from Neo4j"""
        try:
            query = """
            MATCH (q:QueryLog {session_id: $session_id})
            RETURN 
                q.query_text as query,
                q.timestamp as timestamp
            ORDER BY q.timestamp ASC
            LIMIT $limit
            """
            
            results = await neo4j_client.async_execute_query(query, {
                'session_id': session_id,
                'limit': limit
            })
            
            history = []
            for record in results:
                history.append({
                    'role': 'user',
                    'content': record.get('query', '')
                })
            
            return history
            
        except Exception as e:
            logger.error(f"❌ Error retrieving conversation history: {e}")
            return []
    
    async def get_query_analytics(
        self,
        user_id: Optional[str] = None,
        days: int = 7
    ) -> Dict[str, Any]:
        """Get analytics on user queries"""
        try:
            if user_id:
                query = """
                MATCH (u:User {id: $user_id})-[:ASKED]->(q:QueryLog)
                WHERE q.timestamp >= datetime() - duration({days: $days})
                RETURN 
                    count(q) as total_queries,
                    avg(q.response_time_ms) as avg_response_time,
                    sum(CASE WHEN q.success THEN 1 ELSE 0 END) as successful_queries,
                    collect(DISTINCT q.intent) as intents_used
                """
                params = {'user_id': user_id, 'days': days}
            else:
                query = """
                MATCH (q:QueryLog)
                WHERE q.timestamp >= datetime() - duration({days: $days})
                RETURN 
                    count(q) as total_queries,
                    avg(q.response_time_ms) as avg_response_time,
                    sum(CASE WHEN q.success THEN 1 ELSE 0 END) as successful_queries,
                    collect(DISTINCT q.intent) as intents_used
                """
                params = {'days': days}
            
            results = await neo4j_client.async_execute_query(query, params)
            
            if results:
                stats = dict(results[0])
                return {
                    'total_queries': stats.get('total_queries', 0),
                    'avg_response_time_ms': round(stats.get('avg_response_time', 0), 2),
                    'successful_queries': stats.get('successful_queries', 0),
                    'success_rate': round(
                        (stats.get('successful_queries', 0) / max(stats.get('total_queries', 1), 1)) * 100,
                        2
                    ),
                    'intents_used': stats.get('intents_used', []),
                    'period_days': days
                }
            
            return {}
            
        except Exception as e:
            logger.error(f"❌ Error getting query analytics: {e}")
            return {}