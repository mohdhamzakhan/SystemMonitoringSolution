import React, { useState, useEffect } from "react";
import { AlertCircle, Trash2, RefreshCw, Save } from "lucide-react";
import Navbar from "./Navbar";
import useAuth from "./useAuth";
import { APP_CONSTANTS } from "../store";

const UpdateInfoForm = () => {
  useAuth();
  const [filePath, setFilePath] = useState("");
  const [fileName, setFileName] = useState("");
  const [parameters, setParameters] = useState("");
  const [updateName, setUpdateName] = useState("");
  const [isLocal, setIsLocal] = useState(false);
  const [activeUpdates, setActiveUpdates] = useState<
    { updateID: string; updateName: string; filePath: string; parameters: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const systemUpdatePayload = {
      UpdateName: updateName,
      FilePath: filePath,
      FileName: fileName,
      Parameters: parameters,
      CreatedDate: new Date().toISOString(),
      IsActive: true,
      IsLocal:isLocal,
      SystemUpdates: [],
    };

    try {
      const response = await fetch(APP_CONSTANTS.API_BASE_URL + "/api/installation/update-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(systemUpdatePayload),
      });

      if (!response.ok) {
        const errorDetails = await response.text();
        throw new Error(`Failed with status ${response.status}: ${errorDetails}`);
      }

      alert("✅ Update saved successfully!");
      setFilePath("");
      setFileName("");
      setParameters("");
      setUpdateName("");
      setIsLocal(false);
      fetchActiveUpdates();
    } catch (error) {
      console.error(error);
      setError("Error saving UpdateInfo. Please check your inputs.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this update?")) return;

    setDeletingId(id);
    try {
      const response = await fetch(`${APP_CONSTANTS.API_BASE_URL}/api/installation/update-info/${id}`, {
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
      <div className="min-h-screen bg-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="grid gap-10 md:grid-cols-2">
            
            {/* Update Info Form */}
            <div className="bg-white rounded-2xl shadow-md p-8">
              <h2 className="text-2xl font-semibold text-gray-800 mb-6">➕ Add New Update</h2>
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="flex items-center p-3 rounded-md bg-red-50 text-red-700 border border-red-200">
                    <AlertCircle className="h-5 w-5 mr-2" />
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Update Name</label>
                  <input
                    type="text"
                    value={updateName}
                    onChange={(e) => setUpdateName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">File Path</label>
                  <input
                    type="text"
                    value={filePath}
                    onChange={(e) => setFilePath(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">File Name</label>
                  <input
                    type="text"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Parameters</label>
                  <input
                    type="text"
                    value={parameters}
                    onChange={(e) => setParameters(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
                <div className="flex items-center">
      <input
        id="isLocalUpdate"
        type="checkbox"
        checked={isLocal}
        onChange={(e) => setIsLocal(e.target.checked)}
        className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
      />
      <label htmlFor="isLocalUpdate" className="ml-2 block text-sm text-gray-700">
        Is Local Update
      </label>
    </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center justify-center w-full px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg shadow hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Update Info
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Active Updates Table */}
            <div className="bg-white rounded-2xl shadow-md p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold text-gray-800">📋 Active Updates</h2>
                <button
                  onClick={fetchActiveUpdates}
                  className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
              </div>

              {loading ? (
                <div className="flex justify-center py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
                </div>
              ) : activeUpdates.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left font-semibold text-gray-600">ID</th>
                        <th className="px-6 py-3 text-left font-semibold text-gray-600">Name</th>
                        <th className="px-6 py-3 text-left font-semibold text-gray-600">File Path</th>
                        <th className="px-6 py-3 text-left font-semibold text-gray-600">Parameters</th>
                        <th className="px-6 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {activeUpdates.map((update) => (
                        <tr key={update.updateID} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4 text-gray-800">{update.updateID}</td>
                          <td className="px-6 py-4 text-gray-800">{update.updateName}</td>
                          <td className="px-6 py-4 text-gray-500">{update.filePath}</td>
                          <td className="px-6 py-4 text-gray-500">{update.parameters}</td>
                          <td className="px-6 py-4 text-right">
  <button
    onClick={() => handleDelete(update.updateID)}
    disabled={deletingId === update.updateID}
    className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium
               text-white bg-red-600 hover:bg-red-700 disabled:opacity-50
               shadow-sm transition-all duration-200"
  >
    {deletingId === update.updateID ? (
      "Deleting..."
    ) : (
      <>
        <Trash2 className="w-4 h-4 mr-1" />
        Delete
      </>
    )}
  </button>
</td>

                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-10 text-gray-500">No active updates found</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default UpdateInfoForm;
