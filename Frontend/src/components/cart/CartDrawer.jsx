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
  const [emailButtonLoading, setEmailButtonLoading] = useState(false);
  const [emailButtonSuccess, setEmailButtonSuccess] = useState(false);
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
      
      // Show confirmation modal with email status
      setConfirmedOrder(order);
      setEmailStatus(emailStatusResponse);
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
    setEmailStatus(null);
    setEmailButtonLoading(false);
    setEmailButtonSuccess(false);
    closeDrawer();
  };

  /** Opens email client with pre-filled order details */
  const handleEmailOrder = () => {
    if (!confirmedOrder) return;
    
    setEmailButtonLoading(true);
    
    // Generate order summary for email
    const itemsList = confirmedOrder.items
      .map((item) => `  • ${item.name} (${item.sku}) - Size: ${item.size || "N/A"}, Qty: ${item.quantity}, £${item.lineTotal.toFixed(2)}`)
      .join("\n");

    const taxAmount = (confirmedOrder.totalAmount * 0.2).toFixed(2); // Estimate 20% tax
    const subtotal = (confirmedOrder.totalAmount - taxAmount).toFixed(2);

    const emailBody = encodeURIComponent(
      `Hello Oxford Sports Team,\n\n` +
      `I have just placed an order and wanted to confirm the details:\n\n` +
      `ORDER DETAILS\n` +
      `─────────────────────────\n` +
      `Order Number: ${confirmedOrder.orderNumber}\n` +
      `Order Date: ${new Date(confirmedOrder.createdAt).toLocaleDateString("en-GB")}\n` +
      `Customer Email: ${confirmedOrder.customerEmail}\n` +
      `Customer Name: ${confirmedOrder.customerName}\n\n` +
      `ITEMS ORDERED\n` +
      `─────────────────────────\n` +
      `${itemsList}\n\n` +
      `ORDER SUMMARY\n` +
      `─────────────────────────\n` +
      `Subtotal: £${subtotal}\n` +
      `Tax (20%): £${taxAmount}\n` +
      `Total: £${confirmedOrder.totalAmount.toFixed(2)}\n\n` +
      `DELIVERY ADDRESS\n` +
      `─────────────────────────\n` +
      `${confirmedOrder.deliveryAddress || "Not specified"}\n\n` +
      `Thank you for your order!\n` +
      `Best regards`
    );

    const subject = encodeURIComponent(`Order Confirmation - ${confirmedOrder.orderNumber}`);
    const mailtoLink = `mailto:sales@oxfordsports.net?subject=${subject}&body=${emailBody}`;

    // Simulate sending
    setTimeout(() => {
      setEmailButtonLoading(false);
      setEmailButtonSuccess(true);
      
      // Open email client
      window.location.href = mailtoLink;

      // Reset success state after 3 seconds
      setTimeout(() => {
        setEmailButtonSuccess(false);
      }, 3000);
    }, 600);
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
            animation: "fadeIn 0.3s ease-out",
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
              animation: "slideUp 0.4s ease-out",
              border: "1px solid #e0e0e0",
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
                <strong>Order Date:</strong> {new Date(confirmedOrder.createdAt).toLocaleDateString("en-GB", { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })} at {new Date(confirmedOrder.createdAt).toLocaleTimeString("en-GB", { hour: '2-digit', minute: '2-digit' })}
              </p>
              <p style={{ margin: "0.5rem 0", fontSize: "0.9rem" }}>
                <strong>Customer:</strong> {confirmedOrder.customerName}
              </p>
              <p style={{ margin: "0.5rem 0", fontSize: "0.9rem" }}>
                <strong>Email:</strong> {confirmedOrder.customerEmail}
              </p>
              {confirmedOrder.deliveryAddress && (
                <p style={{ margin: "0.5rem 0", fontSize: "0.9rem" }}>
                  <strong>Delivery To:</strong> {confirmedOrder.deliveryAddress}
                </p>
              )}
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <h3 style={{ fontSize: "0.95rem", color: "#333", marginBottom: "0.75rem" }}>Order Items ({confirmedOrder.items.length})</h3>
              <div style={{ fontSize: "0.85rem", color: "#555", maxHeight: "200px", overflowY: "auto" }}>
                {confirmedOrder.items.map((item, idx) => (
                  <div key={idx} style={{ marginBottom: "0.75rem", paddingBottom: "0.75rem", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>{item.name}</div>
                      <div style={{ fontSize: "0.8rem", color: "#999" }}>SKU: {item.sku}</div>
                      <div style={{ fontSize: "0.8rem", color: "#999" }}>Size: {item.size || "N/A"} × {item.quantity} units</div>
                    </div>
                    <div style={{ textAlign: "right", fontWeight: 600 }}>£{item.lineTotal.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ backgroundColor: "#f0f4f8", padding: "1rem", borderRadius: "0.5rem", marginBottom: "1.5rem", borderTop: "2px solid #0f2d5c" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.9rem" }}>
                <span>Subtotal:</span>
                <span>£{(confirmedOrder.totalAmount * 0.833).toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem", fontSize: "0.9rem", borderBottom: "1px solid #d0d0d0", paddingBottom: "0.5rem" }}>
                <span>Tax (20%):</span>
                <span>£{(confirmedOrder.totalAmount * 0.167).toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1.1rem", fontWeight: 700, color: "#0f2d5c" }}>
                <span>Order Total:</span>
                <span>£{confirmedOrder.totalAmount.toFixed(2)}</span>
              </div>
            </div>

            <div style={{ backgroundColor: emailStatus?.sent ? "#e8f4f8" : emailStatus?.error ? "#fff3cd" : "#e8f4f8", padding: "1rem", borderRadius: "0.5rem", marginBottom: "1.5rem", borderLeft: `4px solid ${emailStatus?.sent ? "#0f2d5c" : emailStatus?.error ? "#ff9800" : "#0f2d5c"}` }}>
              {emailStatus?.sent ? (
                <>
                  <p style={{ margin: 0, fontSize: "0.9rem", color: "#0f2d5c" }}>
                    <strong>✅ Confirmation emails sent successfully</strong>
                  </p>
                  <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.85rem", color: "#666" }}>
                    Order confirmation sent to <strong>{confirmedOrder.customerEmail}</strong> and sales team.<br />
                    Our team will review and confirm your order shortly.
                  </p>
                </>
              ) : emailStatus?.error ? (
                <>
                  <p style={{ margin: 0, fontSize: "0.9rem", color: "#d32f2f" }}>
                    <strong>⚠️ Email delivery note</strong>
                  </p>
                  <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.85rem", color: "#666" }}>
                    Your order has been saved (Order #{confirmedOrder.orderNumber}). Email confirmation could not be sent automatically.
                  </p>
                  <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.8rem", color: "#999" }}>
                    Our team has been notified of your order and will follow up with you shortly.
                  </p>
                </>
              ) : (
                <>
                  <p style={{ margin: 0, fontSize: "0.9rem", color: "#0f2d5c" }}>
                    <strong>📧 Confirmation email is being sent</strong>
                  </p>
                  <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.85rem", color: "#666" }}>
                    Order confirmation being sent to {confirmedOrder.customerEmail}...
                  </p>
                </>
              )}
            </div>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                style={{
                  flex: 1,
                  padding: "0.75rem 1rem",
                  backgroundColor: emailButtonSuccess ? "#4caf50" : "#0f2d5c",
                  color: "white",
                  border: "none",
                  borderRadius: "0.375rem",
                  cursor: emailButtonLoading ? "wait" : "pointer",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  transition: "background-color 0.3s ease",
                  opacity: emailButtonLoading ? 0.7 : 1,
                }}
                onClick={handleEmailOrder}
                disabled={emailButtonLoading}
              >
                {emailButtonLoading ? "Opening Email…" : emailButtonSuccess ? "✓ Email Opened" : "📧 Confirm via Email"}
              </button>
              <button
                style={{
                  flex: 1,
                  padding: "0.75rem 1rem",
                  backgroundColor: "#f0f0f0",
                  color: "#333",
                  border: "1px solid #d0d0d0",
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
        
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}

