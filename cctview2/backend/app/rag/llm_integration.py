# FILE LOCATION: backend/app/rag/llm_integration.py

"""
LLM Integration for RAG Chatbot
Supports both Ollama (local) and OpenAI (cloud) integration
"""

import logging
from typing import Dict, Any, List, Optional
import json
import ollama
from openai import AsyncOpenAI

from app.core.config import settings

logger = logging.getLogger(__name__)


class LLMIntegration:
    """LLM integration supporting both Ollama and OpenAI"""
    
    def __init__(self):
        self.provider = settings.LLM_PROVIDER.lower()
        
        if self.provider == "ollama":
            # Initialize Ollama
            self.model = settings.OLLAMA_MODEL
            self.base_url = settings.OLLAMA_BASE_URL
            self.timeout = settings.OLLAMA_TIMEOUT
            logger.info(f"✅ LLM Integration initialized with Ollama model: {self.model}")
            logger.info(f"🔗 Ollama URL: {self.base_url}")
            
            # Test Ollama connection
            self._test_ollama_connection()
            
        elif self.provider == "openai":
            # Initialize OpenAI
            if not settings.OPENAI_API_KEY:
                raise ValueError("OpenAI API key not configured")
            self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            self.model = settings.OPENAI_MODEL
            logger.info(f"✅ LLM Integration initialized with OpenAI model: {self.model}")
        else:
            raise ValueError(f"Unsupported LLM provider: {self.provider}")
        
        self.max_tokens = 1000
        self.temperature = 0.7
    
    def _test_ollama_connection(self):
        """Test if Ollama is running and model is available"""
        try:
            # List available models
            models_response = ollama.list()
            
            # Extract model names correctly
            available_models = []
            if isinstance(models_response, dict) and 'models' in models_response:
                for model in models_response['models']:
                    if isinstance(model, dict):
                        # Try different possible keys
                        model_name = model.get('name') or model.get('model') or str(model)
                        available_models.append(model_name)
            
            logger.info(f"📋 Available Ollama models: {', '.join(available_models) if available_models else 'None'}")
            
            # Check if requested model is available
            model_available = any(self.model in model for model in available_models)
            
            if not model_available and available_models:
                logger.warning(f"⚠️ Model '{self.model}' not found. Available models: {available_models}")
                logger.warning(f"Attempting to pull '{self.model}'...")
                ollama.pull(self.model)
                logger.info(f"✅ Model '{self.model}' pulled successfully")
            elif not available_models:
                logger.warning(f"⚠️ No models found. Pulling '{self.model}'...")
                ollama.pull(self.model)
                logger.info(f"✅ Model '{self.model}' pulled successfully")
            else:
                logger.info(f"✅ Model '{self.model}' is available")
            
        except Exception as e:
            logger.error(f"❌ Failed to connect to Ollama: {e}")
            logger.error("Make sure Ollama is running: 'ollama serve'")
            # Don't raise - allow startup to continue
            logger.warning("⚠️ Continuing without Ollama validation...")
    
    async def generate_response(
        self,
        user_query: str,
        context: Dict[str, Any],
        conversation_history: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """
        Generate natural language response using configured LLM
        
        Args:
            user_query: Original user query
            context: Context built from Neo4j events
            conversation_history: Previous conversation messages
            
        Returns:
            Dict with response text, sources, and metadata
        """
        if self.provider == "ollama":
            return await self._generate_ollama_response(user_query, context, conversation_history)
        else:
            return await self._generate_openai_response(user_query, context, conversation_history)
    
    async def _generate_ollama_response(
        self,
        user_query: str,
        context: Dict[str, Any],
        conversation_history: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """Generate response using Ollama"""
        try:
            logger.info(f"🤖 Generating Ollama response for query: {user_query[:50]}...")
            
            # Build system prompt
            system_prompt = self._build_system_prompt()
            
            # Build user message with context
            user_message = self._build_user_message(user_query, context)
            
            # Prepare messages
            messages = [{"role": "system", "content": system_prompt}]
            
            # Add conversation history if available
            if conversation_history:
                messages.extend(conversation_history[-6:])  # Last 3 exchanges
            
            # Add current query
            messages.append({"role": "user", "content": user_message})
            
            logger.debug(f"📤 Sending request to Ollama with {len(messages)} messages")
            
            # Call Ollama API (synchronous, but fast locally)
            response = ollama.chat(
                model=self.model,
                messages=messages,
                format='json',  # Request JSON output
                options={
                    'temperature': self.temperature,
                    'num_predict': self.max_tokens,
                }
            )
            
            # Parse response
            response_text = response['message']['content']
            
            try:
                response_data = json.loads(response_text)
            except json.JSONDecodeError:
                # If JSON parsing fails, create structured response
                logger.warning("⚠️ Failed to parse JSON, using plain text response")
                response_data = {
                    'answer': response_text,
                    'summary': '',
                    'key_events': []
                }
            
            logger.info(f"✅ Ollama response generated successfully")
            
            return {
                'success': True,
                'answer': response_data.get('answer', response_text),
                'summary': response_data.get('summary', ''),
                'key_events': response_data.get('key_events', []),
                'sources': context.get('events', []),
                'event_count': context.get('event_count', 0),
                'cameras': context.get('cameras', []),
                'time_range': context.get('time_range'),
                'tokens_used': response.get('eval_count', 0) + response.get('prompt_eval_count', 0),
                'model': self.model
            }
            
        except Exception as e:
            logger.error(f"❌ Error generating Ollama response: {e}")
            return {
                'success': False,
                'error': str(e),
                'answer': 'I apologize, but I encountered an error processing your request. Please ensure Ollama is running and try again.',
                'sources': [],
                'event_count': 0
            }
    
    async def _generate_openai_response(
        self,
        user_query: str,
        context: Dict[str, Any],
        conversation_history: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """Generate response using OpenAI"""
        try:
            logger.info(f"🤖 Generating OpenAI response for query: {user_query[:50]}...")
            
            # Build system prompt
            system_prompt = self._build_system_prompt()
            
            # Build user message with context
            user_message = self._build_user_message(user_query, context)
            
            # Prepare messages
            messages = [{"role": "system", "content": system_prompt}]
            
            # Add conversation history if available
            if conversation_history:
                messages.extend(conversation_history[-6:])  # Last 3 exchanges
            
            # Add current query
            messages.append({"role": "user", "content": user_message})
            
            logger.debug(f"📤 Sending request to OpenAI with {len(messages)} messages")
            
            # Call OpenAI API
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=self.max_tokens,
                temperature=self.temperature,
                response_format={"type": "json_object"}
            )
            
            # Parse response
            response_text = response.choices[0].message.content
            response_data = json.loads(response_text)
            
            logger.info(f"✅ OpenAI response generated successfully")
            
            return {
                'success': True,
                'answer': response_data.get('answer', ''),
                'summary': response_data.get('summary', ''),
                'key_events': response_data.get('key_events', []),
                'sources': context.get('events', []),
                'event_count': context.get('event_count', 0),
                'cameras': context.get('cameras', []),
                'time_range': context.get('time_range'),
                'tokens_used': response.usage.total_tokens,
                'model': self.model
            }
            
        except json.JSONDecodeError as e:
            logger.error(f"❌ Failed to parse OpenAI response as JSON: {e}")
            # Fallback to plain text response
            return {
                'success': True,
                'answer': response_text,
                'summary': '',
                'key_events': [],
                'sources': context.get('events', []),
                'event_count': context.get('event_count', 0),
                'cameras': context.get('cameras', []),
                'time_range': context.get('time_range'),
                'tokens_used': response.usage.total_tokens,
                'model': self.model
            }
        except Exception as e:
            logger.error(f"❌ Error generating OpenAI response: {e}")
            return {
                'success': False,
                'error': str(e),
                'answer': 'I apologize, but I encountered an error processing your request. Please try again.',
                'sources': [],
                'event_count': 0
            }
    
    def _build_system_prompt(self) -> str:
        """Build system prompt for the LLM"""
        return """You are an AI assistant for CCTView, an intelligent surveillance system. Your role is to help users understand what happened in their surveillance footage by analyzing event captions from multiple cameras.

IMPORTANT RULES:
1. **NEVER HALLUCINATE**: Only use information from the provided context (surveillance events)
2. **BE PRECISE**: Always cite specific timestamps, camera names, and locations
3. **BE CONCISE**: Provide clear, structured responses
4. **ACKNOWLEDGE GAPS**: If information is missing or unclear, say so
5. **NO ASSUMPTIONS**: Don't make up details not in the context

RESPONSE FORMAT (JSON):
{
  "answer": "Detailed answer to the user's question with specific timestamps and camera references",
  "summary": "Brief 1-2 sentence summary of what happened",
  "key_events": [
    {
      "time": "2025-07-14 17:00:00",
      "camera": "Main Entrance",
      "description": "Person entered building"
    }
  ]
}

ANALYSIS GUIDELINES:
- Group related events together chronologically
- Highlight unusual or important activities
- Mention quiet periods if relevant
- Compare activity across different cameras if applicable
- Use natural, conversational language

If no events are found, politely explain that no surveillance data matches the query."""
    
    def _build_user_message(self, query: str, context: Dict[str, Any]) -> str:
        """Build user message with query and context"""
        
        message_parts = [
            f"USER QUERY: {query}",
            "\n" + "="*80 + "\n",
            "SURVEILLANCE CONTEXT:\n"
        ]
        
        # Add context info
        if context.get('event_count', 0) == 0:
            message_parts.append("No surveillance events found matching the query.")
        else:
            # Add summary
            message_parts.append(f"Total Events: {context['event_count']}")
            
            if context.get('cameras'):
                message_parts.append(f"Cameras Involved: {', '.join(context['cameras'])}")
            
            if context.get('time_range'):
                time_range = context['time_range']
                if time_range.get('date'):
                    message_parts.append(f"Date: {time_range['date']}")
                if time_range.get('time_of_day'):
                    message_parts.append(f"Time: {time_range['time_of_day']}")
            
            message_parts.append("\n" + "-"*80 + "\n")
            message_parts.append("EVENTS:\n")
            
            # Add individual events
            for event in context.get('events', [])[:15]:  # Limit to 15 events
                timestamp = event.get('timestamp', 'Unknown time')
                camera = event.get('camera_name', 'Unknown camera')
                location = event.get('camera_location', 'Unknown location')
                caption = event.get('caption', 'No description')
                confidence = event.get('confidence', 0)
                
                event_text = f"""
• Time: {timestamp}
  Camera: {camera} ({location})
  Description: {caption}
  Confidence: {confidence:.1%}
"""
                message_parts.append(event_text)
        
        message_parts.append("\n" + "="*80 + "\n")
        message_parts.append("INSTRUCTIONS: Based on the surveillance context above, answer the user's query in JSON format. Be specific, cite timestamps and cameras, and do not add information not present in the context.")
        
        return "\n".join(message_parts)
    
    async def generate_follow_up_suggestions(
        self,
        original_query: str,
        context: Dict[str, Any]
    ) -> List[str]:
        """Generate follow-up question suggestions"""
        
        if context.get('event_count', 0) == 0:
            return [
                "Show me recent events from all cameras",
                "What happened today?",
                "Are there any anomalies detected?"
            ]
        
        suggestions = []
        
        # Time-based follow-ups
        if context.get('time_range'):
            suggestions.append("What happened before this time?")
            suggestions.append("What happened after this time?")
        
        # Camera-based follow-ups
        if context.get('cameras'):
            other_cameras = ["Main Entrance", "Parking Lot", "Lobby"]
            for cam in other_cameras:
                if cam not in context['cameras']:
                    suggestions.append(f"What was happening at {cam}?")
                    break
        
        # Event-based follow-ups
        if context.get('events'):
            suggestions.append("Tell me more details about these events")
            suggestions.append("Were there any anomalies during this time?")
        
        return suggestions[:3]  # Return top 3 suggestions
    
    async def generate_summary(
        self,
        events: List[Dict[str, Any]],
        time_period: str = "specified period"
    ) -> str:
        """Generate a brief summary of events"""
        
        if not events:
            return f"No activity detected during the {time_period}."
        
        try:
            # Quick summary without full LLM call
            event_count = len(events)
            cameras = list(set([e.get('camera_name', 'Unknown') for e in events]))
            
            summary = f"During the {time_period}, {event_count} events were recorded "
            summary += f"across {len(cameras)} camera(s): {', '.join(cameras)}."
            
            return summary
        except Exception as e:
            logger.error(f"Error generating summary: {e}")
            return f"Summary unavailable for {time_period}."