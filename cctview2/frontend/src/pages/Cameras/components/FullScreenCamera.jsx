// FILE LOCATION: frontend/src/pages/Cameras/components/FullScreenCamera.jsx

import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Maximize2, Minimize2, Settings, Activity,
  MapPin, Radio, Eye, Camera, Clock, Target, Armchair
} from 'lucide-react';
import ChairTrackingOverlay from './ChairTrackingOverlay';
import Badge from '../../../shared/components/ui/Badge';
import Button from '../../../shared/components/ui/Button';
import { useTheme } from '../../../shared/contexts/ThemeContext';
import CaptionOverlay from './CaptionOverlay';
import cameraService from '../../../services/camera.service';
import API_BASE_URL from '../../../config/api.config';
import Hls from 'hls.js';

// Detection Overlay Component - Draws YOLO bounding boxes
const DetectionOverlay = ({ cameraId, videoRef, theme, enabled }) => {
  const canvasRef = useRef(null);
  const [detections, setDetections] = useState([]);
  const [detectionCount, setDetectionCount] = useState(0);
  const animationFrameRef = useRef(null);

  // Poll for detections every 500ms
  useEffect(() => {
    if (!enabled || !cameraId) return;

    const fetchDetections = async () => {
      try {
        const response = await cameraService.getDetections(cameraId);
        const actualData = response.data || response;
        
        if (actualData.success && actualData.detections) {
          setDetections(actualData.detections);
          setDetectionCount(actualData.detections.length);
        }
      } catch (error) {
        console.error('Error fetching detections:', error);
      }
    };

    // Initial fetch
    fetchDetections();

    // Poll every 500ms
    const interval = setInterval(fetchDetections, 500);

    return () => clearInterval(interval);
  }, [cameraId, enabled]);

  // Draw bounding boxes on canvas
  useEffect(() => {
    if (!enabled || !canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');

    const drawDetections = () => {
      // Match canvas size to video display size
      const rect = video.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (detections.length === 0) {
        animationFrameRef.current = requestAnimationFrame(drawDetections);
        return;
      }

      // Get video native dimensions
      const videoWidth = video.videoWidth || 1920;
      const videoHeight = video.videoHeight || 1080;

      // Calculate scaling factors
      const scaleX = canvas.width / videoWidth;
      const scaleY = canvas.height / videoHeight;

      detections.forEach((detection) => {
        const { bbox, label, confidence } = detection;
        const [x1, y1, x2, y2] = bbox;

        // Scale coordinates to canvas size
        const scaledX1 = x1 * scaleX;
        const scaledY1 = y1 * scaleY;
        const scaledX2 = x2 * scaleX;
        const scaledY2 = y2 * scaleY;
        const width = scaledX2 - scaledX1;
        const height = scaledY2 - scaledY1;

        // Draw bounding box
        ctx.strokeStyle = '#00ff00'; // Green color
        ctx.lineWidth = 3;
        ctx.strokeRect(scaledX1, scaledY1, width, height);

        // Draw label background
        const labelText = `${label} ${(confidence * 100).toFixed(1)}%`;
        ctx.font = 'bold 14px Inter, system-ui, sans-serif';
        const textMetrics = ctx.measureText(labelText);
        const textHeight = 20;
        const padding = 4;

        ctx.fillStyle = 'rgba(0, 255, 0, 0.9)';
        ctx.fillRect(
          scaledX1,
          scaledY1 - textHeight - padding,
          textMetrics.width + padding * 2,
          textHeight + padding
        );

        // Draw label text
        ctx.fillStyle = '#000000';
        ctx.fillText(labelText, scaledX1 + padding, scaledY1 - padding - 4);
      });

      animationFrameRef.current = requestAnimationFrame(drawDetections);
    };

    drawDetections();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [detections, enabled, videoRef]);

  if (!enabled) return null;

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full pointer-events-none z-10"
        style={{ objectFit: 'contain' }}
      />
      {/* Detection Counter */}
      {detectionCount > 0 && (
        <div className="absolute top-4 left-4 flex items-center gap-2 bg-green-500/90 backdrop-blur-sm px-3 py-2 rounded-full z-20">
          <Target className="w-4 h-4 text-white" />
          <span className="text-sm font-semibold text-white">
            {detectionCount} {detectionCount === 1 ? 'Detection' : 'Detections'}
          </span>
        </div>
      )}
    </>
  );
};

// HLS Video Player Component with Detection Support
const HLSPlayer = ({ playlistUrl, cameraId, theme, onVideoReady, detectionsEnabled }) => {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('🎬 Initializing HLS player for:', playlistUrl);
    
    if (!videoRef.current) {
      console.error('❌ Video element not ready');
      return;
    }

    if (Hls.isSupported()) {
      console.log('✅ HLS.js is supported');
      
      const hls = new Hls({
        debug: false,
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
        maxBufferLength: 10,
        maxBufferSize: 10 * 1000 * 1000,
        maxBufferHole: 0.3,
        highBufferWatchdogPeriod: 1,
        manifestLoadingTimeOut: 5000,
        manifestLoadingMaxRetry: 3,
        levelLoadingTimeOut: 5000,
        levelLoadingMaxRetry: 3,
        fragLoadingTimeOut: 10000,
        fragLoadingMaxRetry: 6,
        liveSyncDurationCount: 1,
        liveMaxLatencyDurationCount: 3
      });

      hls.loadSource(playlistUrl);
      hls.attachMedia(videoRef.current);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('✅ HLS manifest parsed, starting playback');
        setLoading(false);
        videoRef.current.play().catch(e => {
          console.warn('Autoplay prevented:', e);
        });
        
        // Notify parent that video is ready
        if (onVideoReady && videoRef.current) {
          onVideoReady(videoRef.current);
        }
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('❌ HLS error:', data);
        
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error('Network error, attempting recovery...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error('Media error, attempting recovery...');
              hls.recoverMediaError();
              break;
            default:
              console.error('Fatal error, cannot recover');
              setError('Stream playback failed');
              hls.destroy();
              break;
          }
        }
      });

      hlsRef.current = hls;

      return () => {
        console.log('🛑 Cleaning up HLS player');
        if (hlsRef.current) {
          hlsRef.current.destroy();
        }
      };
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      console.log('✅ Using native HLS support');
      videoRef.current.src = playlistUrl;
      videoRef.current.addEventListener('loadedmetadata', () => {
        setLoading(false);
        videoRef.current.play().catch(e => {
          console.warn('Autoplay prevented:', e);
        });
        
        if (onVideoReady && videoRef.current) {
          onVideoReady(videoRef.current);
        }
      });
      videoRef.current.addEventListener('error', (e) => {
        console.error('Native HLS error:', e);
        setError('Stream playback failed');
      });
    } else {
      console.error('❌ HLS not supported in this browser');
      setError('HLS not supported in this browser');
    }
  }, [playlistUrl, onVideoReady]);

  if (error) {
    return (
      <div className={`w-full h-full flex items-center justify-center ${
        theme === 'dark' ? 'bg-slate-900' : 'bg-slate-100'
      }`}>
        <div className="text-center">
          <Eye className={`w-16 h-16 mx-auto mb-4 ${
            theme === 'dark' ? 'text-slate-600' : 'text-slate-300'
          }`} />
          <p className={`text-lg ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
          }`}>
            {error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-white">Loading stream...</p>
          </div>
        </div>
      )}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        controls
        autoPlay
        muted
        playsInline
      />
      {detectionsEnabled && (
        <ChairTrackingOverlay
          cameraId={cameraId}
          videoRef={videoRef}
          theme={theme}
          enabled={detectionsEnabled}
        />
      )}
    </div>
  );
};

