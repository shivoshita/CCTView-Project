// FILE LOCATION: frontend/src/pages/Cameras/components/ChairTrackingOverlay.jsx
// REPLACE with this version that shows BOTH chairs and persons

import React, { useState, useRef, useEffect } from 'react';
import { Armchair, AlertCircle, User } from 'lucide-react';
import cameraService from '../../../services/camera.service';

const ChairTrackingOverlay = ({ cameraId, videoRef, theme, enabled }) => {
  const canvasRef = useRef(null);
  const [chairs, setChairs] = useState([]);
  const [persons, setPersons] = useState([]); // NEW: Track persons
  const [stats, setStats] = useState({ total: 0, occupied: 0, empty: 0 });
  const [debugInfo, setDebugInfo] = useState(null);
  const [showDebug, setShowDebug] = useState(true);
  const [showPersons, setShowPersons] = useState(true); // NEW: Toggle person boxes
  const animationFrameRef = useRef(null);

  // Format duration
  const formatDuration = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}m ${secs}s`;
    }
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  // Poll for chair tracking data every 500ms
  useEffect(() => {
    if (!enabled || !cameraId) return;

    const fetchChairTracking = async () => {
      try {
        const response = await cameraService.getChairTracking(cameraId);
        const actualData = response.data || response;
        
        if (actualData.success) {
          setChairs(actualData.chairs || []);
          setPersons(actualData.persons || []); // NEW: Get persons data
          setStats({
            total: actualData.total_chairs || 0,
            occupied: actualData.occupied_chairs || 0,
            empty: actualData.empty_chairs || 0
          });
          
          if (actualData.debug_info) {
            setDebugInfo(actualData.debug_info);
          }
        }
      } catch (error) {
        console.error('Error fetching chair tracking:', error);
      }
    };

    fetchChairTracking();
    const interval = setInterval(fetchChairTracking, 500);
    return () => clearInterval(interval);
  }, [cameraId, enabled]);

  // Draw both chairs AND persons on canvas
  useEffect(() => {
    if (!enabled || !canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');

    const drawDetections = () => {
      const rect = video.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const videoWidth = video.videoWidth || 1920;
      const videoHeight = video.videoHeight || 1080;
      const scaleX = canvas.width / videoWidth;
      const scaleY = canvas.height / videoHeight;

      // DRAW PERSONS FIRST (below chairs)
      if (showPersons && persons.length > 0) {
        persons.forEach((person, idx) => {
          const [x1, y1, x2, y2] = person.bbox;
          const scaledX1 = x1 * scaleX;
          const scaledY1 = y1 * scaleY;
          const scaledX2 = x2 * scaleX;
          const scaledY2 = y2 * scaleY;
          const width = scaledX2 - scaledX1;
          const height = scaledY2 - scaledY1;

          // Draw person box in BLUE with transparency
          ctx.strokeStyle = '#3b82f6'; // Blue
          ctx.lineWidth = 3;
          ctx.setLineDash([5, 5]); // Dashed line
          ctx.strokeRect(scaledX1, scaledY1, width, height);
          ctx.setLineDash([]); // Reset dash

          // Draw person label
          ctx.font = 'bold 13px Inter, system-ui, sans-serif';
          const personText = `PERSON ${idx + 1}`;
          const textMetrics = ctx.measureText(personText);
          
          ctx.fillStyle = 'rgba(59, 130, 246, 0.9)'; // Blue bg
          ctx.fillRect(scaledX1, scaledY1 - 24, textMetrics.width + 12, 24);
          
          ctx.fillStyle = '#ffffff';
          ctx.fillText(personText, scaledX1 + 6, scaledY1 - 6);

          // Draw confidence
          ctx.font = '11px Inter, system-ui, sans-serif';
          const confText = `${(person.confidence * 100).toFixed(0)}%`;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(scaledX2 - 35, scaledY1 + 4, 32, 16);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(confText, scaledX2 - 32, scaledY1 + 15);
        });
      }

      // DRAW CHAIRS (on top)
      chairs.forEach((chair) => {
        const { bbox, occupied, duration_seconds, chair_id, confidence } = chair;
        const [x1, y1, x2, y2] = bbox;

        const scaledX1 = x1 * scaleX;
        const scaledY1 = y1 * scaleY;
        const scaledX2 = x2 * scaleX;
        const scaledY2 = y2 * scaleY;
        const width = scaledX2 - scaledX1;
        const height = scaledY2 - scaledY1;

        // Color based on occupancy
        const color = occupied ? '#00ff00' : '#ff0000';
        const bgColor = occupied ? 'rgba(0, 255, 0, 0.9)' : 'rgba(255, 0, 0, 0.9)';
        const statusText = occupied ? 'OCCUPIED' : 'EMPTY';

        // Draw main box
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.strokeRect(scaledX1, scaledY1, width, height);

        // Corner accents
        const cornerLength = 20;
        ctx.lineWidth = 6;
        
        // Top-left
        ctx.beginPath();
        ctx.moveTo(scaledX1, scaledY1 + cornerLength);
        ctx.lineTo(scaledX1, scaledY1);
        ctx.lineTo(scaledX1 + cornerLength, scaledY1);
        ctx.stroke();
        
        // Top-right
        ctx.beginPath();
        ctx.moveTo(scaledX2 - cornerLength, scaledY1);
        ctx.lineTo(scaledX2, scaledY1);
        ctx.lineTo(scaledX2, scaledY1 + cornerLength);
        ctx.stroke();
        
        // Bottom-left
        ctx.beginPath();
        ctx.moveTo(scaledX1, scaledY2 - cornerLength);
        ctx.lineTo(scaledX1, scaledY2);
        ctx.lineTo(scaledX1 + cornerLength, scaledY2);
        ctx.stroke();
        
        // Bottom-right
        ctx.beginPath();
        ctx.moveTo(scaledX2 - cornerLength, scaledY2);
        ctx.lineTo(scaledX2, scaledY2);
        ctx.lineTo(scaledX2, scaledY2 - cornerLength);
        ctx.stroke();

        // Status label
        ctx.font = 'bold 15px Inter, system-ui, sans-serif';
        const statusMetrics = ctx.measureText(statusText);
        ctx.fillStyle = bgColor;
        ctx.fillRect(scaledX1, scaledY1 - 34, statusMetrics.width + 16, 34);
        ctx.fillStyle = '#000000';
        ctx.fillText(statusText, scaledX1 + 8, scaledY1 - 12);

        // Duration timer
        const durationText = formatDuration(duration_seconds);
        ctx.font = 'bold 18px Inter, system-ui, sans-serif';
        const timerMetrics = ctx.measureText(durationText);
        
        ctx.fillStyle = occupied ? 'rgba(0, 255, 0, 0.85)' : 'rgba(255, 0, 0, 0.85)';
        ctx.fillRect(scaledX1, scaledY2 + 4, timerMetrics.width + 20, 32);
        
        ctx.fillStyle = '#ffffff';
        ctx.fillText(durationText, scaledX1 + 10, scaledY2 + 28);

        // Chair ID and confidence
        ctx.font = '11px Inter, system-ui, sans-serif';
        const idText = `#${chair_id} (${(confidence * 100).toFixed(0)}%)`;
        const idMetrics = ctx.measureText(idText);
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(scaledX2 - idMetrics.width - 10, scaledY1 + 4, idMetrics.width + 8, 18);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fillText(idText, scaledX2 - idMetrics.width - 6, scaledY1 + 17);
      });

      animationFrameRef.current = requestAnimationFrame(drawDetections);
    };

    drawDetections();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [chairs, persons, showPersons, enabled, videoRef]);

  if (!enabled) return null;

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full pointer-events-none z-10"
        style={{ objectFit: 'contain' }}
      />
      
      {/* Stats Panel */}
      {stats.total > 0 && (
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-20">
          {/* Total Chairs */}
          <div className="flex items-center gap-2 bg-blue-500/90 backdrop-blur-sm px-4 py-2 rounded-full">
            <Armchair className="w-5 h-5 text-white" />
            <span className="text-sm font-semibold text-white">
              {stats.total} {stats.total === 1 ? 'Chair' : 'Chairs'}
            </span>
          </div>
          
          {/* Occupied */}
          {stats.occupied > 0 && (
            <div className="flex items-center gap-2 bg-green-500/90 backdrop-blur-sm px-4 py-2 rounded-full">
              <div className="w-3 h-3 rounded-full bg-white"></div>
              <span className="text-sm font-semibold text-white">
                {stats.occupied} Occupied
              </span>
            </div>
          )}
          
          {/* Empty */}
          {stats.empty > 0 && (
            <div className="flex items-center gap-2 bg-red-500/90 backdrop-blur-sm px-4 py-2 rounded-full">
              <div className="w-3 h-3 rounded-full bg-white"></div>
              <span className="text-sm font-semibold text-white">
                {stats.empty} Empty
              </span>
            </div>
          )}

          {/* NEW: Persons Count */}
          {persons.length > 0 && (
            <div className="flex items-center gap-2 bg-blue-600/90 backdrop-blur-sm px-4 py-2 rounded-full">
              <User className="w-4 h-4 text-white" />
              <span className="text-sm font-semibold text-white">
                {persons.length} {persons.length === 1 ? 'Person' : 'Persons'}
              </span>
            </div>
          )}
          
          {/* Toggle Person Boxes */}
          <button
            onClick={() => setShowPersons(!showPersons)}
            className="flex items-center gap-2 bg-blue-700/90 backdrop-blur-sm px-3 py-1.5 rounded-full hover:bg-blue-600/90 transition-colors"
          >
            <User className="w-4 h-4 text-white" />
            <span className="text-xs font-medium text-white">
              {showPersons ? 'Hide' : 'Show'} People
            </span>
          </button>

          {/* Debug Toggle */}
          {debugInfo && (
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="flex items-center gap-2 bg-gray-700/90 backdrop-blur-sm px-3 py-1.5 rounded-full hover:bg-gray-600/90 transition-colors"
            >
              <AlertCircle className="w-4 h-4 text-white" />
              <span className="text-xs font-medium text-white">
                {showDebug ? 'Hide' : 'Show'} Debug
              </span>
            </button>
          )}
          
          {/* Debug Panel */}
          {showDebug && debugInfo && (
            <div className="bg-black/80 backdrop-blur-sm px-3 py-2 rounded-lg text-xs text-white space-y-1 max-w-[200px]">
              <div className="font-semibold text-yellow-400 mb-1">Detection Info:</div>
              <div>Total Objects: {debugInfo.total_detections}</div>
              <div>Chairs Found: {debugInfo.chairs_detected}</div>
              <div>Persons Found: {debugInfo.persons_detected}</div>
              <div className="text-gray-400 mt-2 text-[10px] leading-tight">
                💡 Blue dashed boxes = detected people<br/>
                Red/Green solid boxes = chairs
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* No Chairs Warning */}
      {stats.total === 0 && (
        <div className="absolute top-4 left-4 flex items-center gap-2 bg-yellow-500/90 backdrop-blur-sm px-4 py-2 rounded-lg z-20">
          <AlertCircle className="w-5 h-5 text-white" />
          <span className="text-sm font-semibold text-white">
            No chairs detected
          </span>
        </div>
      )}
    </>
  );
};

export default ChairTrackingOverlay;