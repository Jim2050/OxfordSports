/**
 * migrate-schema.js — One-time migration script
 *
 * Converts existing Product documents from the old schema to the new one:
 *   • price  →  salePrice
 *   • sizes: [String] + sizeStock: Map  →  sizes: [{ size, quantity }]
 *   • quantity  →  totalQuantity  (recomputed from sizes sum)
 *
 * Safe to run multiple times — idempotent.
 * Run:  node migrate-schema.js
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const mongoose = require("mongoose");

async function migrate() {
  console.log("🔄 Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected.\n");

  const db = mongoose.connection.db;
  const col = db.collection("products");

  const allProducts = await col.find({}).toArray();
  console.log(`📦 Found ${allProducts.length} products to check.\n`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of allProducts) {
    try {
      const updates = {};

      // ── 1. Rename price → salePrice ──
      if (doc.price !== undefined && doc.salePrice === undefined) {
        updates.salePrice = doc.price;
        updates.$unset = updates.$unset || {};
        // We keep 'price' as a virtual in the schema, but remove from raw doc
        // Actually we leave it — the schema transform handles the alias
      } else if (doc.salePrice === undefined && doc.price === undefined) {
        updates.salePrice = 0;
      }

      // ── 2. Convert sizes + sizeStock → sizes: [{size, quantity}] ──
      const oldSizes = doc.sizes;
      const oldSizeStock = doc.sizeStock;
      const needsSizesMigration =
        Array.isArray(oldSizes) &&
        oldSizes.length > 0 &&
        typeof oldSizes[0] === "string";

      if (needsSizesMigration) {
        const sizeStockMap =
          oldSizeStock && typeof oldSizeStock === "object"
            ? oldSizeStock instanceof Map
              ? Object.fromEntries(oldSizeStock)
              : oldSizeStock
            : {};

        const newSizes = oldSizes.map((s) => ({
          size: String(s).trim(),
          quantity: parseInt(sizeStockMap[s]) || 0,
        }));

        const totalQuantity = newSizes.reduce(
          (sum, s) => sum + (s.quantity || 0),
          0,
        );

        updates.sizes = newSizes;
        updates.totalQuantity = totalQuantity;
      } else if (!Array.isArray(oldSizes) || oldSizes.length === 0) {
        // No sizes at all — ensure totalQuantity is set
        if (doc.totalQuantity === undefined) {
          updates.totalQuantity = doc.quantity || 0;
        }
      } else {
        // Already in new format [{size, quantity}] — recompute totalQuantity
        if (doc.totalQuantity === undefined) {
          const total = oldSizes.reduce(
            (sum, s) =>
              sum + (typeof s === "object" ? parseInt(s.quantity) || 0 : 0),
            0,
          );
          updates.totalQuantity = total;
        }
      }

      // ── 3. Ensure salePrice is set ──
      if (updates.salePrice === undefined && doc.salePrice === undefined) {
        updates.salePrice = doc.price || 0;
      }

      // ── Apply updates ──
      const hasUpdates = Object.keys(updates).length > 0;
      if (hasUpdates) {
        // Separate $unset from $set
        const $unset = updates.$unset || {};
        delete updates.$unset;

        const updateOp = {};
        if (Object.keys(updates).length > 0) updateOp.$set = updates;
        if (Object.keys($unset).length > 0) updateOp.$unset = $unset;

        await col.updateOne({ _id: doc._id }, updateOp);
        migrated++;
        console.log(
          `  ✅ ${doc.sku || doc.name || doc._id} — migrated (salePrice: ${updates.salePrice ?? doc.salePrice}, sizes: ${(updates.sizes || doc.sizes || []).length} entries)`,
        );
      } else {
        skipped++;
      }
    } catch (err) {
      errors++;
      console.error(
        `  ❌ ${doc.sku || doc.name || doc._id} — ERROR: ${err.message}`,
      );
    }
  }

  console.log(`\n═══════════════════════════════════`);
  console.log(`  Migration Complete`);
  console.log(`  Migrated: ${migrated}`);
  console.log(`  Skipped (already up-to-date): ${skipped}`);
  console.log(`  Errors:   ${errors}`);
  console.log(`═══════════════════════════════════\n`);

  await mongoose.disconnect();
  console.log("🔌 Disconnected from MongoDB.");
}

migrate().catch((err) => {
  console.error("Fatal migration error:", err);
  process.exit(1);
});