// MJPEG Image Player Component with Detection Support
const MJPEGPlayer = ({ streamUrl, cameraId, theme, onVideoReady, detectionsEnabled }) => {
  const imgRef = useRef(null);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (onVideoReady && imgRef.current) {
      onVideoReady(imgRef.current);
    }
  }, [onVideoReady]);

  const handleError = () => {
    console.error('MJPEG stream error, retry:', retryCount);
    if (retryCount < 3) {
      setTimeout(() => {
        setRetryCount(prev => prev + 1);
        if (imgRef.current) {
          const separator = streamUrl.includes('?') ? '&' : '?';
          imgRef.current.src = `${streamUrl}${separator}_t=${Date.now()}`;
        }
      }, 2000);
    } else {
      setError(true);
    }
  };

  const handleLoad = () => {
    console.log('✅ MJPEG stream loaded');
    setError(false);
    setRetryCount(0);
  };

  if (error) {
    return (
      <div className={`w-full h-full flex items-center justify-center ${
        theme === 'dark' ? 'bg-slate-900' : 'bg-slate-100'
      }`}>
        <div className="text-center">
          <Eye className={`w-16 h-16 mx-auto mb-4 ${
            theme === 'dark' ? 'text-slate-600' : 'text-slate-300'
          }`} />
          <p className={`text-lg ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
          }`}>
            Stream connection failed
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black">
      <img
        ref={imgRef}
        src={`${streamUrl}${streamUrl.includes('?') ? '&' : '?'}_t=${Date.now()}`}
        alt="Live stream"
        className="w-full h-full object-contain"
        onError={handleError}
        onLoad={handleLoad}
        crossOrigin="anonymous"
      />
      {detectionsEnabled && (
        <ChairTrackingOverlay
          cameraId={cameraId}
          videoRef={imgRef}
          theme={theme}
          enabled={detectionsEnabled}
        />
      )}
    </div>
  );
};

