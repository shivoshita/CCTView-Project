# FILE LOCATION: backend/app/rag/utils/temporal_parser.py

"""
Temporal Parser for RAG Query Processing
Extracts time-related information from natural language queries
IMPROVED: Better handling of recent queries for Redis cache
"""

import re
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Tuple
import logging

logger = logging.getLogger(__name__)


class TemporalParser:
    """Parse temporal expressions from natural language"""
    
    def __init__(self):
        # Relative time patterns
        self.relative_patterns = {
            'today': self._parse_today,
            'yesterday': self._parse_yesterday,
            'this morning': self._parse_this_morning,
            'this afternoon': self._parse_this_afternoon,
            'this evening': self._parse_this_evening,
            'tonight': self._parse_tonight,
            'last night': self._parse_last_night,
            'this week': self._parse_this_week,
            'last week': self._parse_last_week,
            'this month': self._parse_this_month,
            'last month': self._parse_last_month,
        }
        
        # Hour patterns (e.g., "last hour", "past 2 hours")
        self.hour_pattern = re.compile(
            r'(?:last|past|previous)\s+(\d+)?\s*hours?',
            re.IGNORECASE
        )
        
        # Minute patterns (e.g., "last 30 minutes", "5 mins ago")
        self.minute_pattern = re.compile(
            r'(?:last|past|previous)\s+(\d+)\s*(?:minutes?|mins?)',
            re.IGNORECASE
        )
        
        # Day patterns (e.g., "last 3 days", "past week")
        self.day_pattern = re.compile(
            r'(?:last|past|previous)\s+(\d+)\s*days?',
            re.IGNORECASE
        )
        
        # Specific time patterns (e.g., "at 5 PM", "around 3:30")
        self.time_pattern = re.compile(
            r'(?:at|around|about|near)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)?',
            re.IGNORECASE
        )
        
        # Time range patterns (e.g., "between 2 PM and 4 PM")
        self.time_range_pattern = re.compile(
            r'between\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)?\s+and\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)?',
            re.IGNORECASE
        )
        
        # Specific date patterns (e.g., "on October 25", "2024-10-25")
        self.date_pattern = re.compile(
            r'(?:on\s+)?(\d{4})-(\d{2})-(\d{2})',
            re.IGNORECASE
        )
        
        # Named date patterns (e.g., "October 25", "Jan 15")
        self.named_date_pattern = re.compile(
            r'(?:on\s+)?(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?',
            re.IGNORECASE
        )
        
        # Recent/Now patterns - IMPROVED for Redis cache
        self.recent_pattern = re.compile(
            r'\b(now|recent|recently|latest|current|currently|just now|moments? ago)\b',
            re.IGNORECASE
        )
        
        # "What happened" patterns - these should trigger "today" by default
        self.what_happened_pattern = re.compile(
            r'\b(?:what|anything|something)\s+(?:happened|occurring|going on|activity)\b',
            re.IGNORECASE
        )
        
        # IMPROVED: "X minutes/hours ago" pattern
        self.time_ago_pattern = re.compile(
            r'(\d+)\s*(minutes?|mins?|hours?|hrs?)\s+ago',
            re.IGNORECASE
        )
        
        logger.info("✅ Temporal Parser initialized (Redis-aware)")
    
    def parse(self, query: str) -> Optional[Dict[str, Any]]:
        """
        Parse temporal information from query
        
        PRIORITY ORDER (for Redis optimization):
        1. "X mins/hours ago" → Specific recent time (Redis)
        2. "recent/now/latest" → Last 2 hours (Redis window)
        3. "what happened" without time → Today (Redis + Neo4j)
        4. Explicit relative times (today, yesterday)
        5. Time ranges, specific times
        6. Dates
        
        Args:
            query: Natural language query
            
        Returns:
            Dict with temporal information or None
        """
        query_lower = query.lower()
        
        # PRIORITY 1: "X minutes/hours ago" - MOST SPECIFIC
        time_ago_match = self.time_ago_pattern.search(query_lower)
        if time_ago_match:
            amount = int(time_ago_match.group(1))
            unit = time_ago_match.group(2).lower()
            
            if 'min' in unit:
                logger.info(f"🕐 Detected '{amount} minutes ago'")
                return self._parse_minutes_ago(amount)
            elif 'hour' in unit or 'hr' in unit:
                logger.info(f"🕐 Detected '{amount} hours ago'")
                return self._parse_hours_ago(amount)
        
        # PRIORITY 2: Recent/Now patterns (optimized for Redis)
        if self.recent_pattern.search(query_lower):
            logger.info("🕐 Detected 'recent' query - last 2 hours (Redis window)")
            return self._parse_recent()
        
        # PRIORITY 3: "What happened" without specific time → Default to TODAY
        if self.what_happened_pattern.search(query_lower):
            # Check if there's NO specific time mentioned
            has_specific_time = (
                self.time_pattern.search(query) or
                self.time_range_pattern.search(query) or
                self.date_pattern.search(query) or
                self.named_date_pattern.search(query) or
                any(rel_time in query_lower for rel_time in ['yesterday', 'last week', 'last month'])
            )
            
            if not has_specific_time:
                logger.info("🕐 'What happened' query detected - defaulting to TODAY")
                return self._parse_today()
        
        # PRIORITY 4: Explicit relative time (today, yesterday, etc.)
        for pattern_key, parser_func in self.relative_patterns.items():
            if pattern_key in query_lower:
                logger.info(f"🕐 Detected relative time: {pattern_key}")
                return parser_func()
        
        # PRIORITY 5: Time ranges (e.g., "between 2 PM and 4 PM")
        time_range_match = self.time_range_pattern.search(query)
        if time_range_match:
            logger.info("🕐 Detected time range")
            return self._parse_time_range(time_range_match)
        
        # PRIORITY 6: Specific time (e.g., "at 5 PM")
        time_match = self.time_pattern.search(query)
        if time_match:
            logger.info("🕐 Detected specific time")
            return self._parse_specific_time(time_match)
        
        # PRIORITY 7: Hour/minute patterns
        hour_match = self.hour_pattern.search(query_lower)
        if hour_match:
            hours = int(hour_match.group(1)) if hour_match.group(1) else 1
            logger.info(f"🕐 Detected hour pattern: {hours} hours")
            return self._parse_hours_ago(hours)
        
        minute_match = self.minute_pattern.search(query_lower)
        if minute_match:
            minutes = int(minute_match.group(1))
            logger.info(f"🕐 Detected minute pattern: {minutes} minutes")
            return self._parse_minutes_ago(minutes)
        
        # PRIORITY 8: Day patterns
        day_match = self.day_pattern.search(query_lower)
        if day_match:
            days = int(day_match.group(1))
            logger.info(f"🕐 Detected day pattern: {days} days")
            return self._parse_days_ago(days)
        
        # PRIORITY 9: Specific date (ISO format)
        date_match = self.date_pattern.search(query)
        if date_match:
            logger.info("🕐 Detected specific date (ISO)")
            return self._parse_specific_date(date_match)
        
        # PRIORITY 10: Named date (e.g., "October 25")
        named_date_match = self.named_date_pattern.search(query)
        if named_date_match:
            logger.info("🕐 Detected named date")
            return self._parse_named_date(named_date_match)
        
        # No temporal info found
        logger.debug("ℹ️  No temporal information detected in query")
        return None
    
    # ==================== RELATIVE TIME PARSERS ====================
    
    def _parse_today(self) -> Dict[str, Any]:
        """Parse 'today' - entire day from 00:00 to 23:59"""
        now = datetime.now()
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = now.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        return {
            'type': 'relative',
            'date': now.strftime('%Y-%m-%d'),
            'time_of_day': 'all_day',
            'start_time': start.isoformat(),
            'end_time': end.isoformat(),
            'description': 'Today (entire day)',
            'redis_eligible': True  # Can check Redis for recent data
        }
    
    def _parse_yesterday(self) -> Dict[str, Any]:
        """Parse 'yesterday' - entire day"""
        now = datetime.now()
        yesterday = now - timedelta(days=1)
        start = yesterday.replace(hour=0, minute=0, second=0, microsecond=0)
        end = yesterday.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        return {
            'type': 'relative',
            'date': yesterday.strftime('%Y-%m-%d'),
            'time_of_day': 'all_day',
            'start_time': start.isoformat(),
            'end_time': end.isoformat(),
            'description': 'Yesterday (entire day)',
            'redis_eligible': False  # Too old for Redis (>2 hours)
        }
    
    def _parse_this_morning(self) -> Dict[str, Any]:
        """Parse 'this morning' - 6 AM to 12 PM today"""
        now = datetime.now()
        start = now.replace(hour=6, minute=0, second=0, microsecond=0)
        end = now.replace(hour=12, minute=0, second=0, microsecond=0)
        
        return {
            'type': 'relative',
            'date': now.strftime('%Y-%m-%d'),
            'time_of_day': 'morning',
            'start_time': start.isoformat(),
            'end_time': end.isoformat(),
            'description': 'This morning (6 AM - 12 PM)',
            'redis_eligible': (now.hour < 14)  # Redis eligible if current time < 2pm
        }
    
    def _parse_this_afternoon(self) -> Dict[str, Any]:
        """Parse 'this afternoon' - 12 PM to 5 PM today"""
        now = datetime.now()
        start = now.replace(hour=12, minute=0, second=0, microsecond=0)
        end = now.replace(hour=17, minute=0, second=0, microsecond=0)
        
        return {
            'type': 'relative',
            'date': now.strftime('%Y-%m-%d'),
            'time_of_day': 'afternoon',
            'start_time': start.isoformat(),
            'end_time': end.isoformat(),
            'description': 'This afternoon (12 PM - 5 PM)',
            'redis_eligible': (now.hour < 19)  # Redis eligible if current time < 7pm
        }
    
    def _parse_this_evening(self) -> Dict[str, Any]:
        """Parse 'this evening' - 5 PM to 9 PM today"""
        now = datetime.now()
        start = now.replace(hour=17, minute=0, second=0, microsecond=0)
        end = now.replace(hour=21, minute=0, second=0, microsecond=0)
        
        return {
            'type': 'relative',
            'date': now.strftime('%Y-%m-%d'),
            'time_of_day': 'evening',
            'start_time': start.isoformat(),
            'end_time': end.isoformat(),
            'description': 'This evening (5 PM - 9 PM)',
            'redis_eligible': True  # Usually within Redis window
        }
    
    def _parse_tonight(self) -> Dict[str, Any]:
        """Parse 'tonight' - 6 PM today to 6 AM tomorrow"""
        now = datetime.now()
        start = now.replace(hour=18, minute=0, second=0, microsecond=0)
        end = (now + timedelta(days=1)).replace(hour=6, minute=0, second=0, microsecond=0)
        
        return {
            'type': 'relative',
            'date': now.strftime('%Y-%m-%d'),
            'time_of_day': 'night',
            'start_time': start.isoformat(),
            'end_time': end.isoformat(),
            'description': 'Tonight (6 PM - 6 AM)',
            'redis_eligible': True
        }
    
    def _parse_last_night(self) -> Dict[str, Any]:
        """Parse 'last night' - 6 PM yesterday to 6 AM today"""
        now = datetime.now()
        yesterday = now - timedelta(days=1)
        start = yesterday.replace(hour=18, minute=0, second=0, microsecond=0)
        end = now.replace(hour=6, minute=0, second=0, microsecond=0)
        
        return {
            'type': 'relative',
            'date': yesterday.strftime('%Y-%m-%d'),
            'time_of_day': 'night',
            'start_time': start.isoformat(),
            'end_time': end.isoformat(),
            'description': 'Last night (6 PM - 6 AM)',
            'redis_eligible': False  # Too old for Redis
        }
    
    def _parse_this_week(self) -> Dict[str, Any]:
        """Parse 'this week' - Monday to Sunday"""
        now = datetime.now()
        start_of_week = now - timedelta(days=now.weekday())
        start = start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)
        end = now.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        return {
            'type': 'relative',
            'time_of_day': 'all_day',
            'start_time': start.isoformat(),
            'end_time': end.isoformat(),
            'description': 'This week',
            'redis_eligible': False  # Too broad, use Neo4j
        }
    
    def _parse_last_week(self) -> Dict[str, Any]:
        """Parse 'last week' - Previous Monday to Sunday"""
        now = datetime.now()
        start_of_this_week = now - timedelta(days=now.weekday())
        start_of_last_week = start_of_this_week - timedelta(days=7)
        start = start_of_last_week.replace(hour=0, minute=0, second=0, microsecond=0)
        end = (start_of_this_week - timedelta(seconds=1)).replace(microsecond=999999)
        
        return {
            'type': 'relative',
            'time_of_day': 'all_day',
            'start_time': start.isoformat(),
            'end_time': end.isoformat(),
            'description': 'Last week',
            'redis_eligible': False
        }
    
    def _parse_this_month(self) -> Dict[str, Any]:
        """Parse 'this month' - First to last day of current month"""
        now = datetime.now()
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end = now.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        return {
            'type': 'relative',
            'time_of_day': 'all_day',
            'start_time': start.isoformat(),
            'end_time': end.isoformat(),
            'description': 'This month',
            'redis_eligible': False
        }
    
    def _parse_last_month(self) -> Dict[str, Any]:
        """Parse 'last month' - Previous month"""
        now = datetime.now()
        first_day_this_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        last_day_last_month = first_day_this_month - timedelta(days=1)
        start = last_day_last_month.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end = last_day_last_month.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        return {
            'type': 'relative',
            'time_of_day': 'all_day',
            'start_time': start.isoformat(),
            'end_time': end.isoformat(),
            'description': 'Last month',
            'redis_eligible': False
        }
    
    def _parse_recent(self) -> Dict[str, Any]:
        """Parse 'recent' - last 2 hours (Redis cache window) - IMPROVED"""
        now = datetime.now()
        start = now - timedelta(hours=2)
        
        return {
            'type': 'relative',
            'time_of_day': 'recent',
            'start_time': start.isoformat(),
            'end_time': now.isoformat(),
            'description': 'Recent (last 2 hours)',
            'redis_eligible': True,  # PERFECT for Redis!
            'redis_priority': True   # Should ONLY check Redis
        }
    
    # ==================== DURATION PARSERS ====================
    
    def _parse_hours_ago(self, hours: int) -> Dict[str, Any]:
        """Parse 'X hours ago' - IMPROVED for Redis"""
        now = datetime.now()
        start = now - timedelta(hours=hours)
        
        # Redis eligible if within 2 hour window
        redis_eligible = (hours <= 2)
        
        return {
            'type': 'relative',
            'time_of_day': 'custom',
            'start_time': start.isoformat(),
            'end_time': now.isoformat(),
            'description': f'Last {hours} hour{"s" if hours > 1 else ""}',
            'redis_eligible': redis_eligible,
            'redis_priority': redis_eligible  # Prioritize Redis if eligible
        }
    
    def _parse_minutes_ago(self, minutes: int) -> Dict[str, Any]:
        """Parse 'X minutes ago' - IMPROVED for Redis"""
        now = datetime.now()
        start = now - timedelta(minutes=minutes)
        
        return {
            'type': 'relative',
            'time_of_day': 'custom',
            'start_time': start.isoformat(),
            'end_time': now.isoformat(),
            'description': f'Last {minutes} minute{"s" if minutes > 1 else ""}',
            'redis_eligible': True,      # Always in Redis window
            'redis_priority': True       # Should ONLY check Redis
        }
    
    def _parse_days_ago(self, days: int) -> Dict[str, Any]:
        """Parse 'X days ago'"""
        now = datetime.now()
        start = (now - timedelta(days=days)).replace(hour=0, minute=0, second=0, microsecond=0)
        end = now.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        return {
            'type': 'relative',
            'time_of_day': 'all_day',
            'start_time': start.isoformat(),
            'end_time': end.isoformat(),
            'description': f'Last {days} day{"s" if days > 1 else ""}',
            'redis_eligible': (days == 0)  # Only today is Redis eligible
        }
    
    # ==================== SPECIFIC TIME PARSERS ====================
    
    def _parse_specific_time(self, match) -> Dict[str, Any]:
        """Parse specific time (e.g., 'at 5 PM')"""
        hour = int(match.group(1))
        minute = int(match.group(2)) if match.group(2) else 0
        meridiem = match.group(3).upper() if match.group(3) else None
        
        # Convert to 24-hour format
        if meridiem == 'PM' and hour != 12:
            hour += 12
        elif meridiem == 'AM' and hour == 12:
            hour = 0
        
        now = datetime.now()
        target_time = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        
        # If time is in the future today, use today; otherwise use yesterday
        if target_time > now:
            target_time = target_time - timedelta(days=1)
        
        # Create 1-hour window around the time
        start = target_time - timedelta(minutes=30)
        end = target_time + timedelta(minutes=30)
        
        # Check if within Redis window (last 2 hours)
        time_diff = (now - target_time).total_seconds() / 3600
        redis_eligible = (time_diff <= 2)
        
        return {
            'type': 'specific_time',
            'date': target_time.strftime('%Y-%m-%d'),
            'time_of_day': 'custom',
            'start_time': start.isoformat(),
            'end_time': end.isoformat(),
            'description': f"Around {target_time.strftime('%I:%M %p')}",
            'redis_eligible': redis_eligible
        }
    
    def _parse_time_range(self, match) -> Dict[str, Any]:
        """Parse time range (e.g., 'between 2 PM and 4 PM')"""
        start_hour = int(match.group(1))
        start_minute = int(match.group(2)) if match.group(2) else 0
        start_meridiem = match.group(3).upper() if match.group(3) else None
        
        end_hour = int(match.group(4))
        end_minute = int(match.group(5)) if match.group(5) else 0
        end_meridiem = match.group(6).upper() if match.group(6) else None
        
        # Convert to 24-hour format
        if start_meridiem == 'PM' and start_hour != 12:
            start_hour += 12
        elif start_meridiem == 'AM' and start_hour == 12:
            start_hour = 0
        
        if end_meridiem == 'PM' and end_hour != 12:
            end_hour += 12
        elif end_meridiem == 'AM' and end_hour == 12:
            end_hour = 0
        
        now = datetime.now()
        start_time = now.replace(hour=start_hour, minute=start_minute, second=0, microsecond=0)
        end_time = now.replace(hour=end_hour, minute=end_minute, second=0, microsecond=0)
        
        # If times are in the future, use yesterday
        if start_time > now:
            start_time = start_time - timedelta(days=1)
            end_time = end_time - timedelta(days=1)
        
        # Check if any part is within Redis window
        time_diff = (now - start_time).total_seconds() / 3600
        redis_eligible = (time_diff <= 2)
        
        return {
            'type': 'time_range',
            'date': start_time.strftime('%Y-%m-%d'),
            'time_of_day': 'custom',
            'start_time': start_time.isoformat(),
            'end_time': end_time.isoformat(),
            'description': f"{start_time.strftime('%I:%M %p')} - {end_time.strftime('%I:%M %p')}",
            'redis_eligible': redis_eligible
        }
    
    def _parse_specific_date(self, match) -> Dict[str, Any]:
        """Parse specific date (ISO format: YYYY-MM-DD)"""
        year = int(match.group(1))
        month = int(match.group(2))
        day = int(match.group(3))
        
        date = datetime(year, month, day)
        start = date.replace(hour=0, minute=0, second=0, microsecond=0)
        end = date.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        # Check if it's today
        is_today = (date.date() == datetime.now().date())
        
        return {
            'type': 'specific_date',
            'date': date.strftime('%Y-%m-%d'),
            'time_of_day': 'all_day',
            'start_time': start.isoformat(),
            'end_time': end.isoformat(),
            'description': f"{date.strftime('%B %d, %Y')}",
            'redis_eligible': is_today
        }
    
    def _parse_named_date(self, match) -> Dict[str, Any]:
        """Parse named date (e.g., 'October 25', 'Jan 15 2024')"""
        month_name = match.group(1).lower()
        day = int(match.group(2))
        year = int(match.group(3)) if match.group(3) else datetime.now().year
        
        # Month mapping
        months = {
            'january': 1, 'jan': 1,
            'february': 2, 'feb': 2,
            'march': 3, 'mar': 3,
            'april': 4, 'apr': 4,
            'may': 5,
            'june': 6, 'jun': 6,
            'july': 7, 'jul': 7,
            'august': 8, 'aug': 8,
            'september': 9, 'sep': 9,
            'october': 10, 'oct': 10,
            'november': 11, 'nov': 11,
            'december': 12, 'dec': 12
        }
        
        month = months.get(month_name, 1)
        
        date = datetime(year, month, day)
        start = date.replace(hour=0, minute=0, second=0, microsecond=0)
        end = date.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        # Check if it's today
        is_today = (date.date() == datetime.now().date())
        
        return {
            'type': 'specific_date',
            'date': date.strftime('%Y-%m-%d'),
            'time_of_day': 'all_day',
            'start_time': start.isoformat(),
            'end_time': end.isoformat(),
            'description': f"{date.strftime('%B %d, %Y')}",
            'redis_eligible': is_today
        }


# Singleton instance
temporal_parser = TemporalParser()