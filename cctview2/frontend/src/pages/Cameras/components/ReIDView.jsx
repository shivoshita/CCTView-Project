// FILE LOCATION: frontend/src/pages/Cameras/components/ReIDView.jsx

import React, { useState, useEffect, useRef } from 'react';
import { Users, Camera, AlertCircle, RefreshCw, Trash2, ArrowRight, MapPin } from 'lucide-react';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import { useTheme } from '../../../shared/contexts/ThemeContext';
import reidService from '../../../services/reid.service';
import cameraService from '../../../services/camera.service';
import ReIDOverlay from './ReIDOverlay';
import Hls from 'hls.js';
import API_BASE_URL from '../../../config/api.config';

// Simple video player component with Re-ID overlay
const ReIDVideoPlayer = ({ camera, detections, theme }) => {
  const videoRef = useRef(null);
  const [streamInfo, setStreamInfo] = useState(null);

  useEffect(() => {
    const fetchStreamInfo = async () => {
      try {
        const response = await cameraService.getStreamInfo(camera.id);
        const actualData = response.data || response;
        setStreamInfo(actualData);
      } catch (err) {
        console.error('Error fetching stream info:', err);
      }
    };

    fetchStreamInfo();
  }, [camera.id]);

  useEffect(() => {
    if (!streamInfo || !videoRef.current) return;

    if (streamInfo.type === 'hls') {
      let baseUrl = API_BASE_URL;
      if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
        baseUrl = baseUrl.replace(/localhost|127\.0\.0\.1/, window.location.hostname);
      }
      
      baseUrl = baseUrl.replace(/\/$/, '');
      const playlistPath = streamInfo.playlist_url.replace(/^\//, '');
      const playlistUrl = `${baseUrl}/${playlistPath}`;

      if (Hls.isSupported()) {
        const hls = new Hls({
          debug: false,
          lowLatencyMode: true,
          liveSyncDurationCount: 1
        });

        hls.loadSource(playlistUrl);
        hls.attachMedia(videoRef.current);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          videoRef.current.play().catch(e => console.warn('Autoplay prevented:', e));
        });

        return () => hls.destroy();
      }
    }
  }, [streamInfo]);

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        autoPlay
        muted
        playsInline
      />
      <ReIDOverlay
        detections={detections}
        videoRef={videoRef}
        cameraId={camera.id}
        theme={theme}
      />
      
      {/* Camera label */}
      <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-sm px-3 py-1.5 rounded-full">
        <span className="text-white text-sm font-medium">{camera.name}</span>
      </div>
    </div>
  );
};

