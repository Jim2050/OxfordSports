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
  const { mustBuyAll } = getMOQInfo(product);

  const [added, setAdded] = useState(false);

  /* Heart click → quick-add to cart.
     mustBuyAll → adds ALL available sizes at full qty.
     Otherwise → adds 1 of first available size. */
  const handleHeartClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!hasSizes || totalQty === 0) return;

    if (mustBuyAll) {
      productSizes.forEach((s) => {
        if (s.quantity > 0) addToCart(product, s.size, s.quantity);
      });
      setAdded(true);
      toast.success(`Entire lot of ${product.name} added to cart`);
    } else {
      const firstAvail = productSizes.find((s) => s.quantity > 0);
      if (!firstAvail) return;
      addToCart(product, firstAvail.size, 1);
      setAdded(true);
      toast.success(`${product.name} added to cart`);
    }
    setTimeout(() => setAdded(false), 1200);
  };

  const handleCartClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    openDrawer();
  };

  const firstSize =
    productSizes.find((s) => s.quantity > 0)?.size ||
    productSizes[0]?.size ||
    "";
  const alreadyInCart = isInCart(product.sku, firstSize);

  /* Derive gender from product fields */
  const genderLabel = (() => {
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
          onClick={alreadyInCart ? handleCartClick : handleHeartClick}
          title={alreadyInCart ? "View cart" : "Add to cart"}
          disabled={totalQty === 0}
        >
          {alreadyInCart ? "✓" : "♡"}
        </button>
        {totalQty === 0 && <span className="sold-out-badge">Sold Out</span>}
      </div>

      <div className="product-card-body">
        {/* Product name — still a link for accessibility */}
        <Link
          to={detailUrl}
          style={{ color: "inherit", textDecoration: "none" }}
        >
          <h3>{product.name}</h3>
        </Link>

        {product.brand && <p className="product-brand">{product.brand}</p>}

        {/* ── Info tags — ALL same colour (R2 / R5 / #11) ── */}
        <div className="product-info-tags">
          {product.sku && <span className="info-tag">{product.sku}</span>}
          {genderLabel && <span className="info-tag">{genderLabel}</span>}
          {product.color && <span className="info-tag">{product.color}</span>}
        </div>



        {/* ── Available Sizes (R7 / #12) ── */}
        {hasSizes && (
          <div className="sizes-section">
            <span className="sizes-header">
              Available Sizes ({totalQty}{" "}
              {totalQty === 1 ? "unit" : "units"}) — Sold pro rata from sizes below
            </span>
            <div className="sizes-preview">
              {productSizes.slice(0, 10).map((s) => (
                <span
                  key={s.size}
                  className={`size-tag${s.quantity === 0 ? " out-of-stock" : ""}`}
                >
                  {s.size}
                  {s.quantity > 0 ? `(${s.quantity})` : ""}
                </span>
              ))}
              {productSizes.length > 10 && (
                <span className="size-tag more">
                  +{productSizes.length - 10}
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
          {isUnder5 && <span className="price-under5">UNDER £5</span>}
        </div>

        {/* ── Stock info — dark blue (R4) ── */}
        {totalQty > 0 && <p className="stock-info">{totalQty} in stock</p>}

        {/* ── ORDER THIS ITEM + Heart (R10 / #13 / #19) ── */}
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "auto" }}>
          <Link
            to={detailUrl}
            className={`btn btn-order-item${totalQty === 0 ? " disabled" : ""}`}
            style={{ flex: 1 }}
          >
            {totalQty === 0 ? "SOLD OUT" : "ORDER THIS ITEM"}
          </Link>
          {totalQty > 0 && (
            <button
              className={`btn-wishlist${added ? " added" : ""}${alreadyInCart ? " in-cart" : ""}`}
              onClick={alreadyInCart ? handleCartClick : handleHeartClick}
              title={alreadyInCart ? "View cart" : "Add to cart"}
            >
              {alreadyInCart ? "✓" : "♡"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
