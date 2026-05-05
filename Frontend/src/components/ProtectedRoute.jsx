import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { AUTH_PUBLIC_MODE } from "../config/featureFlags";

/**
 * Protects routes that require member login.
 * Redirects to /register with a toast message if not authenticated.
 *
 * When AUTH_PUBLIC_MODE is true, all routes are publicly accessible.
 */
export default function ProtectedRoute({ children }) {
  // Fast path: auth disabled → render children immediately
  if (AUTH_PUBLIC_MODE) return children;

  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  // Show a one-time toast when redirecting to register
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      toast("Please sign in to view wholesale pages", {
        icon: "🔒",
        id: "auth-required",
      });
    }
  }, [loading, isAuthenticated]);

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

