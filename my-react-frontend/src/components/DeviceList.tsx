import React, { useState, useEffect } from "react";
import axios from "axios";
import * as signalR from "@microsoft/signalr";
import { useNavigate } from "react-router-dom";
import LoadingPage from "./Loading.jsx";
import Navbar from "./Navbar.jsx";
import { APP_CONSTANTS } from "../store.js";
import useAuth from "./useAuth.ts";
import { 
  Key, 
  Trash2, 
  Search, 
  ChevronUp, 
  ChevronDown, 
  Wifi,
  User,
  Building2,
  Clock 
} from "lucide-react";

interface Device {
  hostname: string;
  username: string;
  department: string;
  status: string;
  lastUpdated: string;
  keyCount: number;
}

const DeviceList: React.FC = () => {
  useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortColumn, setSortColumn] = useState<keyof Device | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [filterType, setFilterType] = useState<"all" | "connected" | "disconnected">("all");
  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get(APP_CONSTANTS.API_BASE_URL + "/api/devices")
        .then((response) => {
            const data = response.data;
            const devicesArray = Array.isArray(data)
                ? data
                : data?.$values ?? [];

            setDevices(devicesArray);
            setLoading(false);
        })
      .catch(() => {
        setError("Failed to fetch device data");
        setLoading(false);
      });

    const hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(APP_CONSTANTS.API_BASE_URL + "/deviceHub")
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Information)
      .build();

    hubConnection
      .start()
      .then(() => {
        console.log("SignalR connected");

        hubConnection.on("DeviceStatusUpdated", (updatedDevice: Device) => {
          setDevices((prevDevices) => {
            const existingDeviceIndex = prevDevices.findIndex(
              (d) => d.hostname === updatedDevice.hostname
            );

            if (existingDeviceIndex !== -1) {
              const updatedDevices = [...prevDevices];
              updatedDevices[existingDeviceIndex] = updatedDevice;
              return updatedDevices;
            } else {
              return [...prevDevices, updatedDevice];
            }
          });
        });

        hubConnection.on("DeviceDeleted", (hostname: string) => {
          setDevices((prev) =>
            prev.filter((device) => device.hostname !== hostname)
          );
        });
      })
      .catch((err) =>
        console.error("Error establishing SignalR connection:", err)
      );

    return () => {
      hubConnection.stop().then(() => console.log("SignalR disconnected"));
    };
  }, []);

  const handleHostnameClick = (hostname: string) => {
    navigate(`/device/${hostname}`);
  };

  const connectedCount = devices.filter(
    (d) => d.status.toLowerCase() === "connected"
  ).length;
  const disconnectedCount = devices.length - connectedCount;
  const totalCount = devices.length;

  const filteredDevices = devices.filter((device) => {
    if (filterType === "connected")
      return device.status.toLowerCase() === "connected";
    if (filterType === "disconnected")
      return device.status.toLowerCase() === "disconnected";
    return true;
  });

  const handleDeleteDevice = async (hostname: string) => {
    if (!window.confirm(`Delete device ${hostname}? This cannot be undone.`))
      return;

    try {
      await axios.delete(
        `${APP_CONSTANTS.API_BASE_URL}/api/devices/${hostname}`
      );
      setDevices((prev) =>
        prev.filter((device) => device.hostname !== hostname)
      );
    } catch (err) {
      alert("Failed to delete device");
    }
  };

