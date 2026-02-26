import React, { useState, useEffect } from "react";
import axios from "axios";
import { APP_CONSTANTS } from "../store";
import * as XLSX from "xlsx";
import Navbar from "./Navbar";
import useAuth from "./useAuth";
import {
  Search,
  Download,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  Calendar,
  AlertCircle,
  FileText,
  ArrowUpDown,
  Shield,
  Monitor,
  User,
  Building2,
  HardDrive,
  Cpu,
  RefreshCw,
   ShieldAlert
} from "lucide-react";

const SystemReport = () => {
  useAuth();
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Search & Filters
  const [globalSearch, setGlobalSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    hostname: "",
    username: "",
    department: "",
    make: "",
    model: "",
    osName: "",
    encryptionStatus: "",
    warrantyPeriod: "",
  });
  

  // Sorting
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  // Financial Year Filter
  const [financialYearFilter, setFinancialYearFilter] = useState("all");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    applyFiltersAndSort();
  }, [data, globalSearch, filters, sortConfig, financialYearFilter]);

  const fetchData = () => {
    setLoading(true);
    axios
      .get(`${APP_CONSTANTS.API_BASE_URL}/api/SystemInfo/filter`)
      .then((response) => {
        const result = response.data.$values || response.data;
        setData(result);
        setFilteredData(result);
      })
      .catch((error) => console.error("Error fetching data:", error))
      .finally(() => setLoading(false));
  };

  const applyFiltersAndSort = () => {
    let result = [...data];

    // Global Search
    if (globalSearch) {
      const search = globalSearch.toLowerCase();
      result = result.filter((item) =>
        Object.values(item).some((val) =>
          String(val).toLowerCase().includes(search)
        )
      );
    }

    // Column Filters
    Object.keys(filters).forEach((key) => {
      if (filters[key] && key !== "warrantyPeriod") {
        result = result.filter((item) =>
          String(item[key]).toLowerCase().includes(filters[key].toLowerCase())
        );
      }
    });

    // Warranty Period Filter
    if (filters.warrantyPeriod) {
      const today = new Date();
      result = result.filter((item) => {
        if (!item.endDate) return false;
        const endDate = new Date(item.endDate);
        const daysUntilExpiry = Math.ceil(
          (endDate - today) / (1000 * 60 * 60 * 24)
        );

        switch (filters.warrantyPeriod) {
          case "expired":
            return daysUntilExpiry < 0;
          case "30days":
            return daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
          case "60days":
            return daysUntilExpiry >= 0 && daysUntilExpiry <= 60;
          case "90days":
            return daysUntilExpiry >= 0 && daysUntilExpiry <= 90;
          case "active":
            return daysUntilExpiry > 90;
          default:
            return true;
        }
      });
    }

    // Financial Year Filter
    // Financial Year Filter
if (financialYearFilter !== "all") {
  result = result.filter((item) => {
    if (!item.endDate) return false;
    const endDate = new Date(item.endDate);
    const month = endDate.getMonth(); // 0-11
    const year = endDate.getFullYear();

    // Check if the warranty end date is in the selected year's financial year
    let isInSelectedFY = false;

    if (financialYearFilter === "h1") {
      // Apr-Sep of selected year (months 3-8)
      isInSelectedFY = year === selectedYear && month >= 3 && month <= 8;
    } else if (financialYearFilter === "h2") {
      // Oct of selected year to Mar of next year (months 9-11 of selectedYear, 0-2 of selectedYear+1)
      isInSelectedFY =
        (year === selectedYear && month >= 9) ||
        (year === selectedYear + 1 && month <= 2);
    }

    return isInSelectedFY;
  });
}

    // Sorting
    if (sortConfig.key) {
      result.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        // Handle dates
        if (sortConfig.key.includes("Date")) {
          aVal = aVal ? new Date(aVal).getTime() : 0;
          bVal = bVal ? new Date(bVal).getTime() : 0;
        }

        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    setFilteredData(result);
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

 const clearFilters = () => {
  setFilters({
    hostname: "",
    username: "",
    department: "",
    make: "",
    model: "",
    osName: "",
    encryptionStatus: "",
    warrantyPeriod: "",
  });
  setGlobalSearch("");
  setFinancialYearFilter("all");
  setSelectedYear(new Date().getFullYear());
  setSortConfig({ key: null, direction: "asc" });
};
  const exportToExcel = () => {
    const exportData = filteredData.map((item) => ({
      Hostname: item.hostname,
      Username: item.username,
      Department: item.department,
      Make: item.make,
      Model: item.model,
      "BIOS Serial": item.biosSerial,
      "Product ID": item.productId,
      "OS Name": item.osName,
      "OS Version": item.osVersion,
      Processor: item.processorFamily,
      RAM: item.physicalMemory,
      HDD: item.diskInfo,
      "Warranty Start": item.startDate,
      "Warranty End": item.endDate,
      "Encryption Status": item.encryptionStatus,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "System Report");
    XLSX.writeFile(workbook, `System_Report_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const getWarrantyBadge = (endDate) => {
    if (!endDate) return <span className="text-gray-400 text-xs">N/A</span>;

    const today = new Date();
    const end = new Date(endDate);
    const days = Math.ceil((end - today) / (1000 * 60 * 60 * 24));

    if (days < 0) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          Expired
        </span>
      );
    } else if (days <= 30) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
          {days}d left
        </span>
      );
    } else if (days <= 60) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          {days}d left
        </span>
      );
    } else if (days <= 90) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          {days}d left
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        Active
      </span>
    );
  };

  const renderEncryptionBadge = (status) => {
  switch (status) {
    case "Encrypted":
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <Shield className="h-3 w-3 mr-1" />
          Encrypted
        </span>
      );

    case "Partially Encrypted":
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <ShieldAlert className="h-3 w-3 mr-1" />
          Partially Encrypted
        </span>
      );

    case "Not Encrypted":
    default:
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <AlertCircle className="h-3 w-3 mr-1" />
          Not Encrypted
        </span>
      );
  }
};


  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) {
      return <ArrowUpDown className="h-3 w-3 text-gray-400" />;
    }
    return sortConfig.direction === "asc" ? (
      <ChevronUp className="h-3 w-3 text-blue-600" />
    ) : (
      <ChevronDown className="h-3 w-3 text-blue-600" />
    );
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50">
<div className="w-full mx-auto px-4 sm:px-6 lg:px-8">

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                  <FileText className="h-8 w-8 text-blue-600" />
                  System Report
                </h1>
                <p className="text-gray-500 mt-1">
                  {filteredData.length} of {data.length} systems
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={fetchData}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </button>
                <button
                  onClick={exportToExcel}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Export to Excel
                </button>
              </div>
            </div>
          </div>

          {/* Search & Filter Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
            {/* Global Search */}
            <div className="flex gap-3 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search across all fields..."
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
                  showFilters
                    ? "bg-blue-50 border-blue-300 text-blue-700"
                    : "bg-white border-gray-300 hover:bg-gray-50"
                }`}
              >
                <Filter className="h-4 w-4" />
                Filters
                {Object.values(filters).some((v) => v) && (
                  <span className="ml-1 px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                    {Object.values(filters).filter((v) => v).length}
                  </span>
                )}
              </button>
              {(Object.values(filters).some((v) => v) ||
                globalSearch ||
                financialYearFilter !== "all") && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <X className="h-4 w-4" />
                  Clear All
                </button>
              )}
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <div className="pt-4 border-t border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Hostname */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Hostname
                    </label>
                    <input
                      type="text"
                      value={filters.hostname}
                      onChange={(e) =>
                        setFilters({ ...filters, hostname: e.target.value })
                      }
                      placeholder="Filter by hostname..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Username */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Username
                    </label>
                    <input
                      type="text"
                      value={filters.username}
                      onChange={(e) =>
                        setFilters({ ...filters, username: e.target.value })
                      }
                      placeholder="Filter by username..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Department */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Department
                    </label>
                    <input
                      type="text"
                      value={filters.department}
                      onChange={(e) =>
                        setFilters({ ...filters, department: e.target.value })
                      }
                      placeholder="Filter by department..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Make */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Make
                    </label>
                    <input
                      type="text"
                      value={filters.make}
                      onChange={(e) =>
                        setFilters({ ...filters, make: e.target.value })
                      }
                      placeholder="Filter by make..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Model */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Model
                    </label>
                    <input
                      type="text"
                      value={filters.model}
                      onChange={(e) =>
                        setFilters({ ...filters, model: e.target.value })
                      }
                      placeholder="Filter by model..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* OS Name */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Operating System
                    </label>
                    <input
                      type="text"
                      value={filters.osName}
                      onChange={(e) =>
                        setFilters({ ...filters, osName: e.target.value })
                      }
                      placeholder="Filter by OS..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Encryption Status */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Encryption Status
                    </label>
                    <select
                      value={filters.encryptionStatus}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          encryptionStatus: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">All</option>
                      <option value="Encrypted">Encrypted</option>
                      <option value="Not Encrypted">Not Encrypted</option>
                      <option value="Partially">Partially Encrypted</option>
                    </select>
                  </div>

                  {/* Warranty Period */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Warranty Period
                    </label>
                    <select
                      value={filters.warrantyPeriod}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          warrantyPeriod: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">All Warranties</option>
                      <option value="expired">Expired</option>
                      <option value="30days">Expiring in 30 Days</option>
                      <option value="60days">Expiring in 60 Days</option>
                      <option value="90days">Expiring in 90 Days</option>
                      <option value="active">Active (90+ days)</option>
                    </select>
                  </div>
                </div>

                {/* Financial Year Filter */}
<div className="mt-4 pt-4 border-t border-gray-200">
  <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
    <Calendar className="h-4 w-4 text-blue-600" />
    Financial Year Warranty Expiration
  </label>

  {/* Year Selector */}
  <div className="mb-4">
    <label className="block text-xs font-medium text-gray-700 mb-2">
      Select Financial Year
    </label>
    <select
      value={selectedYear}
      onChange={(e) => setSelectedYear(Number(e.target.value))}
      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    >
      {Array.from({ length: 10 }, (_, i) => {
        const year = new Date().getFullYear() - 2 + i;
        return (
          <option key={year} value={year}>
            FY {year}-{year + 1}
          </option>
        );
      })}
    </select>
  </div>

  {/* Period Selector */}
  <div className="flex gap-3">
    <button
      onClick={() => setFinancialYearFilter("all")}
      className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
        financialYearFilter === "all"
          ? "bg-blue-50 border-blue-500 text-blue-700"
          : "bg-white border-gray-200 hover:border-gray-300"
      }`}
    >
      <div className="text-sm font-semibold">All Systems</div>
      <div className="text-xs text-gray-500 mt-1">No date filter</div>
    </button>
    <button
      onClick={() => setFinancialYearFilter("h1")}
      className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
        financialYearFilter === "h1"
          ? "bg-orange-50 border-orange-500 text-orange-700"
          : "bg-white border-gray-200 hover:border-gray-300"
      }`}
    >
      <div className="text-sm font-semibold">
        H1 (Apr {selectedYear} - Sep {selectedYear})
      </div>
      <div className="text-xs text-gray-500 mt-1">First Half</div>
    </button>
    <button
      onClick={() => setFinancialYearFilter("h2")}
      className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all ${
        financialYearFilter === "h2"
          ? "bg-purple-50 border-purple-500 text-purple-700"
          : "bg-white border-gray-200 hover:border-gray-300"
      }`}
    >
      <div className="text-sm font-semibold">
        H2 (Oct {selectedYear} - Mar {selectedYear + 1})
      </div>
      <div className="text-xs text-gray-500 mt-1">Second Half</div>
    </button>
  </div>

  {/* Active Filter Display */}
  {financialYearFilter !== "all" && (
    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <p className="text-sm text-blue-800 font-medium">
        {financialYearFilter === "h1"
          ? `Showing warranties expiring between April ${selectedYear} - September ${selectedYear}`
          : `Showing warranties expiring between October ${selectedYear} - March ${selectedYear + 1}`}
      </p>
    </div>
  )}
</div>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
             <table className="min-w-[1800px] divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10">

                  <tr>
                    {[
                      { key: "hostname", label: "Hostname", icon: Monitor },
                      { key: "username", label: "Username", icon: User },
                      { key: "department", label: "Department", icon: Building2 },
                      // { key: "make", label: "Make", icon: null },
                      { key: "model", label: "Model", icon: null },
                      { key: "biosSerial", label: "BIOS Serial", icon: null },
                      { key: "productId", label: "Product ID", icon: null },
                      { key: "osName", label: "OS Name", icon: null },
                      { key: "osVersion", label: "OS Version", icon: null },
                      // { key: "processorFamily", label: "Processor", icon: Cpu },
                      { key: "physicalMemory", label: "RAM", icon: null },
                      { key: "diskInfo", label: "HDD", icon: HardDrive },
                      { key: "startDate", label: "Warranty Start", icon: Calendar },
                      { key: "endDate", label: "Warranty End", icon: Calendar },
                      { key: "encryptionStatus", label: "Encryption", icon: Shield },
                    ].map(({ key, label, icon: Icon }) => (
                      <th
                        key={key}
                        onClick={() => handleSort(key)}
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {Icon && <Icon className="h-3 w-3" />}
                          <span>{label}</span>
                          <SortIcon columnKey={key} />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={15} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
                          <p className="text-gray-500">Loading systems...</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredData.length > 0 ? (
                    filteredData.map((item, index) => (
                      <tr
                        key={index}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {item.hostname || "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {item.username || "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {item.department || "—"}
                        </td>
                        {/* <td className="px-4 py-3 text-sm text-gray-700">
                          {item.make || "—"}
                        </td> */}
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {item.model || "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 font-mono">
                          {item.biosSerial || "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 font-mono">
                          {item.productId || "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {item.osName || "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {item.osVersion || "—"}
                        </td>
                        {/* <td className="px-4 py-3 text-sm text-gray-700">
                          {item.processorFamily || "—"}
                        </td> */}
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {item.physicalMemory || "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {item.diskInfo || "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {item.startDate
                            ? new Date(item.startDate).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex flex-col gap-1">
                            <span className="text-gray-700">
                              {item.endDate
                                ? new Date(item.endDate).toLocaleDateString()
                                : "—"}
                            </span>
                            {getWarrantyBadge(item.endDate)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
  {renderEncryptionBadge(item.encryptionStatus)}
</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={15} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <AlertCircle className="h-12 w-12 text-gray-400" />
                          <p className="text-gray-500 font-medium">
                            No matching records found
                          </p>
                          <p className="text-gray-400 text-sm">
                            Try adjusting your filters or search query
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SystemReport;