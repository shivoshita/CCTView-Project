import React, { useState, useEffect } from 'react';
import { 
  Camera, 
  Activity, 
  AlertTriangle, 
  Users, 
  TrendingUp,
  TrendingDown,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw
} from 'lucide-react';
import Badge from '../../shared/components/ui/Badge';
import Loader from '../../shared/components/ui/Loader';
import apiService from '../../services/api.service';
import dashboardService from '../../services/dashboard.service';
import { useTheme } from '../../shared/contexts/ThemeContext';

function Dashboard() {
  const { theme } = useTheme();
  const [healthStatus, setHealthStatus] = useState({ loading: true, data: null, error: null });
  const [dashboardData, setDashboardData] = useState({ loading: true, data: null, error: null });
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Fetch dashboard stats
  const fetchDashboardStats = async () => {
    try {
      setDashboardData(prev => ({ ...prev, loading: true }));
      const response = await dashboardService.getDashboardStats();
      setDashboardData({ loading: false, data: response.data, error: null });
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      setDashboardData({ loading: false, data: null, error: err.message });
    }
  };

  // Check backend health
  const checkHealth = async () => {
    try {
      const response = await apiService.checkApiHealth();
      setHealthStatus({ loading: false, data: response.data, error: null });
    } catch (err) {
      setHealthStatus({ loading: false, data: null, error: err.message });
    }
  };

  // Initial load
  useEffect(() => {
    fetchDashboardStats();
    checkHealth();
    
    // Poll data every 30 seconds
    const statsInterval = setInterval(fetchDashboardStats, 30000);
    const healthInterval = setInterval(checkHealth, 30000);
    
    return () => {
      clearInterval(statsInterval);
      clearInterval(healthInterval);
    };
  }, []);

  // Calculate stats from backend data
  const stats = dashboardData.data ? {
    totalCameras: dashboardData.data.cameras?.total || 0,
    activeCameras: dashboardData.data.cameras?.active || 0,
    totalEvents: dashboardData.data.events?.total || 0,
    todayEvents: dashboardData.data.events?.today || 0,
    yesterdayEvents: dashboardData.data.events?.yesterday || 0,
    anomaliesDetected: dashboardData.data.anomalies?.count || 0,
    trackedPersons: dashboardData.data.tracked_persons?.count || 0
  } : {
    totalCameras: 0,
    activeCameras: 0,
    totalEvents: 0,
    todayEvents: 0,
    yesterdayEvents: 0,
    anomaliesDetected: 0,
    trackedPersons: 0
  };

  // Calculate percentage changes
  const eventsChange = stats.yesterdayEvents > 0 
    ? (((stats.todayEvents - stats.yesterdayEvents) / stats.yesterdayEvents) * 100).toFixed(1)
    : stats.todayEvents > 0 ? 100 : 0;
  
  const eventsChangePositive = stats.todayEvents >= stats.yesterdayEvents;

  const camerasChangeCount = dashboardData.data?.cameras?.change_from_yesterday || 0;
  const camerasChangePercent = stats.totalCameras > 0
    ? ((camerasChangeCount / stats.totalCameras) * 100).toFixed(1)
    : 0;

  // Stats cards data with real data
  const statsCards = [
    {
      title: 'Active Cameras',
      value: `${stats.activeCameras}/${stats.totalCameras}`,
      icon: Camera,
      color: 'blue',
      trend: camerasChangeCount !== 0 
        ? `${camerasChangeCount > 0 ? '+' : ''}${camerasChangeCount} from yesterday`
        : 'No change',
      trendUp: camerasChangeCount >= 0,
      percentage: camerasChangeCount !== 0 ? `${camerasChangeCount > 0 ? '+' : ''}${camerasChangePercent}%` : '0%'
    },
    {
      title: 'Events Today',
      value: stats.todayEvents,
      icon: Activity,
      color: 'emerald',
      trend: `${Math.abs(stats.todayEvents - stats.yesterdayEvents)} from yesterday`,
      trendUp: eventsChangePositive,
      percentage: `${eventsChangePositive ? '+' : '-'}${Math.abs(eventsChange)}%`
    },
    {
      title: 'Active Anomalies',
      value: stats.anomaliesDetected,
      icon: AlertTriangle,
      color: 'amber',
      trend: stats.anomaliesDetected > 0 ? `${stats.anomaliesDetected} need attention` : 'All clear',
      trendUp: false,
      percentage: stats.anomaliesDetected > 0 ? `${stats.anomaliesDetected}` : '0'
    },
    {
      title: 'Tracked Persons',
      value: stats.trackedPersons,
      icon: Users,
      color: 'cyan',
      trend: dashboardData.data?.tracked_persons?.new_today 
        ? `${dashboardData.data.tracked_persons.new_today} new today`
        : 'No new persons',
      trendUp: (dashboardData.data?.tracked_persons?.new_today || 0) > 0,
      percentage: dashboardData.data?.tracked_persons?.new_today 
        ? `+${dashboardData.data.tracked_persons.new_today}`
        : '0'
    }
  ];

  const colorClasses = {
    blue: {
      icon: theme === 'dark' 
        ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' 
        : 'bg-blue-50 text-blue-600 border-blue-200',
      gradient: theme === 'dark'
        ? 'from-blue-500/20 to-transparent'
        : 'from-blue-100/50 to-transparent'
    },
    emerald: {
      icon: theme === 'dark'
        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
        : 'bg-emerald-50 text-emerald-600 border-emerald-200',
      gradient: theme === 'dark'
        ? 'from-emerald-500/20 to-transparent'
        : 'from-emerald-100/50 to-transparent'
    },
    amber: {
      icon: theme === 'dark'
        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
        : 'bg-amber-50 text-amber-600 border-amber-200',
      gradient: theme === 'dark'
        ? 'from-amber-500/20 to-transparent'
        : 'from-amber-100/50 to-transparent'
    },
    cyan: {
      icon: theme === 'dark'
        ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
        : 'bg-cyan-50 text-cyan-600 border-cyan-200',
      gradient: theme === 'dark'
        ? 'from-cyan-500/20 to-transparent'
        : 'from-cyan-100/50 to-transparent'
    }
  };

  // Recent activity from backend
  const recentActivity = dashboardData.data?.recent_activity || [];

  // Format time ago
  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return 'Unknown time';
    const now = new Date();
    const eventTime = new Date(timestamp);
    const diffMs = now - eventTime;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  // Show loading state
  if (dashboardData.loading && !dashboardData.data) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className={`text-3xl font-bold mb-2 ${
            theme === 'dark' ? 'text-white' : 'text-slate-900'
          }`}>
            Dashboard
          </h1>
          <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
            Welcome back! Here's your surveillance overview.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              fetchDashboardStats();
              checkHealth();
            }}
            disabled={dashboardData.loading}
            className={`
              p-2 rounded-lg transition-colors
              ${theme === 'dark'
                ? 'hover:bg-slate-700 text-slate-400 hover:text-white'
                : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
            title="Refresh data"
          >
            <RefreshCw className={`w-5 h-5 ${dashboardData.loading ? 'animate-spin' : ''}`} />
          </button>
          <Badge 
            variant={healthStatus.data ? 'success' : 'danger'} 
            dot
            size="lg"
          >
            {healthStatus.loading ? 'Checking...' : healthStatus.data ? 'System Healthy' : 'System Offline'}
          </Badge>
          <div className="text-right">
            <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              Last updated
            </p>
            <p className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {lastUpdate.toLocaleTimeString()}
            </p>
          </div>
        </div>
      </div>

      {/* Error State */}
      {dashboardData.error && (
        <div className={`p-4 rounded-lg border ${
          theme === 'dark'
            ? 'bg-red-500/10 border-red-500/30 text-red-400'
            : 'bg-red-50 border-red-200 text-red-600'
        }`}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            <p className="font-medium">Failed to load dashboard data</p>
          </div>
          <p className="text-sm mt-1 opacity-80">{dashboardData.error}</p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((stat) => {
          const Icon = stat.icon;
          const colors = colorClasses[stat.color];
          
          return (
            <div
              key={stat.title}
              className={`
                relative overflow-hidden rounded-xl border backdrop-blur-sm
                transition-all duration-300 hover:scale-[1.02] hover:shadow-xl
                group cursor-pointer
                ${theme === 'dark'
                  ? 'bg-slate-800/50 border-slate-700 hover:border-slate-600 hover:shadow-slate-900/50'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-slate-200/50'
                }
              `}
            >
              {/* Gradient Background */}
              <div className={`absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${colors.gradient}`} />
              
              {/* Content */}
              <div className="relative p-6">
                {/* Header Row */}
                <div className="flex items-start justify-between mb-4">
                  {/* Title & Value */}
                  <div className="flex-1">
                    <p className={`text-sm font-medium mb-2 ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                    }`}>
                      {stat.title}
                    </p>
                    <div className="flex items-baseline gap-2">
                      <p className={`text-3xl font-bold ${
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      }`}>
                        {stat.value}
                      </p>
                      {/* Percentage Badge */}
                      {stat.percentage !== '0%' && stat.percentage !== '0' && (
                        <span className={`
                          inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold
                          ${stat.trendUp
                            ? theme === 'dark' 
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-emerald-50 text-emerald-600'
                            : theme === 'dark'
                              ? 'bg-red-500/10 text-red-400'
                              : 'bg-red-50 text-red-600'
                          }
                        `}>
                          {stat.trendUp ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {stat.percentage}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Icon */}
                  <div className={`
                    w-14 h-14 rounded-xl border flex items-center justify-center
                    transition-all duration-300 group-hover:scale-110 group-hover:rotate-3
                    ${colors.icon}
                  `}>
                    <Icon className="w-7 h-7" />
                  </div>
                </div>

                {/* Trend Text */}
                <div className="flex items-center gap-2 pt-3 border-t border-opacity-50"
                  style={{
                    borderColor: theme === 'dark' ? 'rgb(51, 65, 85)' : 'rgb(226, 232, 240)'
                  }}
                >
                  {stat.trendUp ? (
                    <TrendingUp className={`w-4 h-4 ${
                      theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                    }`} />
                  ) : (
                    <AlertTriangle className={`w-4 h-4 ${
                      theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
                    }`} />
                  )}
                  <p className={`text-xs font-medium ${
                    stat.trendUp
                      ? theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                      : theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
                  }`}>
                    {stat.trend}
                  </p>
                </div>

                {/* Sparkline Placeholder */}
                <div className="mt-4 h-8 flex items-end gap-1">
                  {[...Array(12)].map((_, i) => (
                    <div
                      key={i}
                      className={`flex-1 rounded-sm transition-all duration-300 ${
                        theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'
                      } group-hover:${colors.icon.split(' ')[0].replace('/10', '/30')}`}
                      style={{
                        height: `${Math.random() * 100}%`,
                        animationDelay: `${i * 50}ms`
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Hover Effect Border */}
              <div className={`
                absolute inset-0 rounded-xl border-2 border-transparent
                group-hover:border-${stat.color}-500/50
                transition-colors duration-300 pointer-events-none
              `} />
            </div>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className={`lg:col-span-2 rounded-xl border backdrop-blur-sm ${
          theme === 'dark'
            ? 'bg-slate-800/50 border-slate-700'
            : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className={`px-6 py-4 border-b flex items-center justify-between ${
            theme === 'dark' ? 'border-slate-700' : 'border-slate-200'
          }`}>
            <div className="flex items-center gap-3">
              <Activity className={`w-5 h-5 ${
                theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
              }`} />
              <h2 className={`text-lg font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                Recent Activity
              </h2>
            </div>
            {dashboardData.loading && (
              <Loader size="sm" />
            )}
          </div>
          <div className="p-6">
            {recentActivity.length === 0 ? (
              <div className={`text-center py-8 ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
              }`}>
                <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No recent activity</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((activity, index) => (
                <div 
                  key={`${activity.id}-${index}`}
                  className={`
                    flex items-start gap-3 p-3 rounded-lg transition-all duration-200
                    hover:scale-[1.01] cursor-pointer
                    ${theme === 'dark'
                      ? 'bg-slate-900/30 hover:bg-slate-900/50'
                      : 'bg-slate-50 hover:bg-slate-100'
                    }
                  `}
                >
                    <div className={`w-2 h-2 rounded-full mt-2 ${
                      activity.status === 'warning' || activity.event_type === 'anomaly'
                        ? 'bg-amber-400 animate-pulse' 
                        : 'bg-emerald-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className={`text-sm font-medium ${
                            theme === 'dark' ? 'text-white' : 'text-slate-900'
                          }`}>
                            {activity.event || activity.description || 'Unknown event'}
                          </p>
                          <p className={`text-xs mt-1 ${
                            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                          }`}>
                            {activity.camera || activity.camera_name || 'Unknown camera'}
                          </p>
                        </div>
                        <Badge 
                          variant={
                            activity.status === 'warning' || activity.event_type === 'anomaly' 
                              ? 'warning' 
                              : 'default'
                          } 
                          size="sm"
                        >
                          {activity.status || activity.event_type || 'normal'}
                        </Badge>
                      </div>
                      <div className={`flex items-center gap-1 mt-2 text-xs ${
                        theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                      }`}>
                        <Clock className="w-3 h-3" />
                        {formatTimeAgo(activity.timestamp || activity.time)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* System Status */}
        <div className={`rounded-xl border backdrop-blur-sm ${
          theme === 'dark'
            ? 'bg-slate-800/50 border-slate-700'
            : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <div className={`px-6 py-4 border-b flex items-center gap-3 ${
            theme === 'dark' ? 'border-slate-700' : 'border-slate-200'
          }`}>
            <Eye className={`w-5 h-5 ${
              theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
            }`} />
            <h2 className={`text-lg font-semibold ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>
              System Status
            </h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {/* Services Status */}
              <div>
                <p className={`text-sm mb-3 ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  Services
                </p>
                <div className="space-y-2">
                  <div className={`flex items-center justify-between p-2 rounded-lg ${
                    theme === 'dark' ? 'bg-slate-900/30' : 'bg-slate-50'
                  }`}>
                    <div className="flex items-center gap-2">
                      {healthStatus.data?.services?.redis === 'connected' ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400" />
                      )}
                      <span className={`text-sm ${
                        theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                      }`}>
                        Redis Cache
                      </span>
                    </div>
                    <Badge 
                      variant={healthStatus.data?.services?.redis === 'connected' ? 'success' : 'danger'} 
                      size="sm"
                    >
                      {healthStatus.data?.services?.redis || 'unknown'}
                    </Badge>
                  </div>

                  <div className={`flex items-center justify-between p-2 rounded-lg ${
                    theme === 'dark' ? 'bg-slate-900/30' : 'bg-slate-50'
                  }`}>
                    <div className="flex items-center gap-2">
                      {healthStatus.data?.services?.neo4j === 'connected' ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400" />
                      )}
                      <span className={`text-sm ${
                        theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                      }`}>
                        Neo4j Database
                      </span>
                    </div>
                    <Badge 
                      variant={healthStatus.data?.services?.neo4j === 'connected' ? 'success' : 'danger'} 
                      size="sm"
                    >
                      {healthStatus.data?.services?.neo4j || 'unknown'}
                    </Badge>
                  </div>

                  <div className={`flex items-center justify-between p-2 rounded-lg ${
                    theme === 'dark' ? 'bg-slate-900/30' : 'bg-slate-50'
                  }`}>
                    <div className="flex items-center gap-2">
                      {healthStatus.data?.services?.ai_service === 'connected' ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400" />
                      )}
                      <span className={`text-sm ${
                        theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                      }`}>
                        AI Service
                      </span>
                    </div>
                    <Badge 
                      variant={healthStatus.data?.services?.ai_service === 'connected' ? 'success' : 'danger'} 
                      size="sm"
                    >
                      {healthStatus.data?.services?.ai_service || 'unknown'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div>
                <p className={`text-sm mb-3 ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  Quick Actions
                </p>
                <div className="space-y-2">
                  <button className={`
                    w-full px-3 py-2 text-left text-sm rounded-lg transition-colors
                    ${theme === 'dark'
                      ? 'text-slate-300 hover:bg-slate-700/50'
                      : 'text-slate-700 hover:bg-slate-100'
                    }
                  `}>
                    View All Cameras
                  </button>
                  <button className={`
                    w-full px-3 py-2 text-left text-sm rounded-lg transition-colors
                    ${theme === 'dark'
                      ? 'text-slate-300 hover:bg-slate-700/50'
                      : 'text-slate-700 hover:bg-slate-100'
                    }
                  `}>
                    Check Anomalies
                  </button>
                  <button className={`
                    w-full px-3 py-2 text-left text-sm rounded-lg transition-colors
                    ${theme === 'dark'
                      ? 'text-slate-300 hover:bg-slate-700/50'
                      : 'text-slate-700 hover:bg-slate-100'
                    }
                  `}>
                    Export Report
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;