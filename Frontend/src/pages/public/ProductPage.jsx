import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
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
import API from "../../api/axiosInstance";

const PLACEHOLDER = "https://placehold.co/600x600/e2e8f0/64748b?text=No+Image";

export default function ProductPage() {
  const { sku } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  // Total qty the customer wants to order
  const [orderQty, setOrderQty] = useState(1);
  const { addToCart, isInCart, openDrawer } = useCart();

  useEffect(() => {
    setLoading(true);
    setOrderQty(1);
    API.get(`/products/${encodeURIComponent(sku)}`)
      .then((r) => {
        setProduct(r.data);
        // Set initial qty to match MOQ step (footwear = 12)
        const cat = (r.data?.category || "").toUpperCase();
        setOrderQty(cat === "FOOTWEAR" ? 12 : 1);
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [sku]);

  if (loading) {
    return (
      <section className="section">
        <div className="container loading-center">
          <div className="spinner" />
        </div>
      </section>
    );
  }

  if (!product) {
    return (
      <section className="section">
        <div
          className="container"
          style={{ textAlign: "center", padding: "4rem 0" }}
        >
          <h2>Product Not Found</h2>
          <p style={{ color: "#6b7280", marginBottom: "1.5rem" }}>
            The product you&apos;re looking for doesn&apos;t exist or may have
            been removed.
          </p>
          <Link to="/products" className="btn btn-primary">
            Browse All Products
          </Link>
        </div>
      </section>
    );
  }

  const img = resolveImageUrl(product.imageUrl || product.image) || PLACEHOLDER;
  const finalPrice = getDisplayPrice(product);
  const rrp = Number(product.rrp) || 0;
  const showRrp = rrp > 0 && rrp > finalPrice;
  const discount = getDiscountPercentage(product);
  const totalQty = getTotalQuantity(product);
  const isUnder5 = finalPrice > 0 && finalPrice <= 5;

  const productSizes = getSizes(product);
  const hasSizes = productSizes.length > 0;
  const isOneSize =
    productSizes.length === 1 && productSizes[0].size === "ONE SIZE";
  const { mustBuyAll } = getMOQInfo(product);

  // Quantity step: footwear orders in multiples of 12
  const isFootwear = (product.category || "").toUpperCase() === "FOOTWEAR";
  const qtyStep = isFootwear ? 12 : 1;

  // Check if any variant is in cart
  const anySizeInCart = productSizes.some((s) => isInCart(product.sku, s.size));

  /**
   * Add to cart handler:
   * - mustBuyAll → buy entire lot, all sizes, all quantities (no editing)
   * - otherwise  → user picks a total qty, sizes distributed by pro rata on backend
   */
  const handleAddToCart = () => {
    if (mustBuyAll) {
      // Add every size at its full quantity, mark as lot item
      productSizes.forEach((s) => {
        if (s.quantity > 0) addToCart(product, s.size, s.quantity, true);
      });
      toast.success(`Entire lot of ${product.name} added to cart!`);
      return;
    }

    // Single total-qty ordering  
    if (orderQty <= 0) {
      toast.error("Enter a quantity.");
      return;
    }
    addToCart(product, isOneSize ? productSizes[0].size : "", orderQty);
    toast.success(`${orderQty} × ${product.name} added to cart!`);
  };

  return (
    <>
      <section className="page-banner">
        <div className="container">
          <h1>{product.name}</h1>
          {product.category && <p>{product.category}</p>}
        </div>
      </section>

      <section className="section">
        <div className="container product-detail">
          <div className="product-detail-img">
            <img
              src={img}
              alt={product.name}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = PLACEHOLDER;
              }}
            />
          </div>
          <div className="product-detail-info">
            {product.sku && (
              <p className="sku" style={{ marginBottom: "0.5rem" }}>
                SKU: {product.sku}
              </p>
            )}
            {product.brand && (
              <p style={{ color: "#6b7280", marginBottom: "0.5rem" }}>
                Brand: <strong>{product.brand}</strong>
              </p>
            )}
            {product.color && (
              <p style={{ color: "#6b7280", marginBottom: "0.5rem" }}>
                Colour: <strong>{product.color}</strong>
              </p>
            )}

            {/* ── Price display with discount ── */}
            <div className="price-block">
              <span className="price-main">£{finalPrice.toFixed(2)}</span>
              {showRrp && (
                <span className="price-rrp-detail">
                  <span style={{ textDecoration: "line-through" }}>
                    £{rrp.toFixed(2)}
                  </span>
                </span>
              )}
              {discount > 0 && (
                <span className="discount-tag">{discount}% OFF</span>
              )}
              {isUnder5 && <span className="price-under5">UNDER £5</span>}
            </div>

            {totalQty > 0 && (
              <p
                style={{
                  color: "#0f2d5c",
                  fontSize: "0.9rem",
                  marginBottom: "0.5rem",
                  fontWeight: 600,
                }}
              >
                {totalQty} total in stock
              </p>
            )}

            {product.description && (
              <p style={{ marginBottom: "1.5rem", lineHeight: 1.7 }}>
                {product.description}
              </p>
            )}

            {/* ── Sizes at a glance (read-only) ── */}
            {hasSizes && !isOneSize && (
              <div className="sizes-section" style={{ marginBottom: "1rem" }}>
                <span className="sizes-header">
                  Available Sizes ({totalQty} units) — Sold pro rata from sizes below
                </span>
                <div className="sizes-preview">
                  {productSizes.map((s) => (
                    <span
                      key={s.size}
                      className={`size-tag${s.quantity === 0 ? " out-of-stock" : ""}`}
                    >
                      {s.size}
                      {s.quantity > 0 ? ` (${s.quantity})` : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── Order section ── */}
            {mustBuyAll ? (
              /* Lot item — single "Add To Order" button, no qty editing */
              <div style={{ marginBottom: "1.5rem" }}>
                <p style={{
                  color: "#0f2d5c",
                  fontWeight: 600,
                  fontSize: "0.95rem",
                  marginBottom: "0.75rem",
                }}>
                  This item is sold as a complete lot ({totalQty} units).
                </p>
              </div>
            ) : (
              /* Normal item — total quantity picker only */
              <div
                style={{
                  marginBottom: "1.5rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                }}
              >
                <strong>Qty:</strong>
                <div className="qty-selector">
                  <button
                    className="cart-qty-btn"
                    onClick={() => setOrderQty((q) => Math.max(qtyStep, q - qtyStep))}
                    disabled={orderQty <= qtyStep}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={qtyStep}
                    max={totalQty > 0 ? totalQty : 9999}
                    step={qtyStep}
                    value={orderQty}
                    onChange={(e) => {
                      const v = parseInt(e.target.value) || qtyStep;
                      const rounded = Math.max(qtyStep, Math.round(v / qtyStep) * qtyStep);
                      setOrderQty(totalQty > 0 ? Math.min(rounded, totalQty) : rounded);
                    }}
                    className="qty-input"
                  />
                  <button
                    className="cart-qty-btn"
                    onClick={() =>
                      setOrderQty((q) =>
                        totalQty > 0 ? Math.min(q + qtyStep, totalQty) : q + qtyStep,
                      )
                    }
                    disabled={totalQty > 0 && orderQty >= totalQty}
                  >
                    +
                  </button>
                </div>
                {totalQty > 0 && (
                  <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                    {totalQty} available{isFootwear ? " (multiples of 12)" : ""}
                  </span>
                )}
              </div>
            )}

            {/* ── Add to cart / View cart buttons ── */}
            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                flexWrap: "wrap",
                marginTop: "1rem",
              }}
            >
              <button
                className="btn btn-accent btn-lg"
                onClick={handleAddToCart}
                disabled={totalQty === 0}
              >
                {mustBuyAll
                  ? `Add To Order (${totalQty} units) — £${(totalQty * finalPrice).toFixed(2)}`
                  : "Add To Order"}
              </button>
              {anySizeInCart && (
                <button className="btn btn-primary btn-lg" onClick={openDrawer}>
                  View Cart ✓
                </button>
              )}
              <Link
                to="/products"
                className="btn btn-outline"
                style={{ alignSelf: "center" }}
              >
                Back to Products
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
