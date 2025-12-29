import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Clock, XCircle, Server, Calendar, Eye, Monitor } from 'lucide-react';
import Navbar from './Navbar';
import { APP_CONSTANTS } from '../store';
import axios from 'axios';

// CustomCard component
const CustomCard = ({ children, className = '' }) => (
  <div className={`bg-white rounded-lg shadow-md ${className}`}>
    {children}
  </div>
);

function MainPage() {
  const [statistics, setStatistics] = useState(null);
  const [expiringWarranties, setExpiringWarranties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTile, setSelectedTile] = useState(null);
  const [warrantyDevices, setWarrantyDevices] = useState<any[]>([]);
  const [loadingWarranty, setLoadingWarranty] = useState(false);

  useEffect(() => {
    fetchWarrantyData();
    fetchWarrantyDevices();
  }, []);

  const fetchWarrantyDevices = async () => {
    setLoadingWarranty(true);
    try {
      const response = await axios.get(
        `${APP_CONSTANTS.API_BASE_URL}/api/devices/Warranty`
      );
      
      console.log('Raw API Response:', response.data);
      
      const devices = response.data?.$values || response.data || [];
      console.log('Parsed devices array:', devices);
      console.log('Total devices count:', devices.length);
      
      // Log first device structure to understand the data
      if (devices.length > 0) {
        console.log('First device structure:', JSON.stringify(devices[0], null, 2));
      }
      
      // Filter devices expiring in next 60 days
      const expiringDevices = devices.filter(device => {
        // Try different possible property names
        const warrantyEndDate = device.systemDetail?.warrantyenddate || 
                               device.systemDetail?.warrantyEndDate ||
                               device.systemDetail?.EndDate ||
                               device.warrantyenddate ||
                               device.warrantyEndDate ||
                               device.endDate;
        
        console.log(`Device: ${device.systemDetail?.hostname || device.hostname}, Warranty End Date:`, warrantyEndDate);
        
        if (!warrantyEndDate) return false;
        
        const today = new Date();
        const endDate = new Date(warrantyEndDate);
        const daysUntilExpiry = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        console.log(`  -> Days until expiry: ${daysUntilExpiry}`);
        
        return daysUntilExpiry > 0 && daysUntilExpiry <= 60;
      }).sort((a, b) => {
        // Sort by expiry date (soonest first)
        const dateA = new Date(a.systemDetail?.warrantyenddate || a.systemDetail?.warrantyEndDate);
        const dateB = new Date(b.systemDetail?.warrantyenddate || b.systemDetail?.warrantyEndDate);
        return dateA.getTime() - dateB.getTime();
      });
      
      console.log('Filtered expiring devices:', expiringDevices);
      console.log('Expiring devices count:', expiringDevices.length);
      setWarrantyDevices(expiringDevices);
    } catch (error) {
      console.error("Error fetching warranty devices:", error);
    } finally {
      setLoadingWarranty(false);
    }
  };

  const fetchWarrantyData = async () => {
    try {
      const API_BASE = `${APP_CONSTANTS.API_BASE_URL}/api/warranty`;
      
      const [statsResponse, expiringResponse] = await Promise.all([
        fetch(`${API_BASE}/statistics`),
        fetch(`${API_BASE}/expiring?months=2`)
      ]);

      const statsData = await statsResponse.json();
      const expiringData = await expiringResponse.json();

      console.log('Statistics:', statsData);
      console.log('Expiring warranties:', expiringData);

      setStatistics(statsData);
      
      // Handle both $values format and direct array format
      const systemsArray = expiringData.systems?.$values || expiringData.systems || [];
      console.log('Parsed systems array:', systemsArray);
      setExpiringWarranties(systemsArray);
    } catch (error) {
      console.error('Error fetching warranty data:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatTile = ({ title, value, icon: Icon, color, onClick, subtitle }) => (
    <div 
      onClick={onClick}
      className={`bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-all cursor-pointer border-l-4 ${color}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-600 text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
          {subtitle && <p className="text-gray-500 text-xs mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-full ${color.replace('border-', 'bg-').replace('-500', '-100')}`}>
          <Icon className={`w-6 h-6 ${color.replace('border-', 'text-')}`} />
        </div>
      </div>
    </div>
  );

  const getWarrantyStatus = (warrantyEndDate) => {
    if (!warrantyEndDate) return null;
    
    const today = new Date();
    const endDate = new Date(warrantyEndDate);
    const daysUntilExpiry = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) {
      return {
        status: 'expired',
        label: 'Expired',
        color: 'bg-red-100 text-red-800 border-red-200',
        icon: '⚠️',
        days: Math.abs(daysUntilExpiry)
      };
    } else if (daysUntilExpiry <= 30) {
      return {
        status: 'expiring-30',
        label: 'Expiring in 30 Days',
        color: 'bg-orange-100 text-orange-800 border-orange-200',
        icon: '🔴',
        days: daysUntilExpiry
      };
    } else if (daysUntilExpiry <= 60) {
      return {
        status: 'expiring-60',
        label: 'Expiring in 60 Days',
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        icon: '🟡',
        days: daysUntilExpiry
      };
    } else if (daysUntilExpiry <= 90) {
      return {
        status: 'expiring-90',
        label: 'Expiring in 90 Days',
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        icon: '🔵',
        days: daysUntilExpiry
      };
    }
    
    return {
      status: 'active',
      label: 'Active',
      color: 'bg-green-100 text-green-800 border-green-200',
      icon: '✅',
      days: daysUntilExpiry
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <Navbar />
        
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading warranty data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Navbar />

      <div className="max-w-7xl mx-auto p-6">
        {/* Warning Banner */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-yellow-600 mr-3" />
            <p className="text-yellow-800 font-medium">
              If you are not from IT Department, kindly do not use this application
            </p>
          </div>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <StatTile
            title="Total Systems"
            value={statistics?.totalSystems || 0}
            icon={Server}
            color="border-blue-500"
            subtitle="Monitored devices"
          />
          <StatTile
            title="Active Warranties"
            value={statistics?.activeWarranties || 0}
            icon={CheckCircle}
            color="border-green-500"
            subtitle="Currently covered"
          />
          <StatTile
            title="Expired Warranties"
            value={statistics?.expiredWarranties || 0}
            icon={XCircle}
            color="border-red-500"
            subtitle="Needs attention"
          />
          <StatTile
            title="Expiring in 30 Days"
            value={statistics?.expiringIn30Days || 0}
            icon={AlertCircle}
            color="border-orange-500"
            subtitle="Urgent action required"
            onClick={() => setSelectedTile('30days')}
          />
          <StatTile
            title="Expiring in 60 Days"
            value={statistics?.expiringIn60Days || 0}
            icon={Clock}
            color="border-yellow-500"
            subtitle="Plan renewal soon"
            onClick={() => setSelectedTile('60days')}
          />
          <StatTile
            title="No Warranty Info"
            value={statistics?.noWarrantyInfo || 0}
            icon={AlertCircle}
            color="border-gray-500"
            subtitle="Data missing"
          />
        </div>

        {/* Systems with Warranty Expiring in 2 Months */}
        <CustomCard className="mb-6">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Systems with Warranty Expiring in 2 Months
              </h2>
              <span className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-sm font-medium">
                {expiringWarranties.length} Systems
              </span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-500">Loading devices...</p>
                </div>
              </div>
            ) : expiringWarranties.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <p className="text-gray-500 text-lg font-medium">
                  No warranties expiring in the next 2 months
                </p>
                <p className="text-gray-400 text-sm mt-1">
                  All systems are covered
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left font-semibold text-gray-600">
                        Hostname
                      </th>
                      <th className="px-6 py-3 text-left font-semibold text-gray-600">
                        Serial Number
                      </th>
                      <th className="px-6 py-3 text-left font-semibold text-gray-600">
                        Warranty End Date
                      </th>
                      <th className="px-6 py-3 text-left font-semibold text-gray-600">
                        Days Remaining
                      </th>
                      <th className="px-6 py-3 text-left font-semibold text-gray-600">
                        Status
                      </th>
                      <th className="px-6 py-3 text-center font-semibold text-gray-600">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {expiringWarranties.map((warranty, index) => {
                      const warrantyStatus = getWarrantyStatus(warranty.warrantyEndDate);
                      
                      return (
                        <tr
                          key={warranty.$id || index}
                          className={`
                            transition-colors
                            ${index % 2 === 0 ? "bg-white" : "bg-gray-50/40"}
                            hover:bg-blue-50/30
                          `}
                        >
                          {/* Hostname */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 flex items-center justify-center rounded-full bg-blue-100 border">
                                <Monitor className="h-4 w-4 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">
                                  {warranty.hostname || "Unknown"}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Serial Number */}
                          <td className="px-6 py-4 text-gray-900">
                            {warranty.serialNumber || "—"}
                          </td>

                          {/* Warranty End Date */}
                          <td className="px-6 py-4 text-gray-900">
                            {warranty.warrantyEndDate 
                              ? new Date(warranty.warrantyEndDate).toLocaleDateString()
                              : "—"
                            }
                          </td>

                          {/* Days Remaining */}
                          <td className="px-6 py-4">
                            <span className={`
                              inline-flex items-center gap-1.5 px-2.5 py-1
                              rounded-md text-xs font-medium
                              ${warranty.daysRemaining <= 30 
                                ? "bg-red-50 text-red-700 border border-red-200"
                                : "bg-yellow-50 text-yellow-700 border border-yellow-200"
                              }
                            `}>
                              {warranty.daysRemaining || 0} days
                            </span>
                          </td>

                          {/* Status */}
                          <td className="px-6 py-4">
                            <span className={`
                              inline-flex items-center gap-1.5 px-2.5 py-1
                              rounded-md text-xs font-medium border
                              ${warrantyStatus?.color || 'bg-gray-100 text-gray-600'}
                            `}>
                              <span>{warrantyStatus?.icon}</span>
                              {warrantyStatus?.label || "Unknown"}
                            </span>
                          </td>

                          {/* Action */}
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => window.location.href = `/device/${warranty.hostname}`}
                              className="
                                inline-flex items-center gap-1.5
                                px-3 py-1.5 text-xs font-medium
                                rounded-md border border-blue-200
                                text-blue-700 bg-blue-50
                                hover:bg-blue-100
                                transition-colors
                              "
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View Details
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CustomCard>

        {/* Action Buttons */}
        <div className="mt-6 flex gap-4">
          <button 
            onClick={() => {
              fetchWarrantyData();
            }}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            Refresh Data
          </button>
          <button className="bg-white text-indigo-600 border border-indigo-600 px-6 py-2 rounded-lg hover:bg-indigo-50 transition-colors font-medium">
            Export Report
          </button>
        </div>
      </div>
    </div>
  );
}

export default MainPage;