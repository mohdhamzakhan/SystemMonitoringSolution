import React, { useState } from "react";
import axios from "axios";
import { APP_CONSTANTS } from "../store";
import * as XLSX from "xlsx";
import Navbar from "./Navbar";
import useAuth from "./useAuth";

const SystemReport = () => {
  useAuth(); // Ensures the user is authenticated before loading the page
  const [data, setData] = useState([]);
  const [search, setSearch] = useState(""); // 🔍 single global search

  const fetchData = () => {
    axios
      .get(`${APP_CONSTANTS.API_BASE_URL}/api/SystemInfo/filter`, {
        params: { search }, // 🔍 send search query
      })
      .then((response) => {
        console.log("API Response:", response.data);
        setData(response.data.$values || response.data); // handle .NET JSON
      })
      .catch((error) => console.error("Error fetching data:", error));
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

        {/* 🔍 Global Search Box */}
        <div className="flex space-x-4 mb-4">
          <input
            type="text"
            placeholder="Search by any field..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-gray-400 p-2 rounded flex-grow"
          />
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
              <th className="border p-2">Username</th>
              <th className="border p-2">Department</th>
              <th className="border p-2">Make</th>
              <th className="border p-2">Model</th>
              <th className="border p-2">BIOS Serial</th>
              <th className="border p-2">Product Id</th>
              <th className="border p-2">OS Name</th>
              <th className="border p-2">OS Version</th>
              <th className="border p-2">Processor</th>
              <th className="border p-2">RAM</th>
              <th className="border p-2">HDD</th>
              <th className="border p-2">Warranty Start</th>
                            <th className="border p-2">Warranty End</th>
              <th className="border p-2">Encryption Status</th>
            </tr>
          </thead>
          <tbody>
            {data.length > 0 ? (
              data.map((item, index) => (
                <tr key={index} className="text-center">
                  <td className="border p-2">{item.hostname}</td>
                  <td className="border p-2">{item.username}</td>
                  <td className="border p-2">{item.department}</td>
                  <td className="border p-2">{item.make}</td>
                  <td className="border p-2">{item.model}</td>
                  <td className="border p-2">{item.biosSerial}</td>
                  <td className="border p-2">{item.productId}</td>
                  <td className="border p-2">{item.osName}</td>
                  <td className="border p-2">{item.osVersion}</td>
                  <td className="border p-2">{item.processorFamily}</td>
                  <td className="border p-2">{item.physicalMemory}</td>
                  <td className="border p-2">{item.diskInfo}</td>
                  <td className="border p-2">{item.startDate}</td>
                  <td className="border p-2">{item.endDate}</td>
                  <td className="border p-2">{item.encryptionStatus}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="12" className="border p-2 text-center">
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
