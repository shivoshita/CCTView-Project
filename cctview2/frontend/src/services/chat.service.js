// FILE LOCATION: frontend/src/services/chat.service.js

import apiService from './api.service.js';

const chatService = {
  /**
   * Send a chat message and get RAG response
   * @param {Object} data - Message data
   * @param {string} data.message - User's message
   * @param {string} data.user_id - Optional user ID
   * @param {string} data.session_id - Optional session ID
   */
  sendMessage: async (data) => {
    try {
      const response = await apiService.post('/chat/message', data);
      return response;
    } catch (error) {
      console.error('Error sending chat message:', error);
      throw error;
    }
  },

  /**
   * Get conversation history for a session
   * @param {string} sessionId - Session identifier
   * @param {number} limit - Maximum messages to return
   */
  getSessionHistory: async (sessionId, limit = 50) => {
    try {
      const response = await apiService.get(`/chat/session/${sessionId}/history`, {
        params: { limit }
      });
      return response;
    } catch (error) {
      console.error('Error getting session history:', error);
      throw error;
    }
  },

  /**
   * Clear/delete a conversation session
   * @param {string} sessionId - Session identifier
   */
  clearSession: async (sessionId) => {
    try {
      const response = await apiService.delete(`/chat/session/${sessionId}`);
      return response;
    } catch (error) {
      console.error('Error clearing session:', error);
      throw error;
    }
  },

  /**
   * Get suggested queries
   * @param {string} context - Optional context for suggestions
   */
  getSuggestions: async (context = null) => {
    try {
      const params = context ? { context } : {};
      const response = await apiService.get('/chat/suggestions', { params });
      return response;
    } catch (error) {
      console.error('Error getting suggestions:', error);
      throw error;
    }
  },

  /**
   * Get chat statistics
   * @param {string} userId - Optional user ID for user-specific stats
   * @param {number} days - Number of days to analyze
   */
  getStatistics: async (userId = null, days = 7) => {
    try {
      const params = { days };
      if (userId) params.user_id = userId;
      
      const response = await apiService.get('/chat/statistics', { params });
      return response;
    } catch (error) {
      console.error('Error getting statistics:', error);
      throw error;
    }
  },

  /**
   * Get popular queries
   * @param {number} limit - Number of queries to return
   * @param {number} days - Time period to analyze
   */
  getPopularQueries: async (limit = 10, days = 30) => {
    try {
      const response = await apiService.get('/chat/popular-queries', {
        params: { limit, days }
      });
      return response;
    } catch (error) {
      console.error('Error getting popular queries:', error);
      throw error;
    }
  },

  /**
   * Export conversation history
   * @param {string} sessionId - Session identifier
   */
  exportConversation: async (sessionId) => {
    try {
      const response = await apiService.get(`/chat/session/${sessionId}/export`);
      return response;
    } catch (error) {
      console.error('Error exporting conversation:', error);
      throw error;
    }
  },

  /**
   * Test chat endpoint with a quick query
   * @param {string} query - Test query
   */
  testChat: async (query) => {
    try {
      const response = await apiService.post('/chat/test', null, {
        params: { query }
      });
      return response;
    } catch (error) {
      console.error('Error testing chat:', error);
      throw error;
    }
  }
};

export default chatService;