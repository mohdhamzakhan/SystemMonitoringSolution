import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { APP_CONSTANTS } from "../store";
import { saveSession, isSessionValid, getRole } from "../auth";

export default function LoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [adUsers, setAdUsers] = useState<string[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [showSuggestions, setShowSuggestions] = useState(false);  // ← new
    const navigate = useNavigate();

    // ✅ Fix 1 — useEffect redirect (existing session)
    useEffect(() => {
        if (isSessionValid()) {
            const role = getRole();
            if (role === "Admin") {
                navigate("/MainPage", { replace: true });
            } else {
                const token = localStorage.getItem("auth_token");
                if (token) {
                    const decoded = JSON.parse(atob(token.split(".")[1]));
                    const savedUsername = decoded["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"];
                    if (savedUsername) {
                        axios.get(
                            APP_CONSTANTS.API_BASE_URL + `/api/devices/by-user/${savedUsername}`,
                            { headers: { Authorization: `Bearer ${token}` } }
                        ).then(res => {
                            const hostname = res.data?.hostname;
                            if (hostname) {
                                localStorage.setItem("user_hostname", hostname); // ✅ save it
                                navigate(`/device/${hostname}`, { replace: true });
                            }
                        }).catch(() => { });
                    }
                }
            }
        }
    }, []);

    useEffect(() => {
        const fetchADUsers = async () => {
            try {
                const response = await axios.get(
                    APP_CONSTANTS.API_BASE_URL + "/api/auth/ad-users"
                );
                const users = Array.isArray(response.data)
                    ? response.data
                    : response.data?.data || response.data?.users || [];
                setAdUsers(users);
            } catch (err) {
                console.error("Failed to load AD users", err);
            } finally {
                setLoadingUsers(false);
            }
        };
        fetchADUsers();
    }, []);

    const filteredUsers = adUsers.filter(user =>
        user.toLowerCase().includes(username.toLowerCase())
    );

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!username) {
            setError("Please enter a username.");
            return;
        }

        try {
            const response = await axios.post(
                APP_CONSTANTS.API_BASE_URL + "/api/auth/login",
                { username, password }
            );

            const { token } = response.data;
            saveSession(token);

            const decodedToken = JSON.parse(atob(token.split(".")[1]));
            const userRole =
                decodedToken["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"];

            if (userRole === "Admin") {
                navigate("/MainPage");
            } else {
                try {
                    const deviceResponse = await axios.get(
                        APP_CONSTANTS.API_BASE_URL + `/api/devices/by-user/${username}`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    const hostname = deviceResponse.data?.hostname;
                    if (hostname) {
                        localStorage.setItem("user_hostname", hostname); // ✅ save it
                        navigate(`/device/${hostname}`);
                    } else {
                        setError("No device found for your account.");
                    }
                } catch {
                    setError("Could not retrieve your device. Please contact IT.");
                }
            }
        } catch (err) {
            setError("Invalid credentials. Please try again.");
        }
    };
    return (
        <div className="flex justify-center items-center min-h-screen bg-gray-100">
            <div className="bg-white p-8 rounded-lg shadow-lg w-96">
                <h2 className="text-2xl font-bold mb-6 text-center">Login</h2>

                {error && (
                    <p className="text-red-500 text-center mb-4">{error}</p>
                )}

                <form onSubmit={handleLogin}>
                    {/* ✅ Fix 2: Typeable combobox replacing <select> */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Username
                        </label>
                        {loadingUsers ? (
                            <p className="text-sm text-gray-400">Loading users...</p>
                        ) : (
                            <div className="relative">
                                <input
                                    type="text"
                                    className="mt-1 p-2 w-full border rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                                    placeholder="Type or select username"
                                    value={username}
                                    onChange={(e) => {
                                        setUsername(e.target.value);
                                        setShowSuggestions(true);
                                    }}
                                    onFocus={() => setShowSuggestions(true)}
                                    onBlur={() =>
                                        setTimeout(() => setShowSuggestions(false), 150)
                                    }
                                    required
                                />
                                {showSuggestions && filteredUsers.length > 0 && (
                                    <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded mt-1 max-h-48 overflow-y-auto shadow-lg">
                                        {filteredUsers.map((user) => (
                                            <li
                                                key={user}
                                                className="px-3 py-2 cursor-pointer hover:bg-blue-50 text-gray-800 text-sm"
                                                onMouseDown={() => {
                                                    setUsername(user);
                                                    setShowSuggestions(false);
                                                }}
                                            >
                                                {user}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Password */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Password
                        </label>
                        <input
                            type="password"
                            className="mt-1 p-2 w-full border rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 transition"
                    >
                        Login
                    </button>
                </form>
            </div>
        </div>
    );
}