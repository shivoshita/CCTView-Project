// FILE LOCATION: frontend/src/services/person.service.js

import apiService from './api.service.js';

const personService = {
  /**
   * Register a new person
   * @param {FormData} formData - Form data with image and person details
   */
  registerPerson: async (formData) => {
    try {
      const response = await apiService.post('/persons/register', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data; // ✅ Return only data, not full response
    } catch (error) {
      console.error('Error registering person:', error);
      throw error;
    }
  },

  /**
   * Get all persons
   * @param {Object} params - Query parameters (status, limit, skip)
   */
  getAllPersons: async (params = {}) => {
    try {
      const response = await apiService.get('/persons', { params });
      return response.data; // ✅ Return only data, not full response
    } catch (error) {
      console.error('Error fetching persons:', error);
      throw error;
    }
  },

  /**
   * Get person by ID
   * @param {string} personId - Person ID
   */
  getPersonById: async (personId) => {
    try {
      const response = await apiService.get(`/persons/${personId}`);
      return response.data; // ✅ Return only data, not full response
    } catch (error) {
      console.error('Error fetching person:', error);
      throw error;
    }
  },

  /**
   * Get person's photo
   * @param {string} personId - Person ID
   * @returns {string} Photo URL
   */
  getPersonPhoto: (personId) => {
    // Return the full URL for the photo endpoint
    const baseURL = apiService.defaults?.baseURL || '/api/v1';
    return `${baseURL}/persons/${personId}/photo`;
  },

  /**
   * Update person details
   * @param {string} personId - Person ID
   * @param {Object} updateData - Data to update
   */
  updatePerson: async (personId, updateData) => {
    try {
      const formData = new FormData();
      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== null && updateData[key] !== undefined) {
          formData.append(key, updateData[key]);
        }
      });

      const response = await apiService.put(`/persons/${personId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data; // ✅ Return only data, not full response
    } catch (error) {
      console.error('Error updating person:', error);
      throw error;
    }
  },

  /**
   * Delete person
   * @param {string} personId - Person ID
   */
  deletePerson: async (personId) => {
    try {
      const response = await apiService.delete(`/persons/${personId}`);
      return response.data; // ✅ Return only data, not full response
    } catch (error) {
      console.error('Error deleting person:', error);
      throw error;
    }
  },

  /**
   * Get person's trajectory/movement history
   * @param {string} personId - Person ID
   * @param {Object} params - Query parameters (start_date, end_date)
   */
  getPersonTrajectory: async (personId, params = {}) => {
    try {
      const response = await apiService.get(`/persons/${personId}/trajectory`, { params });
      return response.data; // ✅ Return only data, not full response
    } catch (error) {
      console.error('Error fetching trajectory:', error);
      throw error;
    }
  },

  /**
   * Get person's appearances
   * @param {string} personId - Person ID
   * @param {Object} params - Query parameters (limit, skip)
   */
  getPersonAppearances: async (personId, params = {}) => {
    try {
      const response = await apiService.get(`/persons/${personId}/appearances`, { params });
      return response.data; // ✅ Return only data, not full response
    } catch (error) {
      console.error('Error fetching appearances:', error);
      throw error;
    }
  }
};

export default personService;