// Main Stream Player Component
const StreamPlayer = ({ camera, theme, onVideoReady, detectionsEnabled }) => {
  const [streamInfo, setStreamInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStreamInfo = async () => {
      try {
        console.log('🔍 Fetching stream info for camera:', camera.id);
        const response = await cameraService.getStreamInfo(camera.id);
        console.log('📺 Stream info response:', response);
        
        const actualData = response.data || response;
        console.log('📺 Actual data:', actualData);
        console.log('📺 Stream type:', actualData?.type);
        
        setStreamInfo(actualData);
        setLoading(false);
      } catch (err) {
        console.error('❌ Error fetching stream info:', err);
        setError('Failed to get stream information');
        setLoading(false);
      }
    };

    fetchStreamInfo();
  }, [camera.id]);

  if (loading) {
    return (
      <div className={`w-full h-full flex items-center justify-center ${
        theme === 'dark' ? 'bg-slate-900' : 'bg-slate-100'
      }`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
            Connecting to stream...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`w-full h-full flex items-center justify-center ${
        theme === 'dark' ? 'bg-slate-900' : 'bg-slate-100'
      }`}>
        <div className="text-center">
          <Eye className={`w-16 h-16 mx-auto mb-4 ${
            theme === 'dark' ? 'text-slate-600' : 'text-slate-300'
          }`} />
          <p className={`text-lg ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
          }`}>
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (streamInfo?.type === 'hls') {
    let baseUrl = API_BASE_URL;
    if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
      baseUrl = baseUrl.replace(/localhost|127\.0\.0\.1/, window.location.hostname);
    }
    
    baseUrl = baseUrl.replace(/\/$/, '');
    const playlistPath = streamInfo.playlist_url.replace(/^\//, '');
    const playlistUrl = `${baseUrl}/${playlistPath}`;
    
    console.log('🎬 Using HLS player with detection support');
    
    return (
      <HLSPlayer
        playlistUrl={playlistUrl}
        cameraId={camera.id}
        theme={theme}
        onVideoReady={onVideoReady}
        detectionsEnabled={detectionsEnabled}
      />
    );
  } else if (streamInfo?.type === 'http') {
    let baseUrl = API_BASE_URL;
    if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
      baseUrl = baseUrl.replace(/localhost|127\.0\.0\.1/, window.location.hostname);
    }
    
    baseUrl = baseUrl.replace(/\/$/, '').replace(/\/api\/v1$/, '');
    const proxyPath = streamInfo.proxy_url.replace(/^\//, '');
    const proxyUrl = `${baseUrl}/${proxyPath}`;
    
    console.log('📸 Using MJPEG player with detection support');
    return (
      <MJPEGPlayer
        streamUrl={proxyUrl}
        cameraId={camera.id}
        theme={theme}
        onVideoReady={onVideoReady}
        detectionsEnabled={detectionsEnabled}
      />
    );
  }

  return (
    <div className={`w-full h-full flex items-center justify-center ${
      theme === 'dark' ? 'bg-slate-900' : 'bg-slate-100'
    }`}>
      <div className="text-center">
        <p className={`text-lg mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
          Unknown stream type
        </p>
      </div>
    </div>
  );
};

const FullScreenCamera = ({ camera, onClose }) => {
  const { theme } = useTheme();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState('live');
  const [captionInterval, setCaptionInterval] = useState(15);
  const [updatingInterval, setUpdatingInterval] = useState(false);
  const [detectionsEnabled, setDetectionsEnabled] = useState(true);
  const videoElementRef = useRef(null);

  const handleVideoReady = (videoElement) => {
    videoElementRef.current = videoElement;
    console.log('✅ Video element ready for detection overlay');
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleIntervalChange = async (newInterval) => {
    try {
      setUpdatingInterval(true);
      await cameraService.updateCaptionInterval(camera.id, newInterval);
      setCaptionInterval(newInterval);
      console.log(`✅ Caption interval updated to ${newInterval}s`);
    } catch (error) {
      console.error('Failed to update caption interval:', error);
    } finally {
      setUpdatingInterval(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'danger';
      case 'reconnecting': return 'warning';
      default: return 'default';
    }
  };

  return (
    <div className={`fixed inset-0 z-50 overflow-hidden ${
      theme === 'dark' ? 'bg-slate-900' : 'bg-slate-50'
    }`}>
      {/* Header Bar */}
      <div className={`absolute top-0 left-0 right-0 z-10 backdrop-blur-md border-b ${
        theme === 'dark'
          ? 'bg-slate-800/95 border-slate-700'
          : 'bg-white/95 border-slate-200'
      }`}>
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="md" icon={X} onClick={onClose}>
              Back to Grid
            </Button>
            
            <div className={`h-8 w-px ${
              theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'
            }`} />
            
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className={`text-xl font-bold ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  {camera.name}
                </h2>
                <Badge variant={getStatusColor(camera.status)} size="sm" dot>
                  {camera.status}
                </Badge>
                <Badge variant={camera.stream_type === 'rtsp' ? 'info' : 'default'} size="sm">
                  {camera.stream_type?.toUpperCase() || 'HTTP'}
                </Badge>
              </div>
              <div className={`flex items-center gap-2 text-sm ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
              }`}>
                <MapPin className="w-4 h-4" />
                <span>{camera.location}</span>
                <span className="mx-2">•</span>
                <span>{camera.resolution || '1080p'}</span>
                <span className="mx-2">•</span>
                <span>{camera.fps || '30'} FPS</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={detectionsEnabled ? 'primary' : 'ghost'}
              size="md"
              icon={Armchair}
              onClick={() => setDetectionsEnabled(!detectionsEnabled)}
            >
              {detectionsEnabled ? 'Hide Chair Tracking' : 'Show Chair Tracking'}
            </Button>
            <Button variant={theme === 'dark' ? 'outline' : 'primary'} size="md" icon={Settings}>
              Settings
            </Button>
            <Button 
              variant={theme === 'dark' ? 'outline' : 'primary'}
              size="md" 
              icon={isFullscreen ? Minimize2 : Maximize2}
              onClick={toggleFullscreen}
            >
              {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex h-full pt-20">
        {/* Video Player - Left Side */}
        <div className="flex-1 flex flex-col p-6">
          <div className={`flex-1 rounded-xl border overflow-hidden relative ${
            theme === 'dark'
              ? 'bg-slate-900 border-slate-700'
              : 'bg-slate-100 border-slate-200'
          }`}>
            {/* Video Stream with Detection Overlay */}
            <StreamPlayer
              camera={camera}
              theme={theme}
              onVideoReady={handleVideoReady}
              detectionsEnabled={detectionsEnabled}
            />

            {/* Live Indicator Overlay */}
            {camera.status === 'active' && (
              <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-500/90 backdrop-blur-sm px-3 py-2 rounded-full z-20">
                <Radio className="w-4 h-4 text-white animate-pulse" />
                <span className="text-sm font-semibold text-white">LIVE</span>
              </div>
            )}

            {/* Camera Stats Overlay */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between z-20">
              <div className={`flex items-center gap-4 backdrop-blur-sm px-4 py-2 rounded-lg border ${
                theme === 'dark'
                  ? 'bg-slate-900/90 border-slate-700'
                  : 'bg-white/90 border-slate-200'
              }`}>
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-400" />
                  <span className={`text-sm font-medium ${
                    theme === 'dark' ? 'text-white' : 'text-slate-900'
                  }`}>
                    {camera.fps || 30} FPS
                  </span>
                </div>
                <div className={`h-4 w-px ${
                  theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'
                }`} />
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-emerald-400" />
                  <span className={`text-sm font-medium ${
                    theme === 'dark' ? 'text-white' : 'text-slate-900'
                  }`}>
                    {camera.resolution || '1920x1080'}
                  </span>
                </div>
              </div>

              <div className={`flex items-center gap-2 backdrop-blur-sm px-4 py-2 rounded-lg border ${
                theme === 'dark'
                  ? 'bg-slate-900/90 border-slate-700'
                  : 'bg-white/90 border-slate-200'
              }`}>
                <Clock className={`w-4 h-4 ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`} />
                <span className={`text-sm font-medium ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  {new Date().toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar - Right Side */}
        <div className={`w-96 backdrop-blur-sm border-l p-6 overflow-y-auto ${
          theme === 'dark'
            ? 'bg-slate-800/50 border-slate-700'
            : 'bg-white/50 border-slate-200'
        }`}>
          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setActiveTab('live')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'live'
                  ? 'bg-blue-500 text-white'
                  : theme === 'dark'
                    ? 'bg-slate-900/50 text-slate-400 hover:text-white'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              Live Info
            </button>
            <button
              onClick={() => setActiveTab('captions')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'captions'
                  ? 'bg-blue-500 text-white'
                  : theme === 'dark'
                    ? 'bg-slate-900/50 text-slate-400 hover:text-white'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              Captions
            </button>
          </div>

          {/* Live Info Tab */}
          {activeTab === 'live' && (
            <div className="space-y-4">
              <div className={`rounded-xl border backdrop-blur-sm ${
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
                    Camera Details
                  </h3>
                </div>
                <div className="p-4">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className={`text-sm ${
                        theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                      }`}>
                        Camera ID
                      </span>
                      <span className={`text-sm font-medium ${
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      }`}>
                        {camera.id}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className={`text-sm ${
                        theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                      }`}>
                        Stream Type
                      </span>
                      <Badge variant={camera.stream_type === 'rtsp' ? 'info' : 'default'} size="sm">
                        {camera.stream_type?.toUpperCase() || 'HTTP'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className={`text-sm ${
                        theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                      }`}>
                        Status
                      </span>
                      <Badge variant={getStatusColor(camera.status)} size="sm">
                        {camera.status}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className={`text-sm ${
                        theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                      }`}>
                        Location
                      </span>
                      <span className={`text-sm font-medium ${
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      }`}>
                        {camera.location}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className={`text-sm ${
                        theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                      }`}>
                        AI Detection
                      </span>
                      <Badge variant={detectionsEnabled ? 'success' : 'default'} size="sm">
                        {detectionsEnabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Captions Tab */}
          {activeTab === 'captions' && (
            <div className="space-y-4">
              <div className={`rounded-xl border backdrop-blur-sm p-4 ${
                theme === 'dark'
                  ? 'bg-slate-800/50 border-slate-700'
                  : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <label className={`block text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  Caption Generation Interval
                </label>
                <select
                  value={captionInterval}
                  onChange={(e) => handleIntervalChange(Number(e.target.value))}
                  disabled={updatingInterval}
                  className={`w-full px-3 py-2 rounded-lg border transition-all ${
                    theme === 'dark'
                      ? 'bg-slate-900/50 border-slate-700 text-white'
                      : 'bg-white border-slate-300 text-slate-900'
                  } ${updatingInterval ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <option value={15}>Every 15 seconds</option>
                  <option value={20}>Every 20 seconds</option>
                  <option value={40}>Every 40 seconds</option>
                  <option value={60}>Every 1 minute</option>
                </select>
              </div>

              <div className={`rounded-xl border backdrop-blur-sm h-[calc(100vh-400px)] overflow-hidden ${
                theme === 'dark'
                  ? 'bg-slate-800/50 border-slate-700'
                  : 'bg-white border-slate-200 shadow-sm'
              }`}>
                <CaptionOverlay cameraId={camera.id} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FullScreenCamera;