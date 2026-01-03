// FILE LOCATION: frontend/src/pages/Cameras/components/AddCameraModal.jsx

import React, { useState } from 'react';
import { X, Camera, MapPin, Wifi, AlertCircle, Lock, User } from 'lucide-react';
import Modal from '../../../shared/components/ui/Modal';
import Button from '../../../shared/components/ui/Button';
import Alert from '../../../shared/components/ui/Alert';
import { useTheme } from '../../../shared/contexts/ThemeContext';
import cameraService from '../../../services/camera.service';

const AddCameraModal = ({ isOpen, onClose, onCameraAdded }) => {
  const { theme } = useTheme();
  
  const [streamType, setStreamType] = useState('http'); // 'http' or 'rtsp'
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    stream_url: '',
    description: '',
    rtsp_username: '',
    rtsp_password: '',
    rtsp_host: '',
    rtsp_port: '554',
    rtsp_path: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (error) setError(null);
  };

  const handleStreamTypeChange = (type) => {
    setStreamType(type);
    setFormData(prev => ({
      ...prev,
      stream_url: ''
    }));
    if (error) setError(null);
  };

  const validateURL = (url, type) => {
    if (type === 'http') {
      const pattern = /^(http|https):\/\/.+/;
      return pattern.test(url);
    } else {
      const pattern = /^rtsp:\/\/.+/;
      return pattern.test(url);
    }
  };

  const buildRTSPUrl = () => {
    const { rtsp_username, rtsp_password, rtsp_host, rtsp_port, rtsp_path } = formData;
    
    if (!rtsp_host) return '';
    
    let url = 'rtsp://';
    
    // Add credentials if provided
    if (rtsp_username) {
      url += encodeURIComponent(rtsp_username);
      if (rtsp_password) {
        url += ':' + encodeURIComponent(rtsp_password);
      }
      url += '@';
    }
    
    // Add host and port
    url += rtsp_host;
    if (rtsp_port && rtsp_port !== '554') {
      url += ':' + rtsp_port;
    }
    
    // Add path
    if (rtsp_path) {
      if (!rtsp_path.startsWith('/')) {
        url += '/';
      }
      url += rtsp_path;
    }
    
    return url;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Camera name is required');
      return;
    }

    let finalStreamUrl = '';

    if (streamType === 'http') {
      if (!formData.stream_url.trim()) {
        setError('Stream URL is required');
        return;
      }
      if (!validateURL(formData.stream_url, 'http')) {
        setError('Please enter a valid HTTP/HTTPS URL');
        return;
      }
      finalStreamUrl = formData.stream_url.trim();
    } else {
      // RTSP validation
      if (!formData.rtsp_host.trim()) {
        setError('RTSP host/IP address is required');
        return;
      }
      
      finalStreamUrl = buildRTSPUrl();
      
      if (!validateURL(finalStreamUrl, 'rtsp')) {
        setError('Invalid RTSP URL configuration');
        return;
      }
    }

    try {
      setLoading(true);
      
      const response = await cameraService.addCamera({
        name: formData.name.trim(),
        location: formData.location.trim() || 'Not specified',
        stream_url: finalStreamUrl,
        description: formData.description.trim(),
        stream_type: streamType,
        status: 'connecting'
      });

      setSuccess(true);
      
      if (onCameraAdded) {
        onCameraAdded(response.data);
      }

      setTimeout(() => {
        handleClose();
      }, 1500);

    } catch (err) {
      console.error('Error adding camera:', err);
      setError(err.response?.data?.detail || 'Failed to add camera. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      location: '',
      stream_url: '',
      description: '',
      rtsp_username: '',
      rtsp_password: '',
      rtsp_host: '',
      rtsp_port: '554',
      rtsp_path: ''
    });
    setStreamType('http');
    setError(null);
    setSuccess(false);
    onClose();
  };

  // Custom Input Component with Icon
  const InputField = ({ label, icon: Icon, required, ...props }) => (
    <div>
      <label className={`block text-sm font-medium mb-2 ${
        theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
      }`}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        {Icon && (
          <Icon className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
          }`} />
        )}
        <input
          {...props}
          className={`w-full ${Icon ? 'pl-11' : 'pl-4'} pr-4 py-2.5 border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed ${
            theme === 'dark'
              ? 'bg-slate-900/50 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
              : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500'
          }`}
        />
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add New Camera"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Success Alert */}
        {success && (
          <Alert
            variant="success"
            title="Camera Added Successfully!"
            message="Stream processing will begin shortly..."
          />
        )}

        {/* Error Alert */}
        {error && (
          <Alert
            variant="error"
            title="Error"
            message={error}
            onClose={() => setError(null)}
          />
        )}

        {/* Stream Type Selector */}
        <div>
          <label className={`block text-sm font-medium mb-2 ${
            theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
          }`}>
            Stream Type <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleStreamTypeChange('http')}
              disabled={loading || success}
              className={`px-4 py-3 rounded-lg border-2 font-medium transition-all ${
                streamType === 'http'
                  ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                  : theme === 'dark'
                    ? 'border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600'
                    : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
              } ${(loading || success) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <Wifi className="w-5 h-5 mx-auto mb-1" />
              HTTP/HTTPS
            </button>
            <button
              type="button"
              onClick={() => handleStreamTypeChange('rtsp')}
              disabled={loading || success}
              className={`px-4 py-3 rounded-lg border-2 font-medium transition-all ${
                streamType === 'rtsp'
                  ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                  : theme === 'dark'
                    ? 'border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600'
                    : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
              } ${(loading || success) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <Camera className="w-5 h-5 mx-auto mb-1" />
              RTSP
            </button>
          </div>
        </div>

        {/* Camera Name */}
        <InputField
          label="Camera Name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="e.g., Front Door Camera"
          icon={Camera}
          required
          disabled={loading || success}
        />

        {/* Location */}
        <InputField
          label="Location"
          name="location"
          value={formData.location}
          onChange={handleChange}
          placeholder="e.g., Main Entrance, Building A"
          icon={MapPin}
          disabled={loading || success}
        />

        {/* HTTP Stream URL */}
        {streamType === 'http' && (
          <div>
            <InputField
              label="Stream URL (HTTP)"
              name="stream_url"
              value={formData.stream_url}
              onChange={handleChange}
              placeholder="http://192.168.x.x:8080/video"
              icon={Wifi}
              required
              disabled={loading || success}
            />
            
            <div className={`mt-2 text-xs space-y-1 ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>
              <div className="flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium mb-1">For IP Webcam app:</p>
                  <ul className="space-y-0.5 ml-2">
                    <li className="font-mono text-xs">• http://192.168.1.100:8080/video</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* RTSP Configuration */}
        {streamType === 'rtsp' && (
          <div className="space-y-4">
            {/* RTSP Host */}
            <InputField
              label="IP Address / Host"
              name="rtsp_host"
              value={formData.rtsp_host}
              onChange={handleChange}
              placeholder="e.g., 172.20.20.195"
              icon={Wifi}
              required
              disabled={loading || success}
            />

            {/* Port */}
            <InputField
              label="Port"
              name="rtsp_port"
              type="number"
              value={formData.rtsp_port}
              onChange={handleChange}
              placeholder="554"
              disabled={loading || success}
            />

            {/* Username */}
            <InputField
              label="Username"
              name="rtsp_username"
              value={formData.rtsp_username}
              onChange={handleChange}
              placeholder="admin"
              icon={User}
              disabled={loading || success}
            />

            {/* Password */}
            <InputField
              label="Password"
              name="rtsp_password"
              type="password"
              value={formData.rtsp_password}
              onChange={handleChange}
              placeholder="password"
              icon={Lock}
              disabled={loading || success}
            />

            {/* Stream Path */}
            <InputField
              label="Stream Path"
              name="rtsp_path"
              value={formData.rtsp_path}
              onChange={handleChange}
              placeholder="/Streaming/Channels/101"
              disabled={loading || success}
            />

            {/* URL Preview */}
            {formData.rtsp_host && (
              <div className={`p-3 rounded-lg border ${
                theme === 'dark'
                  ? 'bg-slate-900/50 border-slate-700'
                  : 'bg-slate-50 border-slate-200'
              }`}>
                <p className={`text-xs font-medium mb-1 ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  Preview URL:
                </p>
                <code className={`text-xs break-all ${
                  theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                }`}>
                  {buildRTSPUrl() || 'rtsp://...'}
                </code>
              </div>
            )}

            {/* Help Text */}
            <div className={`text-xs space-y-1 ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>
              <div className="flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium mb-1">For Hikvision cameras:</p>
                  <ul className="space-y-0.5 ml-2">
                    <li>• Main stream: /Streaming/Channels/101</li>
                    <li>• Sub stream: /Streaming/Channels/102</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Description (Optional) */}
        <div>
          <label className={`block text-sm font-medium mb-2 ${
            theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
          }`}>
            Description (Optional)
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Add any additional notes about this camera..."
            rows={3}
            disabled={loading || success}
            className={`w-full px-4 py-2.5 border rounded-lg transition-all duration-200 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed ${
              theme === 'dark'
                ? 'bg-slate-900/50 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
                : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500'
            }`}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="ghost"
            fullWidth
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            fullWidth
            loading={loading}
            disabled={success}
          >
            {success ? 'Added!' : 'Add Camera'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AddCameraModal;