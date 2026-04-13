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
        if (size) {
          // Exact size match requested (sum all duplicate exact labels)
          maxStock = sizesArr
            .filter((s) => String(s?.size || "") === size)
            .reduce((sum, s) => sum + (Number(s?.quantity) || 0), 0);
        } else {
          // No size specified: sum all sizes from the source payload.
          maxStock = sizesArr.reduce((sum, s) => sum + (Number(s?.quantity) || 0), 0);
        }
      } else if (
        product.sizeStock &&
        Object.keys(product.sizeStock).length > 0
      ) {
        if (size) {
          maxStock = Number(product.sizeStock[size]) || 0;
        } else {
          maxStock = Object.values(product.sizeStock).reduce(
            (sum, q) => sum + (Number(q) || 0),
            0,
          );
        }
      } else if (product.totalQuantity) {
        maxStock = product.totalQuantity;
      } else if (product.quantity) {
        maxStock = product.quantity;
      }

      // Get the sale price (prefer salePrice, fall back to price)
      const itemPrice = Number(product.salePrice) || Number(product.price) || 0;
      const minOrderQty = maxStock > 24 ? 24 : Math.max(maxStock, 1);
      const quantityLocked = !lotItem && maxStock > 0 && maxStock <= 24;

      if (idx >= 0) {
        // Update existing item
        const updated = [...prev];

        // Check if item is a lot — prevent incrementing
        if (updated[idx].lotItem) {
          return prev; // Return unchanged — lot already in cart
        }
        
        // Update existing regular item
        const newQty = updated[idx].quantity + qty;
        const currentMinOrderQty = maxStock > 24 ? 24 : Math.max(maxStock, 1);
        const clampedQty = maxStock > 0 ? Math.min(newQty, maxStock) : newQty;
        updated[idx] = {
          ...updated[idx],
          quantity: quantityLocked ? maxStock : Math.max(currentMinOrderQty, clampedQty),
          maxStock,
          minOrderQty: currentMinOrderQty,
          price: itemPrice,
          lotItem: updated[idx].lotItem || lotItem,
          quantityLocked,
        };
        return updated;
      }

      // New item
      const rawQty = maxStock > 0 ? Math.min(qty, maxStock) : qty;
      const finalQty = quantityLocked ? maxStock : Math.max(minOrderQty, rawQty);
      return [
        ...prev,
        {
          sku: product.sku,
          name: product.name,
          size,
          quantity: finalQty,
          price: itemPrice,
          rrp: Number(product.rrp) || 0,
          imageUrl: product.imageUrl || product.image || "",
          maxStock,
          lotItem,
          category: product.category || "",
          moqStep: 1,
          minOrderQty,
          allocatedSize: "", // Will be populated when order returns with allocation info
          quantityLocked,
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
        // Prevent updates if quantity is locked (below MOQ threshold)
        if (i.quantityLocked) return i;
        const clamped = i.maxStock > 0 ? Math.min(newQty, i.maxStock) : newQty;
        return { ...i, quantity: Math.max(i.minOrderQty || 24, clamped) };
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
    .reduce((sum, i) => {
      // For lot items: total = unit price × maxStock (all units)
      // For regular items: total = unit price × quantity
      const itemTotal = i.lotItem ? i.price * i.maxStock : i.price * i.quantity;
      return sum + itemTotal;
    }, 0)
    .toFixed(2);

  /** Check if a product+size is already in the cart. */
  const isInCart = useCallback(
    (sku, size = "") =>
      items.some((i) => cartKey(i.sku, i.size) === cartKey(sku, size)),
    [items],
  );

  /** Check if any cart line exists for this SKU (any size). */
  const isSkuInCart = useCallback(
    (sku) => items.some((i) => i.sku === sku),
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
        isSkuInCart,
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
