// FILE LOCATION: frontend/src/pages/Cameras/components/CameraCard.jsx

import React, { useState } from 'react';
import { Eye, Radio, MapPin, MoreVertical, Trash2, Edit, Settings } from 'lucide-react';
import Badge from '../../../shared/components/ui/Badge';
import { useTheme } from '../../../shared/contexts/ThemeContext';
import CaptionOverlay from './CaptionOverlay';

const CameraCard = ({ camera, onClick, onDelete }) => {
  const { theme } = useTheme();
  const [showMenu, setShowMenu] = useState(false);

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'danger';
      case 'reconnecting':
        return 'warning';
      default:
        return 'default';
    }
  };

  const handleMenuClick = (e) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    setShowMenu(false);
    if (onDelete) {
      onDelete(camera);
    }
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    setShowMenu(false);
    // TODO: Implement edit functionality
    console.log('Edit camera:', camera.id);
  };

  const handleSettings = (e) => {
    e.stopPropagation();
    setShowMenu(false);
    // TODO: Implement settings functionality
    console.log('Settings for camera:', camera.id);
  };

  return (
    <div
      onClick={() => onClick(camera)}
      className={`group rounded-xl border shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer ${
        theme === 'dark'
          ? 'bg-slate-800/50 backdrop-blur-sm border-slate-700 hover:border-blue-500 hover:shadow-blue-500/10'
          : 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-blue-500/20'
      }`}
    >
      {/* Camera Preview */}
      <div className={`relative aspect-video overflow-hidden ${
        theme === 'dark' ? 'bg-slate-900' : 'bg-slate-100'
      }`}>
        {camera.thumbnail ? (
          <img
            src={camera.thumbnail}
            alt={camera.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Eye className={`w-12 h-12 ${
              theme === 'dark' ? 'text-slate-600' : 'text-slate-300'
            }`} />
          </div>
        )}
        
        {/* Live Indicator */}
        {camera.status === 'active' && (
          <div className="absolute top-3 right-3 flex items-center gap-2 bg-red-500/90 backdrop-blur-sm px-2.5 py-1 rounded-full">
            <Radio className="w-3 h-3 text-white animate-pulse" />
            <span className="text-xs font-semibold text-white">LIVE</span>
          </div>
        )}

        {/* Status Badge */}
        <div className="absolute top-3 left-3">
          <Badge variant={getStatusColor(camera.status)} size="sm" dot>
            {camera.status}
          </Badge>
        </div>

        {/* ===== NEW: Caption Overlay ===== */}
        {camera.status === 'active' && (
          <CaptionOverlay cameraId={camera.id} compact />
        )}
        {/* ===== END NEW ===== */}

        {/* Overlay on Hover */}
        <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end ${
          theme === 'dark'
            ? 'bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent'
            : 'bg-gradient-to-t from-slate-900/80 via-slate-800/30 to-transparent'
        }`}>
          <div className="w-full p-4">
            <p className="text-white text-sm font-medium mb-1">Click to view full stream</p>
            <p className={`text-xs ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-300'
            }`}>
              Resolution: {camera.resolution || '1080p'}
            </p>
          </div>
        </div>
      </div>

      {/* Camera Info */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className={`font-semibold text-base mb-1 truncate group-hover:text-blue-400 transition-colors ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>
              {camera.name}
            </h3>
            <div className={`flex items-center gap-1.5 text-xs ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{camera.location}</span>
            </div>
          </div>
          
          {/* Menu Button */}
          <div className="relative">
            <button
              onClick={handleMenuClick}
              className={`p-1.5 rounded-lg transition-colors ${
                theme === 'dark'
                  ? 'hover:bg-slate-700 text-slate-400 hover:text-white'
                  : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'
              }`}
              aria-label="Camera options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
              <>
                {/* Backdrop to close menu */}
                <div 
                  className="fixed inset-0 z-[100]" 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                  }}
                />
                
                {/* Menu Items */}
                <div className={`absolute right-0 mt-2 w-48 rounded-lg shadow-xl z-[101] border overflow-hidden ${
                  theme === 'dark'
                    ? 'bg-slate-800 border-slate-700'
                    : 'bg-white border-slate-200'
                }`}>
                  {/* Edit Camera */}
                  <button
                    onClick={handleEdit}
                    className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 transition-colors ${
                      theme === 'dark'
                        ? 'text-slate-300 hover:bg-slate-700 hover:text-white'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Edit className="w-4 h-4" />
                    Edit Camera
                  </button>
                  
                  {/* Settings */}
                  <button
                    onClick={handleSettings}
                    className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 transition-colors ${
                      theme === 'dark'
                        ? 'text-slate-300 hover:bg-slate-700 hover:text-white'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </button>
                  
                  {/* Divider */}
                  <div className={`border-t ${
                    theme === 'dark' ? 'border-slate-700' : 'border-slate-200'
                  }`} />
                  
                  {/* Delete Camera - DANGER ZONE */}
                  <button
                    onClick={handleDelete}
                    className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 transition-colors ${
                      theme === 'dark'
                        ? 'text-red-400 hover:bg-red-900/20 hover:text-red-300'
                        : 'text-red-600 hover:bg-red-50 hover:text-red-700'
                    }`}
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Camera
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className={`grid grid-cols-3 gap-2 pt-3 border-t ${
          theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'
        }`}>
          <div className="text-center">
            <p className={`text-xs mb-0.5 ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>
              Events
            </p>
            <p className={`font-semibold text-sm ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>
              {camera.eventsToday || 0}
            </p>
          </div>
          <div className={`text-center border-l border-r ${
            theme === 'dark' ? 'border-slate-700/50' : 'border-slate-200'
          }`}>
            <p className={`text-xs mb-0.5 ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>
              Uptime
            </p>
            <p className={`font-semibold text-sm ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>
              {camera.uptime || '99%'}
            </p>
          </div>
          <div className="text-center">
            <p className={`text-xs mb-0.5 ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>
              FPS
            </p>
            <p className={`font-semibold text-sm ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>
              {camera.fps || '30'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CameraCard;