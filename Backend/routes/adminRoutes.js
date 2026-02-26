const express = require("express");
const router = express.Router();
const productStore = require("../services/productStore");

/** Simple auth middleware for admin routes */
function requireAdmin(req, res, next) {
  const token = req.headers.authorization;
  if (token === "Bearer admin-session") return next();
  // Also accept if the request has the password in body (for login)
  return res.status(401).json({ error: "Unauthorized" });
}

/**
 * POST /api/admin/login
 * Simple password check — no user accounts needed.
 */
router.post("/login", (req, res) => {
  const { password } = req.body;
  const correctPassword = process.env.ADMIN_PASSWORD || "admin";

  if (password === correctPassword) {
    return res.json({ success: true, token: "admin-session" });
  }

  return res.status(401).json({ success: false, error: "Incorrect password." });
});

/**
 * DELETE /api/admin/products/:sku
 * Delete a single product by SKU.
 */
router.delete("/products/:sku", (req, res) => {
  try {
    const deleted = productStore.deleteBySku(req.params.sku);
    if (!deleted) return res.status(404).json({ error: "Product not found." });
    res.json({ success: true, message: "Product deleted." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/admin/products
 * Clear all products.
 */
router.delete("/products", (req, res) => {
  try {
    productStore.deleteAll();
    res.json({ success: true, message: "All products cleared." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/categories
 * Get list of distinct categories.
 */
router.get("/categories", (req, res) => {
  try {
    const categories = productStore.getCategories();
    res.json({ categories });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
