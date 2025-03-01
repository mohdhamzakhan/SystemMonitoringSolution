import React, { useState, useEffect } from "react";
import {
  Upload,
  Server,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader,
} from "lucide-react";
import Navbar from "./Navbar";
import useAuth from "./useAuth";
import { APP_CONSTANTS } from "../store";

// Custom Alert Component
const Alert = ({
  type,
  message,
}: {
  type: "success" | "error" | "warning";
  message: string;
}) => {
  const styles = {
    success: "bg-green-50 text-green-800 border border-green-200",
    error: "bg-red-50 text-red-800 border border-red-200",
    warning: "bg-yellow-50 text-yellow-800 border border-yellow-200",
  };

  return (
    <div className={`p-4 rounded-lg flex items-center ${styles[type]}`}>
      {type === "success" ? (
        <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
      ) : type === "error" ? (
        <XCircle className="h-5 w-5 text-red-500 mr-2" />
      ) : (
        <AlertCircle className="h-5 w-5 text-yellow-500 mr-2" />
      )}
      <span>{message}</span>
    </div>
  );
};

const SystemUpdateManager = () => {
  useAuth(); // Ensures the user is authenticated before loading the page
  interface System {
    systemId: number;
    hostname: string;
    lastUpdateDate: string;
    isActive: boolean;
  }
  const [systems, setSystems] = useState<System[]>([]);
  const [selectedSystems, setSelectedSystems] = useState<{
    [key: number]: boolean;
  }>({});
  const [file, setFile] = useState<File | null>(null);
  const [parameters, setParameters] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  interface UpdateHistory {
    systemUpdateId: number;
    systemInfo: { hostname: string };
    updateInfo: { fileName: string };
    status: string;
    lastAttemptDate: string;
    statusMessage: string;
  }

  const [updateHistory, setUpdateHistory] = useState<UpdateHistory[]>([]);

  useEffect(() => {
    fetchSystems();
    fetchUpdateHistory();
  }, []);

  const fetchSystems = async () => {
    try {
      const response = await fetch(APP_CONSTANTS.API_BASE_URL + "/api/systems");
      const data = await response.json();
      setSystems(data.$values || []);
    } catch (error) {
      console.error("Error fetching systems:", error);
    }
  };

  const fetchUpdateHistory = async () => {
    try {
      const response = await fetch(
        APP_CONSTANTS.API_BASE_URL + "/api/updates/history"
      );
      const data = await response.json();
      setUpdateHistory(data.$values || []);
    } catch (error) {
      console.error("Error fetching update history:", error);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] || null);
  };

  const handleSystemSelect = (systemId: number) => {
    setSelectedSystems((prev) => ({
      ...prev,
      [systemId]: !prev[systemId],
    }));
  };

  const handleUpdateSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsUploading(true);

    try {
      // Ensure a file is selected before appending
      if (!file) {
        console.error("No file selected");
        return;
      }

      // First, upload the update file
      const formData = new FormData();
      formData.append("file", file);
      formData.append("parameters", parameters);

      const uploadResponse = await fetch(
        "http://your-api-endpoint.com/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!uploadResponse.ok) {
        throw new Error("File upload failed");
      }

      setUpdateStatus({
        type: "success",
        message: "Update successfully scheduled",
      });
      fetchUpdateHistory();
    } catch (error) {
      if (error instanceof Error) {
        setUpdateStatus({ type: "error", message: error.message });
      } else {
        setUpdateStatus({
          type: "error",
          message: "An unknown error occurred",
        });
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              System Update Manager
            </h1>
            <p className="mt-2 text-gray-600">
              Upload and deploy updates to selected systems
            </p>
          </div>

          {/* Upload Form */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            <form onSubmit={handleUpdateSubmit}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Update File
                </label>
                <div className="flex items-center space-x-4">
                  <input
                    type="file"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    required
                  />
                  <Upload className="h-5 w-5 text-gray-400" />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Parameters (Optional)
                </label>
                <textarea
                  value={parameters}
                  onChange={(e) => setParameters(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={3}
                  placeholder="Enter update parameters..."
                />
              </div>

              {/* System Selection */}
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Select Systems
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {systems.map((system) => (
                    <label
                      key={system.systemId}
                      className="flex items-center p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={!!selectedSystems[system.systemId]}
                        onChange={() => handleSystemSelect(system.systemId)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">
                          {system.hostname}
                        </div>
                        <div className="text-sm text-gray-500">
                          Last Updated:{" "}
                          {new Date(system.lastUpdateDate).toLocaleDateString()}
                        </div>
                      </div>
                      <Server
                        className={`ml-auto h-5 w-5 ${
                          system.isActive ? "text-green-500" : "text-red-500"
                        }`}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isUploading || !file}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <Loader className="h-5 w-5 animate-spin" />
                ) : (
                  "Deploy Update"
                )}
              </button>
            </form>
          </div>

          {/* Status Message */}
          {updateStatus && (
            <div className="mb-8">
              <Alert type={updateStatus.type} message={updateStatus.message} />
            </div>
          )}

          {/* Update History */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Update History
              </h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        System
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Update
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last Attempt
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Message
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {updateHistory.map((update) => (
                      <tr
                        key={update.systemUpdateId}
                        className="hover:bg-gray-50"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {update.systemInfo.hostname}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {update.updateInfo.fileName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              update.status === "Success"
                                ? "bg-green-100 text-green-800"
                                : update.status === "Failed"
                                ? "bg-red-100 text-red-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {update.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(update.lastAttemptDate).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {update.statusMessage}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SystemUpdateManager;
