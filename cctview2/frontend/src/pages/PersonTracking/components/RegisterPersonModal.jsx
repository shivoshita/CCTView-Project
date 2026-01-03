// FILE LOCATION: frontend/src/pages/PersonTracking/components/RegisterPersonModal.jsx

import React, { useState, useRef, useEffect } from 'react';
import { Camera, User, CheckCircle, XCircle, AlertCircle, Loader, X, Upload, Image as ImageIcon } from 'lucide-react';
import Modal from '../../../shared/components/ui/Modal';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import { useTheme } from '../../../shared/contexts/ThemeContext';

const RegisterPersonModal = ({ isOpen, onClose, onSuccess }) => {
  const { theme } = useTheme();
  const [step, setStep] = useState('idle'); // idle, camera, capture, upload, form, processing, success, error
  const [captureMode, setCaptureMode] = useState(null); // 'camera' or 'upload'
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [capturedImageUrl, setCapturedImageUrl] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    employeeId: '',
    office: '',
    bloodGroup: ''
  });
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Start camera
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: false
      });
      
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setCaptureMode('camera');
      setStep('camera');
      setError('');
    } catch (err) {
      console.error('Camera error:', err);
      setError('Failed to access camera. Please check camera permissions or try uploading a photo instead.');
      setStep('error');
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  // Capture photo from camera
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);
    
    canvas.toBlob((blob) => {
      setCapturedImage(blob);
      setCapturedImageUrl(URL.createObjectURL(blob));
      setStep('form');
      stopCamera();
    }, 'image/jpeg', 0.95);
  };

  // Handle file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image size should be less than 10MB');
      return;
    }

    setCapturedImage(file);
    setCapturedImageUrl(URL.createObjectURL(file));
    setCaptureMode('upload');
    setStep('form');
    setError('');
  };

  // Trigger file input
  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  // Retake/reupload photo
  const retakePhoto = () => {
    if (capturedImageUrl) {
      URL.revokeObjectURL(capturedImageUrl);
    }
    setCapturedImage(null);
    setCapturedImageUrl(null);
    setCaptureMode(null);
    setFormData({ name: '', employeeId: '', office: '', bloodGroup: '' });
    setStep('idle');
  };

  // Handle form input
  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Submit registration
  const handleSubmit = async () => {
    // Validate form
    if (!formData.name || !formData.employeeId || !formData.office || !formData.bloodGroup) {
      setError('Please fill all fields');
      return;
    }

    setProcessing(true);
    setStep('processing');
    
    try {
      // Create FormData for multipart upload
      const formDataToSend = new FormData();
      formDataToSend.append('image', capturedImage, 'face.jpg');
      formDataToSend.append('name', formData.name);
      formDataToSend.append('employee_id', formData.employeeId);
      formDataToSend.append('office', formData.office);
      formDataToSend.append('blood_group', formData.bloodGroup);

      const token = localStorage.getItem('token');
      const response = await fetch('/api/v1/persons/register', {
        method: 'POST',
        body: formDataToSend,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Registration failed');
      }

      const result = await response.json();
      console.log('✅ Registration successful:', result);
      
      setStep('success');
      
      // Call success callback after 2 seconds
      setTimeout(() => {
        if (onSuccess) onSuccess(result);
        handleClose();
      }, 2000);
      
    } catch (err) {
      console.error('❌ Registration error:', err);
      setError(err.message || 'Failed to register person. Please try again.');
      setStep('error');
    } finally {
      setProcessing(false);
    }
  };

  // Handle modal close
  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Reset form
  const resetForm = () => {
    setStep('idle');
    setCaptureMode(null);
    stopCamera();
    if (capturedImageUrl) {
      URL.revokeObjectURL(capturedImageUrl);
    }
    setCapturedImage(null);
    setCapturedImageUrl(null);
    setFormData({ name: '', employeeId: '', office: '', bloodGroup: '' });
    setError('');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (capturedImageUrl) {
        URL.revokeObjectURL(capturedImageUrl);
      }
    };
  }, [capturedImageUrl]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg">
      <div className={`${theme === 'dark' ? 'bg-slate-800' : 'bg-white'}`}>
        {/* Hidden canvas for capturing */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />

        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${
          theme === 'dark' ? 'border-slate-700' : 'border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              theme === 'dark' ? 'bg-blue-500/20' : 'bg-blue-100'
            }`}>
              <User className={`w-5 h-5 ${
                theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
              }`} />
            </div>
            <div>
              <h2 className={`text-xl font-bold ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                Register New Person
              </h2>
              <p className={`text-sm ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
              }`}>
                Capture or upload face photo
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className={`p-2 rounded-lg transition-colors ${
              theme === 'dark' 
                ? 'hover:bg-slate-700 text-slate-400' 
                : 'hover:bg-slate-100 text-slate-600'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          
          {/* IDLE STATE - Choose capture method */}
          {step === 'idle' && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className={`text-lg font-semibold mb-2 ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  Choose Photo Method
                </h3>
                <p className={`mb-6 ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  Select how you want to provide the person's photo
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {/* Camera Option */}
                <button
                  onClick={startCamera}
                  className={`p-6 rounded-xl border-2 transition-all hover:scale-105 ${
                    theme === 'dark'
                      ? 'border-slate-700 bg-slate-700/30 hover:border-blue-500 hover:bg-slate-700/50'
                      : 'border-slate-200 bg-slate-50 hover:border-blue-500 hover:bg-blue-50'
                  }`}
                >
                  <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
                    theme === 'dark' ? 'bg-blue-500/20' : 'bg-blue-100'
                  }`}>
                    <Camera className={`w-8 h-8 ${
                      theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                    }`} />
                  </div>
                  <h4 className={`text-lg font-semibold mb-2 ${
                    theme === 'dark' ? 'text-white' : 'text-slate-900'
                  }`}>
                    Use Camera
                  </h4>
                  <p className={`text-sm ${
                    theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    Capture live photo from your device camera
                  </p>
                </button>

                {/* Upload Option */}
                <button
                  onClick={triggerFileUpload}
                  className={`p-6 rounded-xl border-2 transition-all hover:scale-105 ${
                    theme === 'dark'
                      ? 'border-slate-700 bg-slate-700/30 hover:border-emerald-500 hover:bg-slate-700/50'
                      : 'border-slate-200 bg-slate-50 hover:border-emerald-500 hover:bg-emerald-50'
                  }`}
                >
                  <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
                    theme === 'dark' ? 'bg-emerald-500/20' : 'bg-emerald-100'
                  }`}>
                    <Upload className={`w-8 h-8 ${
                      theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                    }`} />
                  </div>
                  <h4 className={`text-lg font-semibold mb-2 ${
                    theme === 'dark' ? 'text-white' : 'text-slate-900'
                  }`}>
                    Upload Photo
                  </h4>
                  <p className={`text-sm ${
                    theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    Select an existing photo from your device
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* CAMERA STATE */}
          {step === 'camera' && (
            <div className="space-y-4">
              <div className={`relative rounded-xl overflow-hidden border ${
                theme === 'dark' ? 'border-slate-700' : 'border-slate-300'
              }`}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-[400px] object-cover bg-black"
                />
                
                {/* Face Guide Overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative w-48 h-64 border-2 border-blue-400 rounded-full opacity-50">
                    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-slate-900/90 px-3 py-1 rounded-full">
                      <span className="text-blue-400 text-xs font-semibold">Align your face</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3 justify-center">
                <Button onClick={capturePhoto} variant="primary" icon={Camera}>
                  Capture Photo
                </Button>
                <Button onClick={handleClose} variant="ghost">
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* FORM STATE */}
          {step === 'form' && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Left: Captured/Uploaded Image */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className={`text-sm font-semibold ${
                    theme === 'dark' ? 'text-white' : 'text-slate-900'
                  }`}>
                    {captureMode === 'camera' ? 'Captured Photo' : 'Uploaded Photo'}
                  </h3>
                  <div className={`px-2 py-1 rounded-md text-xs font-medium ${
                    captureMode === 'camera'
                      ? theme === 'dark' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'
                      : theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {captureMode === 'camera' ? (
                      <span className="flex items-center gap-1">
                        <Camera className="w-3 h-3" /> Camera
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <ImageIcon className="w-3 h-3" /> Upload
                      </span>
                    )}
                  </div>
                </div>
                <div className={`relative rounded-xl overflow-hidden border ${
                  theme === 'dark' ? 'border-slate-700' : 'border-slate-300'
                }`}>
                  <img
                    src={capturedImageUrl}
                    alt="Person"
                    className="w-full h-[320px] object-cover"
                  />
                </div>
                <Button onClick={retakePhoto} variant="ghost" size="sm" fullWidth>
                  {captureMode === 'camera' ? 'Retake Photo' : 'Choose Different Photo'}
                </Button>
              </div>

              {/* Right: Form */}
              <div className="space-y-4">
                <h3 className={`text-sm font-semibold ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  Personal Information
                </h3>
                
                <Input
                  label="Full Name *"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="John Doe"
                />

                <Input
                  label="Employee ID *"
                  value={formData.employeeId}
                  onChange={(e) => handleInputChange('employeeId', e.target.value)}
                  placeholder="EMP001"
                />

                <Input
                  label="Office *"
                  value={formData.office}
                  onChange={(e) => handleInputChange('office', e.target.value)}
                  placeholder="Building A, Floor 3"
                />

                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                  }`}>
                    Blood Group *
                  </label>
                  <select
                    value={formData.bloodGroup}
                    onChange={(e) => handleInputChange('bloodGroup', e.target.value)}
                    className={`w-full px-4 py-2 rounded-lg border transition-all ${
                      theme === 'dark'
                        ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500'
                        : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                    } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                  >
                    <option value="">Select blood group</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-red-400" />
                    <span className="text-sm text-red-400">{error}</span>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button onClick={handleSubmit} variant="primary" fullWidth>
                    Register Person
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* PROCESSING STATE */}
          {step === 'processing' && (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 mb-4">
                <Loader className="w-12 h-12 text-blue-400 animate-spin" />
              </div>
              <h3 className={`text-lg font-semibold mb-2 ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                Processing Registration
              </h3>
              <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
                Extracting face features and saving data...
              </p>
            </div>
          )}

          {/* SUCCESS STATE */}
          {step === 'success' && (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/20 rounded-full mb-4">
                <CheckCircle className="w-10 h-10 text-emerald-400" />
              </div>
              <h3 className={`text-lg font-semibold mb-2 ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                Registration Successful!
              </h3>
              <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
                Person has been registered successfully
              </p>
            </div>
          )}

          {/* ERROR STATE */}
          {step === 'error' && (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/20 rounded-full mb-4">
                <XCircle className="w-10 h-10 text-red-400" />
              </div>
              <h3 className={`text-lg font-semibold mb-2 ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                Registration Failed
              </h3>
              <p className={`mb-6 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                {error}
              </p>
              <Button onClick={() => setStep('idle')} variant="primary">
                Try Again
              </Button>
            </div>
          )}

        </div>
      </div>
    </Modal>
  );
};

export default RegisterPersonModal;