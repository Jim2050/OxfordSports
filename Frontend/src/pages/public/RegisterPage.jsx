import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";

export default function RegisterPage() {
  const { isAuthenticated, login, register, logout } = useAuth();
  const [mode, setMode] = useState("login"); // "login" or "register"
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    company: "",
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from || "/products";

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "register") {
        if (!form.name || !form.email || !form.password) {
          toast.error("Name, email, and password are required.");
          return;
        }
        await register(form.name, form.email, form.password, form.company);
        toast.success("Registration successful! Welcome.");
      } else {
        if (!form.email || !form.password) {
          toast.error("Email and password are required.");
          return;
        }
        await login(form.email, form.password);
        toast.success("Welcome back!");
      }
      navigate(from, { replace: true });
    } catch (err) {
      const msg =
        err?.response?.data?.error || err.message || "Authentication failed.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // If already logged in, show account info
  if (isAuthenticated) {
    return (
      <>
        <section className="page-banner">
          <div className="container">
            <h1>My Account</h1>
            <p>You are signed in as a trade buyer</p>
          </div>
        </section>
        <section className="section">
          <div className="container" style={{ maxWidth: 500 }}>
            <div className="members-gate">
              <h2>Welcome back!</h2>
              <p>You have full access to our wholesale catalogue.</p>
              <div
                style={{
                  display: "flex",
                  gap: "1rem",
                  marginTop: "1.5rem",
                  flexWrap: "wrap",
                  justifyContent: "center",
                }}
              >
                <Link to="/products" className="btn btn-primary">
                  Browse Products
                </Link>
                <button className="btn btn-outline" onClick={logout}>
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <section className="page-banner">
        <div className="container">
          <h1>{mode === "register" ? "Register" : "Sign In"}</h1>
          <p>Members-only access to wholesale prices</p>
        </div>
      </section>

      <section className="section">
        <div className="container" style={{ maxWidth: 480 }}>
          {/* Tab switcher */}
          <div className="auth-tabs">
            <button
              className={`auth-tab${mode === "login" ? " active" : ""}`}
              onClick={() => setMode("login")}
              type="button"
            >
              Sign In
            </button>
            <button
              className={`auth-tab${mode === "register" ? " active" : ""}`}
              onClick={() => setMode("register")}
              type="button"
            >
              Register
            </button>
          </div>

          <form className="auth-form" onSubmit={submit}>
            {mode === "register" && (
              <>
                <div className="form-field">
                  <label htmlFor="name">Full Name *</label>
                  <input
                    id="name"
                    name="name"
                    value={form.name}
                    onChange={handle}
                    placeholder="John Smith"
                    required
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="company">Company (optional)</label>
                  <input
                    id="company"
                    name="company"
                    value={form.company}
                    onChange={handle}
                    placeholder="Your business name"
                  />
                </div>
              </>
            )}
            <div className="form-field">
              <label htmlFor="email">Email *</label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handle}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="password">Password *</label>
              <input
                id="password"
                name="password"
                type="password"
                value={form.password}
                onChange={handle}
                placeholder={
                  mode === "register" ? "Min. 6 characters" : "Your password"
                }
                required
                minLength={mode === "register" ? 6 : undefined}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%", marginTop: "0.5rem" }}
              disabled={loading}
            >
              {loading
                ? "Please wait…"
                : mode === "register"
                  ? "Create Account"
                  : "Sign In"}
            </button>
          </form>

          <p
            style={{
              textAlign: "center",
              marginTop: "1.5rem",
              color: "#6b7280",
              fontSize: "0.85rem",
            }}
          >
            {mode === "login" ? (
              <>
                Don't have an account?{" "}
                <button
                  className="link-btn"
                  onClick={() => setMode("register")}
                >
                  Register here
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button className="link-btn" onClick={() => setMode("login")}>
                  Sign in here
                </button>
              </>
            )}
          </p>

          <div
            style={{
              marginTop: "2rem",
              padding: "1rem",
              background: "#f5f5f7",
              borderRadius: "8px",
              fontSize: "0.85rem",
              color: "#6b7280",
              textAlign: "center",
            }}
          >
            <p>
              Need help? Call{" "}
              <a
                href="tel:01869228107"
                style={{ color: "#1a1281", fontWeight: 600 }}
              >
                01869 228107
              </a>{" "}
              or email{" "}
              <a
                href="mailto:sales@oxfordsports.net"
                style={{ color: "#1a1281", fontWeight: 600 }}
              >
                sales@oxfordsports.net
              </a>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
