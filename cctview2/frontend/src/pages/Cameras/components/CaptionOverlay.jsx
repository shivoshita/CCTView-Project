// FILE LOCATION: frontend/src/pages/Cameras/components/CaptionOverlay.jsx
// UPDATED: Display time range for batch captions

import React, { useEffect, useRef } from 'react';
import { MessageSquare, Wifi, WifiOff, Clock } from 'lucide-react';
import { useTheme } from '../../../shared/contexts/ThemeContext';
import useCameraCaptions from '../../../shared/hooks/useCameraCaptions';

const CaptionOverlay = ({ cameraId, compact = false }) => {
  const { theme } = useTheme();
  const { captions, isConnected } = useCameraCaptions(cameraId);
  const captionsEndRef = useRef(null);

  // Auto-scroll to bottom when new caption arrives
  useEffect(() => {
    if (captionsEndRef.current && !compact) {
      captionsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [captions, compact]);

  const formatTimeRange = (caption) => {
    if (caption.time_range) {
      const start = new Date(caption.time_range.start);
      const end = new Date(caption.time_range.end);
      return `${start.toLocaleTimeString()} - ${end.toLocaleTimeString()}`;
    }
    return caption.timestamp.toLocaleTimeString();
  };

  if (compact) {
    // Compact mode - show only latest caption
    const latestCaption = captions[0];
    
    return (
      <div className="absolute bottom-0 left-0 right-0 p-3">
        {/* Connection Status Indicator */}
        <div className="absolute top-2 right-2">
          {isConnected ? (
            <div className="flex items-center gap-1 bg-emerald-500/20 backdrop-blur-sm px-2 py-1 rounded-full border border-emerald-500/30">
              <Wifi className="w-3 h-3 text-emerald-400" />
              <span className="text-xs text-emerald-400 font-medium">Live AI</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 bg-red-500/20 backdrop-blur-sm px-2 py-1 rounded-full border border-red-500/30">
              <WifiOff className="w-3 h-3 text-red-400" />
              <span className="text-xs text-red-400 font-medium">Offline</span>
            </div>
          )}
        </div>

        {/* Latest Caption */}
        {latestCaption && (
          <div
            className={`
              backdrop-blur-md rounded-lg border p-3 shadow-lg
              animate-slide-up
              ${theme === 'dark'
                ? 'bg-slate-900/90 border-slate-700/50'
                : 'bg-white/90 border-slate-200/50'
              }
            `}
          >
            <div className="flex items-start gap-2">
              <MessageSquare className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
              }`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm leading-relaxed ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  {latestCaption.text}
                </p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {/* Time Range */}
                  <div className="flex items-center gap-1">
                    <Clock className={`w-3 h-3 ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                    }`} />
                    <span className={`text-xs ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                    }`}>
                      {formatTimeRange(latestCaption)}
                    </span>
                  </div>
                  
                  {/* Confidence */}
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    latestCaption.confidence > 0.8
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {(latestCaption.confidence * 100).toFixed(0)}%
                  </span>
                  
                  {/* Frames Analyzed Badge */}
                  {latestCaption.frames_analyzed && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      theme === 'dark'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {latestCaption.frames_analyzed} frames
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full mode - show scrollable list
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className={`px-4 py-3 border-b flex items-center justify-between ${
        theme === 'dark' ? 'border-slate-700' : 'border-slate-200'
      }`}>
        <div className="flex items-center gap-2">
          <MessageSquare className={`w-5 h-5 ${
            theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
          }`} />
          <h3 className={`font-semibold ${
            theme === 'dark' ? 'text-white' : 'text-slate-900'
          }`}>
            Live Captions
          </h3>
        </div>
        {isConnected ? (
          <div className="flex items-center gap-1 bg-emerald-500/20 px-2 py-1 rounded-full border border-emerald-500/30">
            <Wifi className="w-3 h-3 text-emerald-400" />
            <span className="text-xs text-emerald-400 font-medium">Live</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 bg-red-500/20 px-2 py-1 rounded-full border border-red-500/30">
            <WifiOff className="w-3 h-3 text-red-400" />
            <span className="text-xs text-red-400 font-medium">Offline</span>
          </div>
        )}
      </div>

      {/* Captions List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {captions.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className={`w-12 h-12 mx-auto mb-3 ${
              theme === 'dark' ? 'text-slate-600' : 'text-slate-300'
            }`} />
            <p className={`text-sm ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>
              Waiting for AI captions...
            </p>
            {isConnected && (
              <p className={`text-xs mt-2 ${
                theme === 'dark' ? 'text-slate-500' : 'text-slate-500'
              }`}>
                Connected and listening
              </p>
            )}
          </div>
        ) : (
          <>
            {captions.map((caption, index) => (
              <div
                key={caption.id}
                className={`
                  p-3 rounded-lg border transition-all duration-300
                  animate-slide-in
                  ${theme === 'dark'
                    ? 'bg-slate-900/50 border-slate-700 hover:bg-slate-900/70'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }
                `}
                style={{
                  animationDelay: `${index * 50}ms`
                }}
              >
                <div className="flex items-start gap-2">
                  <MessageSquare className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                    theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-relaxed mb-2 ${
                      theme === 'dark' ? 'text-white' : 'text-slate-900'
                    }`}>
                      {caption.text}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Time Range */}
                      <div className="flex items-center gap-1">
                        <Clock className={`w-3 h-3 ${
                          theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                        }`} />
                        <span className={`text-xs ${
                          theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                        }`}>
                          {formatTimeRange(caption)}
                        </span>
                      </div>
                      
                      {/* Confidence */}
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        caption.confidence > 0.8
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {(caption.confidence * 100).toFixed(0)}%
                      </span>
                      
                      {/* Frames Analyzed */}
                      {caption.frames_analyzed && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          theme === 'dark'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {caption.frames_analyzed} frames
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div ref={captionsEndRef} />
          </>
        )}
      </div>
    </div>
  );
};

export default CaptionOverlay;