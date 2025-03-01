import React, { useState, useEffect } from "react";
import axios from "axios";
import { APP_CONSTANTS } from "../store";
import * as XLSX from "xlsx";
import Navbar from "./Navbar";
import useAuth from "./useAuth";

const SystemReport = () => {
  useAuth(); // Ensures the user is authenticated before loading the page
  const [data, setData] = useState([]);
  const [filters, setFilters] = useState({
    osVersion: "",
    hostname: "",
    make: "",
    domain: "",
    isEncrypted: "",
    productState: "",
  });

  const fetchData = () => {
    let query = Object.entries(filters)
      .filter(([_, value]) => value !== "")
      .map(([key, value]) => `${key}=${value}`)
      .join("&");

    axios
      .get(`${APP_CONSTANTS.API_BASE_URL}/api/SystemInfo/filter?${query}`)
      .then((response) => {
        console.log("API Response:", response.data);
        setData(response.data.$values); // Removed `.values` if response is direct array
      })
      .catch((error) => console.error("Error fetching data:", error));
  };

  const handleChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "System Report");
    XLSX.writeFile(workbook, "System_Report.xlsx");
  };

  return (
    <>
      <Navbar />
      <div className="container mx-auto p-5">
        <h1 className="text-2xl font-bold mb-4">System Report</h1>

        {/* Filters Section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <input
            type="text"
            name="osName"
            placeholder="OS Name"
            value={filters.osName}
            onChange={handleChange}
            className="border border-gray-400 p-2 rounded"
          />
          <input
            type="text"
            name="osVersion"
            placeholder="OS Version"
            value={filters.osVersion}
            onChange={handleChange}
            className="border border-gray-400 p-2 rounded"
          />
          <input
            type="text"
            name="hostname"
            placeholder="Hostname"
            value={filters.hostname}
            onChange={handleChange}
            className="border border-gray-400 p-2 rounded"
          />
          {/* Encryption Status Dropdown */}
          <select
            name="isEncrypted"
            value={filters.isEncrypted}
            onChange={handleChange}
            className="border border-gray-400 p-2 rounded"
          >
            <option value="">Encryption Status</option>
            <option value="Encrypted">Encrypted</option>
            <option value="Partially Encrypted">Partially Encrypted</option>
            <option value="Not Encrypted">Not Encrypted</option>
          </select>
        </div>

        {/* Buttons */}
        <div className="flex space-x-4 mb-4">
          <button
            onClick={fetchData}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Search
          </button>
          <button
            onClick={exportToExcel}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            Export to Excel
          </button>
        </div>

        {/* Table Section */}
        <table className="table-auto w-full border-collapse border border-gray-300 mt-4">
          <thead>
            <tr className="bg-gray-200">
              <th className="border p-2">Hostname</th>
              <th className="border p-2">OS Version</th>
              <th className="border p-2">Make</th>
              <th className="border p-2">Encryption Status</th>
              <th className="border p-2">Antivirus Status</th>
            </tr>
          </thead>
          <tbody>
            {data.length > 0 ? (
              data.map((item, index) => (
                <tr key={index} className="text-center">
                  <td className="border p-2">{item.hostname}</td>
                  <td className="border p-2">
                    {item.osName} -- {item.osVersion}
                  </td>
                  <td className="border p-2">{item.make}</td>
                  <td className="border p-2">{item.encryptionStatus}</td>
                  <td className="border p-2">
                    {item.displayName} -- {item.productState}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="border p-2 text-center">
                  No matching records found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default SystemReport;
