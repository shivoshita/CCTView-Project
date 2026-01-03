// FILE LOCATION: frontend/src/services/dashboard.service.js

import apiService from './api.service.js';

const dashboardService = {
  /**
   * Get all dashboard statistics
   */
  getDashboardStats: async () => {
    try {
      const response = await apiService.get('/dashboard/stats');
      return response;
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }
  }
};

export default dashboardService;