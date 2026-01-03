// FILE LOCATION: frontend/src/shared/components/ui/Input.jsx

import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const Input = ({ 
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  error,
  icon: Icon,
  disabled = false,
  required = false,
  className = '',
  ...props
}) => {
  const { theme } = useTheme();

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className={`block text-sm font-medium mb-2 ${
          theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
        }`}>
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <Icon className={`w-5 h-5 ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
            }`} />
          </div>
        )}
        
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          className={`
            w-full px-4 py-2.5 
            ${Icon ? 'pl-11' : 'pl-4'}
            ${theme === 'dark' 
              ? 'bg-slate-900/50 border-slate-700 text-white placeholder-slate-500' 
              : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
            }
            border 
            rounded-lg 
            focus:outline-none 
            focus:border-blue-500 
            focus:ring-2 
            focus:ring-blue-500/20
            disabled:opacity-50 
            disabled:cursor-not-allowed
            transition-all duration-200
            ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}
          `}
          {...props}
        />
      </div>
      
      {error && (
        <p className="mt-1.5 text-sm text-red-400 flex items-center gap-1">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
};

export default Input;