import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import DeviceList from "./DeviceList.tsx";
import DeviceDetails from "./DeviceMonitor.tsx"; // Import the details component
import React from "react";
import SoftwareList from "./software.tsx";
import MainPage from "./MainPage.tsx";
import UpdateInfoForm from "./UpdateInfoForm.tsx";
import AssignUpdatePage from "./AssignUpdatePage.tsx";
import UpdateTrackingDashboard from "./UpdateTrackingDashboard.tsx";
import Dashboard from "./ApplicationMgmt.tsx";
import LoginPage from "./LoginPage.tsx";
import SystemReport from "./SystemReport.jsx";

const Application = () => (
  <Router>
    <Routes>
      {/* <Route path="/" element={<LoginPage />} /> */}
      <Route path="/" element={<LoginPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/MainPage" element={<MainPage />} />
      <Route path="/devicelist" element={<DeviceList />} />
      <Route path="/device/:hostname" element={<DeviceDetails />} />{" "}
      <Route path="/software" element={<SoftwareList />} />
      <Route path="/updateInfo" element={<UpdateInfoForm />} />
      <Route path="/updateDetails" element={<AssignUpdatePage />} />
      <Route path="/updateDashboard" element={<UpdateTrackingDashboard />} />
      <Route path="/updateMgmt" element={<Dashboard />} />
      <Route path="/systemReport" element={<SystemReport />} />
      {/* Register details route */}
    </Routes>
  </Router>
);

export default Application;
