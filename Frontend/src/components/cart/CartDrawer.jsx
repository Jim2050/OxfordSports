import { useState } from "react";
import toast from "react-hot-toast";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import { resolveImageUrl } from "../../api/api";
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
        })),
      };
      const res = await API.post("/orders", payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const order = res.data.order;
      toast.success(`Order ${order.orderNumber} placed successfully!`);

      // Open mailto link with order details
      const mailtoLink = buildOrderMailto(order);
      window.location.href = mailtoLink;

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
                      {item.size && (
                        <span className="cart-item-size">
                          Size: {item.size}
                        </span>
                      )}
                      <span className="cart-item-price">
                        £{item.price.toFixed(2)}
                      </span>
                    </div>
                    <div className="cart-item-controls">
                      <button
                        className="cart-qty-btn"
                        onClick={() =>
                          item.quantity <= 1
                            ? removeFromCart(item.sku, item.size)
                            : updateQuantity(
                                item.sku,
                                item.size,
                                item.quantity - 1,
                              )
                        }
                      >
                        −
                      </button>
                      <span className="cart-qty-val">{item.quantity}</span>
                      <button
                        className="cart-qty-btn"
                        onClick={() =>
                          updateQuantity(item.sku, item.size, item.quantity + 1)
                        }
                        disabled={
                          item.maxStock > 0 && item.quantity >= item.maxStock
                        }
                      >
                        +
                      </button>
                      <button
                        className="cart-remove-btn"
                        onClick={() => removeFromCart(item.sku, item.size)}
                        title="Remove"
                      >
                        🗑
                      </button>
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
              <button
                className="btn btn-accent"
                style={{ width: "100%" }}
                onClick={handleCheckout}
                disabled={submitting}
              >
                {submitting ? "Placing order…" : "Place Order"}
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
