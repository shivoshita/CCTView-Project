// FILE LOCATION: frontend/src/services/reid.service.js

import apiService from './api.service.js';

const reidService = {
  /**
   * Start person re-identification tracking
   * @param {string[]} cameraIds - Array of camera IDs to track
   */
  startTracking: async (cameraIds) => {
    try {
      const response = await apiService.post('/person-reid/reid/start', cameraIds);
      return response;
    } catch (error) {
      console.error('Error starting Re-ID tracking:', error);
      throw error;
    }
  },

  /**
   * Get person re-identification tracking data
   * @param {string[]} cameraIds - Array of camera IDs
   */
  getTracking: async (cameraIds) => {
    try {
      const cameraIdsString = cameraIds.join(',');
      const response = await apiService.get('/person-reid/reid/track', {
        params: {
          camera_ids: cameraIdsString
        }
      });
      return response;
    } catch (error) {
      console.error('Error fetching Re-ID tracking:', error);
      throw error;
    }
  },

  /**
   * Reset Re-ID tracking state
   */
  resetTracking: async () => {
    try {
      const response = await apiService.delete('/person-reid/reid/reset');
      return response;
    } catch (error) {
      console.error('Error resetting Re-ID tracking:', error);
      throw error;
    }
  },

  /**
   * Get movement history for a specific person
   * @param {string} personId - Person ID
   */
  getPersonHistory: async (personId) => {
    try {
      const response = await apiService.get(`/person-reid/reid/history/${personId}`);
      return response;
    } catch (error) {
      console.error('Error fetching person history:', error);
      throw error;
    }
  }
};

export default reidService;