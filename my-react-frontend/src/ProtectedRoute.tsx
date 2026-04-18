import React from "react";
import { Navigate, useParams } from "react-router-dom";
import { isSessionValid, getRole, getUsername } from "./auth";

interface Props {
    children: React.ReactNode;
    adminOnly?: boolean;
    deviceRoute?: boolean;  // ← new flag for device pages
}

const ProtectedRoute = ({ children, adminOnly = false, deviceRoute = false }: Props) => {
    const { hostname } = useParams();
    const role = getRole();

    console.log("ProtectedRoute:", {
        path: window.location.pathname,
        role,
        adminOnly,
        deviceRoute,
        isSessionValid: isSessionValid(),
    });

    if (!isSessionValid()) {
        console.log("❌ No valid session → redirecting to login");
        return <Navigate to="/login" replace />;
    }

    if (adminOnly && role !== "Admin") {
        console.log("❌ Not admin → redirecting to login");
        return <Navigate to="/login" replace />;
    }

    if (deviceRoute) {
        if (role === "Admin") {
            console.log("✅ Admin on device route → allowed");
            return <>{children}</>;
        }
        const tokenHostname = localStorage.getItem("user_hostname");
        if (!tokenHostname) {
            console.log("✅ No hostname saved → allowing through");
            return <>{children}</>;
        }
        if (hostname?.toLowerCase() !== tokenHostname?.toLowerCase()) {
            console.log("❌ Wrong device → redirecting to own device");
            return <Navigate to={`/device/${tokenHostname}`} replace />;
        }
    }

    console.log("✅ Access granted");
    return <>{children}</>;
};

export default ProtectedRoute;