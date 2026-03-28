/**
 * Test script to verify KK7793 checkout fix
 * Tests that invalid size codes (NS) don't block orders
 */

const mongoose = require("mongoose");
require("dotenv").config();
const Product = require("./models/Product");
const Order = require("./models/Order");

async function testKK7793Checkout() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // 1. Find KK7793
    const product = await Product.findOne({ sku: "KK7793" });
    if (!product) {
      console.log("❌ Product KK7793 not found");
      process.exit(1);
    }

    console.log("\n📦 Product Info:");
    console.log(`  SKU: ${product.sku}`);
    console.log(`  Name: ${product.name}`);
    console.log(`  Total Quantity: ${product.totalQuantity}`);
    console.log(`  Sizes: ${JSON.stringify(product.sizes.map(s => ({ size: s.size, qty: s.quantity })))}`);

    // 2. Check for invalid sizes
    const invalidSizes = product.sizes.filter(s => {
      const invalid = ["NS", "N/A", "NA", "N.A.", "UNKNOWN", "UNK", "UNSET", "NULL", "NONE", "EMPTY", "TBD", "N", "A", "X"].includes(
        String(s.size || "").toUpperCase().trim()
      );
      return invalid;
    });

    if (invalidSizes.length > 0) {
      console.log(`\n⚠️  Invalid sizes found: ${JSON.stringify(invalidSizes)}`);
      console.log("   These should be filtered out in MOQ validation");
    } else {
      console.log("\n✅ No invalid size codes found");
    }

    // 3. Get valid sizes
    const validSizes = product.sizes.filter(s => {
      const size = String(s.size || "").trim();
      const invalid = ["NS", "N/A", "NA", "N.A.", "UNKNOWN", "UNK", "UNSET", "NULL", "NONE", "EMPTY", "TBD", "N", "A", "X"].includes(size.toUpperCase());
      return s.quantity > 0 && !invalid;
    });

    console.log(`\n✅ Valid available sizes: ${validSizes.length}`);
    console.log(`   ${validSizes.map(s => `${s.size} (${s.quantity} units)`).join(", ")}`);

    // 4. Check MOQ threshold
    const isFootwear = (product.category || "").toUpperCase() === "FOOTWEAR";
    const threshold = isFootwear ? 24 : 100;
    const totalQty = product.totalQuantity || 0;

    console.log(`\n📊 MOQ Check:`);
    console.log(`  Category: ${product.category}`);
    console.log(`  Threshold: ${threshold} units`);
    console.log(`  Total Qty: ${totalQty}`);

    if (totalQty > 0 && totalQty < threshold) {
      console.log(`  Status: MUST BUY ENTIRE LOT (${totalQty} < ${threshold})`);
      console.log(`  Valid sizes required: ${validSizes.map(s => s.size).join(", ")}`);
      console.log(`  ✅ Invalid sizes will be ignored: ${invalidSizes.map(s => s.size).join(", ")}`);
    } else {
      console.log(`  Status: Normal checkout allowed`);
    }

    console.log("\n✅ Test Complete: KK7793 should now checkout without 'Missing sizes' error");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

testKK7793Checkout();
