/**
 * Product Store — flat-file JSON storage.
 * No database needed. Products are stored in /data/products.json.
 * Supports upsert by SKU for idempotent Excel re-uploads.
 */

const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "data", "products.json");

function readAll() {
  try {
    const raw = fs.readFileSync(FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeAll(products) {
  fs.writeFileSync(FILE, JSON.stringify(products, null, 2));
}

/** Get all products, optionally filtered */
function getAll(filters = {}) {
  let products = readAll();

  if (filters.category) {
    const cat = filters.category.toLowerCase();
    products = products.filter(
      (p) =>
        (p.category || "").toLowerCase() === cat || slugify(p.category) === cat,
    );
  }

  if (filters.maxPrice !== undefined) {
    const max = parseFloat(filters.maxPrice);
    if (!isNaN(max)) {
      products = products.filter((p) => parseFloat(p.price) <= max);
    }
  }

  if (filters.search) {
    const q = filters.search.toLowerCase();
    products = products.filter(
      (p) =>
        (p.name || "").toLowerCase().includes(q) ||
        (p.sku || "").toLowerCase().includes(q) ||
        (p.brand || "").toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q),
    );
  }

  return products;
}

/** Get single product by SKU */
function getBySku(sku) {
  return readAll().find(
    (p) => (p.sku || "").toUpperCase() === sku.toUpperCase(),
  );
}

/** Total product count */
function count() {
  return readAll().length;
}

/**
 * Bulk upsert from parsed Excel rows.
 * Returns { imported, updated, failed, errors, total }.
 */
function bulkUpsert(rows) {
  const products = readAll();
  const skuMap = new Map();
  products.forEach((p, i) => skuMap.set((p.sku || "").toUpperCase(), i));

  let imported = 0;
  let updated = 0;
  let failed = 0;
  const errors = [];

  rows.forEach((row, rowIdx) => {
    // Validate required fields
    if (!row.name || String(row.name).trim() === "") {
      failed++;
      errors.push({
        row: rowIdx + 2,
        sku: row.sku || null,
        reason: "Missing product name",
      });
      return;
    }
    if (row.price === undefined || row.price === null || row.price === "") {
      failed++;
      errors.push({
        row: rowIdx + 2,
        sku: row.sku || null,
        reason: "Missing price",
      });
      return;
    }
    const price = parseFloat(row.price);
    if (isNaN(price) || price < 0) {
      failed++;
      errors.push({
        row: rowIdx + 2,
        sku: row.sku || null,
        reason: `Invalid price: ${row.price}`,
      });
      return;
    }

    // Generate SKU if missing
    const sku = row.sku
      ? String(row.sku).trim().toUpperCase()
      : `AUTO-${Date.now()}-${rowIdx}`;

    const product = {
      sku,
      name: String(row.name).trim(),
      description: row.description ? String(row.description).trim() : "",
      category: row.category ? String(row.category).trim() : "",
      subcategory: row.subcategory ? String(row.subcategory).trim() : "",
      brand: row.brand ? String(row.brand).trim() : "",
      price: price.toFixed(2),
      sizes: row.sizes ? String(row.sizes).trim() : "",
      quantity: row.quantity ? String(row.quantity).trim() : "",
      imageUrl: row.imageUrl || row.image || "",
      updatedAt: new Date().toISOString(),
    };

    const existingIdx = skuMap.get(sku);
    if (existingIdx !== undefined) {
      // Preserve existing image if new row doesn't have one
      if (!product.imageUrl && products[existingIdx].imageUrl) {
        product.imageUrl = products[existingIdx].imageUrl;
      }
      product.createdAt = products[existingIdx].createdAt || product.updatedAt;
      products[existingIdx] = product;
      updated++;
    } else {
      product.createdAt = product.updatedAt;
      products.push(product);
      skuMap.set(sku, products.length - 1);
      imported++;
    }
  });

  writeAll(products);

  return {
    total: rows.length,
    imported,
    updated,
    failed,
    errors,
  };
}

/**
 * Update a product's image URL by SKU.
 * Returns true if found & updated, false otherwise.
 */
function setImage(sku, imageUrl) {
  const products = readAll();
  const idx = products.findIndex(
    (p) => (p.sku || "").toUpperCase() === sku.toUpperCase(),
  );
  if (idx === -1) return false;
  products[idx].imageUrl = imageUrl;
  products[idx].updatedAt = new Date().toISOString();
  writeAll(products);
  return true;
}

function slugify(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

module.exports = { getAll, getBySku, count, bulkUpsert, setImage, readAll };
