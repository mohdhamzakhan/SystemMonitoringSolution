import React, { useState } from "react";
import Dropdown from "./Dropdown";
import useAuth from "./useAuth";

const Navbar = () => {
    return (
        <nav className="bg-gray-800 text-white p-4">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
                <a href="Mainpage" className="text-2xl font-bold">
                    MEAI System Monitor
                </a>
                <div className="relative">
                    {/* Menu Links */}
                    <ul className="flex space-x-6">
                        <li>
                            <a href="/devicelist" className="hover:text-gray-300">
                                Device List
                            </a>
                        </li>
                        <li>
                            <a href="/software" className="hover:text-gray-300">
                                Software List
                            </a>
                        </li>
                        <li>
                            <a href="/systemReport" className="hover:text-gray-300">
                                Report
                            </a>
                        </li>
                        <li>
                            <a href="/vulnerability-dashboard" className="hover:text-gray-300">
                                Vulnerability Dashboard
                            </a>
                        </li>
                        <li>
                            <a href="/NetworkDashboard" className="hover:text-gray-300">
                                Network
                            </a>
                        </li>
                        <li>
                            <a href="/warranty-management" className="hover:text-gray-300">
                                Warranty Management
                            </a>
                        </li>
                        <li>
                            <Dropdown /> {/* Use Dropdown component here */}
                        </li>
                    </ul>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
