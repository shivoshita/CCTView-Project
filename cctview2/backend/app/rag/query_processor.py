# FILE LOCATION: backend/app/rag/query_processor.py

"""
Query Processor for RAG Chatbot
Parses natural language queries and extracts temporal/location information
"""

import re
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
import logging
from dateutil import parser as date_parser

logger = logging.getLogger(__name__)


class QueryProcessor:
    """Process and parse natural language queries"""
    
    def __init__(self):
        # Temporal keywords
        self.temporal_keywords = {
            'today': 0,
            'yesterday': -1,
            'tomorrow': 1,
        }
        
        # Time patterns
        self.time_patterns = [
            r'(\d{1,2})\s*(?::|\.)\s*(\d{2})\s*(am|pm)?',  # 5:30 pm, 17:30
            r'(\d{1,2})\s*(am|pm)',  # 5 pm
            r'at\s+(\d{1,2})\s*(?::|\.)\s*(\d{2})',  # at 17:30
        ]
        
        # Date patterns
        self.date_patterns = [
            r'(\d{1,2})\s+(?:of\s+)?(\w+)\s+(\d{4})',  # 14 July 2025, 14 of July 2025
            r'(\w+)\s+(\d{1,2}),?\s+(\d{4})',  # July 14, 2025
            r'(\d{4})-(\d{2})-(\d{2})',  # 2025-07-14
            r'(\d{2})/(\d{2})/(\d{4})',  # 07/14/2025
        ]
        
        logger.info("✅ Query Processor initialized")
    
    def process_query(self, query: str) -> Dict[str, Any]:
        """
        Process natural language query and extract structured information
        
        Args:
            query: User's natural language query
            
        Returns:
            Dict with query, temporal info, camera info, and search terms
        """
        query_lower = query.lower()
        
        result = {
            'original_query': query,
            'processed_query': query_lower,
            'temporal': self._extract_temporal_info(query_lower),
            'cameras': self._extract_camera_info(query_lower),
            'keywords': self._extract_keywords(query_lower),
            'intent': self._detect_intent(query_lower)
        }
        
        logger.info(f"📝 Processed query: {result['intent']}")
        return result
    
    def _extract_temporal_info(self, query: str) -> Optional[Dict[str, Any]]:
        """Extract date and time information from query"""
        temporal_info = {
            'start_time': None,
            'end_time': None,
            'date': None,
            'time_of_day': None
        }
        
        # Check for relative dates (today, yesterday, etc.)
        for keyword, offset in self.temporal_keywords.items():
            if keyword in query:
                target_date = datetime.now() + timedelta(days=offset)
                temporal_info['date'] = target_date.strftime('%Y-%m-%d')
                logger.debug(f"Found relative date: {keyword} -> {temporal_info['date']}")
        
        # Extract specific dates
        date_match = self._find_date_in_query(query)
        if date_match:
            temporal_info['date'] = date_match
            logger.debug(f"Found specific date: {date_match}")
        
        # Extract time
        time_match = self._find_time_in_query(query)
        if time_match:
            temporal_info['time_of_day'] = time_match
            logger.debug(f"Found time: {time_match}")
        
        # Build datetime ranges
        if temporal_info['date']:
            base_datetime = datetime.strptime(temporal_info['date'], '%Y-%m-%d')
            
            if temporal_info['time_of_day']:
                # Specific time mentioned
                time_obj = datetime.strptime(temporal_info['time_of_day'], '%H:%M')
                base_datetime = base_datetime.replace(
                    hour=time_obj.hour,
                    minute=time_obj.minute
                )
                # Search window: ±30 minutes
                temporal_info['start_time'] = (base_datetime - timedelta(minutes=30)).isoformat()
                temporal_info['end_time'] = (base_datetime + timedelta(minutes=30)).isoformat()
            else:
                # Entire day
                temporal_info['start_time'] = base_datetime.replace(
                    hour=0, minute=0, second=0
                ).isoformat()
                temporal_info['end_time'] = base_datetime.replace(
                    hour=23, minute=59, second=59
                ).isoformat()
        
        # Check for time ranges
        if 'between' in query and 'and' in query:
            range_info = self._extract_time_range(query)
            if range_info:
                temporal_info.update(range_info)
        
        return temporal_info if temporal_info['date'] or temporal_info['start_time'] else None
    
    def _find_date_in_query(self, query: str) -> Optional[str]:
        """Find date in various formats"""
        for pattern in self.date_patterns:
            match = re.search(pattern, query, re.IGNORECASE)
            if match:
                try:
                    # Try to parse with dateutil
                    date_str = match.group(0)
                    parsed_date = date_parser.parse(date_str, fuzzy=True)
                    return parsed_date.strftime('%Y-%m-%d')
                except Exception as e:
                    logger.debug(f"Date parsing failed: {e}")
                    continue
        return None
    
    def _find_time_in_query(self, query: str) -> Optional[str]:
        """Find time in various formats"""
        for pattern in self.time_patterns:
            match = re.search(pattern, query, re.IGNORECASE)
            if match:
                groups = match.groups()
                
                if len(groups) >= 2:
                    hour = int(groups[0])
                    minute = int(groups[1]) if groups[1] else 0
                    
                    # Handle AM/PM
                    if len(groups) >= 3 and groups[2]:
                        period = groups[2].lower()
                        if period == 'pm' and hour < 12:
                            hour += 12
                        elif period == 'am' and hour == 12:
                            hour = 0
                    
                    return f"{hour:02d}:{minute:02d}"
        
        return None
    
    def _extract_time_range(self, query: str) -> Optional[Dict[str, str]]:
        """Extract time range from 'between X and Y' format"""
        match = re.search(
            r'between\s+(\d{1,2})\s*(?::|\.)?(\d{2})?\s*(am|pm)?\s+and\s+(\d{1,2})\s*(?::|\.)?(\d{2})?\s*(am|pm)?',
            query,
            re.IGNORECASE
        )
        
        if match:
            groups = match.groups()
            
            # Start time
            start_hour = int(groups[0])
            start_minute = int(groups[1]) if groups[1] else 0
            if groups[2] and groups[2].lower() == 'pm' and start_hour < 12:
                start_hour += 12
            
            # End time
            end_hour = int(groups[3])
            end_minute = int(groups[4]) if groups[4] else 0
            if groups[5] and groups[5].lower() == 'pm' and end_hour < 12:
                end_hour += 12
            
            today = datetime.now().date()
            start_datetime = datetime.combine(today, datetime.min.time()).replace(
                hour=start_hour, minute=start_minute
            )
            end_datetime = datetime.combine(today, datetime.min.time()).replace(
                hour=end_hour, minute=end_minute
            )
            
            return {
                'start_time': start_datetime.isoformat(),
                'end_time': end_datetime.isoformat()
            }
        
        return None
    
    def _extract_camera_info(self, query: str) -> Optional[List[str]]:
        """Extract camera references from query"""
        camera_keywords = [
            'main entrance', 'entrance', 'front door',
            'parking', 'parking lot',
            'back door', 'rear', 'back entrance',
            'lobby', 'reception',
            'corridor', 'hallway',
            'warehouse', 'storage'
        ]
        
        found_cameras = []
        for keyword in camera_keywords:
            if keyword in query:
                found_cameras.append(keyword)
        
        return found_cameras if found_cameras else None
    
    def _extract_keywords(self, query: str) -> List[str]:
        """Extract important keywords from query"""
        # Remove common stop words
        stop_words = {
            'what', 'when', 'where', 'who', 'how', 'show', 'me', 'the', 'a', 'an',
            'at', 'on', 'in', 'to', 'from', 'is', 'was', 'were', 'happened', 'did'
        }
        
        # Split and filter
        words = query.split()
        keywords = [
            word.strip('?,.:;!') 
            for word in words 
            if word.lower() not in stop_words and len(word) > 2
        ]
        
        return keywords
    
    def _detect_intent(self, query: str) -> str:
        """Detect the intent of the query"""
        if any(word in query for word in ['what happened', 'show', 'find', 'search']):
            return 'search_events'
        elif any(word in query for word in ['person', 'people', 'who', 'individual']):
            return 'person_tracking'
        elif any(word in query for word in ['anomaly', 'unusual', 'suspicious', 'alert']):
            return 'anomaly_detection'
        elif any(word in query for word in ['count', 'how many', 'number of']):
            return 'statistics'
        else:
            return 'general_search'