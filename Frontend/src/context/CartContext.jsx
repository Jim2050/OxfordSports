import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";

const CartContext = createContext(null);

const STORAGE_KEY = "oxfordSportsCart";

/**
 * Load cart from localStorage (survives page refresh).
 */
function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCart(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

/**
 * Cart item shape:
 * {
 *   sku: string,
 *   name: string,
 *   size: string,        // "" if no size / ONE SIZE
 *   quantity: number,
 *   price: number,       // salePrice (unit price)
 *   rrp: number,         // retail reference price
 *   imageUrl: string,
 *   maxStock: number,    // 0 = unlimited (wholesale)
 * }
 *
 * Cart key = sku + size  (same product in different sizes = separate items)
 */
function cartKey(sku, size) {
  return `${sku}::${size || ""}`;
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadCart);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Persist to localStorage on every change
  useEffect(() => {
    saveCart(items);
  }, [items]);

  /** Add product to cart (or increase qty if already present).
   *  Pass lotItem = true for wholesale lots that must not be edited in cart.
   */
  const addToCart = useCallback((product, size = "", qty = 1, lotItem = false) => {
    setItems((prev) => {
      const key = cartKey(product.sku, size);
      const idx = prev.findIndex((i) => cartKey(i.sku, i.size) === key);

      // Determine max stock for this size from new sizes array or legacy sizeStock
      let maxStock = 0;
      const sizesArr = Array.isArray(product.sizes) ? product.sizes : [];
      if (sizesArr.length > 0 && typeof sizesArr[0] === "object") {
        // New format: [{size, quantity}]
        const entry = sizesArr.find((s) => s.size === size);
        maxStock = entry ? entry.quantity : 0;
      } else if (
        product.sizeStock &&
        Object.keys(product.sizeStock).length > 0
      ) {
        maxStock = product.sizeStock[size] || 0;
      } else if (product.totalQuantity) {
        maxStock = product.totalQuantity;
      } else if (product.quantity) {
        maxStock = product.quantity;
      }

      // Get the sale price (prefer salePrice, fall back to price)
      const itemPrice = Number(product.salePrice) || Number(product.price) || 0;

      if (idx >= 0) {
        // Update existing item
        const updated = [...prev];
        const newQty = updated[idx].quantity + qty;
        updated[idx] = {
          ...updated[idx],
          quantity: maxStock > 0 ? Math.min(newQty, maxStock) : newQty,
          maxStock,
          price: itemPrice,
          lotItem: updated[idx].lotItem || lotItem,
        };
        return updated;
      }

      // New item
      return [
        ...prev,
        {
          sku: product.sku,
          name: product.name,
          size,
          quantity: maxStock > 0 ? Math.min(qty, maxStock) : qty,
          price: itemPrice,
          rrp: Number(product.rrp) || 0,
          imageUrl: product.imageUrl || product.image || "",
          maxStock,
          lotItem,
          category: product.category || "",
          moqStep: (product.category || "").toUpperCase() === "FOOTWEAR" ? 12 : 25,
        },
      ];
    });
  }, []);

  /** Remove an item entirely. */
  const removeFromCart = useCallback((sku, size = "") => {
    setItems((prev) =>
      prev.filter((i) => cartKey(i.sku, i.size) !== cartKey(sku, size)),
    );
  }, []);

  /** Set exact quantity for an item. */
  const updateQuantity = useCallback((sku, size, newQty) => {
    setItems((prev) =>
      prev.map((i) => {
        if (cartKey(i.sku, i.size) !== cartKey(sku, size)) return i;
        const clamped = i.maxStock > 0 ? Math.min(newQty, i.maxStock) : newQty;
        return { ...i, quantity: Math.max(1, clamped) };
      }),
    );
  }, []);

  /** Clear entire cart. */
  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  /** Toggle cart drawer. */
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  /** Computed values. */
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalAmount = +items
    .reduce((sum, i) => sum + i.price * i.quantity, 0)
    .toFixed(2);

  /** Check if a product+size is already in the cart. */
  const isInCart = useCallback(
    (sku, size = "") =>
      items.some((i) => cartKey(i.sku, i.size) === cartKey(sku, size)),
    [items],
  );

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        totalAmount,
        drawerOpen,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        openDrawer,
        closeDrawer,
        isInCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
