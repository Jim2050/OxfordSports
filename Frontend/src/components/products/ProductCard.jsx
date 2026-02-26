import { Link } from "react-router-dom";
import { buildMailto } from "../../utils/buildMailto";
import { resolveImageUrl } from "../../api/api";

const PLACEHOLDER = "https://placehold.co/400x400/e2e8f0/64748b?text=No+Image";

export default function ProductCard({ product }) {
  const img = resolveImageUrl(product.imageUrl || product.image) || PLACEHOLDER;
  const isUnder5 = Number(product.price) <= 5;
  const detailUrl = product.sku
    ? `/product/${encodeURIComponent(product.sku)}`
    : "#";

  return (
    <div className="product-card">
      <Link to={detailUrl}>
        <img
          className="product-card-img"
          src={img}
          alt={product.name}
          loading="lazy"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = PLACEHOLDER;
          }}
        />
      </Link>
      <div className="product-card-body">
        <Link
          to={detailUrl}
          style={{ color: "inherit", textDecoration: "none" }}
        >
          <h3>{product.name}</h3>
        </Link>
        {product.sku && <p className="sku">SKU: {product.sku}</p>}
        {product.description && (
          <p className="description">{product.description}</p>
        )}
        <div className="product-card-footer">
          <span className="price">
            £{Number(product.price).toFixed(2)}
            {isUnder5 && <span className="price-under5">UNDER £5</span>}
          </span>
          <a href={buildMailto(product)} className="btn btn-accent btn-sm">
            Order by Email
          </a>
        </div>
      </div>
    </div>
  );
}
