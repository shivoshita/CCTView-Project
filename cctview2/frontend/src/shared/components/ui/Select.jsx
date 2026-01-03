import React from 'react';
import { ChevronDown } from 'lucide-react';

const Select = ({ 
  label,
  value,
  onChange,
  options = [],
  placeholder = 'Select an option',
  error,
  disabled = false,
  required = false,
  className = ''
}) => {
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-slate-300 mb-2">
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        <select
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={`
            w-full px-4 py-2.5 pr-10
            bg-slate-900/50 
            border border-slate-700 
            rounded-lg 
            text-white 
            appearance-none
            focus:outline-none 
            focus:border-blue-500 
            focus:ring-2 
            focus:ring-blue-500/20
            disabled:opacity-50 
            disabled:cursor-not-allowed
            transition-all duration-200
            ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}
          `}
        >
          <option value="" disabled>{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <ChevronDown className="w-5 h-5 text-slate-400" />
        </div>
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

export default Select;