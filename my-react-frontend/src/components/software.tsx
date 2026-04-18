import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Search,
    ChevronRight,
    AlertCircle,
    Loader,
    Package,
    ShieldAlert,
    ShieldCheck,
} from "lucide-react";
import Navbar from "./Navbar";
import useAuth from "./useAuth";
import { APP_CONSTANTS } from "../store";

/* ================= TYPES ================= */

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
    hostname: string | null;
    username: string | null;
    softwareName: string;
    version: string;
    publisher: string;
}

interface GroupedSoftware {
    key: string;
    softwareName: string;
    version: string;
    publisher: string;
    installations: { hostname: string | null; username: string | null }[];
}

interface GroupedInstallation {
    hostname: string;
    username: string;
    count: number;
}

interface Vulnerability {
    cveId: string;
    description: string | null;
    severity: string | null;
    score: number | null;
    published: string | null;
}

/* ================= SEVERITY CONFIG ================= */

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

interface SeverityStyle {
    label: string;
    bg: string;
    text: string;
    border: string;
    dot: string;
    order: number;
}

const SEVERITY_CONFIG: Record<Severity, SeverityStyle> = {
    CRITICAL: { label: "Critical", bg: "bg-red-50", text: "text-red-700", border: "border-red-200", dot: "bg-red-500", order: 0 },
    HIGH: { label: "High", bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", dot: "bg-orange-500", order: 1 },
    MEDIUM: { label: "Medium", bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200", dot: "bg-yellow-500", order: 2 },
    LOW: { label: "Low", bg: "bg-green-50", text: "text-green-700", border: "border-green-200", dot: "bg-green-500", order: 3 },
    UNKNOWN: { label: "Unknown", bg: "bg-gray-50", text: "text-gray-500", border: "border-gray-200", dot: "bg-gray-400", order: 4 },
};

const getSeverityConfig = (severity: string | null | undefined): SeverityStyle => {
    const key = severity?.trim().toUpperCase() ?? "";
    return SEVERITY_CONFIG[key as Severity] ?? SEVERITY_CONFIG.UNKNOWN;
};

/* ================= COMPONENT ================= */

const SoftwareDashboard = () => {
    const [softwareData, setSoftwareData] = useState<FlattenedSoftware[]>([]);
    const [searchTerm, setSearchTerm] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get("name") || "";
    });
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [vulns, setVulns] = useState<Vulnerability[]>([]);
    const [vulnLoading, setVulnLoading] = useState(false);
    const [expandedSeverity, setExpandedSeverity] = useState<string | null>(null);

    const rightPanelRef = useRef<HTMLDivElement | null>(null);

    /* ================= EFFECT: UPDATE URL ON SELECTION ================= */

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const name = params.get("name") || "";
        setSearchTerm(name);
    }, [window.location.search]);

    /* ================= FETCH SOFTWARE ================= */

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const res = await fetch(`${APP_CONSTANTS.API_BASE_URL}/api/devices/software`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();

                // ✅ Handle all possible response shapes
                const devices: Device[] = Array.isArray(data)
                    ? data
                    : Array.isArray(data.$values)
                        ? data.$values
                        : [];

                const flattened: FlattenedSoftware[] = devices.flatMap((device: Device) => {
                    // ✅ Handle softwareDetails being array or $values wrapped
                    const softwares: SoftwareDetails[] = Array.isArray(device.softwareDetails)
                        ? device.softwareDetails
                        : Array.isArray(device.softwareDetails?.$values)
                            ? device.softwareDetails.$values
                            : [];

                    return softwares.map((s: SoftwareDetails) => ({
                        hostname: device.hostname ?? null,
                        username: device.username ?? null,
                        softwareName: s.softwareName,
                        version: s.version,
                        publisher: s.publisher,
                    }));
                });

                setSoftwareData(flattened);
            } catch (e: any) {
                setError(e.message || "Failed to load software data");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    /* ================= GROUPING ================= */

    const groupedSoftware = useMemo(() => {
        const map = new Map<string, GroupedSoftware>();

        softwareData.forEach((s) => {
            if (
                searchTerm &&
                !s.softwareName.toLowerCase().includes(searchTerm.toLowerCase()) &&
                !(s.hostname ?? "").toLowerCase().includes(searchTerm.toLowerCase())
            )
                return;

            const key = `${s.softwareName}__${s.version}__${s.publisher}`;

            if (!map.has(key)) {
                map.set(key, {
                    key,
                    softwareName: s.softwareName,
                    version: s.version,
                    publisher: s.publisher,
                    installations: [],
                });
            }

            map.get(key)!.installations.push({
                hostname: s.hostname,
                username: s.username,
            });
        });

        return Array.from(map.values()).sort(
            (a, b) => b.installations.length - a.installations.length
        );
    }, [softwareData, searchTerm]);

    const selectedSoftware = groupedSoftware.find((s) => s.key === selectedKey);

    const groupedInstallations = useMemo((): GroupedInstallation[] => {
        if (!selectedSoftware) return [];

        const map = new Map<string, GroupedInstallation>();

        selectedSoftware.installations.forEach((inst) => {
            const h = inst.hostname ?? "Unknown";
            const u = inst.username ?? "Unknown";
            const key = `${h}__${u}`;

            if (!map.has(key))
                map.set(key, { hostname: h, username: u, count: 0 });

            map.get(key)!.count += 1;
        });

        return Array.from(map.values());
    }, [selectedSoftware]);

    const vulnsBySeverity = useMemo(() => {
        const map = new Map<string, Vulnerability[]>();

        vulns.forEach((v) => {
            const sev = v.severity?.toUpperCase() ?? "UNKNOWN";
            if (!map.has(sev)) map.set(sev, []);
            map.get(sev)!.push(v);
        });

        return Array.from(map.entries()).sort(
            ([a], [b]) =>
                (SEVERITY_CONFIG[a as Severity]?.order ?? 99) -
                (SEVERITY_CONFIG[b as Severity]?.order ?? 99)
        );
    }, [vulns]);

    /* ================= FETCH VULNERABILITIES ================= */

    useEffect(() => {
        if (!selectedKey) {
            setVulns([]);
            return;
        }

        const software = groupedSoftware.find((s) => s.key === selectedKey);
        if (!software) return;

        const fetchVulns = async () => {
            try {
                setVulnLoading(true);
                setVulns([]);

                const params = new URLSearchParams({
                    name: software.softwareName,
                    version: software.version ?? "",
                    publisher: software.publisher ?? "",
                });

                const res = await fetch(
                    `${APP_CONSTANTS.API_BASE_URL}/api/vulnerability-scan/by-software?${params}`
                );

                if (!res.ok) throw new Error(`HTTP ${res.status}`);

                const data = await res.json();

                const list: Vulnerability[] = Array.isArray(data)
                    ? data
                    : (data.$values ?? []);

                setVulns(list);

                const severities: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"];
                const firstWithData = severities.find((sev) =>
                    list.some((v) => (v.severity?.toUpperCase() ?? "UNKNOWN") === sev)
                );
                setExpandedSeverity(firstWithData ?? null);
            } catch (e) {
                console.error("Vuln fetch failed:", e);
                setVulns([]);
            } finally {
                setVulnLoading(false);
            }
        };

        fetchVulns();
    }, [selectedKey, groupedSoftware]);

    /* ================= AUTO SCROLL ================= */

    useEffect(() => {
        rightPanelRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }, [selectedKey]);

    /* ================= LOADING ================= */

    if (loading)
        return (
            <>
                <Navbar />
                <div className="h-screen flex items-center justify-center text-gray-600">
                    <Loader className="h-6 w-6 animate-spin mr-2" />
                    Loading software inventory…
                </div>
            </>
        );

    /* ================= ERROR ================= */

    if (error)
        return (
            <>
                <Navbar />
                <div className="p-8 max-w-6xl mx-auto">
                    <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                        <AlertCircle className="h-4 w-4" />
                        {error}
                    </div>
                </div>
            </>
        );

    /* ================= UI ================= */

    return (
        <>
            <Navbar />
            <div className="min-h-screen bg-gray-50 p-8">
                <div className="max-w-7xl mx-auto space-y-6">

                    {/* Header */}
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Software Inventory</h1>
                        <p className="text-gray-600 mt-1">
                            Installed software across all managed devices
                        </p>
                    </div>

                    {/* Search */}
                    <div className="relative max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search software or hostname"
                            className="pl-9 pr-3 py-2 w-full border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
                        />
                    </div>

                    {/* ── MAIN GRID ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[calc(100vh-260px)]">

                        {/* ── COL 1: Software List ── */}
                        <div className="lg:col-span-1 space-y-3 overflow-y-auto pr-1">
                            {groupedSoftware.length === 0 && (
                                <p className="text-sm text-gray-400 text-center pt-8">No software found</p>
                            )}
                            {groupedSoftware.map((s) => {
                                const active = s.key === selectedKey;
                                return (
                                    <button
                                        key={s.key}
                                        onClick={() => setSelectedKey(s.key)}
                                        className={`w-full text-left rounded-xl p-4 border transition-all ${active
                                            ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg border-transparent"
                                            : "bg-white hover:bg-gray-50 border-gray-200"
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="min-w-0 flex-1">
                                                <h3 className="font-semibold text-sm truncate">{s.softwareName}</h3>
                                                <p className={`mt-1 text-xs truncate ${active ? "text-blue-100" : "text-gray-500"}`}>
                                                    {s.version || "—"} • {s.publisher || "Unknown"}
                                                </p>
                                            </div>
                                            <ChevronRight className={`h-4 w-4 shrink-0 ml-2 ${active ? "text-white" : "text-gray-400"}`} />
                                        </div>
                                        <div className="mt-3">
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${active ? "bg-white/20 text-white" : "bg-blue-50 text-blue-700"
                                                }`}>
                                                {s.installations.length} installs
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* ── COL 2 + 3: Detail panels OR empty state ── */}
                        {selectedSoftware ? (
                            <div
                                ref={rightPanelRef}
                                className="lg:col-span-3 grid grid-cols-1 xl:grid-cols-2 gap-4 overflow-y-auto"
                            >
                                {/* ── Installations Panel ── */}
                                <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
                                    <div className="px-5 py-4 border-b shrink-0">
                                        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                                            <Package className="h-4 w-4 text-blue-500" />
                                            Installations
                                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                                                {groupedInstallations.length}
                                            </span>
                                        </h2>
                                        <p className="text-xs text-gray-500 mt-1 truncate">
                                            {selectedSoftware.softwareName} · {selectedSoftware.version || "—"}
                                        </p>
                                    </div>

                                    <div className="overflow-y-auto flex-1">
                                        <table className="min-w-full text-sm">
                                            <thead className="bg-gray-50 border-b sticky top-0 z-10">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                                        Hostname
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                                        Username
                                                    </th>
                                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                                        #
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {groupedInstallations.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                                                        <td className="px-4 py-3">

                                                            <a href={`/device/${row.hostname}`}
                                                                className="text-blue-600 font-medium hover:underline text-xs"
                                                            >
                                                                {row.hostname}
                                                            </a>
                                                        </td>
                                                        <td className="px-4 py-3 text-xs text-gray-600">
                                                            {row.username}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                                                                {row.count}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                {/* ── END Installations Panel ── */}

                                {/* ── Vulnerabilities Panel ── */}
                                <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
                                    <div className="px-5 py-4 border-b shrink-0">
                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                                                <ShieldAlert className="h-4 w-4 text-red-500" />
                                                Vulnerabilities
                                                {!vulnLoading && vulns.length > 0 && (
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                                                        {vulns.length} CVEs
                                                    </span>
                                                )}
                                            </h2>
                                            {!vulnLoading && vulns.length > 0 && (
                                                <div className="flex gap-1 flex-wrap">
                                                    {vulnsBySeverity.map(([sev, items]) => {
                                                        const cfg = getSeverityConfig(sev);
                                                        return (
                                                            <span
                                                                key={sev}
                                                                className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}
                                                            >
                                                                {items.length} {cfg.label}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="overflow-y-auto flex-1 p-3 space-y-2">
                                        {/* Loading */}
                                        {vulnLoading && (
                                            <div className="flex flex-col items-center justify-center h-full py-10 gap-3 text-gray-400">
                                                <Loader className="h-6 w-6 animate-spin text-blue-500" />
                                                <p className="text-sm">Scanning for vulnerabilities…</p>
                                            </div>
                                        )}

                                        {/* No vulns */}
                                        {!vulnLoading && vulns.length === 0 && (
                                            <div className="flex flex-col items-center justify-center h-full py-10 gap-2">
                                                <ShieldCheck className="h-10 w-10 text-green-400" />
                                                <p className="text-sm font-semibold text-green-600">
                                                    No known vulnerabilities
                                                </p>
                                                <p className="text-xs text-gray-400">This software looks clean</p>
                                            </div>
                                        )}

                                        {/* Accordion by severity */}
                                        {!vulnLoading && vulnsBySeverity.map(([sev, items]) => {
                                            const cfg = getSeverityConfig(sev);
                                            const isOpen = expandedSeverity === sev;

                                            return (
                                                <div
                                                    key={sev}
                                                    className={`rounded-lg border ${cfg.border} overflow-hidden`}
                                                >
                                                    <button
                                                        onClick={() => setExpandedSeverity(isOpen ? null : sev)}
                                                        className={`w-full flex items-center justify-between px-4 py-2.5 ${cfg.bg} transition-all`}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                                                            <span className={`text-xs font-bold ${cfg.text}`}>
                                                                {cfg.label}
                                                            </span>
                                                            <span className={`text-xs ${cfg.text} opacity-70`}>
                                                                — {items.length} {items.length === 1 ? "issue" : "issues"}
                                                            </span>
                                                        </div>
                                                        <ChevronRight
                                                            className={`h-4 w-4 ${cfg.text} transition-transform duration-200 ${isOpen ? "rotate-90" : ""
                                                                }`}
                                                        />
                                                    </button>

                                                    {isOpen && (
                                                        <div className="divide-y divide-gray-100">
                                                            {items.map((v) => (
                                                                <div
                                                                    key={v.cveId}
                                                                    className="px-4 py-3 hover:bg-gray-50 transition-colors"
                                                                >
                                                                    <div className="flex items-center gap-2 flex-wrap">

                                                                        <a href={`https://nvd.nist.gov/vuln/detail/${v.cveId}`}
                                                                            target="_blank"
                                                                            rel="noreferrer"
                                                                            className="text-xs font-bold text-blue-600 hover:underline"
                                                                        >
                                                                            {v.cveId}
                                                                        </a>
                                                                        {v.score != null && (
                                                                            <span className={`px-1.5 py-0.5 rounded text-xs font-bold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                                                                                {v.score.toFixed(1)}
                                                                            </span>
                                                                        )}
                                                                        {v.published && (
                                                                            <span className="text-xs text-gray-400 ml-auto">
                                                                                {new Date(v.published).toLocaleDateString()}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {
                                                                        v.description && (
                                                                            <p className="mt-1.5 text-xs text-gray-500 line-clamp-2 leading-relaxed">
                                                                                {v.description}
                                                                            </p>
                                                                        )
                                                                    }
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )
                                                    }
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                {/* ── END Vulnerabilities Panel ── */}

                            </div>
                        ) : (
                            /* ── Empty state ── */
                            <div className="lg:col-span-3 flex items-center justify-center border border-dashed border-gray-300 rounded-xl">
                                <div className="text-center space-y-2">
                                    <Package className="h-10 w-10 mx-auto text-gray-300" />
                                    <p className="text-sm font-medium text-gray-400">
                                        Select a software to view details
                                    </p>
                                    <p className="text-xs text-gray-300">
                                        Installations and vulnerabilities will appear here
                                    </p>
                                </div>
                            </div>
                        )};
                        {/* ── END MAIN GRID ── */}

                    </div >
                </div>
            </div>
        </>
    );
};

export default SoftwareDashboard;