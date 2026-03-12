import { Link } from "react-router-dom";

export default function Footer() {
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
            <Link to="/products?category=FOOTWEAR">Footwear</Link>
            <Link to="/products?category=CLOTHING">Clothing</Link>
            <Link to="/products?category=ACCESSORIES">Accessories</Link>
            <Link to="/products?category=LICENSED+TEAM+CLOTHING">Licensed Team Clothing</Link>
            <Link to="/products?category=SPORTS">Sports</Link>
            <Link to="/products?category=B+GRADE">B Grade</Link>
            <Link to="/products?category=JOB+LOTS">Job Lots</Link>
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
