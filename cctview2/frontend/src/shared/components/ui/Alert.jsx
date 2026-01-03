import React from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

const Alert = ({ 
  variant = 'info',
  title,
  message,
  onClose,
  className = ''
}) => {
  const variants = {
    success: {
      bg: 'bg-emerald-500/10 border-emerald-500/30',
      icon: CheckCircle,
      iconColor: 'text-emerald-400',
      textColor: 'text-emerald-300'
    },
    error: {
      bg: 'bg-red-500/10 border-red-500/30',
      icon: AlertCircle,
      iconColor: 'text-red-400',
      textColor: 'text-red-300'
    },
    warning: {
      bg: 'bg-amber-500/10 border-amber-500/30',
      icon: AlertTriangle,
      iconColor: 'text-amber-400',
      textColor: 'text-amber-300'
    },
    info: {
      bg: 'bg-blue-500/10 border-blue-500/30',
      icon: Info,
      iconColor: 'text-blue-400',
      textColor: 'text-blue-300'
    }
  };

  const config = variants[variant];
  const Icon = config.icon;

  return (
    <div className={`${config.bg} border rounded-lg p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 ${config.iconColor} flex-shrink-0 mt-0.5`} />
        
        <div className="flex-1">
          {title && (
            <h4 className={`font-semibold ${config.textColor} mb-1`}>
              {title}
            </h4>
          )}
          {message && (
            <p className="text-sm text-slate-300">
              {message}
            </p>
          )}
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 hover:bg-slate-700/50 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default Alert;