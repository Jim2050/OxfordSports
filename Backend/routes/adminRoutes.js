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

/**
 * POST /api/admin/products
 * Add a single product.
 */
router.post("/products", (req, res) => {
  try {
    const {
      sku,
      name,
      description,
      category,
      subcategory,
      brand,
      price,
      sizes,
      quantity,
    } = req.body;
    if (!name)
      return res.status(400).json({ error: "Product name is required." });
    if (price === undefined || price === null)
      return res.status(400).json({ error: "Price is required." });

    const row = {
      sku: sku || "",
      name,
      description: description || "",
      category: category || "",
      subcategory: subcategory || "",
      brand: brand || "",
      price,
      sizes: sizes || "",
      quantity: quantity || "",
    };

    const result = productStore.bulkUpsert([row]);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/admin/products/:sku
 * Update an existing product by SKU.
 */
router.put("/products/:sku", (req, res) => {
  try {
    const existing = productStore.getBySku(req.params.sku);
    if (!existing) return res.status(404).json({ error: "Product not found." });

    // Merge updates — use bulkUpsert which handles the upsert logic
    const row = {
      sku: req.params.sku,
      name: req.body.name ?? existing.name,
      description: req.body.description ?? existing.description,
      category: req.body.category ?? existing.category,
      subcategory: req.body.subcategory ?? existing.subcategory,
      brand: req.body.brand ?? existing.brand,
      price: req.body.price ?? existing.price,
      sizes: req.body.sizes ?? existing.sizes,
      quantity: req.body.quantity ?? existing.quantity,
      imageUrl: req.body.imageUrl ?? existing.imageUrl,
    };

    const result = productStore.bulkUpsert([row]);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/export
 * Export all products as JSON (frontend converts to Excel).
 */
router.get("/export", (req, res) => {
  try {
    const products = productStore.readAll();
    res.json({ products });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
