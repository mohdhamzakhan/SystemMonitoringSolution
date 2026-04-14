import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import DeviceList from "./DeviceList.tsx";
import DeviceDetails from "./DeviceMonitor.tsx"; // Import the details component
import React from "react";
import SoftwareList from "./software.tsx";
import MainPage from "./MainPage.tsx";
import UpdateInfoForm from "./UpdateInfoForm.tsx";
import AssignUpdatePage from "./AssignUpdatePage.tsx";
import UpdateTrackingDashboard from "./UpdateTrackingDashboard.tsx";
import LoginPage from "./LoginPage.tsx";
import SystemReport from "./SystemReport.jsx";
import UpdateManagementPage from "./ApplicationMgmt.tsx";
import WarrantyManagement from "./WarrantyManagement.tsx";
import VulnerabilityDashboard from "./VulnerabilityDashboard.tsx";
import NetworkDashboard from "./Networkdashboard.jsx";

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
            <Route path="/updateMgmt" element={<UpdateManagementPage />} />
            <Route path="/systemReport" element={<SystemReport />} />
            <Route path="/warranty-management" element={<WarrantyManagement />} />
            <Route path="/vulnerability-dashboard" element={<VulnerabilityDashboard />} />
            <Route path="/NetworkDashboard" element={<NetworkDashboard />} />
            {/* Register details route */}
        </Routes>
    </Router>
);

export default Application;
