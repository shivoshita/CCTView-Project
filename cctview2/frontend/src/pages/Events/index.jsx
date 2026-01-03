// FILE LOCATION: frontend/src/pages/Events/index.jsx

import React, { useState, useEffect } from 'react';
import { 
  Camera, 
  Clock, 
  MapPin, 
  ChevronDown, 
  ChevronUp,
  Activity,
  AlertCircle,
  Play,
  Download,
  Share2,
  Maximize2,
  RefreshCw,
  Eye,
  Video,
  Zap,
  Copy,
  Mail,
  MessageCircle,
  Search
} from 'lucide-react';
import { useTheme } from '../../shared/contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';
import Button from '../../shared/components/ui/Button';
import Badge from '../../shared/components/ui/Badge';
import Loader from '../../shared/components/ui/Loader';
import apiService from '../../services/api.service.js';
import eventService from '../../services/event.service';

function Events() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('all');
  const [expandedEvent, setExpandedEvent] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [showShareMenu, setShowShareMenu] = useState(null);

  // Fetch cameras and their events
  useEffect(() => {
    fetchCamerasWithEvents();
  }, []);

  const fetchCamerasWithEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('📡 Fetching cameras from Neo4j...');
      
      // Step 1: Fetch all cameras
      const camerasResponse = await apiService.get('/cameras');
      console.log('📷 Cameras response:', camerasResponse.data);
      
      const camerasList = Array.isArray(camerasResponse.data) 
        ? camerasResponse.data 
        : camerasResponse.data.cameras || [];
      
      if (camerasList.length === 0) {
        console.warn('⚠️ No cameras found');
        setCameras([]);
        setLoading(false);
        return;
      }
      
      console.log(`✅ Found ${camerasList.length} cameras`);
      
      // Step 2: Fetch last 10 events for each camera
      const camerasWithEvents = await Promise.all(
        camerasList.map(async (camera) => {
          try {
            console.log(`📋 Fetching events for camera: ${camera.name} (${camera.id})`);
            
            const eventsResponse = await apiService.get(`/events/camera/${camera.id}/recent`, {
              params: { limit: 10 }
            });
            
            const events = eventsResponse.data.events || [];
            console.log(`✅ Got ${events.length} events for ${camera.name}`);
            
            return {
              ...camera,
              events: events,
              eventCount: events.length
            };
          } catch (error) {
            console.error(`❌ Error fetching events for camera ${camera.id}:`, error);
            return {
              ...camera,
              events: [],
              eventCount: 0
            };
          }
        })
      );
      
      console.log('✅ All cameras with events loaded:', camerasWithEvents);
      setCameras(camerasWithEvents);
      
    } catch (error) {
      console.error('❌ Error fetching cameras:', error);
      setError('Failed to load cameras from Neo4j. Please check the backend connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchCamerasWithEvents();
    setRefreshing(false);
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    return eventService.formatTimestamp(timestamp);
  };

  // FIXED: Toggle specific event using uniqueKey instead of event.id
  const toggleEvent = (uniqueKey) => {
    setExpandedEvent(expandedEvent === uniqueKey ? null : uniqueKey);
  };

  // FIXED: Get current camera data with proper filtering
  const getCurrentCameraData = () => {
    if (selectedCamera === 'all') {
      // Show top 10 events from EACH camera (total max 50 events)
      const allEvents = [];
      
      cameras.forEach((camera, camIdx) => {
        const cameraEvents = (camera.events || []).slice(0, 10).map((event, idx) => ({
          ...event,
          cameraName: camera.name,
          cameraLocation: camera.location,
          cameraId: camera.id,
          // Create TRULY unique key combining camera index, camera ID, event ID, and index
          uniqueKey: `cam_${camIdx}_${camera.id}_evt_${event.id || idx}_${Date.now()}_${Math.random()}`
        }));
        allEvents.push(...cameraEvents);
      });
      
      // Sort all events by timestamp descending
      allEvents.sort((a, b) => {
        const dateA = new Date(a.timestamp || a.start_time);
        const dateB = new Date(b.timestamp || b.start_time);
        return dateB - dateA;
      });
      
      // Re-assign unique keys after sorting to ensure uniqueness
      const sortedWithUniqueKeys = allEvents.map((event, finalIdx) => ({
        ...event,
        uniqueKey: `sorted_${finalIdx}_${event.cameraId}_${event.id || finalIdx}`
      }));
      
      return {
        name: 'All Cameras',
        location: 'All Locations',
        status: 'active',
        events: sortedWithUniqueKeys,
        eventCount: sortedWithUniqueKeys.length
      };
    }
    
    // Show TOP 10 events for selected camera only
    const selectedCameraData = cameras.find(c => c.id === selectedCamera);
    if (selectedCameraData) {
      return {
        ...selectedCameraData,
        events: (selectedCameraData.events || []).slice(0, 10).map((event, idx) => ({
          ...event,
          uniqueKey: `${selectedCamera}_evt_${event.id || idx}_${idx}` // Add unique key for single camera too
        }))
      };
    }
    return null;
  };

  const currentCamera = getCurrentCameraData();

  // Calculate total events across all cameras
  const totalEventsCount = cameras.reduce((sum, cam) => sum + (cam.eventCount || 0), 0);

  // Download single event as CSV
  const handleDownloadEvent = (event) => {
    eventService.downloadCSV([event], `event_${event.id}.csv`);
  };

  // Share event
  const handleShare = (event, method) => {
    const eventUrl = `${window.location.origin}/events/${event.id}`;
    const timestamp = formatTimestamp(event.timestamp || event.start_time);
    const shareText = `Event: ${event.caption}\nCamera: ${event.cameraName || 'Unknown'}\nTime: ${timestamp.date} ${timestamp.time}`;

    switch(method) {
      case 'whatsapp':
        window.open(`https://wa.me/?text=${encodeURIComponent(shareText + '\n' + eventUrl)}`, '_blank');
        break;
      case 'email':
        window.location.href = `mailto:?subject=Event Share&body=${encodeURIComponent(shareText + '\n\n' + eventUrl)}`;
        break;
      case 'copy':
        navigator.clipboard.writeText(eventUrl).then(() => {
          alert('Link copied to clipboard!');
        });
        break;
    }
    setShowShareMenu(null);
  };

  // View full details
  const handleFullDetails = (eventId) => {
    navigate(`/events/${eventId}`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <Loader size="lg" />
        <p className={`mt-4 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
          Loading events from Neo4j database...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <AlertCircle className={`w-12 h-12 mb-4 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`} />
        <p className={`text-lg font-medium mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
          {error}
        </p>
        <Button onClick={fetchCamerasWithEvents} variant="primary" icon={RefreshCw}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className={`text-3xl font-bold mb-2 ${
            theme === 'dark' ? 'text-white' : 'text-slate-900'
          }`}>
            Event Timeline
          </h1>
          <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
            Last 10 events captured by each camera • {totalEventsCount} total events
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            variant={theme === 'dark' ? 'outline' : 'primary'}
            icon={Search}
            onClick={() => navigate('/events/search')}
          >
            Search Events
          </Button>
          <Button
            variant={theme === 'dark' ? 'outline' : 'primary'}
            icon={RefreshCw}
            onClick={handleRefresh}
            disabled={refreshing}
            className={refreshing ? 'animate-spin' : ''}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Camera Selector */}
      {cameras.length > 0 && (
        <div className={`rounded-xl border backdrop-blur-sm p-4 ${
          theme === 'dark'
            ? 'bg-slate-800/50 border-slate-700'
            : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className="flex items-center gap-2 mb-3">
            <Camera className={`w-4 h-4 ${
              theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
            }`} />
            <span className={`text-sm font-medium ${
              theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
            }`}>
              Select Camera
            </span>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {/* All Cameras Option */}
            <button
              onClick={() => setSelectedCamera('all')}
              className={`
                px-4 py-2 rounded-lg border transition-all
                ${selectedCamera === 'all'
                  ? theme === 'dark'
                    ? 'bg-blue-500 border-blue-400 text-white'
                    : 'bg-blue-500 border-blue-400 text-white'
                  : theme === 'dark'
                    ? 'bg-slate-900/50 border-slate-700 text-slate-300 hover:border-blue-500'
                    : 'bg-slate-50 border-slate-300 text-slate-700 hover:border-blue-400'
                }
              `}
            >
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                <span className="text-sm font-medium">All Cameras</span>
                <Badge variant="default" size="sm">
                  {totalEventsCount}
                </Badge>
              </div>
            </button>

            {/* Individual Cameras */}
            {cameras.map((camera) => (
              <button
                key={camera.id}
                onClick={() => setSelectedCamera(camera.id)}
                className={`
                  px-4 py-2 rounded-lg border transition-all
                  ${selectedCamera === camera.id
                    ? theme === 'dark'
                      ? 'bg-blue-500 border-blue-400 text-white'
                      : 'bg-blue-500 border-blue-400 text-white'
                    : theme === 'dark'
                      ? 'bg-slate-900/50 border-slate-700 text-slate-300 hover:border-blue-500'
                      : 'bg-slate-50 border-slate-300 text-slate-700 hover:border-blue-400'
                  }
                `}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    camera.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'
                  }`} />
                  <span className="text-sm font-medium">{camera.name}</span>
                  <Badge variant="default" size="sm">
                    {camera.eventCount || 0}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Events Timeline */}
      {currentCamera && (
        <div className={`rounded-xl border backdrop-blur-sm ${
          theme === 'dark'
            ? 'bg-slate-800/50 border-slate-700'
            : 'bg-white border-slate-200 shadow-sm'
        }`}>
          {/* Camera Info Header */}
          <div className={`px-6 py-4 border-b flex items-center justify-between ${
            theme === 'dark' ? 'border-slate-700' : 'border-slate-200'
          }`}>
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${
                theme === 'dark' ? 'bg-blue-500/10' : 'bg-blue-50'
              }`}>
                <Camera className={`w-6 h-6 ${
                  theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                }`} />
              </div>
              
              <div>
                <h2 className={`text-xl font-semibold ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  {currentCamera.name}
                </h2>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex items-center gap-1">
                    <MapPin className={`w-3 h-3 ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                    }`} />
                    <span className={`text-sm ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                    }`}>
                      {currentCamera.location || 'Unknown location'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Activity className={`w-3 h-3 ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                    }`} />
                    <span className={`text-sm ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                    }`}>
                      {currentCamera.eventCount || 0} events
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {selectedCamera !== 'all' && (
              <Badge 
                variant={currentCamera.status === 'active' ? 'success' : 'danger'}
                dot
              >
                {currentCamera.status === 'active' ? 'Active' : 'Inactive'}
              </Badge>
            )}
          </div>

          {/* Events List */}
          <div className="p-6">
            {currentCamera.events && currentCamera.events.length > 0 ? (
              <div className="space-y-4">
                {currentCamera.events.map((event, index) => {
                  const timestamp = formatTimestamp(event.timestamp || event.start_time);
                  // Use uniqueKey for both React key AND expansion tracking
                  const eventKey = event.uniqueKey || `event_${index}`;
                  const isExpanded = expandedEvent === eventKey;
                  
                  return (
                    <div
                      key={eventKey}
                      className={`
                        rounded-xl border transition-all
                        ${isExpanded ? 'ring-2 ring-blue-500' : ''}
                        ${theme === 'dark'
                          ? 'bg-slate-900/50 border-slate-700 hover:border-slate-600'
                          : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                        }
                      `}
                    >
                      {/* Event Header */}
                      <div 
                        className="p-4 cursor-pointer"
                        onClick={() => toggleEvent(eventKey)}
                      >
                        <div className="flex items-start gap-4">
                          {/* Timeline Indicator */}
                          <div className="flex flex-col items-center">
                            <div className={`
                              w-10 h-10 rounded-full flex items-center justify-center
                              ${theme === 'dark'
                                ? 'bg-blue-500/10 text-blue-400'
                                : 'bg-blue-50 text-blue-600'
                              }
                            `}>
                              <span className="text-xs font-bold">
                                {String(index + 1).padStart(2, '0')}
                              </span>
                            </div>
                            {index < currentCamera.events.length - 1 && (
                              <div className={`w-px h-full mt-2 ${
                                theme === 'dark' ? 'bg-slate-700' : 'bg-slate-300'
                              }`} style={{ minHeight: '20px' }} />
                            )}
                          </div>

                          {/* Event Content */}
                          <div className="flex-1 min-w-0">
                            {/* Time and Status */}
                            <div className="flex flex-wrap items-center gap-3 mb-2">
                              <div className="flex items-center gap-2">
                                <Clock className={`w-4 h-4 ${
                                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                                }`} />
                                <span className={`text-sm font-medium ${
                                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                                }`}>
                                  {timestamp.time}
                                </span>
                                <span className={`text-xs ${
                                  theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                                }`}>
                                  {timestamp.relative}
                                </span>
                              </div>
                              
                              <Badge variant="default" size="sm">
                                {timestamp.date}
                              </Badge>
                              
                              {selectedCamera === 'all' && event.cameraName && (
                                <Badge variant="info" size="sm">
                                  <Camera className="w-3 h-3 mr-1" />
                                  {event.cameraName}
                                </Badge>
                              )}
                              
                              {event.confidence && (
                                <Badge 
                                  variant={event.confidence > 0.8 ? 'success' : 'warning'}
                                  size="sm"
                                >
                                  {(event.confidence * 100).toFixed(0)}% confident
                                </Badge>
                              )}
                            </div>

                            {/* Caption */}
                            <p className={`text-sm leading-relaxed mb-2 ${
                              theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                            }`}>
                              {event.caption || 'No description available'}
                            </p>

                            {/* Duration & Frames */}
                            {(event.duration || event.frame_count) && (
                              <div className="flex items-center gap-4">
                                {event.duration && (
                                  <div className="flex items-center gap-1">
                                    <Video className={`w-3 h-3 ${
                                      theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                                    }`} />
                                    <span className={`text-xs ${
                                      theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                                    }`}>
                                      {event.duration}s
                                    </span>
                                  </div>
                                )}
                                {event.frame_count && (
                                  <div className="flex items-center gap-1">
                                    <Eye className={`w-3 h-3 ${
                                      theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                                    }`} />
                                    <span className={`text-xs ${
                                      theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                                    }`}>
                                      {event.frame_count} frames
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Expand Button */}
                          <button
                            className={`
                              p-2 rounded-lg transition-colors flex-shrink-0
                              ${theme === 'dark'
                                ? 'hover:bg-slate-800 text-slate-400 hover:text-white'
                                : 'hover:bg-slate-200 text-slate-600 hover:text-slate-900'
                              }
                            `}
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5" />
                            ) : (
                              <ChevronDown className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className={`px-4 pb-4 border-t ${
                          theme === 'dark' ? 'border-slate-700' : 'border-slate-200'
                        }`}>
                          <div className="pt-4 space-y-4">
                            {/* Time Range */}
                            {event.start_time && event.end_time && (
                              <div className={`p-3 rounded-lg ${
                                theme === 'dark' ? 'bg-slate-800/50' : 'bg-white'
                              }`}>
                                <p className={`text-xs font-medium mb-2 ${
                                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                                }`}>
                                  TIME RANGE
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <p className={`text-xs ${
                                      theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                                    }`}>
                                      Started
                                    </p>
                                    <p className={`text-sm font-medium ${
                                      theme === 'dark' ? 'text-white' : 'text-slate-900'
                                    }`}>
                                      {formatTimestamp(event.start_time).time}
                                    </p>
                                  </div>
                                  <div>
                                    <p className={`text-xs ${
                                      theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                                    }`}>
                                      Ended
                                    </p>
                                    <p className={`text-sm font-medium ${
                                      theme === 'dark' ? 'text-white' : 'text-slate-900'
                                    }`}>
                                      {formatTimestamp(event.end_time).time}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Metadata */}
                            <div className={`p-3 rounded-lg ${
                              theme === 'dark' ? 'bg-slate-800/50' : 'bg-white'
                            }`}>
                              <p className={`text-xs font-medium mb-2 ${
                                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                              }`}>
                                METADATA
                              </p>
                              <div className="grid grid-cols-3 gap-3">
                                <div>
                                  <p className={`text-xs ${
                                    theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                                  }`}>
                                    Event ID
                                  </p>
                                  <p className={`text-xs font-mono ${
                                    theme === 'dark' ? 'text-white' : 'text-slate-900'
                                  }`}>
                                    {event.id?.slice(0, 12) || 'N/A'}
                                  </p>
                                </div>
                                <div>
                                  <p className={`text-xs ${
                                    theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                                  }`}>
                                    Confidence
                                  </p>
                                  <p className={`text-xs font-medium ${
                                    theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                                  }`}>
                                    {event.confidence ? (event.confidence * 100).toFixed(1) : 'N/A'}%
                                  </p>
                                </div>
                                <div>
                                  <p className={`text-xs ${
                                    theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                                  }`}>
                                    Retention
                                  </p>
                                  <p className={`text-xs font-medium ${
                                    theme === 'dark' ? 'text-white' : 'text-slate-900'
                                  }`}>
                                    {event.retention_until 
                                      ? new Date(event.retention_until).toLocaleDateString()
                                      : 'Unlimited'
                                    }
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <Button 
                                variant={theme === 'dark' ? 'outline' : 'primary'}
                                size="sm" 
                                icon={Play}
                              >
                                Play Video
                              </Button>
                              <Button 
                                variant={theme === 'dark' ? 'outline' : 'primary'}
                                size="sm" 
                                icon={Download}
                                onClick={() => handleDownloadEvent(event)}
                              >
                                Download
                              </Button>
                              <div className="relative">
                                <Button 
                                  variant={theme === 'dark' ? 'outline' : 'primary'}
                                  size="sm" 
                                  icon={Share2}
                                  onClick={() => setShowShareMenu(showShareMenu === eventKey ? null : eventKey)}
                                >
                                  Share
                                </Button>
                                {showShareMenu === eventKey && (
                                  <div className={`absolute bottom-full mb-2 left-0 rounded-lg border shadow-lg p-2 min-w-[150px] z-10 ${
                                    theme === 'dark'
                                      ? 'bg-slate-800 border-slate-700'
                                      : 'bg-white border-slate-200'
                                  }`}>
                                    <button
                                      onClick={() => handleShare(event, 'whatsapp')}
                                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                                        theme === 'dark'
                                          ? 'hover:bg-slate-700 text-white'
                                          : 'hover:bg-slate-100 text-slate-900'
                                      }`}
                                    >
                                      <MessageCircle className="w-4 h-4" />
                                      WhatsApp
                                    </button>
                                    <button
                                      onClick={() => handleShare(event, 'email')}
                                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                                        theme === 'dark'
                                          ? 'hover:bg-slate-700 text-white'
                                          : 'hover:bg-slate-100 text-slate-900'
                                      }`}
                                    >
                                      <Mail className="w-4 h-4" />
                                      Email
                                    </button>
                                    <button
                                      onClick={() => handleShare(event, 'copy')}
                                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                                        theme === 'dark'
                                          ? 'hover:bg-slate-700 text-white'
                                          : 'hover:bg-slate-100 text-slate-900'
                                      }`}
                                    >
                                      <Copy className="w-4 h-4" />
                                      Copy Link
                                    </button>
                                  </div>
                                )}
                              </div>
                              <Button 
                                variant={theme === 'dark' ? 'outline' : 'primary'}
                                size="sm" 
                                icon={Maximize2}
                                onClick={() => handleFullDetails(event.id)}
                              >
                                Full Details
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className={`inline-flex p-4 rounded-full mb-4 ${
                  theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'
                }`}>
                  <AlertCircle className={`w-8 h-8 ${
                    theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                  }`} />
                </div>
                <p className={`text-lg font-medium mb-2 ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  No Events Recorded
                </p>
                <p className={`text-sm ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  This camera hasn't captured any events yet.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* No Cameras State */}
      {cameras.length === 0 && !loading && (
        <div className={`rounded-xl border backdrop-blur-sm p-12 text-center ${
          theme === 'dark'
            ? 'bg-slate-800/50 border-slate-700'
            : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className={`inline-flex p-4 rounded-full mb-4 ${
            theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'
          }`}>
            <Camera className={`w-8 h-8 ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`} />
          </div>
          <p className={`text-lg font-medium mb-2 ${
            theme === 'dark' ? 'text-white' : 'text-slate-900'
          }`}>
            No Cameras Found
          </p>
          <p className={`text-sm mb-4 ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
          }`}>
            Add cameras to start capturing events from Neo4j.
          </p>
          <Button variant="primary" icon={Camera}>
            Add Camera
          </Button>
        </div>
      )}
    </div>
  );
}

export default Events;