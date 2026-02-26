import { Link } from "react-router-dom";
import CategoryTile from "../../components/categories/CategoryTile";

const CATEGORIES = [
  {
    title: "Rugby Replica Clothing",
    description:
      "Authentic adidas rugby clearance stock. Brand new with tags at wholesale prices.",
    to: "/rugby-category",
    image: "https://placehold.co/600x300/1a1281/ffffff?text=Rugby",
  },
  {
    title: "Football Replica Clothing",
    description:
      "Authentic adidas football club clearance stock. Brand new with tags at wholesale prices.",
    to: "/football",
    image: "https://placehold.co/600x300/1a1281/ffffff?text=Football",
  },
  {
    title: "adidas Footwear",
    description:
      "Authentic adidas footwear clearance stock. Brand new with tags at wholesale prices.",
    to: "/footwear",
    image: "https://placehold.co/600x300/1a1281/ffffff?text=Footwear",
  },
  {
    title: "Under £5",
    description: "Incredible deals on branded sportswear all under £5.",
    to: "/under-5",
    image: "https://placehold.co/600x300/fd0808/ffffff?text=Under+%C2%A35",
  },
];

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
            <Link to="/rugby-category">Rugby Replica Clothing</Link>
            <Link to="/football">Football Replica Clothing</Link>
            <Link to="/footwear">adidas Footwear</Link>
            <Link to="/under-5">Under £5</Link>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="section">
        <div className="container">
          <div className="category-grid">
            {CATEGORIES.map((c) => (
              <CategoryTile key={c.to} {...c} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
