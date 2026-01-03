import React from 'react';

const Loader = ({ 
  size = 'md', 
  variant = 'primary',
  text,
  fullScreen = false,
  className = ''
}) => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  const colors = {
    primary: 'border-blue-500',
    white: 'border-white',
    slate: 'border-slate-400'
  };

  const spinner = (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div className={`${sizes[size]} border-4 ${colors[variant]} border-t-transparent rounded-full animate-spin`}></div>
      {text && <p className="text-slate-400 text-sm font-medium">{text}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center z-50">
        {spinner}
      </div>
    );
  }

  return spinner;
};

export default Loader;