import React, { useState, useEffect } from "react";
import { CheckSquare, Square, AlertCircle, ArrowUpDown } from "lucide-react";
import Navbar from "./Navbar";
import { APP_CONSTANTS } from "../store";

const AssignUpdatePage = () => {
  const [updates, setUpdates] = useState<any[]>([]);
  const [hostnames, setHostnames] = useState<
    { systemID: string; hostname: string; username: string; lastUpdateDate?: string }[]
  >([]);
  const [filteredHostnames, setFilteredHostnames] = useState<
    { systemID: string; hostname: string; lastUpdateDate?: string }[]
  >([]);
  const [selectedHostnames, setSelectedHostnames] = useState<string[]>([]);
  const [selectedUpdate, setSelectedUpdate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);

  const API_BASE_URL = APP_CONSTANTS.API_BASE_URL + "/api/installation";

  // Fetch Updates
  const fetchUpdates = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/active-updates`);
      const data = await response.json();
      const allUpdates = data.$values || [];
      setUpdates(allUpdates);
    } catch {
      setError("Failed to fetch updates.");
    }
  };

  // Fetch Hostnames
  const fetchHostnames = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/active-hosts`);
      const data = await response.json();
      const availableHostnames = data.$values || [];
      setHostnames(availableHostnames);
      setFilteredHostnames(availableHostnames);
    } catch {
      setError("Failed to fetch hostnames.");
    }
  };

  // Effects
  useEffect(() => {
    fetchUpdates();
  }, []);

  useEffect(() => {
    if (selectedUpdate) {
      fetchHostnames();
      setSelectedHostnames([]);
    }
  }, [selectedUpdate]);

  // Search filter
  useEffect(() => {
    let result = [...hostnames];

    if (search) {
      result = result.filter((h) =>
        h.hostname.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (sortConfig !== null) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key as keyof typeof a];
        const bVal = b[sortConfig.key as keyof typeof b];
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    setFilteredHostnames(result);
  }, [hostnames, search, sortConfig]);

  // Sorting toggle
  const requestSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  

  // Checkbox handlers
  const handleCheckboxChange = (systemID: string) => {
    setSelectedHostnames((prev) =>
      prev.includes(systemID)
        ? prev.filter((id) => id !== systemID)
        : [...prev, systemID]
    );
  };

  const handleSelectAllVisible = () => {
    const visibleIds = filteredHostnames.map((h) => h.systemID);
    const allSelected = visibleIds.every((id) =>
      selectedHostnames.includes(id)
    );

    if (allSelected) {
      // Unselect all visible
      setSelectedHostnames((prev) =>
        prev.filter((id) => !visibleIds.includes(id))
      );
    } else {
      // Select all visible (add missing ones)
      setSelectedHostnames((prev) => [
        ...prev,
        ...visibleIds.filter((id) => !prev.includes(id)),
      ]);
    }
  };

  // Submit handler
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

      alert("Update assigned successfully!");
      setSelectedHostnames([]);
      setHostnames([]);
      setFilteredHostnames([]);
      setSelectedUpdate("");
    } catch {
      setError("Failed to assign update. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <h1 className="text-2xl font-semibold text-gray-900">
                Assign Update to Hostnames
              </h1>
            </div>

            <div className="px-6 py-4">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Update Dropdown */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Update
                  </label>
                  <select
                    value={selectedUpdate}
                    onChange={(e) => setSelectedUpdate(e.target.value)}
                    className="w-full rounded-md border border-gray-300 p-2"
                  >
                    <option value="">-- Select an Update --</option>
                    {updates.map((update) => (
                      <option key={update.updateID} value={update.updateID}>
                        {update.updateName} (ID: {update.updateID})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Search */}
                <input
                  type="text"
                  placeholder="Search hostnames..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-md border border-gray-300 p-2"
                />

                {/* Error */}
                {error && (
                  <div className="rounded-md bg-red-50 p-4 flex items-center">
                    <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
                    <span className="text-sm text-red-800">{error}</span>
                  </div>
                )}

                {/* Table */}
                {filteredHostnames.length > 0 && (
                  <div className="mt-4">
                    <div className="flex justify-between items-center mb-2">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          onChange={handleSelectAllVisible}
                          checked={filteredHostnames.every((h) =>
                            selectedHostnames.includes(h.systemID)
                          )}
                          className="rounded border-gray-300 text-indigo-600"
                        />
                        <span className="text-sm">
                          Select All (Visible)
                        </span>
                      </label>
                      <span className="text-sm text-gray-600">
                        {selectedHostnames.length} selected out of{" "}
                        {hostnames.length}
                      </span>
                    </div>

                    <table className="min-w-full divide-y divide-gray-200 border">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Select
                          </th>
                          <th
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer"
                            onClick={() => requestSort("hostname")}
                          >
                            Hostname <ArrowUpDown className="inline w-4 h-4" />
                          </th>
                          <th
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer"
                            onClick={() => requestSort("username")}
                          >
                            Username <ArrowUpDown className="inline w-4 h-4" />
                          </th>
                          <th
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer"
                            onClick={() => requestSort("lastUpdateDate")}
                          >
                            Last Update Date{" "}
                            <ArrowUpDown className="inline w-4 h-4" />
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredHostnames.map((host) => (
                          <tr key={host.systemID}>
                            <td className="px-6 py-4">
                              <input
                                type="checkbox"
                                checked={selectedHostnames.includes(
                                  host.systemID
                                )}
                                onChange={() =>
                                  handleCheckboxChange(host.systemID)
                                }
                                className="rounded border-gray-300 text-indigo-600"
                              />
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              {host.hostname}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              {host.username}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {host.lastUpdateDate
                                ? new Date(
                                    host.lastUpdateDate
                                  ).toLocaleString()
                                : "N/A"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Submit */}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                  >
                    Assign Update
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AssignUpdatePage;
