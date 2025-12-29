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
  Server
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
  const [tab, setTab] = useState<"assign" | "dashboard">("assign");

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
      let result = [...hostnames];
      if (searchTerm) {
        result = result.filter((h) =>
          h.hostname.toLowerCase().includes(searchTerm.toLowerCase())
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
  }, [tab, hostnames, assignedSystems, searchTerm, statusFilter, sortConfig]);

  const requestSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig?.key === key && sortConfig?.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key: key as any, direction });
  };

  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending": return "bg-gradient-to-r from-amber-400/20 to-orange-400/20 text-amber-800 border-2 border-amber-200/50 backdrop-blur-sm";
      case "completed": return "bg-gradient-to-r from-emerald-400/20 to-teal-400/20 text-emerald-800 border-2 border-emerald-200/50 backdrop-blur-sm";
      case "failed": return "bg-gradient-to-r from-red-400/20 to-rose-400/20 text-red-800 border-2 border-red-200/50 backdrop-blur-sm";
      default: return "bg-gradient-to-r from-gray-400/20 to-gray-500/20 text-gray-800 border-2 border-gray-200/50 backdrop-blur-sm";
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
      setHostnames([]);
      setFilteredHostnames([]);
      setTab("dashboard");
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          
          {/* Hero Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 bg-white/60 backdrop-blur-xl px-6 py-3 rounded-2xl border border-white/40 shadow-xl mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-gray-900 via-indigo-900 to-purple-900 bg-clip-text text-transparent">
                  Update Management
                </h1>
                <p className="text-sm md:text-base text-gray-600 mt-1 font-medium">
                  Deploy updates at scale with real-time monitoring
                </p>
              </div>
            </div>
          </div>


          {/* Global Update Selector - FIXED ON TOP */}
          <div className="bg-white/70 backdrop-blur-xl sticky top-16 z-30 rounded-2xl shadow-xl border border-white/50 p-1 mb-6 max-w-3xl mx-auto">
            <div className="bg-gradient-to-r from-indigo-600/90 to-purple-600/90 p-0.5 rounded-2xl">
              <select
                value={selectedUpdate}
                onChange={(e) => setSelectedUpdate(e.target.value)}
                disabled={loading}
                className="w-full appearance-none bg-white/95 px-4 py-3 text-base md:text-lg font-semibold text-gray-900 border-0 rounded-2xl shadow-md focus:outline-none focus:ring-2 focus:ring-white/60 focus:ring-offset-2 focus:ring-offset-indigo-500/30 transition"
              >
                <option value="">Select update package</option>
                {updates.map((update) => (
                  <option key={update.updateID} value={String(update.updateID)}>
                    {update.updateName || update.fileName} (ID: {update.updateID})
                  </option>
                ))}
              </select>
            </div>
            {selectedUpdate && selectedUpdateInfo && (
              <div className="mt-2 px-4 pb-3">
                <p className="text-sm md:text-base text-gray-700">
                  Selected: <span className="font-semibold text-indigo-700">{selectedUpdateInfo.updateName}</span>
                </p>
              </div>
            )}
          </div>


          {/* Stats Cards - Only when update selected */}
          {selectedUpdate && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 max-w-5xl mx-auto">
               <div className="group bg-white/70 backdrop-blur-xl rounded-3xl p-8 border border-white/50 shadow-xl hover:shadow-3xl transition-all duration-500 hover:-translate-y-2">
                <div className="flex items-center justify-between">
                   <div className="p-4 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl">
                    <Server className="w-8 h-8 text-white" />
                  </div>
                  <Shield className="w-12 h-12 text-indigo-400 group-hover:text-indigo-500 transition" />
                </div>
                <div className="mt-6">
                  <p className="text-2xl font-extrabold text-gray-900">{hostnames.length}</p>
                  <p className="text-sm text-gray-600 font-medium mt-1">Available hosts</p>
                </div>
              </div>
              <div className="group bg-white/70 backdrop-blur-xl rounded-3xl p-8 border border-white/50 shadow-xl hover:shadow-3xl transition-all duration-500 hover:-translate-y-2">
                <div className="flex items-center justify-between">
                  <div className="p-4 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl">
                    <Activity className="w-8 h-8 text-white" />
                  </div>
                  <Shield className="w-12 h-12 text-emerald-400 group-hover:text-emerald-500 transition" />
                </div>
                <div className="mt-6">
                  <p className="text-2xl font-extrabold text-gray-900">{assignedSystems.length}</p>
                   <p className="text-sm text-gray-600 font-medium mt-1">Assigned Systems</p>
                </div>
              </div>
              <div className="group bg-white/70 backdrop-blur-xl rounded-3xl p-8 border border-white/50 shadow-xl hover:shadow-3xl transition-all duration-500 hover:-translate-y-2">
                <div className="flex items-center justify-between">
                  <div className="p-4 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl">
                    <Activity className="w-8 h-8 text-white" />
                  </div>
                  <Shield className="w-12 h-12 text-amber-400 group-hover:text-amber-500 transition" />
                </div>
                <div className="mt-6">
                  <p className="text-2xl font-extrabold text-gray-900">{counts.pending}</p>
                   <p className="text-sm text-gray-600 font-medium mt-1">Pending</p>
                </div>
              </div>
              <div className="group bg-white/70 backdrop-blur-xl rounded-3xl p-8 border border-white/50 shadow-xl hover:shadow-3xl transition-all duration-500 hover:-translate-y-2">
                <div className="flex items-center justify-between">
                  <div className="p-4 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl">
                    <Activity className="w-8 h-8 text-white" />
                  </div>
                  <Shield className="w-12 h-12 text-green-400 group-hover:text-green-500 transition" />
                </div>
                <div className="mt-6">
                  <p className="text-2xl font-extrabold text-gray-900">{counts.completed}</p>
                   <p className="text-sm text-gray-600 font-medium mt-1">Completed</p>
                </div>
              </div>
            </div>
          )}

          {/* Main Container */}
          <div className="bg-white/60 backdrop-blur-3xl rounded-4xl shadow-3xl border border-white/30 overflow-hidden max-w-7xl mx-auto">
            
            {/* Enhanced Tab Navigation */}
            <div className="px-12 py-8 border-b border-white/20 bg-gradient-to-r from-indigo-50/80 to-purple-50/80">
              <div className="flex bg-gradient-to-r from-white/70 to-white/50 backdrop-blur-xl rounded-3xl p-1 shadow-2xl overflow-hidden">
                <button
                  onClick={() => setTab("assign")}
                  className={`flex-1 py-5 px-8 rounded-2xl font-bold text-lg transition-all duration-300 relative overflow-hidden group ${
                    tab === "assign"
                      ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-2xl scale-105"
                      : "text-gray-700 hover:bg-white/50 hover:text-gray-900 hover:shadow-xl"
                  }`}
                >
                  <span className="relative z-10">📋 Assign Updates</span>
                  {tab === "assign" && (
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent" />
                  )}
                </button>
                <button
                  onClick={() => setTab("dashboard")}
                  className={`flex-1 py-5 px-8 rounded-2xl font-bold text-lg transition-all duration-300 relative overflow-hidden group ${
                    tab === "dashboard"
                      ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-2xl scale-105"
                      : "text-gray-700 hover:bg-white/50 hover:text-gray-900 hover:shadow-xl"
                  }`}
                >
                  <span className="relative z-10">📊 Dashboard</span>
                  {tab === "dashboard" && (
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent" />
                  )}
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="p-12">
              {error && (
                <div className="mb-12 p-6 bg-gradient-to-r from-red-50/80 to-rose-50/80 border-2 border-red-200/50 rounded-3xl backdrop-blur-xl flex items-center shadow-xl">
                  <AlertCircle className="h-8 w-8 text-red-500 mr-4 flex-shrink-0" />
                  <span className="text-lg text-red-900 font-semibold">{error}</span>
                </div>
              )}

              {/* Assign Tab */}
              {tab === "assign" && selectedUpdate && (
                <form onSubmit={handleSubmit} className="space-y-12">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div>
                      <label className="block text-xl font-bold text-gray-800 mb-6">🔍 Search Available Hosts</label>
                      <div className="relative">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 w-7 h-7" />
                        <input
                          type="text"
                          placeholder="Search by hostname or username..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full pl-20 pr-8 py-6 text-xl border-2 border-gray-200/50 bg-white/80 backdrop-blur-xl rounded-3xl focus:outline-none focus:ring-4 focus:ring-indigo-500/30 focus:border-indigo-500 shadow-2xl transition-all duration-300 hover:shadow-3xl"
                        />
                      </div>
                    </div>
                  </div>

                  {filteredHostnames.length > 0 && (
                    <div className="bg-white/70 backdrop-blur-xl rounded-4xl border border-white/50 shadow-3xl overflow-hidden">
                      <div className="px-8 py-6 border-b border-white/30 bg-gradient-to-r from-indigo-50/80 to-blue-50/80 flex justify-between items-center">
                        <label className="flex items-center space-x-4">
                          <input
                            type="checkbox"
                            onChange={handleSelectAllVisible}
                            checked={filteredHostnames.every((h) => selectedHostnames.includes(h.systemID))}
                            className="w-7 h-7 rounded-2xl border-3 border-indigo-300 text-indigo-600 focus:ring-indigo-500 bg-white shadow-lg"
                          />
                          <span className="text-2xl font-bold text-gray-800">
                            Select All Visible ({filteredHostnames.length})
                          </span>
                        </label>
                        <div className="text-2xl font-black text-indigo-600 bg-indigo-100 px-6 py-3 rounded-3xl shadow-xl">
                          {selectedHostnames.length} selected
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200/30">
                          <thead className="bg-white/50">
                            <tr>
                              <th className="px-8 py-6 text-left">
                                <span className="sr-only">Select</span>
                              </th>
                              <th className="px-8 py-6 text-left text-lg font-bold text-gray-800 uppercase tracking-wider cursor-pointer hover:bg-indigo-50/50 transition group">
                                Hostname 
                                <ArrowUpDown className="ml-2 inline w-6 h-6 group-hover:opacity-75" />
                                {renderSortArrow("hostname")}
                              </th>
                              <th className="px-8 py-6 text-left text-lg font-bold text-gray-800 uppercase tracking-wider cursor-pointer hover:bg-indigo-50/50 transition group">
                                Username 
                                <ArrowUpDown className="ml-2 inline w-6 h-6 group-hover:opacity-75" />
                                {renderSortArrow("username")}
                              </th>
                              <th className="px-8 py-6 text-left text-lg font-bold text-gray-800 uppercase tracking-wider cursor-pointer hover:bg-indigo-50/50 transition group">
                                Last Update 
                                <ArrowUpDown className="ml-2 inline w-6 h-6 group-hover:opacity-75" />
                                {renderSortArrow("lastUpdateDate")}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200/30">
                            {filteredHostnames.map((host) => (
                              <tr key={host.systemID} className="hover:bg-indigo-50/30 transition-all duration-200">
                                <td className="px-8 py-6">
                                  <input
                                    type="checkbox"
                                    checked={selectedHostnames.includes(host.systemID)}
                                    onChange={() => handleCheckboxChange(host.systemID)}
                                    className="w-7 h-7 rounded-2xl border-3 border-indigo-300 text-indigo-600 focus:ring-indigo-500 bg-white shadow-lg hover:scale-110 transition"
                                  />
                                </td>
                                <td className="px-8 py-6 text-xl font-bold text-gray-900">
                                  {host.hostname}
                                </td>
                                <td className="px-8 py-6 text-xl text-gray-700 font-semibold">
                                  {host.username}
                                </td>
                                <td className="px-8 py-6 text-lg text-gray-500">
                                  {host.lastUpdateDate
                                    ? new Date(host.lastUpdateDate).toLocaleString()
                                    : "Never"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-center pt-12">
                    <button
                      type="submit"
                      disabled={loading || selectedHostnames.length === 0}
                      className="group relative px-16 py-8 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white text-2xl font-black rounded-4xl shadow-4xl hover:shadow-5xl focus:outline-none focus:ring-8 focus:ring-white/50 focus:ring-offset-4 focus:ring-offset-indigo-500/20 transition-all duration-500 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <span className="relative z-10 flex items-center gap-4">
                        🚀 Assign Update to <span className="text-3xl">{selectedHostnames.length}</span> Host(s)
                      </span>
                    </button>
                  </div>
                </form>
              )}

              {/* Dashboard Tab */}
              {tab === "dashboard" && selectedUpdate && (
                <div className="space-y-12">
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                    <div className="xl:col-span-2">
                      <label className="block text-xl font-bold text-gray-800 mb-6">🔍 Search Systems</label>
                      <div className="relative">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 w-7 h-7" />
                        <input
                          type="text"
                          placeholder="Search by hostname, username, status message..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full pl-20 pr-8 py-6 text-xl border-2 border-gray-200/50 bg-white/80 backdrop-blur-xl rounded-3xl focus:outline-none focus:ring-4 focus:ring-indigo-500/30 focus:border-indigo-500 shadow-2xl transition-all duration-300 hover:shadow-3xl"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xl font-bold text-gray-800 mb-6">🎚️ Filter Status</label>
                      <div className="space-y-3">
                        {[
                          { key: "all" as const, label: `All (${assignedSystems.length})`, color: "indigo" },
                          { key: "pending" as const, label: `⏳ Pending (${counts.pending})`, color: "amber" },
                          { key: "completed" as const, label: `✅ Completed (${counts.completed})`, color: "emerald" },
                          { key: "failed" as const, label: `❌ Failed (${counts.failed})`, color: "red" },
                        ].map(({ key, label, color }) => (
                          <button
                            key={key}
                            onClick={() => setStatusFilter(key)}
                            className={`w-full py-6 px-8 rounded-3xl font-bold text-lg transition-all duration-300 shadow-xl hover:shadow-3xl ${
                              statusFilter === key
                                ? `bg-gradient-to-r from-${color}-600 to-${color}-700 text-white shadow-3xl scale-[1.02]`
                                : "bg-white/80 backdrop-blur-xl border-2 border-gray-200/50 text-gray-800 hover:border-gray-300 hover:bg-white/90"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end mb-8">
                    <button
                      onClick={exportToCSV}
                      className="flex items-center gap-4 px-10 py-6 bg-white/90 backdrop-blur-xl border-2 border-gray-200 text-gray-900 rounded-3xl shadow-3xl hover:shadow-4xl hover:bg-white transition-all duration-300 font-bold text-xl hover:-translate-y-1"
                    >
                      <Download className="w-7 h-7" />
                      Export CSV
                    </button>
                  </div>

                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-48 bg-white/50 rounded-4xl border-2 border-dashed border-indigo-200">
                      <div className="w-32 h-32 border-6 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin mb-12 shadow-3xl" />
                      <p className="text-3xl font-bold text-gray-700 mb-4">Loading systems...</p>
                      <div className="w-24 h-2 bg-indigo-200 rounded-full overflow-hidden">
                        <div className="w-3/4 h-full bg-gradient-to-r from-indigo-600 to-purple-600 animate-pulse" />
                      </div>
                    </div>
                  ) : filteredSystems.length > 0 ? (
                    <div className="bg-white/70 backdrop-blur-2xl rounded-4xl border border-white/50 shadow-4xl overflow-hidden">
                      <div className="px-8 py-6 border-b border-white/30 bg-gradient-to-r from-indigo-50/90 to-blue-50/90">
                        <p className="text-2xl font-bold text-gray-800">
                          Showing <span className="text-indigo-600">{filteredSystems.length}</span> of <span className="text-indigo-600">{assignedSystems.length}</span> systems
                        </p>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200/30">
                          <thead className="bg-white/60">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs md:text-sm font-semibold text-gray-700 uppercase tracking-wide">
                                Hostname {renderSortArrow("hostname")}
                              </th>
                              <th className="px-8 py-8 text-left text-xl font-black text-gray-900 uppercase tracking-wider cursor-pointer hover:bg-indigo-50/50 transition">
                                Username {renderSortArrow("username")}
                              </th>
                              <th className="px-8 py-8 text-left text-xl font-black text-gray-900 uppercase tracking-wider cursor-pointer hover:bg-indigo-50/50 transition">
                                Status {renderSortArrow("status")}
                              </th>
                              <th className="px-8 py-8 text-left text-xl font-black text-gray-900 uppercase tracking-wider">Actions</th>
                              <th className="px-8 py-8 text-left text-xl font-black text-gray-900 uppercase tracking-wider cursor-pointer hover:bg-indigo-50/50 transition">
                                Status Message {renderSortArrow("statusMessage")}
                              </th>
                              <th className="px-8 py-8 text-left text-xl font-black text-gray-900 uppercase tracking-wider cursor-pointer hover:bg-indigo-50/50 transition">
                                Last Attempt {renderSortArrow("lastAttemptDate")}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200/30">
                            {filteredSystems.map((system) => (
                              <tr key={system.systemID} className="hover:bg-indigo-50/50 transition-all duration-300 hover:shadow-inner">
                                <td className="px-4 py-3 text-xs md:text-sm text-gray-900 font-medium">
                                  {system.hostname}
                                </td>
                                <td className="px-4 py-3 text-xs md:text-sm text-gray-900 font-medium">
                                  {system.username}
                                </td>
                                <td className="px-8 py-8">
                                  <span className={`inline-flex items-center px-8 py-4 rounded-3xl text-xl font-bold shadow-2xl backdrop-blur-xl ${getStatusStyle(system.status)}`}>
                                    {system.status}
                                  </span>
                                </td>
                                <td className="px-8 py-8">
                                  <div className="flex gap-4">
                                    {system.status.toLowerCase() === "completed" && selectedUpdateId && (
                                      <button
                                        onClick={() => handleReassign(system.hostname, selectedUpdateId)}
                                        className="px-8 py-4 text-lg font-bold bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-3xl hover:from-indigo-700 hover:to-blue-700 shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-105"
                                      >
                                        Reassign
                                      </button>
                                    )}
                                    {system.status.toLowerCase() === "pending" && selectedUpdateId && (
                                      <button
                                        onClick={() => handleDelete(Number(system.systemID), selectedUpdateId, system.hostname)}
                                        disabled={deletingId === Number(system.systemID)}
                                        className="p-4 text-red-600 hover:bg-red-50/50 rounded-3xl transition-all duration-300 shadow-xl hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed hover:scale-110"
                                        title="Delete pending task"
                                      >
                                        {deletingId === Number(system.systemID) ? (
                                          <div className="w-8 h-8 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
                                        ) : (
                                          <Trash2 className="w-8 h-8" />
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td className="px-8 py-8 text-xl text-gray-700 max-w-2xl">
                                  {system.statusMessage}
                                </td>
                                <td className="px-8 py-8 text-lg text-gray-600 font-semibold">
                                  {new Date(system.lastAttemptDate).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-48 text-center bg-white/50 rounded-4xl border-4 border-dashed border-indigo-200/50 backdrop-blur-xl">
                      <div className="w-32 h-32 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-4xl flex items-center justify-center mb-12 shadow-3xl border-4 border-indigo-200/50">
                        <Filter className="w-16 h-16 text-indigo-600" />
                      </div>
                      <h2 className="text-4xl font-black text-gray-800 mb-6">No systems found</h2>
                      <p className="text-2xl text-gray-600 max-w-2xl">
                        {searchTerm ? "Try adjusting your search term or filters" : "No systems match the selected criteria"}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UpdateManagementPage;
