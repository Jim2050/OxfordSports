import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  resolveImageUrl,
  getDisplayPrice,
  getDiscountPercentage,
  getTotalQuantity,
  getSizes,
} from "../../api/api";
import { useCart } from "../../context/CartContext";
import API from "../../api/axiosInstance";

const PLACEHOLDER = "https://placehold.co/600x600/e2e8f0/64748b?text=No+Image";

export default function ProductPage() {
  const { sku } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  // Multi-size order: { [size]: qty }
  const [sizeQtys, setSizeQtys] = useState({});
  const { addToCart, isInCart, openDrawer } = useCart();

  useEffect(() => {
    setLoading(true);
    setSizeQtys({});
    API.get(`/products/${encodeURIComponent(sku)}`)
      .then((r) => setProduct(r.data))
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

  // Total items selected across all sizes
  const totalSelected = Object.values(sizeQtys).reduce((sum, q) => sum + q, 0);

  const updateSizeQty = (size, val) => {
    setSizeQtys((prev) => {
      const next = { ...prev };
      if (val <= 0) {
        delete next[size];
      } else {
        next[size] = val;
      }
      return next;
    });
  };

  const handleAddAllToCart = () => {
    if (hasSizes && !isOneSize && totalSelected === 0) {
      toast.error("Select at least one size and quantity.");
      return;
    }

    if (isOneSize || !hasSizes) {
      const oneQty = sizeQtys["ONE SIZE"] || sizeQtys[""] || 1;
      addToCart(product, productSizes[0]?.size || "", oneQty);
      toast.success(`${product.name} added to cart!`);
      return;
    }

    // Add each selected size to cart
    let addedCount = 0;
    for (const [size, q] of Object.entries(sizeQtys)) {
      if (q > 0) {
        addToCart(product, size, q);
        addedCount++;
      }
    }
    if (addedCount > 0) {
      toast.success(
        `${addedCount} size${addedCount > 1 ? "s" : ""} of ${product.name} added to cart!`,
      );
    }
  };

  // Check if any variant is in cart
  const anySizeInCart = productSizes.some((s) => isInCart(product.sku, s.size));

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
                  color: "#059669",
                  fontSize: "0.9rem",
                  marginBottom: "1rem",
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

            {/* ── Multi-size order grid (TASK 5 — Wholesale Grouping View) ── */}
            {hasSizes && !isOneSize ? (
              <div className="size-order-section">
                <strong
                  style={{
                    display: "block",
                    marginBottom: "0.75rem",
                    fontSize: "1.05rem",
                  }}
                >
                  Select Sizes &amp; Quantities:
                </strong>
                <div className="size-order-grid">
                  <div className="size-order-header">
                    <span>Size</span>
                    <span>Available</span>
                    <span>Order Qty</span>
                  </div>
                  {productSizes.map((s) => {
                    const stock = s.quantity || 0;
                    const outOfStock = stock === 0;
                    const currentQty = sizeQtys[s.size] || 0;
                    const inCartForSize = isInCart(product.sku, s.size);

                    return (
                      <div
                        key={s.size}
                        className={`size-order-row${outOfStock ? " out-of-stock" : ""}${currentQty > 0 ? " selected" : ""}${inCartForSize ? " in-cart" : ""}`}
                      >
                        <span className="size-order-label">{s.size}</span>
                        <span
                          className={`size-order-stock${outOfStock ? " zero" : ""}`}
                        >
                          {outOfStock ? "Sold Out" : stock}
                        </span>
                        <div className="size-order-qty">
                          {outOfStock ? (
                            <span
                              style={{ color: "#9ca3af", fontSize: "0.85rem" }}
                            >
                              —
                            </span>
                          ) : (
                            <>
                              <button
                                className="cart-qty-btn"
                                onClick={() =>
                                  updateSizeQty(
                                    s.size,
                                    Math.max(0, currentQty - 1),
                                  )
                                }
                                disabled={currentQty <= 0}
                              >
                                −
                              </button>
                              <input
                                type="number"
                                min="0"
                                max={stock > 0 ? stock : 9999}
                                value={currentQty}
                                onChange={(e) => {
                                  const v = parseInt(e.target.value) || 0;
                                  updateSizeQty(
                                    s.size,
                                    stock > 0
                                      ? Math.min(v, stock)
                                      : Math.max(0, v),
                                  );
                                }}
                                className="qty-input-sm"
                              />
                              <button
                                className="cart-qty-btn"
                                onClick={() =>
                                  updateSizeQty(
                                    s.size,
                                    stock > 0
                                      ? Math.min(currentQty + 1, stock)
                                      : currentQty + 1,
                                  )
                                }
                                disabled={stock > 0 && currentQty >= stock}
                              >
                                +
                              </button>
                              {inCartForSize && (
                                <span className="in-cart-badge">In Cart</span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {totalSelected > 0 && (
                  <p
                    style={{
                      marginTop: "0.75rem",
                      fontWeight: 600,
                      color: "#1a1281",
                    }}
                  >
                    {totalSelected} item{totalSelected > 1 ? "s" : ""} selected
                    — £{(totalSelected * finalPrice).toFixed(2)} subtotal
                  </p>
                )}
              </div>
            ) : (
              /* One-size or no-size products: simple quantity picker */
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
                    onClick={() =>
                      updateSizeQty(
                        productSizes[0]?.size || "",
                        Math.max(
                          1,
                          (sizeQtys[productSizes[0]?.size || ""] || 1) - 1,
                        ),
                      )
                    }
                    disabled={(sizeQtys[productSizes[0]?.size || ""] || 1) <= 1}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={totalQty > 0 ? totalQty : 9999}
                    value={sizeQtys[productSizes[0]?.size || ""] || 1}
                    onChange={(e) => {
                      const v = parseInt(e.target.value) || 1;
                      updateSizeQty(
                        productSizes[0]?.size || "",
                        totalQty > 0 ? Math.min(v, totalQty) : Math.max(1, v),
                      );
                    }}
                    className="qty-input"
                  />
                  <button
                    className="cart-qty-btn"
                    onClick={() => {
                      const cur = sizeQtys[productSizes[0]?.size || ""] || 1;
                      updateSizeQty(
                        productSizes[0]?.size || "",
                        totalQty > 0 ? Math.min(cur + 1, totalQty) : cur + 1,
                      );
                    }}
                    disabled={
                      totalQty > 0 &&
                      (sizeQtys[productSizes[0]?.size || ""] || 1) >= totalQty
                    }
                  >
                    +
                  </button>
                </div>
                {totalQty > 0 && (
                  <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                    {totalQty} available
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
                onClick={handleAddAllToCart}
              >
                {hasSizes && !isOneSize
                  ? `Add ${totalSelected || 0} Item${totalSelected !== 1 ? "s" : ""} to Cart`
                  : "Add to Cart"}
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
