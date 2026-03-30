import { useState } from "react";
import toast from "react-hot-toast";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import { resolveImageUrl, MIN_CART_TOTAL, getMOQInfo } from "../../api/api";
import API from "../../api/axiosInstance";

const PLACEHOLDER = "https://placehold.co/64x64/e2e8f0/64748b?text=—";

export default function CartDrawer() {
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
  const [emailStatus, setEmailStatus] = useState(null);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const belowMinimum = totalAmount < MIN_CART_TOTAL;

  /** Place order via API. */
  const handleCheckout = async () => {
    if (!isAuthenticated) {
      toast.error("Please sign in to place an order.");
      return;
    }
    if (items.length === 0) return;

    setSubmitting(true);
    try {
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
      const emailStatusResponse = res.data.emailStatus || { sent: false };
      
      // Show review modal (not yet placed)
      setConfirmedOrder(order);
      setOrderPlaced(false);
      setReviewConfirmed(false);
      setEmailStatus(emailStatusResponse);
      toast.success(`Review your order and confirm to complete the purchase.`);
      
      // Clear cart immediately after successful order
      clearCart();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to place order.");
    } finally {
      setSubmitting(false);
    }
  };

  /** Confirm the reviewed order and show success state. */
  const handleConfirmOrder = async () => {
    setSubmitting(true);
    try {
      // Simulate confirmation delay (could be API call if needed)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Transition to success state
      setOrderPlaced(true);
      toast.success("Order confirmed!");
    } catch (err) {
      toast.error("Failed to confirm order. Please try again.");
      setSubmitting(false);
    }
  };

  const handleCloseConfirmation = () => {
    setConfirmedOrder(null);
    setEmailStatus(null);
    setReviewConfirmed(false);
    setOrderPlaced(false);
    closeDrawer();
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
                            disabled={item.quantityLocked || item.lotItem}
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
                            disabled={item.quantityLocked || item.lotItem || (item.maxStock > 0 && item.quantity >= item.maxStock)}
                            title={item.quantityLocked ? "Quantity locked - must purchase all available units" : ""}
                          >
                            +
                          </button>
                          <button
                            className="cart-remove-btn"
                            onClick={() => removeFromCart(item.sku, item.size)}
                            disabled={item.quantityLocked || item.lotItem}
                            title={item.quantityLocked ? "Cannot remove - quantity locked for this item" : "Remove"}
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
                style={{ width: "100%" }}
                onClick={handleCheckout}
                disabled={submitting || belowMinimum}
              >
                {submitting ? "Placing order…" : belowMinimum ? `Min. order £${MIN_CART_TOTAL}` : "Place Order"}
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
      {confirmedOrder && (
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
            {/* Success Phase (shown when orderPlaced = true) */}
            {orderPlaced ? (
              <>
                <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
                  <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>✅</div>
                  <h2 style={{ color: "#0f2d5c", marginBottom: "0.5rem" }}>Order Successfully Placed</h2>
                  <p style={{ color: "#666", fontSize: "0.95rem" }}>
                    Your order has been confirmed and saved.
                  </p>
                </div>

                {/* Order Summary */}
                <div style={{ backgroundColor: "#f8f9fa", padding: "1rem", borderRadius: "0.5rem", marginBottom: "1.5rem" }}>
                  <p style={{ margin: "0.5rem 0", fontSize: "0.9rem" }}>
                    <strong>Order Number:</strong> {confirmedOrder.orderNumber}
                  </p>
                  <p style={{ margin: "0.5rem 0", fontSize: "0.9rem" }}>
                    <strong>Order Total:</strong> £{confirmedOrder.totalAmount.toFixed(2)}
                  </p>
                  <p style={{ margin: "0.5rem 0", fontSize: "0.9rem" }}>
                    <strong>Date:</strong> {new Date(confirmedOrder.createdAt).toLocaleDateString("en-GB")}
                  </p>
                </div>

                {/* Items */}
                <div style={{ marginBottom: "1.5rem" }}>
                  <h3 style={{ fontSize: "0.95rem", color: "#333", marginBottom: "0.75rem" }}>Order Items</h3>
                  <div style={{ fontSize: "0.85rem", color: "#555" }}>
                    {confirmedOrder.items.map((item, idx) => (
                      <div key={idx} style={{ marginBottom: "0.5rem", paddingBottom: "0.5rem", borderBottom: "1px solid #eee" }}>
                        <div style={{ fontWeight: 600 }}>{item.name} ({item.sku})</div>
                        <div>Size: {item.size || "—"} | Qty: {item.quantity} | £{item.lineTotal.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Email Status */}
                <div style={{ backgroundColor: emailStatus?.sent ? "#e8f4f8" : emailStatus?.error ? "#fff3cd" : "#e8f4f8", padding: "1rem", borderRadius: "0.5rem", marginBottom: "1.5rem", borderLeft: `4px solid ${emailStatus?.sent ? "#0f2d5c" : emailStatus?.error ? "#ff9800" : "#0f2d5c"}` }}>
                  {emailStatus?.sent ? (
                    <>
                      <p style={{ margin: 0, fontSize: "0.9rem", color: "#0f2d5c" }}>
                        <strong>✅ Email Status</strong>
                      </p>
                      <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.85rem", color: "#666" }}>
                        Confirmation sent to <strong>{confirmedOrder.customerEmail}</strong>
                      </p>
                    </>
                  ) : emailStatus?.error ? (
                    <>
                      <p style={{ margin: 0, fontSize: "0.9rem", color: "#d32f2f" }}>
                        <strong>⚠️ Email Delivery Note</strong>
                      </p>
                      <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.85rem", color: "#666" }}>
                        Order saved successfully. Email could not be sent automatically.
                      </p>
                    </>
                  ) : (
                    <>
                      <p style={{ margin: 0, fontSize: "0.9rem", color: "#0f2d5c" }}>
                        <strong>📧 Confirmation Email</strong>
                      </p>
                      <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.85rem", color: "#666" }}>
                        Confirmation being sent to {confirmedOrder.customerEmail}...
                      </p>
                    </>
                  )}
                </div>

                {/* Close Button */}
                <button
                  onClick={handleCloseConfirmation}
                  style={{
                    width: "100%",
                    padding: "0.75rem 1rem",
                    backgroundColor: "#0f2d5c",
                    color: "white",
                    border: "none",
                    borderRadius: "0.375rem",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                  }}
                >
                  Done
                </button>
              </>
            ) : (
              <>
                {/* Review Phase */}
                {/* Header */}
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
                    <strong>Order Number:</strong> {confirmedOrder.orderNumber}
                  </p>
                  <p style={{ margin: "0.5rem 0", fontSize: "0.9rem" }}>
                    <strong>Order Total:</strong> £{confirmedOrder.totalAmount.toFixed(2)}
                  </p>
                  <p style={{ margin: "0.5rem 0", fontSize: "0.9rem" }}>
                    <strong>Date:</strong> {new Date(confirmedOrder.createdAt).toLocaleDateString("en-GB")}
                  </p>
                </div>

                {/* Items */}
                <div style={{ marginBottom: "1.5rem" }}>
                  <h3 style={{ fontSize: "0.95rem", color: "#333", marginBottom: "0.75rem" }}>Order Items</h3>
                  <div style={{ fontSize: "0.85rem", color: "#555" }}>
                    {confirmedOrder.items.map((item, idx) => (
                      <div key={idx} style={{ marginBottom: "0.5rem", paddingBottom: "0.5rem", borderBottom: "1px solid #eee" }}>
                        <div style={{ fontWeight: 600 }}>{item.name} ({item.sku})</div>
                        <div>Size: {item.size || "—"} | Qty: {item.quantity} | £{item.lineTotal.toFixed(2)}</div>
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
                      setConfirmedOrder(null);
                      setReviewConfirmed(false);
                    }}
                    style={{
                      flex: 0.5,
                      padding: "0.75rem 1rem",
                      backgroundColor: "#f0f0f0",
                      color: "#333",
                      border: "1px solid #d0d0d0",
                      borderRadius: "0.375rem",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: "0.9rem",
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleCloseConfirmation}
                    style={{
                      flex: 0.5,
                      padding: "0.75rem 1rem",
                      backgroundColor: "transparent",
                      color: "#666",
                      border: "1px solid #ddd",
                      borderRadius: "0.375rem",
                      cursor: "pointer",
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

