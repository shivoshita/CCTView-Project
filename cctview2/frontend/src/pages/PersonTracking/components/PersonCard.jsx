// FILE LOCATION: frontend/src/pages/PersonTracking/components/PersonCard.jsx

import React, { useState } from 'react';
import { User, MapPin, CreditCard, Droplet, Eye, Trash2, MoreVertical, AlertCircle } from 'lucide-react';
import Badge from '../../../shared/components/ui/Badge';
import { useTheme } from '../../../shared/contexts/ThemeContext';
import personService from '../../../services/person.service';
import ConfirmDialogBox from '../../../shared/components/ui/ConfirmDialogBox';

const PersonCard = ({ person, onUpdate }) => {
  const { theme } = useTheme();
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await personService.deletePerson(person.id);
      console.log('✅ Person deleted:', person.id);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('❌ Error deleting person:', error);
      alert('Failed to delete person');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const getStatusVariant = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'registered': return 'info';
      case 'inactive': return 'default';
      default: return 'default';
    }
  };

  // Get photo URL with auth token
  const getPhotoUrl = () => {
    const token = localStorage.getItem('token');
    const baseUrl = '/api/v1';
    return `${baseUrl}/persons/${person.id}/photo?token=${token}`;
  };

  console.log('Person data:', person); // Debug log

  return (
    <>
      <div className={`rounded-xl border overflow-hidden transition-all hover:shadow-lg ${
        theme === 'dark'
          ? 'bg-slate-800 border-slate-700'
          : 'bg-white border-slate-200'
      }`}>
        {/* Photo Section */}
        <div className="relative h-48 bg-gradient-to-br from-blue-500/20 to-purple-500/20">
          {!imageError ? (
            <img
              src={getPhotoUrl()}
              alt={person.name || 'Person'}
              className="w-full h-full object-cover"
              onError={(e) => {
                console.error('Image failed to load for person:', person.id);
                setImageError(true);
              }}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center">
              <User className={`w-20 h-20 mb-2 ${
                theme === 'dark' ? 'text-slate-600' : 'text-slate-300'
              }`} />
              <span className={`text-xs ${
                theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
              }`}>
                Photo unavailable
              </span>
            </div>
          )}

          {/* Status Badge */}
          <div className="absolute top-3 right-3">
            <Badge variant={getStatusVariant(person.status)} dot>
              {person.status || 'unknown'}
            </Badge>
          </div>

          {/* Menu Button */}
          <div className="absolute top-3 left-3">
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className={`p-2 rounded-lg backdrop-blur-sm transition-colors ${
                  theme === 'dark'
                    ? 'bg-slate-900/50 hover:bg-slate-900/70 text-white'
                    : 'bg-white/50 hover:bg-white/70 text-slate-900'
                }`}
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {/* Dropdown Menu */}
              {showMenu && (
                <>
                  {/* Backdrop to close menu */}
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowMenu(false)}
                  />
                  
                  <div className={`absolute top-full left-0 mt-1 py-1 rounded-lg shadow-lg z-20 min-w-[150px] ${
                    theme === 'dark'
                      ? 'bg-slate-800 border border-slate-700'
                      : 'bg-white border border-slate-200'
                  }`}>
                    <button
                      onClick={() => {
                        setShowDeleteConfirm(true);
                        setShowMenu(false);
                      }}
                      className={`w-full px-4 py-2 text-left flex items-center gap-2 transition-colors ${
                        theme === 'dark'
                          ? 'hover:bg-slate-700 text-red-400'
                          : 'hover:bg-slate-100 text-red-600'
                      }`}
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Details Section */}
        <div className="p-4 space-y-3">
          {/* Name */}
          <div>
            <h3 className={`text-lg font-bold ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>
              {person.name || 'Unknown'}
            </h3>
          </div>

          {/* Info Grid */}
          <div className="space-y-2">
            {person.employee_id && (
              <div className="flex items-center gap-2">
                <CreditCard className={`w-4 h-4 flex-shrink-0 ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                }`} />
                <span className={`text-sm ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  {person.employee_id}
                </span>
              </div>
            )}

            {person.office && (
              <div className="flex items-center gap-2">
                <MapPin className={`w-4 h-4 flex-shrink-0 ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                }`} />
                <span className={`text-sm truncate ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  {person.office}
                </span>
              </div>
            )}

            {person.blood_group && (
              <div className="flex items-center gap-2">
                <Droplet className={`w-4 h-4 flex-shrink-0 ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
                }`} />
                <span className={`text-sm ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  Blood Group: {person.blood_group}
                </span>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className={`pt-3 border-t flex items-center justify-between ${
            theme === 'dark' ? 'border-slate-700' : 'border-slate-200'
          }`}>
            <div className="flex items-center gap-2">
              <Eye className={`w-4 h-4 ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-500'
              }`} />
              <span className={`text-sm ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
              }`}>
                {person.total_appearances || 0} appearances
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialogBox
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Person"
        message={`Are you sure you want to delete ${person.name || 'this person'}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        loading={deleting}
      />
    </>
  );
};

export default PersonCard;