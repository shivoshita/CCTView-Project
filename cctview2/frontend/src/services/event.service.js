// FILE LOCATION: frontend/src/services/event.service.js

import apiService from './api.service.js';

const eventService = {
  /**
   * Get all events with optional filters
   * @param {Object} params - Query parameters
   * @param {string} params.camera_id - Optional camera ID filter
   * @param {number} params.limit - Number of events to return (1-100)
   * @param {number} params.offset - Pagination offset
   */
  getAllEvents: async (params = {}) => {
    try {
      const response = await apiService.get('/events', { params });
      return response;
    } catch (error) {
      console.error('Error fetching events:', error);
      throw error;
    }
  },

  /**
   * Get single event by ID
   * @param {string} eventId - Event identifier
   */
  getEventById: async (eventId) => {
    try {
      const response = await apiService.get(`/events/${eventId}`);
      return response;
    } catch (error) {
      console.error('Error fetching event:', error);
      throw error;
    }
  },

  /**
   * Get recent events for a specific camera
   * @param {string} cameraId - Camera identifier
   * @param {number} limit - Number of events to return (default: 10)
   */
  getRecentEventsByCamera: async (cameraId, limit = 10) => {
    try {
      const response = await apiService.get(`/events/camera/${cameraId}/recent`, {
        params: { limit }
      });
      return response;
    } catch (error) {
      console.error(`Error fetching recent events for camera ${cameraId}:`, error);
      throw error;
    }
  },

  /**
   * Get event statistics
   * @param {Object} params - Query parameters
   * @param {string} params.camera_id - Optional camera ID filter
   * @param {number} params.days - Number of days to analyze (1-90)
   */
  getEventStatistics: async (params = {}) => {
    try {
      const response = await apiService.get('/events/statistics/summary', { params });
      return response;
    } catch (error) {
      console.error('Error fetching event statistics:', error);
      throw error;
    }
  },

  /**
   * Search events by query text
   * @param {Object} searchParams - Search parameters
   * @param {string} searchParams.query - Search query text
   * @param {string[]} searchParams.camera_ids - Optional camera IDs filter
   * @param {string} searchParams.start_time - Optional start time (ISO format)
   * @param {string} searchParams.end_time - Optional end time (ISO format)
   * @param {number} searchParams.limit - Maximum results (default: 50)
   */
  searchEvents: async (searchParams) => {
    try {
      const response = await apiService.post('/events/search', searchParams);
      return response;
    } catch (error) {
      console.error('Error searching events:', error);
      throw error;
    }
  },

  /**
   * Get events by time range
   * @param {Object} params - Query parameters
   * @param {string} params.start_time - Start time (ISO format)
   * @param {string} params.end_time - End time (ISO format)
   * @param {string[]} params.camera_ids - Optional camera IDs
   * @param {number} params.limit - Maximum results
   */
  getEventsByTimeRange: async (params) => {
    try {
      const response = await apiService.get('/events', { params });
      return response;
    } catch (error) {
      console.error('Error fetching events by time range:', error);
      throw error;
    }
  },

  /**
   * Get events for today
   * @param {string} cameraId - Optional camera ID filter
   */
  getTodayEvents: async (cameraId = null) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const params = {
        start_time: today.toISOString(),
        end_time: new Date().toISOString(),
        limit: 100
      };
      
      if (cameraId) {
        params.camera_id = cameraId;
      }
      
      const response = await apiService.get('/events', { params });
      return response;
    } catch (error) {
      console.error('Error fetching today events:', error);
      throw error;
    }
  },

  /**
   * Get events for a specific date
   * @param {Date} date - Date to fetch events for
   * @param {string} cameraId - Optional camera ID filter
   */
  getEventsByDate: async (date, cameraId = null) => {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      const params = {
        start_time: startOfDay.toISOString(),
        end_time: endOfDay.toISOString(),
        limit: 100
      };
      
      if (cameraId) {
        params.camera_id = cameraId;
      }
      
      const response = await apiService.get('/events', { params });
      return response;
    } catch (error) {
      console.error('Error fetching events by date:', error);
      throw error;
    }
  },

  /**
   * Get events from the last N hours
   * @param {number} hours - Number of hours
   * @param {string} cameraId - Optional camera ID filter
   */
  getRecentEvents: async (hours = 24, cameraId = null) => {
    try {
      const now = new Date();
      const startTime = new Date(now.getTime() - (hours * 60 * 60 * 1000));
      
      const params = {
        start_time: startTime.toISOString(),
        end_time: now.toISOString(),
        limit: 100
      };
      
      if (cameraId) {
        params.camera_id = cameraId;
      }
      
      const response = await apiService.get('/events', { params });
      return response;
    } catch (error) {
      console.error('Error fetching recent events:', error);
      throw error;
    }
  },

  /**
   * Get event count by camera
   * @param {number} days - Number of days to analyze
   */
  getEventCountByCamera: async (days = 7) => {
    try {
      // This would ideally be a dedicated endpoint, but we can derive it from statistics
      const response = await apiService.get('/events/statistics/summary', {
        params: { days }
      });
      return response;
    } catch (error) {
      console.error('Error fetching event count by camera:', error);
      throw error;
    }
  },

  /**
   * Format event timestamp for display
   * @param {string} timestamp - ISO timestamp string
   * @returns {Object} Formatted timestamp object
   */
  formatTimestamp: (timestamp) => {
    if (!timestamp) return { date: 'Unknown', time: '', relative: '' };
    
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return { date: 'Invalid date', time: '', relative: '' };
      }
      
      return {
        date: date.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          year: 'numeric'
        }),
        time: date.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          second: '2-digit'
        }),
        full: date.toLocaleString('en-US'),
        iso: date.toISOString(),
        relative: eventService.getRelativeTime(date)
      };
    } catch (e) {
      console.error('Error formatting timestamp:', e);
      return { date: 'Invalid date', time: '', relative: '' };
    }
  },

  /**
   * Get relative time string (e.g., "5 minutes ago")
   * @param {Date} date - Date object
   * @returns {string} Relative time string
   */
  getRelativeTime: (date) => {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
  },

  /**
   * Calculate duration between start and end time
   * @param {string} startTime - Start timestamp
   * @param {string} endTime - End timestamp
   * @returns {Object} Duration object with seconds, minutes, hours
   */
  calculateDuration: (startTime, endTime) => {
    try {
      const start = new Date(startTime);
      const end = new Date(endTime);
      const diffMs = end - start;
      const diffSeconds = Math.floor(diffMs / 1000);
      const diffMinutes = Math.floor(diffSeconds / 60);
      const diffHours = Math.floor(diffMinutes / 60);
      
      return {
        seconds: diffSeconds,
        minutes: diffMinutes,
        hours: diffHours,
        formatted: diffHours > 0 
          ? `${diffHours}h ${diffMinutes % 60}m`
          : `${diffMinutes}m ${diffSeconds % 60}s`
      };
    } catch (e) {
      console.error('Error calculating duration:', e);
      return { seconds: 0, minutes: 0, hours: 0, formatted: '0s' };
    }
  },

  /**
   * Export events to CSV
   * @param {Array} events - Array of event objects
   * @returns {string} CSV string
   */
  exportToCSV: (events) => {
    if (!events || events.length === 0) {
      return '';
    }

    const headers = ['Event ID', 'Camera', 'Timestamp', 'Caption', 'Confidence', 'Duration', 'Frames'];
    const rows = events.map(event => [
      event.id || '',
      event.camera_name || event.cameraName || '',
      event.timestamp || event.start_time || '',
      (event.caption || '').replace(/"/g, '""'), // Escape quotes
      event.confidence ? (event.confidence * 100).toFixed(1) + '%' : '',
      event.duration ? event.duration + 's' : '',
      event.frame_count || ''
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csv;
  },

  /**
   * Download events as CSV file
   * @param {Array} events - Array of event objects
   * @param {string} filename - Optional filename
   */
  downloadCSV: (events, filename = 'events.csv') => {
    const csv = eventService.exportToCSV(events);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  /**
   * Group events by date
   * @param {Array} events - Array of event objects
   * @returns {Object} Events grouped by date
   */
  groupEventsByDate: (events) => {
    const grouped = {};
    
    events.forEach(event => {
      const timestamp = event.timestamp || event.start_time;
      if (!timestamp) return;
      
      const date = new Date(timestamp);
      const dateKey = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      
      grouped[dateKey].push(event);
    });
    
    return grouped;
  },

  /**
   * Group events by camera
   * @param {Array} events - Array of event objects
   * @returns {Object} Events grouped by camera
   */
  groupEventsByCamera: (events) => {
    const grouped = {};
    
    events.forEach(event => {
      const cameraId = event.camera_id || event.cameraId;
      const cameraName = event.camera_name || event.cameraName || 'Unknown Camera';
      
      if (!grouped[cameraId]) {
        grouped[cameraId] = {
          cameraId,
          cameraName,
          events: []
        };
      }
      
      grouped[cameraId].events.push(event);
    });
    
    return grouped;
  },

  /**
   * Filter events by confidence threshold
   * @param {Array} events - Array of event objects
   * @param {number} minConfidence - Minimum confidence (0-1)
   * @returns {Array} Filtered events
   */
  filterByConfidence: (events, minConfidence = 0.5) => {
    return events.filter(event => {
      const confidence = event.confidence || 0;
      return confidence >= minConfidence;
    });
  },

  /**
   * Sort events by timestamp
   * @param {Array} events - Array of event objects
   * @param {string} order - 'asc' or 'desc'
   * @returns {Array} Sorted events
   */
  sortByTimestamp: (events, order = 'desc') => {
    return [...events].sort((a, b) => {
      const timeA = new Date(a.timestamp || a.start_time).getTime();
      const timeB = new Date(b.timestamp || b.start_time).getTime();
      return order === 'desc' ? timeB - timeA : timeA - timeB;
    });
  }
};

export default eventService;