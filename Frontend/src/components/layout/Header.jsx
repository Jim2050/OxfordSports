import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function Header() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();

  const links = [
    { to: "/", label: "Home" },
    { to: "/rugby-category", label: "Rugby" },
    { to: "/football", label: "Football" },
    { to: "/footwear", label: "Footwear" },
    { to: "/under-5", label: "Under £5" },
    { to: "/products", label: "All Products" },
    { to: "/contact", label: "Contact" },
  ];

  const handleLogout = () => {
    logout();
    setOpen(false);
    navigate("/");
  };

  return (
    <header className="header">
      <div className="container header-inner">
        <Link to="/" className="logo-text">
          Oxford<span>Sports</span>
        </Link>

        <nav className={`nav${open ? " open" : ""}`}>
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={pathname === l.to ? "active" : ""}
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          {isAuthenticated ? (
            <button
              className="btn btn-outline btn-sm"
              onClick={handleLogout}
              style={{ cursor: "pointer" }}
            >
              Sign Out
            </button>
          ) : (
            <Link
              to="/register"
              className="btn btn-primary btn-sm"
              onClick={() => setOpen(false)}
            >
              Register / Sign In
            </Link>
          )}
        </nav>

        <button
          className="burger"
          onClick={() => setOpen(!open)}
          aria-label="Menu"
        >
          <span />
          <span />
          <span />
        </button>
      </div>
    </header>
  );
}
