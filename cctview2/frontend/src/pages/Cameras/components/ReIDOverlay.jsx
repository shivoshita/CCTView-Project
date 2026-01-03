// FILE LOCATION: frontend/src/pages/Cameras/components/ReIDOverlay.jsx

import React, { useRef, useEffect } from 'react';
import { User, MapPin } from 'lucide-react';

const ReIDOverlay = ({ detections, videoRef, cameraId, theme }) => {
  const canvasRef = useRef(null);

  // Color palette for different persons
  const personColors = [
    '#00ff00', '#ff0000', '#0000ff', '#ffff00', '#ff00ff', '#00ffff',
    '#ff8800', '#8800ff', '#00ff88', '#ff0088'
  ];

  const getPersonColor = (personId) => {
    // Extract number from person_id (e.g., "person_001" -> 1)
    const match = personId.match(/\d+/);
    if (match) {
      const num = parseInt(match[0]);
      return personColors[num % personColors.length];
    }
    return personColors[0];
  };

  // Draw person bounding boxes
  useEffect(() => {
    if (!canvasRef.current || !videoRef.current || !detections) return;

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

      // Filter detections for this camera
      const cameraDetections = detections.filter(d => d.camera_id === cameraId);

      cameraDetections.forEach((detection) => {
        const { bbox, person_id, confidence, is_new, cameras_visited } = detection;
        const [x1, y1, x2, y2] = bbox;

        const scaledX1 = x1 * scaleX;
        const scaledY1 = y1 * scaleY;
        const scaledX2 = x2 * scaleX;
        const scaledY2 = y2 * scaleY;
        const width = scaledX2 - scaledX1;
        const height = scaledY2 - scaledY1;

        const color = getPersonColor(person_id);

        // Draw main bounding box
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.strokeRect(scaledX1, scaledY1, width, height);

        // Draw corner accents
        const cornerLength = 25;
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

        // Person ID label
        ctx.font = 'bold 16px Inter, system-ui, sans-serif';
        const idText = person_id.toUpperCase();
        const idMetrics = ctx.measureText(idText);
        
        ctx.fillStyle = `${color}ee`;
        ctx.fillRect(scaledX1, scaledY1 - 36, idMetrics.width + 20, 36);
        
        ctx.fillStyle = '#000000';
        ctx.fillText(idText, scaledX1 + 10, scaledY1 - 12);

        // NEW badge
        if (is_new) {
          ctx.font = 'bold 11px Inter, system-ui, sans-serif';
          ctx.fillStyle = '#ffaa00';
          ctx.fillRect(scaledX2 - 50, scaledY1 + 4, 46, 20);
          ctx.fillStyle = '#000000';
          ctx.fillText('NEW', scaledX2 - 44, scaledY1 + 18);
        }

        // Cameras visited count
        if (cameras_visited && cameras_visited.length > 1) {
          ctx.font = 'bold 12px Inter, system-ui, sans-serif';
          const visitText = `${cameras_visited.length} cameras`;
          const visitMetrics = ctx.measureText(visitText);
          
          ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
          ctx.fillRect(scaledX1, scaledY2 + 4, visitMetrics.width + 16, 24);
          
          ctx.fillStyle = '#ffffff';
          ctx.fillText(visitText, scaledX1 + 8, scaledY2 + 20);
        }

        // Confidence
        ctx.font = '11px Inter, system-ui, sans-serif';
        const confText = `${(confidence * 100).toFixed(0)}%`;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(scaledX2 - 38, scaledY1 + (is_new ? 28 : 4), 34, 18);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(confText, scaledX2 - 34, scaledY1 + (is_new ? 42 : 18));
      });

      requestAnimationFrame(drawDetections);
    };

    const animationId = requestAnimationFrame(drawDetections);

    return () => cancelAnimationFrame(animationId);
  }, [detections, videoRef, cameraId]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 left-0 w-full h-full pointer-events-none z-10"
      style={{ objectFit: 'contain' }}
    />
  );
};

export default ReIDOverlay;