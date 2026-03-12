import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";

/* ── Auth-gated page list ── */
const PUBLIC_PATHS = new Set(["/", "/contact", "/register"]);
const isPublicPath = (to) => PUBLIC_PATHS.has(to.split("?")[0]);

/* ────────────────────────────────────────────────────────────
   NAV ITEMS — full category / subcategory structure per Jim's
   WEBSITE_CATEGORIES_YASIR file.
   ──────────────────────────────────────────────────────────── */
const sub = (cat, name) =>
  `/products?category=${encodeURIComponent(cat)}&subcategory=${encodeURIComponent(name)}`;

const navItems = [
  { to: "/", label: "Home" },
  {
    to: "/products?category=FOOTWEAR",
    label: "Footwear",
    children: [
      { to: sub("FOOTWEAR", "TRAINERS"), label: "Trainers" },
      { to: sub("FOOTWEAR", "FOOTBALL BOOTS"), label: "Football Boots" },
      { to: sub("FOOTWEAR", "RUGBY BOOTS"), label: "Rugby Boots" },
      { to: sub("FOOTWEAR", "BEACH FOOTWEAR"), label: "Beach Footwear" },
      { to: sub("FOOTWEAR", "GOLF SHOES"), label: "Golf Shoes" },
      { to: sub("FOOTWEAR", "TENNIS / PADEL SHOES"), label: "Tennis / Padel Shoes" },
      { to: sub("FOOTWEAR", "SPECIALIST FOOTWEAR"), label: "Specialist Footwear" },
    ],
  },
  {
    to: "/products?category=CLOTHING",
    label: "Clothing",
    children: [
      { to: sub("CLOTHING", "SHIRTS"), label: "Shirts" },
      { to: sub("CLOTHING", "SHORTS"), label: "Shorts" },
      { to: sub("CLOTHING", "JACKETS & COATS"), label: "Jackets & Coats" },
      { to: sub("CLOTHING", "HOODS & SWEATERS"), label: "Hoods & Sweaters" },
      { to: sub("CLOTHING", "SOCKS & GLOVES"), label: "Socks & Gloves" },
      { to: sub("CLOTHING", "HATS & CAPS"), label: "Headwear" },
      { to: sub("CLOTHING", "TRACKSUITS & JOGGERS"), label: "Tracksuits & Joggers" },
      { to: sub("CLOTHING", "SWIMWEAR"), label: "Swimwear" },
      { to: sub("CLOTHING", "LEGGINGS"), label: "Leggings" },
      { to: sub("CLOTHING", "VESTS & BRAS"), label: "Vests & Bras" },
    ],
  },
  {
    to: "/products?category=LICENSED+TEAM+CLOTHING",
    label: "Licensed Team Clothing",
    children: [
      { to: sub("LICENSED TEAM CLOTHING", "SHIRTS"), label: "Shirts & Jerseys" },
      { to: sub("LICENSED TEAM CLOTHING", "JACKETS"), label: "Jackets" },
      { to: sub("LICENSED TEAM CLOTHING", "HATS & CAPS"), label: "Headwear" },
      { to: sub("LICENSED TEAM CLOTHING", "ACCESSORIES"), label: "Accessories" },
      { to: sub("LICENSED TEAM CLOTHING", "TRACKSUITS & JOGGERS"), label: "Tracksuits & Joggers" },
      { to: sub("LICENSED TEAM CLOTHING", "SOCKS"), label: "Socks" },
      { to: sub("LICENSED TEAM CLOTHING", "BAGS & HOLDALLS"), label: "Bags & Holdalls" },
    ],
  },
  {
    to: "/products?category=ACCESSORIES",
    label: "Accessories",
    children: [
      { to: sub("ACCESSORIES", "BALLS"), label: "Balls" },
      { to: sub("ACCESSORIES", "BAGS & HOLDALLS"), label: "Bags & Holdalls" },
      { to: sub("ACCESSORIES", "HEADWEAR"), label: "Headwear" },
      { to: sub("ACCESSORIES", "GLOVES"), label: "Gloves" },
      { to: sub("ACCESSORIES", "RACKETS & BATS"), label: "Rackets & Bats" },
      { to: sub("ACCESSORIES", "SPORTS TOWELS"), label: "Sports Towels" },
      { to: sub("ACCESSORIES", "PROTECTIVE GEAR"), label: "Protective Gear" },
      { to: sub("ACCESSORIES", "SUNGLASSES"), label: "Sunglasses" },
      { to: sub("ACCESSORIES", "WATCHES MONITORS"), label: "Watches & Monitors" },
    ],
  },
  {
    to: "/products",
    label: "Brands",
    children: [
      { to: "/products?brand=ADIDAS", label: "Adidas" },
      { to: "/products?brand=UNDER+ARMOUR", label: "Under Armour" },
      { to: "/products?brand=REEBOK", label: "Reebok" },
      { to: "/products?brand=PUMA", label: "Puma" },
      { to: "/products?brand=CASTORE", label: "Castore" },
      { to: "/products?brand=NIKE", label: "Nike" },
      { to: "/products?brand=MOLTEN", label: "Molten" },
      { to: "/products?brand=GUNN+%26+MOORE", label: "Gunn & Moore" },
      { to: "/products?brand=UNICORN", label: "Unicorn" },
      { to: "/products?brand=UHLSPORT", label: "Uhlsport" },
      { to: "/products?brand=NEW+BALANCE", label: "New Balance" },
    ],
  },
  {
    to: "/products?category=SPORTS",
    label: "Sports",
    children: [
      { to: sub("SPORTS", "FOOTBALL"), label: "Football" },
      { to: sub("SPORTS", "RUGBY"), label: "Rugby" },
      { to: sub("SPORTS", "CRICKET"), label: "Cricket" },
      { to: sub("SPORTS", "ATHLETICS"), label: "Athletics" },
      { to: sub("SPORTS", "SWIMMING"), label: "Swimming" },
      { to: sub("SPORTS", "BASKETBALL"), label: "Basketball" },
      { to: sub("SPORTS", "HOCKEY"), label: "Hockey" },
      { to: sub("SPORTS", "TENNIS"), label: "Tennis" },
      { to: sub("SPORTS", "BADMINTON"), label: "Badminton" },
      { to: sub("SPORTS", "SQUASH"), label: "Squash" },
      { to: sub("SPORTS", "PADEL"), label: "Padel" },
      { to: sub("SPORTS", "TABLE TENNIS"), label: "Table Tennis" },
      { to: sub("SPORTS", "CYCLING"), label: "Cycling" },
      { to: sub("SPORTS", "BOXING / MARTIAL ARTS"), label: "Boxing / Martial Arts" },
      { to: sub("SPORTS", "SKIING / SNOWBOARDING"), label: "Skiing / Snowboarding" },
      { to: sub("SPORTS", "YOGA / FITNESS"), label: "Yoga / Fitness" },
      { to: sub("SPORTS", "SNOOKER / POOL"), label: "Snooker / Pool" },
      { to: sub("SPORTS", "DARTS"), label: "Darts" },
    ],
  },
  { to: "/products?category=B+GRADE", label: "B Grade" },
  { to: "/under-5", label: "Under £5" },
  { to: "/products", label: "All Products" },
  { to: "/contact", label: "Contact" },
];

/* ─────── Component ─────── */
export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [openDropdown, setOpenDropdown] = useState(null); // index of open dropdown (mobile)
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
