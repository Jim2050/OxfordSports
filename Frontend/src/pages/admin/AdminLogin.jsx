import { useState } from "react";
import { adminLogin } from "../../api/api";

export default function AdminLogin({ onAuth }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await adminLogin(email, password);
      if (res.success && res.token) {
        sessionStorage.setItem("adminToken", res.token);
        onAuth(true);
      } else {
        setError("Login failed. Check your credentials.");
      }
    } catch (err) {
      setError(err?.response?.data?.error || "Incorrect email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-box">
      <h2>Admin Login</h2>
      <p>Sign in to manage products and import data.</p>
      <form onSubmit={submit}>
        <input
          type="email"
          placeholder="Admin email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          required
          style={{ marginBottom: "0.75rem" }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
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
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </div>
  );
}
