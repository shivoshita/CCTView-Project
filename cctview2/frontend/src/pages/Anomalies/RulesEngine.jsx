// FILE LOCATION: frontend/src/pages/Anomalies/RulesEngine.jsx

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  Power,
  PowerOff,
  Settings,
  AlertTriangle,
  Shield,
  Filter,
  Search,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useTheme } from '../../shared/contexts/ThemeContext';
import Button from '../../shared/components/ui/Button';
import Badge from '../../shared/components/ui/Badge';
import Loader from '../../shared/components/ui/Loader';
import Modal from '../../shared/components/ui/Modal';
import { ToastContainer, useToast } from '../../shared/components/feedback/Toast';
import RuleEditor from './components/RuleEditor';
import RuleTemplates from './components/RuleTemplates';
import anomalyService from '../../services/anomaly.service';

function RulesEngine() {
  const { theme } = useTheme();
  const { toasts, toast, removeToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState([]);
  const [filteredRules, setFilteredRules] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEnabled, setFilterEnabled] = useState(null);
  const [expandedRule, setExpandedRule] = useState(null);
  
  // Modals
  const [showRuleEditor, setShowRuleEditor] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [deletingRule, setDeletingRule] = useState(null);

  useEffect(() => {
    fetchRules();
  }, []);

  useEffect(() => {
    filterRules();
  }, [rules, searchQuery, filterEnabled]);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const response = await anomalyService.getAllRules();
      
      if (response.data.success) {
        setRules(response.data.rules);
      }
    } catch (error) {
      console.error('Error fetching rules:', error);
      toast.error('Error', 'Failed to load anomaly rules');
    } finally {
      setLoading(false);
    }
  };

  const filterRules = () => {
    let filtered = [...rules];

    // Filter by enabled status
    if (filterEnabled !== null) {
      filtered = filtered.filter(rule => rule.enabled === filterEnabled);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(rule => 
        rule.name.toLowerCase().includes(query) ||
        rule.description.toLowerCase().includes(query) ||
        rule.rule_type.toLowerCase().includes(query)
      );
    }

    setFilteredRules(filtered);
  };

  const handleToggleRule = async (ruleId, currentStatus) => {
    try {
      await anomalyService.updateRule(ruleId, { enabled: !currentStatus });
      toast.success('Success', `Rule ${!currentStatus ? 'enabled' : 'disabled'} successfully`);
      fetchRules();
    } catch (error) {
      console.error('Error toggling rule:', error);
      toast.error('Error', 'Failed to update rule status');
    }
  };

  const handleDeleteRule = async () => {
    if (!deletingRule) return;

    try {
      await anomalyService.deleteRule(deletingRule.id);
      toast.success('Success', 'Rule deleted successfully');
      setDeletingRule(null);
      fetchRules();
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast.error('Error', 'Failed to delete rule');
    }
  };

  const handleEditRule = (rule) => {
    setEditingRule(rule);
    setShowRuleEditor(true);
  };

  const handleCreateRule = () => {
    setEditingRule(null);
    setShowRuleEditor(true);
  };

  const handleSaveRule = async (ruleData) => {
    try {
      if (editingRule) {
        await anomalyService.updateRule(editingRule.id, ruleData);
        toast.success('Success', 'Rule updated successfully');
      } else {
        await anomalyService.createRule(ruleData);
        toast.success('Success', 'Rule created successfully');
      }
      setShowRuleEditor(false);
      setEditingRule(null);
      fetchRules();
    } catch (error) {
      console.error('Error saving rule:', error);
      toast.error('Error', 'Failed to save rule');
    }
  };

  const getSeverityColor = (severity) => {
    const severityMap = {
      critical: 'danger',
      high: 'warning',
      medium: 'warning',
      low: 'info'
    };
    return severityMap[severity] || 'default';
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <Loader size="lg" />
        <p className={`mt-4 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
          Loading anomaly rules...
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
            Anomaly Rules Engine
          </h1>
          <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
            Configure detection rules to automatically identify suspicious activities
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            icon={Settings}
            onClick={() => setShowTemplates(true)}
          >
            Templates
          </Button>
          <Button
            variant="primary"
            icon={Plus}
            onClick={handleCreateRule}
          >
            New Rule
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={`rounded-xl border backdrop-blur-sm p-4 ${
          theme === 'dark'
            ? 'bg-slate-800/50 border-slate-700'
            : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <p className={`text-2xl font-bold ${
            theme === 'dark' ? 'text-white' : 'text-slate-900'
          }`}>
            {rules.length}
          </p>
          <p className={`text-xs ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
          }`}>
            Total Rules
          </p>
        </div>

        <div className={`rounded-xl border backdrop-blur-sm p-4 ${
          theme === 'dark'
            ? 'bg-slate-800/50 border-slate-700'
            : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <p className={`text-2xl font-bold ${
            theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
          }`}>
            {rules.filter(r => r.enabled).length}
          </p>
          <p className={`text-xs ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
          }`}>
            Active
          </p>
        </div>

        <div className={`rounded-xl border backdrop-blur-sm p-4 ${
          theme === 'dark'
            ? 'bg-slate-800/50 border-slate-700'
            : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <p className={`text-2xl font-bold ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
          }`}>
            {rules.filter(r => !r.enabled).length}
          </p>
          <p className={`text-xs ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
          }`}>
            Disabled
          </p>
        </div>

        <div className={`rounded-xl border backdrop-blur-sm p-4 ${
          theme === 'dark'
            ? 'bg-slate-800/50 border-slate-700'
            : 'bg-white border-slate-200 shadow-sm'
        }`}>
          <p className={`text-2xl font-bold ${
            theme === 'dark' ? 'text-red-400' : 'text-red-600'
          }`}>
            {rules.filter(r => r.severity === 'critical').length}
          </p>
          <p className={`text-xs ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
          }`}>
            Critical
          </p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className={`rounded-xl border backdrop-blur-sm p-4 ${
        theme === 'dark'
          ? 'bg-slate-800/50 border-slate-700'
          : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
            }`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search rules by name, type, or description..."
              className={`w-full pl-11 pr-4 py-2 rounded-lg border transition-all ${
                theme === 'dark'
                  ? 'bg-slate-900/50 border-slate-700 text-white placeholder-slate-500'
                  : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
              }`}
            />
          </div>

          {/* Status Filter */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilterEnabled(null)}
              className={`px-4 py-2 rounded-lg transition-all ${
                filterEnabled === null
                  ? 'bg-blue-500 text-white'
                  : theme === 'dark'
                    ? 'bg-slate-900/50 text-slate-400 hover:text-white'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterEnabled(true)}
              className={`px-4 py-2 rounded-lg transition-all ${
                filterEnabled === true
                  ? 'bg-blue-500 text-white'
                  : theme === 'dark'
                    ? 'bg-slate-900/50 text-slate-400 hover:text-white'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setFilterEnabled(false)}
              className={`px-4 py-2 rounded-lg transition-all ${
                filterEnabled === false
                  ? 'bg-blue-500 text-white'
                  : theme === 'dark'
                    ? 'bg-slate-900/50 text-slate-400 hover:text-white'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              Disabled
            </button>
          </div>
        </div>
      </div>

      {/* Rules List */}
      <div className="space-y-3">
        {filteredRules.length > 0 ? (
          filteredRules.map((rule) => {
            const isExpanded = expandedRule === rule.id;

            return (
              <div
                key={rule.id}
                className={`rounded-xl border backdrop-blur-sm transition-all ${
                  isExpanded ? 'ring-2 ring-blue-500' : ''
                } ${
                  theme === 'dark'
                    ? 'bg-slate-800/50 border-slate-700'
                    : 'bg-white border-slate-200 shadow-sm'
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Status Indicator */}
                    <div className={`p-2 rounded-lg flex-shrink-0 ${
                      rule.enabled
                        ? theme === 'dark' ? 'bg-emerald-500/10' : 'bg-emerald-50'
                        : theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200'
                    }`}>
                      {rule.enabled ? (
                        <Power className={`w-5 h-5 ${
                          theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                        }`} />
                      ) : (
                        <PowerOff className={`w-5 h-5 ${
                          theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                        }`} />
                      )}
                    </div>

                    {/* Rule Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className={`font-semibold text-lg mb-1 ${
                            theme === 'dark' ? 'text-white' : 'text-slate-900'
                          }`}>
                            {rule.name}
                          </h3>
                          <p className={`text-sm mb-3 ${
                            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                          }`}>
                            {rule.description}
                          </p>

                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={getSeverityColor(rule.severity)} size="sm">
                              {rule.severity}
                            </Badge>
                            <Badge variant="default" size="sm">
                              {rule.rule_type}
                            </Badge>
                            <Badge variant="info" size="sm">
                              Priority: {rule.priority}
                            </Badge>
                            {rule.enabled && (
                              <Badge variant="success" size="sm">
                                Active
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleRule(rule.id, rule.enabled)}
                            className={`p-2 rounded-lg transition-colors ${
                              theme === 'dark'
                                ? 'hover:bg-slate-700 text-slate-400 hover:text-white'
                                : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
                            }`}
                            title={rule.enabled ? 'Disable' : 'Enable'}
                          >
                            {rule.enabled ? (
                              <PowerOff className="w-5 h-5" />
                            ) : (
                              <Power className="w-5 h-5" />
                            )}
                          </button>
                          <button
                            onClick={() => handleEditRule(rule)}
                            className={`p-2 rounded-lg transition-colors ${
                              theme === 'dark'
                                ? 'hover:bg-slate-700 text-slate-400 hover:text-white'
                                : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
                            }`}
                            title="Edit"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => setDeletingRule(rule)}
                            className={`p-2 rounded-lg transition-colors ${
                              theme === 'dark'
                                ? 'hover:bg-red-500/10 text-red-400'
                                : 'hover:bg-red-50 text-red-600'
                            }`}
                            title="Delete"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => setExpandedRule(isExpanded ? null : rule.id)}
                            className={`p-2 rounded-lg transition-colors ${
                              theme === 'dark'
                                ? 'hover:bg-slate-700 text-slate-400'
                                : 'hover:bg-slate-100 text-slate-600'
                            }`}
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5" />
                            ) : (
                              <ChevronDown className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className={`mt-4 pt-4 border-t ${
                      theme === 'dark' ? 'border-slate-700' : 'border-slate-200'
                    }`}>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className={`text-xs font-medium mb-1 ${
                            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                          }`}>
                            Conditions
                          </p>
                          <pre className={`text-xs p-2 rounded ${
                            theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-100'
                          }`}>
                            {JSON.stringify(rule.conditions, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <p className={`text-xs font-medium mb-1 ${
                            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                          }`}>
                            Created
                          </p>
                          <p className={`text-sm ${
                            theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                          }`}>
                            {rule.created_at ? new Date(rule.created_at).toLocaleString() : 'Unknown'}
                          </p>
                          {rule.created_by && (
                            <>
                              <p className={`text-xs font-medium mt-2 mb-1 ${
                                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                              }`}>
                                Created By
                              </p>
                              <p className={`text-sm ${
                                theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                              }`}>
                                {rule.created_by}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className={`rounded-xl border backdrop-blur-sm p-12 text-center ${
            theme === 'dark'
              ? 'bg-slate-800/50 border-slate-700'
              : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <Shield className={`w-12 h-12 mx-auto mb-4 ${
              theme === 'dark' ? 'text-slate-600' : 'text-slate-300'
            }`} />
            <p className={`text-lg font-medium mb-2 ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>
              No Rules Found
            </p>
            <p className={`text-sm mb-4 ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>
              {searchQuery || filterEnabled !== null
                ? 'Try adjusting your filters'
                : 'Create your first anomaly detection rule'
              }
            </p>
            {!searchQuery && filterEnabled === null && (
              <Button variant="primary" icon={Plus} onClick={handleCreateRule}>
                Create Rule
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Rule Editor Modal */}
      {showRuleEditor && (
        <Modal
          isOpen={showRuleEditor}
          onClose={() => {
            setShowRuleEditor(false);
            setEditingRule(null);
          }}
          title={editingRule ? 'Edit Rule' : 'Create New Rule'}
          size="xl"
        >
          <RuleEditor
            rule={editingRule}
            onSave={handleSaveRule}
            onCancel={() => {
              setShowRuleEditor(false);
              setEditingRule(null);
            }}
          />
        </Modal>
      )}

      {/* Templates Modal */}
      {showTemplates && (
        <Modal
          isOpen={showTemplates}
          onClose={() => setShowTemplates(false)}
          title="Rule Templates"
          size="lg"
        >
          <RuleTemplates
            onSelectTemplate={(template) => {
              setEditingRule(template);
              setShowTemplates(false);
              setShowRuleEditor(true);
            }}
            onClose={() => setShowTemplates(false)}
          />
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deletingRule && (
        <Modal
          isOpen={!!deletingRule}
          onClose={() => setDeletingRule(null)}
          title="Delete Rule"
        >
          <div className="space-y-4">
            <div className={`flex items-start gap-3 p-4 rounded-lg ${
              theme === 'dark' ? 'bg-red-500/10' : 'bg-red-50'
            }`}>
              <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${
                theme === 'dark' ? 'text-red-400' : 'text-red-600'
              }`} />
              <div>
                <p className={`font-medium ${
                  theme === 'dark' ? 'text-red-400' : 'text-red-600'
                }`}>
                  Are you sure you want to delete this rule?
                </p>
                <p className={`text-sm mt-1 ${
                  theme === 'dark' ? 'text-red-300' : 'text-red-700'
                }`}>
                  Rule: {deletingRule.name}
                </p>
                <p className={`text-xs mt-2 ${
                  theme === 'dark' ? 'text-red-300' : 'text-red-700'
                }`}>
                  This action cannot be undone. Anomalies already detected by this rule will not be affected.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setDeletingRule(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                icon={Trash2}
                onClick={handleDeleteRule}
              >
                Delete Rule
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default RulesEngine;