import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, Play, Square, Maximize2 } from 'lucide-react';
import Button from '../../../shared/components/ui/Button';
import { useTheme } from '../../../shared/contexts/ThemeContext';
import cameraService from '../../../services/camera.service';
import API_BASE_URL from '../../../config/api.config';

const PanoramicView = ({ cameras }) => {
  const { theme } = useTheme();
  const [selectedCameras, setSelectedCameras] = useState([]);
  const [activePanorama, setActivePanorama] = useState(null);
  const [stitching, setStitching] = useState(false);
  const imgRef = useRef(null);
  const pollInterval = useRef(null);

  const handleAddCamera = (camera) => {
    if (selectedCameras.length >= 6) {
      alert('Maximum 6 cameras supported');
      return;
    }
    if (!selectedCameras.find(c => c.id === camera.id)) {
      setSelectedCameras([...selectedCameras, camera]);
    }
  };

  const handleRemoveCamera = (cameraId) => {
    setSelectedCameras(selectedCameras.filter(c => c.id !== cameraId));
  };

  const handleStartStitching = async () => {
    if (selectedCameras.length < 2) {
      alert('Select at least 2 cameras');
      return;
    }

    try {
      setStitching(true);
      const panoramaId = `pano_${Date.now()}`;
      const cameraIds = selectedCameras.map(c => c.id);

      const response = await cameraService.createPanorama(panoramaId, cameraIds);
      
      setActivePanorama(panoramaId);
      
      // Start polling for stitched frames
      pollInterval.current = setInterval(() => {
        if (imgRef.current) {
          const timestamp = Date.now();
          imgRef.current.src = `${API_BASE_URL}/cameras/panoramic/${panoramaId}/frame?t=${timestamp}`;
        }
      }, 500);  // Update at 2 FPS
      
    } catch (error) {
      console.error('Failed to start panorama:', error);
      alert('Failed to start panoramic stitching');
    } finally {
      setStitching(false);
    }
  };

  const handleStopStitching = async () => {
    if (!activePanorama) return;

    try {
      await cameraService.stopPanorama(activePanorama);
      
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
      
      setActivePanorama(null);
    } catch (error) {
      console.error('Failed to stop panorama:', error);
    }
  };

  useEffect(() => {
    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
      if (activePanorama) {
        cameraService.stopPanorama(activePanorama).catch(console.error);
      }
    };
  }, [activePanorama]);

  return (
    <div className="space-y-6">
      {/* Camera Selection */}
      <div className={`rounded-xl border p-6 ${
        theme === 'dark'
          ? 'bg-slate-800/50 border-slate-700'
          : 'bg-white border-slate-200'
      }`}>
        <h3 className={`text-lg font-semibold mb-4 ${
          theme === 'dark' ? 'text-white' : 'text-slate-900'
        }`}>
          Select Cameras (2-6) - Order: Left → Right
        </h3>

        {/* Selected Cameras */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {selectedCameras.map((camera, idx) => (
            <div key={camera.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
              theme === 'dark' ? 'bg-slate-700' : 'bg-slate-100'
            }`}>
              <span className="text-sm font-medium">{idx + 1}. {camera.name}</span>
              <button
                onClick={() => handleRemoveCamera(camera.id)}
                className="text-red-400 hover:text-red-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Available Cameras */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {cameras
            .filter(c => !selectedCameras.find(sc => sc.id === c.id))
            .map(camera => (
              <button
                key={camera.id}
                onClick={() => handleAddCamera(camera)}
                disabled={selectedCameras.length >= 6}
                className={`p-3 rounded-lg border text-left transition-all ${
                  theme === 'dark'
                    ? 'bg-slate-900/50 border-slate-700 hover:border-blue-500'
                    : 'bg-slate-50 border-slate-200 hover:border-blue-400'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <p className="font-medium text-sm">{camera.name}</p>
                <p className="text-xs text-slate-500">{camera.location}</p>
              </button>
            ))}
        </div>

        {/* Controls */}
        <div className="flex gap-3 mt-6">
          {!activePanorama ? (
            <Button
              variant="primary"
              icon={Play}
              onClick={handleStartStitching}
              loading={stitching}
              disabled={selectedCameras.length < 2}
            >
              Start Stitching
            </Button>
          ) : (
            <Button
              variant="danger"
              icon={Square}
              onClick={handleStopStitching}
            >
              Stop Stitching
            </Button>
          )}
        </div>
      </div>

      {/* Panoramic Display */}
      {activePanorama && (
        <div className={`rounded-xl border overflow-hidden ${
          theme === 'dark'
            ? 'bg-slate-900 border-slate-700'
            : 'bg-slate-100 border-slate-200'
        }`}>
          <div className="aspect-[21/9] relative">
            <img
              ref={imgRef}
              alt="Panoramic view"
              className="w-full h-full object-contain"
              onError={(e) => console.error('Image load error:', e)}
            />
            <div className="absolute top-4 right-4 bg-red-500/90 px-3 py-1 rounded-full">
              <span className="text-white text-sm font-semibold">LIVE PANORAMA</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PanoramicView;