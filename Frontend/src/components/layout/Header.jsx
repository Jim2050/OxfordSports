import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { fetchPublicCategories } from "../../api/api";
import {
  formatTaxonomyLabel,
  getCategoryHref,
  getNavigableCategories,
  getSubcategoryHref,
} from "../../utils/taxonomy";

/* ── Auth-gated page list ── */
const PUBLIC_PATHS = new Set(["/", "/contact", "/register"]);
const isPublicPath = (to) => PUBLIC_PATHS.has(to.split("?")[0]);

/* ─────── Component ─────── */
export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [openDropdown, setOpenDropdown] = useState(null); // index of open dropdown (mobile)
  const [catalogCategories, setCatalogCategories] = useState([]);
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();
  const { itemCount, openDrawer } = useCart();
  const navRef = useRef(null);

  /* Close dropdowns when clicking outside */
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* Close mobile menu on route change */
  useEffect(() => {
    setMenuOpen(false);
    setOpenDropdown(null);
  }, [pathname, search]);

  useEffect(() => {
    let active = true;
    fetchPublicCategories()
      .then((data) => {
        if (!active) return;
        setCatalogCategories(Array.isArray(data?.categories) ? data.categories : []);
      })
      .catch(() => {
        if (!active) return;
        setCatalogCategories([]);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate("/");
  };

  const handleNavClick = useCallback(
    (e, to) => {
      setMenuOpen(false);
      setOpenDropdown(null);
      if (!isAuthenticated && !isPublicPath(to)) {
        e.preventDefault();
        toast("Please sign in to access wholesale pages", { icon: "🔒" });
        navigate("/register", { state: { from: to } });
      }
    },
    [isAuthenticated, navigate],
  );

  const handleSearch = (e) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    if (!isAuthenticated) {
      toast("Please sign in to search products", { icon: "🔒" });
      navigate("/register", {
        state: { from: `/products?search=${encodeURIComponent(q)}` },
      });
      return;
    }
    navigate(`/products?search=${encodeURIComponent(q)}`);
    setSearchQuery("");
    setMenuOpen(false);
  };

  const isActive = (to) => {
    if (to.includes("?")) return pathname + search === to;
    return pathname === to;
  };

  const navItems = [
    { to: "/", label: "Home" },
    ...getNavigableCategories(catalogCategories).map((category) => ({
      to: getCategoryHref(category.name),
      label: formatTaxonomyLabel(category.name),
      children: Array.isArray(category.subcategories) && category.subcategories.length > 0
        ? category.subcategories.map((subcategory) => ({
            to: getSubcategoryHref(category.name, subcategory.name),
            label: formatTaxonomyLabel(subcategory.name),
          }))
        : undefined,
    })),
    { to: "/under-5", label: "Under £5" },
    { to: "/products", label: "All Products" },
    { to: "/contact", label: "Contact" },
  ];

  /* Toggle sub-menu (mobile accordion) */
  const toggleDropdown = (idx) =>
    setOpenDropdown((prev) => (prev === idx ? null : idx));

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
              onClick={() => setMenuOpen(false)}
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
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menu"
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {/* ── Bottom row: Navigation with dropdowns ── */}
      <div className="header-nav-row">
        <div className="container">
          <nav ref={navRef} className={`nav${menuOpen ? " open" : ""}`}>
            {navItems.map((item, idx) => {
              if (!item.children) {
                /* Simple link — no dropdown */
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`nav-link${isActive(item.to) ? " active" : ""}`}
                    onClick={(e) => handleNavClick(e, item.to)}
                  >
                    {item.label}
                  </Link>
                );
              }

              /* Link with dropdown children */
              const isOpen = openDropdown === idx;
              return (
                <div
                  key={item.to}
                  className={`nav-item has-dropdown${isOpen ? " dropdown-open" : ""}`}
                >
                  {/* Parent link — navigates on desktop, toggles on mobile */}
                  <span className="nav-item-row">
                    <Link
                      to={item.to}
                      className={`nav-link${isActive(item.to) ? " active" : ""}`}
                      onClick={(e) => handleNavClick(e, item.to)}
                    >
                      {item.label}
                    </Link>
                    <button
                      className="dropdown-arrow"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleDropdown(idx);
                      }}
                      aria-label={`Toggle ${item.label} submenu`}
                    >
                      ▾
                    </button>
                  </span>

                  {/* Dropdown panel */}
                  <div
                    className={`nav-dropdown${item.children.length > 9 ? " two-col" : ""}`}
                  >
                    <Link
                      to={item.to}
                      className="dropdown-link dropdown-view-all"
                      onClick={(e) => handleNavClick(e, item.to)}
                    >
                      View All {item.label}
                    </Link>
                    {item.children.map((child) => (
                      <Link
                        key={child.to}
                        to={child.to}
                        className="dropdown-link"
                        onClick={(e) => handleNavClick(e, child.to)}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
