// FILE LOCATION: frontend/src/pages/PersonTracking/index.jsx

import React, { useState, useEffect } from 'react';
import { UserPlus, Users, Search, Filter, Eye, AlertCircle } from 'lucide-react';
import Button from '../../shared/components/ui/Button';
import Input from '../../shared/components/ui/Input';
import { useTheme } from '../../shared/contexts/ThemeContext';
import RegisterPersonModal from './components/RegisterPersonModal';
import PersonCard from './components/PersonCard';
import personService from '../../services/person.service';

const PersonTracking = () => {
  const { theme } = useTheme();
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [persons, setPersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Fetch persons with enhanced debugging
  const fetchPersons = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔍 Fetching persons with filter:', filterStatus);
      console.log('📋 Request params:', {
        status: filterStatus === 'all' ? null : filterStatus
      });
      
      const response = await personService.getAllPersons({
        status: filterStatus === 'all' ? null : filterStatus
      });
      
      console.log('📦 Full API Response:', response);
      console.log('👥 Persons array:', response.persons);
      console.log('📊 Total persons received:', response.persons?.length || 0);
      
      // Validate response structure
      if (!response || typeof response !== 'object') {
        throw new Error('Invalid response format');
      }
      
      // Check if persons is an array
      if (!Array.isArray(response.persons)) {
        console.warn('⚠️ persons is not an array:', response.persons);
        setPersons([]);
        return;
      }
      
      // Log each person's status for debugging
      response.persons.forEach((person, index) => {
        console.log(`Person ${index + 1}:`, {
          id: person.id,
          name: person.name,
          status: person.status,
          employee_id: person.employee_id
        });
      });
      
      setPersons(response.persons || []);
      console.log('✅ State updated with', response.persons.length, 'persons');
      
    } catch (error) {
      console.error('❌ Error fetching persons:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      setError(error.message || 'Failed to fetch persons');
      setPersons([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('🔄 Filter changed to:', filterStatus);
    fetchPersons();
  }, [filterStatus]);

  // Log when persons state changes
  useEffect(() => {
    console.log('📊 Persons state updated:', {
      total: persons.length,
      statuses: persons.map(p => ({ name: p.name, status: p.status }))
    });
  }, [persons]);

  // Handle successful registration
  const handleRegistrationSuccess = (newPerson) => {
    console.log('✅ Person registered:', newPerson);
    fetchPersons(); // Refresh list
  };

  // Filter persons based on search
  const filteredPersons = persons.filter(person => {
    const searchLower = searchQuery.toLowerCase();
    return (
      person.name?.toLowerCase().includes(searchLower) ||
      person.employee_id?.toLowerCase().includes(searchLower) ||
      person.office?.toLowerCase().includes(searchLower)
    );
  });

  console.log('🔎 Filtered persons:', {
    total: persons.length,
    filtered: filteredPersons.length,
    searchQuery
  });

  return (
    <div className={`min-h-screen ${
      theme === 'dark' ? 'bg-slate-900' : 'bg-slate-50'
    }`}>
      {/* Header */}
      <div className={`border-b ${
        theme === 'dark' ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-white'
      }`}>
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className={`text-2xl font-bold ${
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              }`}>
                Person Tracking
              </h1>
              <p className={`mt-1 text-sm ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
              }`}>
                Register and track individuals across cameras
              </p>
            </div>
            <Button
              onClick={() => setShowRegisterModal(true)}
              variant="primary"
              icon={UserPlus}
            >
              Register New Person
            </Button>
          </div>

          {/* Search and Filters */}
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by name, employee ID, or office..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={Search}
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  filterStatus === 'all'
                    ? 'bg-blue-500 text-white'
                    : theme === 'dark'
                      ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterStatus('registered')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  filterStatus === 'registered'
                    ? 'bg-blue-500 text-white'
                    : theme === 'dark'
                      ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                Registered
              </button>
              <button
                onClick={() => setFilterStatus('active')}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  filterStatus === 'active'
                    ? 'bg-blue-500 text-white'
                    : theme === 'dark'
                      ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                Active
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Error Message */}
        {error && (
          <div className={`mb-6 p-4 rounded-lg border flex items-start gap-3 ${
            theme === 'dark'
              ? 'bg-red-900/20 border-red-800 text-red-400'
              : 'bg-red-50 border-red-200 text-red-600'
          }`}>
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Error loading persons</p>
              <p className="text-sm mt-1 opacity-90">{error}</p>
              <button
                onClick={fetchPersons}
                className={`mt-2 text-sm font-medium underline ${
                  theme === 'dark' ? 'hover:text-red-300' : 'hover:text-red-700'
                }`}
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className={`rounded-xl border p-6 ${
            theme === 'dark'
              ? 'bg-slate-800 border-slate-700'
              : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  Total Registered
                </p>
                <p className={`text-3xl font-bold mt-1 ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  {persons.length}
                </p>
                {filterStatus !== 'all' && (
                  <p className={`text-xs mt-1 ${
                    theme === 'dark' ? 'text-slate-500' : 'text-slate-500'
                  }`}>
                    Filtered view
                  </p>
                )}
              </div>
              <div className={`p-3 rounded-lg ${
                theme === 'dark' ? 'bg-blue-500/20' : 'bg-blue-100'
              }`}>
                <Users className={`w-6 h-6 ${
                  theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                }`} />
              </div>
            </div>
          </div>

          <div className={`rounded-xl border p-6 ${
            theme === 'dark'
              ? 'bg-slate-800 border-slate-700'
              : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  Active Today
                </p>
                <p className={`text-3xl font-bold mt-1 ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  {persons.filter(p => p.status === 'active').length}
                </p>
              </div>
              <div className={`p-3 rounded-lg ${
                theme === 'dark' ? 'bg-emerald-500/20' : 'bg-emerald-100'
              }`}>
                <Eye className={`w-6 h-6 ${
                  theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'
                }`} />
              </div>
            </div>
          </div>

          <div className={`rounded-xl border p-6 ${
            theme === 'dark'
              ? 'bg-slate-800 border-slate-700'
              : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  Total Appearances
                </p>
                <p className={`text-3xl font-bold mt-1 ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  {persons.reduce((sum, p) => sum + (p.total_appearances || 0), 0)}
                </p>
              </div>
              <div className={`p-3 rounded-lg ${
                theme === 'dark' ? 'bg-amber-500/20' : 'bg-amber-100'
              }`}>
                <Filter className={`w-6 h-6 ${
                  theme === 'dark' ? 'text-amber-400' : 'text-amber-600'
                }`} />
              </div>
            </div>
          </div>
        </div>

        {/* Persons Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
              Loading persons...
            </p>
          </div>
        ) : filteredPersons.length === 0 ? (
          <div className={`text-center py-12 rounded-xl border ${
            theme === 'dark'
              ? 'bg-slate-800 border-slate-700'
              : 'bg-white border-slate-200'
          }`}>
            <Users className={`w-16 h-16 mx-auto mb-4 ${
              theme === 'dark' ? 'text-slate-600' : 'text-slate-300'
            }`} />
            <p className={`text-lg font-semibold mb-2 ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>
              {searchQuery 
                ? 'No persons found' 
                : filterStatus !== 'all'
                  ? `No persons with status "${filterStatus}"`
                  : 'No persons registered yet'
              }
            </p>
            <p className={`mb-6 ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>
              {searchQuery 
                ? 'Try adjusting your search query'
                : filterStatus !== 'all'
                  ? `Try clicking "All" to see all persons`
                  : 'Click "Register New Person" to add your first person'
              }
            </p>
            {!searchQuery && filterStatus === 'all' && (
              <Button
                onClick={() => setShowRegisterModal(true)}
                variant="primary"
                icon={UserPlus}
              >
                Register First Person
              </Button>
            )}
            {filterStatus !== 'all' && (
              <Button
                onClick={() => setFilterStatus('all')}
                variant="secondary"
              >
                Show All Persons
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className={`mb-4 text-sm ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>
              Showing {filteredPersons.length} of {persons.length} persons
              {filterStatus !== 'all' && ` (filtered by: ${filterStatus})`}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPersons.map((person) => (
                <PersonCard
                  key={person.id}
                  person={person}
                  onUpdate={fetchPersons}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Register Modal */}
      <RegisterPersonModal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        onSuccess={handleRegistrationSuccess}
      />
    </div>
  );
};

export default PersonTracking;