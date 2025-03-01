import React, { useState, useEffect } from "react";
import axios from "axios";
import { RefreshCw, Download, Filter } from "lucide-react";
import Navbar from "./Navbar";
import { useNavigate } from "react-router-dom";
import useAuth from "./useAuth";
import { APP_CONSTANTS } from "../store";

const Dashboard = () => {
  useAuth(); // Ensures the user is authenticated before loading the page
  const navigate = useNavigate();
  type System = {
    hostname: string;
    username: string;
    status: string;
    statusMessage: string;
    lastAttemptDate: string;
  };

  type Update = {
    updateID: string;
    fileName: string;
  };
  const [assignedSystems, setAssignedSystems] = useState<System[]>([]);
  const [filteredSystems, setFilteredSystems] = useState<System[]>([]);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [selectedUpdate, setSelectedUpdate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<{ [key: string]: boolean }>({
    pending: false,
    completed: false,
    failed: false,
  });

  // Fetch updates on page load
  useEffect(() => {
    axios
      .get(APP_CONSTANTS.API_BASE_URL + "/api/Installation/active-updates")
      .then((response) => {
        setUpdates(
          Array.isArray(response.data.$values) ? response.data.$values : []
        );
      })
      .catch(() => {
        setError("Failed to load updates.");
        setUpdates([]);
      });
  }, []);

  // Fetch assigned systems when an update is selected
  const fetchAssignedSystems = (updateId: string | null | undefined) => {
    setLoading(true);
    setError(null);

    axios
      .get(
        `${APP_CONSTANTS.API_BASE_URL}/api/Installation/assigned-hostnames?updateID=${updateId}`
      )
      .then((response) => {
        const systems = Array.isArray(response.data.values.$values)
          ? response.data.values.$values
          : [];
        setAssignedSystems(systems);
        setFilteredSystems(systems);
      })
      .catch(() => {
        setError("Failed to load assigned systems.");
        setAssignedSystems([]);
        setFilteredSystems([]);
      })
      .finally(() => setLoading(false));
  };

  // Handle dropdown change
  const handleUpdateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const updateId = e.target.value;
    setSelectedUpdate(updateId);
    if (updateId) fetchAssignedSystems(updateId);
    else {
      setAssignedSystems([]);
      setFilteredSystems([]);
    }
  };

  // Handle status filter changes
  const handleStatusFilterChange = (status: keyof typeof statusFilter) => {
    const updatedFilter = { ...statusFilter, [status]: !statusFilter[status] };
    setStatusFilter(updatedFilter);

    // Filter systems based on selected statuses
    const filtered = assignedSystems.filter(
      (system) => updatedFilter[system.status.toLowerCase()]
    );
    setFilteredSystems(filtered);
  };

  // Helper function to get status style
  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return "bg-amber-100 text-amber-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Export data to CSV
  const exportToCSV = () => {
    const headers = [
      "Hostname",
      "Status",
      "Status Message",
      "Last Attempt Date",
    ];
    const rows = filteredSystems.map((system: System) => [
      system.hostname,
      system.username,
      system.status,
      system.statusMessage,
      new Date(system.lastAttemptDate).toLocaleString(),
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers, ...rows]
        .map((row) => row.map((cell) => `"${cell}"`).join(","))
        .join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "assigned_systems.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow">
          {/* Your existing Navbar component */}
        </nav>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <h1 className="text-2xl font-semibold text-gray-900">
                Update Tracking Dashboard
              </h1>
            </div>

            {/* Filters */}
            <div className="px-6 py-4 space-y-4">
              {/* Update Selector */}
              <div className="relative">
                <select
                  className="w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-md"
                  value={selectedUpdate}
                  onChange={handleUpdateChange}
                >
                  <option value="">-- Select an Update --</option>
                  {updates.map((update: Update) => (
                    <option key={update.updateID} value={update.updateID}>
                      {update.fileName} ({update.updateID})
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filters */}
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center">
                  <Filter className="w-5 h-5 mr-2 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">
                    Filter Status:
                  </span>
                </div>
                {Object.entries(statusFilter).map(([status, checked]) => (
                  <label
                    key={status}
                    className="flex items-center space-x-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleStatusFilterChange(status)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-600 capitalize">
                      {status}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-4">
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                </div>
              ) : error ? (
                <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
                  {error}
                </div>
              ) : filteredSystems.length > 0 ? (
                <>
                  <div className="mb-4">
                    <button
                      onClick={exportToCSV}
                      className="flex items-center px-4 py-2 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export to CSV
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Hostname
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Username
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Status Message
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Last Attempt
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredSystems.map((system, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {system.hostname}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {system.username}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusStyle(
                                  system.status
                                )}`}
                              >
                                {system.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {system.statusMessage}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(
                                system.lastAttemptDate
                              ).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                selectedUpdate && (
                  <div className="text-center py-8 text-gray-500">
                    No systems match the selected filters
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
