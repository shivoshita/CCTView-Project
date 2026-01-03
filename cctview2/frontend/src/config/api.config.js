// FILE LOCATION: frontend/src/config/api.config.js

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://10.215.101.38:8000/api/v1';

export const API_ENDPOINTS = {
  // Health
  HEALTH: '/health',
  API_HEALTH: '/health',  // Changed from /api/v1/health since base URL already has /api/v1
  
  // AI Service
  AI_CAPTION: '/ai/caption',
  
  // Events
  EVENTS: '/events',
  EVENT_DETAIL: (id) => `/events/${id}`,

  EVENTS_SEARCH: '/events/search', //Changed on 30-10-2025
  EVENTS_STATISTICS: '/events/statistics/summary', //Changed on 30-10-2025
  
  // Cameras
  CAMERAS: '/cameras',
  CAMERA_DETAIL: (id) => `/cameras/${id}`,
};

export default API_BASE_URL;