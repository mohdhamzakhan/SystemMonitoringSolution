import React, { useState, useEffect } from 'react';

const SystemMonitorDashboard = () => {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [deviceDetails, setDeviceDetails] = useState(null);

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      const response = await fetch('/api/devices');
      const data = await response.json();
      setDevices(data);
    } catch (error) {
      console.error('Error fetching devices:', error);
    }
  };

  const fetchDeviceDetails = async (deviceId) => {
    try {
      const response = await fetch(`/api/devices/${deviceId}`);
      const data = await response.json();
      setDeviceDetails(data);
    } catch (error) {
      console.error('Error fetching device details:', error);
    }
  };

  const handleDeviceSelect = (device) => {
    setSelectedDevice(device);
    fetchDeviceDetails(device.deviceID);
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
            {devices.map((device) => (
              <tr key={device.deviceID} className="border-b hover:bg-gray-50">
                <td className="p-3">{device.hostname}</td>
                <td className="p-3">{device.username}</td>
                <td className="p-3">
                  <span 
                    className={`px-2 py-1 rounded ${
                      device.status.toLowerCase() === 'connected' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {device.status}
                  </span>
                </td>
                <td className="p-3">{new Date(device.lastUpdated).toLocaleString()}</td>
                <td className="p-3">
                  <button 
                    onClick={() => handleDeviceSelect(device)}
                    className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                  >
                    Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Device Details Modal */}
      {selectedDevice && deviceDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-11/12 max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Device Details: {selectedDevice.hostname}</h2>
              <button 
                onClick={() => setSelectedDevice(null)}
                className="text-red-500 hover:text-red-700"
              >
                Close
              </button>
            </div>

            {/* System Details Section */}
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">System Information</h3>
              <div className="grid grid-cols-2 gap-2">
                <p><strong>BIOS Serial:</strong> {deviceDetails.systemDetails?.biosSerial}</p>
                <p><strong>Processor:</strong> {deviceDetails.systemDetails?.processorFamily}</p>
                <p><strong>Total RAM:</strong> {deviceDetails.systemDetails?.totalRAM} GB</p>
                <p><strong>Disk Capacity:</strong> {deviceDetails.systemDetails?.diskCapacity} GB</p>
                <p><strong>OS:</strong> {deviceDetails.systemDetails?.osName} {deviceDetails.systemDetails?.osVersion}</p>
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
                  {deviceDetails.softwareDetails?.map((software, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="p-2 border">{software.softwareName}</td>
                      <td className="p-2 border">{software.version}</td>
                      <td className="p-2 border">{software.publisher}</td>
                    </tr>
                  ))}
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
