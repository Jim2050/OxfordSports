import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Protects routes that require member login.
 * Redirects to /register if not authenticated.
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="loading-center" style={{ padding: "4rem 0" }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate to="/register" state={{ from: location.pathname }} replace />
    );
  }

  return children;
}
