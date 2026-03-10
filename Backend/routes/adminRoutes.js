/**
 * Admin Routes — Login, CRUD, import/export, images
 * All routes except /login are protected (JWT + admin role)
 */

const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/authMiddleware");
const { uploadExcel, uploadZip } = require("../middleware/uploadMiddleware");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const TEMP_DIR = path.join(__dirname, "..", "uploads", "temp");
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
const singleImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, TEMP_DIR),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error("Only image files are allowed."));
  },
}).single("image");

const {
  adminLogin,
  addProduct,
  updateProduct,
  deleteProduct,
  deleteAllProducts,
  getCategories,
  exportProducts,
  getStats,
  fixSubcategories,
  fixBrands,
  uploadProductImage,
  bulkRecategorize,
  getDeletedBatches,
  restoreProducts,
} = require("../controllers/adminController");

const {
  getOrders,
  updateOrderStatus,
  exportOrders,
} = require("../controllers/orderController");

const {
  importProducts,
  uploadImages: uploadImagesCtrl,
  getImportBatches,
  getImageUploadStatus,
  resolveImages,
  fixPrices,
} = require("../controllers/importController");

// ── Public ──
router.post("/login", adminLogin);

// ── Protected (JWT + admin) ──
router.use(protect, adminOnly);

// Dashboard
router.get("/stats", getStats);

// Product CRUD
router.post("/products", addProduct);
router.put("/products/bulk-recategorize", bulkRecategorize);
router.put("/products/:sku", updateProduct);
router.post("/products/:sku/upload-image", singleImageUpload, uploadProductImage);
router.delete("/products/:sku", deleteProduct);
router.delete("/products", deleteAllProducts);

// Categories
router.get("/categories", getCategories);

// Deleted product backups & restore
router.get("/deleted-batches", getDeletedBatches);
router.post("/restore-products/:batchId", restoreProducts);

// Import / Export
router.post("/import-products", uploadExcel, importProducts);
router.post("/upload-images", uploadZip, uploadImagesCtrl);
router.get("/image-upload-status/:jobId", getImageUploadStatus);
router.get("/import-batches", getImportBatches);
router.get("/export", exportProducts);

// Orders
router.get("/orders", getOrders);
router.put("/orders/:id/status", updateOrderStatus);
router.get("/export-orders", exportOrders);

// One-time migration utilities
router.post("/fix-subcategories", fixSubcategories);
router.post("/fix-brands", fixBrands);
router.post("/fix-prices", fixPrices);
router.post("/resolve-images", resolveImages);

module.exports = router;
