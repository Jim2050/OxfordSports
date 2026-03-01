import { useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  resolveImageUrl,
  getDisplayPrice,
  getDiscountPercentage,
  getTotalQuantity,
  getSizes,
} from "../../api/api";
import { useCart } from "../../context/CartContext";

const PLACEHOLDER = "https://placehold.co/400x400/e2e8f0/64748b?text=No+Image";

export default function ProductCard({ product }) {
  const img = resolveImageUrl(product.imageUrl || product.image) || PLACEHOLDER;
  const finalPrice = getDisplayPrice(product);
  const rrp = Number(product.rrp) || 0;
  const showRrp = rrp > 0 && rrp > finalPrice;
  const discount = getDiscountPercentage(product);
  const totalQty = getTotalQuantity(product);
  const isUnder5 = finalPrice > 0 && finalPrice <= 5;
  const detailUrl = product.sku
    ? `/product/${encodeURIComponent(product.sku)}`
    : "#";

  const { addToCart, isInCart, openDrawer } = useCart();
  const productSizes = getSizes(product);
  const hasSizes = productSizes.length > 0;
  const needsSizeSelection =
    hasSizes &&
    !(productSizes.length === 1 && productSizes[0].size === "ONE SIZE");

  const [added, setAdded] = useState(false);

  const handleAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (needsSizeSelection) {
      window.location.href = detailUrl;
      return;
    }

    addToCart(product, productSizes[0]?.size || "", 1);
    setAdded(true);
    toast.success(`${product.name} added to cart`);
    setTimeout(() => setAdded(false), 1200);
  };

  const handleCartClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    openDrawer();
  };

  const alreadyInCart =
    !needsSizeSelection && isInCart(product.sku, productSizes[0]?.size || "");

  return (
    <div className="product-card">
      <Link to={detailUrl} style={{ position: "relative", display: "block" }}>
        {discount > 0 && (
          <span className="discount-badge">{discount}% OFF</span>
        )}
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
        {product.brand && (
          <p
            className="sku"
            style={{
              color: "#6b7280",
              fontSize: "0.8rem",
              marginBottom: "0.15rem",
            }}
          >
            {product.brand}
          </p>
        )}
        {product.sku && <p className="sku">SKU: {product.sku}</p>}
        {product.color && (
          <p className="sku" style={{ color: "#6b7280" }}>
            {product.color}
          </p>
        )}
        {hasSizes && needsSizeSelection && (
          <div className="sizes-preview">
            <span className="sizes-label">Sizes:</span>
            {productSizes.slice(0, 8).map((s) => (
              <span
                key={s.size}
                className={`size-tag${s.quantity === 0 ? " out-of-stock" : ""}`}
                title={
                  s.quantity > 0 ? `${s.quantity} available` : "Out of stock"
                }
              >
                {s.size}
                {s.quantity > 0 ? ` (${s.quantity})` : ""}
              </span>
            ))}
            {productSizes.length > 8 && (
              <span className="size-tag more">+{productSizes.length - 8}</span>
            )}
          </div>
        )}
        {totalQty > 0 && <p className="stock-info">{totalQty} in stock</p>}
        <div className="product-card-footer">
          <span className="price">
            £{finalPrice.toFixed(2)}
            {showRrp && <span className="price-rrp">£{rrp.toFixed(2)}</span>}
            {discount > 0 && (
              <span className="price-discount">{discount}% OFF</span>
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
