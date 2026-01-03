// FILE LOCATION: frontend/src/services/api.service.js
import axios from 'axios';
import API_BASE_URL, { API_ENDPOINTS } from '../config/api.config.js';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only log 404 errors if they're not expected (like missing endpoints)
    // Suppress console noise for known missing endpoints
    if (error.response?.status !== 404) {
      console.error('API Error:', error.response?.data || error.message);
    }
    return Promise.reject(error);
  }
);

// API Service
const apiService = {
  // Generic HTTP methods (needed by other services)
  get: (url, config = {}) => apiClient.get(url, config),
  post: (url, data = {}, config = {}) => apiClient.post(url, data, config),
  put: (url, data = {}, config = {}) => apiClient.put(url, data, config),
  delete: (url, config = {}) => apiClient.delete(url, config),
  patch: (url, data = {}, config = {}) => apiClient.patch(url, data, config),
  
  // Health check
  checkHealth: () => apiClient.get(API_ENDPOINTS.HEALTH),
  checkApiHealth: () => apiClient.get(API_ENDPOINTS.API_HEALTH),
  
  // AI Caption Generation
  generateCaption: (formData) => {
    return apiClient.post(API_ENDPOINTS.AI_CAPTION, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  // Events - Enhanced with new methods
  getEvents: (params) => apiClient.get(API_ENDPOINTS.EVENTS, { params }),
  getEventDetail: (id) => apiClient.get(API_ENDPOINTS.EVENT_DETAIL(id)),
  getEvent: (eventId) => apiClient.get(API_ENDPOINTS.EVENT_DETAIL(eventId)), // Alias for consistency
  searchEvents: (searchRequest) => apiClient.post(API_ENDPOINTS.EVENTS_SEARCH, searchRequest),
  getEventStatistics: (params = {}) => apiClient.get(API_ENDPOINTS.EVENTS_STATISTICS, { params }),
};

export default apiService;