import { useState } from "react";
import toast from "react-hot-toast";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import { resolveImageUrl, MIN_CART_TOTAL, getMOQInfo } from "../../api/api";
import API from "../../api/axiosInstance";
import { buildOrderMailto } from "../../utils/buildOrderMailto";

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
      // Include maxStock and lotItem metadata for accurate backend pricing
      const payload = {
        items: items.map((i) => ({
          sku: i.sku,
          size: i.size,
          quantity: i.quantity,
          maxStock: i.maxStock,  // Send for lot items
          lotItem: i.lotItem,    // Send lot flag
        })),
      };
      const res = await API.post("/orders", payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const order = res.data.order;
      const emailStatus = res.data.emailStatus;

      // Email was sent automatically by backend
      if (emailStatus?.sent) {
        toast.success(`Order ${order.orderNumber} placed! Confirmation sent to your email.`);
      } else {
        // Email failed - provide fallback
        toast.warning(`Order ${order.orderNumber} placed but email failed. Check your dashboard.`);
        // Only open mailto as fallback if email wasn't sent
        const mailtoLink = buildOrderMailto(order);
        window.location.href = mailtoLink;
      }

      clearCart();
      closeDrawer();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to place order.");
    } finally {
      setSubmitting(false);
    }
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
    </>
  );
}
