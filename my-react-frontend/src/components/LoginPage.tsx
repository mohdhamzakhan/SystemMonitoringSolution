import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { APP_CONSTANTS } from "../store";

export default function LoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [adUsers, setAdUsers] = useState<string[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const navigate = useNavigate();

    // Fetch AD users for dropdown on mount
    useEffect(() => {
        const fetchADUsers = async () => {
            try {
                const response = await axios.get(
                    APP_CONSTANTS.API_BASE_URL + "/api/auth/ad-users"
                );
                const data = response.data;
                setAdUsers(data.$values ?? []);
                console.log("AD Users response:", response.data, typeof response.data);
            } catch (err) {
                console.error("Failed to load AD users", err);
            } finally {
                setLoadingUsers(false);
            }
        };
        fetchADUsers();
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!username) {
            setError("Please select a username.");
            return;
        }

        try {
            const response = await axios.post(
                APP_CONSTANTS.API_BASE_URL + "/api/auth/login",
                { username, password }
            );

            const { token } = response.data;
            localStorage.setItem("jwt", token);

            const decodedToken = JSON.parse(atob(token.split(".")[1]));
            const userRole =
                decodedToken[
                "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"
                ];

            if (userRole === "Admin") {
                navigate("/MainPage");
            } else {
                // Fetch the user's device hostname, then redirect externally
                try {
                    const deviceResponse = await axios.get(
                        APP_CONSTANTS.API_BASE_URL + `/api/devices/by-user/${username}`,
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    const hostname = deviceResponse.data?.hostname;
                    if (hostname) {
                        window.location.href = `http://10.235.20.49:5296/device/${hostname}`;
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
                    {/* Username Dropdown */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Username
                        </label>
                        {loadingUsers ? (
                            <p className="text-sm text-gray-400">Loading users...</p>
                        ) : (
                            <select
                                className="mt-1 p-2 w-full border rounded bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                            >
                                <option value="">-- Select your username --</option>
                                {(Array.isArray(adUsers) ? adUsers : []).map((user) => (
                                    <option key={user} value={user}>
                                        {user}
                                    </option>
                                ))}
                            </select>
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