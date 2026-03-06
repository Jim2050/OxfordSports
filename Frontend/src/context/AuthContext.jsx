import { createContext, useContext, useState, useEffect } from "react";
import API from "../api/axiosInstance";
import { isTokenValid } from "../api/axiosInstance";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // isTokenValid checks JWT exp so stale browser-cached tokens are rejected immediately
  const savedToken = localStorage.getItem("memberToken");
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(
    savedToken && isTokenValid(savedToken) ? savedToken : null,
  );
  const [loading, setLoading] = useState(true);

  // Clean up invalid/expired tokens from localStorage on mount
  useEffect(() => {
    if (savedToken && !isTokenValid(savedToken)) {
      localStorage.removeItem("memberToken");
    }
  }, []);

  // Set axios default header whenever token changes
  useEffect(() => {
    if (token) {
      API.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      localStorage.setItem("memberToken", token);
    } else {
      delete API.defaults.headers.common["Authorization"];
      localStorage.removeItem("memberToken");
    }
  }, [token]);

  // Listen for 401-triggered auto-logout from the axios interceptor
  useEffect(() => {
    const handleLogout = () => {
      setToken(null);
      setUser(null);
    };
    window.addEventListener("member:logout", handleLogout);
    return () => window.removeEventListener("member:logout", handleLogout);
  }, []);

  // On mount, verify existing token
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    API.get("/auth/me")
      .then((res) => {
        if (res.data?.user) {
          setUser(res.data.user);
        } else {
          setToken(null);
          setUser(null);
        }
      })
      .catch(() => {
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await API.post("/auth/login", { email, password });
    if (res.data?.success) {
      setToken(res.data.token);
      setUser(res.data.user);
      return res.data;
    }
    throw new Error(res.data?.error || "Login failed");
  };

  const register = async (name, email, password, company, mobileNumber, deliveryAddress) => {
    const res = await API.post("/auth/register", {
      name,
      email,
      password,
      company,
      mobileNumber,
      deliveryAddress,
    });
    if (res.data?.success) {
      setToken(res.data.token);
      setUser(res.data.user);
      return res.data;
    }
    throw new Error(res.data?.error || "Registration failed");
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  const isAuthenticated = !!user && !!token;

  return (
    <AuthContext.Provider
      value={{ user, token, loading, isAuthenticated, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
