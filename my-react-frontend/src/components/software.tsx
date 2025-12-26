import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  ChevronRight,
  AlertCircle,
  Loader,
  Package
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
  hostname: string;
  username: string;
  softwareName: string;
  version: string;
  publisher: string;
}

interface GroupedSoftware {
  key: string;
  softwareName: string;
  version: string;
  publisher: string;
  installations: { hostname: string; username: string }[];
}

/* ================= COMPONENT ================= */

const SoftwareDashboard = () => {
  useAuth();

  const [softwareData, setSoftwareData] = useState<FlattenedSoftware[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 👉 Ref for right panel scroll control
  const rightPanelRef = useRef<HTMLDivElement | null>(null);

  /* ================= FETCH ================= */

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `${APP_CONSTANTS.API_BASE_URL}/api/devices/software`
        );

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();

        const flattened: FlattenedSoftware[] = data.$values.flatMap(
          (device: Device) =>
            device.softwareDetails.$values.map(
              (s: SoftwareDetails) => ({
                hostname: device.hostname,
                username: device.username,
                softwareName: s.softwareName,
                version: s.version,
                publisher: s.publisher
              })
            )
        );

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
        !s.hostname.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return;
      }

      const key = `${s.softwareName}__${s.version}__${s.publisher}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          softwareName: s.softwareName,
          version: s.version,
          publisher: s.publisher,
          installations: []
        });
      }

      map.get(key)!.installations.push({
        hostname: s.hostname,
        username: s.username
      });
    });

    return Array.from(map.values()).sort(
      (a, b) => b.installations.length - a.installations.length
    );
  }, [softwareData, searchTerm]);

  const selectedSoftware = groupedSoftware.find(
    (s) => s.key === selectedKey
  );

  const groupedInstallations = useMemo(() => {
  if (!selectedSoftware) return [];

  const map = new Map<string, {
    hostname: string;
    username: string;
    count: number;
  }>();

  selectedSoftware.installations.forEach((inst) => {
    const key = `${inst.hostname}__${inst.username}`;

    if (!map.has(key)) {
      map.set(key, {
        hostname: inst.hostname,
        username: inst.username,
        count: 0
      });
    }

    map.get(key)!.count += 1;
  });

  return Array.from(map.values());
}, [selectedSoftware]);


  /* ================= AUTO SCROLL RIGHT PANEL ================= */

  useEffect(() => {
    if (rightPanelRef.current) {
      rightPanelRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [selectedKey]);

  /* ================= LOADING ================= */

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="h-screen flex items-center justify-center text-gray-600">
          <Loader className="h-6 w-6 animate-spin mr-2" />
          Loading software inventory…
        </div>
      </>
    );
  }

  /* ================= ERROR ================= */

  if (error) {
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
  }

  /* ================= UI ================= */

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Software Inventory
            </h1>
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

          {/* ================= MASTER–DETAIL ================= */}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* LEFT PANEL */}
            <div className="space-y-3 h-[calc(100vh-260px)] overflow-y-auto">
              {groupedSoftware.map((s) => {
                const active = s.key === selectedKey;

                return (
                  <button
                    key={s.key}
                    onClick={() => setSelectedKey(s.key)}
                    className={`
                      w-full text-left rounded-xl p-4 border
                      transition-all
                      ${
                        active
                          ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
                          : "bg-white hover:bg-gray-50 border-gray-200"
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-sm">
                          {s.softwareName}
                        </h3>
                        <p
                          className={`mt-1 text-xs ${
                            active ? "text-blue-100" : "text-gray-500"
                          }`}
                        >
                          {s.version || "—"} • {s.publisher || "Unknown"}
                        </p>
                      </div>

                      <ChevronRight
                        className={`h-4 w-4 ${
                          active ? "text-white" : "text-gray-400"
                        }`}
                      />
                    </div>

                    <div className="mt-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          active
                            ? "bg-white/20"
                            : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {s.installations.length} installs
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* RIGHT PANEL */}
            <div
              ref={rightPanelRef}
              className="lg:col-span-2 h-[calc(100vh-260px)] overflow-y-auto"
            >
              {selectedSoftware ? (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                  {/* Header */}
                  <div className="px-6 py-4 border-b flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-3">
                        {selectedSoftware.softwareName}

                        {/* ✅ Show count ONLY if multiple */}
                        {selectedSoftware.installations.length > 1 && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                            {selectedSoftware.installations.length}
                          </span>
                        )}
                      </h2>

                      <p className="text-sm text-gray-500 mt-1">
                        {selectedSoftware.installations.length === 1
                          ? "Installed on 1 device"
                          : "Installed on multiple devices"}
                      </p>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
  <thead className="bg-gray-50 border-b">
    <tr>
      <th className="px-6 py-3 text-center font-semibold text-gray-600">
        Hostname
      </th>
      <th className="px-6 py-3 text-center font-semibold text-gray-600">
        Username
      </th>
      <th className="px-6 py-3 text-center font-semibold text-gray-600">
        Count
      </th>
    </tr>
  </thead>

  <tbody className="divide-y">
    {groupedInstallations.map((row, idx) => (
      <tr key={idx} className="hover:bg-blue-50/40">
        <td className="px-6 py-3 text-center">
          <a
            href={`/device/${row.hostname}`}
            className="text-blue-600 font-medium hover:underline"
          >
            {row.hostname}
          </a>
        </td>

        <td className="px-6 py-3 text-center">
          {row.username}
        </td>

        <td className="px-6 py-3 text-center">
          <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
            {row.count}
          </span>
        </td>
      </tr>
    ))}
  </tbody>
</table>

                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 border border-dashed rounded-xl p-12">
                  <Package className="h-6 w-6 mr-2" />
                  Select a software to view details
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SoftwareDashboard;
