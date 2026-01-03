// FILE LOCATION: frontend/src/pages/Anomalies/tabs/ConfigureTab.jsx

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  Power,
  PowerOff,
  AlertCircle,
  Camera,
  Clock,
  Target,
  Shield,
  ChevronDown,
  ChevronUp,
  X,
  Check
} from 'lucide-react';
import { useTheme } from '../../../shared/contexts/ThemeContext';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Loader from '../../../shared/components/ui/Loader';
import Modal from '../../../shared/components/ui/Modal';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import anomalyService from '../../../services/anomaly.service';
import apiService from '../../../services/api.service.js';

function ConfigureTab({ toast, onRuleChange }) {
  const { theme } = useTheme();
  
  const [rules, setRules] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedRule, setExpandedRule] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Form state for create/edit
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    rule_type: 'object_detection',
    severity: 'medium',
    enabled: true,
    priority: 5,
    camera_ids: [],
    conditions: {
      object_class: 'person',
      zones: [],
      time_range: { start: '', end: '' },
      threshold: 0.75
    }
  });

  useEffect(() => {
    fetchRules();
    fetchCameras();
  }, []);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const response = await anomalyService.getAllRules();
      
      // Handle different response structures
      let rulesList = [];
      if (response.data) {
        if (response.data.success && response.data.rules) {
          rulesList = response.data.rules;
        } else if (Array.isArray(response.data)) {
          rulesList = response.data;
        } else if (response.data.rules) {
          rulesList = response.data.rules;
        }
      }
      
      setRules(rulesList);
    } catch (error) {
      console.error('Error fetching rules:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to load anomaly rules';
      toast.error('Error', errorMessage);
      setRules([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const fetchCameras = async () => {
    try {
      const response = await apiService.get('/cameras');
      const camerasList = Array.isArray(response.data) 
        ? response.data 
        : response.data.cameras || [];
      setCameras(camerasList);
    } catch (error) {
      console.error('Error fetching cameras:', error);
    }
  };

  const handleOpenCreateModal = () => {
    setFormData({
      name: '',
      description: '',
      rule_type: 'object_detection',
      severity: 'medium',
      enabled: true,
      priority: 5,
      camera_ids: [],
      conditions: {
        object_class: 'person',
        zones: [],
        time_range: { start: '', end: '' },
        threshold: 0.75
      }
    });
    setShowCreateModal(true);
  };

  const handleOpenEditModal = (rule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name || '',
      description: rule.description || '',
      rule_type: rule.rule_type || 'object_detection',
      severity: rule.severity || 'medium',
      enabled: rule.enabled !== undefined ? rule.enabled : true,
      priority: rule.priority || 5,
      camera_ids: rule.camera_ids || [],
      conditions: rule.conditions || {
        object_class: 'person',
        zones: [],
        time_range: { start: '', end: '' },
        threshold: 0.75
      }
    });
    setShowEditModal(true);
  };

  const handleCreateRule = async () => {
    try {
      // Validate
      const validation = anomalyService.validateRule(formData);
      if (!validation.valid) {
        toast.error('Validation Error', validation.errors[0]);
        return;
      }

      const response = await anomalyService.createRule(formData);
      
      if (response.data?.success || response.status >= 200 && response.status < 300) {
        toast.success('Success', `Rule "${formData.name}" created successfully`);
        setShowCreateModal(false);
        await fetchRules();
        if (onRuleChange) onRuleChange();
      } else {
        toast.error('Error', 'Failed to create rule');
      }
    } catch (error) {
      console.error('Error creating rule:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to create rule';
      toast.error('Error', errorMessage);
    }
  };

  const handleUpdateRule = async () => {
    try {
      if (!editingRule) return;

      const validation = anomalyService.validateRule(formData);
      if (!validation.valid) {
        toast.error('Validation Error', validation.errors[0]);
        return;
      }

      const response = await anomalyService.updateRule(editingRule.id, formData);
      
      if (response.data?.success || response.status >= 200 && response.status < 300) {
        toast.success('Success', `Rule "${formData.name}" updated successfully`);
        setShowEditModal(false);
        setEditingRule(null);
        await fetchRules();
        if (onRuleChange) onRuleChange();
      } else {
        toast.error('Error', 'Failed to update rule');
      }
    } catch (error) {
      console.error('Error updating rule:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to update rule';
      toast.error('Error', errorMessage);
    }
  };

  const handleToggleRule = async (rule) => {
    try {
      const response = await anomalyService.updateRule(rule.id, {
        enabled: !rule.enabled
      });
      
      if (response.data?.success || response.status >= 200 && response.status < 300) {
        toast.success('Success', `Rule ${!rule.enabled ? 'enabled' : 'disabled'}`);
        await fetchRules();
        if (onRuleChange) onRuleChange();
      } else {
        toast.error('Error', 'Failed to toggle rule');
      }
    } catch (error) {
      console.error('Error toggling rule:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to toggle rule';
      toast.error('Error', errorMessage);
    }
  };

  const handleDeleteClick = (rule) => {
    setRuleToDelete(rule);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!ruleToDelete) return;

    try {
      setDeleting(true);
      const response = await anomalyService.deleteRule(ruleToDelete.id);
      
      if (response.data?.success || response.status >= 200 && response.status < 300) {
        toast.success('Success', `Rule "${ruleToDelete.name}" deleted successfully`);
        setShowDeleteConfirm(false);
        setRuleToDelete(null);
        await fetchRules();
        if (onRuleChange) onRuleChange();
      } else {
        toast.error('Error', 'Failed to delete rule');
      }
    } catch (error) {
      console.error('Error deleting rule:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to delete rule';
      toast.error('Error', errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  const getSeverityInfo = (severity) => {
    return anomalyService.getSeverityInfo(severity);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-xl font-semibold ${
            theme === 'dark' ? 'text-white' : 'text-slate-900'
          }`}>
            Anomaly Detection Rules
          </h2>
          <p className={`text-sm mt-1 ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
          }`}>
            {rules.length} rule{rules.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <Button
          variant="primary"
          icon={Plus}
          onClick={handleOpenCreateModal}
        >
          Create Rule
        </Button>
      </div>

      {/* Rules List */}
      {rules.length === 0 ? (
        <div className={`rounded-xl border backdrop-blur-sm p-12 text-center ${
          theme === 'dark'
            ? 'bg-slate-900/50 border-slate-700'
            : 'bg-slate-50 border-slate-200'
        }`}>
          <Shield className={`w-12 h-12 mx-auto mb-4 ${
            theme === 'dark' ? 'text-slate-600' : 'text-slate-300'
          }`} />
          <p className={`text-lg font-medium mb-2 ${
            theme === 'dark' ? 'text-white' : 'text-slate-900'
          }`}>
            No Rules Configured
          </p>
          <p className={`text-sm mb-4 ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
          }`}>
            Create your first anomaly detection rule to start monitoring
          </p>
          <Button variant="primary" icon={Plus} onClick={handleOpenCreateModal}>
            Create First Rule
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => {
            const isExpanded = expandedRule === rule.id;
            const severityInfo = getSeverityInfo(rule.severity);

            return (
              <div
                key={rule.id}
                className={`rounded-xl border transition-all ${
                  isExpanded ? 'ring-2 ring-blue-500' : ''
                } ${
                  theme === 'dark'
                    ? 'bg-slate-900/50 border-slate-700 hover:border-slate-600'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Rule Header */}
                <div className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Status Indicator */}
                    <button
                      onClick={() => handleToggleRule(rule)}
                      className={`p-2 rounded-lg transition-all ${
                        rule.enabled
                          ? theme === 'dark'
                            ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                            : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                          : theme === 'dark'
                            ? 'bg-slate-800 text-slate-500 hover:bg-slate-700'
                            : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                      }`}
                      title={rule.enabled ? 'Enabled - Click to disable' : 'Disabled - Click to enable'}
                    >
                      {rule.enabled ? (
                        <Power className="w-5 h-5" />
                      ) : (
                        <PowerOff className="w-5 h-5" />
                      )}
                    </button>

                    {/* Rule Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className={`text-lg font-semibold ${
                          theme === 'dark' ? 'text-white' : 'text-slate-900'
                        }`}>
                          {rule.name}
                        </h3>
                        <Badge variant={severityInfo.variant} size="sm">
                          {severityInfo.icon} {severityInfo.label}
                        </Badge>
                        <Badge variant={rule.enabled ? 'success' : 'default'} size="sm">
                          {rule.enabled ? 'Active' : 'Inactive'}
                        </Badge>
                        <Badge variant="default" size="sm">
                          Priority: {rule.priority}
                        </Badge>
                      </div>

                      <p className={`text-sm mb-3 ${
                        theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                      }`}>
                        {rule.description || 'No description'}
                      </p>

                      {/* Quick Info */}
                      <div className="flex flex-wrap gap-3">
                        <div className="flex items-center gap-1">
                          <Target className={`w-3 h-3 ${
                            theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                          }`} />
                          <span className={`text-xs ${
                            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                          }`}>
                            {rule.rule_type?.replace('_', ' ') || 'N/A'}
                          </span>
                        </div>
                        {rule.camera_ids && rule.camera_ids.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Camera className={`w-3 h-3 ${
                              theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                            }`} />
                            <span className={`text-xs ${
                              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                            }`}>
                              {rule.camera_ids.length} camera{rule.camera_ids.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant={theme === 'dark' ? 'outline' : 'primary'}
                        size="sm"
                        icon={Edit}
                        onClick={() => handleOpenEditModal(rule)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant={theme === 'dark' ? 'outline' : 'primary'}
                        size="sm"
                        icon={Trash2}
                        onClick={() => handleDeleteClick(rule)}
                        className="text-red-500 hover:text-red-600"
                      >
                        Delete
                      </Button>
                      <button
                        onClick={() => setExpandedRule(isExpanded ? null : rule.id)}
                        className={`p-2 rounded-lg transition-colors ${
                          theme === 'dark'
                            ? 'hover:bg-slate-800 text-slate-400 hover:text-white'
                            : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
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

                {/* Expanded Details */}
                {isExpanded && (
                  <div className={`px-4 pb-4 border-t ${
                    theme === 'dark' ? 'border-slate-700' : 'border-slate-200'
                  }`}>
                    <div className="pt-4 space-y-3">
                      {/* Conditions */}
                      <div className={`p-3 rounded-lg ${
                        theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50'
                      }`}>
                        <p className={`text-xs font-medium mb-2 ${
                          theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                        }`}>
                          CONDITIONS
                        </p>
                        <pre className={`text-xs font-mono ${
                          theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                        }`}>
                          {JSON.stringify(rule.conditions || {}, null, 2)}
                        </pre>
                      </div>

                      {/* Cameras */}
                      {rule.camera_ids && rule.camera_ids.length > 0 && (
                        <div className={`p-3 rounded-lg ${
                          theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50'
                        }`}>
                          <p className={`text-xs font-medium mb-2 ${
                            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                          }`}>
                            APPLIED TO CAMERAS
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {rule.camera_ids.map((camId, idx) => (
                              <Badge key={idx} variant="info" size="sm">
                                {cameras.find(c => c.id === camId)?.name || camId}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showCreateModal || showEditModal}
        onClose={() => {
          setShowCreateModal(false);
          setShowEditModal(false);
          setEditingRule(null);
        }}
        title={editingRule ? 'Edit Anomaly Rule' : 'Create Anomaly Rule'}
        size="lg"
      >
        <div className="space-y-4">
          {/* Rule Name */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
            }`}>
              Rule Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., After Hours Entry Detection"
              className={`w-full px-4 py-2 rounded-lg border transition-all ${
                theme === 'dark'
                  ? 'bg-slate-900/50 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
                  : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500'
              }`}
            />
          </div>

          {/* Description */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
            }`}>
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe what this rule detects..."
              rows={3}
              className={`w-full px-4 py-2 rounded-lg border transition-all resize-none ${
                theme === 'dark'
                  ? 'bg-slate-900/50 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
                  : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500'
              }`}
            />
          </div>

          {/* Severity & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
              }`}>
                Severity *
              </label>
              <select
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                className={`w-full px-4 py-2 rounded-lg border transition-all ${
                  theme === 'dark'
                    ? 'bg-slate-900/50 border-slate-700 text-white focus:border-blue-500'
                    : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                }`}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
              }`}>
                Priority (1-10)
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                className={`w-full px-4 py-2 rounded-lg border transition-all ${
                  theme === 'dark'
                    ? 'bg-slate-900/50 border-slate-700 text-white focus:border-blue-500'
                    : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                }`}
              />
            </div>
          </div>

          {/* Camera Selection */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
            }`}>
              Apply to Cameras (leave empty for all cameras)
            </label>
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-3 rounded-lg border">
              {cameras.map((camera) => (
                <label
                  key={camera.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                    formData.camera_ids.includes(camera.id)
                      ? 'bg-blue-500 border-blue-400 text-white'
                      : theme === 'dark'
                        ? 'bg-slate-900/50 border-slate-700 text-slate-300 hover:border-blue-500'
                        : 'bg-white border-slate-300 text-slate-700 hover:border-blue-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.camera_ids.includes(camera.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({
                          ...formData,
                          camera_ids: [...formData.camera_ids, camera.id]
                        });
                      } else {
                        setFormData({
                          ...formData,
                          camera_ids: formData.camera_ids.filter(id => id !== camera.id)
                        });
                      }
                    }}
                    className="hidden"
                  />
                  <span className="text-sm">{camera.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Enabled Toggle */}
          <div className="flex items-center justify-between">
            <label className={`text-sm font-medium ${
              theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
            }`}>
              Enable this rule immediately
            </label>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, enabled: !formData.enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                formData.enabled ? 'bg-blue-500' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  formData.enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="ghost"
              fullWidth
              onClick={() => {
                setShowCreateModal(false);
                setShowEditModal(false);
                setEditingRule(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              fullWidth
              icon={editingRule ? Check : Plus}
              onClick={editingRule ? handleUpdateRule : handleCreateRule}
            >
              {editingRule ? 'Update Rule' : 'Create Rule'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setRuleToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Anomaly Rule"
        confirmText="Delete Rule"
        cancelText="Cancel"
        variant="danger"
        loading={deleting}
      >
        <p className={`text-sm ${
          theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
        }`}>
          Are you sure you want to delete the rule <span className="font-semibold">{ruleToDelete?.name}</span>?
          This action cannot be undone.
        </p>
      </ConfirmDialog>
    </div>
  );
}

export default ConfigureTab;