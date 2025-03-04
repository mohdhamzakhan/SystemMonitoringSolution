import React, { useState, useEffect } from "react";
import axios from "axios";
import * as signalR from "@microsoft/signalr";
import { useNavigate } from "react-router-dom";
import LoadingPage from "./Loading.jsx";
import Navbar from "./Navbar.jsx";
import { APP_CONSTANTS } from "../store.js";
import useAuth from "./useAuth.ts";
import { Key } from "lucide-react";

// Define the type for a device
interface Device {
  hostname: string;
  username: string;
  department: string;
  status: string;
  lastUpdated: string;
  keyCount: number;
}

const DeviceList: React.FC = () => {
  useAuth(); // Ensures the user is authenticated before loading the page
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortColumn, setSortColumn] = useState<keyof Device | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [filterType, setFilterType] = useState<
    "all" | "connected" | "disconnected"
  >("all");
  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get(APP_CONSTANTS.API_BASE_URL + "/api/devices")
      .then((response) => {
        if (response.data && Array.isArray(response.data.$values)) {
          setDevices(response.data.$values as Device[]);
        } else {
          setDevices([]);
        }
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

  const searchedDevices = filteredDevices.filter(
    (device) =>
      device.hostname.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.status.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedDevices = [...searchedDevices].sort((a, b) => {
    if (!sortColumn) return 0;

    const valueA = a[sortColumn];
    const valueB = b[sortColumn];

    // If sorting the "keyCount" column, use numeric comparison
    if (sortColumn === "keyCount") {
      return sortDirection === "asc" ? valueA - valueB : valueB - valueA;
    }

    // Default string comparison for other columns
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

  if (loading) return <LoadingPage />;

  return (
    <>
      {/* Fixed Navbar */}
      <div className="fixed top-0 left-0 w-full z-50 bg-white shadow">
        <Navbar />
      </div>

      <div className="pt-20 p-5 bg-gray-100 min-h-screen">
        {/* Device Summary */}
        <div className="mb-4 flex justify-center space-x-6">
          <button
            className={`px-4 py-2 rounded-lg shadow ${
              filterType === "connected"
                ? "bg-green-600 text-white"
                : "bg-green-100 text-green-800"
            }`}
            onClick={() => setFilterType("connected")}
          >
            Connected: {connectedCount}
          </button>
          <button
            className={`px-4 py-2 rounded-lg shadow ${
              filterType === "disconnected"
                ? "bg-red-600 text-white"
                : "bg-red-100 text-red-800"
            }`}
            onClick={() => setFilterType("disconnected")}
          >
            Disconnected: {disconnectedCount}
          </button>
          <button
            className={`px-4 py-2 rounded-lg shadow ${
              filterType === "all"
                ? "bg-gray-600 text-white"
                : "bg-gray-200 text-gray-800"
            }`}
            onClick={() => setFilterType("all")}
          >
            Total: {totalCount}
          </button>
        </div>

        {/* Search Input */}
        <div className="mb-4 flex justify-center">
          <input
            type="text"
            placeholder="Search by Hostname, Username, or Status"
            className="p-2 w-full max-w-md border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {error ? (
          <div className="text-center text-red-500 text-xl">{error}</div>
        ) : sortedDevices.length > 0 ? (
          <div className="rounded-lg shadow">
            <table className="w-full border-collapse border border-gray-200">
              {/* Sticky Table Header */}
              <thead className="bg-gray-50 sticky top-16 z-40 shadow">
                <tr>
                  {[
                    "hostname",
                    "username",
                    "department",
                    "status",
                    "lastUpdated",
                  ].map((col) => (
                    <th
                      key={col}
                      onClick={() => handleSort(col as keyof Device)}
                      className="p-4 text-sm font-semibold text-gray-600 border-b border-gray-300 cursor-pointer hover:bg-gray-100"
                    >
                      {col.charAt(0).toUpperCase() + col.slice(1)}
                      {sortColumn === col &&
                        (sortDirection === "asc" ? " ▲" : " ▼")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedDevices.map((device) => (
                  <tr key={device.hostname} className="hover:bg-gray-50">
                    <td
                      className="p-4 text-blue-600 font-medium cursor-pointer hover:underline"
                      onClick={() => handleHostnameClick(device.hostname)}
                    >
                      {device.hostname}
                    </td>
                    <td className="p-4 text-gray-800 flex items-center space-x-2">
                      {/* Key Icon & Count */}
                      {device.keyCount > 0 && (
                        <div className="flex items-center space-x-1 text-blue-600">
                          <Key size={16} /> {/* Key icon */}
                          <span className="text-sm font-medium">
                            {device.keyCount}
                          </span>
                        </div>
                      )}

                      {/* Username */}
                      <span className="text-gray-800">{device.username}</span>
                    </td>

                    <td className="p-4 text-gray-800">{device.department}</td>
                    <td className="p-4 text-gray-800">{device.status}</td>
                    <td className="p-4 text-gray-600">
                      {new Date(device.lastUpdated).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center text-gray-600 text-xl">
            No devices found.
          </div>
        )}
      </div>
    </>
  );
};

export default DeviceList;
