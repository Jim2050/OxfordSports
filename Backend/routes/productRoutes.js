const express = require("express");
const router = express.Router();
const productStore = require("../services/productStore");

/**
 * GET /api/products
 * Query params: category, maxPrice, search
 */
router.get("/", (req, res) => {
  try {
    const { category, maxPrice, search } = req.query;
    const products = productStore.getAll({ category, maxPrice, search });
    res.json({ products, total: products.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/products/:sku
 */
router.get("/:sku", (req, res) => {
  try {
    const product = productStore.getBySku(req.params.sku);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
