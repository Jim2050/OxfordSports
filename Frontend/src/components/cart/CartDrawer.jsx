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
      
      // Show confirmation modal instead of mailto
      setConfirmedOrder(order);
      toast.success(`Order ${order.orderNumber} placed successfully!`);
      
      // Clear cart immediately after successful order
      clearCart();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to place order.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseConfirmation = () => {
    setConfirmedOrder(null);
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
          onClick={handleCloseConfirmation}
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
            <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
              <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>✅</div>
              <h2 style={{ color: "#0f2d5c", marginBottom: "0.5rem" }}>Order Confirmed!</h2>
              <p style={{ color: "#666", fontSize: "0.95rem" }}>
                Your order has been successfully placed and saved.
              </p>
            </div>

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

            <div style={{ backgroundColor: "#e8f4f8", padding: "1rem", borderRadius: "0.5rem", marginBottom: "1.5rem", borderLeft: "4px solid #0f2d5c" }}>
              <p style={{ margin: 0, fontSize: "0.9rem", color: "#0f2d5c" }}>
                <strong>📧 Confirmation email is being sent to sales@oxfordsports.net</strong>
              </p>
              <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.85rem", color: "#666" }}>
                Your order details have been recorded. Our team will review and confirm your order shortly.
              </p>
            </div>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                style={{
                  flex: 1,
                  padding: "0.75rem 1rem",
                  backgroundColor: "#0f2d5c",
                  color: "white",
                  border: "none",
                  borderRadius: "0.375rem",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                }}
                onClick={handleCloseConfirmation}
              >
                Close
              </button>
            </div>
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

