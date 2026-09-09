import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import DeviceList from "./DeviceList.tsx";
import DeviceDetails from "./DeviceMonitor.tsx";
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
import ProtectedRoute from "../ProtectedRoute.tsx";
import FolderTreePage from "./FolderTree.jsx"
import DocumentClassificationDashboard from "./DocumentClassificationDashboard.tsx"

const Application = () => (
    <Router>
        <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/MainPage" element={<ProtectedRoute adminOnly><MainPage /></ProtectedRoute>} />
            <Route path="/devicelist" element={<ProtectedRoute adminOnly><DeviceList /></ProtectedRoute>} />
            <Route
                path="/device/:hostname"
                element={
                    <ProtectedRoute deviceRoute>
                        <DeviceDetails />
                    </ProtectedRoute>
                }
            />
            <Route path="/software" element={<ProtectedRoute adminOnly><SoftwareList /></ProtectedRoute>} />
            <Route path="/updateInfo" element={<ProtectedRoute adminOnly><UpdateInfoForm /></ProtectedRoute>} />
            <Route path="/updateDetails" element={<ProtectedRoute adminOnly><AssignUpdatePage /></ProtectedRoute>} />
            <Route path="/updateDashboard" element={<ProtectedRoute adminOnly><UpdateTrackingDashboard /></ProtectedRoute>} />
            <Route path="/updateMgmt" element={<ProtectedRoute adminOnly><UpdateManagementPage /></ProtectedRoute>} />
            <Route path="/systemReport" element={<ProtectedRoute adminOnly><SystemReport /></ProtectedRoute>} />
            <Route path="/warranty-management" element={<ProtectedRoute adminOnly><WarrantyManagement /></ProtectedRoute>} />
            <Route path="/vulnerability-dashboard" element={<ProtectedRoute adminOnly><VulnerabilityDashboard /></ProtectedRoute>} />
            <Route path="/NetworkDashboard" element={<ProtectedRoute adminOnly><NetworkDashboard /></ProtectedRoute>} />
            <Route path="/folder" element={<ProtectedRoute adminOnly><FolderTreePage /></ProtectedRoute>} />
            <Route path="/document-classification" element={<ProtectedRoute adminOnly><DocumentClassificationDashboard /></ProtectedRoute>} />
        </Routes>
    </Router>
);

export default Application;