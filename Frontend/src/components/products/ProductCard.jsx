import { useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  resolveImageUrl,
  getDisplayPrice,
  getDiscountPercentage,
  getTotalQuantity,
  getSizes,
  getMOQInfo,
} from "../../api/api";
import { useCart } from "../../context/CartContext";

const PLACEHOLDER = "https://placehold.co/400x400/e2e8f0/64748b?text=No+Image";

// Heart SVG icon - reliable across all browsers including Firefox
const HeartIcon = ({ filled = false }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="2"
    style={{ display: "block" }}
  >
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
  </svg>
);

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

  const { addToCart, isSkuInCart } = useCart();
  const productSizes = getSizes(product);
  const displaySizes = productSizes.filter(s => (s.size || "").toUpperCase() !== "ONE SIZE");
  const displayTotalQty = displaySizes.reduce((sum, s) => sum + (s.quantity || 0), 0);
  const isSoldOut = product.isActive === false || (product.totalQuantity || product.quantity || 0) <= 0;
  const hasDisplaySizes = displaySizes.length > 0 && displayTotalQty > 0;
  const isOneSizeOnly = productSizes.length === 1 && (productSizes[0].size || "").toUpperCase() === "ONE SIZE";
  
  // Use the actual totalQty for Sold Out check, but displayTotalQty for stock info
  const effectiveStock = (isOneSizeOnly && totalQty > 0) ? totalQty : displayTotalQty;
  const hasSizes = productSizes.length > 0;
  const { mustBuyAll, isLot, moqStep } = getMOQInfo(product);

  const [added, setAdded] = useState(false);

  /* Heart click → add one consolidated cart line for this SKU. */
  const handleHeartClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!hasSizes || totalQty === 0) return;

    if (alreadyInCart) {
      toast("Item already in cart", { icon: "ℹ️" });
      return;
    }

    if (isLot || mustBuyAll) {
      addToCart(product, "", 1, true);
    } else {
      addToCart(product, "", moqStep || 1);
    }
    toast.success(`${product.name} added to cart`);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  const alreadyInCart = isSkuInCart(product.sku);

  /* Derive gender from product fields */
  const genderLabel = (() => {
    const canonical = (product.genderCanonical || "").toUpperCase();
    if (canonical === "WOMENS") return "Women's";
    if (canonical === "MENS") return "Men's";
    if (canonical === "JUNIOR") return "Kids";
    if (canonical === "UNISEX") return "Unisex";

    const categoryUpper = String(product.category || "").toUpperCase();
    if (categoryUpper === "WOMENS" || categoryUpper === "WOMEN") return "Women's";
    if (categoryUpper === "MENS" || categoryUpper === "MEN") return "Men's";
    if (categoryUpper === "JUNIOR" || categoryUpper === "KIDS" || categoryUpper === "YOUTH") return "Kids";

    const text =
      `${product.name || ""} ${product.description || ""} ${product.category || ""} ${product.subcategory || ""}`.toLowerCase();
    if (
      text.includes("women") ||
      text.includes("ladies") ||
      text.includes("wmns") ||
      text.includes("female")
    )
      return "Women's";
    if (
      text.includes("kids") ||
      text.includes("junior") ||
      text.includes("youth") ||
      text.includes("children") ||
      text.includes("infant")
    )
      return "Kids";
    if (
      text.includes("men") ||
      text.includes("male") ||
      text.includes("adult")
    )
      return "Men's";
    return null;
  })();

  return (
    <div className="product-card">
      {/* ── Image area — NO link wrapper (R9 / #12) ── */}
      <div className="product-card-img-wrap">
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
          onClick={handleHeartClick}
          title={alreadyInCart ? "Already in cart" : "Add to cart"}
          disabled={totalQty === 0}
        >
          {alreadyInCart ? "✓" : <HeartIcon filled={added} />}
        </button>
      </div>

      <div className="product-card-body">
        {/* Product name — still a link for accessibility */}
        <Link
          to={detailUrl}
          style={{ color: "inherit", textDecoration: "none" }}
        >
          <h3>{product.name}</h3>
        </Link>

        {/* Product brand — only show if it's not already at the start of the name */}
        {product.brand && !product.name.toUpperCase().startsWith(product.brand.toUpperCase()) && (
          <p className="product-brand">{product.brand}</p>
        )}

        {/* ── Info tags — ALL same colour (R2 / R5 / #11) ── */}
        <div className="product-info-tags">
          {product.sku && <span className="info-tag">{product.sku}</span>}
          {genderLabel && <span className="info-tag">{genderLabel}</span>}
          {product.color && <span className="info-tag">{product.color}</span>}
        </div>



        {/* ── Available Sizes (R7 / #12) ── */}
        {hasDisplaySizes && (
          <div className="sizes-section">
            <span className="sizes-header">
              Available Sizes ({displayTotalQty > 50 ? "50+" : displayTotalQty}{" "}
              {displayTotalQty === 1 ? "unit" : "units"})
            </span>
            <div className="sizes-preview">
              {displaySizes.slice(0, 10).map((s) => (
                <span
                  key={s.size}
                  className={`size-tag${s.quantity === 0 ? " out-of-stock" : ""}`}
                >
                  {s.size}
                  {s.quantity > 0 ? `(${s.quantity})` : ""}
                </span>
              ))}
              {displaySizes.length > 10 && (
                <span className="size-tag more">
                  +{displaySizes.length - 10}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Price line — all on ONE row (R3 / R6 / #10) ── */}
        <div className="price-line">
          <span className="price">£{finalPrice.toFixed(2)}</span>
          {showRrp && (
            <span className="price-rrp">RRP: £{rrp.toFixed(2)}</span>
          )}
          {discount > 0 && (
            <span className="price-discount">{discount}% OFF</span>
          )}

        </div>

        {/* ── Stock info — dark blue (R4) ── */}
        {effectiveStock > 0 && (
          <p className="stock-info">{effectiveStock} in stock</p>
        )}

        {/* ── ORDER THIS ITEM + Heart (R10 / #13 / #19) ── */}
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "auto" }}>
          <Link
            to={detailUrl}
            className={`btn btn-order-item${totalQty === 0 ? " disabled" : ""}`}
            style={{ flex: 1 }}
            aria-disabled={totalQty === 0 ? "true" : undefined}
            tabIndex={totalQty === 0 ? -1 : undefined}
          >
            {totalQty === 0 ? "SOLD OUT" : "ORDER THIS ITEM"}
          </Link>
          {totalQty > 0 && (
            <button
              className={`btn-wishlist${added ? " added" : ""}${alreadyInCart ? " in-cart" : ""}`}
              onClick={handleHeartClick}
              title={alreadyInCart ? "Already in cart" : "Add to cart"}
            >
              {alreadyInCart ? "✓" : "♡"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
