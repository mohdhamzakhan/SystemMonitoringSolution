import React, { useState, useEffect } from "react";
import { AlertCircle, Trash2, RefreshCw, Save, Edit2, X, Plus, Power, PowerOff } from "lucide-react";
import { APP_CONSTANTS } from "../store";
import Navbar from "./Navbar";
const useAuth = () => { };

const UpdateInfoForm = () => {
    useAuth();
    const [filePath, setFilePath] = useState("");
    const [fileName, setFileName] = useState("");
    const [parameters, setParameters] = useState("");
    const [updateName, setUpdateName] = useState("");
    const [isLocal, setIsLocal] = useState(false);
    const [isActive, setIsActive] = useState(true);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [activeUpdates, setActiveUpdates] = useState<
        {
            updateID: number;
            updateName: string;
            filePath: string;
            fileName: string;
            parameters: string;
            isLocal: boolean;
            isActive: boolean;
            createdDate: string;
        }[]
    >([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [togglingId, setTogglingId] = useState<number | null>(null);
    const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("active");

    const fetchActiveUpdates = async () => {
        setLoading(true);
        setError("");
        try {
            const response = await fetch(APP_CONSTANTS.API_BASE_URL + "/api/installation/active-updates");
            if (!response.ok) throw new Error(`Failed to fetch active updates: ${response.status}`);
            const data = await response.json();
            setActiveUpdates(data.$values || []);

        } catch (err) {
            console.error(err);
            setError("Failed to fetch active updates. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchActiveUpdates();
    }, []);

    const filteredUpdates = activeUpdates.filter(update => {
        if (filterStatus === "all") return true;
        if (filterStatus === "active") return update.isActive === true;
        if (filterStatus === "inactive") return update.isActive === false;
        return true;
    });

    const handleEdit = (update: any) => {
        setUpdateName(update.updateName);
        setFilePath(update.filePath);
        setFileName(update.fileName);
        setParameters(update.parameters);
        setIsLocal(update.isLocal || false);
        setIsActive(update.isActive !== undefined ? update.isActive : true);
        setEditingId(update.updateID);
        setError("");
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setUpdateName("");
        setFilePath("");
        setFileName("");
        setParameters("");
        setIsLocal(false);
        setIsActive(true);
        setEditingId(null);
        setError("");
    };

    const handleSubmit = async () => {
        if (!updateName || !filePath || !fileName || !parameters) {
            setError("All fields are required");
            return;
        }

        setSubmitting(true);
        setError("");

        const systemUpdatePayload = {
            UpdateID: editingId || undefined,
            UpdateName: updateName,
            FilePath: filePath,
            FileName: fileName,
            Parameters: parameters,
            CreatedDate: new Date().toISOString(),
            IsActive: isActive,
            IsLocal: isLocal,
            SystemUpdates: []
        };

        try {
            const url = editingId
                ? `${APP_CONSTANTS.API_BASE_URL}/api/installation/update-info/${editingId}`
                : `${APP_CONSTANTS.API_BASE_URL}/api/installation/update-info`;

            const method = editingId ? "PUT" : "POST";

            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(systemUpdatePayload),
            });

            console.log(systemUpdatePayload)

            if (!response.ok) {
                const errorDetails = await response.text();
                throw new Error(`Failed with status ${response.status}: ${errorDetails}`);
            }

            alert(editingId ? "✅ Update modified successfully!" : "✅ Update saved successfully!");
            handleCancelEdit();
            fetchActiveUpdates();
        } catch (error) {
            console.error(error);
            setError(editingId ? "Error updating UpdateInfo. Please check your inputs." : "Error saving UpdateInfo. Please check your inputs.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggleActive = async (id: number, currentStatus: boolean) => {
        setTogglingId(id);
        try {
            const response = await fetch(`${APP_CONSTANTS.API_BASE_URL}/api/installation/update-info/${id}/toggle-active`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !currentStatus }),
            });

            if (!response.ok) throw new Error(`Failed to toggle status: ${response.status}`);

            fetchActiveUpdates();
        } catch (err) {
            console.error(err);
            alert("❌ Failed to toggle update status. Please try again.");
        } finally {
            setTogglingId(null);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm("Are you sure you want to delete this update?")) return;

        setDeletingId(id);
        try {
            const response = await fetch(`${APP_CONSTANTS.API_BASE_URL}/api/installation/update-delete/${id}`, {
                method: "DELETE",
            });

            if (!response.ok) throw new Error(`Failed to delete update: ${response.status}`);

            alert("🗑️ Update deleted successfully!");
            fetchActiveUpdates();
        } catch (err) {
            console.error(err);
            alert("❌ Failed to delete update. Please try again.");
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <>
            <Navbar />
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="flex flex-col lg:flex-row gap-6">

                        {/* Left Column - Add/Edit Update Form */}
                        <div className="lg:w-2/5">
                            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 sticky top-6">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-2">
                                        {editingId ? (
                                            <Edit2 className="w-6 h-6 text-amber-600" />
                                        ) : (
                                            <Plus className="w-6 h-6 text-indigo-600" />
                                        )}
                                        <h2 className="text-2xl font-bold text-gray-800">
                                            {editingId ? "Edit Update" : "New Update"}
                                        </h2>
                                    </div>
                                    {editingId && (
                                        <button
                                            onClick={handleCancelEdit}
                                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
                                            title="Cancel editing"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>

                                {editingId && (
                                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                                        <strong>Editing mode:</strong> Modify the fields below and save to update the existing entry.
                                    </div>
                                )}

                                <div className="space-y-4">
                                    {error && (
                                        <div className="flex items-start p-3 rounded-lg bg-red-50 text-red-700 border border-red-200">
                                            <AlertCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
                                            <span className="text-sm">{error}</span>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Update Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={updateName}
                                            onChange={(e) => setUpdateName(e.target.value)}
                                            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                                            placeholder="e.g., System Update v2.1"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            File Path <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={filePath}
                                            onChange={(e) => setFilePath(e.target.value)}
                                            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                                            placeholder="e.g., /updates/patches/"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            File Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={fileName}
                                            onChange={(e) => setFileName(e.target.value)}
                                            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                                            placeholder="e.g., update_v2.1.exe"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Parameters <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={parameters}
                                            onChange={(e) => setParameters(e.target.value)}
                                            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                                            placeholder="e.g., -silent -restart"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                                            <input
                                                id="isLocalUpdate"
                                                type="checkbox"
                                                checked={isLocal}
                                                onChange={(e) => setIsLocal(e.target.checked)}
                                                className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                            />
                                            <label htmlFor="isLocalUpdate" className="ml-3 block text-sm font-medium text-gray-700">
                                                Is Local
                                            </label>
                                        </div>

                                        <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                                            <input
                                                id="isActiveUpdate"
                                                type="checkbox"
                                                checked={isActive}
                                                onChange={(e) => setIsActive(e.target.checked)}
                                                className="h-4 w-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                                            />
                                            <label htmlFor="isActiveUpdate" className="ml-3 block text-sm font-medium text-gray-700">
                                                Is Active
                                            </label>
                                        </div>
                                    </div>

                                    <div className="pt-2 space-y-2">
                                        <button
                                            onClick={handleSubmit}
                                            disabled={submitting}
                                            className={`flex items-center justify-center w-full px-4 py-3 font-semibold rounded-lg shadow-md transition-all duration-200 ${editingId
                                                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                                                    : "bg-indigo-600 hover:bg-indigo-700 text-white"
                                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                                        >
                                            {submitting ? (
                                                <>
                                                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                                                    {editingId ? "Updating..." : "Saving..."}
                                                </>
                                            ) : (
                                                <>
                                                    <Save className="w-5 h-5 mr-2" />
                                                    {editingId ? "Update Entry" : "Save Update Info"}
                                                </>
                                            )}
                                        </button>

                                        {editingId && (
                                            <button
                                                onClick={handleCancelEdit}
                                                className="w-full px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column - Active Updates List */}
                        <div className="lg:w-3/5">
                            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                                        <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                                            📋
                                        </div>
                                        All Updates
                                    </h2>
                                    <button
                                        onClick={fetchActiveUpdates}
                                        disabled={loading}
                                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
                                    >
                                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                        Refresh
                                    </button>
                                </div>

                                {/* Filter Tabs */}
                                <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-lg">
                                    <button
                                        onClick={() => setFilterStatus("all")}
                                        className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${filterStatus === "all"
                                                ? "bg-white text-indigo-600 shadow-sm"
                                                : "text-gray-600 hover:text-gray-900"
                                            }`}
                                    >
                                        All ({activeUpdates.length})
                                    </button>
                                    <button
                                        onClick={() => setFilterStatus("active")}
                                        className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${filterStatus === "active"
                                                ? "bg-white text-green-600 shadow-sm"
                                                : "text-gray-600 hover:text-gray-900"
                                            }`}
                                    >
                                        Active ({activeUpdates.filter(u => u.isActive).length})
                                    </button>
                                    <button
                                        onClick={() => setFilterStatus("inactive")}
                                        className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${filterStatus === "inactive"
                                                ? "bg-white text-gray-600 shadow-sm"
                                                : "text-gray-600 hover:text-gray-900"
                                            }`}
                                    >
                                        Inactive ({activeUpdates.filter(u => !u.isActive).length})
                                    </button>
                                </div>

                                {loading ? (
                                    <div className="flex flex-col items-center justify-center py-16">
                                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent mb-4" />
                                        <p className="text-gray-500 text-sm">Loading updates...</p>
                                    </div>
                                ) : filteredUpdates.length > 0 ? (
                                    <div className="space-y-3">
                                        {filteredUpdates.map((update) => (
                                            console.log(update.filePath),
                                            <div
                                                key={update.updateID}
                                                className={`border rounded-lg p-4 transition-all duration-200 ${editingId === update.updateID
                                                        ? "border-amber-400 bg-amber-50"
                                                        : update.isActive
                                                            ? "border-gray-200 hover:border-indigo-300 hover:shadow-md"
                                                            : "border-gray-200 bg-gray-50 opacity-75"
                                                    }`}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                            <h3 className="text-lg font-semibold text-gray-800 truncate">
                                                                {update.updateName}
                                                            </h3>
                                                            <div className="flex gap-2">
                                                                {update.isLocal && (
                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                                        Local
                                                                    </span>
                                                                )}
                                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${update.isActive
                                                                        ? "bg-green-100 text-green-800"
                                                                        : "bg-gray-200 text-gray-700"
                                                                    }`}>
                                                                    {update.isActive ? "Active" : "Inactive"}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1 text-sm">
                                                            <p className="text-gray-600">
                                                                <span className="font-medium">ID:</span> {update.updateID}
                                                            </p>
                                                            <p className="text-gray-600">
                                                                <span className="font-medium">Path:</span> {update.filePath}
                                                            </p>
                                                            <p className="text-gray-600">
                                                                <span className="font-medium">File:</span> {update.fileName}
                                                            </p>
                                                            <p className="text-gray-600">
                                                                <span className="font-medium">Params:</span> {update.parameters}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="flex gap-2 ml-4">
                                                        <button
                                                            onClick={() => handleToggleActive(update.updateID, update.isActive)}
                                                            disabled={togglingId === update.updateID}
                                                            className={`p-2 rounded-lg transition-colors ${update.isActive
                                                                    ? "text-green-600 hover:bg-green-50"
                                                                    : "text-gray-400 hover:bg-gray-100"
                                                                } disabled:opacity-50`}
                                                            title={update.isActive ? "Deactivate" : "Activate"}
                                                        >
                                                            {togglingId === update.updateID ? (
                                                                <div className="animate-spin rounded-full h-5 w-5 border-2 border-current border-t-transparent" />
                                                            ) : update.isActive ? (
                                                                <Power className="w-5 h-5" />
                                                            ) : (
                                                                <PowerOff className="w-5 h-5" />
                                                            )}
                                                        </button>
                                                        <button
                                                            onClick={() => handleEdit(update)}
                                                            className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                            title="Edit update"
                                                        >
                                                            <Edit2 className="w-5 h-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(update.updateID)}
                                                            disabled={deletingId === update.updateID}
                                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                                            title="Delete update"
                                                        >
                                                            {deletingId === update.updateID ? (
                                                                <div className="animate-spin rounded-full h-5 w-5 border-2 border-red-600 border-t-transparent" />
                                                            ) : (
                                                                <Trash2 className="w-5 h-5" />
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-16 text-center">
                                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                            <AlertCircle className="w-8 h-8 text-gray-400" />
                                        </div>
                                        <p className="text-gray-500 font-medium">
                                            {activeUpdates.length === 0
                                                ? "No updates found"
                                                : `No ${filterStatus} updates found`}
                                        </p>
                                        <p className="text-gray-400 text-sm mt-1">
                                            {activeUpdates.length === 0
                                                ? "Create your first update using the form"
                                                : filterStatus === "all"
                                                    ? "Create your first update using the form"
                                                    : `Try selecting a different filter`}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default UpdateInfoForm;