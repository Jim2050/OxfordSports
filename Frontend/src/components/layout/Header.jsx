import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";

// Pages that don't require authentication
const PUBLIC_PATHS = new Set(["/", "/contact", "/register"]);

const isPublicPath = (to) => {
  const path = to.split("?")[0];
  return PUBLIC_PATHS.has(path);
};

export default function Header() {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();
  const { itemCount, openDrawer } = useCart();

  const links = [
    { to: "/", label: "Home" },
    { to: "/products?category=FOOTWEAR", label: "Footwear" },
    { to: "/products?category=CLOTHING", label: "Clothing" },
    { to: "/products?category=ACCESSORIES", label: "Accessories" },
    { to: "/products?category=UNDER+%C2%A35", label: "Under £5" },
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
    if (!isAuthenticated && !isPublicPath(to)) {
      e.preventDefault();
      toast("Please sign in to access wholesale pages", { icon: "🔒" });
      navigate("/register", { state: { from: to } });
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    if (!isAuthenticated) {
      toast("Please sign in to search products", { icon: "🔒" });
      navigate("/register", { state: { from: `/products?search=${encodeURIComponent(q)}` } });
      return;
    }
    navigate(`/products?search=${encodeURIComponent(q)}`);
    setSearchQuery("");
    setOpen(false);
  };

  return (
    <header className="header">
      {/* ── Top row: Logo + Search + Auth + Cart ── */}
      <div className="container header-top">
        <Link to="/" className="logo-container">
          <img src="/logo.jpeg" alt="Oxford Sports Logo" className="logo-img" />
          <span className="logo-text">
            Oxford<span>Sports</span>
          </span>
        </Link>

        {/* Search bar */}
        <form className="header-search" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Search products…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search products"
          />
          <button type="submit" aria-label="Search">🔍</button>
        </form>

        <div className="header-actions">
          {isAuthenticated ? (
            <button
              className="btn btn-sm"
              onClick={handleLogout}
              style={{
                cursor: "pointer",
                background: "#1a6fbf",
                color: "#ffffff",
                border: "none",
                fontWeight: 700,
              }}
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
        </div>

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

      {/* ── Bottom row: Navigation links ── */}
      <div className="header-nav-row">
        <div className="container">
          <nav className={`nav${open ? " open" : ""}`}>
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className={
                  l.to.includes("?")
                    ? pathname + search === l.to ? "active" : ""
                    : pathname === l.to ? "active" : ""
                }
                onClick={(e) => handleNavClick(e, l.to)}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
