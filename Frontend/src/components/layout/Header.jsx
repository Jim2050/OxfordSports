import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

export default function Header() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  const links = [
    { to: "/", label: "Home" },
    { to: "/rugby-category", label: "Rugby" },
    { to: "/football", label: "Football" },
    { to: "/footwear", label: "Footwear" },
    { to: "/under-5", label: "Under £5" },
    { to: "/products", label: "All Products" },
    { to: "/contact", label: "Contact" },
  ];

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
          <Link
            to="/register"
            className="btn btn-primary btn-sm"
            onClick={() => setOpen(false)}
          >
            Register / Sign In
          </Link>
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
