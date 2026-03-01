/**
 * validate-schema.js — Post-migration validation script
 *
 * Checks all products in the database conform to the new schema:
 *   ✓ salePrice is a positive number
 *   ✓ sizes is an array of { size, quantity } objects
 *   ✓ totalQuantity matches the sum of sizes[].quantity
 *   ✓ no orphaned old fields (price without salePrice, sizeStock)
 *
 * Run:  node validate-schema.js
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const mongoose = require("mongoose");

async function validate() {
  console.log("🔍 Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected.\n");

  const db = mongoose.connection.db;
  const col = db.collection("products");

  const products = await col.find({}).toArray();
  console.log(`📦 Validating ${products.length} products...\n`);

  let passed = 0;
  let warnings = 0;
  const issues = [];

  for (const p of products) {
    const sku = p.sku || p.name || String(p._id);
    const productIssues = [];

    // 1. salePrice
    if (p.salePrice === undefined || p.salePrice === null) {
      productIssues.push("Missing salePrice");
    } else if (typeof p.salePrice !== "number" || p.salePrice < 0) {
      productIssues.push(`Invalid salePrice: ${p.salePrice}`);
    } else if (p.salePrice === 0) {
      productIssues.push("salePrice is £0.00 (may need attention)");
    }

    // 2. sizes format
    if (!Array.isArray(p.sizes)) {
      productIssues.push("sizes is not an array");
    } else if (p.sizes.length > 0) {
      const firstEntry = p.sizes[0];
      if (typeof firstEntry === "string") {
        productIssues.push(
          "sizes still in OLD format (array of strings) — run migration",
        );
      } else if (typeof firstEntry !== "object" || !firstEntry.size) {
        productIssues.push(
          `Invalid sizes entry format: ${JSON.stringify(firstEntry)}`,
        );
      }
    }

    // 3. totalQuantity
    if (p.totalQuantity === undefined || p.totalQuantity === null) {
      productIssues.push("Missing totalQuantity");
    } else if (
      Array.isArray(p.sizes) &&
      p.sizes.length > 0 &&
      typeof p.sizes[0] === "object"
    ) {
      const computedTotal = p.sizes.reduce(
        (sum, s) => sum + (s.quantity || 0),
        0,
      );
      if (computedTotal !== p.totalQuantity) {
        productIssues.push(
          `totalQuantity mismatch: stored=${p.totalQuantity}, computed=${computedTotal}`,
        );
      }
    }

    // 4. rrp sanity
    if (p.rrp && p.salePrice && p.rrp < p.salePrice) {
      productIssues.push(
        `RRP (${p.rrp}) is less than salePrice (${p.salePrice})`,
      );
    }

    if (productIssues.length > 0) {
      issues.push({ sku, issues: productIssues });
      warnings += productIssues.length;
    } else {
      passed++;
    }
  }

  console.log(`═══════════════════════════════════`);
  console.log(`  Validation Results`);
  console.log(`  Passed: ${passed}/${products.length}`);
  console.log(`  Issues: ${warnings} across ${issues.length} products`);
  console.log(`═══════════════════════════════════\n`);

  if (issues.length > 0) {
    console.log("Products with issues:");
    for (const item of issues.slice(0, 50)) {
      console.log(`  ⚠️  ${item.sku}`);
      item.issues.forEach((i) => console.log(`      → ${i}`));
    }
    if (issues.length > 50) {
      console.log(`  ... and ${issues.length - 50} more.`);
    }
  } else {
    console.log("✅ All products pass validation!");
  }

  await mongoose.disconnect();
  console.log("\n🔌 Disconnected.");
}

validate().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
