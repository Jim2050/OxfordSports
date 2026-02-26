import { buildMailto } from "../../utils/buildMailto";

const PLACEHOLDER = "https://placehold.co/400x400/e2e8f0/64748b?text=No+Image";

export default function ProductCard({ product }) {
  const img = product.imageUrl || product.image || PLACEHOLDER;
  const isUnder5 = Number(product.price) <= 5;

  return (
    <div className="product-card">
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
      <div className="product-card-body">
        <h3>{product.name}</h3>
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
