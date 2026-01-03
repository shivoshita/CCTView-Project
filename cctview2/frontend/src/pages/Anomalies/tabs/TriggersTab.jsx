// FILE LOCATION: frontend/src/pages/Anomalies/tabs/TriggersTab.jsx

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  Bell,
  Mail,
  MessageSquare,
  Webhook,
  Smartphone,
  Send,
  CheckCircle,
  XCircle,
  AlertCircle,
  Settings,
  TestTube,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';
import { useTheme } from '../../../shared/contexts/ThemeContext';
import Button from '../../../shared/components/ui/Button';
import Badge from '../../../shared/components/ui/Badge';
import Loader from '../../../shared/components/ui/Loader';
import Modal from '../../../shared/components/ui/Modal';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import anomalyService from '../../../services/anomaly.service';

function TriggersTab({ toast }) {
  const { theme } = useTheme();

  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedChannel, setExpandedChannel] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [channelToDelete, setChannelToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [testingChannel, setTestingChannel] = useState(null);

  // Form state for create/edit
  const [formData, setFormData] = useState({
    name: '',
    channel_type: 'email',
    enabled: true,
    config: {
      recipients: [],
      phone_numbers: [],
      webhook_url: '',
      api_key: '',
      headers: {}
    },
    rules: [] // Which anomaly rules trigger this channel
  });

  useEffect(() => {
    fetchChannels();
  }, []);

  const fetchChannels = async () => {
    try {
      setLoading(true);
      const response = await anomalyService.getAllChannels();
      
      // Handle different response structures
      let channelsList = [];
      if (response.data) {
        if (response.data.success && response.data.channels) {
          channelsList = response.data.channels;
        } else if (Array.isArray(response.data)) {
          channelsList = response.data;
        } else if (response.data.channels) {
          channelsList = response.data.channels;
        }
      }
      
      setChannels(channelsList);
    } catch (error) {
      console.error('Error fetching channels:', error);
      toast.error('Error', 'Failed to load notification channels');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setFormData({
      name: '',
      channel_type: 'email',
      enabled: true,
      config: {
        recipients: [],
        phone_numbers: [],
        webhook_url: '',
        api_key: '',
        headers: {}
      },
      rules: []
    });
    setShowCreateModal(true);
  };

  const handleOpenEditModal = (channel) => {
    setEditingChannel(channel);
    setFormData({
      name: channel.name || '',
      channel_type: channel.channel_type || 'email',
      enabled: channel.enabled !== undefined ? channel.enabled : true,
      config: channel.config || {
        recipients: [],
        phone_numbers: [],
        webhook_url: '',
        api_key: '',
        headers: {}
      },
      rules: channel.rules || []
    });
    setShowEditModal(true);
  };

  const handleCreateChannel = async () => {
    try {
      // Validate
      const validation = anomalyService.validateChannel(formData);
      if (!validation.valid) {
        toast.error('Validation Error', validation.errors[0]);
        return;
      }

      const response = await anomalyService.createChannel(formData);
      
      if (response.data?.success || response.status === 200 || response.status === 201) {
        toast.success('Success', `Channel "${formData.name}" created successfully`);
        setShowCreateModal(false);
        await fetchChannels();
      }
    } catch (error) {
      console.error('Error creating channel:', error);
      toast.error('Error', error.response?.data?.detail || 'Failed to create channel');
    }
  };

  const handleUpdateChannel = async () => {
    try {
      if (!editingChannel) return;

      const validation = anomalyService.validateChannel(formData);
      if (!validation.valid) {
        toast.error('Validation Error', validation.errors[0]);
        return;
      }

      const response = await anomalyService.updateChannel(editingChannel.id, formData);
      
      if (response.data?.success || response.status === 200 || response.status === 204) {
        toast.success('Success', `Channel "${formData.name}" updated successfully`);
        setShowEditModal(false);
        setEditingChannel(null);
        await fetchChannels();
      }
    } catch (error) {
      console.error('Error updating channel:', error);
      toast.error('Error', error.response?.data?.detail || 'Failed to update channel');
    }
  };

  const handleDeleteClick = (channel) => {
    setChannelToDelete(channel);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!channelToDelete) return;

    try {
      setDeleting(true);
      const response = await anomalyService.deleteChannel(channelToDelete.id);
      
      if (response.data?.success || response.status === 200 || response.status === 204) {
        toast.success('Success', `Channel "${channelToDelete.name}" deleted successfully`);
        setShowDeleteConfirm(false);
        setChannelToDelete(null);
        await fetchChannels();
      }
    } catch (error) {
      console.error('Error deleting channel:', error);
      toast.error('Error', 'Failed to delete channel');
    } finally {
      setDeleting(false);
    }
  };

  const handleTestChannel = async (channelId) => {
    try {
      setTestingChannel(channelId);
      const response = await anomalyService.testChannel(channelId);
      
      if (response.data?.success || response.status === 200) {
        toast.success('Success', 'Test notification sent successfully');
      }
    } catch (error) {
      console.error('Error testing channel:', error);
      toast.error('Error', 'Failed to send test notification');
    } finally {
      setTestingChannel(null);
    }
  };

  const handleToggleChannel = async (channel) => {
    try {
      const response = await anomalyService.updateChannel(channel.id, {
        enabled: !channel.enabled
      });
      
      if (response.data?.success || response.status === 200) {
        toast.success('Success', `Channel ${!channel.enabled ? 'enabled' : 'disabled'}`);
        await fetchChannels();
      }
    } catch (error) {
      console.error('Error toggling channel:', error);
      toast.error('Error', 'Failed to toggle channel');
    }
  };

  const getChannelIcon = (channelType) => {
    return anomalyService.getChannelIcon(channelType);
  };

  const addRecipient = (type) => {
    const newValue = '';
    if (type === 'email') {
      setFormData({
        ...formData,
        config: {
          ...formData.config,
          recipients: [...(formData.config.recipients || []), newValue]
        }
      });
    } else {
      setFormData({
        ...formData,
        config: {
          ...formData.config,
          phone_numbers: [...(formData.config.phone_numbers || []), newValue]
        }
      });
    }
  };

  const removeRecipient = (type, index) => {
    if (type === 'email') {
      setFormData({
        ...formData,
        config: {
          ...formData.config,
          recipients: formData.config.recipients.filter((_, i) => i !== index)
        }
      });
    } else {
      setFormData({
        ...formData,
        config: {
          ...formData.config,
          phone_numbers: formData.config.phone_numbers.filter((_, i) => i !== index)
        }
      });
    }
  };

  const updateRecipient = (type, index, value) => {
    if (type === 'email') {
      const recipients = [...(formData.config.recipients || [])];
      recipients[index] = value;
      setFormData({
        ...formData,
        config: {
          ...formData.config,
          recipients
        }
      });
    } else {
      const phone_numbers = [...(formData.config.phone_numbers || [])];
      phone_numbers[index] = value;
      setFormData({
        ...formData,
        config: {
          ...formData.config,
          phone_numbers
        }
      });
    }
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
            Notification Channels
          </h2>
          <p className={`text-sm mt-1 ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
          }`}>
            {channels.length} channel{channels.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <Button
          variant="primary"
          icon={Plus}
          onClick={handleOpenCreateModal}
        >
          Create Channel
        </Button>
      </div>

      {/* Channels List */}
      {channels.length === 0 ? (
        <div className={`rounded-xl border backdrop-blur-sm p-12 text-center ${
        theme === 'dark' 
            ? 'bg-slate-900/50 border-slate-700'
            : 'bg-slate-50 border-slate-200'
        }`}>
          <Bell className={`w-12 h-12 mx-auto mb-4 ${
            theme === 'dark' ? 'text-slate-600' : 'text-slate-300'
          }`} />
          <p className={`text-lg font-medium mb-2 ${
          theme === 'dark' ? 'text-white' : 'text-slate-900'
        }`}>
            No Notification Channels
          </p>
          <p className={`text-sm mb-4 ${
          theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
        }`}>
            Create a notification channel to receive alerts when anomalies are detected
          </p>
          <Button variant="primary" icon={Plus} onClick={handleOpenCreateModal}>
            Create First Channel
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {channels.map((channel) => {
            const isExpanded = expandedChannel === channel.id;
            const icon = getChannelIcon(channel.channel_type);
            
            return (
              <div
                key={channel.id}
                className={`rounded-xl border transition-all ${
                  isExpanded ? 'ring-2 ring-blue-500' : ''
                } ${
                  theme === 'dark' 
                    ? 'bg-slate-900/50 border-slate-700 hover:border-slate-600'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Channel Header */}
                <div className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-2xl ${
                      theme === 'dark'
                        ? 'bg-blue-500/10'
                        : 'bg-blue-50'
                    }`}>
                      {icon}
                </div>
                
                    {/* Channel Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className={`text-lg font-semibold ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  {channel.name}
                        </h3>
                        <Badge variant={channel.enabled ? 'success' : 'default'} size="sm">
                          {channel.enabled ? 'Active' : 'Inactive'}
                        </Badge>
                        <Badge variant="info" size="sm">
                          {channel.channel_type}
                        </Badge>
                      </div>

                      {/* Channel Config Preview */}
                      <div className="flex flex-wrap gap-3">
                        {channel.channel_type === 'email' && channel.config?.recipients && (
                          <div className="flex items-center gap-1">
                            <Mail className={`w-3 h-3 ${
                              theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                            }`} />
                            <span className={`text-xs ${
                              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                            }`}>
                              {channel.config.recipients.length} recipient{channel.config.recipients.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        )}
                        {['sms', 'whatsapp'].includes(channel.channel_type) && channel.config?.phone_numbers && (
                          <div className="flex items-center gap-1">
                            <MessageSquare className={`w-3 h-3 ${
                              theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                            }`} />
                            <span className={`text-xs ${
                              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                            }`}>
                              {channel.config.phone_numbers.length} number{channel.config.phone_numbers.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        )}
                        {channel.channel_type === 'webhook' && channel.config?.webhook_url && (
                          <div className="flex items-center gap-1">
                            <Webhook className={`w-3 h-3 ${
                              theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                            }`} />
                            <span className={`text-xs ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>
                              {new URL(channel.config.webhook_url).hostname}
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
                        icon={TestTube}
                        onClick={() => handleTestChannel(channel.id)}
                        disabled={testingChannel === channel.id}
                      >
                        Test
                      </Button>
                      <Button
                        variant={theme === 'dark' ? 'outline' : 'primary'}
                        size="sm"
                        icon={channel.enabled ? XCircle : CheckCircle}
                        onClick={() => handleToggleChannel(channel)}
                      >
                        {channel.enabled ? 'Disable' : 'Enable'}
                      </Button>
                      <Button
                        variant={theme === 'dark' ? 'outline' : 'primary'}
                        size="sm"
                        icon={Edit}
                        onClick={() => handleOpenEditModal(channel)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant={theme === 'dark' ? 'outline' : 'primary'}
                        size="sm"
                        icon={Trash2}
                        onClick={() => handleDeleteClick(channel)}
                        className="text-red-500 hover:text-red-600"
                      >
                        Delete
                      </Button>
                      <button
                        onClick={() => setExpandedChannel(isExpanded ? null : channel.id)}
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
                      {/* Configuration */}
                      <div className={`p-3 rounded-lg ${
                        theme === 'dark' ? 'bg-slate-800/50' : 'bg-slate-50'
                      }`}>
                        <p className={`text-xs font-medium mb-2 ${
                          theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                        }`}>
                          CONFIGURATION
                        </p>
                        <pre className={`text-xs font-mono ${
                          theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                        }`}>
                          {JSON.stringify(channel.config || {}, null, 2)}
                        </pre>
                      </div>
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
          setEditingChannel(null);
        }}
        title={editingChannel ? 'Edit Notification Channel' : 'Create Notification Channel'}
        size="lg"
      >
        <div className="space-y-4">
          {/* Channel Name */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
            }`}>
              Channel Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Security Team Email"
              className={`w-full px-4 py-2 rounded-lg border transition-all ${
                theme === 'dark'
                  ? 'bg-slate-900/50 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
                  : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500'
              }`}
            />
          </div>

          {/* Channel Type */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
            }`}>
              Channel Type *
            </label>
            <select
              value={formData.channel_type}
              onChange={(e) => setFormData({ ...formData, channel_type: e.target.value })}
              className={`w-full px-4 py-2 rounded-lg border transition-all ${
                theme === 'dark'
                  ? 'bg-slate-900/50 border-slate-700 text-white focus:border-blue-500'
                  : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
              }`}
            >
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="webhook">Webhook</option>
              <option value="push">Push Notification</option>
            </select>
          </div>

          {/* Email Configuration */}
          {formData.channel_type === 'email' && (
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
              }`}>
                Email Recipients *
              </label>
              <div className="space-y-2">
                {(formData.config.recipients || []).map((email, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => updateRecipient('email', index, e.target.value)}
                      placeholder="email@example.com"
                      className={`flex-1 px-4 py-2 rounded-lg border transition-all ${
                        theme === 'dark'
                          ? 'bg-slate-900/50 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
                          : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500'
                      }`}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={X}
                      onClick={() => removeRecipient('email', index)}
                    />
                  </div>
                ))}
                <Button
                  variant={theme === 'dark' ? 'outline' : 'primary'}
                  size="sm"
                  icon={Plus}
                  onClick={() => addRecipient('email')}
                >
                  Add Email
                </Button>
              </div>
            </div>
          )}

          {/* SMS/WhatsApp Configuration */}
          {['sms', 'whatsapp'].includes(formData.channel_type) && (
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
              }`}>
                Phone Numbers *
              </label>
              <div className="space-y-2">
                {(formData.config.phone_numbers || []).map((phone, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => updateRecipient('phone', index, e.target.value)}
                      placeholder="+1234567890"
                      className={`flex-1 px-4 py-2 rounded-lg border transition-all ${
                        theme === 'dark'
                          ? 'bg-slate-900/50 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
                          : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500'
                      }`}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={X}
                      onClick={() => removeRecipient('phone', index)}
                    />
                  </div>
                ))}
                <Button
                  variant={theme === 'dark' ? 'outline' : 'primary'}
                  size="sm"
                  icon={Plus}
                  onClick={() => addRecipient('phone')}
                >
                  Add Phone Number
                </Button>
              </div>
            </div>
          )}

          {/* Webhook Configuration */}
          {formData.channel_type === 'webhook' && (
            <>
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  Webhook URL *
                </label>
                <input
                  type="url"
                  value={formData.config.webhook_url || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    config: { ...formData.config, webhook_url: e.target.value }
                  })}
                  placeholder="https://example.com/webhook"
                  className={`w-full px-4 py-2 rounded-lg border transition-all ${
                    theme === 'dark'
                      ? 'bg-slate-900/50 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
                      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500'
                  }`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  API Key (Optional)
                </label>
                <input
                  type="text"
                  value={formData.config.api_key || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    config: { ...formData.config, api_key: e.target.value }
                  })}
                  placeholder="Bearer token or API key"
                  className={`w-full px-4 py-2 rounded-lg border transition-all ${
                    theme === 'dark'
                      ? 'bg-slate-900/50 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
                      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500'
                  }`}
                />
              </div>
            </>
          )}

          {/* Enabled Toggle */}
          <div className="flex items-center justify-between">
            <label className={`text-sm font-medium ${
              theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
            }`}>
              Enable this channel immediately
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
              variant="primary"
              fullWidth
              onClick={() => {
                setShowCreateModal(false);
                setShowEditModal(false);
                setEditingChannel(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              fullWidth
              icon={editingChannel ? CheckCircle : Plus}
              onClick={editingChannel ? handleUpdateChannel : handleCreateChannel}
            >
              {editingChannel ? 'Update Channel' : 'Create Channel'}
            </Button>
        </div>
      </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setChannelToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Notification Channel"
        confirmText="Delete Channel"
        cancelText="Cancel"
        variant="danger"
        loading={deleting}
      >
        <p className={`text-sm ${
          theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
        }`}>
          Are you sure you want to delete the channel <span className="font-semibold">{channelToDelete?.name}</span>?
          This action cannot be undone.
        </p>
      </ConfirmDialog>
    </div>
  );
}

export default TriggersTab;
