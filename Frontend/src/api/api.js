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
//  Admin Auth + CRUD
// ══════════════════════════════════════════

export const adminLogin = (email, password) =>
  API.post("/admin/login", { email, password }).then((r) => r.data);

export const deleteProduct = (sku) =>
  API.delete(`/admin/products/${encodeURIComponent(sku)}`, {
    headers: adminHeaders(),
  }).then((r) => r.data);

export const deleteAllProducts = () =>
  API.delete("/admin/products", { headers: adminHeaders() }).then(
    (r) => r.data,
  );

export const fetchCategories = () =>
  API.get("/admin/categories", { headers: adminHeaders() }).then((r) => r.data);

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
  }).then((r) => r.data);
};

export const uploadImages = (file, onProgress) => {
  const form = new FormData();
  form.append("file", file);
  return API.post("/admin/upload-images", form, {
    headers: { "Content-Type": "multipart/form-data", ...adminHeaders() },
    onUploadProgress: onProgress,
  }).then((r) => r.data);
};

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
    const backendBase =
      import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
    return `${backendBase}${trimmed}`;
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
  const price = Number(product?.price);
  if (!isNaN(price) && price >= 0) return price;
  return 0;
}
