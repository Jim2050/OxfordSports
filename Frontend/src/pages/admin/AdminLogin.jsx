import { useState } from "react";
import { adminLogin } from "../../api/api";

export default function AdminLogin({ onAuth }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await adminLogin(password);
      if (res.success) {
        sessionStorage.setItem("adminToken", res.token || "authed");
        onAuth(true);
      } else {
        setError("Incorrect password.");
      }
    } catch {
      setError("Incorrect password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-box">
      <h2>Admin Login</h2>
      <p>Enter the admin password to manage products.</p>
      <form onSubmit={submit}>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {error && (
          <p
            style={{
              color: "#dc2626",
              fontSize: "0.85rem",
              marginBottom: "0.75rem",
            }}
          >
            {error}
          </p>
        )}
        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: "100%" }}
          disabled={loading}
        >
          {loading ? "Checking…" : "Sign In"}
        </button>
      </form>
    </div>
  );
}
