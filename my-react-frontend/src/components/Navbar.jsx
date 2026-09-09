import React, { useState } from "react";
import Dropdown from "./Dropdown";
import { getRole, isSessionValid, clearSession } from "../auth";
import { useNavigate, NavLink } from "react-router-dom";

const Navbar = () => {
    const isAdmin = isSessionValid() && getRole() === "Admin";
    const isLoggedIn = isSessionValid();
    const navigate = useNavigate();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const handleLogout = () => {
        clearSession();
        navigate("/login");
    };

    if (!isLoggedIn) return null;

    // Helper for link styles to keep the code clean
    const navLinkStyles = ({ isActive }) =>
        `block whitespace-nowrap text-sm md:text-base ${isActive
            ? "text-blue-400 font-semibold border-b-2 border-blue-400 pb-1"
            : "hover:text-gray-300"
        }`;

    if (!isAdmin) {
        return (
            <nav className="bg-gray-800 text-white p-4">
                <div className="max-w-7xl mx-auto flex justify-end items-center">
                    <button
                        onClick={handleLogout}
                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded transition whitespace-nowrap"
                    >
                        Logout
                    </button>
                </div>
            </nav>
        );
    }

    return (
        <nav className="bg-gray-800 text-white p-4">
            <div className="max-w-full mx-auto flex justify-between items-center px-2 sm:px-4">
                <NavLink to="/MainPage" className="text-blue-400 font-bold text-lg whitespace-nowrap">
                    MEAI System Monitor
                </NavLink>

                {/* Mobile Menu Button */}
                <button
                    className="xl:hidden block text-gray-300 hover:text-white focus:outline-none ml-4"
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        {isMenuOpen ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        )}
                    </svg>
                </button>

                {/* Desktop Menu */}
                <div className="hidden xl:flex items-center space-x-4 lg:space-x-6">
                    <ul className="flex space-x-4 lg:space-x-6 items-center">
                        <li><NavLink to="/devicelist" className={navLinkStyles}>Device List</NavLink></li>
                        <li><NavLink to="/software" className={navLinkStyles}>Software List</NavLink></li>
                        <li><NavLink to="/systemReport" className={navLinkStyles}>Report</NavLink></li>
                        <li><NavLink to="/folder" className={navLinkStyles}>Folder</NavLink></li>
                        <li><NavLink to="/vulnerability-dashboard" className={navLinkStyles}>Vulnerability Dashboard</NavLink></li>
                        <li><NavLink to="/NetworkDashboard" className={navLinkStyles}>Network</NavLink></li>
                        <li><NavLink to="/document-classification" className={navLinkStyles}>Document Classification</NavLink></li>
                        <li><NavLink to="/warranty-management" className={navLinkStyles}>Warranty Management</NavLink></li>
                        <li><Dropdown /></li>
                        <li>
                            <button
                                onClick={handleLogout}
                                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 text-sm md:text-base rounded transition whitespace-nowrap"
                            >
                                Logout
                            </button>
                        </li>
                    </ul>
                </div>
            </div>

            {/* Mobile Dropdown Menu */}
            {isMenuOpen && (
                <div className="xl:hidden mt-4 pb-2 border-t border-gray-700 pt-4 px-2 sm:px-4">
                    <ul className="flex flex-col space-y-4">
                        <li><NavLink to="/devicelist" className={navLinkStyles} onClick={() => setIsMenuOpen(false)}>Device List</NavLink></li>
                        <li><NavLink to="/software" className={navLinkStyles} onClick={() => setIsMenuOpen(false)}>Software List</NavLink></li>
                        <li><NavLink to="/systemReport" className={navLinkStyles} onClick={() => setIsMenuOpen(false)}>Report</NavLink></li>
                        <li><NavLink to="/folder" className={navLinkStyles} onClick={() => setIsMenuOpen(false)}>Folder</NavLink></li>
                        <li><NavLink to="/vulnerability-dashboard" className={navLinkStyles} onClick={() => setIsMenuOpen(false)}>Vulnerability Dashboard</NavLink></li>
                        <li><NavLink to="/NetworkDashboard" className={navLinkStyles} onClick={() => setIsMenuOpen(false)}>Network</NavLink></li>
                        <li><NavLink to="/document-classification" className={navLinkStyles} onClick={() => setIsMenuOpen(false)}>Document Classification</NavLink></li>
                        <li><NavLink to="/warranty-management" className={navLinkStyles} onClick={() => setIsMenuOpen(false)}>Warranty Management</NavLink></li>
                        <li className="pt-2"><Dropdown /></li>
                        <li className="pt-2">
                            <button
                                onClick={handleLogout}
                                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded transition w-full text-left"
                            >
                                Logout
                            </button>
                        </li>
                    </ul>
                </div>
            )}
        </nav>
    );
};

export default Navbar;