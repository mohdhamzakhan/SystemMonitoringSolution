import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Monitor,
  HardDrive,
  Network,
  Shield,
  Users,
  Box,
  Cpu,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Trash2,
  LoaderCircle,
  Key,
} from "lucide-react";
import { useParams } from "react-router-dom";
import LoadingPage from "./Loading.jsx";
import Navbar from "./Navbar.jsx";
import useAuth from "./useAuth.js";
import { APP_CONSTANTS } from "../store.js";
interface CustomCardProps {
  children: React.ReactNode;
  className?: string;
}
interface Tab {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface CustomTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

interface SystemDetail {
  hostname: string;
  make?: string;
  model?: string;
  [key: string]: any;
}

interface OtherDetails {
  softwareName?: string;
  softwareDetailsID?: number;
  ipAddress?: string;
  macAddress?: string;
  [key: string]: any;
}

interface DeviceData {
  systemDetail: SystemDetail;
  status: string;
  lastUpdated: string;
  otherDetails: OtherDetails[];
}
// Custom Card Component
const CustomCard: React.FC<CustomCardProps> = ({
  children,
  className = "",
}) => (
  <div
    className={`bg-white rounded-lg shadow-lg border border-gray-100 ${className}`}
  >
    {children}
  </div>
);

// Custom Tabs Component
const CustomTabs: React.FC<CustomTabsProps> = ({
  tabs,
  activeTab,
  onTabChange,
}) => (
  <div className="flex space-x-1 bg-gray-100/50 p-1 rounded-lg">
    {tabs.map((tab) => (
      <button
        key={tab.value}
        onClick={() => onTabChange(tab.value)}
        className={`flex-1 flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
          activeTab === tab.value
            ? "bg-white text-blue-600 shadow-sm"
            : "text-gray-600 hover:text-gray-800 hover:bg-white/50"
        }`}
      >
        {tab.icon && <span className="mr-2">{tab.icon}</span>}
        {tab.label}
      </button>
    ))}
  </div>
);
const DeviceMonitor = () => {
  const [activeTab, setActiveTab] = useState("system");
  const [deviceData, setDeviceData] = useState<DeviceData | null>(null);
  const [loading, setLoading] = useState(false);
  const { hostname } = useParams();
  const [showKey, setShowKey] = useState(false);
  const [hiddenButtons, setHiddenButtons] = useState<Record<number, boolean>>(
    {}
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch data from the API based on the active tab
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        let systemData = await axios.get<{
          systemDetail: SystemDetail;
          status: string;
          lastUpdated: string;
        }>(`${APP_CONSTANTS.API_BASE_URL}/api/devices/${hostname}`);

        let otherData: { data: { $values: OtherDetails[] } } | undefined;

        if (activeTab === "storage") {
          otherData = await axios.get(
            `${APP_CONSTANTS.API_BASE_URL}/api/devices/${hostname}/disks`
          );
        } else if (activeTab === "network") {
          otherData = await axios.get(
            `${APP_CONSTANTS.API_BASE_URL}/api/devices/${hostname}/network`
          );
        } else if (activeTab === "security") {
          otherData = await axios.get(
            `${APP_CONSTANTS.API_BASE_URL}/api/devices/${hostname}/security`
          );
        } else if (activeTab === "users") {
          otherData = await axios.get(
            `${APP_CONSTANTS.API_BASE_URL}/api/devices/${hostname}/users`
          );
        } else if (activeTab === "software") {
          otherData = await axios.get(
            `${APP_CONSTANTS.API_BASE_URL}/api/devices/${hostname}/software`
          );
        } else if (activeTab === "monitor") {
          otherData = await axios.get(
            `${APP_CONSTANTS.API_BASE_URL}/api/devices/${hostname}/monitor`
          );
        } else if (activeTab === "bitlocker") {
          otherData = await axios.get(
            `${APP_CONSTANTS.API_BASE_URL}/api/devices/${hostname}/bitlocker`
          );
        }

        setDeviceData({
          systemDetail: systemData.data.systemDetail || {},
          status: systemData.data.status,
          lastUpdated: systemData.data.lastUpdated,
          otherDetails: otherData?.data?.$values || [],
        });
      } catch (error) {
        console.error("Error fetching data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [activeTab, hostname]);

  const handleUninstall = (software: OtherDetails) => {
    if (!deviceData) return;

    const confirmation = window.confirm(
      `Are you sure you want to uninstall ${software.softwareName}?`
    );
    if (!confirmation) return;

    const uninstallInfo = {
      hostname: deviceData.systemDetail.hostname,
      applicationId: software.softwareDetailsID,
      softwareName: software.softwareName,
      active: 1,
      updateDate: new Date().toISOString(),
      remarks: "Uninstalled via UI",
      systemId: deviceData.systemDetail.systemId,
    };
    axios
      .post(
        APP_CONSTANTS.API_BASE_URL + "/api/Installation/uninsatll",
        uninstallInfo
      )
      .then(() => {
        setHiddenButtons((prev) => ({
          ...prev,
          [software.softwareDetailsID as number]: true,
        }));
        alert("Uninstallation request sent successfully.");
      })
      .catch(() => {
        alert("Failed to send uninstallation request.");
        console.log(uninstallInfo);
      });
  };

  if (loading) {
    return <LoadingPage />;
  }

  const filteredSoftware =
    deviceData?.otherDetails?.filter(
      (software) =>
        software.softwareName &&
        software.softwareName.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

  if (!deviceData) {
    return <div>No data available</div>;
  }

  const tabs = [
    { value: "system", label: "System", icon: <Cpu className="h-4 w-4" /> },
    {
      value: "storage",
      label: "Storage",
      icon: <HardDrive className="h-4 w-4" />,
    },
    {
      value: "network",
      label: "Network",
      icon: <Network className="h-4 w-4" />,
    },
    {
      value: "security",
      label: "Security",
      icon: <Shield className="h-4 w-4" />,
    },
    { value: "users", label: "Users", icon: <Users className="h-4 w-4" /> },
    { value: "software", label: "Software", icon: <Box className="h-4 w-4" /> },
    {
      value: "monitor",
      label: "Monitor",
      icon: <Monitor className="h-4 w-4" />,
    },
    {
      value: "bitlocker",
      label: "Bitlocker",
      icon: <Key className="h-4 w-4" />,
    },
  ];

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto p-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Device Monitor
            </h1>
            <p className="text-gray-500">
              Manage and monitor your system resources
            </p>
          </div>

          {/* Status Overview */}
          <CustomCard className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      Hostname
                    </p>
                    <p className="mt-1 text-xl font-semibold text-gray-900">
                      {deviceData.systemDetail.hostname}
                    </p>
                  </div>
                  <Monitor className="h-8 w-8 text-blue-500" />
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Status</p>
                    <div className="mt-1 flex items-center">
                      <div
                        className={`h-3 w-3 rounded-full ${
                          deviceData.status === "Connected"
                            ? "bg-green-400"
                            : "bg-gray-400"
                        } mr-2`}
                      ></div>
                      <p className="text-xl font-semibold text-gray-900">
                        {deviceData.status} {/* Displaying status */}
                      </p>
                    </div>
                  </div>
                  <div className="text-green-500 text-sm font-medium">
                    {deviceData.status === "Connected" ? "Active" : "Inactive"}
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      Last Updated
                    </p>
                    <p className="mt-1 text-xl font-semibold text-gray-900">
                      {new Date(deviceData.lastUpdated).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="text-blue-500 text-sm font-medium">
                    {new Date(deviceData.lastUpdated).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          </CustomCard>

          {/* Main Content */}
          <div className="space-y-6">
            <CustomTabs
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />

            {/* Display the appropriate data based on active tab */}
            {activeTab === "system" && (
              <CustomCard>
                <div className="p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-6">
                    System Information
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {deviceData &&
                      Object.entries(deviceData.systemDetail)
                        .filter(
                          ([key]) => !key.includes("$") && key !== "systemId"
                        ) // Exclude keys with `$`
                        .map(([key, value]) => (
                          <div key={key} className="bg-gray-50 rounded-lg p-4">
                            <p className="text-sm font-medium text-gray-500 capitalize">
                              {key}
                            </p>
                            <p className="mt-1 text-gray-900 font-semibold">
                              {value}
                            </p>
                          </div>
                        ))}
                  </div>
                </div>
              </CustomCard>
            )}

            {/* Display other details based on active tab */}

            {activeTab === "storage" && (
              <CustomCard>
                <div className="p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-6">
                    Storage Details
                  </h2>
                  <div className="space-y-4">
                    {deviceData?.otherDetails?.map((disk, index) => {
                      return (
                        <div key={index} className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              {/* Show Network Icon if type is network */}
                              {disk.typeOfDrive === "Network" && (
                                <Network className="h-5 w-5 text-blue-500" />
                              )}

                              {/* Show Lock/Unlock icon if type is fixed */}
                              {disk.typeOfDrive === "Fixed" &&
                                (disk.isEncrypted === 1 ||
                                  disk.isEncrypted === 8) && (
                                  <Lock className="h-5 w-5 text-green-500" />
                                )}
                              {disk.typeOfDrive === "Fixed" &&
                                disk.isEncrypted === 2 && (
                                  <Unlock className="h-5 w-5 text-red-500" />
                                )}
                              {disk.typeOfDrive === "Fixed" &&
                                disk.isEncrypted === 3 && (
                                  <LoaderCircle className="h-5 w-5 text-red-500" />
                                )}

                              <div>
                                <h3 className="font-semibold text-gray-900">
                                  {disk.diskName}
                                </h3>
                              </div>
                            </div>

                            <div className="text-right">
                              <p className="font-semibold text-gray-900">
                                {disk.freeSpace} GB free
                              </p>
                              <p className="text-sm text-gray-500">
                                of {disk.capacity} GB
                              </p>
                            </div>
                          </div>

                          {/* Encryption Key Section */}

                          {/* Storage Bar */}
                          <div className="relative pt-1">
                            <div className="overflow-hidden h-2 text-xs flex rounded-full bg-gray-200">
                              <div
                                className="bg-blue-500 rounded-full transition-all duration-500"
                                style={{
                                  width: `${
                                    ((disk.capacity - disk.freeSpace) /
                                      disk.capacity) *
                                    100
                                  }%`,
                                }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CustomCard>
            )}

            {/* Network tab - Display each network item in rows */}
            {activeTab === "network" && (
              <CustomCard>
                <div className="p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-6">
                    Network Details
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {deviceData?.otherDetails?.map((network, index) => (
                      <div
                        key={index}
                        className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6"
                      >
                        <div className="space-y-4">
                          <div>
                            <p className="text-sm font-medium text-blue-600">
                              IP Address
                            </p>
                            <p className="text-lg font-semibold text-gray-900">
                              {network.ipAddress}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-blue-600">
                              Status
                            </p>
                            <p className="text-lg font-semibold text-gray-900">
                              {network.networkType}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-blue-600">
                              MAC Address
                            </p>
                            <p className="text-lg font-semibold text-gray-900">
                              {network.macAddress}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CustomCard>
            )}

            {/* Security tab - Display security settings in rows */}
            {activeTab === "security" && (
              <CustomCard>
                <div className="p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                    <Shield className="h-5 w-5 mr-2 text-blue-500" />
                    Security Information
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {deviceData?.otherDetails?.map((security, index) => (
                      <div
                        key={index}
                        className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6"
                      >
                        <div className="space-y-4">
                          <div>
                            <p className="text-sm font-medium text-blue-600">
                              Name
                            </p>
                            <p className="text-lg font-semibold text-gray-900">
                              {security.displayName}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-blue-600">
                              Product State
                            </p>
                            <p className="text-lg font-semibold text-gray-900">
                              {security.productState}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-blue-600">
                              Last Update
                            </p>
                            <p className="text-lg font-semibold text-gray-900">
                              {security.lastUpdate}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CustomCard>
            )}

            {/* Users tab - Display user details in rows */}
            {activeTab === "users" && (
              <CustomCard>
                <div className="p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                    <Users className="h-5 w-5 mr-2 text-blue-500" />
                    User Information
                  </h2>
                  <div className="overflow-x-auto rounded-lg shadow-sm">
                    <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600 border-b">
                            User Name
                          </th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600 border-b">
                            Account Status
                          </th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600 border-b">
                            Account Type
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {deviceData?.otherDetails?.map((user, index) => (
                          <tr
                            key={index}
                            className="hover:bg-gray-50 transition-colors duration-200"
                          >
                            <td className="px-6 py-4 text-left text-sm text-gray-900 border-b">
                              {user.userName}
                            </td>
                            <td className="px-6 py-4 text-left text-sm text-gray-900 border-b">
                              <div className="flex space-x-2">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                                    user.isLocked
                                      ? "bg-red-100 text-red-600"
                                      : "bg-green-100 text-green-600"
                                  }`}
                                >
                                  {user.isLocked ? "Locked" : "Unlocked"}
                                </span>
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                                    user.isEnabled
                                      ? "bg-green-100 text-green-600"
                                      : "bg-gray-100 text-gray-600"
                                  }`}
                                >
                                  {user.isEnabled ? "Enabled" : "Disabled"}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 text-left py-4 text-sm text-gray-900 border-b">
                              {user.description}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CustomCard>
            )}

            {/* Software tab - Display software details in rows */}

            {activeTab === "software" && (
              <CustomCard>
                <div className="p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                    Installed Software
                  </h2>

                  {/* Search Input */}
                  <input
                    type="text"
                    placeholder="Search software..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="mb-4 p-2 border border-gray-300 rounded-lg w-full"
                  />

                  <div className="overflow-y-auto max-h-[400px] border rounded-lg shadow-sm">
                    <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600 border-b">
                            Software Name
                          </th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600 border-b">
                            Version
                          </th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-gray-600 border-b">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSoftware.map((software, index) => (
                          <tr
                            key={index}
                            className="hover:bg-gray-50 transition-colors duration-200"
                          >
                            <td className="px-6 py-4 text-left text-sm text-gray-900 border-b">
                              {software.softwareName}
                            </td>
                            <td className="px-6 py-4 text-left text-sm text-gray-900 border-b">
                              {software.version || "N/A"}
                            </td>
                            <td className="px-6 py-4 text-left text-sm text-gray-900 border-b">
                              {(software.uninstallString !== "Unknown" ||
                                software.uninstallString == null) &&
                                software.softwareDetailsID !== undefined &&
                                !hiddenButtons[software.softwareDetailsID] && (
                                  <button
                                    onClick={() => handleUninstall(software)}
                                    className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center"
                                  >
                                    Uninstall
                                  </button>
                                )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Show message if no software matches search */}
                    {filteredSoftware.length === 0 && (
                      <p className="text-center text-gray-500 p-4">
                        No software found.
                      </p>
                    )}
                  </div>
                </div>
              </CustomCard>
            )}

            {activeTab === "monitor" && (
              <CustomCard>
                <div className="p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-6">
                    Monitor Details
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {deviceData?.otherDetails?.map((monitor, index) => (
                      <div
                        key={index}
                        className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6"
                      >
                        <div className="space-y-4">
                          <div>
                            <p className="text-sm font-medium text-blue-600">
                              Manufacturer
                            </p>
                            <p className="text-lg font-semibold text-gray-900">
                              {monitor.manufacturer}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-blue-600">
                              SerialNo
                            </p>
                            <p className="text-lg font-semibold text-gray-900">
                              {monitor.serialNo}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-blue-600">
                              DisplayName
                            </p>
                            <p className="text-lg font-semibold text-gray-900">
                              {monitor.displayName}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-blue-600">
                              Manufactoring Year
                            </p>
                            <p className="text-lg font-semibold text-gray-900">
                              {monitor.yearOfManufacture}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CustomCard>
            )}

            {activeTab === "bitlocker" && (
              <CustomCard>
                <div className="p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-6">
                    BitLocker Recovery Keys
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {deviceData?.otherDetails?.map((key, index) => (
                      <div
                        key={index}
                        className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6"
                      >
                        <div className="space-y-4">
                          <div>
                            <p className="text-sm font-medium text-blue-600">
                              Identifier
                            </p>
                            <p className="text-lg font-semibold text-gray-900">
                              {key.identifier}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-blue-600">
                              Recovery Key
                            </p>
                            <p className="text-lg font-semibold text-gray-900 break-all">
                              {key.recoveryKey}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CustomCard>
            )}

            {/* Similarly, you can handle the content for other tabs like network, security, etc. */}
          </div>
        </div>
      </div>
    </>
  );
};

export default DeviceMonitor;
