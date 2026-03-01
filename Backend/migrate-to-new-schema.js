/**
 * migrate-to-new-schema.js
 * ────────────────────────
 * Converts ALL existing products from old schema to new schema.
 *
 * Old format:
 *   price: Number          → salePrice
 *   sizes: ["8", "9"]      → [{size: "8", quantity: 1}, {size: "9", quantity: 1}]
 *   quantity: Number        → (ignore — recompute from sizes)
 *   (no totalQuantity)      → totalQuantity = sum of size quantities
 *   (no sizeStock)          → computed in toJSON
 *
 * New format:
 *   salePrice: Number
 *   rrp: Number
 *   sizes: [{size: String, quantity: Number}]
 *   totalQuantity: Number
 *
 * Safe to run multiple times — idempotent.
 */
const mongoose = require("mongoose");

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://bhuttokashifali957:mongodb%4012@cluster0.puflo.mongodb.net/Oxford";

async function migrate() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  const col = db.collection("products");

  const total = await col.countDocuments();
  console.log(`Total products in DB: ${total}`);

  // Fetch ALL products as raw documents
  const products = await col.find({}).toArray();

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of products) {
    const updates = {};
    const unsets = {};

    // ── 1. Price → salePrice ──
    if (doc.salePrice === undefined || doc.salePrice === null) {
      // Old format: use "price" field
      const oldPrice = doc.price;
      if (typeof oldPrice === "number" && oldPrice > 0) {
        updates.salePrice = oldPrice;
      } else if (typeof oldPrice === "string") {
        const parsed = parseFloat(oldPrice.replace(/[£$€,\s]/g, ""));
        if (!isNaN(parsed) && parsed > 0) {
          updates.salePrice = parsed;
        } else {
          updates.salePrice = 0;
        }
      } else {
        updates.salePrice = 0;
      }
    } else if (doc.salePrice === 0 && doc.price > 0) {
      // salePrice was set to 0 but old price exists
      updates.salePrice = doc.price;
    }

    // ── 2. Sizes: convert string array to object array ──
    if (Array.isArray(doc.sizes) && doc.sizes.length > 0) {
      const first = doc.sizes[0];
      if (typeof first === "string") {
        // Old format: ["8", "9", "10"]
        // Convert to [{size: "8", quantity: 1}, ...]
        // Each entry gets quantity=1 (since old schema didn't track per-size qty)
        updates.sizes = doc.sizes.map((s) => ({
          size: String(s).trim(),
          quantity: 1,
        }));
        console.log(
          `  ${doc.sku}: sizes converted: [${doc.sizes.join(", ")}] → ${updates.sizes.length} entries`,
        );
      }
      // If already object format [{size, quantity}], leave it
    } else if (!doc.sizes || doc.sizes.length === 0) {
      // No sizes at all — create ONE SIZE entry
      const qty =
        doc.quantity > 0
          ? doc.quantity
          : doc.totalQuantity > 0
            ? doc.totalQuantity
            : 1;
      updates.sizes = [{ size: "ONE SIZE", quantity: qty }];
    }

    // ── 3. Compute totalQuantity ──
    const finalSizes = updates.sizes || doc.sizes || [];
    let totalQty = 0;
    for (const entry of finalSizes) {
      if (typeof entry === "object" && entry.quantity !== undefined) {
        totalQty += Number(entry.quantity) || 0;
      } else if (typeof entry === "string") {
        totalQty += 1; // old format: 1 per size string
      }
    }
    updates.totalQuantity = totalQty;

    // ── 4. Clean up old fields ──
    // Remove "price" field if we migrated it to "salePrice"
    // (Mongoose ignores it, but keeping it creates confusion)
    if (doc.price !== undefined && updates.salePrice !== undefined) {
      unsets.price = "";
    }
    // Remove old "quantity" field (replaced by totalQuantity)
    if (doc.quantity !== undefined) {
      unsets.quantity = "";
    }
    // Remove old sizeStock if it exists as a stored field
    if (doc.sizeStock !== undefined) {
      unsets.sizeStock = "";
    }

    // ── Apply updates ──
    if (Object.keys(updates).length > 0 || Object.keys(unsets).length > 0) {
      const updateOp = {};
      if (Object.keys(updates).length > 0) updateOp.$set = updates;
      if (Object.keys(unsets).length > 0) updateOp.$unset = unsets;

      try {
        await col.updateOne({ _id: doc._id }, updateOp);
        migrated++;
        const sp =
          updates.salePrice !== undefined ? updates.salePrice : doc.salePrice;
        console.log(
          `  ✓ ${doc.sku}: salePrice=${sp}, totalQty=${updates.totalQuantity}, sizes=${(updates.sizes || doc.sizes || []).length}`,
        );
      } catch (err) {
        errors++;
        console.error(`  ✗ ${doc.sku}: ${err.message}`);
      }
    } else {
      skipped++;
    }
  }

  console.log("\n════════════════════════════════════");
  console.log(`Migration complete:`);
  console.log(`  Migrated: ${migrated}`);
  console.log(`  Skipped (already new format): ${skipped}`);
  console.log(`  Errors: ${errors}`);
  console.log("════════════════════════════════════");

  // Verify
  console.log("\nVerification:");
  const withSalePrice = await col.countDocuments({ salePrice: { $gt: 0 } });
  const withSizes = await col.countDocuments({
    sizes: { $exists: true, $not: { $size: 0 } },
  });
  const withTotalQty = await col.countDocuments({ totalQuantity: { $gt: 0 } });
  const sample = await col.findOne({});
  console.log(`  Products with salePrice > 0: ${withSalePrice}/${total}`);
  console.log(`  Products with sizes non-empty: ${withSizes}/${total}`);
  console.log(`  Products with totalQuantity > 0: ${withTotalQty}/${total}`);
  console.log(`\nSample doc after migration:`);
  console.log(JSON.stringify(sample, null, 2));

  await mongoose.disconnect();
  console.log("\nDone.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
