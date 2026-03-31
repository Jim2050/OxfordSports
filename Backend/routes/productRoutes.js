/**
 * Product Routes — Public product browsing
 * GET /api/products
 * GET /api/products/brands
 * GET /api/products/categories
 * GET /api/products/colors
 * GET /api/products/:sku
 */

const express = require("express");
const router = express.Router();
const {
  getProducts,
  getBrands,
  getCategories,
  getSubcategories,
  getColors,
  getProductBySku,
} = require("../controllers/productController");

router.get("/", getProducts);
router.get("/brands", (req, res, next) => { res.set("Cache-Control", "public, max-age=300"); next(); }, getBrands);
router.get("/categories", (req, res, next) => { res.set("Cache-Control", "public, max-age=300"); next(); }, getCategories);
router.get("/subcategories", (req, res, next) => { res.set("Cache-Control", "public, max-age=300"); next(); }, getSubcategories);
router.get("/colors", (req, res, next) => { res.set("Cache-Control", "public, max-age=300"); next(); }, getColors);
router.get("/:sku", getProductBySku);

module.exports = router;
