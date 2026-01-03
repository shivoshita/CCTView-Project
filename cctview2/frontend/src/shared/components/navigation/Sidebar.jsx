// FILE LOCATION: frontend/src/shared/components/navigation/Sidebar.jsx

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Camera, 
  Calendar,
  Users,
  AlertTriangle,
  Bell,
  MessageSquare,
  Settings,
  Video,
  Sparkles
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import Badge from '../ui/Badge';

const Sidebar = ({ isOpen, onClose }) => {
  const location = useLocation();
  const { theme } = useTheme();

  const menuItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/cameras', icon: Camera, label: 'Cameras' },
    { path: '/chat', icon: MessageSquare, label: 'AI Chat', badge: 'NEW', badgeVariant: 'info' },
    { path: '/events', icon: Calendar, label: 'Events' },
    { path: '/person-tracking', icon: Users, label: 'Person Tracking' },
    { path: '/anomalies', icon: AlertTriangle, label: 'Anomalies' },
    { path: '/alerts', icon: Bell, label: 'Alerts' },
    { path: '/settings', icon: Settings, label: 'Settings' }
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed top-0 left-0 h-full w-64 backdrop-blur-md border-r 
          transform transition-all duration-300 ease-in-out z-50
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${theme === 'dark' 
            ? 'bg-slate-800/95 border-slate-700' 
            : 'bg-white/95 border-slate-200'
          }
        `}
      >
        {/* Logo */}
        <div className={`flex items-center gap-3 px-6 py-5 border-b ${
          theme === 'dark' ? 'border-slate-700' : 'border-slate-200'
        }`}>
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <Video className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              CCTView
            </h1>
            <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
              AI Surveillance
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="px-3 py-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 relative
                  ${active 
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' 
                    : theme === 'dark'
                      ? 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }
                `}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium flex-1">{item.label}</span>
                
                {/* Badge for new features */}
                {item.badge && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    active
                      ? 'bg-white/20 text-white'
                      : theme === 'dark'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-blue-100 text-blue-600'
                  }`}>
                    {item.badge}
                  </span>
                )}
                
                {/* Sparkle effect for AI Chat */}
                {item.path === '/chat' && !active && (
                  <Sparkles className={`w-3 h-3 ${
                    theme === 'dark' ? 'text-blue-400' : 'text-blue-500'
                  }`} />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className={`absolute bottom-0 left-0 right-0 p-4 border-t ${
          theme === 'dark' ? 'border-slate-700' : 'border-slate-200'
        }`}>
          <div className={`rounded-lg p-3 ${
            theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-100'
          }`}>
            <p className={`text-xs mb-1 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
              System Status
            </p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
              <span className="text-sm text-emerald-400 font-medium">All Systems Operational</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;