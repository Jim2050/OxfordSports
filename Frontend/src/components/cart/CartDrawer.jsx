import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import { AUTH_PUBLIC_MODE } from "../../config/featureFlags";
import { resolveImageUrl, MIN_CART_TOTAL, getSizes } from "../../api/api";
import API from "../../api/axiosInstance";
import { parseApiError } from "../../utils/errorReporter";

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
  const [qtyDrafts, setQtyDrafts] = useState({});
  const belowMinimum = totalAmount < MIN_CART_TOTAL;

  const getItemKey = (item) => `${item.sku}::${item.size || ""}`;

  const clearQtyDraft = (key) => {
    setQtyDrafts((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, key)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const commitQtyDraft = (item, key) => {
    const minQty = item.minOrderQty || 24;
    const maxQty = item.maxStock > 0 ? item.maxStock : Number.MAX_SAFE_INTEGER;
    const draftValue = Object.prototype.hasOwnProperty.call(qtyDrafts, key)
      ? qtyDrafts[key]
      : String(item.quantity);
    const parsed = parseInt(String(draftValue), 10);
    const nextQty = Number.isNaN(parsed)
      ? minQty
      : Math.max(minQty, Math.min(parsed, maxQty));
    updateQuantity(item.sku, item.size, nextQty);
    clearQtyDraft(key);
  };

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
        const sizeAvailable = item.size
          ? sizes
              .filter((s) => s.size === item.size)
              .reduce((sum, s) => sum + (Number(s.quantity) || 0), 0)
          : 0;
        const available = item.size
          ? sizeAvailable
          : (Number(productData.totalQuantity) || 0);
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
      } catch (e) {}
    }

    return adjusted;
  };

  useEffect(() => {
    if (drawerOpen && items.length > 0) {
      validateCartStock();
    }
  }, [drawerOpen]);

  useEffect(() => {
    setQtyDrafts((prev) => {
      const next = {};
      for (const item of items) {
        const key = getItemKey(item);
        if (Object.prototype.hasOwnProperty.call(prev, key)) {
          next[key] = prev[key];
        }
      }
      return next;
    });
  }, [items]);

  const handleCheckout = () => {
    if (!AUTH_PUBLIC_MODE && !isAuthenticated) {
      toast.error("Please sign in to place an order.");
      return;
    }
    if (items.length === 0) return;
    setReviewingLocal(true);
    setReviewConfirmed(false);
  };

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

      setConfirmedOrder(res.data.order);
      setReviewingLocal(false);
      clearCart();
      window.dispatchEvent(new Event("catalog:refresh"));
      toast.success("Order confirmed!");
    } catch (err) {
      const { message, fieldErrors } = parseApiError(err);
      toast.error(message || "Failed to confirm order.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseConfirmation = (e) => {
    // If it's the success screen, close everything
    if (confirmedOrder) {
      setConfirmedOrder(null);
      setReviewConfirmed(false);
      setReviewingLocal(false);
      closeDrawer();
      return;
    }
    // If it's just the review screen, just close the modal, keep drawer open
    setReviewingLocal(false);
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
      {drawerOpen && <div className="cart-backdrop" onClick={closeDrawer} />}
      <div className={`cart-drawer${drawerOpen ? " open" : ""}`}>
        <div className="cart-drawer-header">
          <h3>Your Cart ({itemCount})</h3>
          <button className="cart-drawer-close" onClick={closeDrawer}>✕</button>
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
                const key = getItemKey(item);
                return (
                  <div className="cart-item" key={key}>
                    <img src={img} alt="" className="cart-item-img" onError={(e) => { e.target.src = PLACEHOLDER; }} />
                    <div className="cart-item-info">
                      <p className="cart-item-name">{item.name}</p>
                      <span className="cart-item-size">Size: {item.size || "—"}</span>
                      <span className="cart-item-price">£{(item.price * (item.lotItem ? item.maxStock : item.quantity)).toFixed(2)}</span>
                    </div>
                    <div className="cart-item-controls">
                      {!item.lotItem && (
                        <>
                          <button className="cart-qty-btn" onClick={() => updateQuantity(item.sku, item.size, item.quantity - 1)} disabled={item.quantity <= (item.minOrderQty || 24)}>−</button>
                          <span className="qty-value">{item.quantity}</span>
                          <button className="cart-qty-btn" onClick={() => updateQuantity(item.sku, item.size, item.quantity + 1)} disabled={item.maxStock > 0 && item.quantity >= item.maxStock}>+</button>
                        </>
                      )}
                      <button className="cart-remove-btn" onClick={() => removeFromCart(item.sku, item.size)}>🗑</button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="cart-drawer-footer">
              <div className="cart-total"><span>Total</span><strong>£{totalAmount.toFixed(2)}</strong></div>
              <button className="btn btn-accent" style={{ width: "100%" }} onClick={handleCheckout} disabled={submitting || belowMinimum}>
                {belowMinimum ? `Min. order £${MIN_CART_TOTAL}` : submitting ? "Placing order…" : "Place Order"}
              </button>
            </div>
          </>
        )}
      </div>

      {(reviewingLocal || confirmedOrder) && (
        <div className="modal-overlay" onClick={handleCloseConfirmation}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            {confirmedOrder ? (
              <div style={{ textAlign: "center" }}>
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "-1rem" }}>
                  <button className="cart-drawer-close" onClick={handleCloseConfirmation} style={{ position: "static" }}>✕</button>
                </div>
                <div style={{ fontSize: "3.5rem" }}>🎉</div>
                <h2>Order Received!</h2>
                <p>Order ID: <strong>{confirmedOrder.orderNumber}</strong></p>
                <p>We will send an invoice to <strong>{confirmedOrder.customerEmail}</strong> shortly.</p>
                <button className="btn btn-primary" onClick={handleContinueBrowsing}>Continue Browsing</button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <h2 style={{ margin: 0 }}>Review Your Order</h2>
                  <button className="cart-drawer-close" onClick={() => setReviewingLocal(false)} style={{ position: "static" }}>✕</button>
                </div>
                <div className="summary-list">
                  <p><strong>Total Items:</strong> {itemCount}</p>
                  <p><strong>Total Amount:</strong> £{totalAmount.toFixed(2)}</p>
                  <div className="summary-items">
                    {items.map((i, idx) => (
                      <div key={idx} className="summary-item">
                        {i.name} ({i.sku}) - {i.quantity} units @ £{i.price}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="review-check">
                  <input type="checkbox" id="rev" checked={reviewConfirmed} onChange={e => setReviewConfirmed(e.target.checked)} />
                  <label htmlFor="rev">I confirm my order details are correct.</label>
                </div>
                <div className="modal-actions">
                  <button className="btn btn-accent" disabled={!reviewConfirmed || submitting} onClick={handleConfirmOrder}>Confirm Order</button>
                  <button className="btn btn-outline" onClick={() => setReviewingLocal(false)}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 1rem; }
        .modal-content { background: white; padding: 2rem; border-radius: 0.5rem; max-width: 500px; width: 100%; max-height: 90vh; overflow-y: auto; }
        .summary-list { background: #f8f9fa; padding: 1rem; border-radius: 0.4rem; margin: 1rem 0; }
        .summary-items { margin-top: 1rem; font-size: 0.85rem; border-top: 1px solid #ddd; padding-top: 0.5rem; }
        .summary-item { margin-bottom: 0.25rem; }
        .review-check { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; font-size: 0.9rem; align-items: center; }
        .modal-actions { display: flex; gap: 1rem; }
        .modal-actions button { flex: 1; }
      `}</style>
    </>
  );
}
