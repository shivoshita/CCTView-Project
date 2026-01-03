import React from 'react';

const Badge = ({ 
  children, 
  variant = 'default',
  size = 'md',
  icon: Icon,
  dot = false,
  className = ''
}) => {
  const baseStyles = 'inline-flex items-center gap-1.5 font-medium rounded-full';
  
  const variants = {
    default: 'bg-slate-700 text-slate-300',
    primary: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    success: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    warning: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    danger: 'bg-red-500/20 text-red-400 border border-red-500/30',
    info: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
  };
  
  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base'
  };

  const dotColors = {
    default: 'bg-slate-400',
    primary: 'bg-blue-400',
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    danger: 'bg-red-400',
    info: 'bg-cyan-400'
  };
  
  return (
    <span className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}>
      {dot && <span className={`w-2 h-2 rounded-full ${dotColors[variant]} animate-pulse`}></span>}
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {children}
    </span>
  );
};

export default Badge;