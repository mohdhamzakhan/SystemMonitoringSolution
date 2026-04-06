import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle, Clock, XCircle, Server, Eye, Monitor, ExternalLink } from 'lucide-react';
import Navbar from './Navbar';
import axios from 'axios';
import { APP_CONSTANTS } from "../store.js";

const DEVICE_BASE_URL = 'http://10.235.20.49:5296/device';

const CustomCard = ({ children, className = '' }) => (
    <div className={`bg-white rounded-lg shadow-md ${className}`}>
        {children}
    </div>
);

// Tile filter config — maps tile key → filter label + filter function
const TILE_CONFIG = {
    total: {
        label: 'All Systems',
        color: 'border-blue-500',
        filter: () => true,
    },
    active: {
        label: 'Active Warranties',
        color: 'border-green-500',
        filter: (w) => {
            if (!w.warrantyEndDate) return false;
            return new Date(w.warrantyEndDate) >= new Date();
        },
    },
    expired: {
        label: 'Expired Warranties',
        color: 'border-red-500',
        filter: (w) => {
            if (!w.warrantyEndDate) return false;
            return new Date(w.warrantyEndDate) < new Date();
        },
    },
    expiring30: {
        label: 'Expiring in 30 Days',
        color: 'border-orange-500',
        filter: (w) => {
            if (!w.warrantyEndDate) return false;
            const today = new Date();
            const end = new Date(w.warrantyEndDate);
            const days = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
            return days >= 0 && days <= 30;
        },
    },
    expiring60: {
        label: 'Expiring in 30–60 Days',
        color: 'border-yellow-500',
        filter: (w) => {
            if (!w.warrantyEndDate) return false;
            const today = new Date();
            const end = new Date(w.warrantyEndDate);
            const days = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
            return days > 30 && days <= 60;
        },
    },
    noInfo: {
        label: 'No Warranty Info',
        color: 'border-gray-500',
        filter: (w) => !w.warrantyEndDate,
    },
};

