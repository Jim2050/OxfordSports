import { Link } from "react-router-dom";

export default function HomePage() {
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
            <Link to="/products?category=FOOTWEAR">Footwear</Link>
            <Link to="/products?category=CLOTHING">Clothing</Link>
            <Link to="/products?category=ACCESSORIES">Accessories</Link>
            <Link to="/products?category=LICENSED+TEAM+CLOTHING">Licensed Team Clothing</Link>
            <Link to="/products?category=B+GRADE">B Grade</Link>
            <Link to="/products?category=JOB+LOTS">Job Lots</Link>
            <Link to="/products?category=UNDER+%C2%A35">Under £5</Link>
            <Link to="/products">Brands</Link>
            <Link to="/products?category=SPORTS">Sports</Link>
            <Link to="/products">Shop All</Link>
          </div>
        </div>
      </section>
    </>
  );
}
