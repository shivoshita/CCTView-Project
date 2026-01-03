// FILE LOCATION: frontend/src/services/anomaly.service.js

import apiService from './api.service.js';

const anomalyService = {
  // ==================== ANOMALY RULES (Tab 1: Configure) ====================

  /**
   * Get all anomaly rules
   * @param {boolean} enabled - Optional filter by enabled status
   */
  getAllRules: async (enabled = null) => {
    try {
      const params = {};
      if (enabled !== null) {
        params.enabled = enabled;
      }
      const response = await apiService.get('/anomalies/rules', { params });
      // Handle different response structures
      if (response.data) {
        if (response.data.success !== undefined) {
          return response;
        }
        if (Array.isArray(response.data)) {
          return { data: { success: true, rules: response.data } };
        }
        if (response.data.rules) {
          return { data: { success: true, ...response.data } };
        }
      }
      return response;
    } catch (error) {
      console.error('Error fetching anomaly rules:', error);
      throw error;
    }
  },

  /**
   * Get single anomaly rule by ID
   */
  getRuleById: async (ruleId) => {
    try {
      const response = await apiService.get(`/anomalies/rules/${ruleId}`);
      return response;
    } catch (error) {
      console.error('Error fetching anomaly rule:', error);
      throw error;
    }
  },

  /**
   * Create new anomaly rule
   * @param {Object} ruleData - Rule configuration
   */
  createRule: async (ruleData) => {
    try {
      const response = await apiService.post('/anomalies/rules', ruleData);
      // Normalize response
      if (response.data && !response.data.success && response.status >= 200 && response.status < 300) {
        return { ...response, data: { success: true, ...response.data } };
      }
      return response;
    } catch (error) {
      console.error('Error creating anomaly rule:', error);
      throw error;
    }
  },

  /**
   * Update existing anomaly rule
   */
  updateRule: async (ruleId, ruleData) => {
    try {
      const response = await apiService.put(`/anomalies/rules/${ruleId}`, ruleData);
      // Normalize response
      if (response.data && !response.data.success && response.status >= 200 && response.status < 300) {
        return { ...response, data: { success: true, ...response.data } };
      }
      return response;
    } catch (error) {
      console.error('Error updating anomaly rule:', error);
      throw error;
    }
  },

  /**
   * Delete anomaly rule
   */
  deleteRule: async (ruleId) => {
    try {
      const response = await apiService.delete(`/anomalies/rules/${ruleId}`);
      // Normalize response
      if (response.data && !response.data.success && response.status >= 200 && response.status < 300) {
        return { ...response, data: { success: true, ...response.data } };
      }
      return response;
    } catch (error) {
      console.error('Error deleting anomaly rule:', error);
      throw error;
    }
  },

  // ==================== ANOMALY DETECTIONS (Tab 2: History) ====================

  /**
   * Get anomaly detections with filters
   * @param {Object} params - Query parameters
   */
  getDetections: async (params = {}) => {
    try {
      const response = await apiService.get('/anomalies/detections', { params });
      // Handle different response structures
      if (response.data) {
        // If response has data.success, return as is
        if (response.data.success !== undefined) {
          return response;
        }
        // If response.data is directly an array or has detections
        if (Array.isArray(response.data)) {
          return { data: { success: true, detections: response.data } };
        }
        if (response.data.detections) {
          return { data: { success: true, ...response.data } };
        }
      }
      return response;
    } catch (error) {
      console.error('Error fetching anomaly detections:', error);
      throw error;
    }
  },

  /**
   * Get single anomaly detection detail
   */
  getDetectionById: async (detectionId) => {
    try {
      const response = await apiService.get(`/anomalies/detections/${detectionId}`);
      // Handle different response structures
      if (response.data) {
        if (response.data.success !== undefined) {
          return response;
        }
        // If response.data is the detection object directly
        return { data: { success: true, detection: response.data } };
      }
      return response;
    } catch (error) {
      console.error('Error fetching anomaly detection:', error);
      throw error;
    }
  },

  /**
   * Update anomaly detection status
   * @param {string} detectionId - Detection ID
   * @param {string} status - new | acknowledged | resolved
   */
  updateDetectionStatus: async (detectionId, status) => {
    try {
      const response = await apiService.patch(
        `/anomalies/detections/${detectionId}/status`,
        { status }
      );
      // Normalize response
      if (response.data && !response.data.success && response.status >= 200 && response.status < 300) {
        return { ...response, data: { success: true, ...response.data } };
      }
      return response;
    } catch (error) {
      console.error('Error updating anomaly status:', error);
      throw error;
    }
  },

  /**
   * Get anomaly statistics
   */
  getStatistics: async (days = 7) => {
    try {
      const response = await apiService.get('/anomalies/statistics', {
        params: { days }
      });
      // Handle different response structures
      if (response.data) {
        if (response.data.success !== undefined) {
          return response;
        }
        // If response.data is the statistics object directly
        return { data: { success: true, statistics: response.data } };
      }
      return response;
    } catch (error) {
      console.error('Error fetching anomaly statistics:', error);
      throw error;
    }
  },

  // ==================== NOTIFICATION CHANNELS (Tab 3: Triggers) ====================

  /**
   * Get all notification channels
   */
  getAllChannels: async () => {
    try {
      const response = await apiService.get('/anomalies/notifications/channels');
      // Handle different response structures
      if (response.data) {
        if (response.data.success !== undefined) {
          return response;
        }
        if (Array.isArray(response.data)) {
          return { data: { success: true, channels: response.data } };
        }
        if (response.data.channels) {
          return { data: { success: true, ...response.data } };
        }
      }
      return response;
    } catch (error) {
      // If endpoint doesn't exist (404), return empty array instead of throwing
      if (error.response?.status === 404) {
        console.warn('Notification channels endpoint not available yet');
        return { data: { success: true, channels: [] } };
      }
      console.error('Error fetching notification channels:', error);
      throw error;
    }
  },

  /**
   * Get single notification channel
   */
  getChannelById: async (channelId) => {
    try {
      const response = await apiService.get(`/anomalies/notifications/channels/${channelId}`);
      return response;
    } catch (error) {
      console.error('Error fetching notification channel:', error);
      throw error;
    }
  },

  /**
   * Create new notification channel
   * @param {Object} channelData - Channel configuration
   */
  createChannel: async (channelData) => {
    try {
      const response = await apiService.post('/anomalies/notifications/channels', channelData);
      // Normalize response
      if (response.data && !response.data.success && response.status >= 200 && response.status < 300) {
        return { ...response, data: { success: true, ...response.data } };
      }
      return response;
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error('Notification channels feature is not yet available on the backend');
      }
      console.error('Error creating notification channel:', error);
      throw error;
    }
  },

  /**
   * Update notification channel
   */
  updateChannel: async (channelId, channelData) => {
    try {
      const response = await apiService.put(
        `/anomalies/notifications/channels/${channelId}`,
        channelData
      );
      // Normalize response
      if (response.data && !response.data.success && response.status >= 200 && response.status < 300) {
        return { ...response, data: { success: true, ...response.data } };
      }
      return response;
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error('Notification channels feature is not yet available on the backend');
      }
      console.error('Error updating notification channel:', error);
      throw error;
    }
  },

  /**
   * Delete notification channel
   */
  deleteChannel: async (channelId) => {
    try {
      const response = await apiService.delete(`/anomalies/notifications/channels/${channelId}`);
      // Normalize response
      if (response.data && !response.data.success && response.status >= 200 && response.status < 300) {
        return { ...response, data: { success: true, ...response.data } };
      }
      return response;
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error('Notification channels feature is not yet available on the backend');
      }
      console.error('Error deleting notification channel:', error);
      throw error;
    }
  },

  /**
   * Test notification channel
   */
  testChannel: async (channelId) => {
    try {
      const response = await apiService.post(`/anomalies/notifications/channels/${channelId}/test`);
      // Normalize response
      if (response.data && !response.data.success && response.status >= 200 && response.status < 300) {
        return { ...response, data: { success: true, ...response.data } };
      }
      return response;
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error('Notification channels feature is not yet available on the backend');
      }
      console.error('Error testing notification channel:', error);
      throw error;
    }
  },

  /**
   * Get notification templates
   */
  getTemplates: async () => {
    try {
      const response = await apiService.get('/anomalies/notifications/templates');
      return response;
    } catch (error) {
      console.error('Error fetching notification templates:', error);
      throw error;
    }
  },

  /**
   * Get notification delivery history
   */
  getDeliveryHistory: async (params = {}) => {
    try {
      const response = await apiService.get('/anomalies/notifications/delivery-history', { params });
      return response;
    } catch (error) {
      console.error('Error fetching delivery history:', error);
      throw error;
    }
  },

  /**
   * Get notification statistics
   */
  getNotificationStatistics: async () => {
    try {
      const response = await apiService.get('/anomalies/notifications/statistics');
      return response;
    } catch (error) {
      console.error('Error fetching notification statistics:', error);
      throw error;
    }
  },

  // ==================== HELPER FUNCTIONS ====================

  /**
   * Format timestamp for display
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
        relative: anomalyService.getRelativeTime(date)
      };
    } catch (e) {
      console.error('Error formatting timestamp:', e);
      return { date: 'Invalid date', time: '', relative: '' };
    }
  },

  /**
   * Get relative time string
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
    
    return date.toLocaleDateString();
  },

  /**
   * Get severity color and icon
   */
  getSeverityInfo: (severity) => {
    const severityMap = {
      critical: {
        color: 'red',
        variant: 'danger',
        icon: '🚨',
        label: 'Critical'
      },
      high: {
        color: 'orange',
        variant: 'warning',
        icon: '⚠️',
        label: 'High'
      },
      medium: {
        color: 'yellow',
        variant: 'warning',
        icon: '⚡',
        label: 'Medium'
      },
      low: {
        color: 'blue',
        variant: 'info',
        icon: 'ℹ️',
        label: 'Low'
      }
    };
    
    return severityMap[severity] || severityMap.medium;
  },

  /**
   * Get status info
   */
  getStatusInfo: (status) => {
    const statusMap = {
      new: {
        variant: 'danger',
        label: 'New',
        color: 'red'
      },
      acknowledged: {
        variant: 'warning',
        label: 'Acknowledged',
        color: 'yellow'
      },
      resolved: {
        variant: 'success',
        label: 'Resolved',
        color: 'green'
      }
    };
    
    return statusMap[status] || statusMap.new;
  },

  /**
   * Get channel type icon
   */
  getChannelIcon: (channelType) => {
    const iconMap = {
      email: '📧',
      sms: '💬',
      whatsapp: '📱',
      push: '🔔',
      webhook: '🔗'
    };
    
    return iconMap[channelType] || '📬';
  },

  /**
   * Validate rule configuration
   */
  validateRule: (ruleData) => {
    const errors = [];
    
    if (!ruleData.name || ruleData.name.trim() === '') {
      errors.push('Rule name is required');
    }
    
    if (!ruleData.rule_type) {
      errors.push('Rule type is required');
    }
    
    if (!ruleData.severity) {
      errors.push('Severity level is required');
    }
    
    if (!ruleData.conditions || Object.keys(ruleData.conditions).length === 0) {
      errors.push('At least one condition is required');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Validate channel configuration
   */
  validateChannel: (channelData) => {
    const errors = [];
    
    if (!channelData.name || channelData.name.trim() === '') {
      errors.push('Channel name is required');
    }
    
    if (!channelData.channel_type) {
      errors.push('Channel type is required');
    }
    
    const validTypes = ['email', 'sms', 'whatsapp', 'push', 'webhook'];
    if (channelData.channel_type && !validTypes.includes(channelData.channel_type)) {
      errors.push(`Channel type must be one of: ${validTypes.join(', ')}`);
    }
    
    if (!channelData.config || Object.keys(channelData.config).length === 0) {
      errors.push('Channel configuration is required');
    }
    
    // Channel-specific validation
    if (channelData.channel_type === 'email') {
      if (!channelData.config.recipients || channelData.config.recipients.length === 0) {
        errors.push('At least one email recipient is required');
      }
    }
    
    if (channelData.channel_type === 'sms' || channelData.channel_type === 'whatsapp') {
      if (!channelData.config.phone_numbers || channelData.config.phone_numbers.length === 0) {
        errors.push('At least one phone number is required');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
};

export default anomalyService;