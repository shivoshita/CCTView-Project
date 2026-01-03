// FILE LOCATION: frontend/src/pages/Events/EventDetail.jsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  Clock,
  MapPin,
  Calendar,
  Eye,
  Video,
  Download,
  Share2,
  Play,
  AlertCircle,
  User,
  Activity,
  Hash,
  Shield,
  Maximize2,
  ExternalLink,
  Copy,
  Mail,
  MessageCircle,
  X
} from 'lucide-react';
import { useTheme } from '../../shared/contexts/ThemeContext';
import Button from '../../shared/components/ui/Button';
import Badge from '../../shared/components/ui/Badge';
import Loader from '../../shared/components/ui/Loader';
import eventService from '../../services/event.service';
import apiService from '../../services/api.service.js';

function EventDetail() {
  const { theme } = useTheme();
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [shareSuccess, setShareSuccess] = useState('');

  useEffect(() => {
    if (eventId) {
      fetchEventDetail();
    }
  }, [eventId]);

  const fetchEventDetail = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('📋 Fetching event detail:', eventId);
      const response = await apiService.get(`/events/${eventId}`);
      
      if (response.data.success) {
        setEvent(response.data.event);
        console.log('✅ Event loaded:', response.data.event);
      } else {
        setError('Event not found');
      }
    } catch (error) {
      console.error('❌ Error fetching event:', error);
      setError(error.response?.data?.detail || 'Failed to load event details');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  const handleDownload = () => {
    if (event) {
      eventService.downloadCSV([event], `event_${event.id}.csv`);
    }
  };

  const handleShare = (method) => {
    if (!event) return;

    const eventUrl = `${window.location.origin}/events/${event.id}`;
    const timestamp = formatTimestamp(event.timestamp || event.start_time);
    const shareText = `Event: ${event.caption}\nCamera: ${event.camera?.name || 'Unknown'}\nLocation: ${event.camera?.location || 'Unknown'}\nTime: ${timestamp.date} ${timestamp.time}`;

    switch(method) {
      case 'whatsapp':
        window.open(`https://wa.me/?text=${encodeURIComponent(shareText + '\n' + eventUrl)}`, '_blank');
        break;
      case 'email':
        const subject = `Event Share - ${event.camera?.name || 'Camera'} - ${timestamp.date}`;
        const body = encodeURIComponent(shareText + '\n\n' + eventUrl);
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
        break;
      case 'copy':
        navigator.clipboard.writeText(eventUrl).then(() => {
          setShareSuccess('Link copied to clipboard!');
          setTimeout(() => setShareSuccess(''), 3000);
        }).catch(() => {
          setShareSuccess('Failed to copy link');
          setTimeout(() => setShareSuccess(''), 3000);
        });
        break;
    }
    setShowShareMenu(false);
  };

  const formatTimestamp = (timestamp) => {
    return eventService.formatTimestamp(timestamp);
  };

  const calculateDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return null;
    return eventService.calculateDuration(startTime, endTime);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <Loader size="lg" />
        <p className={`mt-4 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
          Loading event details...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <AlertCircle className={`w-12 h-12 mb-4 ${
          theme === 'dark' ? 'text-red-400' : 'text-red-600'
        }`} />
        <p className={`text-lg font-medium mb-2 ${
          theme === 'dark' ? 'text-white' : 'text-slate-900'
        }`}>
          {error}
        </p>
        <Button onClick={handleBack} variant="primary" icon={ArrowLeft}>
          Go Back
        </Button>
      </div>
    );
  }

  if (!event) {
    return null;
  }

  const timestamp = formatTimestamp(event.timestamp || event.start_time);
  const duration = calculateDuration(event.start_time, event.end_time);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}
            icon={ArrowLeft}
            onClick={handleBack}
          >
            Back
          </Button>
          <div>
            <h1 className={`text-3xl font-bold ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>
              Event Details
            </h1>
            <p className={`text-sm mt-1 ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>
              Event ID: {event.id}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={theme === 'dark' ? 'outline' : 'primary'}
            icon={Download}
            onClick={handleDownload}
            size="sm"
          >
            Download
          </Button>
          <div className="relative">
            <Button
              variant={theme === 'dark' ? 'outline' : 'primary'}
              icon={Share2}
              onClick={() => setShowShareMenu(!showShareMenu)}
              size="sm"
            >
              Share
            </Button>
            
            {/* Share Menu Dropdown */}
            {showShareMenu && (
              <div className={`absolute top-full mt-2 right-0 rounded-lg border shadow-lg p-2 min-w-[180px] z-10 ${
                theme === 'dark'
                  ? 'bg-slate-800 border-slate-700'
                  : 'bg-white border-slate-200'
              }`}>
                <button
                  onClick={() => handleShare('whatsapp')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    theme === 'dark'
                      ? 'hover:bg-slate-700 text-white'
                      : 'hover:bg-slate-100 text-slate-900'
                  }`}
                >
                  <MessageCircle className="w-4 h-4 text-green-500" />
                  Share via WhatsApp
                </button>
                <button
                  onClick={() => handleShare('email')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    theme === 'dark'
                      ? 'hover:bg-slate-700 text-white'
                      : 'hover:bg-slate-100 text-slate-900'
                  }`}
                >
                  <Mail className="w-4 h-4 text-blue-500" />
                  Share via Email
                </button>
                <button
                  onClick={() => handleShare('copy')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    theme === 'dark'
                      ? 'hover:bg-slate-700 text-white'
                      : 'hover:bg-slate-100 text-slate-900'
                  }`}
                >
                  <Copy className="w-4 h-4 text-purple-500" />
                  Copy Link
                </button>
              </div>
            )}
          </div>
        </div>
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

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Event Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Video/Image Card */}
          <div className={`rounded-xl border backdrop-blur-sm overflow-hidden ${
            theme === 'dark'
              ? 'bg-slate-800/50 border-slate-700'
              : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className={`aspect-video flex items-center justify-center ${
              theme === 'dark' ? 'bg-slate-900' : 'bg-slate-100'
            }`}>
              <div className="text-center">
                <Play className={`w-16 h-16 mx-auto mb-4 ${
                  theme === 'dark' ? 'text-slate-600' : 'text-slate-300'
                }`} />
                <p className={`text-sm ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  Video playback will be implemented here
                </p>
                {event.video_reference && (
                  <Button
                    variant="primary"
                    icon={ExternalLink}
                    className="mt-4"
                    size="sm"
                  >
                    View in CCTV System
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Caption Card */}
          <div className={`rounded-xl border backdrop-blur-sm p-6 ${
            theme === 'dark'
              ? 'bg-slate-800/50 border-slate-700'
              : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-start gap-3 mb-4">
              <div className={`p-2 rounded-lg ${
                theme === 'dark' ? 'bg-blue-500/10' : 'bg-blue-50'
              }`}>
                <Activity className={`w-5 h-5 ${
                  theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                }`} />
              </div>
              <div className="flex-1">
                <h2 className={`text-lg font-semibold mb-2 ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  Event Description
                </h2>
                <p className={`text-base leading-relaxed ${
                  theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  {event.caption || 'No description available'}
                </p>
              </div>
            </div>

            {/* Confidence Score */}
            {event.confidence && (
              <div className={`mt-4 pt-4 border-t ${
                theme === 'dark' ? 'border-slate-700' : 'border-slate-200'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-medium ${
                    theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    AI Confidence
                  </span>
                  <span className={`text-sm font-bold ${
                    event.confidence > 0.8
                      ? 'text-emerald-500'
                      : event.confidence > 0.6
                        ? 'text-amber-500'
                        : 'text-red-500'
                  }`}>
                    {(event.confidence * 100).toFixed(1)}%
                  </span>
                </div>
                <div className={`h-2 rounded-full overflow-hidden ${
                  theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'
                }`}>
                  <div
                    className={`h-full transition-all ${
                      event.confidence > 0.8
                        ? 'bg-emerald-500'
                        : event.confidence > 0.6
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                    }`}
                    style={{ width: `${event.confidence * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Additional Details */}
          {(event.tracked_persons?.length > 0 || event.anomalies?.length > 0) && (
            <div className={`rounded-xl border backdrop-blur-sm p-6 ${
              theme === 'dark'
                ? 'bg-slate-800/50 border-slate-700'
                : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <h2 className={`text-lg font-semibold mb-4 ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                Additional Information
              </h2>

              {/* Tracked Persons */}
              {event.tracked_persons?.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <User className={`w-4 h-4 ${
                      theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                    }`} />
                    <span className={`text-sm font-medium ${
                      theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                    }`}>
                      Tracked Persons
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {event.tracked_persons.map((personId, index) => (
                      <Badge key={index} variant="info" size="sm">
                        {personId}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Anomalies */}
              {event.anomalies?.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className={`w-4 h-4 ${
                      theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
                    }`} />
                    <span className={`text-sm font-medium ${
                      theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                    }`}>
                      Anomalies Detected
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {event.anomalies.map((anomalyId, index) => (
                      <Badge key={index} variant="warning" size="sm">
                        {anomalyId}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column - Metadata */}
        <div className="space-y-6">
          {/* Camera Info */}
          <div className={`rounded-xl border backdrop-blur-sm p-6 ${
            theme === 'dark'
              ? 'bg-slate-800/50 border-slate-700'
              : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-lg ${
                theme === 'dark' ? 'bg-blue-500/10' : 'bg-blue-50'
              }`}>
                <Camera className={`w-5 h-5 ${
                  theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                }`} />
              </div>
              <h3 className={`font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                Camera Information
              </h3>
            </div>

            <div className="space-y-3">
              <div>
                <p className={`text-xs font-medium mb-1 ${
                  theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                }`}>
                  Camera Name
                </p>
                <p className={`text-sm font-medium ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  {event.camera?.name || 'Unknown Camera'}
                </p>
              </div>

              {event.camera?.location && (
                <div>
                  <p className={`text-xs font-medium mb-1 ${
                    theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                  }`}>
                    Location
                  </p>
                  <div className="flex items-center gap-1">
                    <MapPin className={`w-3 h-3 ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                    }`} />
                    <p className={`text-sm ${
                      theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                    }`}>
                      {event.camera.location}
                    </p>
                  </div>
                </div>
              )}

              {event.camera?.id && (
                <div>
                  <p className={`text-xs font-medium mb-1 ${
                    theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                  }`}>
                    Camera ID
                  </p>
                  <p className={`text-xs font-mono ${
                    theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    {event.camera.id}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Time Information */}
          <div className={`rounded-xl border backdrop-blur-sm p-6 ${
            theme === 'dark'
              ? 'bg-slate-800/50 border-slate-700'
              : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-lg ${
                theme === 'dark' ? 'bg-emerald-500/10' : 'bg-emerald-50'
              }`}>
                <Clock className={`w-5 h-5 ${
                  theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                }`} />
              </div>
              <h3 className={`font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                Time Information
              </h3>
            </div>

            <div className="space-y-3">
              <div>
                <p className={`text-xs font-medium mb-1 ${
                  theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                }`}>
                  Date
                </p>
                <p className={`text-sm font-medium ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  {timestamp.date}
                </p>
              </div>

              <div>
                <p className={`text-xs font-medium mb-1 ${
                  theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                }`}>
                  Time
                </p>
                <p className={`text-sm font-medium ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  {timestamp.time}
                </p>
              </div>

              <div>
                <p className={`text-xs font-medium mb-1 ${
                  theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                }`}>
                  Relative Time
                </p>
                <p className={`text-sm ${
                  theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  {timestamp.relative}
                </p>
              </div>

              {duration && (
                <div>
                  <p className={`text-xs font-medium mb-1 ${
                    theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                  }`}>
                    Duration
                  </p>
                  <p className={`text-sm font-medium ${
                    theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                  }`}>
                    {duration.formatted}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Event Metadata */}
          <div className={`rounded-xl border backdrop-blur-sm p-6 ${
            theme === 'dark'
              ? 'bg-slate-800/50 border-slate-700'
              : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-lg ${
                theme === 'dark' ? 'bg-purple-500/10' : 'bg-purple-50'
              }`}>
                <Hash className={`w-5 h-5 ${
                  theme === 'dark' ? 'text-purple-400' : 'text-purple-600'
                }`} />
              </div>
              <h3 className={`font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                Metadata
              </h3>
            </div>

            <div className="space-y-3">
              {event.frame_count && (
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${
                    theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    Frames Analyzed
                  </span>
                  <Badge variant="default" size="sm">
                    <Eye className="w-3 h-3 mr-1" />
                    {event.frame_count}
                  </Badge>
                </div>
              )}

              {event.duration && (
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${
                    theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    Video Duration
                  </span>
                  <Badge variant="default" size="sm">
                    <Video className="w-3 h-3 mr-1" />
                    {event.duration}s
                  </Badge>
                </div>
              )}

              {event.retention_until && (
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${
                    theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    Retention Until
                  </span>
                  <Badge variant="warning" size="sm">
                    <Shield className="w-3 h-3 mr-1" />
                    {new Date(event.retention_until).toLocaleDateString()}
                  </Badge>
                </div>
              )}

              <div className={`pt-3 border-t ${
                theme === 'dark' ? 'border-slate-700' : 'border-slate-200'
              }`}>
                <p className={`text-xs font-medium mb-2 ${
                  theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                }`}>
                  Event ID
                </p>
                <p className={`text-xs font-mono break-all ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  {event.id}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EventDetail;