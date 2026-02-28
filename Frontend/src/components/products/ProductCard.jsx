import { useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { resolveImageUrl, getDisplayPrice } from "../../api/api";
import { useCart } from "../../context/CartContext";

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

  const { addToCart, isInCart, openDrawer } = useCart();
  const hasSizes = Array.isArray(product.sizes) && product.sizes.length > 0;
  const hasSizeStock =
    product.sizeStock && Object.keys(product.sizeStock).length > 0;
  const needsSizeSelection = hasSizes || hasSizeStock;

  const [added, setAdded] = useState(false);

  const handleAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (needsSizeSelection) {
      // Redirect to product detail for size selection
      window.location.href = detailUrl;
      return;
    }

    addToCart(product, "", 1);
    setAdded(true);
    toast.success(`${product.name} added to cart`);
    setTimeout(() => setAdded(false), 1200);
  };

  const handleCartClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    openDrawer();
  };

  // Check if already in cart (no-size variant)
  const alreadyInCart = !needsSizeSelection && isInCart(product.sku, "");

  return (
    <div className="product-card">
      <Link to={detailUrl} style={{ position: "relative", display: "block" }}>
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
        {/* ❤️ quick-add button */}
        <button
          className={`card-heart-btn${added ? " added" : ""}${alreadyInCart ? " in-cart" : ""}`}
          onClick={alreadyInCart ? handleCartClick : handleAdd}
          title={
            needsSizeSelection
              ? "Select size first"
              : alreadyInCart
                ? "View cart"
                : "Add to cart"
          }
        >
          {alreadyInCart ? "✓" : "♥"}
        </button>
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
        {hasSizes && (
          <p className="sku" style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
            {product.sizes.join(", ")}
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
          <button
            className="btn btn-accent btn-sm"
            onClick={alreadyInCart ? handleCartClick : handleAdd}
          >
            {needsSizeSelection
              ? "Select Size"
              : alreadyInCart
                ? "In Cart ✓"
                : "Add to Cart"}
          </button>
        </div>
      </div>
    </div>
  );
}
