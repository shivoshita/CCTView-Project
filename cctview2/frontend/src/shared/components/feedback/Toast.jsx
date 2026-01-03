// FILE LOCATION: frontend/src/shared/components/feedback/Toast.jsx

import React, { useState, useEffect } from 'react';
import { X, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

// Toast Container Component
export const ToastContainer = ({ toasts, removeToast }) => {
  const { theme } = useTheme();

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          {...toast}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
};

// Individual Toast Component
const Toast = ({ 
  id, 
  type = 'info', 
  title, 
  message, 
  duration = 5000, 
  onClose 
}) => {
  const { theme } = useTheme();
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onClose();
    }, 300);
  };

  const variants = {
    success: {
      icon: CheckCircle,
      iconColor: 'text-emerald-500',
      bg: theme === 'dark' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200',
      titleColor: theme === 'dark' ? 'text-emerald-400' : 'text-emerald-700',
      messageColor: theme === 'dark' ? 'text-emerald-300/80' : 'text-emerald-600',
    },
    error: {
      icon: XCircle,
      iconColor: 'text-red-500',
      bg: theme === 'dark' ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200',
      titleColor: theme === 'dark' ? 'text-red-400' : 'text-red-700',
      messageColor: theme === 'dark' ? 'text-red-300/80' : 'text-red-600',
    },
    warning: {
      icon: AlertTriangle,
      iconColor: 'text-amber-500',
      bg: theme === 'dark' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200',
      titleColor: theme === 'dark' ? 'text-amber-400' : 'text-amber-700',
      messageColor: theme === 'dark' ? 'text-amber-300/80' : 'text-amber-600',
    },
    info: {
      icon: Info,
      iconColor: 'text-blue-500',
      bg: theme === 'dark' ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200',
      titleColor: theme === 'dark' ? 'text-blue-400' : 'text-blue-700',
      messageColor: theme === 'dark' ? 'text-blue-300/80' : 'text-blue-600',
    },
  };

  const variant = variants[type] || variants.info;
  const Icon = variant.icon;

  if (!isVisible) return null;

  return (
    <div
      className={`
        flex items-start gap-3 p-4 rounded-lg border shadow-lg backdrop-blur-sm
        transform transition-all duration-300 ease-out
        ${variant.bg}
        ${isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
      `}
      style={{
        animation: isExiting ? 'none' : 'slideIn 0.3s ease-out'
      }}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${variant.iconColor}`} />
      
      <div className="flex-1 min-w-0">
        {title && (
          <p className={`font-semibold text-sm mb-1 ${variant.titleColor}`}>
            {title}
          </p>
        )}
        {message && (
          <p className={`text-sm ${variant.messageColor}`}>
            {message}
          </p>
        )}
      </div>

      <button
        onClick={handleClose}
        className={`flex-shrink-0 transition-colors p-1 rounded ${
          theme === 'dark'
            ? 'hover:bg-slate-700/50'
            : 'hover:bg-slate-200/50'
        }`}
      >
        <X className={`w-4 h-4 ${
          theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
        }`} />
      </button>

      {/* Progress bar */}
      {duration > 0 && (
        <div 
          className={`absolute bottom-0 left-0 h-1 bg-current rounded-b-lg ${variant.iconColor}`}
          style={{
            width: '100%',
            animation: `shrink ${duration}ms linear forwards`
          }}
        />
      )}
    </div>
  );
};

// Custom Hook for Toast Management
export const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const addToast = ({ type = 'info', title, message, duration = 5000 }) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, title, message, duration }]);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const toast = {
    success: (title, message, duration) => addToast({ type: 'success', title, message, duration }),
    error: (title, message, duration) => addToast({ type: 'error', title, message, duration }),
    warning: (title, message, duration) => addToast({ type: 'warning', title, message, duration }),
    info: (title, message, duration) => addToast({ type: 'info', title, message, duration }),
  };

  return { toasts, toast, removeToast };
};

// Add keyframes to global CSS
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes shrink {
    from {
      width: 100%;
    }
    to {
      width: 0%;
    }
  }
`;
document.head.appendChild(style);

export default Toast;