import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchPublicCategories } from "../../api/api";
import {
  formatTaxonomyLabel,
  getCategoryHref,
  getNavigableCategories,
} from "../../utils/taxonomy";

export default function Footer() {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    let active = true;
    fetchPublicCategories()
      .then((data) => {
        if (!active) return;
        setCategories(Array.isArray(data?.categories) ? data.categories : []);
      })
      .catch(() => {
        if (!active) return;
        setCategories([]);
      });

    return () => {
      active = false;
    };
  }, []);

  const quickLinks = getNavigableCategories(categories);

  return (
    <footer className="footer">
      <div className="container footer-grid">
        {/* Brand */}
        <div className="footer-brand">
          <Link to="/" className="logo-text" style={{ fontSize: "1.15rem" }}>
            Oxford<span>Sports</span>
          </Link>
          <p>
            Branded wholesale sportswear &amp; equipment at unbeatable prices.
          </p>
          <div className="footer-contact-inline">
            <a href="tel:01869228107">01869 228107</a>
            <span>Home Farm Works, Clifton Road, Deddington, Oxon. OX15 0TP</span>
          </div>
        </div>

        {/* Quick Links — two columns */}
        <div>
          <h4>Quick Links</h4>
          <div className="footer-links">
            <Link to="/">Home</Link>
            {quickLinks.map((category) => (
              <Link key={category._id || category.name} to={getCategoryHref(category.name)}>
                {formatTaxonomyLabel(category.name)}
              </Link>
            ))}
            <Link to="/products">All Products</Link>
            <Link to="/contact">Contact</Link>
          </div>
        </div>
      </div>

      <div className="footer-bottom container">
        &copy; {new Date().getFullYear()} Oxford Sports. All rights reserved.
      </div>
    </footer>
  );
}
