import React, { useEffect, useState, useCallback } from "react";
import {
    Search, Download, ChevronLeft, ChevronRight, RefreshCw,
    ArrowUp, ArrowDown, FileText, Monitor, X, Filter
} from "lucide-react";
import Navbar from "./Navbar";
import { APP_CONSTANTS } from "../store";
import { getToken } from "../auth";

/* ═══════════════════════════════════════════
   TYPES
═══════════════════════════════════════════ */

interface ClassificationEvent {
    id: number;
    hostname: string;
    username: string;
    application: string; // Word | Excel | PowerPoint | File
    documentName: string;
    documentPath: string | null;
    documentGuid: string | null;
    actionType: string; // Created | OpenedUnclassified | ConfirmedOnClose | ChangedOnClose
    previousClassification: string | null;
    classification: string; // TopSecret | Secret | Confidential | Public
    eventTime: string;
}

interface FilterOptions {
    applications: string[];
    classifications: string[];
    actionTypes: string[];
}

interface HistoryResponse {
    totalCount: number;
    page: number;
    pageSize: number;
    totalPages: number;
    results: ClassificationEvent[];
}

/* ═══════════════════════════════════════════
   CONSTANTS & HELPERS
═══════════════════════════════════════════ */

const API_BASE = `${APP_CONSTANTS.API_BASE_URL}/api/documentclassification`;
const ACCENT = "#3b82f6";
const PAGE_SIZE = 50;

