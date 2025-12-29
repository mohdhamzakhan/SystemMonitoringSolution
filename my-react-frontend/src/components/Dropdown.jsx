import React, { useState } from "react";

const Dropdown = () => {
  // State to manage the visibility of the dropdown
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Function to toggle the dropdown
  const toggleDropdown = () => setIsDropdownOpen(!isDropdownOpen);

  return (
    <div className="relative">
      <button
        className="hover:text-gray-300"
        onClick={toggleDropdown} // Toggle dropdown on click
      >
        Update
      </button>

      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <ul className="absolute right-0 mt-2 bg-gray-700 text-white rounded-md shadow-lg w-48">
          <li>
            <a href="/updateInfo" className="block px-4 py-2 hover:bg-gray-600">
              Update Info
            </a>
          </li>
          
          <li>
            <a href="/updateMgmt" className="block px-4 py-2 hover:bg-gray-600">
              DashBoard
            </a>
          </li>
        </ul>
      )}
    </div>
  );
};

export default Dropdown;
