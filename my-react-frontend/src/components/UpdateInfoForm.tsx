import React, { useState, useEffect } from "react";
import { AlertCircle } from "lucide-react";
import Navbar from "./Navbar";
import useAuth from "./useAuth";
import { APP_CONSTANTS } from "../store";

const UpdateInfoForm = () => {
  useAuth(); // Ensures the user is authenticated before loading the page
  const [filePath, setFilePath] = useState("");
  const [fileName, setFileName] = useState("");
  const [parameters, setParameters] = useState("");
  const [updateName, setUpdateName] = useState("");
  const [activeUpdates, setActiveUpdates] = useState<
    {
      updateID: string;
      updateName: string;
      filePath: string;
      parameters: string;
    }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchActiveUpdates = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        APP_CONSTANTS.API_BASE_URL + "/api/installation/active-updates"
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch active updates: ${response.status}`);
      }
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
      SystemUpdates: [],
    };

    try {
      const response = await fetch(
        APP_CONSTANTS.API_BASE_URL + "/api/installation/update-info",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(systemUpdatePayload),
        }
      );

      if (!response.ok) {
        const errorDetails = await response.text();
        throw new Error(
          `Failed with status ${response.status}: ${errorDetails}`
        );
      }

      alert("Data has been saved successfully!");
      setFilePath("");
      setFileName("");
      setParameters("");
      setUpdateName("");
      fetchActiveUpdates();
    } catch (error) {
      console.error(error);
      setError("Error saving UpdateInfo. Please check your inputs.");
    }
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid gap-8 md:grid-cols-2">
            {/* Update Info Form */}
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">
                  Enter Update Info
                </h2>
              </div>
              <div className="p-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div className="rounded-md bg-red-50 p-4">
                      <div className="flex">
                        <AlertCircle className="h-5 w-5 text-red-400" />
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-red-800">
                            {error}
                          </h3>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Update Name
                    </label>
                    <input
                      type="text"
                      value={updateName}
                      onChange={(e) => setUpdateName(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      File Path
                    </label>
                    <input
                      type="text"
                      value={filePath}
                      onChange={(e) => setFilePath(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      File Name
                    </label>
                    <input
                      type="text"
                      value={fileName}
                      onChange={(e) => setFileName(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Parameters
                    </label>
                    <input
                      type="text"
                      value={parameters}
                      onChange={(e) => setParameters(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    Save Update Info
                  </button>
                </form>
              </div>
            </div>

            {/* Active Updates Table */}
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">
                  Active Updates
                </h2>
              </div>
              <div className="p-6">
                {loading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                  </div>
                ) : activeUpdates.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            ID
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            File Path
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Parameters
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {activeUpdates.map((update) => (
                          <tr
                            key={update.updateID}
                            className="hover:bg-gray-50"
                          >
                            <td className="px-6 py-4 text-sm text-gray-900">
                              {update.updateID}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              {update.updateName}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {update.filePath}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {update.parameters}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No active updates found
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