const getClassificationBadge = (level: string | null): React.CSSProperties => {
    const map: Record<string, React.CSSProperties> = {
        TopSecret: { background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" },
        Secret: { background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa" },
        Confidential: { background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" },
        Public: { background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0" },
    };
    return map[level ?? ""] ?? { background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0" };
};

const formatClassificationLabel = (level: string) =>
    level === "TopSecret" ? "Top Secret" : level;

const formatActionLabel = (action: string): string => ({
    Created: "Created",
    OpenedUnclassified: "Classified on open",
    ConfirmedOnClose: "Confirmed on close",
    ChangedOnClose: "Changed on close",
}[action] ?? action);

const getActionColor = (action: string): string => ({
    Created: "#1d4ed8",
    OpenedUnclassified: "#c2410c",
    ConfirmedOnClose: "#64748b",
    ChangedOnClose: "#c2410c",
}[action] ?? "#334155");

const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
        year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit",
    });

const authHeaders = (): Record<string, string> => {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
};

/* ═══════════════════════════════════════════
   SHARED STYLES
═══════════════════════════════════════════ */

const thS: React.CSSProperties = {
    padding: "10px 16px", textAlign: "left", fontSize: "10px", fontWeight: 600,
    color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase",
    fontFamily: "'DM Mono', monospace", background: "#f8fafc",
    borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap",
};

const inputStyle: React.CSSProperties = {
    width: "100%", padding: "7px 10px", borderRadius: "8px", border: "1px solid #e2e8f0",
    fontSize: "12px", fontFamily: "'DM Mono', monospace", color: "#334155", background: "#fff",
};

const labelStyle: React.CSSProperties = {
    fontSize: "10px", fontWeight: 600, color: "#94a3b8", letterSpacing: "0.06em",
    textTransform: "uppercase", marginBottom: "5px", display: "block",
};

const pageButtonStyle = (active: boolean, disabled: boolean): React.CSSProperties => ({
    width: "28px", height: "28px", borderRadius: "6px", border: "1px solid",
    fontFamily: "'DM Mono', monospace", fontSize: "11px", fontWeight: 500,
    cursor: disabled ? "default" : "pointer", transition: "all 0.12s",
    borderColor: active ? ACCENT : "#e2e8f0",
    background: active ? ACCENT : "#fff",
    color: active ? "#fff" : disabled ? "#cbd5e1" : "#64748b",
});

/* ═══════════════════════════════════════════
   COMPONENT
═══════════════════════════════════════════ */

const DocumentClassificationDashboard: React.FC = () => {
    const [filters, setFilters] = useState({
        username: "", hostname: "", documentName: "", application: "",
        classification: "", actionType: "", fromDate: "", toDate: "",
    });
    const [appliedFilters, setAppliedFilters] = useState(filters);
    const [page, setPage] = useState(1);

    const [data, setData] = useState<HistoryResponse | null>(null);
    const [filterOptions, setFilterOptions] = useState<FilterOptions>({ applications: [], classifications: [], actionTypes: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filter dropdowns reflect whatever values actually exist in the DB, not a
    // hardcoded guess, so they never drift out of sync with real data.
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/filter-options`, { headers: authHeaders() });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = await res.json();
                setFilterOptions(json);
            } catch {
                // dropdowns just stay empty (still usable via free-text fields) if this fails
            }
        })();
    }, []);

    const fetchHistory = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            Object.entries(appliedFilters).forEach(([key, value]) => {
                if (value) params.set(key, value);
            });
            params.set("page", String(page));
            params.set("pageSize", String(PAGE_SIZE));

            const res = await fetch(`${API_BASE}/history?${params.toString()}`, { headers: authHeaders() });
            if (!res.ok) throw new Error("Request failed");
            const json = await res.json();

            // Guards against a stale/un-redeployed API still returning the old bare-array
            // shape instead of { totalCount, page, pageSize, totalPages, results } — this
            // is what previously crashed the render on data.totalCount.toLocaleString().
            if (Array.isArray(json)) {
                throw new Error("API returned an unpaginated response — redeploy the updated DocumentClassificationController.");
            }

            setData(json as HistoryResponse);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't load classification history. Check that SystemMonitorAPI is reachable.");
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [appliedFilters, page]);

    useEffect(() => { fetchHistory(); }, [fetchHistory]);

    const applyFilters = () => {
        setAppliedFilters(filters);
        setPage(1);
    };

    const clearFilters = () => {
        const empty = { username: "", hostname: "", documentName: "", application: "", classification: "", actionType: "", fromDate: "", toDate: "" };
        setFilters(empty);
        setAppliedFilters(empty);
        setPage(1);
    };

    const exportCsv = () => {
        if (!data?.results.length) return;
        const headers = ["EventTime", "Username", "Hostname", "Application", "DocumentName", "DocumentPath", "ActionType", "PreviousClassification", "Classification"];
        const rows = data.results.map(r => headers.map(h => {
            const key = (h.charAt(0).toLowerCase() + h.slice(1)) as keyof ClassificationEvent;
            return `"${String(r[key] ?? "").replace(/"/g, '""')}"`;
        }).join(","));
        const csv = [headers.join(","), ...rows].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `document-classification-audit-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
    };

    const updateFilter = (key: keyof typeof filters, value: string) =>
        setFilters(prev => ({ ...prev, [key]: value }));

    return (
        <div style={{ background: "#f8fafc", minHeight: "100vh" }}>
            <Navbar />

            <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "24px 28px 48px" }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                    <div>
                        <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "20px", fontWeight: 700, color: "#0f172a", margin: "0 0 2px", letterSpacing: "-0.01em" }}>
                            Document Classification Audit
                        </h1>
                        <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0, fontFamily: "'DM Mono', monospace" }}>
                            Word, Excel, PowerPoint, and monitored file classification events
                        </p>
                    </div>
                    <button onClick={fetchHistory}
                        style={{ display: "flex", alignItems: "center", gap: "6px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "8px 14px", fontSize: "12px", fontWeight: 500, color: "#475569", cursor: "pointer" }}>
                        <RefreshCw size={13} /> Refresh
                    </button>
                </div>

                {/* Filters panel */}
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "18px 20px", marginBottom: "18px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "14px", color: "#94a3b8" }}>
                        <Filter size={13} />
                        <span style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace" }}>Filters</span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "14px" }}>
                        <div>
                            <label style={labelStyle}>Username</label>
                            <input style={inputStyle} placeholder="e.g. jsmith" value={filters.username}
                                onChange={e => updateFilter("username", e.target.value)} />
                        </div>
                        <div>
                            <label style={labelStyle}>Hostname</label>
                            <input style={inputStyle} placeholder="e.g. MEAI-LT-2201" value={filters.hostname}
                                onChange={e => updateFilter("hostname", e.target.value)} />
                        </div>
                        <div>
                            <label style={labelStyle}>File name</label>
                            <input style={inputStyle} placeholder="e.g. budget.xlsx" value={filters.documentName}
                                onChange={e => updateFilter("documentName", e.target.value)} />
                        </div>
                        <div>
                            <label style={labelStyle}>Application</label>
                            <select style={inputStyle} value={filters.application} onChange={e => updateFilter("application", e.target.value)}>
                                <option value="">All</option>
                                {filterOptions.applications.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Classification</label>
                            <select style={inputStyle} value={filters.classification} onChange={e => updateFilter("classification", e.target.value)}>
                                <option value="">All</option>
                                {filterOptions.classifications.map(c => <option key={c} value={c}>{formatClassificationLabel(c)}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Event type</label>
                            <select style={inputStyle} value={filters.actionType} onChange={e => updateFilter("actionType", e.target.value)}>
                                <option value="">All</option>
                                {filterOptions.actionTypes.map(a => <option key={a} value={a}>{formatActionLabel(a)}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>From date</label>
                            <input type="date" style={inputStyle} value={filters.fromDate} onChange={e => updateFilter("fromDate", e.target.value)} />
                        </div>
                        <div>
                            <label style={labelStyle}>To date</label>
                            <input type="date" style={inputStyle} value={filters.toDate} onChange={e => updateFilter("toDate", e.target.value)} />
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
                        <button onClick={applyFilters}
                            style={{ display: "flex", alignItems: "center", gap: "6px", background: ACCENT, color: "#fff", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                            <Search size={13} /> Apply filters
                        </button>
                        <button onClick={clearFilters}
                            style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "8px 16px", fontSize: "12px", fontWeight: 500, color: "#64748b", cursor: "pointer" }}>
                            Clear
                        </button>
                    </div>
                </div>

                {/* Result count + export */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <span style={{ fontSize: "12px", color: "#94a3b8", fontFamily: "'DM Mono', monospace" }}>
                        {loading
                            ? "Loading…"
                            : data
                                ? `${(data.totalCount ?? 0).toLocaleString()} event${data.totalCount === 1 ? "" : "s"}`
                                : "—"}
                    </span>
                    <button onClick={exportCsv} disabled={!data?.results?.length}
                        style={{ display: "flex", alignItems: "center", gap: "6px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "7px 14px", fontSize: "12px", fontWeight: 500, color: data?.results?.length ? "#475569" : "#cbd5e1", cursor: data?.results?.length ? "pointer" : "default" }}>
                        <Download size={13} /> Export CSV
                    </button>
                </div>

                {error && (
                    <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: "8px", padding: "12px 16px", fontSize: "13px", marginBottom: "14px" }}>
                        {error}
                    </div>
                )}

                {/* Table */}
                <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
                    {!loading && data && data.results.length === 0 ? (
                        <div style={{ padding: "48px 20px", textAlign: "center", color: "#94a3b8" }}>
                            <FileText size={22} style={{ marginBottom: "8px", color: "#cbd5e1" }} />
                            <div style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>No events match these filters</div>
                            <div style={{ fontSize: "12px", marginTop: "2px" }}>Try widening the date range or clearing a filter.</div>
                        </div>
                    ) : (
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr>
                                    <th style={thS}>Time</th>
                                    <th style={thS}>User</th>
                                    <th style={thS}>Host</th>
                                    <th style={thS}>App</th>
                                    <th style={thS}>File</th>
                                    <th style={thS}>Event</th>
                                    <th style={thS}>Classification</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(data?.results ?? []).map(r => (
                                    <tr key={r.id}
                                        style={{ borderBottom: "1px solid #f8fafc", transition: "background 0.1s" }}
                                        onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                                        onMouseLeave={e => (e.currentTarget.style.background = "")}>
                                        <td style={{ padding: "11px 16px", fontSize: "12px", color: "#334155", fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap" }}>
                                            {formatDate(r.eventTime)}
                                        </td>
                                        <td style={{ padding: "11px 16px", fontSize: "12px", color: "#334155" }}>{r.username}</td>
                                        <td style={{ padding: "11px 16px" }}>
                                            <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "#334155", fontFamily: "'DM Mono', monospace" }}>
                                                <Monitor size={11} color="#94a3b8" />{r.hostname}
                                            </span>
                                        </td>
                                        <td style={{ padding: "11px 16px", fontSize: "12px", color: "#334155" }}>{r.application}</td>
                                        <td style={{ padding: "11px 16px" }}>
                                            <div style={{ fontSize: "12px", color: "#334155", fontWeight: 500 }}>{r.documentName}</div>
                                            {r.documentPath && (
                                                <div style={{ fontSize: "10.5px", color: "#94a3b8", fontFamily: "'DM Mono', monospace", maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                    {r.documentPath}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: "11px 16px", fontSize: "12px", fontWeight: 600, color: getActionColor(r.actionType) }}>
                                            {formatActionLabel(r.actionType)}
                                        </td>
                                        <td style={{ padding: "11px 16px" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                                {r.previousClassification && r.previousClassification !== r.classification && (
                                                    <>
                                                        <span style={{ ...getClassificationBadge(r.previousClassification), padding: "2px 9px", borderRadius: "20px", fontSize: "10px", fontWeight: 700, fontFamily: "'DM Mono', monospace", opacity: 0.55 }}>
                                                            {formatClassificationLabel(r.previousClassification)}
                                                        </span>
                                                        <ArrowUp size={9} style={{ transform: "rotate(90deg)", color: "#cbd5e1" }} />
                                                    </>
                                                )}
                                                <span style={{ ...getClassificationBadge(r.classification), padding: "2px 9px", borderRadius: "20px", fontSize: "10px", fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>
                                                    {formatClassificationLabel(r.classification)}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination */}
                {data && data.totalPages > 1 && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "14px" }}>
                        <span style={{ fontSize: "11px", color: "#94a3b8", fontFamily: "'DM Mono', monospace" }}>
                            Page {data.page} of {data.totalPages}
                        </span>
                        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} aria-label="Previous page"
                                style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "4px 7px", cursor: page === 1 ? "default" : "pointer", display: "flex", color: page === 1 ? "#cbd5e1" : "#475569" }}>
                                <ChevronLeft size={13} />
                            </button>
                            {Array.from({ length: Math.min(5, data.totalPages) }, (_, i) => {
                                const pg = data.totalPages <= 5 ? i + 1 : Math.max(1, page - 2) + i;
                                if (pg > data.totalPages) return null;
                                return (
                                    <button key={pg} onClick={() => setPage(pg)} style={pageButtonStyle(page === pg, false)}>
                                        {pg}
                                    </button>
                                );
                            })}
                            <button onClick={() => setPage(p => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages} aria-label="Next page"
                                style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "4px 7px", cursor: page === data.totalPages ? "default" : "pointer", display: "flex", color: page === data.totalPages ? "#cbd5e1" : "#475569" }}>
                                <ChevronRight size={13} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DocumentClassificationDashboard;