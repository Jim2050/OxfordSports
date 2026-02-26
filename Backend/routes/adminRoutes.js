/**
 * Admin Routes — Login, CRUD, import/export, images
 * All routes except /login are protected (JWT + admin role)
 */

const express = require("express");
const router = express.Router();
const { protect, adminOnly } = require("../middleware/authMiddleware");
const { uploadExcel, uploadZip } = require("../middleware/uploadMiddleware");

const {
  adminLogin,
  addProduct,
  updateProduct,
  deleteProduct,
  deleteAllProducts,
  getCategories,
  exportProducts,
  getStats,
} = require("../controllers/adminController");

const {
  importProducts,
  uploadImages: uploadImagesCtrl,
  getImportBatches,
} = require("../controllers/importController");

// ── Public ──
router.post("/login", adminLogin);

// ── Protected (JWT + admin) ──
router.use(protect, adminOnly);

// Dashboard
router.get("/stats", getStats);

// Product CRUD
router.post("/products", addProduct);
router.put("/products/:sku", updateProduct);
router.delete("/products/:sku", deleteProduct);
router.delete("/products", deleteAllProducts);

// Categories
router.get("/categories", getCategories);

// Import / Export
router.post("/import-products", uploadExcel, importProducts);
router.post("/upload-images", uploadZip, uploadImagesCtrl);
router.get("/import-batches", getImportBatches);
router.get("/export", exportProducts);

module.exports = router;
