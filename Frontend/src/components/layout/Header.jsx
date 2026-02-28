import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";

// Pages that don't require authentication
const PUBLIC_PATHS = new Set(["/", "/contact", "/register"]);

export default function Header() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();
  const { itemCount, openDrawer } = useCart();

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

  /**
   * Navigate handler — if the target page is protected and the user
   * is NOT signed in, go to /register with state.from so they land
   * on the intended page after login.
   */
  const handleNavClick = (e, to) => {
    setOpen(false);
    if (!isAuthenticated && !PUBLIC_PATHS.has(to)) {
      e.preventDefault();
      toast("Please sign in to access wholesale pages", { icon: "🔒" });
      navigate("/register", { state: { from: to } });
    }
  };

  return (
    <header className="header">
      <div className="container header-inner">
        <Link to="/" className="logo-container">
          <img src="/logo.jpeg" alt="Oxford Sports Logo" className="logo-img" />
          <span className="logo-text">
            Oxford<span>Sports</span>
          </span>
        </Link>

        <nav className={`nav${open ? " open" : ""}`}>
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={pathname === l.to ? "active" : ""}
              onClick={(e) => handleNavClick(e, l.to)}
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

        {/* Cart icon with badge */}
        <button
          className="cart-icon-btn"
          onClick={openDrawer}
          aria-label="Shopping cart"
          title="Shopping cart"
        >
          🛒
          {itemCount > 0 && (
            <span className="cart-badge">
              {itemCount > 99 ? "99+" : itemCount}
            </span>
          )}
        </button>

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
