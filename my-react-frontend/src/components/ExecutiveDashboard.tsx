// Place in my-react-frontend/src/components/. Route: /executive
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { APP_CONSTANTS } from "../store";

// --- Types ---
type RawDevice = {
    hostname: string;
    user?: string;
    department?: string;
    status?: string;
    lastSeen: string;
    agent?: string;
    os?: string;
    osVersion?: string;
    make?: string;
    model?: string;
    ram?: number;
    domain?: string;
    startDate?: string;
    endDate?: string;
    edr: "protected" | "outdated" | "off" | "none";
    bitlocker: boolean;
};

type EnrichedDevice = RawDevice & {
    issues: string[];
    warrantyDaysRemaining: number | null;
    ageInYears: number | null;
    ramGb: number | null;
    isStale: boolean;
    osName: string;
    dept: string;
};

type FilterState = {
    label: string;
    test: (device: EnrichedDevice) => boolean;
} | null;

// --- Constants (Modern UI Palette) ---
const COLORS = {
    good: "#10B981",    // Emerald 500
    warn: "#F59E0B",    // Amber 500
    bad: "#EF4444",     // Rose 500
    dark: "#334155",    // Slate 700
    mute: "#E2E8F0",    // Slate 200
    ink: "#0F172A",     // Slate 900
    textMute: "#64748B",// Slate 500
    bg: "#F8FAFC",      // Slate 50
    card: "#FFFFFF",
};

const MS_PER_DAY = 86400000;
const DAYS_IN_YEAR = 365;

// --- Helper Functions ---
function enrichDeviceData(device: RawDevice): EnrichedDevice {
    const now = Date.now();
    const warrantyDaysRemaining = device.endDate ? (new Date(device.endDate).getTime() - now) / MS_PER_DAY : null;
    const ageInYears = device.startDate ? (now - new Date(device.startDate).getTime()) / (DAYS_IN_YEAR * MS_PER_DAY) : null;

    let ramGb = device.ram ?? null;
    if (ramGb && ramGb > 100000) ramGb = ramGb / 1024 ** 3;

    const osName = (device.os || "Unknown").replace("Microsoft ", "");
    const isStale = now - new Date(device.lastSeen).getTime() > 7 * MS_PER_DAY;

    const issues: string[] = [];
    if (device.edr === "none") issues.push("No EDR");
    else if (device.edr === "off") issues.push("EDR off");
    else if (device.edr === "outdated") issues.push("EDR outdated");

    if (!device.bitlocker) issues.push("No BitLocker");
    if (osName.includes("Windows 10")) issues.push("Windows 10");

    if (warrantyDaysRemaining !== null) {
        if (warrantyDaysRemaining < 0) issues.push("Warranty expired");
        else if (warrantyDaysRemaining <= 30) issues.push("Warranty < 1 month");
    }

    if (isStale) issues.push("Not seen 7d+");

    return {
        ...device,
        issues,
        warrantyDaysRemaining,
        ageInYears,
        ramGb,
        isStale,
        osName,
        dept: device.department || "Unassigned",
    };
}

const countWhere = (arr: EnrichedDevice[], condition: (d: EnrichedDevice) => boolean) => arr.filter(condition).length;
const groupBy = (arr: EnrichedDevice[], keyFn: (d: EnrichedDevice) => string) => {
    const map = new Map<string, number>();
    arr.forEach((item) => {
        const key = keyFn(item);
        map.set(key, (map.get(key) || 0) + 1);
    });
    return [...map].sort((a, b) => b[1] - a[1]);
};

const formatDate = (dateString?: string) =>
    dateString ? new Date(dateString).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "—";

// --- Sub-Components ---
const ProgressBar = ({ label, total, parts, onFilter }: {
    label: string; total: number;
    parts: [string, number, string, (d: EnrichedDevice) => boolean][];
    onFilter: (label: string, fn: (d: EnrichedDevice) => boolean) => void;
}) => (
    <div className="row">
        <div className="rowhead">
            <b>{label}</b>
            <span>{parts[0][1]} of {total} {parts[0][0]}</span>
        </div>
        <div className="bar">
            {parts.map(([text, count, color, filterFn], i) => count > 0 && (
                <button key={i} onClick={() => onFilter(`${label}: ${text}`, filterFn)}
                    style={{ width: `${(count / total) * 100}%`, background: color }}
                    title={`${count} ${text}`} aria-label={`${count} ${text}`}
                />
            ))}
        </div>
        <div className="legend">
            {parts.map(([text, count, color, filterFn], i) => count > 0 && (
                <button key={i} onClick={() => onFilter(`${label}: ${text}`, filterFn)}>
                    <u style={{ background: color }} />
                    <strong>{count}</strong> <span>{text}</span>
                </button>
            ))}
        </div>
    </div>
);

