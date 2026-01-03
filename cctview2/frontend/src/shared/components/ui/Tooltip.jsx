import React, { useState } from 'react';

const Tooltip = ({ 
  children, 
  content, 
  position = 'top',
  className = '' 
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const positions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  const arrows = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-slate-700',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-slate-700',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-slate-700',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-slate-700'
  };

  return (
    <div 
      className={`relative inline-block ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      
      {isVisible && content && (
        <div className={`absolute z-50 ${positions[position]} pointer-events-none`}>
          <div className="bg-slate-700 text-white text-xs rounded-lg px-3 py-2 shadow-xl border border-slate-600 whitespace-nowrap">
            {content}
          </div>
          <div className={`absolute w-0 h-0 border-4 border-transparent ${arrows[position]}`}></div>
        </div>
      )}
    </div>
  );
};

export default Tooltip;