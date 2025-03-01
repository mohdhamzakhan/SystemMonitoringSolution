import React, { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronUp,
  Search,
  AlertCircle,
  Loader,
} from "lucide-react";
import Navbar from "./Navbar";
import useAuth from "./useAuth";
import { APP_CONSTANTS } from "../store";

// Define types for the data structure
interface SoftwareDetails {
  softwareName: string;
  version: string;
  publisher: string;
}

interface Device {
  hostname: string;
  username: string;
  softwareDetails: { $values: SoftwareDetails[] };
}

interface FlattenedSoftware {
  hostname: string;
  username: string;
  softwareName: string;
  version: string;
  publisher: string;
}

interface GroupedSoftware {
  softwareName: string;
  version: string;
  publisher: string;
  installations: { hostname: string; username: string }[];
}

const SoftwareDashboard = () => {
  useAuth(); // Ensures the user is authenticated before loading the page
  const [softwareData, setSoftwareData] = useState<FlattenedSoftware[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState<Record<string, boolean>>({});

  // Fetch software data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(
          APP_CONSTANTS.API_BASE_URL+"/api/devices/software"
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data && Array.isArray(data.$values)) {
          const flattenedData: FlattenedSoftware[] = data.$values.flatMap(
            (device: Device) =>
              device.softwareDetails.$values.map(
                (software: SoftwareDetails) => ({
                  hostname: device.hostname,
                  username: device.username,
                  softwareName: software.softwareName,
                  version: software.version,
                  publisher: software.publisher,
                })
              )
          );

          setSoftwareData(flattenedData);

          // Initialize collapse state
          const collapsedState = flattenedData.reduce(
            (acc: Record<string, boolean>, software) => ({
              ...acc,
              [software.softwareName]: true, // true means collapsed
            }),
            {}
          );
          setIsCollapsed(collapsedState);
        } else {
          throw new Error("Invalid data format received");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const toggleCollapse = (softwareName: string) => {
    setIsCollapsed((prev) => ({
      ...prev,
      [softwareName]: !prev[softwareName],
    }));
  };

  // Group and filter software data
  const groupedSoftwareData: Record<string, GroupedSoftware> =
    softwareData.reduce((acc: Record<string, GroupedSoftware>, software) => {
      if (
        searchTerm &&
        !software.softwareName
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) &&
        !software.hostname.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return acc;
      }

      const { softwareName, version, hostname, username, publisher } = software;

      if (!acc[softwareName]) {
        acc[softwareName] = {
          softwareName,
          version,
          publisher,
          installations: [],
        };
      }

      acc[softwareName].installations.push({ hostname, username });

      return acc;
    }, {});

  if (isLoading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-gray-50 p-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-center h-64">
              <Loader className="w-8 h-8 animate-spin text-gray-500" />
              <span className="ml-2 text-gray-600">
                Loading software inventory...
              </span>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Software Inventory
            </h1>
            <p className="mt-2 text-gray-600">
              Overview of all installed software across your infrastructure
            </p>
          </div>

          {/* Search and Stats */}
          <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search software or hostname..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="text-sm text-gray-600">
              Total Software: {Object.keys(groupedSoftwareData).length}
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700">
              <AlertCircle className="h-4 w-4 mr-2" />
              <p>Error loading software data: {error}</p>
            </div>
          )}

          {/* Software List */}
          {Object.keys(groupedSoftwareData).length > 0 ? (
            <div className="space-y-4">
              {Object.values(groupedSoftwareData).map((software, index) => (
                <div
                  key={index}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 hover:border-gray-300 transition-colors overflow-hidden"
                >
                  <div className="flex justify-between items-center p-4">
                    <div>
                      <h3 className="text-lg text-left font-semibold text-gray-900">
                        {software.softwareName}
                      </h3>
                      <p className="text-sm text-gray-500">
                        Version: {software.version} | Publisher:{" "}
                        {software.publisher} | Installations:{" "}
                        {software.installations.length}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleCollapse(software.softwareName)}
                      className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      {isCollapsed[software.softwareName] ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronUp className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {/* 🔥 Add this section to show/hide installations */}
                  {!isCollapsed[software.softwareName] && (
                    <div className="px-4 pb-4 overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Hostname
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Username
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {software.installations.map((install, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-6 text-left py-4 whitespace-nowrap text-sm text-gray-900">
                                <a href={`/device/${install.hostname}`}>
                                  {install.hostname}
                                </a>
                              </td>
                              <td className="px-6 text-left py-4 whitespace-nowrap text-sm text-gray-900">
                                {install.username}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p>No software data available</p>
          )}
        </div>
      </div>
    </>
  );
};

export default SoftwareDashboard;
