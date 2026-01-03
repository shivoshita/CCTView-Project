// FILE LOCATION: cctview2/frontend/src/pages/Cameras/components/DepthView.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Layers, Camera, AlertCircle, RefreshCw, Trash2, Eye } from 'lucide-react';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import { useTheme } from '../../../shared/contexts/ThemeContext';
import cameraService from '../../../services/camera.service';
import DepthOverlay from './DepthOverlay';
import Hls from 'hls.js';
import API_BASE_URL from '../../../config/api.config';

// Simple video player component with Depth overlay
const DepthVideoPlayer = ({ camera, theme }) => {
  const videoRef = useRef(null);
  const [streamInfo, setStreamInfo] = useState(null);
  const [depthData, setDepthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const pollingInterval = useRef(null);

  // Fetch stream info
  useEffect(() => {
    const fetchStreamInfo = async () => {
      try {
        const response = await cameraService.getStreamInfo(camera.id);
        const actualData = response.data || response;
        setStreamInfo(actualData);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching stream info:', err);
        setLoading(false);
      }
    };

    fetchStreamInfo();
  }, [camera.id]);

  // Setup HLS player
  useEffect(() => {
    if (!streamInfo || !videoRef.current || loading) return;

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
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = playlistUrl;
        videoRef.current.addEventListener('loadedmetadata', () => {
          videoRef.current.play().catch(e => console.warn('Autoplay prevented:', e));
        });
      }
    } else if (streamInfo.type === 'http') {
      // MJPEG stream
      let baseUrl = API_BASE_URL;
      if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
        baseUrl = baseUrl.replace(/localhost|127\.0\.0\.1/, window.location.hostname);
      }
      
      baseUrl = baseUrl.replace(/\/$/, '').replace(/\/api\/v1$/, '');
      const proxyPath = streamInfo.proxy_url.replace(/^\//, '');
      const proxyUrl = `${baseUrl}/${proxyPath}`;
      
      videoRef.current.src = `${proxyUrl}?_t=${Date.now()}`;
    }
  }, [streamInfo, loading]);

  // Poll for depth data every 500ms
  useEffect(() => {
    const fetchDepthData = async () => {
      try {
        console.log('🔍 Fetching depth data for camera:', camera.id);
        const response = await cameraService.getDepthMap(camera.id);
        const actualData = response.data || response;
        
        console.log('📊 Depth response:', actualData);
        
        if (actualData.success && actualData.depth_image) {
          console.log('✅ Setting depth data, image length:', actualData.depth_image.length);
          setDepthData(actualData);
        } else {
          console.warn('⚠️ No depth image in response');
        }
      } catch (error) {
        console.error('❌ Error fetching depth data:', error);
      }
    };

    // Initial fetch
    fetchDepthData();

    // Poll every 500ms
    pollingInterval.current = setInterval(fetchDepthData, 500);

    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, [camera.id]);

  if (loading) {
    return (
      <div className={`w-full h-full flex items-center justify-center rounded-lg ${
        theme === 'dark' ? 'bg-slate-900' : 'bg-slate-100'
      }`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className={`text-sm ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
          }`}>
            Loading...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
      {streamInfo?.type === 'hls' ? (
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          autoPlay
          muted
          playsInline
        />
      ) : (
        <img
          ref={videoRef}
          alt="Live stream"
          className="w-full h-full object-contain"
        />
      )}
      
      <DepthOverlay
        depthData={depthData}
        videoRef={videoRef}
        theme={theme}
      />
      
      {/* Camera label */}
      <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-sm px-3 py-1.5 rounded-full z-20">
        <span className="text-white text-sm font-medium">{camera.name}</span>
      </div>

      {/* Depth status indicator */}
      {depthData && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-purple-500/90 backdrop-blur-sm px-3 py-1.5 rounded-full z-20">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-white" />
            <span className="text-white text-sm font-medium">Depth Active</span>
          </div>
        </div>
      )}
    </div>
  );
};

const DepthView = ({ cameras }) => {
  const { theme } = useTheme();
  const [selectedCameras, setSelectedCameras] = useState([]);
  const [tracking, setTracking] = useState(false);

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

  const startTracking = () => {
    if (selectedCameras.length < 1) {
      alert('Please select at least 1 camera for depth tracking');
      return;
    }
    setTracking(true);
  };

  const stopTracking = () => {
    setTracking(false);
  };

  const clearSelection = () => {
    setSelectedCameras([]);
    setTracking(false);
  };

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
              Depth Tracking
            </h2>
            <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
              Visualize depth estimation across multiple cameras using MiDaS
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {tracking && (
              <>
                <Button
                  variant="ghost"
                  icon={Trash2}
                  onClick={clearSelection}
                >
                  Clear
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
                icon={Layers}
                onClick={startTracking}
                disabled={selectedCameras.length < 1}
              >
                Start Depth Tracking
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
              Select Cameras (minimum 1):
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {activeCameras.map(camera => (
                <button
                  key={camera.id}
                  onClick={() => toggleCamera(camera.id)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    selectedCameras.includes(camera.id)
                      ? 'border-purple-500 bg-purple-500/10'
                      : theme === 'dark'
                        ? 'border-slate-700 bg-slate-900/50 hover:border-slate-600'
                        : 'border-slate-300 bg-white hover:border-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Camera className={`w-4 h-4 ${
                      selectedCameras.includes(camera.id)
                        ? 'text-purple-500'
                        : theme === 'dark'
                          ? 'text-slate-400'
                          : 'text-slate-600'
                    }`} />
                    <span className={`text-sm font-medium ${
                      selectedCameras.includes(camera.id)
                        ? 'text-purple-500'
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

            {activeCameras.length < 1 && (
              <div className={`mt-4 p-3 rounded-lg flex items-start gap-2 ${
                theme === 'dark'
                  ? 'bg-yellow-500/10 text-yellow-400'
                  : 'bg-yellow-50 text-yellow-600'
              }`}>
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="text-sm">
                  You need at least 1 active camera to use depth tracking. Please add and start cameras.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tracking View */}
      {tracking && (
        <div className="space-y-4">
          {/* Info Banner */}
          <div className={`rounded-lg border p-4 ${
            theme === 'dark'
              ? 'bg-purple-500/10 border-purple-500/30'
              : 'bg-purple-50 border-purple-200'
          }`}>
            <div className="flex items-start gap-3">
              <Eye className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
              }`} />
              <div>
                <p className={`text-sm font-medium ${
                  theme === 'dark' ? 'text-purple-400' : 'text-purple-700'
                }`}>
                  Depth Map Legend
                </p>
                <p className={`text-xs mt-1 ${
                  theme === 'dark' ? 'text-purple-300/80' : 'text-purple-600'
                }`}>
                  <span className="font-semibold">Purple/Dark colors</span> = Objects FAR from the camera (distant) • 
                  <span className="font-semibold ml-1">Yellow/Bright colors</span> = Objects NEAR the camera (close)
                </p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className={`rounded-lg border p-4 ${
              theme === 'dark'
                ? 'bg-slate-800/50 border-slate-700'
                : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <Camera className="w-5 h-5 text-purple-500" />
                <span className={`text-sm ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  Active Cameras
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
                <Layers className="w-5 h-5 text-blue-500" />
                <span className={`text-sm ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  Model
                </span>
              </div>
              <p className={`text-lg font-bold ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                MiDaS
              </p>
            </div>

            <div className={`rounded-lg border p-4 ${
              theme === 'dark'
                ? 'bg-slate-800/50 border-slate-700'
                : 'bg-white border-slate-200'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className="w-5 h-5 text-emerald-500" />
                <span className={`text-sm ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  Update Rate
                </span>
              </div>
              <p className={`text-lg font-bold ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                500ms
              </p>
            </div>
          </div>

          {/* Camera Grid */}
          <div className={`grid ${
            selectedCameras.length === 1 ? 'grid-cols-1' :
            selectedCameras.length === 2 ? 'grid-cols-2' :
            selectedCameras.length === 3 ? 'grid-cols-3' :
            'grid-cols-2 lg:grid-cols-3'
          } gap-4`}>
            {selectedCameras.map(cameraId => {
              const camera = cameras.find(c => c.id === cameraId);
              if (!camera) return null;

              return (
                <div key={cameraId} className="aspect-video">
                  <DepthVideoPlayer
                    camera={camera}
                    theme={theme}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default DepthView;