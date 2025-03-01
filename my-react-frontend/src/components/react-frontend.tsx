import React, { useState, useEffect } from "react";
import { APP_CONSTANTS } from "../store";
type Device = {
  hostname: string;
  username: string;
  status: string;
  lastUpdated: string;
};

type SystemDetails = {
  biosSerial?: string;
  processorFamily?: string;
  totalRAM?: number;
  diskCapacity?: number;
  osName?: string;
  osVersion?: string;
};

type SoftwareDetails = {
  softwareName: string;
  version: string;
  publisher?: string;
};

type DeviceDetails = {
  systemDetails: SystemDetails;
  softwareDetails: SoftwareDetails[];
};

const SystemMonitorDashboard = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [deviceDetails, setDeviceDetails] = useState<DeviceDetails | null>(
    null
  );

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      const response = await fetch(APP_CONSTANTS.API_BASE_URL + "/api/devices");
      const data = await response.json();

      const devicesArray: Device[] = data.$values || []; // Ensure it's an array
      setDevices(devicesArray);
    } catch (error) {
      console.error("Error fetching devices:", error);
    }
  };

  const fetchDeviceDetails = async (deviceId: string) => {
    try {
      const response = await fetch(
        `${APP_CONSTANTS.API_BASE_URL}/api/devices/${deviceId}`
      );
      const data = await response.json();

      const systemDetails: SystemDetails = data.systemDetail || {};
      const softwareDetails: SoftwareDetails[] =
        data.softwareDetails?.$values || [];

      setDeviceDetails({ systemDetails, softwareDetails });
    } catch (error) {
      console.error("Error fetching device details:", error);
    }
  };

  const handleDeviceSelect = (device: Device) => {
    setSelectedDevice(device);
    fetchDeviceDetails(device.hostname); // Ensure device.hostname is used correctly
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">System Monitoring Dashboard</h1>

      {/* Devices Table */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">Hostname</th>
              <th className="p-3 text-left">Username</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Last Updated</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {devices.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center p-3">
                  No devices found
                </td>
              </tr>
            ) : (
              devices.map((device: Device) => (
                <tr key={device.hostname} className="border-b hover:bg-gray-50">
                  <td className="p-3">{device.hostname}</td>
                  <td className="p-3">{device.username}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded ${
                        device.status.toLowerCase() === "connected"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {device.status}
                    </span>
                  </td>
                  <td className="p-3">
                    {new Date(device.lastUpdated).toLocaleString()}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => handleDeviceSelect(device)}
                      className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Device Details Modal */}
      {selectedDevice && deviceDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-11/12 max-w-2xl max-h-[90vh] overflow-y-auto relative">
            {/* Close button */}
            <button
              onClick={() => setSelectedDevice(null)}
              className="absolute top-4 right-4 text-red-500 hover:text-red-700"
            >
              Close
            </button>

            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                Device Details: {selectedDevice.hostname}
              </h2>
            </div>

            {/* System Details Section */}
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">System Information</h3>
              <div className="grid grid-cols-2 gap-2">
                <p>
                  <strong>BIOS Serial:</strong>{" "}
                  {deviceDetails.systemDetails?.biosSerial}
                </p>
                <p>
                  <strong>Processor:</strong>{" "}
                  {deviceDetails.systemDetails?.processorFamily}
                </p>
                <p>
                  <strong>Total RAM:</strong>{" "}
                  {deviceDetails.systemDetails?.totalRAM} GB
                </p>
                <p>
                  <strong>Disk Capacity:</strong>{" "}
                  {deviceDetails.systemDetails?.diskCapacity} GB
                </p>
                <p>
                  <strong>OS:</strong> {deviceDetails.systemDetails?.osName}{" "}
                  {deviceDetails.systemDetails?.osVersion}
                </p>
              </div>
            </div>

            {/* Software Details Section */}
            <div>
              <h3 className="text-lg font-semibold mb-2">Installed Software</h3>
              <table className="w-full border">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 border">Name</th>
                    <th className="p-2 border">Version</th>
                    <th className="p-2 border">Publisher</th>
                  </tr>
                </thead>
                <tbody>
                  {deviceDetails?.softwareDetails?.map(
                    (software: SoftwareDetails, index: number) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="p-2 border">{software.softwareName}</td>
                        <td className="p-2 border">{software.version}</td>
                        <td className="p-2 border">
                          {software.publisher || "N/A"}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemMonitorDashboard;
