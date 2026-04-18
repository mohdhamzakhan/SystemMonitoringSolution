const TOKEN_KEY = "auth_token";
const LOGIN_TIME_KEY = "login_timestamp";
const SESSION_DURATION_MS = 48 * 60 * 60 * 1000; // 48 hours

export const saveSession = (token: string) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(LOGIN_TIME_KEY, Date.now().toString());
};

export const getToken = (): string | null => {
    return localStorage.getItem(TOKEN_KEY);
};

export const isSessionValid = (): boolean => {
    const token = localStorage.getItem(TOKEN_KEY);
    const loginTime = localStorage.getItem(LOGIN_TIME_KEY);

    if (!token || !loginTime) return false;

    const elapsed = Date.now() - parseInt(loginTime, 10);
    return elapsed < SESSION_DURATION_MS;
};

// Add this to your existing auth.ts
export const getRole = (): string | null => {
    const token = localStorage.getItem("auth_token");
    console.log("getRole: token exists?", !!token); // ← add this
    if (!token) return null;
    try {
        const decoded = JSON.parse(atob(token.split(".")[1]));
        const role = decoded["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] || null;
        console.log("getRole: decoded role =", role); // ← add this
        return role;
    } catch {
        return null;
    }
};

// Add this to your existing auth.ts
export const getUsername = (): string | null => {
    const token = localStorage.getItem("auth_token");
    if (!token) return null;
    try {
        const decoded = JSON.parse(atob(token.split(".")[1]));
        return decoded["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"] || null;
    } catch {
        return null;
    }
};

export const clearSession = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("login_timestamp");
    localStorage.removeItem("user_hostname"); // ✅ make sure this is here
};