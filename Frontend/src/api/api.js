import API from "./axiosInstance";

// ── Helper: get admin auth header ──
function adminHeaders() {
  const token = sessionStorage.getItem("adminToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ══════════════════════════════════════════
//  Public Product API
// ══════════════════════════════════════════

export const fetchProducts = (params) =>
  API.get("/products", { params }).then((r) => r.data);

export const fetchProductsByCategory = (category) =>
  API.get(`/products?category=${encodeURIComponent(category)}`).then(
    (r) => r.data,
  );

export const fetchUnderFive = () =>
  API.get("/products?maxPrice=5").then((r) => r.data);

export const fetchBrands = () =>
  API.get("/products/brands").then((r) => r.data);

export const fetchPublicCategories = () =>
  API.get("/products/categories").then((r) => r.data);

export const fetchColors = () =>
  API.get("/products/colors").then((r) => r.data);

// ══════════════════════════════════════════
//  Contact
// ══════════════════════════════════════════

export const sendContact = (data) =>
  API.post("/contact", data).then((r) => r.data);

// ══════════════════════════════════════════
//  Orders (Member)
// ══════════════════════════════════════════

export const placeOrder = (items, notes = "") => {
  const token = localStorage.getItem("memberToken");
  return API.post(
    "/orders",
    { items, notes },
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  ).then((r) => r.data);
};

export const fetchMyOrders = () => {
  const token = localStorage.getItem("memberToken");
  return API.get("/orders/mine", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }).then((r) => r.data);
};

// Admin order management
export const fetchAdminOrders = (params) =>
  API.get("/admin/orders", { params, headers: adminHeaders() }).then(
    (r) => r.data,
  );

export const updateOrderStatus = (id, status) =>
  API.put(
    `/admin/orders/${id}/status`,
    { status },
    { headers: adminHeaders() },
  ).then((r) => r.data);

export const exportOrders = (params) =>
  API.get("/admin/export-orders", {
    params,
    headers: adminHeaders(),
    responseType: "blob",
  }).then((r) => {
    // Trigger file download
    const url = URL.createObjectURL(r.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

// ══════════════════════════════════════════
//  Admin Auth + CRUD
// ══════════════════════════════════════════

export const adminLogin = (email, password) =>
  API.post("/admin/login", { email, password }).then((r) => r.data);

export const deleteProduct = (sku) =>
  API.delete(`/admin/products/${encodeURIComponent(sku)}`, {
    headers: adminHeaders(),
  }).then((r) => r.data);

export const deleteAllProducts = (confirmCode) =>
  API.delete("/admin/products", {
    headers: adminHeaders(),
    data: { confirmCode },
  }).then((r) => r.data);

export const fetchCategories = () =>
  API.get("/admin/categories", { headers: adminHeaders() }).then((r) => r.data);

/** Fetch backup batches available for restore */
export const fetchDeletedBatches = () =>
  API.get("/admin/deleted-batches", { headers: adminHeaders() }).then((r) => r.data);

/** Restore products from a backup batch */
export const restoreProducts = (batchId) =>
  API.post(`/admin/restore-products/${batchId}`, {}, { headers: adminHeaders() }).then((r) => r.data);

export const addProduct = (data) =>
  API.post("/admin/products", data, { headers: adminHeaders() }).then(
    (r) => r.data,
  );

export const updateProduct = (sku, data) =>
  API.put(`/admin/products/${encodeURIComponent(sku)}`, data, {
    headers: adminHeaders(),
  }).then((r) => r.data);

export const exportProducts = () =>
  API.get("/admin/export", { headers: adminHeaders() }).then((r) => r.data);

export const fetchAdminStats = () =>
  API.get("/admin/stats", { headers: adminHeaders() }).then((r) => r.data);

export const fixSubcategories = () =>
  API.post("/admin/fix-subcategories", {}, { headers: adminHeaders() }).then(
    (r) => r.data,
  );

export const fixBrands = (brand = "adidas") =>
  API.post("/admin/fix-brands", { brand }, { headers: adminHeaders() }).then(
    (r) => r.data,
  );

// ══════════════════════════════════════════
//  Admin Import / Upload
// ══════════════════════════════════════════

export const uploadExcel = (file, onProgress) => {
  const form = new FormData();
  form.append("file", file);
  return API.post("/admin/import-products", form, {
    headers: { "Content-Type": "multipart/form-data", ...adminHeaders() },
    onUploadProgress: onProgress,
    timeout: 300000, // 5 min — matches backend timeout for large imports
  }).then((r) => r.data);
};

export const uploadImages = (file, onProgress) => {
  const form = new FormData();
  form.append("file", file);
  return API.post("/admin/upload-images", form, {
    headers: { "Content-Type": "multipart/form-data", ...adminHeaders() },
    onUploadProgress: onProgress,
    timeout: 120000, // 2 min for upload + initial response
  }).then((r) => r.data);
};

export const getImageUploadStatus = (jobId) =>
  API.get(`/admin/image-upload-status/${jobId}`, {
    headers: adminHeaders(),
  }).then((r) => r.data);

export const fetchImportBatches = () =>
  API.get("/admin/import-batches", {
    headers: adminHeaders(),
  }).then((r) => r.data);

export const resolveImages = (limit = 100) =>
  API.post(
    `/admin/resolve-images?limit=${limit}`,
    {},
    {
      headers: adminHeaders(),
    },
  ).then((r) => r.data);

export const fixPrices = () =>
  API.post("/admin/fix-prices", {}, { headers: adminHeaders() }).then(
    (r) => r.data,
  );

// ══════════════════════════════════════════
//  Image URL resolver & helpers
// ══════════════════════════════════════════

/** Known image file extensions */
const IMG_EXTENSIONS = /\.(jpe?g|png|webp|gif|svg|bmp|avif)(\?.*)?$/i;

/**
 * Check whether a URL points to an actual image resource.
 * Rejects Google search URLs, landing pages, etc.
 */
export function isDirectImageUrl(url) {
  if (!url) return false;
  const s = String(url).trim().toLowerCase();
  if (s.length < 10) return false;
  // Reject known non-image domains / patterns
  if (
    s.includes("google.com/search") ||
    s.includes("bing.com/images") ||
    s.includes("tbm=isch") ||
    s === "google images" ||
    s === "google image"
  )
    return false;
  if (!s.startsWith("http://") && !s.startsWith("https://")) return false;
  // Accept if extension matches a known image type
  if (IMG_EXTENSIONS.test(s)) return true;
  // Accept known CDN domains that serve images without file extension
  if (
    s.includes("cloudinary.com") ||
    s.includes("res.cloudinary.com") ||
    s.includes("imgur.com") ||
    s.includes("images.unsplash.com") ||
    s.includes("cdn.shopify.com")
  )
    return true;
  // Reject everything else (landing pages, search results, etc.)
  return false;
}

/**
 * Resolve image URLs: validates the URL is a direct image, prepends
 * backend origin for relative paths.  Returns null for non-image URLs.
 */
export function resolveImageUrl(url) {
  if (!url) return null;
  const trimmed = String(url).trim();
  // Relative path → prepend backend base
  if (trimmed.startsWith("/")) {
    const apiBase = import.meta.env.VITE_API_BASE_URL || "";
    // Derive backend origin from API base URL (strip trailing /api)
    const backendBase =
      import.meta.env.VITE_BACKEND_URL ||
      apiBase.replace(/\/api\/?$/, "") ||
      "";
    return backendBase ? `${backendBase}${trimmed}` : trimmed;
  }
  // Absolute URL → validate it points to an actual image
  if (isDirectImageUrl(trimmed)) return trimmed;
  // Not a usable image URL
  return null;
}

/**
 * Determine the display price for a product.
 * product.price (SALE price) is the single source of truth.
 * Returns a numeric value (never NaN).
 */
export function getDisplayPrice(product) {
  // Prefer salePrice, fall back to legacy "price"
  const sale = Number(product?.salePrice);
  if (!isNaN(sale) && sale >= 0) return sale;
  const price = Number(product?.price);
  if (!isNaN(price) && price >= 0) return price;
  return 0;
}

/**
 * Compute discount percentage from RRP and sale price.
 */
export function getDiscountPercentage(product) {
  if (product?.discountPercentage) return product.discountPercentage;
  const rrp = Number(product?.rrp) || 0;
  const sale = getDisplayPrice(product);
  if (rrp > 0 && sale < rrp) return Math.round(((rrp - sale) / rrp) * 100);
  return 0;
}

/**
 * Get total available quantity across all sizes.
 */
export function getTotalQuantity(product) {
  if (product?.totalQuantity != null) return product.totalQuantity;
  if (product?.quantity != null) return product.quantity;
  if (Array.isArray(product?.sizes)) {
    return product.sizes.reduce((sum, s) => {
      if (typeof s === "object" && s.quantity != null) return sum + s.quantity;
      return sum;
    }, 0);
  }
  return 0;
}

/**
 * Get sizes array in normalized format: [{size, quantity}]
 */
export function getSizes(product) {
  const normalizeDisplaySizeLabel = (rawSize) => {
    const text = String(rawSize || "")
      .replace(/[\u2212\u2012\u2013\u2014\u2015]/g, "-")
      .trim();
    if (!text) return "";

    const embedded = text.match(/^(.*)\((\d+)\)$/);
    const labelOnly = embedded ? embedded[1].trim() : text;
    return labelOnly.replace(/^-(?=\d)/, "").trim();
  };

  const splitPackedSizes = (rawSize, fallbackQty = 0) => {
    const text = String(rawSize || "")
      .replace(/[\u2212\u2012\u2013\u2014\u2015]/g, "-")
      .trim();
    if (!text) return [];
    const parts = text.split(/[;,]/).map((s) => s.trim()).filter(Boolean);

    const parsed = parts.map((part) => {
      const match = part.match(/^(.*)\((\d+)\)$/);
      if (!match) {
        return {
          size: normalizeDisplaySizeLabel(part),
          quantity: Number(fallbackQty) || 0,
        };
      }
      return {
        size: normalizeDisplaySizeLabel(match[1]),
        quantity: Number(match[2]) || 0,
      };
    });

    return parsed.filter((entry) => entry.size);
  };

  if (!product) return [];
  const sizes = product.sizes;
  if (!Array.isArray(sizes) || sizes.length === 0) return [];
  if (typeof sizes[0] === "object" && sizes[0].size !== undefined) {
    const expanded = sizes.flatMap((entry) =>
      splitPackedSizes(entry?.size, entry?.quantity),
    );
    const merged = new Map();
    for (const entry of expanded) {
      const size = normalizeDisplaySizeLabel(entry?.size);
      if (!size) continue;
      const quantity = Number(entry?.quantity) || 0;
      if (quantity <= 0) continue;
      merged.set(size, (merged.get(size) || 0) + quantity);
    }
    return Array.from(merged.entries()).map(([size, quantity]) => ({
      size,
      quantity,
    }));
  }
  // Legacy: array of strings — derive quantities from sizeStock
  const sizeStock = product.sizeStock || {};
  return sizes
    .map((s) => ({
      size: String(s),
      quantity: sizeStock[String(s)] || 0,
    }))
    .filter((entry) => entry.size.trim() !== "");
}

// ═══════════════════════════════════════════════════════════════
//  MOQ (Minimum Order Quantity) helpers
// ═══════════════════════════════════════════════════════════════

/** Minimum cart total (£) — orders below this are rejected. */
export const MIN_CART_TOTAL = 300;

/**
 * Determine MOQ rules for a product.
 *
 * Rules (from client — Lily / Jim, March 2026):
 *   FOOTWEAR  — min order 12 units, totalQty < 12 → must buy ALL
 *   Everything else — min order 25 units, totalQty < 25 → must buy ALL
 *
 * Returns { threshold, mustBuyAll: boolean }
 */
export function getMOQInfo(product) {
  const cat = (product?.category || "").toUpperCase();
  const totalQty = getTotalQuantity(product);
  const isFootwear = cat === "FOOTWEAR";
  const threshold = isFootwear ? 12 : 25;
  const mustBuyAll = totalQty > 0 && totalQty < threshold;
  return { threshold, mustBuyAll, totalQty };
}

/**
 * Pro-rata: average quantity per size.
 */
export function getProRata(product) {
  const sizes = getSizes(product);
  const availableSizes = sizes.filter((s) => s.quantity > 0);
  if (availableSizes.length === 0) return 0;
  const total = availableSizes.reduce((sum, s) => sum + s.quantity, 0);
  return +(total / availableSizes.length).toFixed(1);
}

/** Fetch subcategories for a given category name. */
export const fetchSubcategories = (categoryName) =>
  API.get("/products/subcategories", { params: { category: categoryName } }).then((r) => r.data);

/** Upload a single product image. */
export const uploadProductImage = (sku, file, onProgress) => {
  const form = new FormData();
  form.append("image", file);
  return API.post(`/admin/products/${encodeURIComponent(sku)}/upload-image`, form, {
    headers: { "Content-Type": "multipart/form-data", ...adminHeaders() },
    onUploadProgress: onProgress,
    timeout: 60000,
  }).then((r) => r.data);
};

/** Bulk recategorize products. */
export const bulkRecategorize = (data) =>
  API.put("/admin/products/bulk-recategorize", data, {
    headers: adminHeaders(),
  }).then((r) => r.data);

