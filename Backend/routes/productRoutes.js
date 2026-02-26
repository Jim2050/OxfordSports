/**
 * Product Routes — Public product browsing
 * GET /api/products
 * GET /api/products/brands
 * GET /api/products/:sku
 */

const express = require("express");
const router = express.Router();
const {
  getProducts,
  getBrands,
  getProductBySku,
} = require("../controllers/productController");

router.get("/", getProducts);
router.get("/brands", getBrands);
router.get("/:sku", getProductBySku);

module.exports = router;
