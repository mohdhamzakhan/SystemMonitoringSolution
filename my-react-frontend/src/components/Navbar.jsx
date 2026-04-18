import React from "react";
import Dropdown from "./Dropdown";
import { getRole, isSessionValid, clearSession } from "../auth";
import { useNavigate, Link } from "react-router-dom";

const Navbar = () => {
    const isAdmin = isSessionValid() && getRole() === "Admin";
    const isLoggedIn = isSessionValid();
    const navigate = useNavigate();

    const handleLogout = () => {
        clearSession();
        navigate("/login");
    };

    // Not logged in — show nothing
    if (!isLoggedIn) return null;

    // Non-admin — show only logout button
    if (!isAdmin) {
        return (
            <nav className="bg-gray-800 text-white p-4">
                <div className="max-w-7xl mx-auto flex justify-end items-center">
                    <button
                        onClick={handleLogout}
                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded transition"
                    >
                        Logout
                    </button>
                </div>
            </nav>
        );
    }

    // Admin — show full navbar
    return (
        <nav className="bg-gray-800 text-white p-4">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
                <Link to="/MainPage" className="text-2xl font-bold">
                    MEAI System Monitor
                </Link>
                <div className="relative">
                    <ul className="flex space-x-6 items-center">
                        <li>
                            <Link to="/devicelist" className="hover:text-gray-300">Device List</Link>
                        </li>
                        <li>
                            <Link to="/software" className="hover:text-gray-300">Software List</Link>
                        </li>
                        <li>
                            <Link to="/systemReport" className="hover:text-gray-300">Report</Link>
                        </li>
                        <li>
                            <Link to="/vulnerability-dashboard" className="hover:text-gray-300">Vulnerability Dashboard</Link>
                        </li>
                        <li>
                            <Link to="/NetworkDashboard" className="hover:text-gray-300">Network</Link>
                        </li>
                        <li>
                            <Link to="/warranty-management" className="hover:text-gray-300">Warranty Management</Link>
                        </li>
                        <li>
                            <Dropdown />
                        </li>
                        <li>
                            <button
                                onClick={handleLogout}
                                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded transition"
                            >
                                Logout
                            </button>
                        </li>
                    </ul>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;