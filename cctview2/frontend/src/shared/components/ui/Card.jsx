import React from 'react';

const Card = ({ 
  children, 
  title, 
  subtitle,
  icon: Icon,
  action,
  className = '',
  hover = false,
  padding = 'default'
}) => {
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    default: 'p-6',
    lg: 'p-8'
  };

  const hoverClass = hover ? 'hover:border-slate-600 hover:shadow-xl transition-all duration-300' : '';

  return (
    <div className={`bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 shadow-lg ${hoverClass} ${paddingClasses[padding]} ${className}`}>
      {(title || Icon || action) && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Icon className="w-6 h-6 text-blue-400" />
              </div>
            )}
            <div>
              {title && <h3 className="text-lg font-semibold text-white">{title}</h3>}
              {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
};

export default Card;