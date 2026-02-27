import { Link } from "react-router-dom";
import { buildMailto } from "../../utils/buildMailto";
import { resolveImageUrl, getDisplayPrice } from "../../api/api";

const PLACEHOLDER = "https://placehold.co/400x400/e2e8f0/64748b?text=No+Image";

export default function ProductCard({ product }) {
  const img = resolveImageUrl(product.imageUrl || product.image) || PLACEHOLDER;
  const finalPrice = getDisplayPrice(product);
  const rrp = Number(product.rrp) || 0;
  const showRrp = rrp > 0 && rrp > finalPrice;
  const isUnder5 = finalPrice > 0 && finalPrice <= 5;
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
        {product.color && (
          <p className="sku" style={{ color: "#6b7280" }}>
            {product.color}
          </p>
        )}
        {product.sizes &&
          (Array.isArray(product.sizes)
            ? product.sizes.length > 0
            : product.sizes) && (
            <p
              className="sku"
              style={{ fontSize: "0.75rem", color: "#9ca3af" }}
            >
              {Array.isArray(product.sizes)
                ? product.sizes.join(", ")
                : product.sizes}
            </p>
          )}
        <div className="product-card-footer">
          <span className="price">
            £{finalPrice.toFixed(2)}
            {showRrp && (
              <span
                style={{
                  textDecoration: "line-through",
                  color: "#9ca3af",
                  fontSize: "0.8rem",
                  marginLeft: "0.5rem",
                  fontWeight: "normal",
                }}
              >
                £{rrp.toFixed(2)}
              </span>
            )}
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
