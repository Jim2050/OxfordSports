import API from "./axiosInstance";

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

export const uploadExcel = (file, onProgress) => {
  const form = new FormData();
  form.append("file", file);
  return API.post("/upload/excel", form, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: onProgress,
  }).then((r) => r.data);
};

export const uploadImages = (file, onProgress) => {
  const form = new FormData();
  form.append("file", file);
  return API.post("/upload/images", form, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: onProgress,
  }).then((r) => r.data);
};

export const sendContact = (data) =>
  API.post("/contact", data).then((r) => r.data);

export const adminLogin = (password) =>
  API.post("/admin/login", { password }).then((r) => r.data);

export const deleteProduct = (sku) =>
  API.delete(`/admin/products/${encodeURIComponent(sku)}`).then((r) => r.data);

export const deleteAllProducts = () =>
  API.delete("/admin/products").then((r) => r.data);

export const fetchCategories = () =>
  API.get("/admin/categories").then((r) => r.data);

export const addProduct = (data) =>
  API.post("/admin/products", data).then((r) => r.data);

export const updateProduct = (sku, data) =>
  API.put(`/admin/products/${encodeURIComponent(sku)}`, data).then(
    (r) => r.data,
  );

export const exportProducts = () =>
  API.get("/admin/export").then((r) => r.data);

/**
 * Resolve image URLs: if relative (starts with /), prepend backend origin.
 * In dev, the Vite proxy handles /api but NOT /uploads, so we need the full backend URL.
 */
export function resolveImageUrl(url) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  // In dev, images are served from the backend directly
  const backendBase =
    import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
  return `${backendBase}${url}`;
}
