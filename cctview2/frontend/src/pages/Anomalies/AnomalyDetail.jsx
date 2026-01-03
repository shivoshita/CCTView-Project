// FILE LOCATION: frontend/src/pages/Anomalies/AnomalyDetail.jsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  Clock,
  MapPin,
  AlertTriangle,
  Shield,
  CheckCircle,
  XCircle,
  Play,
  Download,
  Share2,
  Activity,
  Eye,
  Calendar
} from 'lucide-react';
import { useTheme } from '../../shared/contexts/ThemeContext';
import Button from '../../shared/components/ui/Button';
import Badge from '../../shared/components/ui/Badge';
import Loader from '../../shared/components/ui/Loader';
import anomalyService from '../../services/anomaly.service';

function AnomalyDetail() {
  const { theme } = useTheme();
  const { anomalyId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [anomaly, setAnomaly] = useState(null);
  const [error, setError] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    if (anomalyId) {
      fetchAnomalyDetail();
    }
  }, [anomalyId]);

  const fetchAnomalyDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await anomalyService.getDetectionById(anomalyId);
      
      if (response.data.success) {
        setAnomaly(response.data.detection);
      }
    } catch (error) {
      console.error('Error fetching anomaly detail:', error);
      setError('Failed to load anomaly details');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    try {
      setUpdatingStatus(true);
      await anomalyService.updateDetectionStatus(anomalyId, newStatus);
      
      // Refresh data
      await fetchAnomalyDetail();
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getSeverityInfo = (severity) => anomalyService.getSeverityInfo(severity);
  const getStatusInfo = (status) => anomalyService.getStatusInfo(status);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <Loader size="lg" />
        <p className={`mt-4 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
          Loading anomaly details...
        </p>
      </div>
    );
  }

  if (error || !anomaly) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <AlertTriangle className={`w-12 h-12 mb-4 ${
          theme === 'dark' ? 'text-red-400' : 'text-red-600'
        }`} />
        <p className={`text-lg font-medium mb-2 ${
          theme === 'dark' ? 'text-white' : 'text-slate-900'
        }`}>
          {error || 'Anomaly not found'}
        </p>
        <Button onClick={() => navigate('/anomalies')} variant="primary" icon={ArrowLeft}>
          Back to Anomalies
        </Button>
      </div>
    );
  }

  const severityInfo = getSeverityInfo(anomaly.severity);
  const statusInfo = getStatusInfo(anomaly.status);
  const timestamp = anomalyService.formatTimestamp(anomaly.detected_at);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            icon={ArrowLeft}
            onClick={() => navigate('/anomalies')}
          >
            Back
          </Button>
          <div>
            <h1 className={`text-3xl font-bold ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>
              Anomaly Detail
            </h1>
            <p className={`text-sm mt-1 ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>
              ID: {anomaly.id}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {anomaly.status === 'new' && (
            <Button
              variant="primary"
              icon={CheckCircle}
              onClick={() => handleStatusUpdate('acknowledged')}
              disabled={updatingStatus}
            >
              Acknowledge
            </Button>
          )}
          {anomaly.status !== 'resolved' && (
            <Button
              variant="success"
              icon={CheckCircle}
              onClick={() => handleStatusUpdate('resolved')}
              disabled={updatingStatus}
            >
              Mark Resolved
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Video/Image Card */}
          <div className={`rounded-xl border backdrop-blur-sm overflow-hidden ${
            theme === 'dark'
              ? 'bg-slate-800/50 border-slate-700'
              : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className={`aspect-video flex items-center justify-center ${
              theme === 'dark' ? 'bg-slate-900' : 'bg-slate-100'
            }`}>
              <div className="text-center">
                <Play className={`w-16 h-16 mx-auto mb-4 ${
                  theme === 'dark' ? 'text-slate-600' : 'text-slate-300'
                }`} />
                <p className={`text-sm ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  Video evidence will be displayed here
                </p>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className={`rounded-xl border backdrop-blur-sm p-6 ${
            theme === 'dark'
              ? 'bg-slate-800/50 border-slate-700'
              : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-start gap-3 mb-4">
              <div className={`p-2 rounded-lg ${
                severityInfo.color === 'red'
                  ? theme === 'dark' ? 'bg-red-500/10' : 'bg-red-50'
                  : theme === 'dark' ? 'bg-amber-500/10' : 'bg-amber-50'
              }`}>
                <AlertTriangle className={`w-5 h-5 ${
                  severityInfo.color === 'red'
                    ? theme === 'dark' ? 'text-red-400' : 'text-red-600'
                    : theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
                }`} />
              </div>
              <div className="flex-1">
                <h2 className={`text-lg font-semibold mb-2 ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  {anomaly.type}
                </h2>
                <p className={`text-base leading-relaxed ${
                  theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  {anomaly.description}
                </p>
              </div>
            </div>

            {/* Confidence Score */}
            <div className={`mt-4 pt-4 border-t ${
              theme === 'dark' ? 'border-slate-700' : 'border-slate-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-medium ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  Detection Confidence
                </span>
                <span className={`text-sm font-bold ${
                  anomaly.confidence > 0.8
                    ? 'text-emerald-500'
                    : anomaly.confidence > 0.6
                      ? 'text-amber-500'
                      : 'text-red-500'
                }`}>
                  {(anomaly.confidence * 100).toFixed(1)}%
                </span>
              </div>
              <div className={`h-2 rounded-full overflow-hidden ${
                theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'
              }`}>
                <div
                  className={`h-full transition-all ${
                    anomaly.confidence > 0.8
                      ? 'bg-emerald-500'
                      : anomaly.confidence > 0.6
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                  }`}
                  style={{ width: `${anomaly.confidence * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Related Event */}
          {anomaly.event && (
            <div className={`rounded-xl border backdrop-blur-sm p-6 ${
              theme === 'dark'
                ? 'bg-slate-800/50 border-slate-700'
                : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <h3 className={`font-semibold mb-4 ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                Related Event
              </h3>
              <div className={`p-4 rounded-lg ${
                theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-100'
              }`}>
                <p className={`text-sm mb-2 ${
                  theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  {anomaly.event.caption}
                </p>
                <div className="flex items-center gap-4 text-xs">
                  <span className={theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}>
                    Event ID: {anomaly.event.id}
                  </span>
                  {anomaly.event.timestamp && (
                    <span className={theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}>
                      {anomalyService.formatTimestamp(anomaly.event.timestamp).time}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Metadata */}
        <div className="space-y-6">
          {/* Status & Severity */}
          <div className={`rounded-xl border backdrop-blur-sm p-6 ${
            theme === 'dark'
              ? 'bg-slate-800/50 border-slate-700'
              : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <h3 className={`font-semibold mb-4 ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>
              Status & Priority
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className={`text-sm ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  Status
                </span>
                <Badge variant={statusInfo.variant} size="sm">
                  {statusInfo.label}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className={`text-sm ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  Severity
                </span>
                <Badge variant={severityInfo.variant} size="sm">
                  {severityInfo.icon} {severityInfo.label}
                </Badge>
              </div>
            </div>
          </div>

          {/* Time Information */}
          <div className={`rounded-xl border backdrop-blur-sm p-6 ${
            theme === 'dark'
              ? 'bg-slate-800/50 border-slate-700'
              : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-center gap-3 mb-4">
              <Clock className={`w-5 h-5 ${
                theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
              }`} />
              <h3 className={`font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                Timeline
              </h3>
            </div>
            <div className="space-y-3">
              <div>
                <p className={`text-xs ${
                  theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                }`}>
                  Detected
                </p>
                <p className={`text-sm font-medium ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  {timestamp.date}
                </p>
                <p className={`text-sm ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  {timestamp.time}
                </p>
              </div>
              <div>
                <p className={`text-xs ${
                  theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                }`}>
                  Time Since Detection
                </p>
                <p className={`text-sm font-medium ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  {timestamp.relative}
                </p>
              </div>
            </div>
          </div>

          {/* Camera Information */}
          {anomaly.camera && (
            <div className={`rounded-xl border backdrop-blur-sm p-6 ${
              theme === 'dark'
                ? 'bg-slate-800/50 border-slate-700'
                : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div className="flex items-center gap-3 mb-4">
                <Camera className={`w-5 h-5 ${
                  theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                }`} />
                <h3 className={`font-semibold ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  Camera
                </h3>
              </div>
              <div className="space-y-2">
                <p className={`text-sm font-medium ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  {anomaly.camera.name}
                </p>
                {anomaly.camera.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className={`w-3 h-3 ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                    }`} />
                    <span className={`text-xs ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                    }`}>
                      {anomaly.camera.location}
                    </span>
                  </div>
                )}
                <p className={`text-xs ${
                  theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                }`}>
                  ID: {anomaly.camera.id}
                </p>
              </div>
            </div>
          )}

          {/* Matched Rule */}
          {anomaly.rule && (
            <div className={`rounded-xl border backdrop-blur-sm p-6 ${
              theme === 'dark'
                ? 'bg-slate-800/50 border-slate-700'
                : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <div className="flex items-center gap-3 mb-4">
                <Shield className={`w-5 h-5 ${
                  theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                }`} />
                <h3 className={`font-semibold ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  Matched Rule
                </h3>
              </div>
              <div className={`p-3 rounded-lg ${
                theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-100'
              }`}>
                <p className={`text-sm font-medium mb-1 ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  {anomaly.rule.name}
                </p>
                <p className={`text-xs ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  {anomaly.rule.description}
                </p>
              </div>
            </div>
          )}

          {/* Alerts Sent */}
          {anomaly.alerts_sent && anomaly.alerts_sent.length > 0 && (
            <div className={`rounded-xl border backdrop-blur-sm p-6 ${
              theme === 'dark'
                ? 'bg-slate-800/50 border-slate-700'
                : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <h3 className={`font-semibold mb-3 ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                Alerts Sent
              </h3>
              <div className="flex items-center gap-2">
                <Activity className={`w-4 h-4 ${
                  theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                }`} />
                <span className={`text-sm ${
                  theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  {anomaly.alerts_sent.length} notification(s) delivered
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AnomalyDetail;