// FILE LOCATION: frontend/src/pages/Anomalies/tabs/HistoryTab.jsx

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Camera,
  Clock,
  MapPin,
  ChevronDown,
  ChevronUp,
  Filter,
  Eye,
  CheckCircle,
  AlertCircle,
  Video,
  Play,
  Download,
  RefreshCw,
  X
} from 'lucide-react';
import { useTheme } from '../../../shared/contexts/ThemeContext';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Loader from '../../../shared/components/ui/Loader';
import Modal from '../../../shared/components/ui/Modal';
import anomalyService from '../../../services/anomaly.service';
import apiService from '../../../services/api.service.js';

function HistoryTab({ toast, statistics }) {
  const { theme } = useTheme();
  
  const [detections, setDetections] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedDetection, setExpandedDetection] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDetection, setSelectedDetection] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Filters
  const [filters, setFilters] = useState({
    camera_id: '',
    severity: '',
    status: '',
    limit: 50
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchDetections();
    fetchCameras();
  }, []);

  // Note: We don't auto-refresh on filter changes to avoid excessive API calls
  // Users should use the "Apply Filters" button or "Refresh" button

  const fetchDetections = async (appliedFilters = filters) => {
    try {
      setLoading(true);
      const params = {};
      
      if (appliedFilters.camera_id) params.camera_id = appliedFilters.camera_id;
      if (appliedFilters.severity) params.severity = appliedFilters.severity;
      if (appliedFilters.status) params.status = appliedFilters.status;
      params.limit = appliedFilters.limit || 50;

      const response = await anomalyService.getDetections(params);
      
      // Handle different response structures
      let detectionsList = [];
      if (response.data) {
        if (response.data.success && response.data.detections) {
          detectionsList = response.data.detections;
        } else if (Array.isArray(response.data)) {
          detectionsList = response.data;
        } else if (response.data.detections) {
          detectionsList = response.data.detections;
        }
      }
      
      setDetections(detectionsList);
    } catch (error) {
      console.error('Error fetching detections:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to load anomaly detections';
      toast.error('Error', errorMessage);
      setDetections([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const fetchCameras = async () => {
    try {
      const response = await apiService.get('/cameras');
      const camerasList = Array.isArray(response.data) 
        ? response.data 
        : response.data.cameras || [];
      setCameras(camerasList);
    } catch (error) {
      console.error('Error fetching cameras:', error);
    }
  };

  const fetchDetectionDetail = async (detectionId) => {
    try {
      setDetailLoading(true);
      const response = await anomalyService.getDetectionById(detectionId);
      
      // Handle different response structures
      let detection = null;
      if (response.data) {
        if (response.data.success && response.data.detection) {
          detection = response.data.detection;
        } else if (response.data.detection) {
          detection = response.data.detection;
        } else if (!response.data.success && Object.keys(response.data).length > 0) {
          // If response.data is the detection object directly
          detection = response.data;
        }
      }
      
      if (detection) {
        setSelectedDetection(detection);
        setShowDetailModal(true);
      } else {
        toast.error('Error', 'Detection details not found');
      }
    } catch (error) {
      console.error('Error fetching detection detail:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to load detection details';
      toast.error('Error', errorMessage);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleStatusChange = async (detectionId, newStatus) => {
    try {
      const response = await anomalyService.updateDetectionStatus(detectionId, newStatus);
      
      if (response.data?.success || response.status >= 200 && response.status < 300) {
        toast.success('Success', `Status updated to ${newStatus}`);
        await fetchDetections(); // Refresh the list
      } else {
        toast.error('Error', 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to update status';
      toast.error('Error', errorMessage);
    }
  };

  const handleApplyFilters = () => {
    fetchDetections(filters);
    setShowFilters(false);
  };

  const handleClearFilters = () => {
    const clearedFilters = {
      camera_id: '',
      severity: '',
      status: '',
      limit: 50
    };
    setFilters(clearedFilters);
    // Don't need to call fetchDetections here as useEffect will handle it
    setShowFilters(false);
  };

  const formatTimestamp = (timestamp) => {
    return anomalyService.formatTimestamp(timestamp);
  };

  const getSeverityInfo = (severity) => {
    return anomalyService.getSeverityInfo(severity);
  };

  const getStatusInfo = (status) => {
    return anomalyService.getStatusInfo(status);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Filters */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-xl font-semibold ${
            theme === 'dark' ? 'text-white' : 'text-slate-900'
          }`}>
            Detection History
          </h2>
          <p className={`text-sm mt-1 ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
          }`}>
            {detections.length} detection{detections.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            icon={Filter}
            onClick={() => setShowFilters(!showFilters)}
          >
            Filters
            {(filters.camera_id || filters.severity || filters.status) && (
              <Badge variant="primary" size="sm" className="ml-2">
                Active
              </Badge>
            )}
          </Button>
          <Button
            variant="primary"
            icon={RefreshCw}
            onClick={() => fetchDetections()}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className={`rounded-xl border backdrop-blur-sm p-4 ${
          theme === 'dark'
            ? 'bg-slate-900/50 border-slate-700'
            : 'bg-white border-slate-200'
        }`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Camera Filter */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
              }`}>
                Camera
              </label>
              <select
                value={filters.camera_id}
                onChange={(e) => setFilters({ ...filters, camera_id: e.target.value })}
                className={`w-full px-4 py-2 rounded-lg border transition-all ${
                  theme === 'dark'
                    ? 'bg-slate-900/50 border-slate-700 text-white focus:border-blue-500'
                    : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                }`}
              >
                <option value="">All Cameras</option>
                {cameras.map((camera) => (
                  <option key={camera.id} value={camera.id}>
                    {camera.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Severity Filter */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
              }`}>
                Severity
              </label>
              <select
                value={filters.severity}
                onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
                className={`w-full px-4 py-2 rounded-lg border transition-all ${
                  theme === 'dark'
                    ? 'bg-slate-900/50 border-slate-700 text-white focus:border-blue-500'
                    : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                }`}
              >
                <option value="">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
              }`}>
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className={`w-full px-4 py-2 rounded-lg border transition-all ${
                  theme === 'dark'
                    ? 'bg-slate-900/50 border-slate-700 text-white focus:border-blue-500'
                    : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                }`}
              >
                <option value="">All Statuses</option>
                <option value="new">New</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant={theme === 'dark' ? 'outline' : 'primary'} onClick={handleClearFilters}>
              Clear
            </Button>
            <Button variant={theme === 'dark' ? 'outline' : 'primary'} onClick={handleApplyFilters}>
              Apply Filters
            </Button>
          </div>
        </div>
      )}

      {/* Detections List */}
      {detections.length === 0 ? (
        <div className={`rounded-xl border backdrop-blur-sm p-12 text-center ${
          theme === 'dark'
            ? 'bg-slate-900/50 border-slate-700'
            : 'bg-slate-50 border-slate-200'
        }`}>
          <AlertTriangle className={`w-12 h-12 mx-auto mb-4 ${
            theme === 'dark' ? 'text-slate-600' : 'text-slate-300'
          }`} />
          <p className={`text-lg font-medium mb-2 ${
            theme === 'dark' ? 'text-white' : 'text-slate-900'
          }`}>
            No Anomalies Detected
          </p>
          <p className={`text-sm ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
          }`}>
            {filters.camera_id || filters.severity || filters.status
              ? 'No detections match your current filters'
              : 'No anomalies have been detected yet'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {detections.map((detection, index) => {
            const isExpanded = expandedDetection === detection.id;
            const timestamp = formatTimestamp(detection.detected_at);
            const severityInfo = getSeverityInfo(detection.severity);
            const statusInfo = getStatusInfo(detection.status);

            return (
              <div
                key={detection.id}
                className={`rounded-xl border transition-all ${
                  isExpanded ? 'ring-2 ring-blue-500' : ''
                } ${
                  theme === 'dark'
                    ? 'bg-slate-900/50 border-slate-700 hover:border-slate-600'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Detection Header */}
                <div className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Index & Severity Icon */}
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                      theme === 'dark'
                        ? `bg-${severityInfo.color}-500/10`
                        : `bg-${severityInfo.color}-50`
                    }`}>
                      <span className="text-2xl">{severityInfo.icon}</span>
                    </div>

                    {/* Detection Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className={`text-lg font-semibold ${
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        }`}>
                          {detection.type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown Anomaly'}
                        </h3>
                        <Badge variant={severityInfo.variant} size="sm">
                          {severityInfo.label}
                        </Badge>
                        <Badge variant={statusInfo.variant} size="sm">
                          {statusInfo.label}
                        </Badge>
                        {detection.confidence && (
                          <Badge variant="default" size="sm">
                            {(detection.confidence * 100).toFixed(0)}% confidence
                          </Badge>
                        )}
                      </div>

                      <p className={`text-sm mb-3 ${
                        theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                      }`}>
                        {detection.description || 'No description available'}
                      </p>

                      {/* Metadata */}
                      <div className="flex flex-wrap gap-3">
                        <div className="flex items-center gap-1">
                          <Camera className={`w-3 h-3 ${
                            theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                          }`} />
                          <span className={`text-xs ${
                            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                          }`}>
                            {detection.camera?.name || 'Unknown'}
                          </span>
                        </div>
                        {detection.camera?.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className={`w-3 h-3 ${
                              theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                            }`} />
                            <span className={`text-xs ${
                              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                            }`}>
                              {detection.camera.location}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Clock className={`w-3 h-3 ${
                            theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                          }`} />
                          <span className={`text-xs ${
                            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                          }`}>
                            {timestamp.time} • {timestamp.relative}
                          </span>
                        </div>
                        {detection.rule?.name && (
                          <Badge variant="info" size="sm">
                            Rule: {detection.rule.name}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                      <Button
                        variant={theme === 'dark' ? 'outline' : 'primary'}
                        size="sm"
                        icon={Eye}
                        onClick={() => fetchDetectionDetail(detection.id)}
                      >
                        Details
                      </Button>
                      
                      {detection.status === 'new' && (
                        <Button
                          variant={theme === 'dark' ? 'outline' : 'primary'}
                          size="sm"
                          icon={CheckCircle}
                          onClick={() => handleStatusChange(detection.id, 'acknowledged')}
                        >
                          Acknowledge
                        </Button>
                      )}
                      
                      {detection.status === 'acknowledged' && (
                        <Button
                          variant={theme === 'dark' ? 'outline' : 'primary'}
                          size="sm"
                          icon={CheckCircle}
                          onClick={() => handleStatusChange(detection.id, 'resolved')}
                        >
                          Resolve
                        </Button>
                      )}

                      <button
                        onClick={() => setExpandedDetection(isExpanded ? null : detection.id)}
                        className={`p-2 rounded-lg transition-colors ${
                          theme === 'dark'
                            ? 'hover:bg-slate-800 text-slate-400 hover:text-white'
                            : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5" />
                        ) : (
                          <ChevronDown className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className={`px-4 pb-4 border-t ${
                    theme === 'dark' ? 'border-slate-700' : 'border-slate-200'
                  }`}>
                    <div className="pt-4 space-y-3">
                      {/* Event Caption */}
                      {detection.event?.caption && (
                        <div className={`p-3 rounded-lg ${
                          theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50'
                        }`}>
                          <p className={`text-xs font-medium mb-2 ${
                            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                          }`}>
                            EVENT CAPTION
                          </p>
                          <p className={`text-sm ${
                            theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                          }`}>
                            {detection.event.caption}
                          </p>
                        </div>
                      )}

                      {/* Full Timestamp */}
                      <div className={`p-3 rounded-lg ${
                        theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50'
                      }`}>
                        <p className={`text-xs font-medium mb-2 ${
                          theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                        }`}>
                          DETECTED AT
                        </p>
                        <p className={`text-sm font-mono ${
                          theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                        }`}>
                          {timestamp.full}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedDetection(null);
        }}
        title="Anomaly Detection Details"
        size="lg"
      >
        {detailLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader size="lg" />
          </div>
        ) : selectedDetection ? (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${
                theme === 'dark' ? 'bg-red-500/10' : 'bg-red-50'
              }`}>
                <AlertTriangle className={`w-6 h-6 ${
                  theme === 'dark' ? 'text-red-400' : 'text-red-600'
                }`} />
              </div>
              <div>
                <h3 className={`text-lg font-semibold ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  {selectedDetection.type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </h3>
                <p className={`text-sm ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  Detection ID: {selectedDetection.id}
                </p>
              </div>
            </div>

            {/* Description */}
            <div className={`p-4 rounded-lg ${
              theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50'
            }`}>
              <p className={`text-sm ${
                theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
              }`}>
                {selectedDetection.description}
              </p>
            </div>

            {/* Camera & Location */}
            <div className="grid grid-cols-2 gap-4">
              <div className={`p-4 rounded-lg ${
                theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50'
              }`}>
                <p className={`text-xs font-medium mb-2 ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  CAMERA
                </p>
                <p className={`text-sm font-medium ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  {selectedDetection.camera?.name || 'Unknown'}
                </p>
              </div>

              <div className={`p-4 rounded-lg ${
                theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50'
              }`}>
                <p className={`text-xs font-medium mb-2 ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  LOCATION
                </p>
                <p className={`text-sm font-medium ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  {selectedDetection.camera?.location || 'Unknown'}
                </p>
              </div>
            </div>

            {/* Event Details */}
            {selectedDetection.event && (
              <div className={`p-4 rounded-lg ${
                theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50'
              }`}>
                <p className={`text-xs font-medium mb-2 ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  RELATED EVENT
                </p>
                <p className={`text-sm ${
                  theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  {selectedDetection.event.caption || 'No caption available'}
                </p>
              </div>
            )}

            {/* Rule Info */}
            {selectedDetection.rule && (
              <div className={`p-4 rounded-lg ${
                theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50'
              }`}>
                <p className={`text-xs font-medium mb-2 ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  TRIGGERED BY RULE
                </p>
                <p className={`text-sm font-medium ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  {selectedDetection.rule.name}
                </p>
                {selectedDetection.rule.description && (
                  <p className={`text-xs mt-1 ${
                    theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    {selectedDetection.rule.description}
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              {selectedDetection.event?.video_reference && (
                <Button variant={theme === 'dark' ? 'outline' : 'primary'} icon={Play} fullWidth>
                  View Video
                </Button>
              )}
              <Button variant={theme === 'dark' ? 'outline' : 'primary'} icon={Download} fullWidth>
                Download Report
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

export default HistoryTab;