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
        </div>

        {/* Quick Links */}
        <div>
          <h4>Quick Links</h4>
          <div className="footer-links">
            <Link to="/">Home</Link>
            <Link to="/rugby-category">Rugby Replica Clothing</Link>
            <Link to="/football">Football Replica Clothing</Link>
            <Link to="/footwear">adidas Footwear</Link>
            <Link to="/under-5">Under £5</Link>
            <Link to="/contact">Contact</Link>
          </div>
        </div>

        {/* Contact */}
        <div className="footer-contact">
          <h4>Contact</h4>
          <p>
            <a href="tel:01869228107">01869 228107</a>
          </p>
          <p>
            Home Farm Works
            <br />
            Clifton Road, Deddington
            <br />
            Oxon. OX15 0TP
          </p>
        </div>
      </div>

      <div className="footer-bottom container">
        &copy; {new Date().getFullYear()} Oxford Sports. All rights reserved.
      </div>
    </footer>
  );
}
