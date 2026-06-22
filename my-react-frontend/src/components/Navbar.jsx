import React from "react";
import Dropdown from "./Dropdown";
import { getRole, isSessionValid, clearSession } from "../auth";
import { useNavigate, NavLink  } from "react-router-dom";

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
                 <NavLink
                                to="/MainPage"
                                className={({ isActive }) =>
                                    isActive
                                        ? "text-blue-400 font-semibold border-b-2 border-blue-400 pb-1"
                                        : "hover:text-gray-300"
                                }
                            >
                                MEAI System Monitor
                            </NavLink>
                {/* <Link to="/MainPage" className="text-2xl font-bold">
                    MEAI System Monitor
                </Link> */}
                <div className="relative">
                    <ul className="flex space-x-6 items-center">
                        <li>
                            <NavLink
                                to="/devicelist"
                                className={({ isActive }) =>
                                    isActive
                                        ? "text-blue-400 font-semibold border-b-2 border-blue-400 pb-1"
                                        : "hover:text-gray-300"
                                }
                            >
                                Device List
                            </NavLink>
                        </li>
                        <li>
                             <NavLink
                                to="/software"
                                className={({ isActive }) =>
                                    isActive
                                        ? "text-blue-400 font-semibold border-b-2 border-blue-400 pb-1"
                                        : "hover:text-gray-300"
                                }
                            >
                                Software List
                            </NavLink>
                            {/* <Link to="/software" className="hover:text-gray-300">Software List</Link> */}
                        </li>
                        <li>
                            <NavLink
                                to="/systemReport"
                                className={({ isActive }) =>
                                    isActive
                                        ? "text-blue-400 font-semibold border-b-2 border-blue-400 pb-1"
                                        : "hover:text-gray-300"
                                }
                            >
                                Report
                            </NavLink>
                            {/* <Link to="/systemReport" className="hover:text-gray-300">Report</Link> */}
                        </li>
                        <li>
                            <NavLink
                                to="/folder"
                                className={({ isActive }) =>
                                    isActive
                                        ? "text-blue-400 font-semibold border-b-2 border-blue-400 pb-1"
                                        : "hover:text-gray-300"
                                }
                            >
                                Folder
                            </NavLink>
                            {/* <Link to="/folder" className="hover:text-gray-300">Folder</Link> */}
                        </li>
                        <li>
                             <NavLink
                                to="/vulnerability-dashboard"
                                className={({ isActive }) =>
                                    isActive
                                        ? "text-blue-400 font-semibold border-b-2 border-blue-400 pb-1"
                                        : "hover:text-gray-300"
                                }
                            >
                                Vulnerability Dashboard
                            </NavLink>
                            {/* <Link to="/vulnerability-dashboard" className="hover:text-gray-300">Vulnerability Dashboard</Link> */}
                        </li>
                        <li>
                            <NavLink
                                to="/NetworkDashboard"
                                className={({ isActive }) =>
                                    isActive
                                        ? "text-blue-400 font-semibold border-b-2 border-blue-400 pb-1"
                                        : "hover:text-gray-300"
                                }
                            >
                                Network
                            </NavLink>
                            {/* <Link to="/NetworkDashboard" className="hover:text-gray-300">Network</Link> */}
                        </li>
                        <li>
                            <NavLink
                                to="/warranty-management"
                                className={({ isActive }) =>
                                    isActive
                                        ? "text-blue-400 font-semibold border-b-2 border-blue-400 pb-1"
                                        : "hover:text-gray-300"
                                }
                            >
                                Warranty Management
                            </NavLink>
                            {/* <Link to="/warranty-management" className="hover:text-gray-300">Warranty Management</Link> */}
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