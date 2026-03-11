import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ textAlign: "center", padding: "4rem 1rem" }}>
          <h2>Something went wrong</h2>
          <p style={{ color: "#6b7280", marginTop: "1rem" }}>
            Please refresh the page or try again later.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: "1.5rem",
              padding: "0.75rem 2rem",
              background: "#1a1281",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "1rem",
            }}
          >
            Refresh Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
