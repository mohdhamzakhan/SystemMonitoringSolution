import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

interface DecodedToken {
  exp: number;
  role: string; // Ensure the JWT token includes a "role" field
}

const useAuth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("jwt");

    if (!token) {
      navigate("/login");
      return;
    }

    try {
      const decodedToken: DecodedToken = jwtDecode(token);

      if (decodedToken.exp < Date.now() / 1000) {
        localStorage.removeItem("jwt");
        navigate("/login");
        return;
      }

      setUserRole(decodedToken.role); // Save role in state

      // Access Control Logic
      const isUser = decodedToken.role === "user";
      const isAdmin = decodedToken.role === "admin";

      // Restricted Pages (if user is not admin, prevent access to all pages except "/user-dashboard")
      if (isUser && location.pathname !== "/user-dashboard") {
        navigate("/user-dashboard");
      }
    } catch (error) {
      localStorage.removeItem("jwt");
      navigate("/login");
    }
  }, [navigate, location]);

  return userRole; // Return user role so components can use it
};

export default useAuth;
