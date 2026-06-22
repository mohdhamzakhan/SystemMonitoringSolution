// FolderTreePage.jsx
import { useState, useEffect, useRef } from "react";
import { APP_CONSTANTS } from "../store";
import Navbar from "./Navbar";

const STATUS_COLORS = {
  online: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
  connected: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
  disconnected: "bg-rose-50 text-rose-500 ring-1 ring-rose-200",
  default: "bg-gray-100 text-gray-500 ring-1 ring-gray-200",
};

function statusClass(status) {
  const key = status?.toLowerCase();
  return STATUS_COLORS[key] || STATUS_COLORS.default;
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusClass(status)}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        ["online","connected"].includes(status?.toLowerCase()) ? "bg-emerald-500" : "bg-rose-400"
      }`} />
      {status || "Unknown"}
    </span>
  );
}

function FolderIcon({ open, isLeaf }) {
  if (isLeaf) return (
    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
  return open ? (
    <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
      <path d="M2 6a2 2 0 012-2h5l2 2h9a2 2 0 012 2v1H2V6z" />
      <path d="M2 10v9a2 2 0 002 2h16a2 2 0 002-2V10H2z" />
    </svg>
  ) : (
    <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
      <path d="M2 6a2 2 0 012-2h5l2 2h9a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
    </svg>
  );
}

function ServerIcon() {
  return (
    <svg className="w-4 h-4 text-violet-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
    </svg>
  );
}

function ChevronIcon({ expanded }) {
  return (
    <svg
      className={`w-3 h-3 text-gray-400 flex-shrink-0 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin w-3 h-3 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

const isServerNode = (node) => !node.fullPath?.slice(2).includes("\\");