const ReIDView = ({ cameras }) => {
  const { theme } = useTheme();
  const [selectedCameras, setSelectedCameras] = useState([]);
  const [tracking, setTracking] = useState(false);
  const [trackingData, setTrackingData] = useState(null);
  const [transitions, setTransitions] = useState([]);
  const pollingInterval = useRef(null);

  // Filter only active cameras
  const activeCameras = cameras.filter(c => c.status === 'active');

  const toggleCamera = (cameraId) => {
    setSelectedCameras(prev => {
      if (prev.includes(cameraId)) {
        return prev.filter(id => id !== cameraId);
      } else {
        return [...prev, cameraId];
      }
    });
  };

  const startTracking = async () => {
    if (selectedCameras.length < 2) {
      alert('Please select at least 2 cameras for Re-ID tracking');
      return;
    }

    try {
      await reidService.startTracking(selectedCameras);
      setTracking(true);
      
      // Start polling for tracking data
      pollingInterval.current = setInterval(async () => {
        try {
          const response = await reidService.getTracking(selectedCameras);
          const data = response.data || response;
          
          if (data.success) {
            setTrackingData(data);
            
            // Append new transitions
            if (data.transitions && data.transitions.length > 0) {
              setTransitions(prev => [...data.transitions, ...prev].slice(0, 50));
            }
          }
        } catch (error) {
          console.error('Error polling tracking data:', error);
        }
      }, 500); // Poll every 500ms
      
    } catch (error) {
      console.error('Error starting tracking:', error);
      alert('Failed to start Re-ID tracking');
    }
  };

  const stopTracking = () => {
    setTracking(false);
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
  };

  const resetTracking = async () => {
    try {
      await reidService.resetTracking();
      setTrackingData(null);
      setTransitions([]);
    } catch (error) {
      console.error('Error resetting tracking:', error);
    }
  };

  useEffect(() => {
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`rounded-xl border p-6 ${
        theme === 'dark'
          ? 'bg-slate-800/50 border-slate-700'
          : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className={`text-2xl font-bold mb-2 ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>
              Person Re-Identification
            </h2>
            <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
              Track people across multiple cameras in real-time
            </p>
          </div>

          <div className="flex items-center gap-2">
            {tracking && (
              <>
                <Button
                  variant="ghost"
                  icon={Trash2}
                  onClick={resetTracking}
                >
                  Reset
                </Button>
                <Button
                  variant="danger"
                  icon={RefreshCw}
                  onClick={stopTracking}
                >
                  Stop Tracking
                </Button>
              </>
            )}
            {!tracking && (
              <Button
                variant="primary"
                icon={Users}
                onClick={startTracking}
                disabled={selectedCameras.length < 2}
              >
                Start Tracking
              </Button>
            )}
          </div>
        </div>

        {/* Camera Selection */}
        {!tracking && (
          <div>
            <h3 className={`text-sm font-medium mb-3 ${
              theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
            }`}>
              Select Cameras (minimum 2):
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {activeCameras.map(camera => (
                <button
                  key={camera.id}
                  onClick={() => toggleCamera(camera.id)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    selectedCameras.includes(camera.id)
                      ? 'border-blue-500 bg-blue-500/10'
                      : theme === 'dark'
                        ? 'border-slate-700 bg-slate-900/50 hover:border-slate-600'
                        : 'border-slate-300 bg-white hover:border-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Camera className={`w-4 h-4 ${
                      selectedCameras.includes(camera.id)
                        ? 'text-blue-500'
                        : theme === 'dark'
                          ? 'text-slate-400'
                          : 'text-slate-600'
                    }`} />
                    <span className={`text-sm font-medium ${
                      selectedCameras.includes(camera.id)
                        ? 'text-blue-500'
                        : theme === 'dark'
                          ? 'text-white'
                          : 'text-slate-900'
                    }`}>
                      {camera.name}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {activeCameras.length < 2 && (
              <div className={`mt-4 p-3 rounded-lg flex items-start gap-2 ${
                theme === 'dark'
                  ? 'bg-yellow-500/10 text-yellow-400'
                  : 'bg-yellow-50 text-yellow-600'
              }`}>
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="text-sm">
                  You need at least 2 active cameras to use Re-ID tracking. Please add and start more cameras.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tracking View */}
      {tracking && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Camera Grids */}
          <div className="lg:col-span-2 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {selectedCameras.map(cameraId => {
                const camera = cameras.find(c => c.id === cameraId);
                if (!camera) return null;

                return (
                  <div key={cameraId} className="aspect-video">
                    <ReIDVideoPlayer
                      camera={camera}
                      detections={trackingData?.detections || []}
                      theme={theme}
                    />
                  </div>
                );
              })}
            </div>

            {/* Stats */}
            {trackingData && (
              <div className="grid grid-cols-3 gap-4">
                <div className={`rounded-lg border p-4 ${
                  theme === 'dark'
                    ? 'bg-slate-800/50 border-slate-700'
                    : 'bg-white border-slate-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-5 h-5 text-blue-500" />
                    <span className={`text-sm ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                    }`}>
                      Total Persons
                    </span>
                  </div>
                  <p className={`text-2xl font-bold ${
                    theme === 'dark' ? 'text-white' : 'text-slate-900'
                  }`}>
                    {trackingData.total_persons}
                  </p>
                </div>

                <div className={`rounded-lg border p-4 ${
                  theme === 'dark'
                    ? 'bg-slate-800/50 border-slate-700'
                    : 'bg-white border-slate-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Camera className="w-5 h-5 text-emerald-500" />
                    <span className={`text-sm ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                    }`}>
                      Cameras
                    </span>
                  </div>
                  <p className={`text-2xl font-bold ${
                    theme === 'dark' ? 'text-white' : 'text-slate-900'
                  }`}>
                    {selectedCameras.length}
                  </p>
                </div>

                <div className={`rounded-lg border p-4 ${
                  theme === 'dark'
                    ? 'bg-slate-800/50 border-slate-700'
                    : 'bg-white border-slate-200'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowRight className="w-5 h-5 text-amber-500" />
                    <span className={`text-sm ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                    }`}>
                      Transitions
                    </span>
                  </div>
                  <p className={`text-2xl font-bold ${
                    theme === 'dark' ? 'text-white' : 'text-slate-900'
                  }`}>
                    {transitions.length}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Transitions Timeline */}
          <div className={`rounded-xl border overflow-hidden ${
            theme === 'dark'
              ? 'bg-slate-800/50 border-slate-700'
              : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className={`px-4 py-3 border-b ${
              theme === 'dark' ? 'border-slate-700' : 'border-slate-200'
            }`}>
              <h3 className={`font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                Movement Timeline
              </h3>
            </div>

            <div className="overflow-y-auto max-h-[600px] p-4 space-y-3">
              {transitions.length === 0 ? (
                <div className="text-center py-8">
                  <MapPin className={`w-12 h-12 mx-auto mb-3 ${
                    theme === 'dark' ? 'text-slate-600' : 'text-slate-300'
                  }`} />
                  <p className={`text-sm ${
                    theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    No movements detected yet
                  </p>
                </div>
              ) : (
                transitions.map((transition, idx) => {
                  const fromCamera = cameras.find(c => c.id === transition.from_camera);
                  const toCamera = cameras.find(c => c.id === transition.to_camera);

                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border ${
                        theme === 'dark'
                          ? 'bg-slate-900/50 border-slate-700'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="primary" size="sm">
                          {transition.person_id.toUpperCase()}
                        </Badge>
                        <span className={`text-xs ${
                          theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                        }`}>
                          {new Date(transition.time).toLocaleTimeString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        <span className={`font-medium ${
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        }`}>
                          {fromCamera?.name || transition.from_camera}
                        </span>
                        <ArrowRight className="w-4 h-4 text-blue-500" />
                        <span className={`font-medium ${
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        }`}>
                          {toCamera?.name || transition.to_camera}
                        </span>
                      </div>

                      <div className={`text-xs mt-1 ${
                        theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                      }`}>
                        Confidence: {(transition.similarity * 100).toFixed(1)}%
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReIDView;