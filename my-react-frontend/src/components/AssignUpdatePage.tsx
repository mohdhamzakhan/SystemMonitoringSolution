import React, { useState, useEffect } from "react";
import { CheckSquare, Square, AlertCircle } from "lucide-react";
import Navbar from "./Navbar";
import useAuth from "./useAuth";
import { APP_CONSTANTS } from "../store";

const AssignUpdatePage = () => {
  useAuth(); // Ensures the user is authenticated before loading the page
  const [updates, setUpdates] = useState<any[]>([]); // Change never[] to any[]
  const [hostnames, setHostnames] = useState<
    { systemID: string; hostname: string; lastUpdateDate?: string }[]
  >([]);
  const [selectedHostnames, setSelectedHostnames] = useState<string[]>([]);
  const [selectedUpdate, setSelectedUpdate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectAll, setSelectAll] = useState(false);

  const API_BASE_URL = APP_CONSTANTS.API_BASE_URL + "/api/installation";

  // Keeping all the original fetch functions and handlers
  const fetchUpdates = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/active-updates`);
      if (!response.ok) {
        throw new Error(`Failed to fetch updates: ${response.status}`);
      }
      const data = await response.json();
      const allUpdates = data.$values || [];
      const unassignedUpdates = [];

      for (const update of allUpdates) {
        try {
          const assignedResponse = await fetch(
            `${API_BASE_URL}/assigned-hostnames?updateID=${update.updateID}`
          );

          if (assignedResponse.status === 404) {
            // If 404, assume no hostnames are assigned and add the update
            unassignedUpdates.push(update);
            continue;
          }

          if (!assignedResponse.ok) {
            throw new Error(
              `Failed to check assigned hostnames for update ${update.updateID}: ${assignedResponse.status}`
            );
          }

          const assignedData = await assignedResponse.json();

          if (!assignedData.$values || assignedData.$values.length === 0) {
            unassignedUpdates.push(update);
          }
        } catch (err) {
          //console.warn(
          //`Skipping update ${update.updateID} due to API error:`,
          // err
          //);
        }
      }

      setUpdates(unassignedUpdates);
    } catch (err) {
      //console.error(err);
      setError("Failed to fetch updates. Please try again.");
    }
  };

  const fetchHostnames = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/active-hosts`);
      if (!response.ok) {
        throw new Error(`Failed to fetch hostnames: ${response.status}`);
      }
      const data = await response.json();
      let availableHostnames = data.$values || [];

      if (selectedUpdate) {
        try {
          const assignedResponse = await fetch(
            `${API_BASE_URL}/assigned-hostnames?updateID=${selectedUpdate}`
          );

          if (assignedResponse.status === 404) {
            // If 404, assume no hostnames are assigned and keep all available hostnames
            setHostnames(availableHostnames);
            return;
          }

          if (!assignedResponse.ok) {
            throw new Error(
              `Failed to fetch assigned hostnames: ${assignedResponse.status}`
            );
          }

          const assignedData = await assignedResponse.json();
          const assignedHostnames = assignedData.values?.$values || [];

          // Function to check if a hostname is assigned
          const isSame = (
            host: { hostname: string; systemID: string },
            assigned: { hostname: string; systemID: string }
          ) =>
            host.hostname === assigned.hostname &&
            host.systemID === assigned.systemID;

          // Filter out already assigned hostnames
          const onlyInLeft = (
            left: any[],
            right: any[],
            compareFunction: (a: any, b: any) => boolean
          ) =>
            left.filter(
              (leftValue) =>
                !right.some((rightValue) =>
                  compareFunction(leftValue, rightValue)
                )
            );

          availableHostnames = onlyInLeft(
            availableHostnames,
            assignedHostnames,
            isSame
          );
        } catch (err) {
          //console.warn(`Error fetching assigned hostnames:`, err);
        }
      }

      setHostnames(availableHostnames);
    } catch (err) {
      //console.error(err);
      setError("Failed to fetch hostnames.");
    }
  };

  useEffect(() => {
    fetchUpdates();
  }, []);

  useEffect(() => {
    if (selectedUpdate) {
      fetchHostnames();
      setSelectedHostnames([]);
      setSelectAll(false);
    }
  }, [selectedUpdate]);

  const handleCheckboxChange = (systemID: string) => {
    setSelectedHostnames((prev) =>
      prev.includes(systemID)
        ? prev.filter((id) => id !== systemID)
        : [...prev, systemID]
    );
  };

  const handleSelectAllChange = () => {
    setSelectAll((prev) => !prev);
    if (!selectAll) {
      setSelectedHostnames(hostnames.map((host) => host.systemID));
    } else {
      setSelectedHostnames([]);
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
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/assign-update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorDetails = await response.text();
        throw new Error(
          `Failed to assign update: ${response.status} - ${errorDetails}`
        );
      }

      alert("Update assigned successfully!");
      setSelectedUpdate("");
      setSelectedHostnames([]);
      setHostnames([]);
      setSelectAll(false);
      fetchUpdates();
    } catch (err) {
      //console.error(err);
      setError("Failed to assign update. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <h1 className="text-2xl font-semibold text-gray-900">
                Assign Update to Hostnames
              </h1>
            </div>

            {/* Content */}
            <div className="px-6 py-4">
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Update Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Update
                    </label>
                    <select
                      value={selectedUpdate}
                      onChange={(e) => setSelectedUpdate(e.target.value)}
                      className="w-full rounded-md border border-gray-300 p-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">-- Select an Update --</option>
                      {updates.map((update) => (
                        <option key={update.updateID} value={update.updateID}>
                          {update.filePath} (ID: {update.updateID})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Error Message */}
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

                  {/* Hostnames Table */}
                  {hostnames.length > 0 && (
                    <div className="mt-4">
                      <div className="bg-gray-50 rounded-t-lg border border-gray-200 px-4 py-3">
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={selectAll}
                            onChange={handleSelectAllChange}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-sm font-medium text-gray-700">
                            Select All Hostnames
                          </span>
                        </label>
                      </div>
                      <div className="border-x border-b border-gray-200 rounded-b-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Select
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Hostname
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Last Update Date
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {hostnames.map((host) => (
                              <tr
                                key={host.systemID}
                                className="hover:bg-gray-50"
                              >
                                <td className="px-6 py-4">
                                  <input
                                    type="checkbox"
                                    checked={selectedHostnames.includes(
                                      host.systemID
                                    )}
                                    onChange={() =>
                                      handleCheckboxChange(host.systemID)
                                    }
                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                  />
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-900">
                                  {host.hostname}
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
                    </div>
                  )}

                  {/* Submit Button */}
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                    >
                      Assign Update
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AssignUpdatePage;
