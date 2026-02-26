import API from "./axiosInstance";

export const fetchProducts = () => API.get("/products").then((r) => r.data);

export const fetchProductsByCategory = (category) =>
  API.get(`/products?category=${encodeURIComponent(category)}`).then(
    (r) => r.data,
  );

export const fetchUnderFive = () =>
  API.get("/products?maxPrice=5").then((r) => r.data);

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