function MainPage() {
    const [statistics, setStatistics] = useState(null);
    const [allWarranties, setAllWarranties] = useState([]);
    const [expiringWarranties, setExpiringWarranties] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTile, setSelectedTile] = useState<string | null>(null);
    const detailsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchWarrantyData();
    }, []);

    const fetchWarrantyData = async () => {
        setLoading(true);
        try {
            const API_BASE = `${APP_CONSTANTS.API_BASE_URL}/api/warranty`;

            const [statsResponse, expiringResponse, allResponse] = await Promise.all([
                fetch(`${API_BASE}/statistics`),
                fetch(`${API_BASE}/expiring?months=3`),
                fetch(`${API_BASE}/all`),
            ]);

            const statsData = await statsResponse.json();
            const expiringData = await expiringResponse.json();
            const allData = await allResponse.json();

            setStatistics(statsData);

            const systemsArray = expiringData.systems?.$values || expiringData.systems || [];
            setExpiringWarranties(systemsArray);

            const allArray = allData.$values || allData || [];
            setAllWarranties(allArray);
        } catch (error) {
            console.error('Error fetching warranty data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleTileClick = (tileKey: string) => {
        setSelectedTile(prev => {
            const next = prev === tileKey ? null : tileKey;
            if (next) {
                setTimeout(() => {
                    detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 50);
            }
            return next;
        });
    };

    const getFilteredSystems = () => {
        if (!selectedTile || !TILE_CONFIG[selectedTile]) return [];
        return allWarranties.filter(TILE_CONFIG[selectedTile].filter);
    };

    const getWarrantyStatus = (warrantyEndDate) => {
        if (!warrantyEndDate) return { status: 'unknown', label: 'No Info', color: 'bg-gray-100 text-gray-600 border-gray-200', icon: '—', days: null };

        const today = new Date();
        const endDate = new Date(warrantyEndDate);
        const daysUntilExpiry = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntilExpiry < 0) return { status: 'expired', label: 'Expired', color: 'bg-red-100 text-red-800 border-red-200', icon: '⚠️', days: Math.abs(daysUntilExpiry) };
        if (daysUntilExpiry <= 30) return { status: 'expiring-30', label: 'Expiring Soon', color: 'bg-orange-100 text-orange-800 border-orange-200', icon: '🔴', days: daysUntilExpiry };
        if (daysUntilExpiry <= 60) return { status: 'expiring-60', label: 'Expiring in 60d', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: '🟡', days: daysUntilExpiry };
        if (daysUntilExpiry <= 90) return { status: 'expiring-90', label: 'Expiring in 90d', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: '🔵', days: daysUntilExpiry };
        return { status: 'active', label: 'Active', color: 'bg-green-100 text-green-800 border-green-200', icon: '✅', days: daysUntilExpiry };
    };

    const StatTile = ({ tileKey, title, value, icon: Icon, color, subtitle }) => {
        const isSelected = selectedTile === tileKey;
        return (
            <div
                onClick={() => handleTileClick(tileKey)}
                className={`
          bg-white rounded-lg shadow-md p-6 transition-all cursor-pointer border-l-4 ${color}
          ${isSelected
                        ? 'ring-2 ring-offset-2 ring-indigo-400 shadow-lg scale-[1.02]'
                        : 'hover:shadow-lg hover:scale-[1.01]'
                    }
        `}
            >
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-gray-600 text-sm font-medium">{title}</p>
                        <p className="text-3xl font-bold mt-2">{value ?? '—'}</p>
                        {subtitle && <p className="text-gray-500 text-xs mt-1">{subtitle}</p>}
                        {isSelected && (
                            <p className="text-indigo-600 text-xs mt-2 font-semibold">▼ Showing details below</p>
                        )}
                    </div>
                    <div className={`p-3 rounded-full ${color.replace('border-', 'bg-').replace('-500', '-100')}`}>
                        <Icon className={`w-6 h-6 ${color.replace('border-', 'text-')}`} />
                    </div>
                </div>
            </div>
        );
    };

    // The systems shown in the "tile detail" table
    const filteredSystems = getFilteredSystems();

    const SystemsTable = ({ systems, title }: { systems: any[]; title: string }) => (
        <CustomCard className="mb-6">
            <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSelectedTile(null)}
                            className="text-gray-400 hover:text-gray-600 transition-colors text-lg font-bold leading-none"
                            title="Close"
                        >
                            ✕
                        </button>
                        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
                    </div>
                    <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium">
                        {systems.length} System{systems.length !== 1 ? 's' : ''}
                    </span>
                </div>

                {systems.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                            <CheckCircle className="h-8 w-8 text-green-600" />
                        </div>
                        <p className="text-gray-500 text-lg font-medium">No systems found in this category</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-6 py-3 text-left font-semibold text-gray-600">Hostname</th>
                                    <th className="px-6 py-3 text-left font-semibold text-gray-600">Serial Number</th>
                                    <th className="px-6 py-3 text-left font-semibold text-gray-600">Make / Model</th>
                                    <th className="px-6 py-3 text-left font-semibold text-gray-600">Warranty Start</th>
                                    <th className="px-6 py-3 text-left font-semibold text-gray-600">Warranty End</th>
                                    <th className="px-6 py-3 text-left font-semibold text-gray-600">Days Remaining</th>
                                    <th className="px-6 py-3 text-left font-semibold text-gray-600">Status</th>
                                    <th className="px-6 py-3 text-center font-semibold text-gray-600">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {systems.map((warranty, index) => {
                                    const warrantyStatus = getWarrantyStatus(warranty.warrantyEndDate);
                                    return (
                                        <tr
                                            key={warranty.$id || warranty.hostname || index}
                                            className={`transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'} hover:bg-blue-50/30`}
                                        >
                                            {/* Hostname — clickable link */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-9 w-9 flex items-center justify-center rounded-full bg-blue-100 border">
                                                        <Monitor className="h-4 w-4 text-blue-600" />
                                                    </div>
                                                    <a
                                                        href={`${DEVICE_BASE_URL}/${warranty.hostname}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="font-medium text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-1"
                                                    >
                                                        {warranty.hostname || 'Unknown'}
                                                        <ExternalLink className="h-3 w-3 opacity-60" />
                                                    </a>
                                                </div>
                                            </td>

                                            <td className="px-6 py-4 text-gray-700">{warranty.serialNumber || '—'}</td>

                                            <td className="px-6 py-4 text-gray-700">
                                                {[warranty.make, warranty.model].filter(Boolean).join(' / ') || '—'}
                                            </td>

                                            <td className="px-6 py-4 text-gray-700">
                                                {warranty.warrantyStartDate
                                                    ? new Date(warranty.warrantyStartDate).toLocaleDateString()
                                                    : '—'}
                                            </td>

                                            <td className="px-6 py-4 text-gray-700">
                                                {warranty.warrantyEndDate
                                                    ? new Date(warranty.warrantyEndDate).toLocaleDateString()
                                                    : '—'}
                                            </td>

                                            <td className="px-6 py-4">
                                                {warrantyStatus.days !== null ? (
                                                    <span className={`
                            inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium
                            ${warranty.daysRemaining <= 30
                                                            ? 'bg-red-50 text-red-700 border border-red-200'
                                                            : 'bg-yellow-50 text-yellow-700 border border-yellow-200'}
                          `}>
                                                        {warranty.daysRemaining ?? warrantyStatus.days} days
                                                    </span>
                                                ) : '—'}
                                            </td>

                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${warrantyStatus.color}`}>
                                                    <span>{warrantyStatus.icon}</span>
                                                    {warrantyStatus.label}
                                                </span>
                                            </td>

                                            <td className="px-6 py-4 text-center">
                                                <a
                                                    href={`${DEVICE_BASE_URL}/${warranty.hostname}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                                                >
                                                    <Eye className="h-3.5 w-3.5" />
                                                    View Details
                                                </a>
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
    );

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
                <p className="text-xs text-gray-400 mb-3">Click any tile to view the systems in that category</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    <StatTile tileKey="total" title="Total Systems" value={statistics?.totalSystems} icon={Server} color="border-blue-500" subtitle="Monitored devices" />
                    <StatTile tileKey="active" title="Active Warranties" value={statistics?.activeWarranties} icon={CheckCircle} color="border-green-500" subtitle="Currently covered" />
                    <StatTile tileKey="expired" title="Expired Warranties" value={statistics?.expiredWarranties} icon={XCircle} color="border-red-500" subtitle="Needs attention" />
                    <StatTile tileKey="expiring30" title="Expiring in 30 Days" value={statistics?.expiringIn30Days} icon={AlertCircle} color="border-orange-500" subtitle="Urgent action required" />
                    <StatTile tileKey="expiring60" title="Expiring in 60 Days" value={statistics?.expiringIn60Days} icon={Clock} color="border-yellow-500" subtitle="Plan renewal soon" />
                    <StatTile tileKey="noInfo" title="No Warranty Info" value={statistics?.noWarrantyInfo} icon={AlertCircle} color="border-gray-500" subtitle="Data missing" />
                </div>

                {/* Tile Detail Table (shown when a tile is selected) */}
                {selectedTile && (
                    <div ref={detailsRef}>
                        <SystemsTable
                            systems={filteredSystems}
                            title={TILE_CONFIG[selectedTile]?.label || 'Systems'}
                        />
                    </div>
                )}

                {/* Systems expiring in 3 months (always visible) */}
                <CustomCard className="mb-6">
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-semibold text-gray-900">
                                Systems with Warranty Expiring in 3 Months
                            </h2>
                            <span className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-sm font-medium">
                                {expiringWarranties.length} Systems
                            </span>
                        </div>

                        {expiringWarranties.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                                    <CheckCircle className="h-8 w-8 text-green-600" />
                                </div>
                                <p className="text-gray-500 text-lg font-medium">No warranties expiring in the next 3 months</p>
                                <p className="text-gray-400 text-sm mt-1">All systems are covered</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-lg border border-gray-200">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-gray-50 border-b">
                                        <tr>
                                            <th className="px-6 py-3 text-left font-semibold text-gray-600">Hostname</th>
                                            <th className="px-6 py-3 text-left font-semibold text-gray-600">Serial Number</th>
                                            <th className="px-6 py-3 text-left font-semibold text-gray-600">Warranty End Date</th>
                                            <th className="px-6 py-3 text-left font-semibold text-gray-600">Days Remaining</th>
                                            <th className="px-6 py-3 text-left font-semibold text-gray-600">Status</th>
                                            <th className="px-6 py-3 text-center font-semibold text-gray-600">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {expiringWarranties.map((warranty, index) => {
                                            const warrantyStatus = getWarrantyStatus(warranty.warrantyEndDate);
                                            return (
                                                <tr
                                                    key={warranty.$id || index}
                                                    className={`transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'} hover:bg-blue-50/30`}
                                                >
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-9 w-9 flex items-center justify-center rounded-full bg-blue-100 border">
                                                                <Monitor className="h-4 w-4 text-blue-600" />
                                                            </div>
                                                            <a
                                                                href={`${DEVICE_BASE_URL}/${warranty.hostname}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="font-medium text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-1"
                                                            >
                                                                {warranty.hostname || 'Unknown'}
                                                                <ExternalLink className="h-3 w-3 opacity-60" />
                                                            </a>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-900">{warranty.serialNumber || '—'}</td>
                                                    <td className="px-6 py-4 text-gray-900">
                                                        {warranty.warrantyEndDate ? new Date(warranty.warrantyEndDate).toLocaleDateString() : '—'}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${warranty.daysRemaining <= 30 ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'}`}>
                                                            {warranty.daysRemaining || 0} days
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${warrantyStatus?.color || 'bg-gray-100 text-gray-600'}`}>
                                                            <span>{warrantyStatus?.icon}</span>
                                                            {warrantyStatus?.label || 'Unknown'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <a
                                                            href={`${APP_CONSTANTS.API_BASE_URL}/api/${warranty.hostname}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                                                        >
                                                            <Eye className="h-3.5 w-3.5" />
                                                            View Details
                                                        </a>
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
                        onClick={fetchWarrantyData}
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