const DistributionList = ({ title, items, onFilter }: {
    title: string; items: [string, number, (d: EnrichedDevice) => boolean][];
    onFilter: (label: string, fn: (d: EnrichedDevice) => boolean) => void;
}) => {
    const maxCount = Math.max(...items.map((i) => i[1]), 1);
    return (
        <div className="dist-card">
            <h3>{title}</h3>
            <div className="dist-items">
                {items.map(([name, count, filterFn]) => (
                    // Added title attribute here
                    <button className="os" key={name} onClick={() => onFilter(`${title}: ${name}`, filterFn)} title={name}>
                        <span className="dist-label">{name}</span>
                        <div className="dist-track">
                            <i style={{ width: `${(count / maxCount) * 100}%` }} />
                        </div>
                        <b>{count}</b>
                    </button>
                ))}
            </div>
        </div>
    );
};

// --- Main Component ---
export default function ExecutiveDashboard() {
    const [devices, setDevices] = useState<EnrichedDevice[] | null>(null);
    const [error, setError] = useState("");
    const [activeFilter, setActiveFilter] = useState<FilterState>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [displayLimit, setDisplayLimit] = useState(30);

    useEffect(() => {
        const fetchFleetData = () => {
            axios.get(`${APP_CONSTANTS.API_BASE_URL}/api/executive/overview`)
                .then((res) => { setDevices((res.data as RawDevice[]).map(enrichDeviceData)); setError(""); })
                .catch(() => setError("Could not load fleet data. Check that the API is running."));
        };
        fetchFleetData();
        const interval = setInterval(fetchFleetData, 60000);
        return () => clearInterval(interval);
    }, []);

    const stats = useMemo(() => {
        if (!devices) return null;
        const isWin10 = (d: EnrichedDevice) => d.osName.includes("Windows 10");
        const depts = groupBy(devices, (d) => d.dept).map(([name, total]) => {
            const deptDevices = devices.filter((d) => d.dept === name);
            return {
                name, total,
                edrProtected: countWhere(deptDevices, (d) => d.edr === "protected"),
                bitlockerEnabled: countWhere(deptDevices, (d) => d.bitlocker),
                expiringWarranty: countWhere(deptDevices, (d) => d.warrantyDaysRemaining !== null && d.warrantyDaysRemaining <= 90),
                atRisk: countWhere(deptDevices, (d) => d.issues.length > 0),
            };
        });

        return {
            isWin10, depts,
            osVersions: groupBy(devices, (d) => `${d.osName} ${d.osVersion || ""}`.trim()),
            ageGroups: [
                ["Under 2 years", (d: EnrichedDevice) => d.ageInYears !== null && d.ageInYears < 2],
                ["2 to 4 years", (d: EnrichedDevice) => d.ageInYears !== null && d.ageInYears >= 2 && d.ageInYears < 4],
                ["4 years or older", (d: EnrichedDevice) => d.ageInYears !== null && d.ageInYears >= 4],
                ["Age unknown", (d: EnrichedDevice) => d.ageInYears === null],
            ] as [string, (d: EnrichedDevice) => boolean][],
            ramGroups: [
                ["Under 8 GB", (d: EnrichedDevice) => d.ramGb !== null && d.ramGb < 7.5],
                ["8 to 15 GB", (d: EnrichedDevice) => d.ramGb !== null && d.ramGb >= 7.5 && d.ramGb < 15],
                ["16 to 31 GB", (d: EnrichedDevice) => d.ramGb !== null && d.ramGb >= 15 && d.ramGb < 31],
                ["32 GB or more", (d: EnrichedDevice) => d.ramGb !== null && d.ramGb >= 31],
            ] as [string, (d: EnrichedDevice) => boolean][],
            topModels: groupBy(devices, (d) => `${d.make || "?"} ${d.model || ""}`.trim()).slice(0, 8),
            agents: groupBy(devices, (d) => d.agent || "Unknown"),
        };
    }, [devices]);

    if (error) return <div className="ex-loading"><p>{error}</p></div>;
    if (!devices || !stats) return <div className="ex-loading"><div className="spinner" /> Loading fleet intelligence…</div>;

    const applyFilter = (label: string, test: (d: EnrichedDevice) => boolean) => {
        setActiveFilter({ label, test });
        setDisplayLimit(30);
        document.getElementById("explorer")?.scrollIntoView({ behavior: "smooth" });
    };

    const totalDevices = devices.length;
    const inWarrantyWindow = (lo: number, hi: number) => (d: EnrichedDevice) => d.warrantyDaysRemaining !== null && d.warrantyDaysRemaining >= lo && d.warrantyDaysRemaining < hi;

    const noEdrCount = countWhere(devices, (d) => d.edr === "none" || d.edr === "off");
    const win10Count = countWhere(devices, stats.isWin10);
    const expiringCount = countWhere(devices, (d) => d.warrantyDaysRemaining !== null && d.warrantyDaysRemaining <= 30);
    const staleCount = countWhere(devices, (d) => d.isStale);
    const missingBitlockerCount = totalDevices - countWhere(devices, (d) => d.bitlocker);

    const actionItems: [string, string, (d: EnrichedDevice) => boolean][] = [
        [noEdrCount, `${noEdrCount} devices have no active EDR`, "No active EDR", (d) => d.edr === "none" || d.edr === "off"],
        [missingBitlockerCount, `${missingBitlockerCount} devices have no BitLocker key`, "No BitLocker", (d) => !d.bitlocker],
        [win10Count, `${win10Count} devices run Windows 10 (no security updates)`, "Windows 10", stats.isWin10],
        [expiringCount, `${expiringCount} warranties expired or ending within a month`, "Warranty < 1 month", (d) => d.warrantyDaysRemaining !== null && d.warrantyDaysRemaining <= 30],
        [staleCount, `${staleCount} devices unseen for 7+ days`, "Not seen 7d+", (d) => d.isStale],
    ].filter((item) => (item[0] as number) > 0).map((item) => [item[1] as string, item[2] as string, item[3] as any]);

    const displayedDevices = devices
        .filter((d) => (!activeFilter || activeFilter.test(d)))
        .filter((d) => (!searchQuery || `${d.hostname} ${d.user} ${d.dept} ${d.model}`.toLowerCase().includes(searchQuery.toLowerCase())))
        .sort((a, b) => b.issues.length - a.issues.length);

    return (
        <main className="ex">
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        
        .ex { 
          font: 400 14px/1.5 'Plus Jakarta Sans', system-ui, sans-serif; 
          color: ${COLORS.ink}; 
          background: ${COLORS.bg}; 
          min-height: 100vh; 
          padding: 40px clamp(20px, 5vw, 60px); 
        }
        
        .ex-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-size: 16px; color: ${COLORS.textMute}; }
        .spinner { width: 40px; height: 40px; border: 3px solid ${COLORS.mute}; border-top-color: ${COLORS.good}; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 16px; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Typography */
        .ex h1, .ex h2, .ex h3 { margin: 0; color: ${COLORS.ink}; letter-spacing: -0.02em; }
        .ex h1 { font-size: clamp(28px, 4vw, 42px); font-weight: 800; line-height: 1.1; max-width: 20ch; }
        .ex h2 { font-size: 18px; font-weight: 700; margin-bottom: 20px; border-bottom: 1px solid ${COLORS.mute}; padding-bottom: 12px; }
        .ex h3 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: ${COLORS.textMute}; margin-bottom: 16px; }
        
        /* Base Resets */
        .ex button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; text-align: left; transition: all 0.2s ease; }
        .ex button:focus-visible, .ex a:focus-visible, .ex input:focus-visible { outline: 2px solid ${COLORS.good}; outline-offset: 2px; border-radius: 4px; }
        .ex a { text-decoration: none; color: ${COLORS.ink}; font-weight: 600; transition: color 0.2s; }
        .ex a:hover { color: ${COLORS.good}; }

        /* Layout */
        .header-section { display: flex; justify-content: space-between; align-items: flex-end; gap: 32px; flex-wrap: wrap; margin-bottom: 32px; }
        .metrics-cluster { display: flex; gap: 32px; background: ${COLORS.card}; padding: 16px 32px; border-radius: 100px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03); border: 1px solid ${COLORS.mute}; }
        .metric { display: flex; flex-direction: column; }
        .metric span { font-size: 12px; font-weight: 600; color: ${COLORS.textMute}; text-transform: uppercase; letter-spacing: 0.05em; }
        .metric b { font-size: 28px; font-weight: 800; color: ${COLORS.ink}; line-height: 1; margin-top: 4px; }
        
        .dashboard-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 24px; margin-bottom: 24px; }
        .dist-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 24px; }
        
        /* Panels / Cards */
        .panel { 
          background: ${COLORS.card}; 
          padding: 28px; 
          border-radius: 20px; 
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.03), 0 2px 4px -1px rgba(0,0,0,0.02); 
          border: 1px solid rgba(226, 232, 240, 0.8); 
          overflow-x: auto; 
        }
        
        /* Progress Bars */
        .row { margin-bottom: 28px; }
        .rowhead { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 10px; font-weight: 600; font-size: 14px; }
        .rowhead span { color: ${COLORS.textMute}; font-size: 13px; font-weight: 500; }
        
        .bar { display: flex; height: 12px; border-radius: 999px; overflow: hidden; background: ${COLORS.mute}; gap: 2px; }
        .bar button { height: 100%; transition: opacity 0.2s, transform 0.2s; }
        .bar button:hover { opacity: 0.8; transform: scaleY(1.2); }
        
        .legend { display: flex; gap: 10px 20px; flex-wrap: wrap; margin-top: 10px; }
        .legend button { display: flex; align-items: center; font-size: 13px; color: ${COLORS.textMute}; padding: 4px 8px; border-radius: 6px; margin-left: -8px; }
        .legend button:hover { background: ${COLORS.bg}; color: ${COLORS.ink}; }
        .legend u { display: block; width: 8px; height: 8px; border-radius: 50%; margin-right: 8px; }
        .legend strong { margin-right: 4px; color: ${COLORS.ink}; }
        
        /* Runway Buttons */
        .runway { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; border-radius: 12px; overflow: hidden; margin-bottom: 12px; }
        .runway button { padding: 16px 12px; color: #fff; font-size: 13px; font-weight: 500; transition: filter 0.2s; }
        .runway button:hover { filter: brightness(1.1); }
        .runway b { display: block; font-size: 24px; font-weight: 800; margin-bottom: 4px; }
        .legend-text { font-size: 13px; color: ${COLORS.textMute}; }
        
        /* Action List */
        .act { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; }
        .act button { padding: 14px 16px; background: ${COLORS.bg}; border-radius: 12px; width: 100%; font-weight: 600; font-size: 14px; border: 1px solid transparent; display: flex; justify-content: space-between; align-items: center; }
        .act button::after { content: "→"; opacity: 0.4; transition: transform 0.2s, opacity 0.2s; }
        .act button:hover { background: #fff; border-color: ${COLORS.mute}; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
        .act button:hover::after { opacity: 1; transform: translateX(4px); }
        
       /* Distribution Lists */
        .dist-card { background: ${COLORS.bg}; padding: 20px; border-radius: 16px; height: 100%; }
        .dist-items { display: flex; flex-direction: column; gap: 8px; } /* Increased gap from 4px to 8px */
        .os { display: flex; align-items: center; width: 100%; padding: 8px 12px; border-radius: 8px; font-size: 13px; font-weight: 500; margin-left: -12px; width: calc(100% + 24px); }
        .os:hover { background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        
        /* Updated Label: Removed nowrap, increased base width, allowed wrapping */
        .dist-label { flex: 0 0 130px; text-align: left; line-height: 1.3; color: ${COLORS.textMute}; }
        .os:hover .dist-label { color: ${COLORS.ink}; }
        
        .dist-track { flex: 1; height: 6px; background: ${COLORS.mute}; border-radius: 99px; margin: 0 16px; overflow: hidden; }
        .os i { display: block; height: 100%; background: ${COLORS.textMute}; border-radius: 99px; transition: background 0.2s; }
        .os:hover i { background: ${COLORS.good}; }
        .os b { flex: 0 0 30px; text-align: right; font-weight: 700; color: ${COLORS.ink}; }
        
        /* Tables */
        table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 14px; }
        th { font-weight: 600; color: ${COLORS.textMute}; padding: 12px 16px; border-bottom: 1px solid ${COLORS.mute}; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; text-align: left; background: rgba(255,255,255,0.9); backdrop-filter: blur(4px); position: sticky; top: 0; z-index: 10; }
        td { padding: 16px; border-bottom: 1px solid ${COLORS.bg}; vertical-align: middle; color: ${COLORS.ink}; }
        tr { transition: background 0.2s; }
        tbody tr:hover { background: ${COLORS.bg}; }
        td button { font-weight: 600; color: ${COLORS.ink}; }
        td button:hover { color: ${COLORS.good}; }
        
        /* Chips & Badges */
        .chip { display: inline-flex; align-items: center; background: #FEF2F2; color: ${COLORS.bad}; padding: 4px 10px; border-radius: 99px; font-size: 12px; font-weight: 600; margin: 2px 6px 2px 0; border: 1px solid #FEE2E2; }
        .chip.good { background: #ECFDF5; color: ${COLORS.good}; border-color: #D1FAE5; }
        
        /* Tools & Inputs */
        .tools { display: flex; gap: 16px; flex-wrap: wrap; align-items: center; margin-bottom: 20px; }
        .tools input { padding: 12px 16px; border: 1px solid ${COLORS.mute}; border-radius: 12px; font: inherit; min-width: 280px; box-shadow: 0 1px 2px rgba(0,0,0,0.02); transition: all 0.2s; }
        .tools input:focus { outline: none; border-color: ${COLORS.good}; box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1); }
        .tag { display: inline-flex; align-items: center; background: ${COLORS.ink}; color: #fff !important; padding: 6px 14px; border-radius: 99px; font-size: 13px; font-weight: 600; gap: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .tag:hover { transform: translateY(-1px); box-shadow: 0 4px 6px rgba(0,0,0,0.15); }
        .tag.secondary { background: ${COLORS.bg}; color: ${COLORS.ink} !important; border: 1px solid ${COLORS.mute}; box-shadow: none; }
        .tag.secondary:hover { background: ${COLORS.mute}; }

        @media(max-width: 1024px) {
          .dashboard-grid { grid-template-columns: 1fr; }
          .metrics-cluster { width: 100%; justify-content: space-between; border-radius: 20px; padding: 24px; }
        }
        @media(max-width: 640px) {
          .runway { grid-template-columns: repeat(2, 1fr); }
          .metrics-cluster { flex-direction: column; gap: 20px; }
          .panel { padding: 20px; }
        }
        .metric.interactive-metric {
          background: transparent;
          border: none;
          padding: 0;
          align-items: flex-start;
          cursor: pointer;
          transition: transform 0.2s ease, opacity 0.2s ease;
        }
        .metric.interactive-metric:hover {
          transform: translateY(-2px);
          opacity: 0.8;
        }
        .metric.interactive-metric:focus-visible {
          outline: 2px solid ${COLORS.bad}; 
          outline-offset: 4px; 
          border-radius: 4px; 
        }
      `}</style>

            <header className="header-section">
                <h1>{actionItems.length ? `${actionItems.length} issues need attention` : "Fleet is in good shape"}</h1>
                <div className="metrics-cluster">
                    <div className="metric"><span>Total Devices</span><b>{totalDevices}</b></div>
                    <div className="metric"><span>Online Now</span><b style={{ color: COLORS.good }}>{countWhere(devices, (d) => (d.status || "").toLowerCase() === "connected")}</b></div>

                    {/* Changed this metric to a clickable button */}
                    <button
                        className="metric interactive-metric"
                        onClick={() => applyFilter("Devices At Risk", (d) => d.issues.length > 0)}
                        title="Click to view all devices at risk"
                    >
                        <span>At Risk</span>
                        <b style={{ color: COLORS.bad }}>{countWhere(devices, (d) => d.issues.length > 0)}</b>
                    </button>
                </div>
            </header>

            <div className="dashboard-grid">
                <section className="panel">
                    <h2>Protection Coverage</h2>
                    <ProgressBar
                        label="EDR / Antivirus Status"
                        total={totalDevices}
                        onFilter={applyFilter}
                        parts={[
                            ["Protected", countWhere(devices, (d) => d.edr === "protected"), COLORS.good, (d) => d.edr === "protected"],
                            ["Outdated", countWhere(devices, (d) => d.edr === "outdated"), COLORS.warn, (d) => d.edr === "outdated"],
                            ["Turned Off", countWhere(devices, (d) => d.edr === "off"), COLORS.bad, (d) => d.edr === "off"],
                            ["None Found", countWhere(devices, (d) => d.edr === "none"), COLORS.dark, (d) => d.edr === "none"],
                        ]}
                    />
                    <ProgressBar
                        label="Disk Encryption (BitLocker)"
                        total={totalDevices}
                        onFilter={applyFilter}
                        parts={[
                            ["Encrypted", countWhere(devices, (d) => d.bitlocker), COLORS.good, (d) => d.bitlocker],
                            ["Not Encrypted", countWhere(devices, (d) => !d.bitlocker), COLORS.bad, (d) => !d.bitlocker],
                        ]}
                    />
                    <ProgressBar
                        label="Operating System Support"
                        total={totalDevices}
                        onFilter={applyFilter}
                        parts={[
                            ["Supported OS", totalDevices - win10Count, COLORS.good, (d) => !stats.isWin10(d)],
                            ["Windows 10 (At Risk)", win10Count, COLORS.bad, stats.isWin10],
                        ]}
                    />

                    <h2 style={{ marginTop: 40 }}>Warranty Runway</h2>
                    <div className="runway">
                        <button style={{ background: COLORS.dark }} onClick={() => applyFilter("Warranty expired", (d) => d.warrantyDaysRemaining !== null && d.warrantyDaysRemaining < 0)}>
                            <b>{countWhere(devices, (d) => d.warrantyDaysRemaining !== null && d.warrantyDaysRemaining < 0)}</b> Expired
                        </button>
                        <button style={{ background: COLORS.bad }} onClick={() => applyFilter("Warranty ends within 15 days", inWarrantyWindow(0, 15))}>
                            <b>{countWhere(devices, inWarrantyWindow(0, 15))}</b> &lt; 15 days
                        </button>
                        <button style={{ background: COLORS.warn }} onClick={() => applyFilter("Warranty ends in 15 to 30 days", inWarrantyWindow(15, 30))}>
                            <b>{countWhere(devices, inWarrantyWindow(15, 30))}</b> 15 - 30 days
                        </button>
                        <button style={{ background: "#8A7A3A" }} onClick={() => applyFilter("Warranty ends in 1 to 3 months", inWarrantyWindow(30, 90))}>
                            <b>{countWhere(devices, inWarrantyWindow(30, 90))}</b> 1 - 3 mos
                        </button>
                    </div>
                    <p className="legend-text">
                        {countWhere(devices, (d) => d.warrantyDaysRemaining !== null && d.warrantyDaysRemaining >= 90)} devices covered beyond 3 months.
                        {" "}{countWhere(devices, (d) => d.warrantyDaysRemaining === null)} have no warranty data.
                    </p>
                </section>

                <section className="panel">
                    <h2>Recommended Actions</h2>
                    {actionItems.length > 0 ? (
                        <ul className="act">
                            {actionItems.map(([text, label, filterFn]) => (
                                <li key={text}>
                                    <button onClick={() => applyFilter(label, filterFn)}>{text}</button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div style={{ padding: "40px 20px", textAlign: "center", color: COLORS.textMute }}>
                            <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
                            <p>All clear! No immediate actions required.</p>
                        </div>
                    )}
                </section>
            </div>

            <section className="panel" style={{ marginBottom: 24 }}>
                <h2>Fleet Demographics</h2>
                <div className="dist-grid">
                    <DistributionList
                        title="Windows Versions"
                        onFilter={applyFilter}
                        items={stats.osVersions.map(([name, count]) => [name, count, (d) => `${d.osName} ${d.osVersion || ""}`.trim() === name])}
                    />
                    <DistributionList
                        title="Hardware Age"
                        onFilter={applyFilter}
                        items={stats.ageGroups.map(([name, filterFn]) => [name, countWhere(devices, filterFn), filterFn])}
                    />
                    <DistributionList
                        title="System Memory"
                        onFilter={applyFilter}
                        items={stats.ramGroups.map(([name, filterFn]) => [name, countWhere(devices, filterFn), filterFn])}
                    />
                    <DistributionList
                        title="Top Models"
                        onFilter={applyFilter}
                        items={stats.topModels.map(([name, count]) => [name, count, (d) => `${d.make || "?"} ${d.model || ""}`.trim() === name])}
                    />
                </div>
            </section>

            <section className="panel" style={{ marginBottom: 24 }}>
                <h2>Department Breakdown</h2>
                <div style={{ overflowX: "auto" }}>
                    <table>
                        <thead>
                            <tr>
                                <th>Department</th>
                                <th>Total Devices</th>
                                <th>EDR Protected</th>
                                <th>BitLocker</th>
                                <th>Expiring ≤ 3 mo</th>
                                <th>Flagged Issues</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.depts.map((dept) => (
                                <tr key={dept.name}>
                                    <td>
                                        <button onClick={() => applyFilter(`Department: ${dept.name}`, (d) => d.dept === dept.name)}>
                                            {dept.name}
                                        </button>
                                    </td>
                                    <td style={{ fontWeight: 600 }}>{dept.total}</td>
                                    <td>
                                        <span className={dept.edrProtected === dept.total ? "chip good" : ""}>
                                            {Math.round((dept.edrProtected / dept.total) * 100)}%
                                        </span>
                                    </td>
                                    <td>
                                        <span className={dept.bitlockerEnabled === dept.total ? "chip good" : ""}>
                                            {Math.round((dept.bitlockerEnabled / dept.total) * 100)}%
                                        </span>
                                    </td>
                                    <td>{dept.expiringWarranty > 0 ? <strong style={{ color: COLORS.warn }}>{dept.expiringWarranty}</strong> : 0}</td>
                                    <td>{dept.atRisk > 0 ? <strong style={{ color: COLORS.bad }}>{dept.atRisk}</strong> : 0}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="panel" id="explorer">
                <h2>Device Explorer ({displayedDevices.length})</h2>
                <div className="tools">
                    <input
                        placeholder="Search by hostname, user, department or model..."
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setDisplayLimit(30); }}
                        aria-label="Search devices"
                    />
                    {activeFilter && (
                        <button className="tag" onClick={() => setActiveFilter(null)}>
                            {activeFilter.label} <span style={{ opacity: 0.7, marginLeft: 4 }}>✕</span>
                        </button>
                    )}
                </div>
                <div style={{ overflowX: "auto" }}>
                    <table>
                        <thead>
                            <tr>
                                <th>Device Name</th>
                                <th>Assigned User</th>
                                <th>Department</th>
                                <th>System</th>
                                <th>Hardware Model</th>
                                <th>Warranty Expiration</th>
                                <th>Identified Issues</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayedDevices.slice(0, displayLimit).map((device) => (
                                <tr key={device.hostname}>
                                    <td><Link to={`/device/${encodeURIComponent(device.hostname)}`}>{device.hostname}</Link></td>
                                    <td style={{ color: device.user ? COLORS.ink : COLORS.textMute }}>{device.user || "Unassigned"}</td>
                                    <td>{device.dept}</td>
                                    <td>{device.osName} <span style={{ color: COLORS.textMute, fontSize: 12 }}>{device.osVersion}</span></td>
                                    <td>{device.make} {device.model}</td>
                                    <td style={{ color: (device.warrantyDaysRemaining ?? 999) < 30 ? COLORS.bad : COLORS.ink }}>
                                        {formatDate(device.endDate)}
                                    </td>
                                    <td>
                                        {device.issues.length > 0
                                            ? device.issues.map((issue) => <span className="chip" key={issue}>{issue}</span>)
                                            : <span style={{ color: COLORS.textMute, fontSize: 13, fontWeight: 500 }}>Healthy</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {displayLimit < displayedDevices.length && (
                    <div style={{ marginTop: 24, textAlign: "center" }}>
                        <button className="tag secondary" onClick={() => setDisplayLimit(displayLimit + 50)}>
                            Load 50 More Devices ↓
                        </button>
                    </div>
                )}
                {displayedDevices.length === 0 && (
                    <div style={{ padding: "40px 20px", textAlign: "center", color: COLORS.textMute }}>
                        <p>No devices found matching your criteria. Try adjusting your filters or search query.</p>
                    </div>
                )}
            </section>
        </main>
    );
}