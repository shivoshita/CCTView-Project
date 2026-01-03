// FILE LOCATION: frontend/src/pages/Cameras/index.jsx

import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, LayoutGrid, Grid } from 'lucide-react';
import Button from '../../shared/components/ui/Button';
import Input from '../../shared/components/ui/Input';
import DepthView from './components/DepthView';
import Loader from '../../shared/components/ui/Loader';
import Badge from '../../shared/components/ui/Badge';
import ConfirmDialog from '../../shared/components/ui/ConfirmDialog';
import { ToastContainer, useToast } from '../../shared/components/feedback/Toast';
import CameraCard from './components/CameraCard';
import FullScreenCamera from './components/FullScreenCamera';
import AddCameraModal from './components/AddCameraModal';
import cameraService from '../../services/camera.service';
import { useTheme } from '../../shared/contexts/ThemeContext';
import PanoramicView from './components/PanoramicView';
import ReIDView from './components/ReIDView';

function Cameras() {
  const { theme } = useTheme();
  const { toasts, toast, removeToast } = useToast();
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [gridSize, setGridSize] = useState('3');
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeView, setActiveView] = useState('grid'); // 'grid', 'panoramic', or 'reid'
  
  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [cameraToDelete, setCameraToDelete] = useState(null);
  const [keepEvents, setKeepEvents] = useState(true);
  const [deleting, setDeleting] = useState(false);

  // Fetch cameras on mount
  useEffect(() => {
    fetchCameras();
  }, []);

  const fetchCameras = async () => {
    try {
      setLoading(true);
      const response = await cameraService.getAllCameras();
      setCameras(response.data || []);
    } catch (error) {
      console.error('Error fetching cameras:', error);
      toast.error('Error', 'Failed to load cameras');
      setCameras(mockCameras);
    } finally {
      setLoading(false);
    }
  };

  // Mock data for development
  const mockCameras = [
    {
      id: 'cam_001',
      name: 'Main Entrance',
      location: 'Building A, Floor 1',
      status: 'active',
      thumbnail: null,
      resolution: '1920x1080',
      fps: 30,
      uptime: '99.8%',
      eventsToday: 24,
      rtsp_url: 'rtsp://admin:pass@192.168.1.100:554/stream1'
    },
    {
      id: 'cam_002',
      name: 'Parking Lot',
      location: 'Outdoor Area',
      status: 'active',
      thumbnail: null,
      resolution: '1920x1080',
      fps: 30,
      uptime: '98.5%',
      eventsToday: 12,
      rtsp_url: 'rtsp://admin:pass@192.168.1.101:554/stream1'
    },
    {
      id: 'cam_003',
      name: 'Back Door',
      location: 'Building A, Rear',
      status: 'reconnecting',
      thumbnail: null,
      resolution: '1920x1080',
      fps: 30,
      uptime: '95.2%',
      eventsToday: 8,
      rtsp_url: 'rtsp://admin:pass@192.168.1.102:554/stream1'
    },
    {
      id: 'cam_004',
      name: 'Lobby',
      location: 'Building A, Floor 1',
      status: 'active',
      thumbnail: null,
      resolution: '1920x1080',
      fps: 30,
      uptime: '99.9%',
      eventsToday: 45,
      rtsp_url: 'rtsp://admin:pass@192.168.1.103:554/stream1'
    },
    {
      id: 'cam_005',
      name: 'Corridor 2',
      location: 'Building A, Floor 2',
      status: 'active',
      thumbnail: null,
      resolution: '1920x1080',
      fps: 30,
      uptime: '99.5%',
      eventsToday: 18,
      rtsp_url: 'rtsp://admin:pass@192.168.1.104:554/stream1'
    },
    {
      id: 'cam_006',
      name: 'Warehouse',
      location: 'Building B',
      status: 'inactive',
      thumbnail: null,
      resolution: '1920x1080',
      fps: 30,
      uptime: '0%',
      eventsToday: 0,
      rtsp_url: 'rtsp://admin:pass@192.168.1.105:554/stream1'
    }
  ];

  const filteredCameras = cameras.filter((camera) => {
    const matchesSearch = 
      camera.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      camera.location.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = 
      filterStatus === 'all' || camera.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: cameras.length,
    active: cameras.filter(c => c.status === 'active').length,
    inactive: cameras.filter(c => c.status === 'inactive').length,
    reconnecting: cameras.filter(c => c.status === 'reconnecting').length
  };

  const handleCameraClick = (camera) => {
    setSelectedCamera(camera);
  };

  const handleCloseFullscreen = () => {
    setSelectedCamera(null);
  };

  const handleCameraAdded = (newCamera) => {
    fetchCameras();
    toast.success('Camera Added', `${newCamera.name} has been added successfully`);
  };

  const handleDeleteClick = (camera) => {
    setCameraToDelete(camera);
    setKeepEvents(true); // Default to keeping events
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!cameraToDelete) return;

    try {
      setDeleting(true);
      
      // Call delete API with keepEvents parameter
      const response = await cameraService.deleteCamera(cameraToDelete.id, keepEvents);
      
      // Update local state
      setCameras(cameras.filter(c => c.id !== cameraToDelete.id));
      
      // Close dialog
      setShowDeleteConfirm(false);
      
      // Show success toast with details
      const eventMessage = keepEvents 
        ? `${response.data.event_count} events preserved in database`
        : `${response.data.event_count} events deleted from database`;
      
      toast.success(
        'Camera Deleted',
        `${cameraToDelete.name} has been deleted. ${eventMessage}`,
        7000
      );
      
      // Reset state
      setCameraToDelete(null);
      
    } catch (error) {
      console.error('Error deleting camera:', error);
      
      // Show error toast
      const errorMessage = error.response?.data?.detail || 'An unexpected error occurred';
      toast.error(
        'Deletion Failed',
        `Failed to delete ${cameraToDelete.name}. ${errorMessage}`,
        7000
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setCameraToDelete(null);
    setKeepEvents(true);
  };

  const gridClasses = {
    '2': 'grid-cols-1 md:grid-cols-2',
    '3': 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    '4': 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader size="lg" text="Loading cameras..." />
      </div>
    );
  }

  if (selectedCamera) {
    return (
      <FullScreenCamera 
        camera={selectedCamera} 
        onClose={handleCloseFullscreen} 
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Add Camera Modal */}
      <AddCameraModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCameraAdded={handleCameraAdded}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title="Delete Camera"
        confirmText="Delete Camera"
        cancelText="Cancel"
        variant="danger"
        loading={deleting}
      >
        <div className="space-y-4">
          <p className={`text-sm ${
            theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
          }`}>
            Are you sure you want to delete <span className="font-semibold">{cameraToDelete?.name}</span>?
          </p>
          
          <div className={`p-4 rounded-lg border ${
            theme === 'dark'
              ? 'bg-slate-900/50 border-slate-700'
              : 'bg-slate-50 border-slate-200'
          }`}>
            <p className={`text-sm font-medium mb-2 ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>
              Camera Details:
            </p>
            <ul className={`text-xs space-y-1 ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>
              <li>• Location: {cameraToDelete?.location}</li>
              <li>• Status: {cameraToDelete?.status}</li>
              <li>• Events today: {cameraToDelete?.eventsToday || 0}</li>
            </ul>
          </div>

          {/* Keep Events Option */}
          <div className={`p-4 rounded-lg border ${
            theme === 'dark'
              ? 'bg-amber-500/10 border-amber-500/30'
              : 'bg-amber-50 border-amber-200'
          }`}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={keepEvents}
                onChange={(e) => setKeepEvents(e.target.checked)}
                disabled={deleting}
                className="mt-0.5 w-4 h-4 rounded border-amber-500 text-amber-500 focus:ring-amber-500 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <div>
                <p className={`text-sm font-medium ${
                  theme === 'dark' ? 'text-amber-400' : 'text-amber-700'
                }`}>
                  Keep associated events in database
                </p>
                <p className={`text-xs mt-1 ${
                  theme === 'dark' ? 'text-amber-300/80' : 'text-amber-600'
                }`}>
                  If checked, all historical events captured by this camera will be preserved in the database. If unchecked, all events will be permanently deleted.
                </p>
              </div>
            </label>
          </div>

          <div className={`p-3 rounded-lg ${
            theme === 'dark'
              ? 'bg-red-500/10'
              : 'bg-red-50'
          }`}>
            <p className={`text-xs ${
              theme === 'dark' ? 'text-red-400' : 'text-red-600'
            }`}>
              ⚠️ <strong>Warning:</strong> This action cannot be undone. The camera configuration will be permanently deleted{!keepEvents ? ' along with all associated events' : ''}.
            </p>
          </div>
        </div>
      </ConfirmDialog>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className={`text-3xl font-bold mb-2 ${
            theme === 'dark' ? 'text-white' : 'text-slate-900'
          }`}>
            Cameras
          </h1>
          <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
            Manage and monitor all your surveillance cameras
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* View Toggle Buttons */}
          <div className={`flex rounded-lg border p-1 ${
            theme === 'dark'
              ? 'bg-slate-800/50 border-slate-700'
              : 'bg-slate-100 border-slate-200'
          }`}>
            <button
              onClick={() => setActiveView('grid')}
              className={`px-4 py-2 rounded-md font-medium transition-all ${
                activeView === 'grid'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : theme === 'dark'
                    ? 'text-slate-400 hover:text-white'
                    : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Camera Grid
            </button>
            <button
              onClick={() => setActiveView('panoramic')}
              className={`px-4 py-2 rounded-md font-medium transition-all ${
                activeView === 'panoramic'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : theme === 'dark'
                    ? 'text-slate-400 hover:text-white'
                    : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Panoramic View
            </button>
            <button
              onClick={() => setActiveView('reid')}
              className={`px-4 py-2 rounded-md font-medium transition-all ${
                activeView === 'reid'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : theme === 'dark'
                    ? 'text-slate-400 hover:text-white'
                    : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Re-ID
            </button>
            <button
              onClick={() => setActiveView('depth')}
              className={`px-4 py-2 rounded-md font-medium transition-all ${
                activeView === 'depth'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : theme === 'dark'
                    ? 'text-slate-400 hover:text-white'
                    : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Depth Tracking
            </button>
          </div>
          
          {/* Add Camera Button */}
          <Button 
            variant="primary" 
            icon={Plus} 
            size="lg"
            onClick={() => setShowAddModal(true)}
          >
            Add Camera
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={`rounded-xl border backdrop-blur-sm p-4 ${
          theme === 'dark'
            ? 'bg-slate-800/50 border-slate-700'
            : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <p className={`text-sm mb-1 ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
          }`}>
            Total Cameras
          </p>
          <p className={`text-3xl font-bold ${
            theme === 'dark' ? 'text-white' : 'text-slate-900'
          }`}>
            {stats.total}
          </p>
        </div>
        <div className={`rounded-xl border backdrop-blur-sm p-4 ${
          theme === 'dark'
            ? 'bg-slate-800/50 border-slate-700'
            : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <p className={`text-sm mb-1 ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
          }`}>
            Active
          </p>
          <div className="flex items-center gap-2">
            <p className={`text-3xl font-bold ${
              theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
            }`}>
              {stats.active}
            </p>
            <Badge variant="success" size="sm" dot>Live</Badge>
          </div>
        </div>
        <div className={`rounded-xl border backdrop-blur-sm p-4 ${
          theme === 'dark'
            ? 'bg-slate-800/50 border-slate-700'
            : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <p className={`text-sm mb-1 ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
          }`}>
            Reconnecting
          </p>
          <div className="flex items-center gap-2">
            <p className={`text-3xl font-bold ${
              theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
            }`}>
              {stats.reconnecting}
            </p>
            <Badge variant="warning" size="sm">Issue</Badge>
          </div>
        </div>
        <div className={`rounded-xl border backdrop-blur-sm p-4 ${
          theme === 'dark'
            ? 'bg-slate-800/50 border-slate-700'
            : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <p className={`text-sm mb-1 ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
          }`}>
            Inactive
          </p>
          <p className={`text-3xl font-bold ${
            theme === 'dark' ? 'text-red-400' : 'text-red-600'
          }`}>
            {stats.inactive}
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
            }`} />
            <input
              type="text"
              placeholder="Search cameras by name or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-11 pr-4 py-2.5 rounded-lg border transition-all ${
                theme === 'dark'
                  ? 'bg-slate-900/50 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                  : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-sm'
              }`}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              filterStatus === 'all'
                ? 'bg-blue-500 text-white'
                : theme === 'dark'
                  ? 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-300 shadow-sm'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterStatus('active')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              filterStatus === 'active'
                ? 'bg-blue-500 text-white'
                : theme === 'dark'
                  ? 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-300 shadow-sm'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setFilterStatus('inactive')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              filterStatus === 'inactive'
                ? 'bg-blue-500 text-white'
                : theme === 'dark'
                  ? 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-300 shadow-sm'
            }`}
          >
            Inactive
          </button>
        </div>

        <div className={`flex gap-2 border rounded-lg p-1 ${
          theme === 'dark'
            ? 'border-slate-700 bg-slate-800/50'
            : 'border-slate-300 bg-white shadow-sm'
        }`}>
          <button
            onClick={() => setGridSize('2')}
            className={`p-2 rounded transition-all ${
              gridSize === '2' 
                ? theme === 'dark'
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-200 text-slate-900'
                : theme === 'dark'
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-500 hover:text-slate-900'
            }`}
            title="2 columns"
          >
            <LayoutGrid className="w-5 h-5" />
          </button>
          <button
            onClick={() => setGridSize('3')}
            className={`p-2 rounded transition-all ${
              gridSize === '3' 
                ? theme === 'dark'
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-200 text-slate-900'
                : theme === 'dark'
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-500 hover:text-slate-900'
            }`}
            title="3 columns"
          >
            <Grid className="w-5 h-5" />
          </button>
          <button
            onClick={() => setGridSize('4')}
            className={`p-2 rounded transition-all ${
              gridSize === '4' 
                ? theme === 'dark'
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-200 text-slate-900'
                : theme === 'dark'
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-500 hover:text-slate-900'
            }`}
            title="4 columns"
          >
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Camera Grid, Panoramic View, or Re-ID */}
      {activeView === 'grid' ? (
        filteredCameras.length === 0 ? (
          <div className="text-center py-12">
            <p className={`text-lg ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>
              No cameras found
            </p>
            <p className={`text-sm mt-2 ${
              theme === 'dark' ? 'text-slate-500' : 'text-slate-500'
            }`}>
              Try adjusting your filters or add a new camera
            </p>
          </div>
        ) : (
          <div className={`grid ${gridClasses[gridSize]} gap-6`}>
            {filteredCameras.map((camera) => (
              <CameraCard
                key={camera.id}
                camera={camera}
                onClick={handleCameraClick}
                onDelete={handleDeleteClick}
              />
            ))}
          </div>
        )
      ) : activeView === 'panoramic' ? (
        <PanoramicView cameras={cameras.filter(c => c.status === 'active')} />
      ) : activeView === 'depth' ? (
        <DepthView cameras={cameras.filter(c => c.status === 'active')} />
      ) : (
        <ReIDView cameras={cameras.filter(c => c.status === 'active')} />
      )}
    </div>
  );
}

export default Cameras;