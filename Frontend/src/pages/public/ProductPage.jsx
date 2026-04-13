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
  const { addToCart, isSkuInCart, openDrawer } = useCart();

  useEffect(() => {
    setLoading(true);
    setOrderQty(1);
    API.get(`/products/${encodeURIComponent(sku)}`)
      .then((r) => {
        setProduct(r.data);
        const fetchedTotalQty = getTotalQuantity(r.data);
        const initialQty = fetchedTotalQty > 24 ? 24 : Math.max(fetchedTotalQty, 1);
        setOrderQty(initialQty);
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
    productSizes.length === 1 &&
    String(productSizes[0]?.size || "").trim().toUpperCase() === "ONE SIZE";
  const displaySizes = productSizes;
  const { mustBuyAll, isLot } = getMOQInfo(product);

  const minOrderQty = 24;
  const maxOrderQty = totalQty > 0 ? totalQty : 9999;

  // Check if this product is in cart (any size variant)
  const alreadyInCart = isSkuInCart(product.sku);

  /**
   * Add to cart handler:
   * - isLot/mustBuyAll → buy entire lot as ONE consolidated entry (not per-size)
   * - otherwise → user picks qty, single item added
   */
  const handleAddToCart = () => {
    if (alreadyInCart) {
      toast("Item already in cart", { icon: "ℹ️" });
      return;
    }

    if (isLot) {
      // Lot items: add complete lot as qty=1, no customization
      addToCart(product, "", 1, true);
      toast.success(`Complete lot (${totalQty} units) added to cart!`);
      openDrawer();
      return;
    }

    if (mustBuyAll) {
      addToCart(product, isOneSize ? productSizes[0].size : "", totalQty);
      toast.success(`Buy-all item (${totalQty} units) added to cart!`);
      openDrawer();
      return;
    }

    // Single total-qty ordering
    if (orderQty <= 0) {
      toast.error("Enter a quantity.");
      return;
    }

    if (orderQty < minOrderQty) {
      toast.error(`Minimum order is ${minOrderQty} units.`);
      return;
    }

    if (totalQty > 0 && orderQty > totalQty) {
      toast.error(`Only ${totalQty} units are available.`);
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
            {hasSizes && displaySizes.length > 0 && (
              <div className="sizes-section" style={{ marginBottom: "1rem" }}>
                <span className="sizes-header">
                  Available Sizes ({totalQty} units)
                </span>
                <div className="sizes-preview">
                  {displaySizes.map((s) => (
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

            {/* ── Clearance Lot Warning & Size selection ── */}
            {isLot ? (
              <div style={{ marginBottom: "1.5rem" }}>
                <p style={{
                  color: "#d9534f",
                  fontWeight: 600,
                  fontSize: "1rem",
                  marginBottom: "0.5rem",
                }}>
                  ⚠️ Clearance Lot Item
                </p>
                <p style={{
                  color: "#666",
                  fontSize: "0.9rem",
                  marginBottom: "1rem",
                }}>
                  This item contains {totalQty} mixed products and must be purchased as a complete lot. No customization available.
                </p>
              </div>
            ) : null}

            {/* ── Order section ── */}
            {mustBuyAll ? (
              /* Buy-all mode — single "Add To Order" button, no qty editing */
              <div style={{ marginBottom: "1.5rem" }}>
                <p style={{
                  color: "#0f2d5c",
                  fontWeight: 600,
                  fontSize: "0.95rem",
                  marginBottom: "0.75rem",
                }}>
                  {isLot
                    ? `This item is sold as a complete lot (${totalQty} units).`
                    : `Buy all available items (${totalQty} units). Quantity selection is not available.`}
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
                    onClick={() => setOrderQty((q) => Math.max(minOrderQty, q - 1))}
                    disabled={orderQty <= minOrderQty}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={minOrderQty}
                    max={maxOrderQty}
                    step={1}
                    value={orderQty}
                    onChange={(e) => {
                      const parsed = parseInt(e.target.value, 10);
                      const v = Number.isNaN(parsed) ? minOrderQty : parsed;
                      setOrderQty(Math.max(minOrderQty, Math.min(v, maxOrderQty)));
                    }}
                    className="qty-input"
                  />
                  <button
                    className="cart-qty-btn"
                    onClick={() => {
                      setOrderQty((q) => Math.min(q + 1, maxOrderQty));
                    }}
                    disabled={totalQty > 0 && orderQty >= maxOrderQty}
                  >
                    +
                  </button>
                </div>
                {totalQty > 0 ? (
                  <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                    {totalQty} available (minimum order {minOrderQty})
                  </span>
                ) : null}
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
              {alreadyInCart && (
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
