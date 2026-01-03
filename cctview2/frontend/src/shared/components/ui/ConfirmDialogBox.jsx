// FILE LOCATION: frontend/src/shared/components/ui/ConfirmDialogBox.jsx

import React from 'react';
import { X, AlertTriangle, Trash2, CheckCircle, Info } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const ConfirmDialogBox = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default', // 'default', 'danger', 'warning', 'success', 'info'
  loading = false,
}) => {
  const { theme } = useTheme();

  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: <Trash2 className="w-6 h-6" />,
          iconBg: theme === 'dark' ? 'bg-red-500/20' : 'bg-red-100',
          iconColor: 'text-red-500',
          buttonBg: 'bg-red-600 hover:bg-red-700',
          buttonText: 'text-white',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-6 h-6" />,
          iconBg: theme === 'dark' ? 'bg-yellow-500/20' : 'bg-yellow-100',
          iconColor: 'text-yellow-500',
          buttonBg: 'bg-yellow-600 hover:bg-yellow-700',
          buttonText: 'text-white',
        };
      case 'success':
        return {
          icon: <CheckCircle className="w-6 h-6" />,
          iconBg: theme === 'dark' ? 'bg-green-500/20' : 'bg-green-100',
          iconColor: 'text-green-500',
          buttonBg: 'bg-green-600 hover:bg-green-700',
          buttonText: 'text-white',
        };
      case 'info':
        return {
          icon: <Info className="w-6 h-6" />,
          iconBg: theme === 'dark' ? 'bg-blue-500/20' : 'bg-blue-100',
          iconColor: 'text-blue-500',
          buttonBg: 'bg-blue-600 hover:bg-blue-700',
          buttonText: 'text-white',
        };
      default:
        return {
          icon: <AlertTriangle className="w-6 h-6" />,
          iconBg: theme === 'dark' ? 'bg-slate-500/20' : 'bg-slate-100',
          iconColor: theme === 'dark' ? 'text-slate-400' : 'text-slate-600',
          buttonBg: theme === 'dark' ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-900 hover:bg-slate-800',
          buttonText: 'text-white',
        };
    }
  };

  const variantStyles = getVariantStyles();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={loading ? undefined : onClose}
      />

      {/* Dialog */}
      <div
        className={`relative w-full max-w-md rounded-xl shadow-2xl ${
          theme === 'dark'
            ? 'bg-slate-800 border border-slate-700'
            : 'bg-white border border-slate-200'
        }`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={loading}
          className={`absolute top-4 right-4 p-1 rounded-lg transition-colors ${
            theme === 'dark'
              ? 'hover:bg-slate-700 text-slate-400'
              : 'hover:bg-slate-100 text-slate-600'
          } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-6">
          {/* Icon */}
          <div className={`w-12 h-12 rounded-full ${variantStyles.iconBg} ${variantStyles.iconColor} flex items-center justify-center mb-4`}>
            {variantStyles.icon}
          </div>

          {/* Title */}
          <h3
            className={`text-xl font-bold mb-2 ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}
          >
            {title}
          </h3>

          {/* Message */}
          <p
            className={`text-sm mb-6 ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}
          >
            {message}
          </p>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors ${
                theme === 'dark'
                  ? 'bg-slate-700 hover:bg-slate-600 text-white'
                  : 'bg-slate-200 hover:bg-slate-300 text-slate-900'
              } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {cancelText}
            </button>

            <button
              onClick={onConfirm}
              disabled={loading}
              className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors ${variantStyles.buttonBg} ${variantStyles.buttonText} ${
                loading ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Loading...
                </span>
              ) : (
                confirmText
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialogBox;