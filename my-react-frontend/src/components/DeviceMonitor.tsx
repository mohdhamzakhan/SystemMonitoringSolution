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
    WifiOff,
    EyeOff,
    Globe,
    Trash2,
    LoaderCircle,
    Key,
    BatteryFull,
    BatteryMedium,
    BatteryLow,
    Zap, ArrowDown, Plug,
    Fingerprint,
    Laptop,
    Layers,
    MemoryStick,
    CalendarCheck,
    CalendarX,
    ShieldCheck,
    ShieldOff,
    Wifi,
    EthernetPort,
    Activity,
    Copy,
    Clock,
    Package,
    ShieldAlert,
    UserCheck,
    UserX,
    User,
    CheckCircle,
    XCircle,
    Search,
    Factory,
    Hash,
    Tag,
    Calendar,
    KeyRound
} from "lucide-react";
import { useParams } from "react-router-dom";
import LoadingPage from "./Loading.jsx";
import Navbar from "./Navbar.jsx";
import useAuth from "./useAuth.js";
import { APP_CONSTANTS } from "../store.js";
import { getRole } from "../auth";
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
    username: string;
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

const getChargingState = (status?: string) => {
    if (!status) return null;

    const s = status.toLowerCase();

    if (s.includes("ac power")) {
        return {
            label: "Charging",
            color: "text-blue-600",
            icon: <Zap className="h-4 w-4 text-blue-500" />,
        };
    }

    if (s.includes("discharging")) {
        return {
            label: "Discharging",
            color: "text-orange-600",
            icon: <ArrowDown className="h-4 w-4 text-orange-500" />,
        };
    }

    if (s.includes("full") || s.includes("plug")) {
        return {
            label: "Plugged In",
            color: "text-green-600",
            icon: <Plug className="h-4 w-4 text-green-500" />,
        };
    }

    return {
        label: status,
        color: "text-gray-600",
        icon: null,
    };
};

const getSecurityStatus = (state) => {
    if (!state) return { label: "Unknown", color: "bg-gray-400", Icon: ShieldAlert };

    const s = state.toString();

    // Common Windows Security Center states
    if (s.endsWith("10") || s.endsWith("11"))
        return { label: "Active", color: "bg-green-500", Icon: ShieldCheck };

    if (s.endsWith("00"))
        return { label: "Disabled", color: "bg-red-500", Icon: ShieldX };

    return { label: "Warning", color: "bg-yellow-500", Icon: ShieldAlert };
};

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
                className={`flex-1 flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${activeTab === tab.value
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
    const [batteryInfo, setBatteryInfo] = useState<any[]>([]);
    const [copied, setCopied] = useState(false);
    const [copiedKey, setCopiedKey] = useState(null);
    const [logs, setLogs] = useState<any[]>([]);
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [logsLoading, setLogsLoading] = useState(false);
    const [showArchived, setShowArchived] = useState(false);
    const [workingTime, setWorkingTime] = useState<{ [key: string]: number }>({});



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
                    console.log("Network", otherData)
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

                const batteryRes = await axios.get(
                    `${APP_CONSTANTS.API_BASE_URL}/api/devices/${hostname}/battery`
                );

                setBatteryInfo(normalizeArray(batteryRes.data));

                setDeviceData({
                    systemDetail: systemData.data.systemDetail || {},
                    status: systemData.data.status,
                    lastUpdated: systemData.data.lastUpdated,
                    username: systemData.data.username,

                    // ✅ IMPORTANT: keep switch info from API
                    ...(activeTab === "network" ? otherData?.data : {}),

                    // ✅ IMPORTANT: map correct data
                    otherDetails:
                        activeTab === "network"
                            ? otherData?.data?.networkDetails || []
                            : normalizeArray(otherData?.data),
                });

                console.log("Data From API :", deviceData)

            } catch (error) {
                console.error("Error fetching data", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [activeTab, hostname]);

    useEffect(() => {
        if (activeTab !== "logs") return;

        const fetchLogs = async () => {
            setLogsLoading(true);
            try {
                const res = await axios.get(
                    `${APP_CONSTANTS.API_BASE_URL}/api/devices/${hostname}/systemEvent`,
                    {
                        params: {
                            from: fromDate || undefined,
                            to: toDate || undefined,
                        },
                    }
                );

                const data = res.data?.$values ?? [];
                setLogs(data);
                calculateWorkingTime(data);

                console.log("Logs fetched:", data);
            } catch (err) {
                console.error("Failed to fetch logs", err);
            } finally {
                setLogsLoading(false);
            }
        };

        fetchLogs();
    }, [activeTab, fromDate, toDate, hostname]);

    // Add this useEffect after the existing logs useEffect
    useEffect(() => {
        if (activeTab !== "logs" || logs.length === 0) return;

        // Recalculate working time every minute to update current active time
        const interval = setInterval(() => {
            calculateWorkingTime(logs);
        }, 60000); // Update every 60 seconds

        return () => clearInterval(interval);
    }, [activeTab, logs]);

    const normalizeArray = (data: any) => {
        if (!data) return [];
        if (Array.isArray(data)) return data;
        if (Array.isArray(data.$values)) return data.$values;
        return [];
    };

    //   const fetchLogs = async () => {
    //     setLogsLoading(true);
    //     try {
    //       const res = await axios.get(
    //         `${APP_CONSTANTS.API_BASE_URL}/api/devices/${hostname}/systemEvent`,
    //         {
    //           params: {
    //             from: fromDate || undefined,
    //             to: toDate || undefined,
    //           },
    //         }
    //       );

    //       const data = res.data?.$values ?? [];
    //       setLogs(data);

    //       console.log("Logs fetched:", data);
    //     } catch (err) {
    //       console.error("Failed to fetch logs", err);
    //     } finally {
    //       setLogsLoading(false);
    //     }
    //   };

    //   fetchLogs();
    // }, [activeTab, fromDate, toDate, hostname]);

    const calculateWorkingTime = (logs) => {
        if (!logs || logs.length === 0) {
            setWorkingTime({});
            return;
        }

        // Group logs by date
        const logsByDate = {};

        logs.forEach(log => {
            const date = new Date(log.eventTime).toLocaleDateString();
            if (!logsByDate[date]) {
                logsByDate[date] = [];
            }
            logsByDate[date].push({
                ...log,
                time: new Date(log.eventTime)
            });
        });

        // Calculate working time for each date
        const workingTimeByDate = {};
        const today = new Date().toLocaleDateString();

        Object.keys(logsByDate).forEach(date => {
            const dayLogs = logsByDate[date].sort((a, b) => a.time - b.time);
            let totalWorkingMs = 0;
            let sessionStart = null;
            let isLocked = false;

            dayLogs.forEach((log, index) => {
                const eventType = log.eventType?.toLowerCase() || '';

                if (eventType.includes('startup') || eventType.includes('login') || eventType.includes('unlock')) {
                    if (!sessionStart && !isLocked) {
                        // Start a new session
                        sessionStart = log.time;
                    } else if (eventType.includes('unlock') && isLocked) {
                        // Resume session after unlock
                        isLocked = false;
                        sessionStart = log.time;
                    }
                } else if (eventType.includes('lock')) {
                    if (sessionStart && !isLocked) {
                        // Pause session on lock
                        totalWorkingMs += log.time - sessionStart;
                        isLocked = true;
                        sessionStart = null;
                    }
                } else if (eventType.includes('shutdown') || eventType.includes('logout')) {
                    if (sessionStart && !isLocked) {
                        // End session
                        totalWorkingMs += log.time - sessionStart;
                        sessionStart = null;
                    }
                    isLocked = false;
                }

                // If this is the last log of the day
                if (index === dayLogs.length - 1) {
                    if (sessionStart && !isLocked) {
                        // Session is still active
                        if (date === today) {
                            // For today, calculate up to current time
                            totalWorkingMs += new Date() - sessionStart;
                        } else {
                            // For past dates, use last log time
                            totalWorkingMs += log.time - sessionStart;
                        }
                    }
                }
            });

            workingTimeByDate[date] = totalWorkingMs;
        });

        setWorkingTime(workingTimeByDate);
    };

    const formatWorkingTime = (ms) => {
        if (!ms || ms === 0) return '0h 0m';

        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

        return `${hours}h ${minutes}m`;
    };

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

    const cardStyles = [
        "from-blue-100 to-blue-50 text-blue-900 border-blue-200",
        "from-green-100 to-green-50 text-green-900 border-green-200",
        "from-purple-100 to-purple-50 text-purple-900 border-purple-200",
        "from-yellow-100 to-yellow-50 text-yellow-900 border-yellow-200",
        "from-pink-100 to-pink-50 text-pink-900 border-pink-200",
        "from-indigo-100 to-indigo-50 text-indigo-900 border-indigo-200",
        "from-teal-100 to-teal-50 text-teal-900 border-teal-200",
        "from-cyan-100 to-cyan-50 text-cyan-900 border-cyan-200",
        "from-orange-100 to-orange-50 text-orange-900 border-orange-200",
        "from-lime-100 to-lime-50 text-lime-900 border-lime-200",
        "from-rose-100 to-rose-50 text-rose-900 border-rose-200",
        "from-gray-100 to-gray-50 text-gray-900 border-gray-200"
    ];

    const fieldIcons = {
        hostname: Monitor,
        biosserial: Fingerprint,
        productid: Key,
        model: Laptop,
        processorfamily: Cpu,
        osname: Monitor,        // FIXED ✅
        osversion: Layers,
        memoryslots: MemoryStick,
        physicalmemory: HardDrive,
        ouname: Users,
        warrantystartdate: CalendarCheck,
        warrantyenddate: CalendarX
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

    console.log("deviceDataHamza", deviceData)

    const isAdmin = getRole() === "Admin";  // ← add this line before the tabs array

    const tabs = [
        { value: "system", label: "System", icon: <Cpu className="h-4 w-4" /> },
        { value: "storage", label: "Storage", icon: <HardDrive className="h-4 w-4" /> },
        { value: "network", label: "Network", icon: <Network className="h-4 w-4" /> },
        { value: "security", label: "Security", icon: <Shield className="h-4 w-4" /> },
        { value: "users", label: "Users", icon: <Users className="h-4 w-4" /> },
        { value: "software", label: "Software", icon: <Box className="h-4 w-4" /> },
        { value: "monitor", label: "Monitor", icon: <Monitor className="h-4 w-4" /> },

        // ✅ Only show these tabs for admins
        ...(isAdmin ? [
            { value: "bitlocker", label: "Bitlocker", icon: <Key className="h-4 w-4" /> },
            { value: "logs", label: "Logs", icon: <Activity className="h-4 w-4" /> },
        ] : []),
    ];

    console.log("deviceData", batteryInfo);
    const battery = Array.isArray(batteryInfo) && batteryInfo.length > 0
        ? batteryInfo[0]
        : null;

    const batteryHealth =
        battery &&
            typeof battery.designCapacity === "number" &&
            typeof battery.fullChargedCapacity === "number"
            ? Math.round(
                (battery.fullChargedCapacity / battery.designCapacity) * 100
            )
            : null;

    console.log("battery", battery)

    const getUsagePercent = (capacity, free) =>
        Math.round(((capacity - free) / capacity) * 100);

    const getUsageColor = (percent) => {
        if (percent < 60) return "bg-green-500";
        if (percent < 85) return "bg-yellow-500";
        return "bg-red-500";
    };

    const isConnected = (type) =>
        type?.toLowerCase().includes("connected") ||
        type?.toLowerCase().includes("up");

    const getNetworkIcon = (type) => {
        if (type?.toLowerCase().includes("wifi")) return Wifi;
        if (type?.toLowerCase().includes("ethernet")) return EthernetPort;
        return Network;
    };


    const isUpdatedToday = (dateString) => {
        if (!dateString) return false;

        const updatedDate = new Date(dateString);
        const today = new Date();

        return (
            updatedDate.getFullYear() === today.getFullYear() &&
            updatedDate.getMonth() === today.getMonth() &&
            updatedDate.getDate() === today.getDate()
        );
    };


    const getEncryptionIcon = (disk) => {
        if (disk.typeOfDrive !== "Fixed") return null;

        if (disk.isEncrypted === 1 || disk.isEncrypted === 8)
            return <ShieldCheck className="h-5 w-5 text-green-600" />;

        if (disk.isEncrypted === 2)
            return <ShieldOff className="h-5 w-5 text-red-500" />;

        if (disk.isEncrypted === 3)
            return <LoaderCircle className="h-5 w-5 text-orange-500 animate-spin" />;

        return null;
    };

    const copyToClipboard = (text) => {
        if (!text) return;

        // Modern browsers (HTTPS)
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text);
        } else {
            // Fallback (works everywhere)
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.left = "-9999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();

            try {
                document.execCommand("copy");
            } finally {
                document.body.removeChild(textArea);
            }
        }
    };

    const getEventColor = (eventType) => {
        const colorMap = {
            'Startup': 'bg-green-100 text-green-800',
            'Shutdown': 'bg-red-100 text-red-800',
            'Lock': 'bg-yellow-100 text-yellow-800',
            'Unlock': 'bg-blue-100 text-blue-800',
            'Login': 'bg-purple-100 text-purple-800',
            'Logout': 'bg-orange-100 text-orange-800',
            'Error': 'bg-red-100 text-red-800',
            'Warning': 'bg-amber-100 text-amber-800',
            'Info': 'bg-cyan-100 text-cyan-800',
        };

        if (colorMap[eventType]) {
            return colorMap[eventType];
        }

        const colors = [
            'bg-indigo-100 text-indigo-800',
            'bg-pink-100 text-pink-800',
            'bg-teal-100 text-teal-800',
            'bg-lime-100 text-lime-800',
            'bg-rose-100 text-rose-800',
            'bg-violet-100 text-violet-800',
            'bg-emerald-100 text-emerald-800',
            'bg-fuchsia-100 text-fuchsia-800',
        ];

        let hash = 0;
        for (let i = 0; i < eventType.length; i++) {
            hash = eventType.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    };

    const fetchLogs = async () => {
        setLogsLoading(true);
        try {
            let url = `${APP_CONSTANTS.API_BASE_URL}/api/devices/${hostname}/systemEvent`;
            const params = new URLSearchParams();

            if (fromDate) params.append('from', fromDate);
            if (toDate) params.append('to', toDate);

            if (params.toString()) {
                url += `?${params.toString()}`;
            }

            const response = await fetch(url);
            const data = await response.json();
            // Handle the $values array structure
            const logsArray = data.$values || data;
            setLogs(logsArray);
        } catch (error) {
            console.error("Error fetching logs:", error);
        } finally {
            setLogsLoading(false);
        }
    };


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
                        <div className="
                        grid grid-cols-1 md:grid-cols-4
                        divide-y md:divide-y-0 md:divide-x
                        divide-gray-200
                    ">
                            {/* Hostname */}
                            <div className="p-6 flex items-center justify-between">
                                <div className="space-y-3">

                                    {/* Hostname */}
                                    <div className="flex items-start gap-3">
                                        <div className="p-0 rounded-lg bg-blue-50">
                                            <Monitor className="h-4 w-4 text-blue-600" />
                                        </div>
                                        <div>

                                            <p className="text-lg font-semibold text-gray-900">
                                                {deviceData.systemDetail.hostname}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Domain */}
                                    <div className="flex items-start gap-3">
                                        <div className="p-0 rounded-lg bg-purple-50">
                                            <Globe className="h-4 w-4 text-purple-600" />
                                        </div>
                                        <div>

                                            <p className="text-sm font-medium text-gray-700">
                                                {deviceData.systemDetail.domain || "—"}
                                            </p>
                                        </div>
                                    </div>

                                    {/* User */}
                                    <div className="flex items-start gap-3">
                                        <div className="p-0 rounded-lg bg-green-50">
                                            <User className="h-4 w-4 text-green-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-700">
                                                {deviceData.username
                                                    ?.replace(/[._-]/g, " ")
                                                    .split(" ")
                                                    .map(word =>
                                                        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                                                    )
                                                    .join(" ") || "—"}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-2 rounded-lg bg-blue-50">
                                    <Monitor className="h-6 w-6 text-blue-600" />
                                </div>
                            </div>

                            {/* Status */}
                            <div className="p-6 flex items-center justify-between rounded-xl border bg-gradient-to-br from-white to-gray-50 shadow-sm">

                                {/* LEFT */}
                                <div className="flex items-center gap-4">

                                    {/* Icon */}
                                    <div
                                        className={`p-2 rounded-lg ${deviceData.status === "Connected"
                                                ? "bg-green-50"
                                                : "bg-gray-100"
                                            }`}
                                    >
                                        {deviceData.status === "Connected" ? (
                                            <Activity className="h-5 w-5 text-green-600" />
                                        ) : (
                                            <WifiOff className="h-5 w-5 text-gray-500" />
                                        )}
                                    </div>

                                    {/* Text */}
                                    <div>
                                        <p className="text-xs uppercase tracking-wide text-gray-500">
                                            Status
                                        </p>

                                        <div className="mt-1 flex items-center gap-2">
                                            <span
                                                className={`
                        inline-flex items-center gap-1.5 px-2.5 py-1
                        rounded-full text-xs font-medium
                        ${deviceData.status === "Connected"
                                                        ? "bg-green-100 text-green-700"
                                                        : "bg-gray-200 text-gray-600"
                                                    }
                    `}
                                            >
                                                <span
                                                    className={`h-2 w-2 rounded-full ${deviceData.status === "Connected"
                                                            ? "bg-green-500 animate-pulse"
                                                            : "bg-gray-400"
                                                        }`}
                                                />
                                                {deviceData.status}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* RIGHT */}
                                <div className="text-right">
                                    <p
                                        className={`text-sm font-semibold ${deviceData.status === "Connected"
                                                ? "text-green-600"
                                                : "text-gray-500"
                                            }`}
                                    >
                                        {deviceData.status === "Connected" ? "Active" : "Inactive"}
                                    </p>

                                    <p className="text-xs text-gray-400">
                                        {deviceData.status === "Connected"
                                            ? "System is reachable"
                                            : "No recent response"}
                                    </p>
                                </div>
                            </div>

                            {/* Last Updated */}
                            <div className="p-6 flex items-center justify-between border rounded-lg bg-white">

                                {/* LEFT */}
                                <div>
                                    <p className="text-xs uppercase tracking-wide text-gray-500">
                                        Last Updated
                                    </p>

                                    <p className="mt-1 text-lg font-semibold text-gray-900">
                                        {new Date(deviceData.lastUpdated).toLocaleTimeString()}
                                    </p>

                                    <p className="text-sm text-gray-500">
                                        {new Date(deviceData.lastUpdated).toLocaleDateString()}
                                    </p>
                                </div>

                                {/* RIGHT ICON */}
                                <div className="p-2 rounded-md bg-gray-100">
                                    <Clock className="h-5 w-5 text-gray-600" />
                                </div>
                            </div>

                            {/* Battery */}
                            <div className="p-6 flex items-center justify-between">
                                {batteryHealth !== null ? (
                                    <>
                                        <div>
                                            <p className="text-xs uppercase tracking-wide text-gray-500">
                                                Battery
                                            </p>

                                            <p
                                                className={`mt-1 text-lg font-semibold ${batteryHealth >= 75
                                                    ? "text-green-600"
                                                    : batteryHealth >= 50
                                                        ? "text-yellow-600"
                                                        : "text-red-600"
                                                    }`}
                                            >
                                                {batteryHealth}%
                                            </p>

                                            <p className="text-sm text-gray-600">
                                                {batteryHealth >= 75
                                                    ? "Healthy"
                                                    : batteryHealth >= 50
                                                        ? "Needs attention"
                                                        : "Replace recommended"}
                                            </p>

                                            {/* Charging state */}
                                            {(() => {
                                                const charging = getChargingState(battery.batteryStatus);
                                                return charging ? (
                                                    <div
                                                        className={`mt-1 flex items-center gap-1 text-xs ${charging.color}`}
                                                    >
                                                        {charging.icon}
                                                        <span>{charging.label}</span>
                                                    </div>
                                                ) : null;
                                            })()}

                                            {/* Progress */}
                                            <div className="mt-2 h-2 w-36 rounded-full bg-gray-200">
                                                <div
                                                    className={`h-2 rounded-full ${battery.estimatedChargeRemaining >= 75
                                                        ? "bg-green-500"
                                                        : battery.estimatedChargeRemaining >= 50
                                                            ? "bg-yellow-500"
                                                            : "bg-red-500"
                                                        }`}
                                                    style={{
                                                        width: `${battery.estimatedChargeRemaining}%`
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        <div className="p-2 rounded-lg bg-gray-50">
                                            {battery.estimatedChargeRemaining >= 75 ? (
                                                <BatteryFull className="h-6 w-6 text-green-500" />
                                            ) : battery.estimatedChargeRemaining >= 50 ? (
                                                <BatteryMedium className="h-6 w-6 text-yellow-500" />
                                            ) : (
                                                <BatteryLow className="h-6 w-6 text-red-500" />
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-sm text-gray-400">
                                        No battery detected
                                    </p>
                                )}
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
                                <div className="p-8">
                                    <h2 className="text-xl font-semibold text-gray-900 mb-8 tracking-wide">
                                        🖥️ System Information
                                    </h2>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {deviceData &&
                                            Object.entries(deviceData.systemDetail)
                                                .filter(
                                                    ([key]) =>
                                                        !key.includes("$") &&
                                                        key !== "systemId" &&
                                                        key !== "domain"
                                                )
                                                .map(([key, value], index) => {
                                                    const style = cardStyles[index % cardStyles.length];

                                                    // ✅ FIX: Resolve icon safely
                                                    const Icon =
                                                        fieldIcons[key.toLowerCase()] || Monitor;

                                                    return (
                                                        <div
                                                            key={key}
                                                            className={`
                                        relative overflow-hidden rounded-xl p-5
                                        bg-gradient-to-br ${style}
                                        border shadow-sm
                                        text-left
                                        transition-all duration-300
                                        hover:shadow-lg hover:-translate-y-1
                                        `}
                                                        >
                                                            {/* Glow Effect */}
                                                            <div className="absolute inset-0 opacity-0 hover:opacity-100 transition">
                                                                <div className="absolute -top-10 -right-10 w-24 h-24 bg-white/40 rounded-full blur-2xl" />
                                                            </div>

                                                            <div className="relative flex items-start gap-4">
                                                                <div className="p-2 bg-white/70 rounded-lg shadow-sm">
                                                                    <Icon className="w-5 h-5" />
                                                                </div>

                                                                <div>
                                                                    <p className="text-xs font-semibold uppercase tracking-wider opacity-70">
                                                                        {key.replace(/_/g, " ")}
                                                                    </p>
                                                                    <p className="mt-1 text-base font-bold break-all">
                                                                        {value}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                    </div>
                                </div>
                            </CustomCard>


                        )}

                        {/* Display other details based on active tab */}

                        {activeTab === "storage" && (
                            <CustomCard>
                                <div className="p-8">
                                    <h2 className="text-xl font-semibold text-gray-900 mb-8 tracking-wide">
                                        💾 Storage Details
                                    </h2>

                                    <div className="space-y-6">
                                        {deviceData?.otherDetails?.map((disk, index) => {
                                            const usedPercent = getUsagePercent(
                                                disk.capacity,
                                                disk.freeSpace
                                            );
                                            const barColor = getUsageColor(usedPercent);

                                            return (
                                                <div
                                                    key={index}
                                                    className="relative rounded-xl p-5
                                                bg-gradient-to-br from-gray-50 to-white
                                                border border-gray-200
                                                shadow-sm transition-all duration-300
                                                hover:shadow-lg hover:-translate-y-1"
                                                >
                                                    {/* Header */}
                                                    <div className="flex items-center justify-between mb-5">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-white rounded-lg shadow">
                                                                {disk.typeOfDrive === "Network" ? (
                                                                    <Network className="h-5 w-5 text-blue-500" />
                                                                ) : (
                                                                    <HardDrive className="h-5 w-5 text-gray-700" />
                                                                )}
                                                            </div>

                                                            <div>
                                                                <h3 className="font-semibold text-gray-900">
                                                                    {disk.diskName}
                                                                </h3>
                                                                <p className="text-xs text-gray-500">
                                                                    {disk.typeOfDrive} Drive
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-3">
                                                            {getEncryptionIcon(disk)}
                                                            <div className="text-right">
                                                                <p className="font-semibold text-gray-900">
                                                                    {disk.freeSpace} GB free
                                                                </p>
                                                                <p className="text-sm text-gray-500">
                                                                    of {disk.capacity} GB
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Progress Bar */}
                                                    <div className="relative">
                                                        <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                                                            <div
                                                                className={`${barColor} h-full rounded-full transition-all duration-700`}
                                                                style={{ width: `${usedPercent}%` }}
                                                            />
                                                        </div>

                                                        <div className="mt-2 flex justify-between text-xs text-gray-500">
                                                            <span>{usedPercent}% used</span>
                                                            <span>{100 - usedPercent}% free</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </CustomCard>
                        )}


                        {activeTab === "network" && (
                            <CustomCard>
                                <div className="p-8 space-y-8">

                                    {/* ================= HEADER ================= */}
                                    <h2 className="text-xl font-semibold text-gray-900 tracking-wide">
                                        🌐 Network Overview
                                    </h2>

                                    {/* ================= SWITCH INFO ================= */}
                                    {deviceData?.connectedSwitchName && (
                                        <div className="rounded-xl p-5 bg-green-50 border border-green-200 shadow-sm">
                                            <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">
                                                Switch Connection
                                            </h3>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">

                                                <div>
                                                    <p className="text-gray-500">Switch Name</p>
                                                    <p className="font-medium text-gray-900">
                                                        {deviceData.connectedSwitchName}
                                                    </p>
                                                </div>

                                                <div
                                                    className="cursor-pointer hover:underline"
                                                    onClick={() =>
                                                        navigator.clipboard.writeText(
                                                            deviceData.connectedSwitchIp || ""
                                                        )
                                                    }
                                                >
                                                    <p className="text-gray-500">Switch IP</p>
                                                    <p className="font-medium text-gray-900">
                                                        {deviceData.connectedSwitchIp}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="text-gray-500">Port</p>
                                                    <p className="font-medium text-gray-900">
                                                        {deviceData.connectedPort}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="text-gray-500">Protocol</p>
                                                    <p className="font-medium text-gray-900">
                                                        {deviceData.connectionProtocol || "N/A"}
                                                    </p>
                                                </div>

                                                <div className="col-span-2 text-xs text-gray-400">
                                                    Last Seen:{" "}
                                                    {deviceData.portLastSeen
                                                        ? new Date(
                                                            deviceData.portLastSeen
                                                        ).toLocaleString()
                                                        : "N/A"}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* ================= NETWORK INTERFACES ================= */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {deviceData?.networkDetails?.map((network: any, index: number) => {
                                            const Connected = isConnected(network.networkType);
                                            const Icon = getNetworkIcon(network.networkType);

                                            return (
                                                <div
                                                    key={index}
                                                    className="rounded-xl p-6 bg-gradient-to-br from-blue-50 to-white border border-blue-200 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
                                                >
                                                    {/* HEADER */}
                                                    <div className="flex items-center gap-3 mb-5">
                                                        <div className="p-2 bg-white rounded-lg shadow">
                                                            <Icon className="h-5 w-5 text-blue-600" />
                                                        </div>

                                                        <div>
                                                            <p className="text-sm font-semibold text-gray-900">
                                                                {network.interfaceName}
                                                            </p>
                                                            <p className="text-xs text-gray-500">
                                                                {network.networkType}
                                                            </p>
                                                        </div>

                                                        {/* STATUS */}
                                                        <span
                                                            className={`ml-auto w-2.5 h-2.5 rounded-full ${Connected
                                                                ? "bg-green-500"
                                                                : "bg-red-500"
                                                                }`}
                                                        />
                                                    </div>

                                                    {/* DETAILS */}
                                                    <div className="space-y-4 text-sm">

                                                        {/* IP */}
                                                        <div>
                                                            <p className="text-xs uppercase text-gray-500">
                                                                IP Address
                                                            </p>
                                                            <p
                                                                className="font-semibold text-gray-900 cursor-pointer hover:underline"
                                                                onClick={() =>
                                                                    navigator.clipboard.writeText(
                                                                        network.ipAddress
                                                                    )
                                                                }
                                                            >
                                                                {network.ipAddress}
                                                            </p>
                                                        </div>

                                                        {/* MAC */}
                                                        <div>
                                                            <p className="text-xs uppercase text-gray-500">
                                                                MAC Address
                                                            </p>
                                                            <p
                                                                className="font-semibold text-gray-900 cursor-pointer hover:underline"
                                                                onClick={() =>
                                                                    navigator.clipboard.writeText(
                                                                        network.macAddress
                                                                    )
                                                                }
                                                            >
                                                                {network.macAddress}
                                                            </p>
                                                        </div>

                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </CustomCard>
                        )}

                        {/* Security tab - Display security settings in rows */}
                        {activeTab === "security" && (
                            <CustomCard>
                                <div className="p-8">
                                    <h2 className="text-xl font-semibold text-gray-900 mb-8 tracking-wide">
                                        🛡️ Security Information
                                    </h2>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {deviceData?.otherDetails?.map((security, index) => {
                                            const upToDate = isUpdatedToday(security.lastUpdate);
                                            const style = cardStyles[index % cardStyles.length];

                                            return (
                                                <div
                                                    key={index}
                                                    className={`
                                        relative rounded-lg p-6
                                        bg-gradient-to-br ${style}
                                        border shadow-sm
                                        transition-shadow duration-200
                                        hover:shadow-md
                                        text-center
                                    `}
                                                >
                                                    {/* Status dot */}
                                                    <span
                                                        className={`
                                        absolute top-4 right-4 w-2.5 h-2.5 rounded-full
                                        ${upToDate ? "bg-green-500" : "bg-amber-500"}
                                        `}
                                                    />

                                                    <div className="space-y-6 text-sm flex flex-col items-center">
                                                        {/* Security Name */}
                                                        <div className="flex flex-col items-center gap-2">
                                                            <Shield className="h-4 w-4 opacity-60" />
                                                            <p className="text-lg uppercase opacity-70">
                                                                Security Product
                                                            </p>
                                                            <p className="font-medium text-xl">
                                                                {security.displayName || "—"}
                                                            </p>
                                                        </div>

                                                        {/* Status */}
                                                        <div className="flex flex-col items-center gap-2">
                                                            <CheckCircle className="h-4 w-4 opacity-60" />
                                                            <p className="text-lg uppercase opacity-70">
                                                                Status
                                                            </p>
                                                            <p className="font-medium text-xl">
                                                                {upToDate ? "Up to date" : "Update required"}
                                                            </p>
                                                        </div>

                                                        {/* Product State */}
                                                        <div className="flex flex-col items-center gap-2">
                                                            <Package className="h-4 w-4 opacity-60" />
                                                            <p className="text-lg uppercase opacity-70">
                                                                Product State
                                                            </p>
                                                            <p className="font-mono text-xl">
                                                                {security.productState || "—"}
                                                            </p>
                                                        </div>

                                                        {/* Last Update */}
                                                        <div className="flex flex-col items-center gap-2">
                                                            <Clock className="h-4 w-4 opacity-60 " />
                                                            <p className="text-lg uppercase opacity-70">
                                                                Last Update
                                                            </p>
                                                            <p className="font-medium text-xl">
                                                                {security.lastUpdate || "—"}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </CustomCard>
                        )}

                        {/* Users tab - Display user details in rows */}
                        {activeTab === "users" && (
                            <CustomCard>
                                <div className="p-8">

                                    <h2 className="text-xl font-semibold text-gray-900 mb-8 tracking-wide">
                                        👤 User Information
                                    </h2>




                                    <div className="relative overflow-x-auto rounded-lg border border-gray-200 bg-white">
                                        <table className="min-w-full text-sm">
                                            {/* Header */}
                                            <thead className="sticky top-0 z-10 bg-gray-50 border-b">
                                                <tr>
                                                    <th className="px-6 py-3 text-center font-semibold text-gray-600">

                                                        User
                                                    </th>
                                                    <th className="px-6 py-3 text-center font-semibold text-gray-600">

                                                        Lock Status
                                                    </th>
                                                    <th className="px-6 py-3 text-center font-semibold text-gray-600">

                                                        Account Status
                                                    </th>
                                                    <th className="px-6 py-3 text-center font-semibold text-gray-600">

                                                        Account Type
                                                    </th>
                                                </tr>
                                            </thead>

                                            {/* Body */}
                                            <tbody className="divide-y">
                                                {deviceData?.otherDetails?.length ? (
                                                    deviceData.otherDetails.map((user, index) => (
                                                        <tr
                                                            key={index}
                                                            className={`
                                            transition-colors
                                            ${index % 2 === 0 ? "bg-white" : "bg-gray-50/50"}
                                            hover:bg-blue-50/40
                                        `}
                                                        >
                                                            {/* User */}
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="h-9 w-9 flex items-center justify-center rounded-full bg-gray-100 border">
                                                                        <User className="h-4 w-4 text-gray-600" />
                                                                    </div>
                                                                    <div>
                                                                        <p className="font-medium text-left text-gray-900">
                                                                            {user.userName}
                                                                        </p>
                                                                        <p className="text-xs text-left text-gray-500">
                                                                            Local account
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </td>

                                                            {/* Lock Status */}
                                                            <td className="px-6 py-4">
                                                                <span
                                                                    className={`
                                                inline-flex items-center gap-1.5 px-2.5 py-1
                                                rounded-md text-xs font-medium
                                                ${user.isLocked
                                                                            ? "bg-red-50 text-red-700 border border-red-200"
                                                                            : "bg-green-50 text-green-700 border border-green-200"
                                                                        }
                                            `}
                                                                >
                                                                    {user.isLocked ? (
                                                                        <Lock className="h-3.5 w-3.5" />
                                                                    ) : (
                                                                        <Unlock className="h-3.5 w-3.5" />
                                                                    )}
                                                                    {user.isLocked ? "Locked" : "Unlocked"}
                                                                </span>
                                                            </td>

                                                            {/* Enabled Status */}
                                                            <td className="px-6 py-4">
                                                                <span
                                                                    className={`
                                                inline-flex items-center gap-1.5 px-2.5 py-1
                                                rounded-md text-xs font-medium
                                                ${user.isEnabled
                                                                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                                                                            : "bg-gray-100 text-gray-600 border border-gray-200"
                                                                        }
                                            `}
                                                                >
                                                                    {user.isEnabled ? (
                                                                        <CheckCircle className="h-3.5 w-3.5" />
                                                                    ) : (
                                                                        <XCircle className="h-3.5 w-3.5" />
                                                                    )}
                                                                    {user.isEnabled ? "Enabled" : "Disabled"}
                                                                </span>
                                                            </td>

                                                            {/* Account Type */}
                                                            <td className="px-6 py-4 text-left text-gray-900">
                                                                {user.description || "—"}
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td
                                                            colSpan={4}
                                                            className="px-6 py-10 text-center text-gray-500"
                                                        >
                                                            No users found
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </CustomCard>
                        )}



                        {/* Software tab - Display software details in rows */}

                        {activeTab === "software" && (
                            <CustomCard>
                                <div className="p-8">
                                    {/* Header */}

                                    <h2 className="text-xl font-semibold text-gray-900 mb-8 tracking-wide">
                                        📦 Software Packages
                                    </h2>



                                    {/* Search */}
                                    <div className="relative mb-4">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Search software by name or version…"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="
                                    w-full pl-9 pr-3 py-2 text-sm
                                    border border-gray-300 rounded-md
                                    focus:outline-none focus:ring-1 focus:ring-blue-500
                                "
                                        />
                                    </div>

                                    {/* Table */}
                                    <div className="relative overflow-y-auto max-h-[420px] rounded-lg border border-gray-200 bg-white">
                                        <table className="min-w-full text-sm">
                                            {/* Header */}
                                            <thead className="sticky top-0 z-10 bg-gray-50 border-b">
                                                <tr>
                                                    <th className="px-6 py-3 text-center font-semibold text-gray-600">
                                                        Software Name
                                                    </th>
                                                    <th className="px-6 py-3 text-center font-semibold text-gray-600">
                                                        Version
                                                    </th>
                                                    <th className="px-6 py-3 text-center font-semibold text-gray-600">
                                                        {(isAdmin && "Action")}
                                                    </th>
                                                </tr>
                                            </thead>

                                            {/* Body */}
                                            <tbody className="divide-y">
                                                {filteredSoftware.length ? (
                                                    filteredSoftware.map((software, index) => (
                                                        <tr
                                                            key={index}
                                                            className={`
                                            transition-colors
                                            ${index % 2 === 0 ? "bg-white" : "bg-gray-50/40"}
                                            hover:bg-blue-50/30
                                        `}
                                                        >
                                                            {/* Name */}
                                                            <td className="text-left px-6  py-4 text-gray-900">
                                                                {software.softwareName}
                                                            </td>

                                                            {/* Version */}
                                                            <td className="px-6 py-4 text-gray-700">
                                                                {software.version || "—"}
                                                            </td>

                                                            {/* Action */}
                                                            <td className="px-6 py-4 text-center">
                                                                
                                                                {(software.uninstallString !== "Unknown" ||
                                                                    software.uninstallString == null) &&
                                                                    software.softwareDetailsID !== undefined &&
                                                                    !hiddenButtons[software.softwareDetailsID] &&
                                                                    isAdmin &&  // ← add this line
                                                                    (
                                                                        <button
                                                                            onClick={() => handleUninstall(software)}
                                                                            className="
                inline-flex items-center gap-1.5
                px-3 py-1.5 text-xs font-medium
                rounded-md border border-red-200
                text-red-700 bg-red-50
                hover:bg-red-100
                transition-colors
            "
                                                                        >
                                                                            <Trash2 className="h-3.5 w-3.5" />
                                                                            Uninstall
                                                                        </button>
                                                                    )}
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td
                                                            colSpan={3}
                                                            className="px-6 py-10 text-center text-gray-500"
                                                        >
                                                            No software found
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </CustomCard>
                        )}


                        {activeTab === "monitor" && (
                            <CustomCard>
                                <div className="p-8">
                                    <h2 className="text-xl font-semibold text-gray-900 mb-8 tracking-wide">
                                        🖥️ Monitor Details
                                    </h2>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {deviceData?.otherDetails?.map((monitor, index) => {
                                            const style = cardStyles[index % cardStyles.length];

                                            return (
                                                <div
                                                    key={index}
                                                    className={`
                                        relative rounded-lg p-6
                                        bg-gradient-to-br ${style}
                                        border shadow-sm
                                        transition-shadow duration-200
                                        hover:shadow-md
                                        text-center
                                    `}
                                                >
                                                    <div className="space-y-6 text-sm flex flex-col items-center">
                                                        {/* Manufacturer */}
                                                        <div className="flex flex-col items-center gap-2">
                                                            <Factory className="h-4 w-4 opacity-60" />
                                                            <p className="text-lg uppercase opacity-70">
                                                                Manufacturer
                                                            </p>
                                                            <p className="font-medium text-xl">
                                                                {monitor.manufacturer || "—"}
                                                            </p>
                                                        </div>

                                                        {/* Serial */}
                                                        <div className="flex flex-col items-center gap-2">
                                                            <Hash className="h-4 w-4 opacity-60" />
                                                            <p className="text-lg uppercase opacity-70">
                                                                Serial Number
                                                            </p>
                                                            <p className="font-medium text-xl">
                                                                {monitor.serialNo || "—"}
                                                            </p>
                                                        </div>

                                                        {/* Display */}
                                                        <div className="flex flex-col items-center gap-2">
                                                            <Tag className="h-4 w-4 opacity-60" />
                                                            <p className="text-lg uppercase opacity-70">
                                                                Display Name
                                                            </p>
                                                            <p className="font-medium text-xl">
                                                                {monitor.displayName || "—"}
                                                            </p>
                                                        </div>

                                                        {/* Year */}
                                                        <div className="flex flex-col items-center gap-2">
                                                            <Calendar className="h-4 w-4 opacity-60" />
                                                            <p className="text-lg uppercase opacity-70">
                                                                Manufacturing Year
                                                            </p>
                                                            <p className="font-medium text-xl">
                                                                {monitor.yearOfManufacture || "—"}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </CustomCard>
                        )}


                        {activeTab === "bitlocker" && (
                            <CustomCard>
                                <div className="p-8">
                                    <h2 className="text-xl font-semibold text-gray-900 mb-8 tracking-wide">
                                        🔑 BitLocker Recovery Keys
                                    </h2>
                                    <div className="flex items-center mb-6">
                                        <input
                                            type="checkbox"
                                            id="showArchived"
                                            checked={showArchived}
                                            onChange={(e) => setShowArchived(e.target.checked)}
                                            className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                                        />
                                        <label
                                            htmlFor="showArchived"
                                            className="ml-2 text-sm text-gray-700 select-none"
                                        >
                                            Show archived BitLocker keys
                                        </label>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {deviceData?.otherDetails
                                            ?.filter(key => showArchived || !key.archived)
                                            .map((key, index) => (
                                                <div
                                                    key={index}
                                                    className={`
                border rounded-lg p-6 transition-shadow
                ${key.archived
                                                            ? "bg-gray-100 border-gray-300 opacity-75"
                                                            : "bg-white border-gray-200 hover:shadow-sm"}
            `}
                                                >

                                                    <div className="space-y-5 text-sm">
                                                        {/* Identifier */}
                                                        <div>
                                                            <p className="text-xs uppercase text-gray-500 mb-1">
                                                                Identifier
                                                            </p>
                                                            <p className="font-medium text-gray-900">
                                                                {key.identifier}
                                                            </p>
                                                        </div>

                                                        {/* Recovery Key */}
                                                        <div>
                                                            <p className="text-xs uppercase text-gray-500 mb-1">
                                                                Recovery Key
                                                            </p>

                                                            <div className="relative">
                                                                <code className="
                                            block w-full text-xs font-mono
                                            bg-gray-50 border border-gray-200
                                            rounded-md p-3 break-all text-gray-900
                                        ">
                                                                    {key.recoveryKey}
                                                                </code>

                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        copyToClipboard(key.recoveryKey);
                                                                        setCopiedKey(key.identifier); // 👈 track THIS key
                                                                        setTimeout(() => setCopiedKey(null), 1500);
                                                                    }}
                                                                    className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
                                                                    title="Copy recovery key"
                                                                >
                                                                    {copiedKey === key.identifier ? (
                                                                        <span className="text-xs text-green-600 font-medium">
                                                                            Copied
                                                                        </span>
                                                                    ) : (
                                                                        <Copy className="h-4 w-4" />
                                                                    )}
                                                                </button>



                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            </CustomCard>
                        )}

                        {activeTab === "logs" && (
                            <CustomCard>
                                <div className="p-8">

                                    <h2 className="text-xl font-semibold text-gray-900 mb-8 tracking-wide">
                                        📜 System Event Logs
                                    </h2>


                                    {/* Date Range Filter */}
                                    <div className="mb-6 flex flex-wrap gap-4 items-end">
                                        <div className="flex-1 min-w-[200px]">
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                From Date
                                            </label>
                                            <input
                                                type="datetime-local"
                                                value={fromDate}
                                                onChange={(e) => setFromDate(e.target.value)}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                            />
                                        </div>
                                        <div className="flex-1 min-w-[200px]">
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                To Date
                                            </label>
                                            <input
                                                type="datetime-local"
                                                value={toDate}
                                                onChange={(e) => setToDate(e.target.value)}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                            />
                                        </div>
                                        <button
                                            onClick={fetchLogs}
                                            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                                        >
                                            🔍 Filter Logs
                                        </button>
                                        <button
                                            onClick={() => {
                                                setFromDate("");
                                                setToDate("");
                                                fetchLogs();
                                            }}
                                            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                                        >
                                            🔄 Reset
                                        </button>
                                    </div>
                                    {/* Working Time Summary */}
                                    {Object.keys(workingTime).length > 0 && (
                                        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {Object.entries(workingTime).map(([date, time]) => (
                                                <div
                                                    key={date}
                                                    className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4 shadow-sm"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <p className="text-xs uppercase text-gray-600 font-semibold mb-1">
                                                                {date}
                                                            </p>
                                                            <p className="text-2xl font-bold text-purple-700">
                                                                {formatWorkingTime(time)}
                                                            </p>
                                                            <p className="text-xs text-gray-500 mt-1">
                                                                Active Time
                                                            </p>
                                                        </div>
                                                        <div className="p-3 bg-white rounded-full shadow-sm">
                                                            <Clock className="h-6 w-6 text-purple-600" />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {logsLoading ? (
                                        <div className="flex items-center justify-center py-12">
                                            <div className="text-center">
                                                <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
                                                <p className="text-gray-500">Loading logs...</p>
                                            </div>
                                        </div>
                                    ) : logs.length === 0 ? (
                                        <div className="text-center py-12">
                                            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                                                <span className="text-3xl">📭</span>
                                            </div>
                                            <p className="text-gray-500 text-lg">No logs found</p>
                                            <p className="text-gray-400 text-sm mt-1">System events will appear here</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                                            <table className="min-w-full text-sm">
                                                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                                                    <tr>
                                                        <th className="px-6 py-4 text-left font-semibold text-gray-700">
                                                            <div className="flex items-center gap-2">
                                                                <span>🕐</span>
                                                                <span>Time</span>
                                                            </div>
                                                        </th>
                                                        <th className="px-6 py-4 text-left font-semibold text-gray-700">
                                                            <div className="flex items-center gap-2">
                                                                <span>⚡</span>
                                                                <span>Event</span>
                                                            </div>
                                                        </th>
                                                        <th className="px-6 py-4 text-left font-semibold text-gray-700">
                                                            <div className="flex items-center gap-2">
                                                                <span>👤</span>
                                                                <span>User</span>
                                                            </div>
                                                        </th>
                                                        <th className="px-6 py-4 text-left font-semibold text-gray-700">
                                                            <div className="flex items-center gap-2">
                                                                <span>📍</span>
                                                                <span>Source</span>
                                                            </div>
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200 bg-white">
                                                    {logs.map((log) => (
                                                        <tr key={log.id} className="hover:bg-purple-50 transition-colors duration-150">
                                                            <td className="px-6 py-4 text-gray-600 text-left">
                                                                <div className="flex flex-col">
                                                                    <span className="font-medium">
                                                                        {new Date(log.eventTime).toLocaleDateString()}
                                                                    </span>
                                                                    <span className="text-xs text-gray-400">
                                                                        {new Date(log.eventTime).toLocaleTimeString()}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-left">
                                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getEventColor(log.eventType)}`}>
                                                                    {log.eventType}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-left">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-xs font-semibold">
                                                                        {(log.username || "SYS").charAt(0).toUpperCase()}
                                                                    </div>
                                                                    <span className="font-medium text-gray-900">
                                                                        {log.username || "SYSTEM"}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-gray-600 text-left">
                                                                <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                                                                    {log.source || "-"}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
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
