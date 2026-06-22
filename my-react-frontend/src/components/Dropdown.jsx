import React, { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

const Dropdown = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const location = useLocation();

  const isUpdateActive =
    location.pathname === "/updateInfo" ||
    location.pathname === "/updateMgmt";

  const navClass = ({ isActive }) =>
    isActive
      ? "block px-4 py-2 bg-blue-600 text-white"
      : "block px-4 py-2 hover:bg-gray-600";

  return (
    <div className="relative">
      <button
        className={`${
          isUpdateActive
            ? "text-blue-400 font-semibold"
            : "hover:text-gray-300"
        }`}
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
      >
        Update
      </button>

      {isDropdownOpen && (
        <ul className="absolute right-0 mt-2 bg-gray-700 text-white rounded-md shadow-lg w-48 z-50">
          <li>
            <NavLink
              to="/updateInfo"
              className={navClass}
            >
              Update Info
            </NavLink>
          </li>

          <li>
            <NavLink
              to="/updateMgmt"
              className={navClass}
            >
              Dashboard
            </NavLink>
          </li>
        </ul>
      )}
    </div>
  );
};

export default Dropdown;