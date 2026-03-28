/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  PHASE 3: Bulk Cleanup Script - Fix Invalid Sizes in ProductionNEW
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Finds all products with invalid/placeholder size codes and converts them
 * to "ONE SIZE" while preserving quantities.
 * 
 * Usage: node fix-invalid-sizes-production.js
 * Requires: MongoDB connection via MONGO_URI environment variable
 * 
 * Process:
 * 1. Connect to MongoDB
 * 2. Find all products with size entries
 * 3. Identify invalid size codes (NS, N/A, NA, UNKNOWN, NULL, etc.)
 * 4. Convert invalid sizes to "ONE SIZE" format
 * 5. Report statistics
 * 6. Close connection
 */

const mongoose = require("mongoose");
require("dotenv").config();

// Import utility for size validation
const { isValidSizeCode } = require("./utils/sizeStockUtils");

// Import Product model
const Product = require("./models/Product");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/oxford-sports";

/**
 * Main execution function
 */
async function fixInvalidSizes() {
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║   PHASE 3: Bulk Invalid Size Cleanup                          ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  try {
    // 1. Connect to MongoDB
    console.log("🔗 Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected to MongoDB\n");

    // 2. Find all products with sizes array
    console.log("🔍 Searching for products with size entries...");
    const allProducts = await Product.find({ sizes: { $exists: true } });
    console.log(`   Found ${allProducts.length} products with sizes array\n`);

    const stats = {
      totalScanned: allProducts.length,
      productsWithInvalidSizes: 0,
      invalidSizesRemoved: 0,
      sizesConverted: 0,
      affectedProducts: [],
      errors: [],
    };

    // 3. Process each product
    console.log("⚙️  Processing products...\n");

    for (let i = 0; i < allProducts.length; i++) {
      const product = allProducts[i];
      
      if (!Array.isArray(product.sizes) || product.sizes.length === 0) {
        continue;
      }

      // Separate valid and invalid sizes
      const validSizes = product.sizes.filter(s => 
        isValidSizeCode(s.size, product.category)
      );
      const invalidSizes = product.sizes.filter(s => 
        !isValidSizeCode(s.size, product.category)
      );

      if (invalidSizes.length === 0) {
        // Product has no invalid sizes, skip
        continue;
      }

      stats.productsWithInvalidSizes++;
      stats.invalidSizesRemoved += invalidSizes.length;

      // Calculate total quantity from invalid sizes
      const totalInvalidQty = invalidSizes.reduce((sum, s) => sum + (s.quantity || 0), 0);

      console.log(`  [${i + 1}/${allProducts.length}] ${product.sku}: ${product.name}`);
      console.log(`       Invalid sizes: ${invalidSizes.map(s => `${s.size}(${s.quantity})`).join(", ")}`);
      console.log(`       Total qty in invalid sizes: ${totalInvalidQty}`);

      // Create updated sizes array
      let updatedSizes;

      if (validSizes.length > 0) {
        // Has some valid sizes - add ONE SIZE with consolidated invalid qty
        updatedSizes = [
          ...validSizes,
          {
            size: "ONE SIZE",
            quantity: totalInvalidQty,
          },
        ];
        stats.sizesConverted++;
        console.log(`       ✅ Action: Added ONE SIZE(${totalInvalidQty}) to valid sizes`);
      } else {
        // All sizes were invalid - convert all to ONE SIZE
        const totalQty = product.sizes.reduce((sum, s) => sum + (s.quantity || 0), 0);
        updatedSizes = [
          {
            size: "ONE SIZE",
            quantity: totalQty,
          },
        ];
        stats.sizesConverted++;
        console.log(`       ✅ Action: Converted ALL to ONE SIZE(${totalQty})`);
      }

      // Update product in database
      try {
        await Product.updateOne(
          { _id: product._id },
          { sizes: updatedSizes }
        );
        console.log(`       ✓ Database updated\n`);

        stats.affectedProducts.push({
          sku: product.sku,
          name: product.name,
          invalidSizesCount: invalidSizes.length,
          invalidCodes: invalidSizes.map(s => s.size),
          action: validSizes.length > 0 ? "ADDED_ONE_SIZE" : "CONVERTED_ALL_TO_ONE_SIZE",
        });
      } catch (err) {
        console.log(`       ⚠️  Error updating database: ${err.message}\n`);
        stats.errors.push({
          sku: product.sku,
          error: err.message,
        });
      }
    }

    // 4. Report statistics
    console.log("\n╔════════════════════════════════════════════════════════════════╗");
    console.log("║                    CLEANUP STATISTICS                        ║");
    console.log("╚════════════════════════════════════════════════════════════════╝\n");

    console.log(`📊 Summary:`);
    console.log(`   Total products scanned:       ${stats.totalScanned}`);
    console.log(`   Products with invalid sizes:  ${stats.productsWithInvalidSizes}`);
    console.log(`   Invalid size codes removed:   ${stats.invalidSizesRemoved}`);
    console.log(`   Products updated:            ${stats.sizesConverted}`);
    console.log(`   Errors encountered:          ${stats.errors.length}\n`);

    if (stats.affectedProducts.length > 0) {
      console.log("📝 Affected Products:");
      stats.affectedProducts.forEach((prod, idx) => {
        console.log(`   ${idx + 1}. ${prod.sku} - ${prod.name}`);
        console.log(`      Removed codes: ${prod.invalidCodes.join(", ")}`);
        console.log(`      Action: ${prod.action}`);
      });
      console.log();
    }

    if (stats.errors.length > 0) {
      console.log("⚠️  Errors:");
      stats.errors.forEach((err, idx) => {
        console.log(`   ${idx + 1}. ${err.sku}: ${err.error}`);
      });
      console.log();
    }

    console.log("✅ Cleanup completed successfully!\n");

    // 5. Close connection
    await mongoose.close();
    console.log("🔌 MongoDB connection closed\n");

  } catch (err) {
    console.error("\n❌ Fatal error during cleanup:");
    console.error(`   ${err.message}\n`);
    process.exit(1);
  }
}

// Execute
if (require.main === module) {
  fixInvalidSizes().catch(err => {
    console.error("Unhandled error:", err);
    process.exit(1);
  });
}

module.exports = fixInvalidSizes;
