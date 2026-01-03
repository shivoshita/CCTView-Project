// FILE LOCATION: frontend/src/pages/Anomalies/index.jsx

import React, { useState, useEffect } from 'react';
import {
  Settings,
  History,
  Bell,
  Plus,
  AlertTriangle,
  Shield,
  Activity,
  TrendingUp,
  Zap,
  RefreshCw,
  Filter
} from 'lucide-react';
import { useTheme } from '../../shared/contexts/ThemeContext';
import Button from '../../shared/components/ui/Button';
import Badge from '../../shared/components/ui/Badge';
import Loader from '../../shared/components/ui/Loader';
import { ToastContainer, useToast } from '../../shared/components/feedback/Toast';

// Import tab components (we'll create these next)
import ConfigureTab from './tabs/ConfigureTab';
import HistoryTab from './tabs/HistoryTab';
import TriggersTab from './tabs/TriggersTab';

import anomalyService from '../../services/anomaly.service';

function Anomalies() {
  const { theme } = useTheme();
  const { toasts, toast, removeToast } = useToast();
  
  const [activeTab, setActiveTab] = useState('configure'); // configure | history | triggers
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      const response = await anomalyService.getStatistics(7);
      
      // Handle different response structures
      let stats = null;
      if (response.data) {
        if (response.data.success && response.data.statistics) {
          stats = response.data.statistics;
        } else if (response.data.statistics) {
          stats = response.data.statistics;
        } else if (!response.data.success && Object.keys(response.data).length > 0) {
          // If response.data is the statistics object directly
          stats = response.data;
        }
      }
      
      setStatistics(stats || {
        total: 0,
        by_severity: { critical: 0, high: 0, medium: 0, low: 0 },
        by_status: { new: 0, acknowledged: 0, resolved: 0 }
      });
    } catch (error) {
      console.error('Error fetching statistics:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to load anomaly statistics';
      toast.error('Error', errorMessage);
      // Set default statistics on error
      setStatistics({
        total: 0,
        by_severity: { critical: 0, high: 0, medium: 0, low: 0 },
        by_status: { new: 0, acknowledged: 0, resolved: 0 }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchStatistics();
    setRefreshing(false);
    toast.success('Refreshed', 'Statistics updated successfully');
  };

  const tabs = [
    {
      id: 'configure',
      label: 'Configure Rules',
      icon: Settings,
      description: 'Create and manage anomaly detection rules'
    },
    {
      id: 'history',
      label: 'Detection History',
      icon: History,
      description: 'View all detected anomalies'
    },
    {
      id: 'triggers',
      label: 'Notification Triggers',
      icon: Bell,
      description: 'Configure alert delivery channels'
    }
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <Loader size="lg" />
        <p className={`mt-4 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
          Loading anomaly management...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className={`text-3xl font-bold mb-2 ${
            theme === 'dark' ? 'text-white' : 'text-slate-900'
          }`}>
            Anomaly Management
          </h1>
          <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
            Configure detection rules, monitor anomalies, and manage alert notifications
          </p>
        </div>
        
        <Button
          variant="primary"
          icon={RefreshCw}
          onClick={handleRefresh}
          disabled={refreshing}
          className={refreshing ? 'animate-spin' : ''}
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total Anomalies */}
          <div className={`rounded-xl border backdrop-blur-sm p-4 ${
            theme === 'dark'
              ? 'bg-slate-800/50 border-slate-700'
              : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-lg ${
                theme === 'dark' ? 'bg-red-500/10' : 'bg-red-50'
              }`}>
                <AlertTriangle className={`w-5 h-5 ${
                  theme === 'dark' ? 'text-red-400' : 'text-red-600'
                }`} />
              </div>
              <span className={`text-sm ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
              }`}>
                Total Anomalies
              </span>
            </div>
            <p className={`text-3xl font-bold ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>
              {statistics.total || 0}
            </p>
            <p className={`text-xs mt-1 ${
              theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
            }`}>
              Last 7 days
            </p>
          </div>

          {/* Critical */}
          <div className={`rounded-xl border backdrop-blur-sm p-4 ${
            theme === 'dark'
              ? 'bg-slate-800/50 border-slate-700'
              : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-lg ${
                theme === 'dark' ? 'bg-red-500/10' : 'bg-red-50'
              }`}>
                <Shield className={`w-5 h-5 ${
                  theme === 'dark' ? 'text-red-400' : 'text-red-600'
                }`} />
              </div>
              <span className={`text-sm ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
              }`}>
                Critical
              </span>
            </div>
            <p className={`text-3xl font-bold ${
              theme === 'dark' ? 'text-red-400' : 'text-red-600'
            }`}>
              {statistics.by_severity?.critical || 0}
            </p>
            <Badge variant="danger" size="sm" className="mt-1">
              Urgent
            </Badge>
          </div>

          {/* New/Unresolved */}
          <div className={`rounded-xl border backdrop-blur-sm p-4 ${
            theme === 'dark'
              ? 'bg-slate-800/50 border-slate-700'
              : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-lg ${
                theme === 'dark' ? 'bg-amber-500/10' : 'bg-amber-50'
              }`}>
                <Activity className={`w-5 h-5 ${
                  theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
                }`} />
              </div>
              <span className={`text-sm ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
              }`}>
                Pending Action
              </span>
            </div>
            <p className={`text-3xl font-bold ${
              theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
            }`}>
              {statistics.by_status?.new || 0}
            </p>
            <Badge variant="warning" size="sm" className="mt-1">
              Needs Review
            </Badge>
          </div>

          {/* Resolved */}
          <div className={`rounded-xl border backdrop-blur-sm p-4 ${
            theme === 'dark'
              ? 'bg-slate-800/50 border-slate-700'
              : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-lg ${
                theme === 'dark' ? 'bg-emerald-500/10' : 'bg-emerald-50'
              }`}>
                <TrendingUp className={`w-5 h-5 ${
                  theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                }`} />
              </div>
              <span className={`text-sm ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
              }`}>
                Resolved
              </span>
            </div>
            <p className={`text-3xl font-bold ${
              theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
            }`}>
              {statistics.by_status?.resolved || 0}
            </p>
            <p className={`text-xs mt-1 ${
              theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
            }`}>
              {statistics.total > 0 
                ? `${((statistics.by_status?.resolved || 0) / statistics.total * 100).toFixed(0)}% resolved`
                : 'No data'
              }
            </p>
          </div>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className={`rounded-xl border backdrop-blur-sm ${
        theme === 'dark'
          ? 'bg-slate-800/50 border-slate-700'
          : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex border-b overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-3 px-6 py-4 border-b-2 transition-all whitespace-nowrap
                  ${isActive
                    ? theme === 'dark'
                      ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                      : 'border-blue-500 bg-blue-50 text-blue-600'
                    : theme === 'dark'
                      ? 'border-transparent text-slate-400 hover:text-white hover:bg-slate-700/50'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                <div className="text-left">
                  <div className={`font-medium ${
                    isActive
                      ? theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                      : theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                  }`}>
                    {tab.label}
                  </div>
                  <div className={`text-xs hidden md:block ${
                    theme === 'dark' ? 'text-slate-500' : 'text-slate-500'
                  }`}>
                    {tab.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'configure' && (
            <ConfigureTab 
              toast={toast}
              onRuleChange={fetchStatistics}
            />
          )}
          
          {activeTab === 'history' && (
            <HistoryTab 
              toast={toast}
              statistics={statistics}
            />
          )}
          
          {activeTab === 'triggers' && (
            <TriggersTab 
              toast={toast}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default Anomalies;