/**
 * DIAGNOSTIC SCRIPT FOR ISSUE #1 - Size Consolidation
 * 
 * Run this to quickly identify why products are showing "ONE SIZE"
 * Usage: node Backend/diagnose-size-consolidation.js
 * 
 * This script will:
 * 1. Check MongoDB for products with no sizes
 * 2. Analyze column headers from a sample Excel import
 * 3. Show what parseSizeEntries returns for sample data
 * 4. Trace the consolidation logic step-by-step
 */

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const mongoose = require("mongoose");
const Product = require("./models/Product");

// Import size utilities
const { parseSizeEntries } = require("./utils/taxonomyUtils");
const { normalizeSizeEntries } = require("./utils/sizeStockUtils");

const DB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/oxford-sports";

console.log("\n╔════════════════════════════════════════════════════════════════╗");
console.log("║  DIAGNOSTIC TOOL: Size Consolidation Issue #1                  ║");
console.log("╚════════════════════════════════════════════════════════════════╝\n");

async function main() {
  try {
    // ── Connect to MongoDB ──
    console.log("📚 Connecting to MongoDB...");
    await mongoose.connect(DB_URI);
    console.log("✓ Connected\n");

    // ── Check Database State ──
    console.log("── DATABASE ANALYSIS ──\n");
    const totalProducts = await Product.countDocuments({});
    const productsNoSizes = await Product.countDocuments({ sizes: { $size: 0 } });
    const productsWithSizes = totalProducts - productsNoSizes;
    const productsOneSizeOnly = await Product.countDocuments({
      sizes: { $size: 1 },
    });
    const productsMultipleSizes = await Product.countDocuments({
      $where: "this.sizes.length > 1",
    });

    console.log(`Total products in DB:        ${totalProducts}`);
    console.log(`  - With sizes:              ${productsWithSizes} (${((productsWithSizes/totalProducts)*100).toFixed(1)}%)`);
    console.log(`  - Without sizes (NO FIELD): ${productsNoSizes} (${((productsNoSizes/totalProducts)*100).toFixed(1)}%)`);
    console.log(`  - With exactly 1 size:     ${productsOneSizeOnly}`);
    console.log(`  - With multiple sizes:     ${productsMultipleSizes}`);

    // Find some products with "ONE SIZE" to diagnose
    const oneSizeProducts = await Product.find({ 
      sizes: { $elemMatch: { size: "ONE SIZE" } } 
    }).limit(5);

    if (oneSizeProducts.length > 0) {
      console.log(`\n⚠️  Found ${oneSizeProducts.length} products with "ONE SIZE":\n`);
      oneSizeProducts.forEach((prod) => {
        console.log(`  SKU: ${prod.sku}`);
        console.log(`  Name: ${prod.name.substring(0, 60)}...`);
        console.log(`  Sizes: ${JSON.stringify(prod.sizes)}`);
        console.log(``);
      });
    }

    // ── Test Size Parsing Logic ──
    console.log("── SIZE PARSING LOGIC TEST ──\n");

    const testSamples = [
      { input: "M,L,XL", fallbackQty: 1, desc: "CSV list (M,L,XL)" },
      { input: "M(2),L(3),XL(1)", fallbackQty: 6, desc: "With embedded qty M(2),L(3),XL(1)" },
      { input: "M;L;XL", fallbackQty: 1, desc: "Semicolon separated M;L;XL" },
      { input: "M(5)", fallbackQty: 5, desc: "Single size with qty M(5)" },
      { input: "UK 8,UK 9,UK 10", fallbackQty: 1, desc: "Footwear sizes UK 8,UK 9,UK 10" },
      { input: "", fallbackQty: 1, desc: "Empty size (should default to ONE SIZE)" },
    ];

    for (const sample of testSamples) {
      console.log(`Input: "${sample.input}" | Qty: ${sample.fallbackQty}`);
      console.log(`Description: ${sample.desc}`);
      const parsed = parseSizeEntries(sample.input, sample.fallbackQty);
      console.log(`Parsed entries: ${JSON.stringify(parsed.entries)}`);
      console.log(`Invalid tokens: ${JSON.stringify(parsed.invalidTokens)}`);
      if (parsed.invalidTokens.length > 0) {
        console.log(` ⚠️ WARNING: Some sizes couldn't be parsed!`);
      }
      
      // Test normalization
      const normalized = normalizeSizeEntries(parsed.entries, "CLOTHING");
      console.log(`After normalization: ${JSON.stringify(normalized)}`);
      console.log(``);
    }

    // ── Inspect Recent Import Batch ──
    console.log("── RECENT IMPORT BATCH ANALYSIS ──\n");
    const ImportBatch = require("./models/ImportBatch");
    const recentBatch = await ImportBatch.findOne().sort({ createdAt: -1 });

    if (recentBatch) {
      console.log(`Latest import batch: ${recentBatch._id}`);
      console.log(`Timestamp: ${recentBatch.createdAt}`);
      console.log(`Status: ${recentBatch.status}`);

      if (recentBatch.validationResult) {
        const vr = recentBatch.validationResult;
        console.log(`\nValidation results:`);
        console.log(`  Total rows: ${vr.totalRows || "N/A"}`);
        console.log(`  With size data: ${vr.rowsWithSizeData || "N/A"}`);
        console.log(`  Size warnings: ${vr.sizeWarnings || 0}`);
      }

      // Show some products from import
      const batchProducts = await Product.find({ 
        sheetName: recentBatch.sheetName || { $exists: true } 
      }).limit(3);
      
      if (batchProducts.length > 0) {
        console.log(`\nSample products from batch:`);
        batchProducts.forEach((p) => {
          console.log(`  ${p.sku}: sizes=${JSON.stringify(p.sizes)} qty=${p.totalQuantity}`);
        });
      }
    } else {
      console.log("No import batches found in database");
    }

    // ── Recommendations ──
    console.log("\n── DIAGNOSIS & RECOMMENDATIONS ──\n");

    if (productsNoSizes > (totalProducts * 0.7)) {
      console.log("🔴 CRITICAL: Most products have NO sizes!");
      console.log("   Possible causes:");
      console.log("   1. Size column in Excel not being detected");
      console.log("   2. Size column named something unexpected");
      console.log("   3. Size data format not recognized by parseSizeEntries()");
      console.log("\n   ACTION: Check what columns are in your Excel file.");
      console.log("           Examine importController COLUMN_MAP (line 214).");
    } else if (productsOneSizeOnly > (totalProducts * 0.9)) {
      console.log("🟡 WARNING: Almost all products show 'ONE SIZE'");
      console.log("   Possible causes:");
      console.log("   1. Each Excel row is a separate SKU+size combo (parent-child)");
      console.log("   2. Size column exists but contains ONE SIZE for all rows");
      console.log("   3. Consolidation isn't merging multi-row SKUs properly");
      console.log("\n   ACTION: Check normalizeParentChildSkus() at line 340.");
      console.log("           Verify your Excel has parent SKU with size variants.");
    } else {
      console.log("✓ Size consolidation appears to be working correctly!");
      console.log(`  ${productsMultipleSizes} products have multiple sizes in inventory.`);
    }

    console.log("\n");

  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

main();
