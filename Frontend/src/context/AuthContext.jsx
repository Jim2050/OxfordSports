import { createContext, useContext, useState, useEffect } from "react";
import API from "../api/axiosInstance";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("memberToken"));
  const [loading, setLoading] = useState(true);

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

  const register = async (name, email, password, company) => {
    const res = await API.post("/auth/register", {
      name,
      email,
      password,
      company,
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
