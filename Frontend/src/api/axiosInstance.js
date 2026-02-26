import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
});

// Auto-logout on 401 for admin requests
API.interceptors.response.use(
  (res) => res,
  (error) => {
    if (
      error.response?.status === 401 &&
      error.config?.url?.includes("/admin/") &&
      !error.config.url.includes("/admin/login")
    ) {
      sessionStorage.removeItem("adminToken");
    }
    return Promise.reject(error);
  },
);

export default API;
