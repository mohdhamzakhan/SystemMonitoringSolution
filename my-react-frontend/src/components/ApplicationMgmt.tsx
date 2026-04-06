import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    CheckSquare,
    Square,
    AlertCircle,
    ArrowUpDown,
    Download,
    Filter,
    Trash2,
    RefreshCw,
    Search,
    Package,
    ChevronDown,
    Zap,
    Shield,
    Activity,
    Server,
    Plus,
    X,
    Clock
} from "lucide-react";
import Navbar from "./Navbar";
import useAuth from "./useAuth";
import { APP_CONSTANTS } from "../store";

interface Hostname {
    systemID: string;
    hostname: string;
    username: string;
    lastUpdateDate?: string;
}

interface System extends Hostname {
    status: string;
    statusMessage: string;
    lastAttemptDate: string;
}

interface Update {
    updateID: string | number;
    updateName: string;
    fileName?: string;
    isActive?: boolean;
}

interface SortConfig {
    key: keyof Hostname | keyof System;
    direction: "asc" | "desc";
}

const UpdateManagementPage = () => {
    useAuth();

    // Core state
    const [updates, setUpdates] = useState<Update[]>([]);
    const [hostnames, setHostnames] = useState<Hostname[]>([]);
    const [assignedSystems, setAssignedSystems] = useState<System[]>([]);
    const [filteredHostnames, setFilteredHostnames] = useState<Hostname[]>([]);
    const [filteredSystems, setFilteredSystems] = useState<System[]>([]);
    const [selectedUpdate, setSelectedUpdate] = useState("");
    const [selectedUpdateId, setSelectedUpdateId] = useState<number | null>(null);
    const [selectedHostnames, setSelectedHostnames] = useState<string[]>([]);

    // UI state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "completed" | "failed">("all");
    const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [tab, setTab] = useState<"dashboard" | "assign">("dashboard");
    const [showAssignModal, setShowAssignModal] = useState(false);

    const API_BASE_URL = APP_CONSTANTS.API_BASE_URL + "/api/installation";

    // API Functions
    const fetchUpdates = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/active-updates`);
            if (!response.ok) throw new Error("Failed to fetch updates");
            const data = await response.json();
            const allUpdates = data.$values || [];
            setUpdates(allUpdates);
            setError("");
        } catch {
            setError("Failed to fetch updates.");
        }
    }, []);

    const fetchHostnames = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/active-hosts`);
            if (!response.ok) throw new Error("Failed to fetch hostnames");
            const data = await response.json();
            const availableHostnames = data.$values || [];
            setHostnames(availableHostnames);
            setFilteredHostnames(availableHostnames);
            setError("");
        } catch {
            setError("Failed to fetch hostnames.");
        }
    }, []);

    const fetchAssignedSystems = useCallback(async (updateId: string) => {
        setLoading(true);
        setError("");
        try {
            const response = await fetch(`${API_BASE_URL}/assigned-hostnames?updateID=${updateId}`);
            if (!response.ok) throw new Error("Failed to fetch assigned systems");
            const data = await response.json();
            const systems = data.values?.$values || data.$values || [];
            setAssignedSystems(systems);
        } catch (err: any) {
            setError(err.message || "Failed to load assigned systems.");
            setAssignedSystems([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // Filter out already assigned hostnames
    const availableHostnames = useMemo(() => {
        const assignedSystemIDs = assignedSystems.map(s => s.systemID);
        return hostnames.filter(h => !assignedSystemIDs.includes(h.systemID));
    }, [hostnames, assignedSystems]);

    // Effects
    useEffect(() => {
        fetchUpdates();
    }, [fetchUpdates]);

    useEffect(() => {
        if (selectedUpdate) {
            fetchHostnames();
            setSelectedHostnames([]);
            const idNum = Number(selectedUpdate);
            setSelectedUpdateId(Number.isFinite(idNum) ? idNum : null);
            fetchAssignedSystems(selectedUpdate);
        } else {
            setSelectedUpdateId(null);
            setAssignedSystems([]);
            setFilteredSystems([]);
            setHostnames([]);
            setFilteredHostnames([]);
            setSelectedHostnames([]);
        }
    }, [selectedUpdate, fetchHostnames, fetchAssignedSystems]);

    // Filtering & Sorting
    const filteredData = useMemo(() => {
        if (tab === "assign") {
            let result = [...availableHostnames];
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                result = result.filter((h) =>
                    h.hostname?.toLowerCase().includes(term) ||
                    h.username?.toLowerCase().includes(term)
                );
            }
            if (sortConfig) {
                result.sort((a, b) => {
                    const aVal = a[sortConfig.key as keyof typeof a];
                    const bVal = b[sortConfig.key as keyof typeof b];
                    if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
                    if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
                    return 0;
                });
            }
            setFilteredHostnames(result);
            return result;
        } else {
            let filtered = assignedSystems;
            if (statusFilter !== "all") {
                filtered = filtered.filter(
                    (system) => system.status.toLowerCase() === statusFilter
                );
            }
            if (searchTerm) {
                const q = searchTerm.toLowerCase();
                filtered = filtered.filter(
                    (system) =>
                        system.hostname.toLowerCase().includes(q) ||
                        system.username.toLowerCase().includes(q) ||
                        system.statusMessage.toLowerCase().includes(q)
                );
            }
            if (sortConfig) {
                filtered = [...filtered].sort((a, b) => {
                    let aVal = (a as any)[sortConfig.key];
                    let bVal = (b as any)[sortConfig.key];
                    if (sortConfig.key === "lastAttemptDate") {
                        aVal = new Date(aVal).getTime();
                        bVal = new Date(bVal).getTime();
                    }
                    if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
                    if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
                    return 0;
                });
            }
            setFilteredSystems(filtered);
            return filtered;
        }
    }, [tab, availableHostnames, assignedSystems, searchTerm, statusFilter, sortConfig]);

    const requestSort = (key: string) => {
        let direction: "asc" | "desc" = "asc";
        if (sortConfig?.key === key && sortConfig?.direction === "asc") {
            direction = "desc";
        }
        setSortConfig({ key: key as any, direction });
    };

    const getStatusStyle = (status: string) => {
        switch (status.toLowerCase()) {
            case "pending": return "bg-amber-100 text-amber-800 border-amber-200";
            case "completed": return "bg-emerald-100 text-emerald-800 border-emerald-200";
            case "failed": return "bg-red-100 text-red-800 border-red-200";
            default: return "bg-gray-100 text-gray-800 border-gray-200";
        }
    };

    // Handlers
    const handleCheckboxChange = (systemID: string) => {
        setSelectedHostnames((prev) =>
            prev.includes(systemID)
                ? prev.filter((id) => id !== systemID)
                : [...prev, systemID]
        );
    };

    const handleSelectAllVisible = () => {
        const visibleIds = filteredHostnames.map((h) => h.systemID);
        const allSelected = visibleIds.every((id) => selectedHostnames.includes(id));
        if (allSelected) {
            setSelectedHostnames((prev) => prev.filter((id) => !visibleIds.includes(id)));
        } else {
            setSelectedHostnames((prev) => [
                ...prev,
                ...visibleIds.filter((id) => !prev.includes(id)),
            ]);
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!selectedUpdate) {
            setError("Please select an update.");
            return;
        }
        if (selectedHostnames.length === 0) {
            setError("No hostnames selected.");
            return;
        }

        const payload = {
            SystemIDs: selectedHostnames,
            UpdateID: selectedUpdate,
            Status: "Pending",
            StatusMessage: "Update assigned.",
            LastAttemptDate: new Date().toISOString(),
        };

        setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/assign-update`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!response.ok) throw new Error("Failed to assign update.");
            alert("✅ Update assigned successfully!");
            setSelectedHostnames([]);
            setShowAssignModal(false);
            setTab("dashboard");
            fetchAssignedSystems(selectedUpdate);
        } catch {
            setError("Failed to assign update. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (systemID: number, updateID: number, hostname: string) => {
        if (!window.confirm(`Are you sure you want to delete the pending task for ${hostname}?`)) return;
        setDeletingId(systemID);
        try {
            const response = await fetch(
                `${API_BASE_URL}/system-update/${systemID}/${updateID}`,
                { method: "DELETE" }
            );
            if (response.ok) {
                alert("✅ Task deleted successfully!");
                if (selectedUpdate) fetchAssignedSystems(selectedUpdate);
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || "Failed to delete");
            }
        } catch (err: any) {
            alert(`❌ ${err.message || "Failed to delete task. Please try again."}`);
        } finally {
            setDeletingId(null);
        }
    };

    const handleReassign = async (hostname: string, updateId: number) => {
        try {
            const response = await fetch(`${API_BASE_URL}/reassign`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ Hostname: hostname, UpdateId: updateId }),
            });
            if (response.ok) {
                alert("✅ Task reassigned successfully!");
                fetchAssignedSystems(String(updateId));
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || "Failed to reassign");
            }
        } catch (err: any) {
            alert(`❌ ${err.message || "Failed to reassign task."}`);
        }
    };

    const exportToCSV = () => {
        const headers = ["Hostname", "Username", "Status", "Status Message", "Last Attempt Date"];
        const rows = filteredSystems.map((system) => [
            system.hostname,
            system.username,
            system.status,
            system.statusMessage,
            new Date(system.lastAttemptDate).toLocaleString(),
        ]);
        const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows]
            .map((row) => row.map((cell) => `"${cell}"`).join(","))
            .join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `assigned_systems_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const counts = useMemo(() => ({
        pending: assignedSystems.filter((s) => s.status.toLowerCase() === "pending").length,
        completed: assignedSystems.filter((s) => s.status.toLowerCase() === "completed").length,
        failed: assignedSystems.filter((s) => s.status.toLowerCase() === "failed").length,
    }), [assignedSystems]);

    const renderSortArrow = (key: string) => {
        if (!sortConfig || sortConfig.key !== key) return null;
        return sortConfig.direction === "asc" ? " ▲" : " ▼";
    };

    const selectedUpdateInfo = updates.find(u => String(u.updateID) === selectedUpdate);

    return (
        <>
            <Navbar />
            <div className="min-h-screen bg-gray-50">
                <div className="max-w-7xl mx-auto px-6 lg:px-2 py-10">
                    {/*<div className="w-full px-2 py-8">*/}
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
                            <div>
                                <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight">
                                    Update Management
                                </h1>
                                <p className="mt-2 text-lg text-gray-600">
                                    Deploy updates at scale with real-time monitoring
                                </p>
                            </div>
                            <div className="mt-6 lg:mt-0 flex items-center gap-3">
                                <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
                                    <select
                                        value={selectedUpdate}
                                        onChange={(e) => setSelectedUpdate(e.target.value)}
                                        disabled={loading}
                                        className="text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
                                    >
                                        <option value="">Select update package</option>
                                        {updates.map((update) => (
                                            <option key={update.updateID} value={String(update.updateID)}>
                                                {update.updateName || update.fileName} (ID: {update.updateID})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {selectedUpdate && (
                                    <button
                                        onClick={() => setShowAssignModal(true)}
                                        className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
                                    >
                                        <Plus className="w-4 h-4 inline mr-2" />
                                        Assign Update
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Stats Cards */}
                        {selectedUpdate && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-all">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-500">Available Hosts</p>
                                            <p className="text-3xl font-bold text-gray-900">{availableHostnames.length}</p>
                                        </div>
                                        <div className="p-3 bg-blue-100 rounded-lg">
                                            <Server className="w-6 h-6 text-blue-600" />
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-all">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-500">Assigned Systems</p>
                                            <p className="text-3xl font-bold text-gray-900">{assignedSystems.length}</p>
                                        </div>
                                        <div className="p-3 bg-emerald-100 rounded-lg">
                                            <Activity className="w-6 h-6 text-emerald-600" />
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-all">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-500">Pending</p>
                                            <p className="text-3xl font-bold text-amber-600">{counts.pending}</p>
                                        </div>
                                        <div className="p-3 bg-amber-100 rounded-lg">
                                            <Clock className="w-6 h-6 text-amber-600" />
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-all">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-500">Completed</p>
                                            <p className="text-3xl font-bold text-emerald-600">{counts.completed}</p>
                                        </div>
                                        <div className="p-3 bg-emerald-100 rounded-lg">
                                            <CheckSquare className="w-6 h-6 text-emerald-600" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Main Content */}
                    {selectedUpdate ? (
                        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                            {/* Tabs */}
                            <div className="border-b border-gray-200 bg-gray-50">
                                <nav className="flex space-x-8 px-6 py-4">
                                    <button
                                        onClick={() => setTab("dashboard")}
                                        className={`py-2 px-4 font-medium text-sm rounded-md transition-colors ${tab === "dashboard"
                                                ? "bg-white text-gray-900 border-b-2 border-blue-500 shadow-sm"
                                                : "text-gray-500 hover:text-gray-700 hover:bg-white/50"
                                            }`}
                                    >
                                        Dashboard
                                    </button>
                                    <button
                                        onClick={() => setTab("assign")}
                                        className={`py-2 px-4 font-medium text-sm rounded-md transition-colors ${tab === "assign"
                                                ? "bg-white text-gray-900 border-b-2 border-blue-500 shadow-sm"
                                                : "text-gray-500 hover:text-gray-700 hover:bg-white/50"
                                            }`}
                                    >
                                        Assign Hosts ({availableHostnames.length})
                                    </button>
                                </nav>
                            </div>

                            {/* Tab Content */}
                            <div className="p-6 lg:p-8">
                                {tab === "dashboard" && (
                                    <>
                                        {/* Controls */}
                                        <div className="flex flex-col lg:flex-row gap-4 mb-8">
                                            <div className="relative flex-1 max-w-md">
                                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                                <input
                                                    type="text"
                                                    placeholder="Search by hostname, username, status..."
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                />
                                            </div>
                                            <div className="flex gap-2">
                                                {[
                                                    { key: "all", label: `All (${assignedSystems.length})` },
                                                    { key: "pending", label: `Pending (${counts.pending})` },
                                                    { key: "completed", label: `Completed (${counts.completed})` },
                                                    { key: "failed", label: `Failed (${counts.failed})` },
                                                ].map(({ key, label }) => (
                                                    <button
                                                        key={key}
                                                        onClick={() => setStatusFilter(key as any)}
                                                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${statusFilter === key
                                                                ? "bg-blue-600 text-white border-blue-600"
                                                                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                                                            }`}
                                                    >
                                                        {label}
                                                    </button>
                                                ))}
                                            </div>
                                            <button
                                                onClick={exportToCSV}
                                                className="px-6 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors flex items-center gap-2"
                                            >
                                                <Download className="w-4 h-4" />
                                                Export
                                            </button>
                                        </div>

                                        {/* Table */}
                                        {loading ? (
                                            <div className="text-center py-12">
                                                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                                                <p className="text-gray-600">Loading systems...</p>
                                            </div>
                                        ) : filteredSystems.length > 0 ? (
                                            <div className="overflow-x-auto">
                                                <table className="min-w-full divide-y divide-gray-200">
                                                    <thead className="bg-gray-50">
                                                        <tr>
                                                            {[
                                                                { key: "hostname", label: "Hostname" },
                                                                { key: "username", label: "Username" },
                                                                { key: "status", label: "Status" },
                                                                { key: "statusMessage", label: "Status Message" },
                                                                { key: "lastAttemptDate", label: "Last Attempt" },
                                                                { label: "Actions" },
                                                            ].map(({ key, label }) => (
                                                                <th
                                                                    key={key || "actions"}
                                                                    className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                                                    onClick={key ? () => requestSort(key) : undefined}
                                                                >
                                                                    {label} {renderSortArrow(key || "")}
                                                                </th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white divide-y divide-gray-200">
                                                        {filteredSystems.map((system) => (
                                                            <tr key={system.systemID} className="hover:bg-gray-50">
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                                    {system.hostname}
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                                    {system.username}
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusStyle(system.status)}`}>
                                                                        {system.status}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-4 text-sm text-gray-900 max-w-md truncate">
                                                                    {system.statusMessage}
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                                    {new Date(system.lastAttemptDate).toLocaleString()}
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                                                    {system.status.toLowerCase() === "completed" && selectedUpdateId && (
                                                                        <button
                                                                            onClick={() => handleReassign(system.hostname, selectedUpdateId)}
                                                                            className="text-blue-600 hover:text-blue-900 px-3 py-1 rounded-md hover:bg-blue-50 transition-colors"
                                                                        >
                                                                            Reassign
                                                                        </button>
                                                                    )}
                                                                    {system.status.toLowerCase() === "pending" && selectedUpdateId && (
                                                                        <button
                                                                            onClick={() => handleDelete(Number(system.systemID), selectedUpdateId, system.hostname)}
                                                                            disabled={deletingId === Number(system.systemID)}
                                                                            className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </button>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <div className="text-center py-12">
                                                <Filter className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                                                <h3 className="text-lg font-medium text-gray-900 mb-2">No systems found</h3>
                                                <p className="text-gray-500">Try adjusting your search or filter criteria</p>
                                            </div>
                                        )}
                                    </>
                                )}

                                {tab === "assign" && (
                                    <>
                                        <div className="mb-8">
                                            <div className="relative flex-1 max-w-md mx-auto">
                                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                                <input
                                                    type="text"
                                                    placeholder="Search available hosts..."
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                />
                                            </div>
                                        </div>

                                        <form onSubmit={handleSubmit}>
                                            {filteredHostnames.length > 0 ? (
                                                <div className="overflow-x-auto">
                                                    <table className="min-w-full divide-y divide-gray-200">
                                                        <thead className="bg-gray-50">
                                                            <tr>
                                                                <th className="px-6 py-3">
                                                                    <input
                                                                        type="checkbox"
                                                                        onChange={handleSelectAllVisible}
                                                                        checked={filteredHostnames.every((h) => selectedHostnames.includes(h.systemID))}
                                                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                                    />
                                                                </th>
                                                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                                    Hostname
                                                                </th>
                                                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                                    Username
                                                                </th>
                                                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                                    Last Update
                                                                </th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="bg-white divide-y divide-gray-200">
                                                            {filteredHostnames.map((host) => (
                                                                <tr key={host.systemID} className="hover:bg-gray-50">
                                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={selectedHostnames.includes(host.systemID)}
                                                                            onChange={() => handleCheckboxChange(host.systemID)}
                                                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                                        />
                                                                    </td>
                                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                                        {host.hostname}
                                                                    </td>
                                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                                        {host.username}
                                                                    </td>
                                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                                        {host.lastUpdateDate
                                                                            ? new Date(host.lastUpdateDate).toLocaleString()
                                                                            : "Never"}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <div className="text-center py-12">
                                                    <Server className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                                                    <h3 className="text-lg font-medium text-gray-900 mb-2">No available hosts</h3>
                                                    <p className="text-gray-500">All hosts have been assigned this update</p>
                                                </div>
                                            )}

                                            <div className="mt-8 text-center">
                                                <button
                                                    type="submit"
                                                    disabled={loading || selectedHostnames.length === 0}
                                                    className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                >
                                                    Assign Update to {selectedHostnames.length} Host(s)
                                                </button>
                                            </div>
                                        </form>
                                    </>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-20 bg-white border-2 border-dashed border-gray-200 rounded-xl">
                            <Package className="w-20 h-20 text-gray-400 mx-auto mb-6" />
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">Select an update package</h3>
                            <p className="text-gray-500 text-lg">Choose an update from the dropdown above to get started</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Floating Assign Modal */}
            {showAssignModal && selectedUpdate && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-8 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-bold text-gray-900">
                                    Assign Update to Hosts
                                </h2>
                                <button
                                    onClick={() => setShowAssignModal(false)}
                                    className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <p className="text-gray-600 mt-2">
                                Selected Update: <span className="font-semibold text-blue-600">{selectedUpdateInfo?.updateName}</span>
                            </p>
                        </div>

                        <div className="p-8">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search available hosts..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            {filteredHostnames.length > 0 ? (
                                <div className="space-y-4 mb-8">
                                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                        <label className="flex items-center space-x-3">
                                            <input
                                                type="checkbox"
                                                onChange={handleSelectAllVisible}
                                                checked={filteredHostnames.every((h) => selectedHostnames.includes(h.systemID))}
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-5 w-5"
                                            />
                                            <span className="font-semibold text-gray-900">
                                                Select All ({filteredHostnames.length})
                                            </span>
                                        </label>
                                        <span className="text-lg font-bold text-blue-600 bg-blue-100 px-4 py-2 rounded-lg">
                                            {selectedHostnames.length} selected
                                        </span>
                                    </div>

                                    <div className="max-h-96 overflow-y-auto space-y-3">
                                        {filteredHostnames.map((host) => (
                                            <div key={host.systemID} className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedHostnames.includes(host.systemID)}
                                                    onChange={() => handleCheckboxChange(host.systemID)}
                                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-5 w-5 mr-4"
                                                />
                                                <div>
                                                    <div className="font-semibold text-gray-900">{host.hostname}</div>
                                                    <div className="text-sm text-gray-600">{host.username}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <Server className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                                    <p className="text-gray-600">No available hosts found</p>
                                </div>
                            )}

                            <div className="flex gap-4 pt-6 border-t border-gray-200">
                                <button
                                    type="button"
                                    onClick={() => setShowAssignModal(false)}
                                    className="flex-1 px-6 py-3 border border-gray-300 text-gray-900 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    onClick={handleSubmit}
                                    disabled={selectedHostnames.length === 0 || loading}
                                    className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                                >
                                    Assign to {selectedHostnames.length} Hosts
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default UpdateManagementPage;
