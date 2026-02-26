import { Link } from "react-router-dom";

const PLACEHOLDER = "https://placehold.co/600x300/e2e8f0/64748b?text=Category";

export default function CategoryTile({ title, description, image, to }) {
  return (
    <Link to={to} className="category-tile">
      <img src={image || PLACEHOLDER} alt={title} loading="lazy" />
      <div className="category-tile-body">
        <h3>{title}</h3>
        {description && <p>{description}</p>}
        <span className="link">View Products →</span>
      </div>
    </Link>
  );
}