function TreeNode({ node, onSelect, selectedPath, level = 0 }) {
  const [expanded, setExpanded] = useState(level === 0);
  const [children, setChildren] = useState(node.children || []);
  const [loadedChildren, setLoadedChildren] = useState(node.children?.length > 0);
  const [loading, setLoading] = useState(false);

  const isSelected = node.fullPath === selectedPath;
  const canExpand = node.hasChildren || children.length > 0;
  const isServer = isServerNode(node);

  const toggleExpand = async () => {
    if (!expanded && canExpand && !loadedChildren) {
      setLoading(true);
      try {
        const res = await fetch(
          `${APP_CONSTANTS.API_BASE_URL}/api/FolderTree/children?path=${encodeURIComponent(node.fullPath)}`
        );
        const data = await res.json();
        setChildren(data);
        setLoadedChildren(true);
      } finally {
        setLoading(false);
      }
    }
    setExpanded((e) => !e);
  };

  return (
    <div>
      <div
        onClick={() => { toggleExpand(); if (!isServer) onSelect(node); }}
        className={`group flex items-center gap-1.5 rounded-lg cursor-pointer text-sm transition-all duration-100 select-none
          ${isSelected
            ? "bg-blue-50 text-blue-700 font-medium shadow-[inset_2px_0_0_#3b82f6]"
            : isServer
              ? "text-violet-700 font-semibold hover:bg-violet-50"
              : "text-gray-700 hover:bg-gray-50"
          }`}
        style={{ paddingLeft: `${level * 14 + 8}px`, paddingTop: 5, paddingBottom: 5, paddingRight: 8 }}
      >
        {canExpand
          ? loading ? <Spinner /> : <ChevronIcon expanded={expanded} />
          : <span className="w-3 h-3 flex-shrink-0" />
        }
        {isServer ? <ServerIcon /> : <FolderIcon open={expanded} isLeaf={!canExpand} />}
        <span className="truncate leading-snug">{node.name}</span>
        {node.error && <span className="text-rose-400 text-xs ml-auto">!</span>}
      </div>

      {expanded && children.length > 0 && (
        <div className="border-l border-gray-100 ml-[18px]">
          {children.map((child, i) => (
            <TreeNode key={i} node={child} onSelect={onSelect} selectedPath={selectedPath} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-16 px-6">
      <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3 text-2xl">{icon}</div>
      <p className="text-sm font-medium text-gray-600">{title}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1 max-w-xs">{subtitle}</p>}
    </div>
  );
}

function CapacityBar({ capacity, freeSpace }) {
  const used = capacity - freeSpace;
  const pct = capacity > 0 ? Math.round((used / capacity) * 100) : 0;
  const color = pct > 85 ? "bg-rose-400" : pct > 60 ? "bg-amber-400" : "bg-emerald-400";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 tabular-nums">{pct}%</span>
    </div>
  );
}

export default function FolderTreePage() {
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [hosts, setHosts] = useState([]);
  const [hostsLoading, setHostsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    const fetchRoots = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${APP_CONSTANTS.API_BASE_URL}/api/FolderTree/roots`);
        const data = await res.json();
        setTree(data);
      } finally {
        setLoading(false);
      }
    };
    fetchRoots();
  }, []);

  const handleSelectFolder = async (node) => {
    setSelectedFolder(node);
    setHostsLoading(true);
    setSearchResults(null);
    try {
      const res = await fetch(
        `${APP_CONSTANTS.API_BASE_URL}/api/FolderTree/hosts?path=${encodeURIComponent(node.fullPath)}`
      );
      const data = await res.json();
      setHosts(data);
    } finally {
      setHostsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `${APP_CONSTANTS.API_BASE_URL}/api/FolderTree/search?term=${encodeURIComponent(searchTerm)}`
      );
      const data = await res.json();
      setSearchResults(data);
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchResults(null);
    setSearchTerm("");
    searchRef.current?.focus();
  };

  const totalResults = (searchResults?.byPathOrHost?.length || 0) + (searchResults?.relatedFolders?.length || 0);

  return (
    <>
    <Navbar/>
    <div className="flex flex-col h-screen bg-[#f8f9fb] font-sans">

      {/* ── Top bar ── */}
      <header className="flex-shrink-0 bg-white border-b border-gray-200 px-5 py-3 flex items-center gap-3 shadow-sm">
        <div className="flex items-center gap-2 mr-4">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-gray-800">File Server Access</span>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-lg flex items-center gap-2">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
              fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
            <input
              ref={searchRef}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search hostname, user, or folder path…"
              className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm placeholder-gray-400
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || !searchTerm.trim()}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700
                       disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            {searching ? "Searching…" : "Search"}
          </button>
          {searchResults && (
            <button onClick={clearSearch}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
              Clear
            </button>
          )}
        </div>
      </header>

      {/* ── Search results panel ── */}
      {searchResults && (
        <div className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm">
          <div className="px-5 py-2.5 flex items-center gap-2 border-b border-gray-100">
            <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-sm font-semibold text-gray-700">
              {totalResults > 0 ? `${totalResults} result${totalResults !== 1 ? "s" : ""} for "${searchTerm}"` : `No results for "${searchTerm}"`}
            </span>
          </div>

          {totalResults === 0 ? (
            <div className="px-5 py-4 text-sm text-gray-400">
              Try a different hostname, username, or folder name.
            </div>
          ) : (
            <div className="max-h-56 overflow-auto divide-y divide-gray-50">
              {[
                { label: "By hostname or path", data: searchResults.byPathOrHost },
                { label: "By mapped user", data: searchResults.relatedFolders },
              ].map(({ label, data }) =>
                data?.length > 0 ? (
                  <div key={label} className="px-5 py-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{label}</p>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-400 text-left">
                          <th className="pb-1.5 font-medium pr-4">Hostname</th>
                          <th className="pb-1.5 font-medium pr-4">Username</th>
                          <th className="pb-1.5 font-medium pr-4">Department</th>
                          <th className="pb-1.5 font-medium pr-4">Status</th>
                          <th className="pb-1.5 font-medium">Mapped Path</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {data.map((m, i) => (
                          <tr key={i} className="hover:bg-gray-50 group">
                            <td className="py-1.5 pr-4 font-medium text-gray-800">{m.hostname}</td>
                            <td className="py-1.5 pr-4 text-gray-600">{m.username || "—"}</td>
                            <td className="py-1.5 pr-4 text-gray-500">{m.department || "—"}</td>
                            <td className="py-1.5 pr-4"><StatusBadge status={m.status} /></td>
                            <td className="py-1.5 font-mono text-gray-400 text-[11px]">{m.diskName}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Main split ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: folder tree */}
        <aside className="w-72 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Folders</span>
            {loading && <Spinner />}
          </div>
          <div className="flex-1 overflow-auto py-1 px-2">
            {loading ? (
              <div className="flex flex-col gap-1.5 mt-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-6 bg-gray-100 rounded animate-pulse" style={{ width: `${70 + (i % 3) * 10}%`, marginLeft: `${(i % 2) * 12}px` }} />
                ))}
              </div>
            ) : tree.length === 0 ? (
              <EmptyState icon="🗄️" title="No file servers found" subtitle="No network drives are recorded in the database." />
            ) : (
              tree.map((rootNode, i) => (
                <TreeNode key={i} node={rootNode} onSelect={handleSelectFolder} selectedPath={selectedFolder?.fullPath} />
              ))
            )}
          </div>
        </aside>

        {/* Right: host details */}
        <main className="flex-1 overflow-auto bg-[#f8f9fb]">
          {/* Right header */}
          <div className="sticky top-0 z-10 bg-[#f8f9fb] border-b border-gray-200 px-6 py-3 flex items-center gap-3">
            {selectedFolder ? (
              <>
                <FolderIcon open />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {selectedFolder.name}
                  </p>
                  <p className="text-xs text-gray-400 font-mono truncate">{selectedFolder.fullPath}</p>
                </div>
                {!hostsLoading && (
                  <span className="ml-auto flex-shrink-0 text-xs text-gray-400 bg-white border border-gray-200 px-2.5 py-1 rounded-full">
                    {hosts.length} host{hosts.length !== 1 ? "s" : ""}
                  </span>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-400">Select a folder to see which hosts have access</p>
            )}
          </div>

          <div className="p-6">
            {hostsLoading && (
              <div className="flex flex-col gap-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-12 bg-white rounded-xl border border-gray-100 animate-pulse" />
                ))}
              </div>
            )}

            {!hostsLoading && !selectedFolder && (
              <EmptyState
                icon="📂"
                title="No folder selected"
                subtitle="Click any folder in the tree on the left to see which hosts have that path mapped."
              />
            )}

            {!hostsLoading && selectedFolder && hosts.length === 0 && (
              <EmptyState
                icon="🔍"
                title="No hosts found"
                subtitle="No hosts have this specific folder mapped as a network drive."
              />
            )}

            {!hostsLoading && hosts.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-gray-100 bg-gray-50">
                      <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Hostname</th>
                      <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">User</th>
                      <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Department</th>
                      <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                      <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Mapped Path</th>
                      <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Usage</th>
                      <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Free / Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {hosts.map((h, i) => (
                      <tr key={i} className="hover:bg-blue-50/40 transition-colors group">
                        <td className="px-5 py-3">
                          <span className="font-mono text-xs font-semibold text-gray-800 bg-gray-100 px-2 py-0.5 rounded">
                            {h.hostname}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-700">{h.username || "—"}</td>
                        <td className="px-5 py-3">
                          {h.department ? (
                            <span className="text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full font-medium">
                              {h.department}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-5 py-3"><StatusBadge status={h.status} /></td>
                        <td className="px-5 py-3 max-w-xs">
                          <span className="font-mono text-[11px] text-gray-400 break-all leading-relaxed">
                            {h.diskName || h.mappedPath}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <CapacityBar capacity={h.capacity} freeSpace={h.freeSpace} />
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-xs text-gray-500">
                          <span className="text-gray-800 font-medium">{h.freeSpace?.toFixed(1)}</span>
                          <span className="text-gray-400"> / {h.capacity?.toFixed(1)} GB</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-100 text-xs text-gray-400 flex items-center justify-between">
                  <span>{hosts.length} host{hosts.length !== 1 ? "s" : ""} with access to this path</span>
                  <span className="font-mono">{selectedFolder?.fullPath}</span>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
    </>
  );
}