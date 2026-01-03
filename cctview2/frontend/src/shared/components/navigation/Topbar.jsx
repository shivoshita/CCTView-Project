import React, { useState } from 'react';
import { Menu, Bell, Search, User, ChevronDown, Moon, Sun } from 'lucide-react';
import Badge from '../ui/Badge';
import { useTheme } from '../../contexts/ThemeContext';

const Topbar = ({ onMenuClick }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const { theme, toggleTheme } = useTheme();

  // Mock notifications
  const notifications = [
    { id: 1, type: 'warning', message: 'Unusual activity detected in Camera 3', time: '2 min ago' },
    { id: 2, type: 'success', message: 'Person tracking updated', time: '15 min ago' },
    { id: 3, type: 'info', message: 'System backup completed', time: '1 hour ago' }
  ];

  const unreadCount = 3;

  return (
    <header className={`sticky top-0 z-30 backdrop-blur-md border-b transition-colors duration-300 ${
      theme === 'dark'
        ? 'bg-slate-800/95 border-slate-700'
        : 'bg-white/95 border-slate-200'
    }`}>
      <div className="flex items-center justify-between px-4 lg:px-6 py-3">
        {/* Left Section */}
        <div className="flex items-center gap-4">
          {/* Mobile Menu Button */}
          <button
            onClick={onMenuClick}
            className={`lg:hidden p-2 rounded-lg transition-colors ${
              theme === 'dark' 
                ? 'hover:bg-slate-700 text-slate-300' 
                : 'hover:bg-slate-100 text-slate-700'
            }`}
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Search Bar */}
          <div className={`hidden md:flex items-center gap-2 rounded-lg px-4 py-2 w-80 ${
            theme === 'dark'
              ? 'bg-slate-900/50'
              : 'bg-slate-100'
          }`}>
            <Search className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} />
            <input
              type="text"
              placeholder="Search cameras, events, persons..."
              className={`bg-transparent border-none outline-none text-sm w-full ${
                theme === 'dark'
                  ? 'text-white placeholder-slate-500'
                  : 'text-slate-900 placeholder-slate-400'
              }`}
            />
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-3">
          {/* Search Button (Mobile) */}
          <button className={`md:hidden p-2 rounded-lg transition-colors ${
            theme === 'dark'
              ? 'hover:bg-slate-700 text-slate-300'
              : 'hover:bg-slate-100 text-slate-700'
          }`}>
            <Search className="w-5 h-5" />
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-lg transition-all duration-300 ${
              theme === 'dark'
                ? 'hover:bg-slate-700 text-slate-300'
                : 'hover:bg-slate-100 text-slate-700'
            }`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className={`relative p-2 rounded-lg transition-colors ${
                theme === 'dark'
                  ? 'hover:bg-slate-700 text-slate-300'
                  : 'hover:bg-slate-100 text-slate-700'
              }`}
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowNotifications(false)}
                />
                <div className={`absolute right-0 mt-2 w-80 rounded-lg shadow-xl z-20 border ${
                  theme === 'dark'
                    ? 'bg-slate-800 border-slate-700'
                    : 'bg-white border-slate-200'
                }`}>
                  <div className={`px-4 py-3 border-b flex items-center justify-between ${
                    theme === 'dark' ? 'border-slate-700' : 'border-slate-200'
                  }`}>
                    <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      Notifications
                    </h3>
                    <Badge variant="primary" size="sm">{unreadCount} new</Badge>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`px-4 py-3 transition-colors border-b cursor-pointer ${
                          theme === 'dark'
                            ? 'hover:bg-slate-700/50 border-slate-700/50'
                            : 'hover:bg-slate-50 border-slate-200/50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-2 h-2 rounded-full mt-2 ${
                            notif.type === 'warning' ? 'bg-amber-400' :
                            notif.type === 'success' ? 'bg-emerald-400' :
                            'bg-blue-400'
                          }`} />
                          <div className="flex-1">
                            <p className={`text-sm ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                              {notif.message}
                            </p>
                            <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                              {notif.time}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className={`px-4 py-3 border-t text-center ${
                    theme === 'dark' ? 'border-slate-700' : 'border-slate-200'
                  }`}>
                    <button className="text-sm text-blue-400 hover:text-blue-300 font-medium">
                      View all notifications
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Profile */}
          <div className="relative">
            <button
              onClick={() => setShowProfile(!showProfile)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 transition-colors ${
                theme === 'dark'
                  ? 'hover:bg-slate-700'
                  : 'hover:bg-slate-100'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="hidden lg:block text-left">
                <p className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  Admin User
                </p>
                <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                  Administrator
                </p>
              </div>
              <ChevronDown className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} />
            </button>

            {/* Profile Dropdown */}
            {showProfile && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowProfile(false)}
                />
                <div className={`absolute right-0 mt-2 w-56 rounded-lg shadow-xl z-20 border ${
                  theme === 'dark'
                    ? 'bg-slate-800 border-slate-700'
                    : 'bg-white border-slate-200'
                }`}>
                  <div className={`px-4 py-3 border-b ${
                    theme === 'dark' ? 'border-slate-700' : 'border-slate-200'
                  }`}>
                    <p className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                      Admin User
                    </p>
                    <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                      admin@cctview.com
                    </p>
                  </div>
                  <div className="py-2">
                    <button className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                      theme === 'dark'
                        ? 'text-slate-300 hover:bg-slate-700'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}>
                      Profile Settings
                    </button>
                    <button className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                      theme === 'dark'
                        ? 'text-slate-300 hover:bg-slate-700'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}>
                      Preferences
                    </button>
                  </div>
                  <div className={`border-t py-2 ${theme === 'dark' ? 'border-slate-700' : 'border-slate-200'}`}>
                    <button className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                      theme === 'dark'
                        ? 'text-red-400 hover:bg-slate-700'
                        : 'text-red-500 hover:bg-slate-50'
                    }`}>
                      Sign Out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Topbar;