// FILE LOCATION: frontend/src/components/AnomalyNotification.jsx

import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, Bell } from 'lucide-react';
import { useTheme } from '../shared/contexts/ThemeContext';
import alertsWebSocket from '../services/websocket.service';

const AnomalyNotification = () => {
  const { theme } = useTheme();
  const [alerts, setAlerts] = useState([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Connect to alerts WebSocket
    const unsubscribe = alertsWebSocket.onMessage((data) => {
      console.log('WebSocket message received:', data);
      
      // Handle both 'anomaly' type and any message with anomaly data
      if (data.type === 'anomaly' || data.anomaly_id || data.rule_name) {
        console.log('Anomaly alert received:', data);
        
        // Add alert to list
        setAlerts((prev) => {
          // Prevent duplicates based on anomaly_id
          const anomalyId = data.anomaly_id || data.id;
          if (anomalyId) {
            const exists = prev.some((a) => a.anomaly_id === anomalyId || a.id === anomalyId);
            if (exists) {
              console.log('Duplicate alert ignored:', anomalyId);
              return prev;
            }
          }
          
          // Add new alert at the beginning
          const newAlert = {
            ...data,
            id: anomalyId || `alert_${Date.now()}`,
            anomaly_id: anomalyId || data.anomaly_id,
            timestamp: data.detected_at ? new Date(data.detected_at) : (data.timestamp ? new Date(data.timestamp) : new Date()),
          };
          
          console.log('Adding new alert to list:', newAlert);
          return [
            newAlert,
            ...prev.slice(0, 4), // Keep max 5 alerts
          ];
        });
      } else {
        console.log('Received non-anomaly message:', data);
      }
    });

    // Check connection status
    const checkConnection = () => {
      const connected = alertsWebSocket.isConnected;
      setIsConnected(connected);
      if (!connected) {
        console.log('WebSocket not connected, attempting to connect...');
        alertsWebSocket.connect();
      }
    };
    
    // Initial connection check
    checkConnection();
    const interval = setInterval(checkConnection, 2000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const removeAlert = (id) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== id));
  };

  const getSeverityColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getSeverityText = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 'CRITICAL';
      case 'high':
        return 'HIGH';
      case 'medium':
        return 'MEDIUM';
      case 'low':
        return 'LOW';
      default:
        return 'INFO';
    }
  };

  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`
            relative backdrop-blur-md rounded-lg border shadow-xl
            animate-slide-in-right
            ${theme === 'dark'
              ? 'bg-slate-900/95 border-slate-700'
              : 'bg-white/95 border-slate-200'
            }
          `}
        >
          {/* Severity indicator bar */}
          <div
            className={`absolute top-0 left-0 right-0 h-1 ${getSeverityColor(
              alert.severity
            )}`}
          />

          {/* Close button */}
          <button
            onClick={() => removeAlert(alert.id)}
            className={`
              absolute top-2 right-2 p-1 rounded-full
              hover:bg-opacity-20 transition-colors
              ${theme === 'dark' ? 'text-slate-400 hover:bg-white' : 'text-slate-600 hover:bg-slate-900'}
            `}
          >
            <X className="w-4 h-4" />
          </button>

          {/* Alert content */}
          <div className="p-4 pr-8">
            <div className="flex items-start gap-3">
              <div
                className={`
                  p-2 rounded-full
                  ${getSeverityColor(alert.severity)} bg-opacity-20
                `}
              >
                <AlertTriangle
                  className={`w-5 h-5 ${getSeverityColor(alert.severity)} text-opacity-100`}
                />
              </div>

              <div className="flex-1 min-w-0">
                {/* Severity badge */}
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`
                      text-xs font-semibold px-2 py-0.5 rounded
                      ${getSeverityColor(alert.severity)} text-white
                    `}
                  >
                    {getSeverityText(alert.severity)}
                  </span>
                  <span
                    className={`
                      text-xs
                      ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}
                    `}
                  >
                    {alert.timestamp?.toLocaleTimeString() || 'Now'}
                  </span>
                </div>

                {/* Rule name */}
                <h4
                  className={`
                    font-semibold mb-1
                    ${theme === 'dark' ? 'text-white' : 'text-slate-900'}
                  `}
                >
                  {alert.rule_name || 'Anomaly Detected'}
                </h4>

                {/* Camera ID */}
                {alert.camera_id && (
                  <p
                    className={`
                      text-xs mb-2
                      ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}
                    `}
                  >
                    Camera: {alert.camera_id}
                  </p>
                )}

                {/* Caption preview */}
                {alert.caption && (
                  <p
                    className={`
                      text-sm mb-2 line-clamp-2
                      ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}
                    `}
                  >
                    {alert.caption.length > 100
                      ? `${alert.caption.substring(0, 100)}...`
                      : alert.caption}
                  </p>
                )}

                {/* Description */}
                {alert.description && alert.description !== alert.caption && (
                  <p
                    className={`
                      text-xs
                      ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}
                    `}
                  >
                    {alert.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AnomalyNotification;

