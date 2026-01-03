// FILE LOCATION: frontend/src/pages/Events/EventSearch.jsx

import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Calendar,
  Camera,
  X,
  Loader2,
  Download,
  AlertCircle,
  Clock,
  Eye,
  Video,
  ChevronDown,
  ChevronUp,
  Share2,
  Maximize2,
  Copy,
  Mail,
  MessageCircle,
  TrendingUp
} from 'lucide-react';
import { useTheme } from '../../shared/contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';
import Button from '../../shared/components/ui/Button';
import Badge from '../../shared/components/ui/Badge';
import Loader from '../../shared/components/ui/Loader';
import eventService from '../../services/event.service';
import apiService from '../../services/api.service.js';

function EventSearch() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [cameras, setCameras] = useState([]);
  const [selectedCameras, setSelectedCameras] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minConfidence, setMinConfidence] = useState(0);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedEvent, setExpandedEvent] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(null);
  const [shareSuccess, setShareSuccess] = useState('');

  // Fetch cameras on mount
  useEffect(() => {
    fetchCameras();
  }, []);

  const fetchCameras = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/cameras');
      const camerasList = Array.isArray(response.data) 
        ? response.data 
        : response.data.cameras || [];
      setCameras(camerasList);
    } catch (error) {
      console.error('Error fetching cameras:', error);
      setError('Failed to load cameras');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) {
      setError('Please enter a search query');
      return;
    }

    try {
      setSearching(true);
      setError(null);

      console.log('🔍 Starting search for:', searchQuery);

      // Step 1: Get all events from selected cameras or all cameras
      let allEvents = [];
      
      if (selectedCameras.length > 0) {
        // Fetch events from selected cameras
        for (const cameraId of selectedCameras) {
          try {
            const response = await apiService.get(`/events/camera/${cameraId}/recent`, {
              params: { limit: 50 }
            });
            const events = response.data.events || [];
            allEvents.push(...events.map(e => ({
              ...e,
              camera_id: cameraId,
              camera_name: cameras.find(c => c.id === cameraId)?.name || 'Unknown'
            })));
          } catch (err) {
            console.error(`Error fetching from camera ${cameraId}:`, err);
          }
        }
      } else {
        // Fetch from all cameras
        for (const camera of cameras) {
          try {
            const response = await apiService.get(`/events/camera/${camera.id}/recent`, {
              params: { limit: 50 }
            });
            const events = response.data.events || [];
            allEvents.push(...events.map(e => ({
              ...e,
              camera_id: camera.id,
              camera_name: camera.name
            })));
          } catch (err) {
            console.error(`Error fetching from camera ${camera.id}:`, err);
          }
        }
      }

      console.log(`📊 Fetched ${allEvents.length} total events`);

      // Step 2: Filter by search query (caption text)
      const searchLower = searchQuery.toLowerCase();
      let results = allEvents.filter(event => {
        const caption = (event.caption || '').toLowerCase();
        return caption.includes(searchLower);
      });

      console.log(`🔍 Found ${results.length} events matching "${searchQuery}"`);

      // Step 3: Filter by date range
      if (startDate || endDate) {
        results = results.filter(event => {
          const eventDate = new Date(event.timestamp || event.start_time);
          
          if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            if (eventDate < start) return false;
          }
          
          if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            if (eventDate > end) return false;
          }
          
          return true;
        });
        console.log(`📅 After date filter: ${results.length} events`);
      }

      // Step 4: Filter by confidence
      if (minConfidence > 0) {
        results = results.filter(event => {
          return (event.confidence || 0) >= (minConfidence / 100);
        });
        console.log(`📊 After confidence filter: ${results.length} events`);
      }

      // Step 5: Sort by timestamp (newest first)
      results.sort((a, b) => {
        const dateA = new Date(a.timestamp || a.start_time);
        const dateB = new Date(b.timestamp || b.start_time);
        return dateB - dateA;
      });

      // Step 6: Add unique keys for React
      results = results.map((event, idx) => ({
        ...event,
        uniqueKey: `search_${idx}_${event.id || idx}_${Date.now()}`
      }));

      console.log(`✅ Final results: ${results.length} events`);
      setSearchResults(results);

      if (results.length === 0) {
        setError(`No events found matching "${searchQuery}". Try different search terms or adjust filters.`);
      }

    } catch (error) {
      console.error('❌ Search error:', error);
      setError(error.response?.data?.detail || 'Search failed. Please try again.');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedCameras([]);
    setStartDate('');
    setEndDate('');
    setMinConfidence(0);
    setSearchResults([]);
    setError(null);
  };

  const toggleCameraSelection = (cameraId) => {
    setSelectedCameras(prev => 
      prev.includes(cameraId)
        ? prev.filter(id => id !== cameraId)
        : [...prev, cameraId]
    );
  };

  const handleExport = () => {
    eventService.downloadCSV(searchResults, `event_search_${Date.now()}.csv`);
  };

  const formatTimestamp = (timestamp) => {
    return eventService.formatTimestamp(timestamp);
  };

  const toggleEvent = (uniqueKey) => {
    setExpandedEvent(expandedEvent === uniqueKey ? null : uniqueKey);
  };

  const handleDownloadEvent = (event) => {
    eventService.downloadCSV([event], `event_${event.id}.csv`);
  };

  const handleShare = (event, method) => {
    const eventUrl = `${window.location.origin}/events/${event.id}`;
    const timestamp = formatTimestamp(event.timestamp || event.start_time);
    const shareText = `Event: ${event.caption}\nCamera: ${event.camera_name || 'Unknown'}\nTime: ${timestamp.date} ${timestamp.time}`;

    switch(method) {
      case 'whatsapp':
        window.open(`https://wa.me/?text=${encodeURIComponent(shareText + '\n' + eventUrl)}`, '_blank');
        break;
      case 'email':
        window.location.href = `mailto:?subject=Event Share&body=${encodeURIComponent(shareText + '\n\n' + eventUrl)}`;
        break;
      case 'copy':
        navigator.clipboard.writeText(eventUrl).then(() => {
          setShareSuccess('Link copied!');
          setTimeout(() => setShareSuccess(''), 2000);
        });
        break;
    }
    setShowShareMenu(null);
  };

  const handleFullDetails = (eventId) => {
    navigate(`/events/${eventId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader size="lg" />
        <p className={`ml-3 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
          Loading cameras...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className={`text-3xl font-bold mb-2 ${
          theme === 'dark' ? 'text-white' : 'text-slate-900'
        }`}>
          Search Events
        </h1>
        <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
          Search through surveillance events using natural language queries
        </p>
      </div>

      {/* Share Success Message */}
      {shareSuccess && (
        <div className={`rounded-lg border p-3 flex items-center gap-2 ${
          theme === 'dark'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : 'bg-emerald-50 border-emerald-200 text-emerald-600'
        }`}>
          <Copy className="w-4 h-4" />
          <span className="text-sm font-medium">{shareSuccess}</span>
        </div>
      )}

      {/* Search Form */}
      <form onSubmit={handleSearch} className={`rounded-xl border backdrop-blur-sm p-6 ${
        theme === 'dark'
          ? 'bg-slate-800/50 border-slate-700'
          : 'bg-white border-slate-200 shadow-sm'
      }`}>
        {/* Main Search Input */}
        <div className="flex gap-3 mb-4">
        <div className="flex-1 relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
            }`} />
            <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events by caption... (e.g., 'person entering', 'delivery truck')"
            className={`w-full pl-11 pr-4 py-3 rounded-lg border transition-all ${
                theme === 'dark'
                ? 'bg-slate-900/50 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
            }`}
            />
        </div>
        
        <Button
            type="submit"
            variant="primary"
            icon={searching ? Loader2 : Search}
            disabled={searching || !searchQuery.trim()}
            className={searching ? 'animate-pulse' : ''}
        >
            {searching ? 'Searching...' : 'Search'}
        </Button>
        
        <Button
            type="button"
            variant={theme === 'dark' ? 'outline' : 'primary'}
            icon={Filter}
            onClick={() => setShowFilters(!showFilters)}
        >
            Filters
        </Button>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className={`pt-4 border-t space-y-4 ${
            theme === 'dark' ? 'border-slate-700' : 'border-slate-200'
          }`}>
            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  <Calendar className="w-4 h-4 inline mr-2" />
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={`w-full px-4 py-2 rounded-lg border transition-all ${
                    theme === 'dark'
                      ? 'bg-slate-900/50 border-slate-700 text-white focus:outline-none focus:border-blue-500'
                      : 'bg-white border-slate-300 text-slate-900 focus:outline-none focus:border-blue-500'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  <Calendar className="w-4 h-4 inline mr-2" />
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={`w-full px-4 py-2 rounded-lg border transition-all ${
                    theme === 'dark'
                      ? 'bg-slate-900/50 border-slate-700 text-white focus:outline-none focus:border-blue-500'
                      : 'bg-white border-slate-300 text-slate-900 focus:outline-none focus:border-blue-500'
                  }`}
                />
              </div>
            </div>

            {/* Camera Selection */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
              }`}>
                <Camera className="w-4 h-4 inline mr-2" />
                Cameras ({selectedCameras.length} selected)
              </label>
              <div className="flex flex-wrap gap-2">
                {cameras.map(camera => (
                  <button
                    key={camera.id}
                    type="button"
                    onClick={() => toggleCameraSelection(camera.id)}
                    className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                      selectedCameras.includes(camera.id)
                        ? 'bg-blue-500 border-blue-400 text-white'
                        : theme === 'dark'
                          ? 'bg-slate-900/50 border-slate-700 text-slate-300 hover:border-blue-500'
                          : 'bg-white border-slate-300 text-slate-700 hover:border-blue-400'
                    }`}
                  >
                    {camera.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Confidence Filter */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
              }`}>
                <TrendingUp className="w-4 h-4 inline mr-2" />
                Minimum Confidence: {minConfidence}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={minConfidence}
                onChange={(e) => setMinConfidence(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs mt-1">
                <span className={theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}>0%</span>
                <span className={theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}>50%</span>
                <span className={theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}>100%</span>
              </div>
            </div>

            {/* Clear Filters */}
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                icon={X}
                onClick={handleClearFilters}
              >
                Clear All Filters
              </Button>
            </div>
          </div>
        )}
      </form>

      {/* Error Display */}
      {error && (
        <div className={`rounded-lg border p-4 flex items-start gap-3 ${
          theme === 'dark'
            ? 'bg-red-500/10 border-red-500/30 text-red-400'
            : 'bg-red-50 border-red-200 text-red-600'
        }`}>
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">Search Error</p>
            <p className="text-sm mt-1 opacity-90">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="hover:opacity-70"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className={`rounded-xl border backdrop-blur-sm ${
          theme === 'dark'
            ? 'bg-slate-800/50 border-slate-700'
            : 'bg-white border-slate-200 shadow-sm'
        }`}>
          {/* Results Header */}
          <div className={`px-6 py-4 border-b flex items-center justify-between ${
            theme === 'dark' ? 'border-slate-700' : 'border-slate-200'
          }`}>
            <div>
              <h2 className={`text-lg font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                Search Results
              </h2>
              <p className={`text-sm mt-1 ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
              }`}>
                Found {searchResults.length} matching events
              </p>
            </div>

            <Button
            variant={theme === 'dark' ? 'outline' : 'primary'}
            icon={Download}
            onClick={handleExport}
            size="sm"
            >
            Export CSV
            </Button>
          </div>

          {/* Results List */}
          <div className="p-6 space-y-4">
            {searchResults.map((event, index) => {
              const timestamp = formatTimestamp(event.timestamp || event.start_time);
              const eventKey = event.uniqueKey || `search_${index}`;
              const isExpanded = expandedEvent === eventKey;

              return (
                <div
                  key={eventKey}
                  className={`rounded-xl border transition-all ${
                    isExpanded ? 'ring-2 ring-blue-500' : ''
                  } ${
                    theme === 'dark'
                      ? 'bg-slate-900/50 border-slate-700 hover:border-slate-600'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() => toggleEvent(eventKey)}
                  >
                    <div className="flex items-start gap-4">
                      {/* Index */}
                      <div className={`
                        w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                        ${theme === 'dark'
                          ? 'bg-blue-500/10 text-blue-400'
                          : 'bg-blue-50 text-blue-600'
                        }
                      `}>
                        <span className="text-xs font-bold">{index + 1}</span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Metadata */}
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          <div className="flex items-center gap-1">
                            <Clock className={`w-3 h-3 ${
                              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                            }`} />
                            <span className={`text-xs ${
                              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                            }`}>
                              {timestamp.time}
                            </span>
                          </div>

                          <Badge variant="default" size="sm">
                            {timestamp.date}
                          </Badge>

                          <Badge variant="info" size="sm">
                            <Camera className="w-3 h-3 mr-1" />
                            {event.camera_name || 'Unknown'}
                          </Badge>

                          {event.confidence && (
                            <Badge
                              variant={event.confidence > 0.8 ? 'success' : 'warning'}
                              size="sm"
                            >
                              {(event.confidence * 100).toFixed(0)}%
                            </Badge>
                          )}
                        </div>

                        {/* Caption */}
                        <p className={`text-sm leading-relaxed ${
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        }`}>
                          {event.caption}
                        </p>

                        {/* Duration & Frames */}
                        {(event.duration || event.frame_count) && (
                          <div className="flex items-center gap-3 mt-2">
                            {event.duration && (
                              <span className={`text-xs flex items-center gap-1 ${
                                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                              }`}>
                                <Video className="w-3 h-3" />
                                {event.duration}s
                              </span>
                            )}
                            {event.frame_count && (
                              <span className={`text-xs flex items-center gap-1 ${
                                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                              }`}>
                                <Eye className="w-3 h-3" />
                                {event.frame_count} frames
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Expand Button */}
                      <button
                        className={`p-2 rounded-lg transition-colors ${
                          theme === 'dark'
                            ? 'hover:bg-slate-800 text-slate-400'
                            : 'hover:bg-slate-200 text-slate-600'
                        }`}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className={`px-4 pb-4 border-t ${
                      theme === 'dark' ? 'border-slate-700' : 'border-slate-200'
                    }`}>
                      <div className="pt-4 space-y-3">
                        <div className={`p-3 rounded-lg ${
                          theme === 'dark' ? 'bg-slate-800/50' : 'bg-white'
                        }`}>
                          <p className={`text-xs font-medium mb-2 ${
                            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                          }`}>
                            EVENT DETAILS
                          </p>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className={theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}>
                                Event ID:
                              </span>
                              <span className={`ml-2 font-mono ${
                                theme === 'dark' ? 'text-white' : 'text-slate-900'
                              }`}>
                                {event.id?.slice(0, 12)}
                              </span>
                            </div>
                            <div>
                              <span className={theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}>
                                Location:
                              </span>
                              <span className={`ml-2 ${
                                theme === 'dark' ? 'text-white' : 'text-slate-900'
                              }`}>
                                {event.camera_location || 'Unknown'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 flex-wrap">
                        <Button 
                            variant={theme === 'dark' ? 'outline' : 'primary'}
                            size="sm" 
                            icon={Download}
                            onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadEvent(event);
                            }}
                        >
                            Download
                        </Button>
                        
                        <div className="relative">
                            <Button 
                            variant={theme === 'dark' ? 'outline' : 'primary'}
                            size="sm" 
                            icon={Share2}
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowShareMenu(showShareMenu === eventKey ? null : eventKey);
                            }}
                            >
                            Share
                            </Button>
                            {showShareMenu === eventKey && (
                            <div 
                                className={`absolute bottom-full mb-2 left-0 rounded-lg border shadow-lg p-2 min-w-[150px] z-10 ${
                                theme === 'dark'
                                    ? 'bg-slate-800 border-slate-700'
                                    : 'bg-white border-slate-200'
                                }`}
                                onClick={(e) => e.stopPropagation()}
                            >
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
                            onClick={(e) => {
                            e.stopPropagation();
                            handleFullDetails(event.id);
                            }}
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
        </div>
      )}

      {/* No Results */}
      {!searching && searchQuery && searchResults.length === 0 && !error && (
        <div className={`rounded-xl border backdrop-blur-sm p-12 text-center ${
          theme === 'dark'
            ? 'bg-slate-800/50 border-slate-700'
            : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <Search className={`w-12 h-12 mx-auto mb-4 ${
            theme === 'dark' ? 'text-slate-600' : 'text-slate-300'
          }`} />
          <p className={`text-lg font-medium mb-2 ${
            theme === 'dark' ? 'text-white' : 'text-slate-900'
          }`}>
            No Events Found
          </p>
          <p className={`text-sm ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
          }`}>
            Try adjusting your search query or filters
          </p>
        </div>
      )}
    </div>
  );
}

export default EventSearch;