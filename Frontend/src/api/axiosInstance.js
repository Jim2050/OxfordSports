import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
});

/**
 * Decode a JWT payload (no signature verification — client-side only).
 * Returns the payload object or null.
 */
export function decodeJwt(token) {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

/**
 * Returns true if the token exists AND is not expired.
 */
export function isTokenValid(token) {
  if (!token) return false;
  const payload = decodeJwt(token);
  if (!payload?.exp) return false;
  return payload.exp * 1000 > Date.now();
}

// Auto-logout on 401: fires a custom event so React components can react.
API.interceptors.response.use(
  (res) => res,
  (error) => {
    if (
      error.response?.status === 401 &&
      !error.config?.url?.includes("/admin/login") &&
      !error.config?.url?.includes("/auth/login")
    ) {
      const url = error.config?.url || "";

      if (url.includes("/admin/")) {
        // Admin token expired or invalid
        sessionStorage.removeItem("adminToken");
        window.dispatchEvent(new CustomEvent("admin:logout"));
      } else {
        // Member token expired or invalid
        localStorage.removeItem("memberToken");
        window.dispatchEvent(new CustomEvent("member:logout"));
      }
    }
    return Promise.reject(error);
  },
);

export default API;
