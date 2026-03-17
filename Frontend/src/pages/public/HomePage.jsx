import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchPublicCategories } from "../../api/api";
import {
  formatTaxonomyLabel,
  getCategoryHref,
  getNavigableCategories,
} from "../../utils/taxonomy";

export default function HomePage() {
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

  const heroCategories = getNavigableCategories(categories);

  return (
    <>
      {/* Hero */}
      <section className="hero">
        <div className="container hero-content">
          <span className="badge">WHOLESALE CLEARANCE</span>
          <h1>Branded Sportswear Wholesale</h1>
          <p>
            Authentic end-of-season clearance on branded sportswear at
            unbeatable prices. No more surfing through countless spreadsheets —
            this is your one stop ordering form for our clearance offers.
          </p>

          <div className="cta-box">
            <p>To register for our members-only website:</p>
            <Link to="/register" className="btn btn-accent">
              Register Now
            </Link>
          </div>

          <div className="hero-links">
            {heroCategories.map((category) => (
              <Link key={category._id || category.name} to={getCategoryHref(category.name)}>
                {formatTaxonomyLabel(category.name)}
              </Link>
            ))}
            <Link to="/products">Shop All</Link>
          </div>
        </div>
      </section>
    </>
  );
}
