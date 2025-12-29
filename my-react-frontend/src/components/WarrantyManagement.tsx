import React, { useState, useEffect } from 'react';
import { Search, Edit, Save, X, Plus, Calendar, Trash2, AlertCircle, CheckCircle } from 'lucide-react';
import Navbar from './Navbar';
import { APP_CONSTANTS } from '../store';
import axios from 'axios';

interface SystemDetail {
  hostname: string;
  biosSerial?: string;
  startDate?: string;
  endDate?: string;
  model?: string;
  make?: string;
  daysRemaining?: number;
}

function WarrantyManagement() {
  const [systems, setSystems] = useState<SystemDetail[]>([]);
  const [filteredSystems, setFilteredSystems] = useState<SystemDetail[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingHostname, setEditingHostname] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<SystemDetail | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    fetchSystems();
  }, []);

  useEffect(() => {
    const filtered = systems.filter(system =>
      system.hostname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      system.biosSerial?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      system.model?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredSystems(filtered);
  }, [searchTerm, systems]);

  const fetchSystems = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${APP_CONSTANTS.API_BASE_URL}/api/warranty/all`);
      const systemsData = response.data?.$values || response.data || [];
      
      // Map the data to match frontend naming
      const mappedData = systemsData.map((system: any) => ({
        hostname: system.hostname,
        biosSerial: system.serialNumber,
        startDate: system.warrantyStartDate ? system.warrantyStartDate.split('T')[0] : '',
        endDate: system.warrantyEndDate ? system.warrantyEndDate.split('T')[0] : '',
        model: system.model,
        make: system.make,
        daysRemaining: system.daysRemaining
      }));
      
      setSystems(mappedData);
      setFilteredSystems(mappedData);
    } catch (error) {
      console.error('Error fetching systems:', error);
      showNotification('error', 'Failed to load systems');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleEdit = (system: SystemDetail) => {
    setEditingHostname(system.hostname);
    setEditForm({
      ...system,
      startDate: system.startDate || '',
      endDate: system.endDate || ''
    });
  };

  const handleCancelEdit = () => {
    setEditingHostname(null);
    setEditForm(null);
  };

  const handleSave = async () => {
    if (!editForm) return;

    try {
      const response = await axios.put(
        `${APP_CONSTANTS.API_BASE_URL}/api/warranty/update/${editForm.hostname}`,
        {
          hostname: editForm.hostname,
          serialNumber: editForm.biosSerial,
          warrantyStartDate: editForm.startDate || null,
          warrantyEndDate: editForm.endDate || null,
          model: editForm.model,
          make: editForm.make
        }
      );

      if (response.status === 200) {
        showNotification('success', 'Warranty updated successfully');
        fetchSystems();
        handleCancelEdit();
      }
    } catch (error) {
      console.error('Error updating warranty:', error);
      showNotification('error', 'Failed to update warranty');
    }
  };

  const handleDelete = async (hostname: string) => {
    if (!window.confirm(`Are you sure you want to delete warranty info for ${hostname}?`)) {
      return;
    }

    try {
      const response = await axios.delete(
        `${APP_CONSTANTS.API_BASE_URL}/api/warranty/delete/${hostname}`
      );

      if (response.status === 200) {
        showNotification('success', 'Warranty deleted successfully');
        fetchSystems();
      }
    } catch (error) {
      console.error('Error deleting warranty:', error);
      showNotification('error', 'Failed to delete warranty');
    }
  };

  const handleAddNew = async (newSystem: SystemDetail) => {
    try {
      const response = await axios.post(
        `${APP_CONSTANTS.API_BASE_URL}/api/warranty/add`,
        {
          hostname: newSystem.hostname,
          serialNumber: newSystem.biosSerial,
          warrantyStartDate: newSystem.startDate || null,
          warrantyEndDate: newSystem.endDate || null,
          model: newSystem.model,
          make: newSystem.make
        }
      );

      if (response.status === 200 || response.status === 201) {
        showNotification('success', 'Warranty added successfully');
        fetchSystems();
        setShowAddModal(false);
      }
    } catch (error: any) {
      console.error('Error adding warranty:', error);
      const errorMsg = error.response?.data?.message || 'Failed to add warranty';
      showNotification('error', errorMsg);
    }
  };

  const getDaysRemaining = (endDate?: string) => {
    if (!endDate) return null;
    const today = new Date();
    const end = new Date(endDate);
    const days = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const getStatusBadge = (endDate?: string) => {
    const days = getDaysRemaining(endDate);
    if (days === null) return <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">No Info</span>;
    if (days < 0) return <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">Expired ({Math.abs(days)} days ago)</span>;
    if (days <= 30) return <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs">Critical</span>;
    if (days <= 60) return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs">Warning</span>;
    return <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">Active</span>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Navbar />

      {/* Notification */}
      {notification && (
        <div className={`fixed top-20 right-4 z-50 px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 ${
          notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white animate-slide-in`}>
          {notification.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {notification.message}
        </div>
      )}

      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Warranty Management</h1>
          <p className="text-gray-600">Manage and update warranty information for all systems</p>
        </div>

        {/* Search and Actions */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-[300px] relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by hostname, serial number, or model..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            {/* <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add New System
            </button> */}
          </div>
          <div className="mt-3 text-sm text-gray-600">
            Showing {filteredSystems.length} of {systems.length} systems
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-500">Loading systems...</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hostname</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Serial Number</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Make/Model</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">End Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days Left</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredSystems.map((system, index) => (
                    <tr key={system.hostname} className="hover:bg-gray-50">
                      {editingHostname === system.hostname ? (
                        <>
                          <td className="px-6 py-4 font-medium text-gray-900">{system.hostname}</td>
                          <td className="px-6 py-4">
                            <input
                              type="text"
                              value={editForm?.biosSerial || ''}
                              onChange={(e) => setEditForm({ ...editForm!, biosSerial: e.target.value })}
                              className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-indigo-500"
                              placeholder="Serial Number"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              <input
                                type="text"
                                value={editForm?.make || ''}
                                onChange={(e) => setEditForm({ ...editForm!, make: e.target.value })}
                                className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-indigo-500 text-sm"
                                placeholder="Make"
                              />
                              <input
                                type="text"
                                value={editForm?.model || ''}
                                onChange={(e) => setEditForm({ ...editForm!, model: e.target.value })}
                                className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-indigo-500 text-sm"
                                placeholder="Model"
                              />
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="date"
                              value={editForm?.startDate || ''}
                              onChange={(e) => setEditForm({ ...editForm!, startDate: e.target.value })}
                              className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="date"
                              value={editForm?.endDate || ''}
                              onChange={(e) => setEditForm({ ...editForm!, endDate: e.target.value })}
                              className="w-full px-2 py-1 border rounded focus:ring-2 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="px-6 py-4" colSpan={2}>
                            <div className="flex gap-2">
                              <button
                                onClick={handleSave}
                                className="flex items-center gap-1 bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-sm"
                              >
                                <Save className="w-4 h-4" />
                                Save
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="flex items-center gap-1 bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700 text-sm"
                              >
                                <X className="w-4 h-4" />
                                Cancel
                              </button>
                            </div>
                          </td>
                          <td></td>
                        </>
                      ) : (
                        <>
                          <td className="px-6 py-4 font-medium text-gray-900">{system.hostname}</td>
                          <td className="px-6 py-4 text-gray-600 text-sm">{system.biosSerial || '—'}</td>
                          <td className="px-6 py-4 text-gray-600 text-sm">
                            {system.make && system.model ? `${system.make} ${system.model}` : system.make || system.model || '—'}
                          </td>
                          <td className="px-6 py-4 text-gray-600 text-sm">
                            {system.startDate ? new Date(system.startDate).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-6 py-4 text-gray-600 text-sm">
                            {system.endDate ? new Date(system.endDate).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-6 py-4">{getStatusBadge(system.endDate)}</td>
                          <td className="px-6 py-4 text-gray-600 text-sm">
                            {getDaysRemaining(system.endDate) !== null ? `${getDaysRemaining(system.endDate)} days` : '—'}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleEdit(system)}
                                className="text-blue-600 hover:text-blue-800 p-1"
                                title="Edit"
                              >
                                <Edit className="w-5 h-5" />
                              </button>
                              {/* <button
                                onClick={() => handleDelete(system.hostname)}
                                className="text-red-600 hover:text-red-800 p-1"
                                title="Delete"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button> */}
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredSystems.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No systems found
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add New Modal */}
      {showAddModal && (
        <AddSystemModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddNew}
        />
      )}
    </div>
  );
}

// Add System Modal Component
function AddSystemModal({ onClose, onAdd }: { onClose: () => void, onAdd: (system: SystemDetail) => void }) {
  const [formData, setFormData] = useState<SystemDetail>({
    hostname: '',
    biosSerial: '',
    make: '',
    model: '',
    startDate: '',
    endDate: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Add New System</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hostname *</label>
            <input
              type="text"
              required
              value={formData.hostname}
              onChange={(e) => setFormData({ ...formData, hostname: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g., DESKTOP-001"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number</label>
            <input
              type="text"
              value={formData.biosSerial}
              onChange={(e) => setFormData({ ...formData, biosSerial: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g., ABC123456"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Make</label>
              <input
                type="text"
                value={formData.make}
                onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g., Dell"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
              <input
                type="text"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g., OptiPlex"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Warranty Start Date</label>
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Warranty End Date</label>
            <input
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="submit"
              className="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              Add System
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default WarrantyManagement;