const searchedDevices = filteredDevices.filter((device) => {
  const query = searchQuery.toLowerCase();

  return (
    (device.hostname ?? "").toLowerCase().includes(query) ||
    (device.username ?? "").toLowerCase().includes(query) ||
    (device.department ?? "").toLowerCase().includes(query) ||
    (device.status ?? "").toLowerCase().includes(query)
  );
});


  const sortedDevices = [...searchedDevices].sort((a, b) => {
    if (!sortColumn) return 0;

    const valueA = a[sortColumn];
    const valueB = b[sortColumn];

    if (sortColumn === "keyCount") {
      return sortDirection === "asc" ? valueA - valueB : valueB - valueA;
    }

    const strA = valueA.toString().toLowerCase();
    const strB = valueB.toString().toLowerCase();

    if (strA < strB) return sortDirection === "asc" ? -1 : 1;
    if (strA > strB) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const handleSort = (column: keyof Device) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower === "connected") {
      return "inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800";
    }
    if (statusLower === "disconnected") {
      return "inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800";
    }
    return "inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800";
  };

  if (loading) return <LoadingPage />;

  return (
    <>
      {/* Professional Navbar */}
      <div className="fixed top-0 left-0 w-full z-50 bg-white border-b border-gray-200 shadow-sm">
        <Navbar />
      </div>

      <div className="pt-16 lg:pt-20 px-6 lg:px-8 py-8 bg-gray-50 min-h-screen">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight">
                Devices
              </h1>
              <p className="mt-2 text-lg text-gray-600">
                Manage and monitor all registered devices
              </p>
            </div>
            <div className="mt-6 lg:mt-0 flex flex-col sm:flex-row gap-3">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>{totalCount}</span>
                <span>Total Devices</span>
              </div>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-lg">
                  <div className="w-5 h-5 bg-green-600 rounded-full"></div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Connected</p>
                  <p className="text-2xl font-bold text-green-600">{connectedCount}</p>
                </div>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center">
                <div className="p-3 bg-red-100 rounded-lg">
                  <div className="w-5 h-5 bg-red-600 rounded-full"></div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Disconnected</p>
                  <p className="text-2xl font-bold text-red-600">{disconnectedCount}</p>
                </div>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center">
                <div className="p-3 bg-gray-100 rounded-lg">
                  <Wifi className="w-5 h-5 text-gray-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total</p>
                  <p className="text-2xl font-bold text-gray-900">{totalCount}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm mb-8">
          <div className="p-6">
            <div className="flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by hostname, username, department..."
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { type: "all", label: `All (${totalCount})`, color: "gray" },
                  { type: "connected", label: `Connected (${connectedCount})`, color: "green" },
                  { type: "disconnected", label: `Disconnected (${disconnectedCount})`, color: "red" },
                ].map(({ type, label, color }) => (
                  <button
                    key={type}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                      filterType === type
                        ? `bg-${color}-600 text-white border-${color}-600 hover:bg-${color}-700`
                        : `bg-white text-${color}-700 border-${color}-200 hover:bg-${color}-50 hover:border-${color}-300`
                    }`}
                    onClick={() => setFilterType(type as any)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        {error ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
            <div className="max-w-md mx-auto">
              <div className="w-20 h-20 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
                <Wifi className="w-10 h-10 text-red-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{error}</h3>
              <p className="text-gray-500 mb-6">Please try refreshing the page.</p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Refresh
              </button>
            </div>
          </div>
        ) : sortedDevices.length > 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {[
                      { key: "hostname", label: "Hostname", icon: Wifi },
                      { key: "username", label: "User", icon: User },
                      { key: "department", label: "Department", icon: Building2 },
                      { key: "status", label: "Status", icon: null },
                      { key: "lastUpdated", label: "Last Updated", icon: Clock },
                    ].map(({ key, label }) => (
                      <th
                        key={key}
                        onClick={() => handleSort(key as keyof Device)}
                        className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {label}
                          {sortColumn === key && (
                            <span className="w-4 h-4">
                              {sortDirection === "asc" ? (
                                <ChevronUp className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              )}
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedDevices.map((device) => (
                    <tr key={device.hostname} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-gray-300 rounded-md flex items-center justify-center mr-4">
                            <span className="text-sm font-medium text-gray-700">
                              {device.hostname.slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900 cursor-pointer hover:text-blue-600 hover:underline" onClick={() => handleHostnameClick(device.hostname)}>
                              {device.hostname}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {device.keyCount > 0 && (
                            <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mr-2">
                              <Key className="w-3 h-3 mr-1" />
                              {device.keyCount}
                            </div>
                          )}
                          <span className="text-sm font-medium text-gray-900">{device.username}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-3 py-1 bg-gray-100 text-xs font-medium text-gray-800 rounded-full">
                          {device.department}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={getStatusBadge(device.status)}>
                          {device.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(device.lastUpdated).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleDeleteDevice(device.hostname)}
                          className="text-red-600 hover:text-red-900 p-1 -ml-1 rounded-full hover:bg-red-50 transition-colors"
                          title="Delete device"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-16 text-center shadow-sm">
            <Wifi className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No devices found</h3>
            <p className="text-gray-500 mb-6">
              Try adjusting your search or filter criteria
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setFilterType("all");
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default DeviceList;
