import React from "react";
import Navbar from "./Navbar"; // Import Navbar component

function MainPage() {
  return (
    <div>
      {/* Navbar */}
      <Navbar />

      {/* Body with Text */}
      <div className="max-w-7xl mx-auto p-4">
        <h1 className="text-4xl font-semibold mb-4">
          This is the MEAI System Monitor Application
        </h1>
        <p className="text-lg">
          If You are not from IT Department, Kindly do not use this application
        </p>
      </div>
    </div>
  );
}

export default MainPage;
