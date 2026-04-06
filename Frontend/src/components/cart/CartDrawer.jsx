import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import { resolveImageUrl, MIN_CART_TOTAL, getMOQInfo, getSizes } from "../../api/api";
import API from "../../api/axiosInstance";

const PLACEHOLDER = "https://placehold.co/64x64/e2e8f0/64748b?text=—";

export default function CartDrawer() {
  const navigate = useNavigate();
  const {
    items,
    itemCount,
    totalAmount,
    drawerOpen,
    closeDrawer,
    removeFromCart,
    updateQuantity,
    clearCart,
  } = useCart();
  const { isAuthenticated, token } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState(null);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [reviewingLocal, setReviewingLocal] = useState(false);
  const belowMinimum = totalAmount < MIN_CART_TOTAL;

  /**
   * Validate cart items against current product stock.
   * Called when drawer opens to catch stale quantities.
   */
  const validateCartStock = async () => {
    let adjusted = false;
    const uniqueSkus = [...new Set(items.map((item) => item.sku).filter(Boolean))];
    const productEntries = await Promise.all(
      uniqueSkus.map(async (sku) => {
        try {
          const response = await API.get(`/products/${encodeURIComponent(sku)}`);
          return [sku, response.data];
        } catch {
          return [sku, null];
        }
      }),
    );

    const productBySku = new Map(productEntries);

    for (const item of items) {
      try {
        const productData = productBySku.get(item.sku);
        if (!productData) continue;

        const sizes = getSizes(productData);
        const sizeData = sizes.find(s => s.size === item.size);
        const available = sizeData?.quantity ?? productData.totalQuantity ?? 0;
        const requiredQty = item.lotItem ? (item.maxStock || 0) : item.quantity;
        
        if (requiredQty > available) {
          if (available === 0) {
            adjusted = true;
            removeFromCart(item.sku, item.size);
            toast.error(`${item.name} is now out of stock and was removed from your cart`);
          } else {
            if (item.lotItem) {
              adjusted = true;
              removeFromCart(item.sku, item.size);
              toast.error(`${item.name} lot availability changed. Please add it again.`);
            } else {
              adjusted = true;
              updateQuantity(item.sku, item.size, Math.min(item.quantity, available));
              toast(`${item.name} stock reduced to ${available}`, { icon: "⚠️" });
            }
          }
        }
      } catch (e) {
        // Product removed or API error — silently ignore
      }
    }

    return adjusted;
  };

  // Validate cart stock when drawer opens
  useEffect(() => {
    if (drawerOpen && items.length > 0) {
      validateCartStock();
    }
  }, [drawerOpen]);

  /** Open local review modal (does NOT hit API yet). */
  const handleCheckout = () => {
    if (!isAuthenticated) {
      toast.error("Please sign in to place an order.");
      return;
    }
    if (items.length === 0) return;

    setReviewingLocal(true);
    setReviewConfirmed(false);
  };

  /** Actually submit the order to the backend after review confirmation. */
  const handleConfirmOrder = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const cartAdjusted = await validateCartStock();
      if (cartAdjusted) {
        toast.error("Cart updated due to stock changes. Please review and confirm again.");
        return;
      }

      const payload = {
        items: items.map((i) => ({
          sku: i.sku,
          size: i.size,
          quantity: i.quantity,
          maxStock: i.maxStock,
          lotItem: i.lotItem,
        })),
      };
      
      const res = await API.post("/orders", payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const order = res.data.order;
      
      // Transition to exact success state
      setConfirmedOrder(order);
      setReviewingLocal(false);
      clearCart();
      toast.success("Order confirmed!");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to confirm order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseConfirmation = () => {
    setConfirmedOrder(null);
    setReviewConfirmed(false);
    setReviewingLocal(false);
    closeDrawer();
  };

  const handleContinueBrowsing = () => {
    setConfirmedOrder(null);
    setReviewConfirmed(false);
    setReviewingLocal(false);
    closeDrawer();
    navigate("/products");
  };

  return (
    <>
      {/* Backdrop */}
      {drawerOpen && <div className="cart-backdrop" onClick={closeDrawer} />}

      {/* Drawer panel */}
      <div className={`cart-drawer${drawerOpen ? " open" : ""}`}>
        <div className="cart-drawer-header">
          <h3>Your Cart ({itemCount})</h3>
          <button
            className="cart-drawer-close"
            onClick={closeDrawer}
            aria-label="Close cart"
          >
            ✕
          </button>
        </div>

        {items.length === 0 ? (
          <div className="cart-drawer-empty">
            <span style={{ fontSize: "2.5rem" }}>🛒</span>
            <p>Your cart is empty</p>
          </div>
        ) : (
          <>
            <div className="cart-drawer-items">
              {items.map((item) => {
                const img = resolveImageUrl(item.imageUrl) || PLACEHOLDER;
                const key = `${item.sku}::${item.size}`;
                return (
                  <div className="cart-item" key={key}>
                    <img
                      src={img}
                      alt=""
                      className="cart-item-img"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = PLACEHOLDER;
                      }}
                    />
                    <div className="cart-item-info">
                      <p className="cart-item-name">{item.name}</p>
                      {/* Display size with allocation status */}
                      <span className="cart-item-size">
                        {item.allocatedSize && item.allocatedSize !== item.size ? (
                          <>Size: {item.allocatedSize} (auto-allocated)</>
                        ) : item.size ? (
                          <>Size: {item.size}</>
                        ) : (
                          <>Size: Auto-select (first available)</>
                        )}
                      </span>
                      <span className="cart-item-price">
                        {item.lotItem ? (
                          <>£{(item.price * item.maxStock).toFixed(2)} <span style={{fontSize: '0.75rem', color: '#999'}}>({item.maxStock} units)</span></>
                        ) : (
                          <>£{item.price.toFixed(2)}</>
                        )}
                      </span>
                    </div>
                    <div className="cart-item-controls">
                      {item.lotItem ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <div
                            style={{
                              fontSize: "0.85rem",
                              color: "#0f2d5c",
                              fontWeight: 600,
                              whiteSpace: "nowrap",
                              backgroundColor: "#f0f4f8",
                              padding: "0.25rem 0.5rem",
                              borderRadius: "0.25rem",
                            }}
                          >
                            ✓ Complete Lot
                          </div>
                          <button
                            className="cart-remove-btn"
                            onClick={() => removeFromCart(item.sku, item.size)}
                            title="Remove lot from cart"
                          >
                            🗑
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            className="cart-qty-btn"
                            onClick={() => {
                              const step = item.moqStep || 1;
                              const newQty = item.quantity - step;
                              if (newQty < step) {
                                removeFromCart(item.sku, item.size);
                              } else {
                                updateQuantity(item.sku, item.size, newQty);
                              }
                            }}
                            disabled={item.quantityLocked}
                            title={item.quantityLocked ? "Quantity locked - must purchase all available units" : ""}
                          >
                            −
                          </button>
                          <span className="cart-qty-val">{item.quantity}</span>
                          <button
                            className="cart-qty-btn"
                            onClick={() => {
                              const step = item.moqStep || 1;
                              updateQuantity(item.sku, item.size, item.quantity + step);
                            }}
                            disabled={item.quantityLocked || (item.maxStock > 0 && item.quantity >= item.maxStock)}
                            title={item.quantityLocked ? "Quantity locked - must purchase all available units" : ""}
                          >
                            +
                          </button>
                          <button
                            className="cart-remove-btn"
                            onClick={() => removeFromCart(item.sku, item.size)}
                            title="Remove from cart"
                          >
                            🗑
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="cart-drawer-footer">
              <div className="cart-total">
                <span>Total</span>
                <strong>£{totalAmount.toFixed(2)}</strong>
              </div>
              {belowMinimum && items.length > 0 && (
                <p className="cart-min-warning">
                  Minimum order: £{MIN_CART_TOTAL}. Add £{(MIN_CART_TOTAL - totalAmount).toFixed(2)} more.
                </p>
              )}
              <button
                className="btn btn-accent"
                style={{ width: "100%", opacity: (submitting || belowMinimum) ? 0.6 : 1 }}
                onClick={handleCheckout}
                disabled={submitting || belowMinimum}
              >
                {belowMinimum ? `Min. order £${MIN_CART_TOTAL}` : submitting ? "Placing order…" : "Place Order"}
              </button>
              <button
                className="btn btn-outline btn-sm"
                style={{ width: "100%", marginTop: "0.5rem" }}
                onClick={clearCart}
              >
                Clear Cart
              </button>
            </div>
          </>
        )}
      </div>

      {/* Order Confirmation Modal */}
      {(reviewingLocal || confirmedOrder) && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "0.5rem",
              padding: "2rem",
              maxWidth: "600px",
              maxHeight: "80vh",
              overflowY: "auto",
              boxShadow: "0 10px 40px rgba(0, 0, 0, 0.2)",
              animation: "slideUp 0.3s ease-out",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Success Phase (shown when confirmedOrder exists) */}
            {confirmedOrder ? (
              <>
                <div style={{ textAlign: "center", marginBottom: "2rem", marginTop: "1rem" }}>
                  <div style={{ fontSize: "3.5rem", marginBottom: "1rem" }}>🎉</div>
                  <h2 style={{ color: "#0f2d5c", marginBottom: "0.5rem", fontSize: "1.75rem", fontWeight: 700 }}>Order Received!</h2>
                  <p style={{ color: "#555", fontSize: "1rem", maxWidth: "80%", margin: "0 auto" }}>
                    Thank you for your business. Your order has been securely processed and is now with our wholesale team.
                  </p>
                </div>

                {/* Info Block */}
                <div style={{ backgroundColor: "#f8f9fa", border: "1px solid #e9ecef", padding: "1.25rem", borderRadius: "0.5rem", marginBottom: "1.5rem" }}>
                  <div>
                    <p style={{ margin: "0", fontSize: "0.85rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Order ID</p>
                    <p style={{ margin: "0.25rem 0 0 0", fontSize: "1rem", color: "#0f2d5c", fontWeight: 700 }}>{confirmedOrder.orderNumber}</p>
                  </div>
                </div>

                {/* Static Trust Banner instead of confusing polling status */}
                <div style={{ backgroundColor: "#f0f4f8", padding: "1.25rem", borderRadius: "0.5rem", marginBottom: "2rem", borderLeft: "4px solid #0f2d5c" }}>
                  <p style={{ margin: 0, fontSize: "0.95rem", color: "#0f2d5c", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span>📧</span> Email Confirmation
                  </p>
                  <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.9rem", color: "#444", lineHeight: 1.5 }}>
                    We will send a detailed invoice to <strong>{confirmedOrder.customerEmail}</strong> shortly.
                  </p>
                </div>

                {/* Close Button */}
                <button
                  onClick={handleContinueBrowsing}
                  style={{
                    width: "100%",
                    padding: "1rem",
                    backgroundColor: "#0f2d5c",
                    color: "white",
                    border: "none",
                    borderRadius: "0.5rem",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: "1rem",
                    transition: "background-color 0.2s",
                  }}
                  onMouseOver={(e) => (e.target.style.backgroundColor = "#0a1e3f")}
                  onMouseOut={(e) => (e.target.style.backgroundColor = "#0f2d5c")}
                >
                  Continue Browsing
                </button>
              </>
            ) : (
              <>
                {/* Local Review Phase */}
                <div style={{ marginBottom: "1.5rem" }}>
                  <h2 style={{ color: "#0f2d5c", marginBottom: "0.25rem", fontSize: "1.5rem" }}>
                    Review Your Order
                  </h2>
                  <p style={{ color: "#666", fontSize: "0.9rem", margin: 0 }}>
                    Please verify your details below. Your order will be placed only after you click Confirm Order.
                  </p>
                </div>

                {/* Order Summary */}
                <div style={{ backgroundColor: "#f8f9fa", padding: "1rem", borderRadius: "0.5rem", marginBottom: "1.5rem" }}>
                  <p style={{ margin: "0.5rem 0", fontSize: "0.9rem" }}>
                    <strong>Order Total:</strong> £{totalAmount.toFixed(2)}
                  </p>
                  <p style={{ margin: "0.5rem 0", fontSize: "0.9rem" }}>
                    <strong>Total Items:</strong> {itemCount}
                  </p>
                </div>

                {/* Items */}
                <div style={{ marginBottom: "1.5rem" }}>
                  <h3 style={{ fontSize: "0.95rem", color: "#333", marginBottom: "0.75rem" }}>Order Items</h3>
                  <div style={{ fontSize: "0.85rem", color: "#555" }}>
                    {items.map((item, idx) => (
                      <div key={idx} style={{ marginBottom: "0.5rem", paddingBottom: "0.5rem", borderBottom: "1px solid #eee" }}>
                        <div style={{ fontWeight: 600 }}>{item.name} ({item.sku})</div>
                        <div>Size: {item.size || "—"} | Qty: {item.lotItem ? (item.maxStock || item.quantity) : item.quantity} | £{(item.lotItem ? (item.price * item.maxStock) : (item.price * item.quantity)).toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Checkbox */}
                <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                  <input
                    type="checkbox"
                    id="reviewConfirm"
                    checked={reviewConfirmed}
                    onChange={(e) => setReviewConfirmed(e.target.checked)}
                    style={{ marginTop: "0.25rem", cursor: "pointer" }}
                  />
                  <label htmlFor="reviewConfirm" style={{ fontSize: "0.9rem", color: "#333", cursor: "pointer" }}>
                    I have reviewed my order details and confirm everything is correct.
                  </label>
                </div>

                {/* Buttons */}
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <button
                    onClick={handleConfirmOrder}
                    disabled={!reviewConfirmed || submitting}
                    style={{
                      flex: 1,
                      padding: "0.75rem 1rem",
                      backgroundColor: reviewConfirmed && !submitting ? "#0f2d5c" : "#ccc",
                      color: "white",
                      border: "none",
                      borderRadius: "0.375rem",
                      cursor: reviewConfirmed && !submitting ? "pointer" : "not-allowed",
                      fontWeight: 600,
                      fontSize: "0.9rem",
                      transition: "all 0.2s",
                    }}
                  >
                    {submitting ? "Placing order..." : "Confirm Order"}
                  </button>
                  <button
                    onClick={() => {
                      setReviewingLocal(false);
                      setReviewConfirmed(false);
                    }}
                    disabled={submitting}
                    style={{
                      flex: 0.5,
                      padding: "0.75rem 1rem",
                      backgroundColor: submitting ? "#f8f8f8" : "#f0f0f0",
                      color: submitting ? "#aaa" : "#333",
                      border: "1px solid #d0d0d0",
                      borderRadius: "0.375rem",
                      cursor: submitting ? "not-allowed" : "pointer",
                      fontWeight: 600,
                      fontSize: "0.9rem",
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleCloseConfirmation}
                    disabled={submitting}
                    style={{
                      flex: 0.5,
                      padding: "0.75rem 1rem",
                      backgroundColor: "transparent",
                      color: submitting ? "#ccc" : "#666",
                      border: "1px solid #ddd",
                      borderRadius: "0.375rem",
                      cursor: submitting ? "not-allowed" : "pointer",
                      fontWeight: 600,
                      fontSize: "0.9rem",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}

