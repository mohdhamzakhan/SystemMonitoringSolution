import { useState, useEffect, useRef, useCallback } from "react";
import { APP_CONSTANTS } from "../store";
import { Network, DataSet } from "vis-network/standalone";
import Navbar from "./Navbar";

const API_BASE = APP_CONSTANTS.API_BASE_URL;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const vendorIcon = (vendor) => {
    if (vendor === "Cisco") return "🔵";
    if (vendor === "Aruba" || vendor === "HP") return "🟢";
    return "⚪";
};

const layerBadge = (layer) =>
    layer === "L3"
        ? <span style={styles.badgeL3}>L3</span>
        : layer === "Firewall"
            ? <span style={styles.badgeFirewall}>FW</span>
            : <span style={styles.badgeL2}>L2</span>;

const statusDot = (reachable) =>
    <span style={{ color: reachable ? "#16a34a" : "#dc2626", fontSize: 12 }}>
        {reachable ? "● Online" : "● Offline"}
    </span>;

const createSwitchTooltip = (n) => {
    const div = document.createElement("div");
    const title = document.createElement("div");
    title.textContent = n.label || "Unknown";
    title.style.fontWeight = "600";
    title.style.marginBottom = "4px";
    const vendorModel = document.createElement("div");
    vendorModel.textContent = `${n.vendor || "—"} ${n.model || ""}`.trim();
    const ip = document.createElement("div");
    ip.textContent = `IP: ${n.ipAddress || "—"}`;
    const layer = document.createElement("div");
    layer.textContent = `Layer: ${n.switchLayer || "—"}`;
    div.appendChild(title);
    div.appendChild(vendorModel);
    div.appendChild(ip);
    div.appendChild(layer);
    return div;
};

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function NetworkDashboard() {
    const [tab, setTab] = useState("list");
    const [switches, setSwitches] = useState([]);
    const [topology, setTopology] = useState(null);
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(false);
    const [scanStatus, setScanStatus] = useState(null);
    const [search, setSearch] = useState("");
    const [filterVendor, setFilterVendor] = useState("All");
    const [filterLayer, setFilterLayer] = useState("All");
    const [activeFilter, setActiveFilter] = useState("ALL");

    const fetchSwitches = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/NetworkScan/switches`);
            setSwitches(await res.json());
        } catch (e) { console.error(e); }
        setLoading(false);
    }, []);

    const fetchTopology = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/NetworkScan/topology`);
            const data = await res.json();
            setTopology(data);
        } catch (e) { console.error(e); }
    }, []);

    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/NetworkScan/status`);
            setScanStatus(await res.json());
        } catch (e) { console.error(e); }
    }, []);

    const [portMap, setPortMap] = useState([]);

    const fetchPortMap = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/NetworkScan/port-map`);
            setPortMap(await res.json());
        } catch (e) { console.error(e); }
    }, []);

    const [apPortMap, setAPPortMap] = useState([]);
    const fetchAPPortMap = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/NetworkScan/port-ap-map`);
            setAPPortMap(await res.json());
        } catch (e) { console.error(e); }
    }, []);

    const [isFullscreen, setIsFullscreen] = useState(false);
    const wrapperRef = useRef(null);

    function handleFullscreen() {
        if (!document.fullscreenElement) {
            wrapperRef.current?.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    }

    useEffect(() => {
        const handler = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener("fullscreenchange", handler);
        return () => document.removeEventListener("fullscreenchange", handler);
    }, []);

    useEffect(() => {
        fetchSwitches();
        fetchTopology();
        fetchStatus();
        fetchPortMap();
        fetchAPPortMap();
    }, [fetchSwitches, fetchTopology, fetchStatus, fetchPortMap, fetchAPPortMap]);

    const triggerScan = async () => {
        await fetch(`${API_BASE}/api/NetworkScan/scan`, { method: "POST" });
        setScanStatus({ isRunning: true, message: "Scan started…" });
        const interval = setInterval(async () => {
            const res = await fetch(`${API_BASE}/api/NetworkScan/status`);
            const st = await res.json();
            setScanStatus(st);
            if (!st.isRunning) {
                clearInterval(interval);
                fetchSwitches();
                fetchTopology();
            }
        }, 5000);
    };

    const filteredSwitches = switches.filter(sw => {

        // 🔍 Search
        const matchSearch =
            !search ||
            sw.hostname?.toLowerCase().includes(search.toLowerCase()) ||
            sw.ipAddress?.includes(search) ||
            sw.model?.toLowerCase().includes(search.toLowerCase());

        // 🏷 Vendor
        const matchVendor =
            filterVendor === "All" || sw.vendor === filterVendor;

        // 🧩 Layer dropdown
        const matchLayer =
            filterLayer === "All" || sw.switchLayer === filterLayer;

        // 📊 Stat card filter (NEW)
        const matchCard = (() => {
            switch (activeFilter) {
                case "ONLINE":
                    return sw.isReachable;
                case "OFFLINE":
                    return !sw.isReachable;
                case "L3":
                    return sw.switchLayer === "L3";
                case "L2":
                    return sw.switchLayer === "L2";
                case "FIREWALL":
                    return sw.switchLayer === "Firewall";
                default:
                    return true;
            }
        })();

        return matchSearch && matchVendor && matchLayer && matchCard;
    });

    const vendors = ["All", ...new Set(switches.map(s => s.vendor).filter(Boolean))];

    

    return (
        <>
            <Navbar />
            <div style={styles.app}>
                {/* ── Header ── */}
                <header style={styles.header}>
                    <div>
                        <h1 style={styles.title}>🖧 Network Switch Monitor</h1>
                        <p style={styles.subtitle}>SystemMonitorAPI · SNMP v3</p>
                    </div>
                    <div style={styles.headerRight}>
                        {scanStatus && (
                            <span style={{
                                fontSize: 13,
                                color: scanStatus.isRunning ? "#d97706" : "#16a34a",
                                background: scanStatus.isRunning ? "#fef3c7" : "#dcfce7",
                                padding: "4px 10px", borderRadius: 6
                            }}>
                                {scanStatus.isRunning ? "⏳ Scanning…" : `✅ ${scanStatus.message}`}
                            </span>
                        )}
                        <button
                            style={{ ...styles.btn, opacity: scanStatus?.isRunning ? 0.5 : 1 }}
                            onClick={triggerScan}
                            disabled={scanStatus?.isRunning}
                        >
                            🔄 Scan Now
                        </button>
                    </div>
                </header>

                {/* ── Stat cards ── */}
                <div style={styles.statRow}>
                    {[
                        { key: "ALL", label: "Total Switches", value: switches.length, icon: "🖧", bg: "#eff6ff", color: "#1d4ed8" },
                        { key: "ONLINE", label: "Online", value: switches.filter(s => s.isReachable).length, icon: "🟢", bg: "#f0fdf4", color: "#15803d" },
                        { key: "OFFLINE", label: "Offline", value: switches.filter(s => !s.isReachable).length, icon: "🔴", bg: "#fff1f2", color: "#be123c" },
                        { key: "L3", label: "L3 Switches", value: switches.filter(s => s.switchLayer === "L3").length, icon: "🔷", bg: "#eef2ff", color: "#4338ca" },
                        { key: "FIREWALL", label: "Firewall", value: switches.filter(s => s.switchLayer === "Firewall").length, icon: "🔥", bg: "#eef2ff", color: "#4338ca" },
                        { key: "L2", label: "L2 Switches", value: switches.filter(s => s.switchLayer === "L2").length, icon: "🔹", bg: "#f0f9ff", color: "#0369a1" },
                    ].map(c => (
                        <div
                            key={c.label}
                            onClick={() => setActiveFilter(c.key)}
                            style={{
                                ...styles.statCard,
                                background: c.bg,
                                cursor: "pointer",
                                border: activeFilter === c.key ? "2px solid #6366f1" : "1px solid #e2e8f0",
                                transform: activeFilter === c.key ? "scale(1.05)" : "scale(1)",
                                transition: "0.2s"
                            }}
                        >
                            <div style={styles.statIcon}>{c.icon}</div>
                            <div style={{ ...styles.statVal, color: c.color }}>{c.value}</div>
                            <div style={styles.statLabel}>{c.label}</div>
                        </div>
                    ))}
                </div>

                {/* ── Tabs ── */}
                <div style={styles.tabBar}>
                    {["list", "topology", "userTopology", "apTopology"].map(t => (
                        <button key={t}
                            style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }}
                            onClick={() => setTab(t)}>
                            {t === "list" ? "📋 Switch List"
                                : t === "topology" ? "🗺️ Topology Map"
                                    : t === "userTopology" ? "👥 User Topology"
                                        : "📡 AP Topology"}
                        </button>
                    ))}
                </div>

                {/* ── List Tab ── */}
                {tab === "list" && (
                    <div>
                        <div style={styles.filterRow}>
                            <input
                                style={styles.searchInput}
                                placeholder="🔍  Search by hostname, IP or model…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                            <select style={styles.select} value={filterVendor}
                                onChange={e => setFilterVendor(e.target.value)}>
                                {vendors.map(v => <option key={v}>{v}</option>)}
                            </select>
                            <select style={styles.select} value={filterLayer}
                                onChange={e => setFilterLayer(e.target.value)}>
                                {["All", "L2", "L3", "Firewall"].map(l => <option key={l}>{l}</option>)}
                            </select>
                            <span style={{ color: "#64748b", fontSize: 13 }}>
                                {filteredSwitches.length} results
                            </span>
                        </div>

                        {loading
                            ? <div style={styles.loading}>Loading switches…</div>
                            : (
                                <div style={styles.tableWrap}>
                                    <table style={styles.table}>
                                        <thead>
                                            <tr>
                                                {["", "Hostname", "IP Address", "Vendor / Model",
                                                    "Layer", "Pool", "Ports Up / Total",
                                                    "Uptime", "Uplinks", "Status"].map(h => (
                                                        <th key={h} style={styles.th}>{h}</th>
                                                    ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredSwitches.map(sw => (
                                                <tr
                                                    key={sw.switchId}
                                                    style={{
                                                        ...styles.tr,
                                                        background: !sw.isReachable || sw.isReachable === 0
                                                            ? "#ff8787"
                                                            : ""
                                                    }}
                                                    onClick={() => setSelected(sw)}
                                                    onMouseEnter={e =>
                                                        e.currentTarget.style.background = !sw.isReachable || sw.isReachable === 0
                                                            ? "#fee2e2"
                                                            : "#f1f5f9"
                                                    }
                                                    onMouseLeave={e =>
                                                        e.currentTarget.style.background = !sw.isReachable || sw.isReachable === 0
                                                            ? "#ff8787"
                                                            : ""
                                                    }
                                                >
                                                    <td style={styles.td}>{vendorIcon(sw.vendor)}</td>
                                                    <td style={{ ...styles.td, fontWeight: 600, color: "#1e293b" }}>
                                                        {sw.hostname || sw.ipAddress}
                                                    </td>
                                                    <td style={{ ...styles.td, fontFamily: "monospace", color: "#0369a1" }}>
                                                        {sw.ipAddress}
                                                    </td>
                                                    <td style={styles.td}>
                                                        <div style={{ fontWeight: 500, color: "#334155" }}>{sw.vendor}</div>
                                                        <div style={{ fontSize: 11, color: "#94a3b8" }}>{sw.model}</div>
                                                    </td>
                                                    <td style={styles.td}>{layerBadge(sw.switchLayer)}</td>
                                                    <td style={{ ...styles.td, color: "#94a3b8", fontSize: 12 }}>
                                                        {sw.poolName}
                                                    </td>
                                                    <td style={styles.td}>
                                                        <span style={{ color: "#16a34a", fontWeight: 600 }}>{sw.portsUp}</span>
                                                        <span style={{ color: "#94a3b8" }}> / {sw.totalPorts}</span>
                                                    </td>
                                                    <td style={{ ...styles.td, fontSize: 12, color: "#64748b" }}>
                                                        {sw.uptimeDisplay}
                                                    </td>
                                                    <td style={styles.td}>
                                                        {(() => {
                                                            const lldpUplinks = sw.uplinks?.filter(
                                                                u => u.protocol && u.protocol.toUpperCase() === "LLDP"
                                                            );

                                                            return lldpUplinks?.length > 0
                                                                ? lldpUplinks.map((u, i) => (
                                                                    <div key={i} style={{ fontSize: 11, marginBottom: 2 }}>
                                                                        <span style={{ color: "#ea580c", fontWeight: 500 }}>
                                                                            {u.remoteSysName}
                                                                        </span>
                                                                        <span style={{ color: "#94a3b8" }}>
                                                                            {" "}via {u.localPortName} → {u.remotePortName}
                                                                        </span>
                                                                        <span style={styles.protocolBadge}>{u.protocol}</span>
                                                                    </div>
                                                                ))
                                                                : <span style={{ color: "#cbd5e1", fontSize: 11 }}>—</span>;
                                                        })()}
                                                    </td>
                                                    <td style={styles.td}>{statusDot(sw.isReachable)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                    </div>
                )}

                {/* ── Topology Tab ── */}
                {tab === "topology" && (
                    <TopologyDiagram
                        topology={topology}
                        onSelectNode={id => {
                            const sw = switches.find(s => s.switchId === id);
                            if (sw) setSelected(sw);
                        }}
                        onRefresh={fetchTopology}
                    />
                )}

                {tab === "userTopology" && (
                    <UserTopologyDiagram
                        topology={topology}
                        portMap={portMap}
                        switches={switches}
                        onSelectNode={id => {
                            const sw = switches.find(s => s.switchId === id);
                            if (sw) setSelected(sw);
                        }}
                    />
                )}

                {tab === "apTopology" && (
                    <APTopologyDiagram
                        topology={topology}
                        portMap={apPortMap}
                        switches={switches}
                        onSelectNode={id => {
                            const sw = switches.find(s => s.switchId === id);
                            if (sw) setSelected(sw);
                        }}
                    />
                )}

                {/* ── Detail Drawer ── */}
                {selected && (
                    <SwitchDrawer sw={selected} onClose={() => setSelected(null)} />
                )}
            </div>
        </>
    );
}

// ─── Topology Search Box ──────────────────────────────────────────────────────
function TopologySearchBox({ onSearch, placeholder = "🔍 Search nodes…" }) {
    const [value, setValue] = useState("");

    const handleChange = (e) => {
        setValue(e.target.value);
        onSearch(e.target.value);
    };

    const handleClear = () => {
        setValue("");
        onSearch("");
    };

    return (
        <div style={styles.topoSearchWrap}>
            <input
                style={styles.topoSearchInput}
                placeholder={placeholder}
                value={value}
                onChange={handleChange}
            />
            {value && (
                <button style={styles.topoSearchClear} onClick={handleClear} title="Clear search">
                    ✕
                </button>
            )}
        </div>
    );
}

// ─── Topology Diagram ─────────────────────────────────────────────────────────
const POSITIONS_KEY = "topology_node_positions";

function loadSavedPositions() {
    try {
        return JSON.parse(localStorage.getItem(POSITIONS_KEY) || "{}");
    } catch {
        return {};
    }
}

function savePositions(network) {
    try {
        const positions = network.getPositions();
        localStorage.setItem(POSITIONS_KEY, JSON.stringify(positions));
    } catch { }
}

function clearSavedPositions() {
    try {
        localStorage.removeItem(POSITIONS_KEY);
    } catch { }
}

function TopologyDiagram({ topology, onSelectNode, onRefresh }) {
    const containerRef = useRef(null);
    const networkRef = useRef(null);
    const wrapperRef = useRef(null);
    const nodesDataRef = useRef(null);
    const onSelectNodeRef = useRef(onSelectNode);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [matchCount, setMatchCount] = useState(null);

    useEffect(() => { onSelectNodeRef.current = onSelectNode; }, [onSelectNode]);

    useEffect(() => {
        const handler = () => {
            const full = !!document.fullscreenElement;
            setIsFullscreen(full);
            setTimeout(() => {
                networkRef.current?.redraw();
                networkRef.current?.fit({ animation: { duration: 400, easingFunction: "easeInOutQuad" } });
            }, 300);
        };
        document.addEventListener("fullscreenchange", handler);
        return () => document.removeEventListener("fullscreenchange", handler);
    }, []);

    function handleFullscreen() {
        if (!document.fullscreenElement) {
            wrapperRef.current?.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }

    // ── Search handler: highlight matching nodes ──
    const handleSearch = useCallback((term) => {
        setSearchTerm(term);
        const nodesData = nodesDataRef.current;
        const rawNodes = topology?.nodes;
        if (!nodesData || !rawNodes) return;

        if (!term.trim()) {
            // Reset all nodes to original colors
            nodesData.update(rawNodes.map(n => ({
                id: n.id,
                color: getNodeColor(n),
                opacity: 1,
                borderWidth: 2,
            })));
            setMatchCount(null);
            networkRef.current?.fit({ animation: { duration: 400, easingFunction: "easeInOutQuad" } });
            return;
        }

        const q = term.toLowerCase();
        const matchIds = [];

        const updates = rawNodes.map(n => {
            const label = (n.label || "").toLowerCase();
            const ip = (n.ipAddress || "").toLowerCase();
            const vendor = (n.vendor || "").toLowerCase();
            const model = (n.model || "").toLowerCase();
            const layer = (n.switchLayer || "").toLowerCase();
            const isMatch = label.includes(q) || ip.includes(q) || vendor.includes(q) || model.includes(q) || layer.includes(q);

            if (isMatch) matchIds.push(n.id);

            return {
                id: n.id,
                color: isMatch
                    ? { background: "#fef08a", border: "#f59e0b", highlight: { background: "#fef08a", border: "#f59e0b" }, hover: { background: "#fef08a", border: "#f59e0b" } }
                    : { ...getNodeColor(n), opacity: 0.25 },
                opacity: isMatch ? 1 : 0.25,
                borderWidth: isMatch ? 3 : 1,
            };
        });

        nodesData.update(updates);
        setMatchCount(matchIds.length);

        // Focus on matched nodes
        if (matchIds.length > 0) {
            networkRef.current?.selectNodes(matchIds);
            networkRef.current?.fit({
                nodes: matchIds,
                animation: { duration: 500, easingFunction: "easeInOutQuad" }
            });
        }
    }, [topology]);

    useEffect(() => {
        if (!topology || !containerRef.current) return;

        networkRef.current?.destroy();
        networkRef.current = null;
        nodesDataRef.current = null;

        const { nodes: rawNodes, edges: rawEdges } = topology;
        if (!rawNodes?.length) return;

        const savedPositions = loadSavedPositions();

        

        const nodes = new DataSet(
            rawNodes.map(n => {
                const saved = savedPositions[n.id];
                return {
                    id: n.id,
                    label: `${n.label}\n${n.ipAddress}`,
                    color: getNodeColor(n),
                    font: { color: "#1e293b", size: 13, face: "Inter, sans-serif", multi: true },
                    shape: n.switchLayer === "L3" ? "diamond" : "box",
                    borderWidth: 2,
                    shadow: { enabled: true, color: "rgba(0,0,0,0.08)", size: 6 },
                    group: n.group,
                    title: createSwitchTooltip(n),
                    x: saved?.x ?? undefined,
                    y: saved?.y ?? undefined,
                    fixed: saved ? { x: true, y: true } : undefined,
                };
            })
        );

        nodesDataRef.current = nodes;

        const edges = new DataSet(
            (rawEdges ?? []).map(e => {
                const fromNode = rawNodes.find(n => n.id === e.from);
                const toNode = rawNodes.find(n => n.id === e.to);
                const isDown = !fromNode?.isReachable || !toNode?.isReachable;
                return {
                    id: e.id,
                    from: e.from,
                    to: e.to,
                    label: isDown ? "✕" : (e.label || ""),
                    color: {
                        color: isDown ? "#ef4444" : "#94a3b8",
                        highlight: "#f59e0b", hover: "#f59e0b",
                        opacity: isDown ? 0.6 : 1.0
                    },
                    font: {
                        color: isDown ? "#ef4444" : "#64748b",
                        size: isDown ? 14 : 10,
                        align: "middle", background: "#ffffff", bold: isDown,
                    },
                    dashes: isDown,
                    width: isDown ? 1.5 : 2,
                    smooth: { type: "curvedCW", roundness: 0.1 },
                    arrows: { to: { enabled: false } },
                    selectionWidth: 4
                };
            })
        );

        const options = {
            layout: { improvedLayout: true, hierarchical: { enabled: false } },
            physics: {
                enabled: true,
                solver: "forceAtlas2Based",
                forceAtlas2Based: {
                    gravitationalConstant: -80,
                    centralGravity: 0.01,
                    springLength: 160,
                    springConstant: 0.06,
                    damping: 0.4
                },
                stabilization: { enabled: true, iterations: 200, updateInterval: 25 }
            },
            interaction: { hover: true, tooltipDelay: 150, zoomView: true, dragView: true },
            nodes: { borderWidth: 2, borderWidthSelected: 3, size: 28, margin: { top: 8, right: 10, bottom: 8, left: 10 } },
            edges: { width: 2 }
        };

        networkRef.current = new Network(containerRef.current, { nodes, edges }, options);

        networkRef.current.on("selectNode", ({ nodes: sel }) => {
            if (sel[0]) onSelectNodeRef.current(sel[0]);
        });

        networkRef.current.on("stabilizationIterationsDone", () => {
            networkRef.current?.fit({ animation: { duration: 600, easingFunction: "easeInOutQuad" } });
        });

        networkRef.current.on("dragStart", ({ nodes: draggedNodes }) => {
            if (!draggedNodes.length) return;
            nodes.update(draggedNodes.map(id => {
                const node = nodes.get(id);
                return { id, fixed: { x: false, y: false }, color: node.color };
            }));
        });

        networkRef.current.on("dragEnd", ({ nodes: draggedNodes }) => {
            if (!draggedNodes.length) return;
            nodes.update(draggedNodes.map(id => {
                const node = nodes.get(id);
                return { id, fixed: { x: true, y: true }, color: node.color };
            }));
            savePositions(networkRef.current);
        });

        networkRef.current.on("doubleClick", ({ nodes: clickedNodes }) => {
            if (!clickedNodes.length) return;
            nodes.update(clickedNodes.map(id => ({ id, fixed: { x: false, y: false } })));
        });

        return () => {
            networkRef.current?.destroy();
            networkRef.current = null;
            nodesDataRef.current = null;
        };
    }, [topology]);

    const nodeCount = topology?.nodes?.length ?? 0;
    const edgeCount = topology?.edges?.length ?? 0;

    function handleRefresh() {
        clearSavedPositions();
        setSearchTerm("");
        setMatchCount(null);
        onRefresh();
    }

    return (
        <div ref={wrapperRef} style={{ background: "#f8fafc", ...(isFullscreen ? styles.fullscreenWrapper : {}) }}>
            <div style={styles.topoBar}>
                <div style={styles.topoLegend}>
                    <span style={styles.legendItem}>
                        <span style={{ ...styles.legendDot, background: "#dbeafe", border: "2px solid #3b82f6" }} /> Cisco
                    </span>
                    <span style={styles.legendItem}>
                        <span style={{ ...styles.legendDot, background: "#dcfce7", border: "2px solid #22c55e" }} /> Aruba / HP
                    </span>
                    <span style={styles.legendItem}>
                        <span style={{ ...styles.legendDot, background: "#fee2e2", border: "2px solid #ef4444" }} /> Offline
                    </span>
                    <span style={styles.legendItem}>
                        <span style={{ ...styles.legendDot, background: "#fdf4ff", border: "2px solid #a855f7" }} /> Firewall
                    </span>
                    <span style={styles.legendItem}>
                        <span style={{
                            display: "inline-block", width: 24, height: 2,
                            background: "#ef4444", verticalAlign: "middle",
                            borderTop: "2px dashed #ef4444"
                        }} />
                        &nbsp;Disconnected link
                    </span>
                    <span style={styles.legendItem}>◆ = L3 &nbsp; ■ = L2</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 12, color: "#64748b" }}>
                        {nodeCount} nodes · {edgeCount} links
                    </span>
                    {edgeCount === 0 && nodeCount > 0 && (
                        <span style={styles.topoWarn}>
                            ⚠️ No topology links — run a full scan first
                        </span>
                    )}
                    <button style={styles.btnSm} onClick={handleRefresh}>↻ Refresh</button>
                    <button style={styles.btnSm} onClick={handleFullscreen}>
                        {isFullscreen ? "⛶ Exit fullscreen" : "⛶ Fullscreen"}
                    </button>
                </div>
            </div>

            {/* ── Search row ── */}
            <div style={styles.topoSearchRow}>
                <TopologySearchBox
                    onSearch={handleSearch}
                    placeholder="🔍 Search by hostname, IP, vendor, model or layer…"
                />
                {matchCount !== null && (
                    <span style={matchCount > 0 ? styles.matchBadgeFound : styles.matchBadgeNone}>
                        {matchCount > 0 ? `${matchCount} match${matchCount !== 1 ? "es" : ""}` : "No matches"}
                    </span>
                )}
            </div>

            <div
                ref={containerRef}
                style={{
                    ...styles.topoCanvas,
                    ...(isFullscreen ? styles.fullscreenCanvas : {})
                }}
            />

            {nodeCount === 0 && (
                <div style={styles.topoEmpty}>
                    No switches found. Run a scan to populate the topology.
                </div>
            )}
        </div>
    );
}

// ─── Switch Detail Drawer ─────────────────────────────────────────────────────
function SwitchDrawer({ sw, onClose }) {
    const [detail, setDetail] = useState(null);

    useEffect(() => {
        fetch(`${API_BASE}/api/NetworkScan/switches/${sw.switchId}`)
            .then(r => r.json())
            .then(setDetail)
            .catch(console.error);
    }, [sw.switchId]);

    return (
        <div style={styles.drawer}>
            <div style={styles.drawerHeader}>
                <h2 style={{ margin: 0, fontSize: 18, color: "#1e293b" }}>
                    {vendorIcon(sw.vendor)} {sw.hostname}
                </h2>
                <button style={styles.closeBtn} onClick={onClose}>✕</button>
            </div>

            <div style={styles.drawerSection}>
                <Row label="IP Address" value={sw.ipAddress} />
                <Row label="Vendor" value={`${sw.vendor} — ${sw.model}`} />
                <Row label="Layer" value={sw.switchLayer} />
                <Row label="Location" value={sw.location || "—"} />
                <Row label="Pool" value={sw.poolName || "—"} />
                <Row label="Uptime" value={sw.uptimeDisplay} />
                <Row label="Last Scan" value={sw.lastScanDate
                    ? new Date(sw.lastScanDate).toLocaleString() : "—"} />
                <Row label="MAC" value={detail?.macAddress || "—"} />
            </div>

            {sw.uplinks?.length > 0 && (
                <>
                    <h3 style={styles.drawerSubTitle}>⬆ Uplinks</h3>
                    <div style={styles.drawerSection}>
                        {sw.uplinks.map((u, i) => (
                            <div key={i} style={styles.uplinkRow}>
                                <div style={{ color: "#ea580c", fontWeight: 600, marginBottom: 4 }}>
                                    {u.remoteSysName || u.remoteIp || "Unknown"}
                                </div>
                                <div style={{ fontSize: 12, color: "#64748b" }}>
                                    Local: <b style={{ color: "#334155" }}>{u.localPortName}</b>
                                    {" → "}
                                    Remote: <b style={{ color: "#334155" }}>{u.remotePortName}</b>
                                    {u.protocol && u.protocol.toUpperCase() !== "CDP" && (
                                        <span style={styles.protocolBadge}>{u.protocol}</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            <h3 style={styles.drawerSubTitle}>
                🔌 Ports ({detail?.ports?.length ?? "…"})
            </h3>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
                {detail?.ports?.map(p => (
                    <div key={p.portId}
                        style={{ ...styles.portRow, opacity: p.operStatus === "Up" ? 1 : 0.45 }}>
                        <span style={{ width: 180, flexShrink: 0, fontSize: 12, color: "#334155" }}>
                            {p.isUplink ? "⬆ " : ""}{p.portName}
                        </span>
                        <span style={{
                            color: p.operStatus === "Up" ? "#16a34a" : "#dc2626",
                            width: 50, fontSize: 11
                        }}>
                            {p.operStatus}
                        </span>
                        <span style={{ color: "#94a3b8", fontSize: 11 }}>
                            {p.speedMbps
                                ? (p.speedMbps >= 1000
                                    ? p.speedMbps / 1000 + "G"
                                    : p.speedMbps + "M")
                                : ""}
                            {p.portAlias ? ` · ${p.portAlias}` : ""}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

const Row = ({ label, value }) => (
    <div style={styles.detailRow}>
        <span style={styles.detailLabel}>{label}</span>
        <span style={styles.detailValue}>{value}</span>
    </div>
);

function UserTopologyDiagram({ topology, portMap, switches, onSelectNode }) {
    const containerRef = useRef(null);
    const networkRef = useRef(null);
    const wrapperRef = useRef(null);
    const nodesDataRef = useRef(null);
    const onSelectNodeRef = useRef(onSelectNode);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [matchCount, setMatchCount] = useState(null);

    useEffect(() => { onSelectNodeRef.current = onSelectNode; }, [onSelectNode]);

    useEffect(() => {
        const handler = () => {
            const full = !!document.fullscreenElement;
            setIsFullscreen(full);
            setTimeout(() => {
                networkRef.current?.redraw();
                networkRef.current?.fit({ animation: { duration: 400, easingFunction: "easeInOutQuad" } });
            }, 300);
        };
        document.addEventListener("fullscreenchange", handler);
        return () => document.removeEventListener("fullscreenchange", handler);
    }, []);

    function handleFullscreen() {
        if (!document.fullscreenElement) {
            wrapperRef.current?.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }

    // ── Search: searches switches + user devices ──
    const handleSearch = useCallback((term) => {
        const allNodesData = nodesDataRef.current;
        if (!allNodesData) return;

        const rawNodes = topology?.nodes ?? [];

        if (!term.trim()) {
            // Reset switches
            allNodesData.update(rawNodes.map(n => ({
                id: `sw-${n.id}`,
                color: getNodeColor(n),
                opacity: 1,
                borderWidth: 2,
            })));
            // Reset devices
            allNodesData.update(
                portMap.filter(d => d.connectedSwitchId != null).map(d => ({
                    id: `dev-${d.hostname}`,
                    color: d.status === "Offline"
                        ? { background: "#fee2e2", border: "#ef4444", highlight: { background: "#fef9c3", border: "#f59e0b" }, hover: { background: "#fef9c3", border: "#f59e0b" } }
                        : { background: "#fef9c3", border: "#f59e0b", highlight: { background: "#dbeafe", border: "#3b82f6" }, hover: { background: "#dbeafe", border: "#3b82f6" } },
                    opacity: 1,
                    borderWidth: 1.5,
                }))
            );
            setMatchCount(null);
            networkRef.current?.fit({ animation: { duration: 400, easingFunction: "easeInOutQuad" } });
            return;
        }

        const q = term.toLowerCase();
        const matchIds = [];

        // Update switches
        allNodesData.update(rawNodes.map(n => {
            const label = (n.label || "").toLowerCase();
            const ip = (n.ipAddress || "").toLowerCase();
            const vendor = (n.vendor || "").toLowerCase();
            const model = (n.model || "").toLowerCase();
            const isMatch = label.includes(q) || ip.includes(q) || vendor.includes(q) || model.includes(q);
            if (isMatch) matchIds.push(`sw-${n.id}`);
            return {
                id: `sw-${n.id}`,
                color: isMatch
                    ? { background: "#fef08a", border: "#f59e0b", highlight: { background: "#fef08a", border: "#f59e0b" }, hover: { background: "#fef08a", border: "#f59e0b" } }
                    : { ...getNodeColor(n) },
                opacity: isMatch ? 1 : 0.2,
                borderWidth: isMatch ? 3 : 1,
            };
        }));

        // Update devices
        allNodesData.update(
            portMap.filter(d => d.connectedSwitchId != null).map(d => {
                const hostname = (d.hostname || "").toLowerCase();
                const username = (d.username || "").toLowerCase();
                const dept = (d.department || "").toLowerCase();
                const port = (d.connectedPort || "").toLowerCase();
                const isMatch = hostname.includes(q) || username.includes(q) || dept.includes(q) || port.includes(q);
                if (isMatch) matchIds.push(`dev-${d.hostname}`);
                const baseColor = d.status === "Offline"
                    ? { background: "#fee2e2", border: "#ef4444", highlight: { background: "#fef9c3", border: "#f59e0b" }, hover: { background: "#fef9c3", border: "#f59e0b" } }
                    : { background: "#fef9c3", border: "#f59e0b", highlight: { background: "#dbeafe", border: "#3b82f6" }, hover: { background: "#dbeafe", border: "#3b82f6" } };
                return {
                    id: `dev-${d.hostname}`,
                    color: isMatch
                        ? { background: "#fef08a", border: "#f59e0b", highlight: { background: "#fef08a", border: "#f59e0b" }, hover: { background: "#fef08a", border: "#f59e0b" } }
                        : baseColor,
                    opacity: isMatch ? 1 : 0.2,
                    borderWidth: isMatch ? 3 : 1,
                };
            })
        );

        setMatchCount(matchIds.length);

        if (matchIds.length > 0) {
            networkRef.current?.selectNodes(matchIds);
            networkRef.current?.fit({
                nodes: matchIds,
                animation: { duration: 500, easingFunction: "easeInOutQuad" }
            });
        }
    }, [topology, portMap]);

    useEffect(() => {
        if (!topology || !containerRef.current) return;

        networkRef.current?.destroy();
        networkRef.current = null;
        nodesDataRef.current = null;

        const { nodes: rawNodes } = topology;
        if (!rawNodes?.length) return;

        const switchNodes = rawNodes.map(n => ({
            id: `sw-${n.id}`,
            label: `${n.label}\n${n.ipAddress}`,
            color: getNodeColor(n),
            font: { color: "#1e293b", size: 13, face: "Inter, sans-serif", multi: true },
            shape: n.switchLayer === "L3" ? "diamond" : "box",
            borderWidth: 2,
            size: 28,
            shadow: { enabled: true, color: "rgba(0,0,0,0.08)", size: 6 },
            title: createSwitchTooltip(n),
            _switchId: n.id,
            _type: "switch",
        }));

        const createTooltip = (d) => {
            const div = document.createElement("div");
            const title = document.createElement("div");
            title.textContent = d.hostname;
            title.style.fontWeight = "600";
            title.style.marginBottom = "4px";
            const user = document.createElement("div");
            user.textContent = `User: ${d.username || "—"}`;
            const dept = document.createElement("div");
            dept.textContent = `Dept: ${d.department || "—"}`;
            const port = document.createElement("div");
            port.textContent = `Port: ${d.connectedPort || "—"}`;
            const status = document.createElement("div");
            status.textContent = `Status: ${d.status || "—"}`;
            div.appendChild(title);
            div.appendChild(user);
            div.appendChild(dept);
            div.appendChild(port);
            div.appendChild(status);
            return div;
        };

        const deviceNodes = portMap
            .filter(d => d.connectedSwitchId != null)
            .map(d => ({
                id: `dev-${d.hostname}`,
                label: `${d.hostname}${d.username ? `\n${d.username}` : ""}`,
                color: d.status === "Offline"
                    ? { background: "#fee2e2", border: "#ef4444", highlight: { background: "#fef9c3", border: "#f59e0b" }, hover: { background: "#fef9c3", border: "#f59e0b" } }
                    : { background: "#fef9c3", border: "#f59e0b", highlight: { background: "#dbeafe", border: "#3b82f6" }, hover: { background: "#dbeafe", border: "#3b82f6" } },
                font: { color: "#1e293b", size: 11, face: "Inter, sans-serif", multi: true },
                shape: "ellipse",
                borderWidth: 1.5,
                size: 18,
                title: createTooltip(d),
                _type: "device",
                _switchId: d.connectedSwitchId,
            }));

        const allNodes = new DataSet([...switchNodes, ...deviceNodes]);
        nodesDataRef.current = allNodes;

        const { edges: rawEdges } = topology;
        const switchEdges = (rawEdges ?? []).map(e => {
            const fromNode = rawNodes.find(n => n.id === e.from);
            const toNode = rawNodes.find(n => n.id === e.to);
            const isDown = !fromNode?.isReachable || !toNode?.isReachable;
            return {
                id: `edge-sw-${e.id}`,
                from: `sw-${e.from}`,
                to: `sw-${e.to}`,
                label: isDown ? "✕" : (e.label || ""),
                color: { color: isDown ? "#ef4444" : "#94a3b8", highlight: "#f59e0b", hover: "#f59e0b", opacity: isDown ? 0.6 : 1.0 },
                font: { color: isDown ? "#ef4444" : "#64748b", size: isDown ? 14 : 10, align: "middle", background: "#ffffff", bold: isDown },
                dashes: isDown,
                width: isDown ? 1.5 : 2,
                smooth: { type: "curvedCW", roundness: 0.1 },
                arrows: { to: { enabled: false } },
            };
        });

        const deviceEdges = portMap
            .filter(d => d.connectedSwitchId != null)
            .map(d => ({
                id: `edge-dev-${d.hostname}`,
                from: `dev-${d.hostname}`,
                to: `sw-${d.connectedSwitchId}`,
                label: d.connectedPort
                    ? d.connectedPort.replace(/GigabitEthernet|FastEthernet|TenGigabitEthernet/g,
                        m => ({ GigabitEthernet: "Gi", FastEthernet: "Fa", TenGigabitEthernet: "Te" }[m] ?? m))
                    : "",
                color: { color: "#cbd5e1", highlight: "#f59e0b", hover: "#f59e0b" },
                font: { color: "#94a3b8", size: 9, align: "middle", background: "#ffffff" },
                dashes: [3, 4],
                width: 1,
                smooth: { type: "dynamic" },
                arrows: { to: { enabled: false } },
            }));

        const allEdges = new DataSet([...switchEdges, ...deviceEdges]);

        const options = {
            layout: { improvedLayout: true, hierarchical: { enabled: false } },
            physics: {
                enabled: true,
                solver: "forceAtlas2Based",
                forceAtlas2Based: { gravitationalConstant: -60, centralGravity: 0.005, springLength: 140, springConstant: 0.04, damping: 0.4 },
                stabilization: { enabled: true, iterations: 250, updateInterval: 25 }
            },
            interaction: { hover: true, tooltipDelay: 150, zoomView: true, dragView: true },
            nodes: { borderWidth: 2, borderWidthSelected: 3, margin: { top: 8, right: 10, bottom: 8, left: 10 } },
            edges: { width: 1 }
        };

        networkRef.current = new Network(containerRef.current, { nodes: allNodes, edges: allEdges }, options);

        networkRef.current.on("selectNode", ({ nodes: sel }) => {
            if (!sel[0]) return;
            const node = allNodes.get(sel[0]);
            if (node?._type === "switch") onSelectNodeRef.current(node._switchId);
        });

        networkRef.current.on("stabilizationIterationsDone", () => {
            networkRef.current?.fit({ animation: { duration: 600, easingFunction: "easeInOutQuad" } });
        });

        networkRef.current.on("dragStart", ({ nodes: dn }) => {
            if (!dn.length) return;
            allNodes.update(dn.map(id => ({ id, fixed: { x: false, y: false } })));
        });
        networkRef.current.on("dragEnd", ({ nodes: dn }) => {
            if (!dn.length) return;
            allNodes.update(dn.map(id => ({ id, fixed: { x: true, y: true } })));
        });

        return () => { networkRef.current?.destroy(); networkRef.current = null; nodesDataRef.current = null; };
    }, [topology, portMap]);

    const deviceCount = portMap.filter(d => d.connectedSwitchId != null).length;
    const unmappedCount = portMap.filter(d => d.connectedSwitchId == null).length;

    return (
        <div ref={wrapperRef} style={{ background: "#f8fafc", ...(isFullscreen ? styles.fullscreenWrapper : {}) }}>
            <div style={styles.topoBar}>
                <div style={styles.topoLegend}>
                    <span style={styles.legendItem}>
                        <span style={{ ...styles.legendDot, background: "#dbeafe", border: "2px solid #3b82f6" }} /> Switch
                    </span>
                    <span style={styles.legendItem}>
                        <span style={{ ...styles.legendDot, background: "#fef9c3", border: "2px solid #f59e0b", borderRadius: "50%" }} /> Device online
                    </span>
                    <span style={styles.legendItem}>
                        <span style={{ ...styles.legendDot, background: "#fee2e2", border: "2px solid #ef4444", borderRadius: "50%" }} /> Device offline
                    </span>
                    <span style={styles.legendItem}>◆ = L3 &nbsp; ■ = L2 &nbsp; ● = endpoint</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 12, color: "#64748b" }}>
                        {topology?.nodes?.length ?? 0} switches · {deviceCount} mapped devices
                        {unmappedCount > 0 && ` · ${unmappedCount} unmapped`}
                    </span>
                    {unmappedCount > 0 && (
                        <span style={styles.topoWarn}>⚠️ {unmappedCount} devices not yet port-resolved</span>
                    )}
                    <button style={styles.btnSm} onClick={handleFullscreen}>
                        {isFullscreen ? "⛶ Exit fullscreen" : "⛶ Fullscreen"}
                    </button>
                </div>
            </div>

            {/* ── Search row ── */}
            <div style={styles.topoSearchRow}>
                <TopologySearchBox
                    onSearch={handleSearch}
                    placeholder="🔍 Search by hostname, username, department, port…"
                />
                {matchCount !== null && (
                    <span style={matchCount > 0 ? styles.matchBadgeFound : styles.matchBadgeNone}>
                        {matchCount > 0 ? `${matchCount} match${matchCount !== 1 ? "es" : ""}` : "No matches"}
                    </span>
                )}
            </div>

            <div
                ref={containerRef}
                style={{ ...styles.topoCanvas, ...(isFullscreen ? styles.fullscreenCanvas : {}) }}
            />

            {!topology?.nodes?.length && (
                <div style={styles.topoEmpty}>No switches found. Run a scan to populate topology.</div>
            )}
        </div>
    );
}

function APTopologyDiagram({ topology, portMap, switches, onSelectNode }) {
    const containerRef = useRef(null);
    const networkRef = useRef(null);
    const wrapperRef = useRef(null);
    const nodesDataRef = useRef(null);
    const onSelectNodeRef = useRef(onSelectNode);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [matchCount, setMatchCount] = useState(null);

    useEffect(() => { onSelectNodeRef.current = onSelectNode; }, [onSelectNode]);

    useEffect(() => {
        const handler = () => {
            const full = !!document.fullscreenElement;
            setIsFullscreen(full);
            setTimeout(() => {
                networkRef.current?.redraw();
                networkRef.current?.fit({ animation: { duration: 400, easingFunction: "easeInOutQuad" } });
            }, 300);
        };
        document.addEventListener("fullscreenchange", handler);
        return () => document.removeEventListener("fullscreenchange", handler);
    }, []);

    function handleFullscreen() {
        if (!document.fullscreenElement) {
            wrapperRef.current?.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }

    // ── Search: searches switches + APs ──
    const handleSearch = useCallback((term) => {
        const allNodesData = nodesDataRef.current;
        if (!allNodesData) return;

        const rawNodes = topology?.nodes ?? [];

        if (!term.trim()) {
            allNodesData.update(rawNodes.map(n => ({
                id: `sw-${n.id}`,
                color: getNodeColor(n),
                opacity: 1,
                borderWidth: 2,
            })));
            allNodesData.update(
                portMap.filter(d => d.connectedSwitchId != null).map(d => ({
                    id: `dev-${d.hostname}`,
                    color: d.status === "Offline"
                        ? { background: "#fee2e2", border: "#ef4444", highlight: { background: "#fef9c3", border: "#f59e0b" }, hover: { background: "#fef9c3", border: "#f59e0b" } }
                        : { background: "#fef9c3", border: "#f59e0b", highlight: { background: "#dbeafe", border: "#3b82f6" }, hover: { background: "#dbeafe", border: "#3b82f6" } },
                    opacity: 1,
                    borderWidth: 1.5,
                }))
            );
            setMatchCount(null);
            networkRef.current?.fit({ animation: { duration: 400, easingFunction: "easeInOutQuad" } });
            return;
        }

        const q = term.toLowerCase();
        const matchIds = [];

        allNodesData.update(rawNodes.map(n => {
            const label = (n.label || "").toLowerCase();
            const ip = (n.ipAddress || "").toLowerCase();
            const vendor = (n.vendor || "").toLowerCase();
            const model = (n.model || "").toLowerCase();
            const isMatch = label.includes(q) || ip.includes(q) || vendor.includes(q) || model.includes(q);
            if (isMatch) matchIds.push(`sw-${n.id}`);
            return {
                id: `sw-${n.id}`,
                color: isMatch
                    ? { background: "#fef08a", border: "#f59e0b", highlight: { background: "#fef08a", border: "#f59e0b" }, hover: { background: "#fef08a", border: "#f59e0b" } }
                    : { ...getNodeColor(n) },
                opacity: isMatch ? 1 : 0.2,
                borderWidth: isMatch ? 3 : 1,
            };
        }));

        allNodesData.update(
            portMap.filter(d => d.connectedSwitchId != null).map(d => {
                const hostname = (d.hostname || "").toLowerCase();
                const port = (d.connectedPort || "").toLowerCase();
                const status = (d.status || "").toLowerCase();
                const isMatch = hostname.includes(q) || port.includes(q) || status.includes(q);
                if (isMatch) matchIds.push(`dev-${d.hostname}`);
                const baseColor = d.status === "Offline"
                    ? { background: "#fee2e2", border: "#ef4444", highlight: { background: "#fef9c3", border: "#f59e0b" }, hover: { background: "#fef9c3", border: "#f59e0b" } }
                    : { background: "#fef9c3", border: "#f59e0b", highlight: { background: "#dbeafe", border: "#3b82f6" }, hover: { background: "#dbeafe", border: "#3b82f6" } };
                return {
                    id: `dev-${d.hostname}`,
                    color: isMatch
                        ? { background: "#fef08a", border: "#f59e0b", highlight: { background: "#fef08a", border: "#f59e0b" }, hover: { background: "#fef08a", border: "#f59e0b" } }
                        : baseColor,
                    opacity: isMatch ? 1 : 0.2,
                    borderWidth: isMatch ? 3 : 1,
                };
            })
        );

        setMatchCount(matchIds.length);

        if (matchIds.length > 0) {
            networkRef.current?.selectNodes(matchIds);
            networkRef.current?.fit({
                nodes: matchIds,
                animation: { duration: 500, easingFunction: "easeInOutQuad" }
            });
        }
    }, [topology, portMap]);

    useEffect(() => {
        if (!topology || !containerRef.current) return;

        networkRef.current?.destroy();
        networkRef.current = null;
        nodesDataRef.current = null;

        const { nodes: rawNodes } = topology;
        if (!rawNodes?.length) return;

        const switchNodes = rawNodes.map(n => ({
            id: `sw-${n.id}`,
            label: `${n.label}\n${n.ipAddress}`,
            color: getNodeColor(n),
            font: { color: "#1e293b", size: 13, face: "Inter, sans-serif", multi: true },
            shape: n.switchLayer === "L3" ? "diamond" : "box",
            borderWidth: 2,
            size: 28,
            shadow: { enabled: true, color: "rgba(0,0,0,0.08)", size: 6 },
            title: createSwitchTooltip(n),
            _switchId: n.id,
            _type: "switch",
        }));

        const createTooltip = (d) => {
            const div = document.createElement("div");
            const title = document.createElement("div");
            title.textContent = d.hostname;
            title.style.fontWeight = "600";
            const port = document.createElement("div");
            port.textContent = `Port: ${d.connectedPort || "—"}`;
            const status = document.createElement("div");
            status.textContent = `Status: ${d.status || "—"}`;
            div.appendChild(title);
            div.appendChild(port);
            div.appendChild(status);
            return div;
        };

        const deviceNodes = portMap
            .filter(d => d.connectedSwitchId != null)
            .map(d => ({
                id: `dev-${d.hostname}`,
                label: `${d.hostname || "AP"}\n`,
                color: d.status === "Offline"
                    ? { background: "#fee2e2", border: "#ef4444", highlight: { background: "#fef9c3", border: "#f59e0b" }, hover: { background: "#fef9c3", border: "#f59e0b" } }
                    : { background: "#fef9c3", border: "#f59e0b", highlight: { background: "#dbeafe", border: "#3b82f6" }, hover: { background: "#dbeafe", border: "#3b82f6" } },
                font: { color: "#1e293b", size: 11, face: "Inter, sans-serif", multi: true },
                shape: "ellipse",
                borderWidth: 1.5,
                size: 18,
                title: createTooltip(d),
                _type: "device",
                _switchId: d.connectedSwitchId,
            }));

        const allNodes = new DataSet([...switchNodes, ...deviceNodes]);
        nodesDataRef.current = allNodes;

        const { edges: rawEdges } = topology;
        const switchEdges = (rawEdges ?? []).map(e => {
            const fromNode = rawNodes.find(n => n.id === e.from);
            const toNode = rawNodes.find(n => n.id === e.to);
            const isDown = !fromNode?.isReachable || !toNode?.isReachable;
            return {
                id: `edge-sw-${e.id}`,
                from: `sw-${e.from}`,
                to: `sw-${e.to}`,
                label: isDown ? "✕" : (e.label || ""),
                color: { color: isDown ? "#ef4444" : "#94a3b8", highlight: "#f59e0b", hover: "#f59e0b", opacity: isDown ? 0.6 : 1.0 },
                font: { color: isDown ? "#ef4444" : "#64748b", size: isDown ? 14 : 10, align: "middle", background: "#ffffff", bold: isDown },
                dashes: isDown,
                width: isDown ? 1.5 : 2,
                smooth: { type: "curvedCW", roundness: 0.1 },
                arrows: { to: { enabled: false } },
            };
        });

        const deviceEdges = portMap
            .filter(d => d.connectedSwitchId != null)
            .map(d => ({
                id: `edge-dev-${d.hostname}`,
                from: `dev-${d.hostname}`,
                to: `sw-${d.connectedSwitchId}`,
                label: d.connectedPort
                    ? d.connectedPort.replace(/GigabitEthernet|FastEthernet|TenGigabitEthernet/g,
                        m => ({ GigabitEthernet: "Gi", FastEthernet: "Fa", TenGigabitEthernet: "Te" }[m] ?? m))
                    : "",
                color: { color: "#cbd5e1", highlight: "#f59e0b", hover: "#f59e0b" },
                font: { color: "#94a3b8", size: 9, align: "middle", background: "#ffffff" },
                dashes: [3, 4],
                width: 1,
                smooth: { type: "dynamic" },
                arrows: { to: { enabled: false } },
            }));

        const allEdges = new DataSet([...switchEdges, ...deviceEdges]);

        const options = {
            layout: { improvedLayout: true, hierarchical: { enabled: false } },
            physics: {
                enabled: true,
                solver: "forceAtlas2Based",
                forceAtlas2Based: { gravitationalConstant: -60, centralGravity: 0.005, springLength: 140, springConstant: 0.04, damping: 0.4 },
                stabilization: { enabled: true, iterations: 250, updateInterval: 25 }
            },
            interaction: { hover: true, tooltipDelay: 150, zoomView: true, dragView: true },
            nodes: { borderWidth: 2, borderWidthSelected: 3, margin: { top: 8, right: 10, bottom: 8, left: 10 } },
            edges: { width: 1 }
        };

        networkRef.current = new Network(containerRef.current, { nodes: allNodes, edges: allEdges }, options);

        networkRef.current.on("selectNode", ({ nodes: sel }) => {
            if (!sel[0]) return;
            const node = allNodes.get(sel[0]);
            if (node?._type === "switch") onSelectNodeRef.current(node._switchId);
        });

        networkRef.current.on("stabilizationIterationsDone", () => {
            networkRef.current?.fit({ animation: { duration: 600, easingFunction: "easeInOutQuad" } });
        });

        networkRef.current.on("dragStart", ({ nodes: dn }) => {
            if (!dn.length) return;
            allNodes.update(dn.map(id => ({ id, fixed: { x: false, y: false } })));
        });
        networkRef.current.on("dragEnd", ({ nodes: dn }) => {
            if (!dn.length) return;
            allNodes.update(dn.map(id => ({ id, fixed: { x: true, y: true } })));
        });

        return () => { networkRef.current?.destroy(); networkRef.current = null; nodesDataRef.current = null; };
    }, [topology, portMap]);

    const deviceCount = portMap.filter(d => d.connectedSwitchId != null).length;
    const unmappedCount = portMap.filter(d => d.connectedSwitchId == null).length;

    return (
        <div ref={wrapperRef} style={{ background: "#f8fafc", ...(isFullscreen ? styles.fullscreenWrapper : {}) }}>
            <div style={styles.topoBar}>
                <div style={styles.topoLegend}>
                    <span style={styles.legendItem}>
                        <span style={{ ...styles.legendDot, background: "#dbeafe", border: "2px solid #3b82f6" }} /> Switch
                    </span>
                    <span style={styles.legendItem}>
                        <span style={{ ...styles.legendDot, background: "#fef9c3", border: "2px solid #f59e0b", borderRadius: "50%" }} /> AP online
                    </span>
                    <span style={styles.legendItem}>
                        <span style={{ ...styles.legendDot, background: "#fee2e2", border: "2px solid #ef4444", borderRadius: "50%" }} /> AP offline
                    </span>
                    <span style={styles.legendItem}>◆ = L3 &nbsp; ■ = L2 &nbsp; ● = AP</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 12, color: "#64748b" }}>
                        {topology?.nodes?.length ?? 0} switches · {deviceCount} mapped APs
                        {unmappedCount > 0 && ` · ${unmappedCount} unmapped`}
                    </span>
                    {unmappedCount > 0 && (
                        <span style={styles.topoWarn}>⚠️ {unmappedCount} APs not yet port-resolved</span>
                    )}
                    <button style={styles.btnSm} onClick={handleFullscreen}>
                        {isFullscreen ? "⛶ Exit fullscreen" : "⛶ Fullscreen"}
                    </button>
                </div>
            </div>

            {/* ── Search row ── */}
            <div style={styles.topoSearchRow}>
                <TopologySearchBox
                    onSearch={handleSearch}
                    placeholder="🔍 Search by AP hostname, port, status…"
                />
                {matchCount !== null && (
                    <span style={matchCount > 0 ? styles.matchBadgeFound : styles.matchBadgeNone}>
                        {matchCount > 0 ? `${matchCount} match${matchCount !== 1 ? "es" : ""}` : "No matches"}
                    </span>
                )}
            </div>

            <div
                ref={containerRef}
                style={{ ...styles.topoCanvas, ...(isFullscreen ? styles.fullscreenCanvas : {}) }}
            />

            {!topology?.nodes?.length && (
                <div style={styles.topoEmpty}>No switches found. Run a scan to populate topology.</div>
            )}
        </div>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
    app: { fontFamily: "'Inter', sans-serif", background: "#f8fafc", minHeight: "100vh", color: "#1e293b", padding: 24 },
    header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, background: "#fff", borderRadius: 12, padding: "16px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" },
    title: { margin: 0, fontSize: 24, fontWeight: 700, color: "#1e293b" },
    subtitle: { margin: "4px 0 0", color: "#94a3b8", fontSize: 13 },
    headerRight: { display: "flex", alignItems: "center", gap: 12 },
    btn: { background: "#3b82f6", color: "#fff", border: "none", padding: "8px 18px", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 500, boxShadow: "0 1px 2px rgba(59,130,246,0.3)" },
    btnSm: { background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0", padding: "4px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12 },

    statRow: { display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" },
    statCard: { borderRadius: 12, padding: "16px 20px", textAlign: "center", minWidth: 120, flex: 1, border: "1px solid #e2e8f0" },
    statIcon: { fontSize: 20, marginBottom: 4 },
    statVal: { fontSize: 26, fontWeight: 700 },
    statLabel: { fontSize: 11, color: "#64748b", marginTop: 2 },

    tabBar: { display: "flex", gap: 8, marginBottom: 16 },
    tab: { background: "#fff", color: "#64748b", border: "1px solid #e2e8f0", padding: "8px 18px", borderRadius: 8, cursor: "pointer", fontSize: 14 },
    tabActive: { background: "#3b82f6", color: "#fff", border: "1px solid #3b82f6" },

    filterRow: { display: "flex", gap: 10, marginBottom: 14, alignItems: "center", flexWrap: "wrap" },
    searchInput: { background: "#fff", color: "#1e293b", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 14, flex: 1, minWidth: 240, outline: "none" },
    select: { background: "#fff", color: "#334155", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 10px", fontSize: 14, outline: "none" },

    tableWrap: { overflowX: "auto", borderRadius: 12, border: "1px solid #e2e8f0", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" },
    table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
    th: { background: "#f8fafc", color: "#64748b", fontWeight: 600, padding: "10px 14px", textAlign: "left", borderBottom: "1px solid #e2e8f0", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" },
    tr: { borderBottom: "1px solid #f1f5f9", cursor: "pointer" },
    td: { padding: "10px 14px", color: "#475569", verticalAlign: "middle" },

    badgeL3: { background: "#eff6ff", color: "#1d4ed8", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600 },
    badgeL2: { background: "#f0fdf4", color: "#15803d", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600 },
    badgeFirewall: { background: "#fef2f2", color: "#b91c1c", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600 },
    protocolBadge: { marginLeft: 6, background: "#f1f5f9", color: "#475569", padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 500 },

    loading: { color: "#94a3b8", padding: 40, textAlign: "center", background: "#fff", borderRadius: 12 },

    topoBar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 },
    topoLegend: { display: "flex", gap: 16, flexWrap: "wrap" },
    legendItem: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569" },
    legendDot: { display: "inline-block", width: 14, height: 14, borderRadius: 3 },
    topoCanvas: { height: 620, background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" },
    topoWarn: { fontSize: 12, color: "#b45309", background: "#fef3c7", padding: "3px 10px", borderRadius: 6 },
    topoEmpty: { textAlign: "center", color: "#94a3b8", padding: 40 },
    topoError: { background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 12, padding: 24, color: "#be123c" },

    // ── Topology search ──
    topoSearchRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10 },
    topoSearchWrap: { position: "relative", flex: 1, maxWidth: 420 },
    topoSearchInput: { width: "100%", background: "#fff", color: "#1e293b", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 36px 7px 12px", fontSize: 13, outline: "none", boxSizing: "border-box" },
    topoSearchClear: { position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 13, lineHeight: 1 },
    matchBadgeFound: { fontSize: 12, background: "#fef9c3", color: "#92400e", padding: "3px 10px", borderRadius: 6, border: "1px solid #fde68a", whiteSpace: "nowrap" },
    matchBadgeNone: { fontSize: 12, background: "#fee2e2", color: "#991b1b", padding: "3px 10px", borderRadius: 6, border: "1px solid #fecaca", whiteSpace: "nowrap" },

    drawer: { position: "fixed", top: 0, right: 0, width: 460, height: "100vh", background: "#fff", borderLeft: "1px solid #e2e8f0", boxShadow: "-8px 0 32px rgba(0,0,0,0.1)", overflowY: "auto", padding: 24, zIndex: 100 },
    drawerHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid #f1f5f9" },
    drawerSection: { background: "#f8fafc", borderRadius: 8, padding: 16, marginBottom: 16, border: "1px solid #f1f5f9" },
    drawerSubTitle: { fontSize: 13, fontWeight: 600, color: "#64748b", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" },
    closeBtn: { background: "transparent", border: "none", color: "#94a3b8", fontSize: 22, cursor: "pointer", lineHeight: 1 },
    detailRow: { display: "flex", justifyContent: "space-between", marginBottom: 10, gap: 12 },
    detailLabel: { color: "#94a3b8", fontSize: 12, minWidth: 90 },
    detailValue: { color: "#334155", fontSize: 13, textAlign: "right", fontFamily: "monospace" },
    uplinkRow: { background: "#fff", border: "1px solid #f1f5f9", borderRadius: 8, padding: "10px 12px", marginBottom: 8 },
    portRow: { display: "flex", alignItems: "center", gap: 12, padding: "6px 0", borderBottom: "1px solid #f1f5f9" },
    fullscreenWrapper: { padding: 16, display: "flex", flexDirection: "column", height: "100vh", boxSizing: "border-box" },
    fullscreenCanvas: { flex: 1, height: "auto", minHeight: 0 },
};

// Helper to get node color based on device type and reachability
const getNodeColor = (n) => {
    if (!n.isReachable) return {
        background: "#fee2e2", border: "#ef4444",
        highlight: { background: "#fef9c3", border: "#f59e0b" },
        hover: { background: "#fef9c3", border: "#f59e0b" }
    };
    const label = (n.label || "").toLowerCase();
    const vendor = (n.vendor || "").toLowerCase();
    const isFirewall = label.includes("fw") || label.includes("firewall") ||
        label.includes("asa") || label.includes("ftd") ||
        label.includes("fortigate") || label.includes("fortiswitch") ||
        vendor.includes("fortinet") || vendor.includes("palo") ||
        vendor.includes("fortigate");
    if (isFirewall) return {
        background: "#fdf4ff", border: "#a855f7",
        highlight: { background: "#fef9c3", border: "#f59e0b" },
        hover: { background: "#fef9c3", border: "#f59e0b" }
    };
    if (n.vendor === "Cisco") return {
        background: "#dbeafe", border: "#3b82f6",
        highlight: { background: "#fef9c3", border: "#f59e0b" },
        hover: { background: "#fef9c3", border: "#f59e0b" }
    };
    return {
        background: "#dcfce7", border: "#22c55e",
        highlight: { background: "#fef9c3", border: "#f59e0b" },
        hover: { background: "#fef9c3", border: "#f59e0b" }
    };
};