import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
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
    e.nativeEvent?.stopImmediatePropagation?.();

    if (needsSizeSelection) {
      // For products needing size selection, take user to detail page
      navigate(detailUrl);
      return;
    }

    // Get the current product's size
    const size = productSizes[0]?.size || "";

    // Add to cart with current product reference
    addToCart(product, size, 1);
    setAdded(true);
    toast.success(`${product.name} added to cart`);
    setTimeout(() => setAdded(false), 1200);
  };

  const handleCartClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent?.stopImmediatePropagation?.();
    openDrawer();
  };

  const alreadyInCart =
    !needsSizeSelection && isInCart(product.sku, productSizes[0]?.size || "");

  const isOutOfStock = totalQty === 0;

  return (
    <div className="product-card">
      <div style={{ position: "relative" }}>
        <Link to={detailUrl} style={{ display: "block" }}>
          {discount > 0 && (
            <span className="discount-badge">{discount}% OFF</span>
          )}
          {isOutOfStock && (
            <span
              className="discount-badge"
              style={{ background: "#6b7280", left: "auto", right: "10px" }}
            >
              OUT OF STOCK
            </span>
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
        </Link>
        <button
          className={`card-heart-btn${added ? " added" : ""}${alreadyInCart ? " in-cart" : ""}`}
          onClick={alreadyInCart ? handleCartClick : handleAdd}
          disabled={isOutOfStock && !alreadyInCart}
          title={
            isOutOfStock
              ? "Out of stock"
              : needsSizeSelection
                ? "Select size first"
                : alreadyInCart
                  ? "View cart"
                  : "Add to cart"
          }
        >
          {alreadyInCart ? "✓" : "♥"}
        </button>
      </div>
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
        {totalQty === 0 && (
          <p className="stock-info" style={{ color: "#ef4444" }}>
            Out of stock
          </p>
        )}
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
            disabled={isOutOfStock && !alreadyInCart}
          >
            {isOutOfStock
              ? "Out of Stock"
              : needsSizeSelection
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
