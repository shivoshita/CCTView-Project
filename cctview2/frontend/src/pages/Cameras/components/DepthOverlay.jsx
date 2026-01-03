// FILE LOCATION: cctview2/frontend/src/pages/Cameras/components/DepthOverlay.jsx
import React, { useRef, useEffect, useState } from 'react';

const DepthOverlay = ({ depthData, videoRef, theme }) => {
  const canvasRef = useRef(null);
  const [overlayOpacity, setOverlayOpacity] = useState(0.7);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageRef = useRef(null);

  // Debug: Log when depthData changes
  useEffect(() => {
    if (depthData) {
      console.log('🎨 DepthOverlay: Received depth data:', {
        hasImage: !!depthData.depth_image,
        imageLength: depthData.depth_image?.length,
        stats: depthData.depth_stats
      });
    }
  }, [depthData]);

  // Preload the depth image
  useEffect(() => {
    if (!depthData?.depth_image) {
      setImageLoaded(false);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      console.log('✅ Depth image loaded successfully:', img.width, 'x', img.height);
      imageRef.current = img;
      setImageLoaded(true);
    };

    img.onerror = (error) => {
      console.error('❌ Error loading depth image:', error);
      setImageLoaded(false);
    };

    img.src = `data:image/png;base64,${depthData.depth_image}`;
  }, [depthData?.depth_image]);

  // Draw loop
  useEffect(() => {
    if (!canvasRef.current || !videoRef.current || !imageLoaded || !imageRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    let animationId = null;

    const draw = () => {
      // Get video element dimensions
      const rect = video.getBoundingClientRect();
      
      // Set canvas size to match video display size
      if (canvas.width !== rect.width || canvas.height !== rect.height) {
        canvas.width = rect.width;
        canvas.height = rect.height;
        console.log('📐 Canvas resized to:', rect.width, 'x', rect.height);
      }

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw depth image with opacity
      ctx.globalAlpha = overlayOpacity;
      ctx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1.0;

      // Draw legend
      if (depthData?.depth_stats) {
        const { min_depth, max_depth } = depthData.depth_stats;
        
        const legendX = 10;
        const legendY = canvas.height - 90;
        const legendWidth = 180;
        const legendHeight = 80;
        
        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(legendX, legendY, legendWidth, legendHeight);
        
        // Border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(legendX, legendY, legendWidth, legendHeight);
        
        // Title
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px Inter, system-ui, sans-serif';
        ctx.fillText('Depth Map', legendX + 10, legendY + 22);
        
        // Near indicator
        ctx.fillStyle = '#a78bfa';
        ctx.font = '12px Inter, system-ui, sans-serif';
        ctx.fillText('● Far (Purple)', legendX + 10, legendY + 42);
        
        // Far indicator
        ctx.fillStyle = '#fbbf24';
        ctx.fillText('● Near (Yellow)', legendX + 10, legendY + 60);
        
        // Range
        ctx.fillStyle = '#d1d5db';
        ctx.font = '11px Inter, system-ui, sans-serif';
        ctx.fillText(`Range: ${min_depth.toFixed(1)} - ${max_depth.toFixed(1)}`, legendX + 10, legendY + 75);
      }

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [imageLoaded, videoRef, overlayOpacity, depthData?.depth_stats]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        style={{
          objectFit: 'contain',
          zIndex: 10
        }}
      />
      
      {/* Opacity Control */}
      <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-sm p-3 rounded-lg" style={{ zIndex: 20 }}>
        <div className="flex items-center gap-2">
          <span className="text-white text-xs font-medium">Overlay:</span>
          <input
            type="range"
            min="0"
            max="100"
            value={overlayOpacity * 100}
            onChange={(e) => setOverlayOpacity(e.target.value / 100)}
            className="w-20 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
          <span className="text-white text-xs">{Math.round(overlayOpacity * 100)}%</span>
        </div>
        
        {/* Debug indicator */}
        {imageLoaded && (
          <div className="mt-1 flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-green-400 text-xs">Active</span>
          </div>
        )}
      </div>
    </>
  );
};

export default DepthOverlay;