// FILE LOCATION: frontend/src/shared/components/ui/ConfirmDialog.jsx

import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import Button from './Button';

const ConfirmDialog = ({ 
  isOpen, 
  onClose, 
  onConfirm,
  title = "Confirm Action",
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger", // "danger", "warning", "info"
  loading = false,
  children
}) => {
  const { theme } = useTheme();

  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: 'text-red-500',
      button: 'danger'
    },
    warning: {
      icon: 'text-amber-500',
      button: 'warning'
    },
    info: {
      icon: 'text-blue-500',
      button: 'primary'
    }
  };

  const style = variantStyles[variant] || variantStyles.danger;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={loading ? undefined : onClose}
      />
      
      {/* Dialog */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div 
          className={`relative max-w-md w-full rounded-xl shadow-2xl border transform transition-all ${
            theme === 'dark'
              ? 'bg-slate-800 border-slate-700'
              : 'bg-white border-slate-200'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`flex items-center justify-between px-6 py-4 border-b ${
            theme === 'dark' ? 'border-slate-700' : 'border-slate-200'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-100'
              }`}>
                <AlertTriangle className={`w-5 h-5 ${style.icon}`} />
              </div>
              <h2 className={`text-lg font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                {title}
              </h2>
            </div>
            {!loading && (
              <button
                onClick={onClose}
                className={`transition-colors p-1 rounded-lg ${
                  theme === 'dark'
                    ? 'text-slate-400 hover:text-white hover:bg-slate-700'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          
          {/* Content */}
          <div className="px-6 py-4">
            {message && (
              <p className={`text-sm mb-4 ${
                theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
              }`}>
                {message}
              </p>
            )}
            {children}
          </div>

          {/* Actions */}
          <div className={`flex gap-3 px-6 py-4 border-t ${
            theme === 'dark' ? 'border-slate-700' : 'border-slate-200'
          }`}>
            <Button
              variant="ghost"
              fullWidth
              onClick={onClose}
              disabled={loading}
            >
              {cancelText}
            </Button>
            <Button
              variant={style.button}
              fullWidth
              onClick={onConfirm}
              loading={loading}
            >
              {confirmText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;