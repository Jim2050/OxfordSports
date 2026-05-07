import { Component } from "react";

/**
 * Enhanced Error Boundary
 * ────────────────────────
 * - Captures React render errors with full component stack
 * - Reports errors to a structured log endpoint (when available)
 * - Provides retry/reload options instead of a blank screen
 * - Route-level isolation: only the crashed section fails, not the whole app
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });

    // Structured error report
    const report = {
      type: "react_error_boundary",
      message: error?.message || "Unknown error",
      stack: error?.stack?.split("\n").slice(0, 5).join("\n"),
      componentStack: errorInfo?.componentStack?.split("\n").slice(0, 8).join("\n"),
      url: window.location.href,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      scope: this.props.scope || "global",
    };

    console.error("[ErrorBoundary]", report);

    // Send to backend error logging endpoint (fire-and-forget)
    try {
      const apiBase = import.meta.env?.VITE_API_BASE_URL || "/api";
      navigator.sendBeacon?.(
        `${apiBase}/client-errors`,
        new Blob([JSON.stringify(report)], { type: "application/json" })
      );
    } catch {
      // Silently ignore — error reporting should never cause errors
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          retry: this.handleRetry,
        });
      }

      const isDev = import.meta.env?.MODE === "development";

      return (
        <div
          style={{
            textAlign: "center",
            padding: "4rem 1rem",
            maxWidth: "600px",
            margin: "0 auto",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
          <h2
            style={{
              color: "#0f2d5c",
              marginBottom: "0.75rem",
              fontSize: "1.5rem",
              fontWeight: 700,
            }}
          >
            Something went wrong
          </h2>
          <p
            style={{
              color: "#6b7280",
              marginTop: "0.5rem",
              fontSize: "0.95rem",
              lineHeight: 1.6,
            }}
          >
            {this.props.scope === "page"
              ? "This page encountered an error. You can try again or navigate to a different page."
              : "The application encountered an unexpected error. Please try refreshing."}
          </p>

          {/* Dev-only error details */}
          {isDev && this.state.error && (
            <details
              style={{
                textAlign: "left",
                margin: "1.5rem auto",
                padding: "1rem",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "8px",
                fontSize: "0.8rem",
                color: "#991b1b",
                maxHeight: "200px",
                overflow: "auto",
              }}
            >
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                Error Details (dev only)
              </summary>
              <pre style={{ whiteSpace: "pre-wrap", marginTop: "0.5rem" }}>
                {this.state.error.message}
                {"\n\n"}
                {this.state.error.stack}
              </pre>
            </details>
          )}

          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              justifyContent: "center",
              marginTop: "1.5rem",
            }}
          >
            <button
              onClick={this.handleRetry}
              style={{
                padding: "0.75rem 2rem",
                background: "#0f2d5c",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.95rem",
                fontWeight: 600,
                transition: "background 0.2s",
              }}
              onMouseOver={(e) => (e.target.style.background = "#0a1e3f")}
              onMouseOut={(e) => (e.target.style.background = "#0f2d5c")}
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "0.75rem 2rem",
                background: "transparent",
                color: "#0f2d5c",
                border: "1px solid #0f2d5c",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.95rem",
                fontWeight: 600,
              }}
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
