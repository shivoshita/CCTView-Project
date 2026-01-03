// FILE LOCATION: frontend/src/services/camera.service.js

import apiService from './api.service.js';

const cameraService = {
  /**
   * Get all cameras
   */
  getAllCameras: async () => {
    try {
      const response = await apiService.get('/cameras');
      return response;
    } catch (error) {
      console.error('Error fetching cameras:', error);
      throw error;
    }
  },

  /**
   * Get single camera by ID
   */
  getCameraById: async (cameraId) => {
    try {
      const response = await apiService.get(`/cameras/${cameraId}`);
      return response;
    } catch (error) {
      console.error('Error fetching camera:', error);
      throw error;
    }
  },

  /**
   * Get stream info (HLS playlist URL or HTTP proxy URL)
   */
  getStreamInfo: async (cameraId) => {
    try {
      const response = await apiService.get(`/cameras/${cameraId}/stream`);
      return response;
    } catch (error) {
      console.error('Error fetching stream info:', error);
      throw error;
    }
  },

  /**
   * Add new camera
   * @param {Object} cameraData - Camera configuration
   * @param {string} cameraData.name - Camera name
   * @param {string} cameraData.location - Camera location
   * @param {string} cameraData.stream_url - HTTP/RTSP stream URL
   * @param {string} cameraData.stream_type - 'http' or 'rtsp'
   * @param {string} cameraData.description - Optional description
   */
  addCamera: async (cameraData) => {
    try {
      const response = await apiService.post('/cameras', cameraData);
      return response;
    } catch (error) {
      console.error('Error adding camera:', error);
      throw error;
    }
  },

  /**
   * Update camera configuration
   */
  updateCamera: async (cameraId, cameraData) => {
    try {
      const response = await apiService.put(`/cameras/${cameraId}`, cameraData);
      return response;
    } catch (error) {
      console.error('Error updating camera:', error);
      throw error;
    }
  },

  /**
   * Delete camera
   * @param {string} cameraId - Camera ID to delete
   * @param {boolean} keepEvents - If true, preserve events in database
   */
  deleteCamera: async (cameraId, keepEvents = true) => {
    try {
      const response = await apiService.delete(`/cameras/${cameraId}`, {
        params: {
          keep_events: keepEvents
        }
      });
      return response;
    } catch (error) {
      console.error('Error deleting camera:', error);
      throw error;
    }
  },

  /**
   * Start camera stream processing
   */
  startStream: async (cameraId) => {
    try {
      const response = await apiService.post(`/cameras/${cameraId}/start`);
      return response;
    } catch (error) {
      console.error('Error starting stream:', error);
      throw error;
    }
  },

  /**
   * Stop camera stream processing
   */
  stopStream: async (cameraId) => {
    try {
      const response = await apiService.post(`/cameras/${cameraId}/stop`);
      return response;
    } catch (error) {
      console.error('Error stopping stream:', error);
      throw error;
    }
  },

  /**
   * Get camera health status
   */
  getCameraHealth: async (cameraId) => {
    try {
      const response = await apiService.get(`/cameras/${cameraId}/health`);
      return response;
    } catch (error) {
      console.error('Error fetching camera health:', error);
      throw error;
    }
  },

  /**
   * Test camera connection before adding
   */
  testConnection: async (streamUrl, streamType = 'http') => {
    try {
      const response = await apiService.post('/cameras/test-connection', {
        stream_url: streamUrl,
        stream_type: streamType
      });
      return response;
    } catch (error) {
      console.error('Error testing connection:', error);
      throw error;
    }
  },

  /**
   * Get real-time object detections for camera
   */
  getDetections: async (cameraId) => {
    try {
      const response = await apiService.get(`/cameras/${cameraId}/detections`);
      return response;
    } catch (error) {
      console.error('Error fetching detections:', error);
      throw error;
    }
  },

// FILE LOCATION: frontend/src/services/camera.service.js
// This is the section that needs to be updated

  /**
   * Create panoramic stitched view
   * 
   * @param {string} panoramaId - Unique panorama identifier
   * @param {string[]} cameraIds - Array of camera IDs (will be joined with commas)
   * @param {string} stitchMode - 'panorama' or 'scans'
   */
  createPanorama: async (panoramaId, cameraIds, stitchMode = 'panorama') => {
    try {
      // ✅ FIX: Convert array to comma-separated string for query parameter
      const cameraIdsString = cameraIds.join(',');
      
      console.log('Creating panorama:', {
        panoramaId,
        cameraIds,
        cameraIdsString,
        stitchMode
      });
      
      const response = await apiService.post('/cameras/panoramic/create', null, {
        params: {
          panorama_id: panoramaId,
          camera_ids: cameraIdsString,  // ✅ Send as comma-separated string
          stitch_mode: stitchMode
        }
      });
      
      return response;
    } catch (error) {
      console.error('Error creating panorama:', error);
      throw error;
    }
  },
  
  /**
   * Stop panoramic stitching
   */
  stopPanorama: async (panoramaId) => {
    try {
      const response = await apiService.delete(`/cameras/panoramic/${panoramaId}`);
      return response;
    } catch (error) {
      console.error('Error stopping panorama:', error);
      throw error;
    }
  },

/**
   * Get chair occupancy tracking with timers
   */
  getChairTracking: async (cameraId) => {
    try {
      const response = await apiService.get(`/cameras/${cameraId}/chair-tracking`);
      return response;
    } catch (error) {
      console.error('Error fetching chair tracking:', error);
      throw error;
    }
  },

  /**
   * Get depth map for camera
  */
  getDepthMap: async (cameraId) => {
    try {
      const response = await apiService.get(`/cameras/${cameraId}/depth-map`);
      return response;
    } catch (error) {
      console.error('Error fetching depth map:', error);
      throw error;
    }
  },

  /**
   * Update caption generation interval
   */
  updateCaptionInterval: async (cameraId, interval) => {
    try {
      const response = await apiService.put(`/cameras/${cameraId}/caption-interval`, null, {
        params: { interval }
      });
      return response;
    } catch (error) {
      console.error('Error updating caption interval:', error);
      throw error;
    }
  }
};

export default cameraService;