/**
 * ═══════════════════════════════════════════════════════════════
 *  FINAL SYSTEM TEST - Tests Everything Before Deployment
 * ═══════════════════════════════════════════════════════════════
 */
const mongoose = require("mongoose");
require("dotenv").config();
const Product = require("./models/Product");
const Category = require("./models/Category");

async function finalTest() {
  console.log("╔════════════════════════════════════════════════╗");
  console.log("║   OXFORD SPORTS - FINAL SYSTEM TEST            ║");
  console.log("╚════════════════════════════════════════════════╝\n");

  const results = {
    passed: [],
    warnings: [],
    failed: [],
  };

  try {
    // Test 1: Database Connection
    console.log("🧪 Test 1: Database Connection...");
    await mongoose.connect(process.env.MONGO_URI);
    results.passed.push("Database connection");
    console.log("   ✅ MongoDB connected\n");

    // Test 2: Product Count
    console.log("🧪 Test 2: Product Data...");
    const total = await Product.countDocuments();
    if (total > 0) {
      results.passed.push(`${total} products in database`);
      console.log(`   ✅ Found ${total} products\n`);
    } else {
      results.failed.push("No products in database");
      console.log("   ❌ No products found\n");
    }

    // Test 3: Price Validation
    console.log("🧪 Test 3: Price Validation...");
    const priceZero = await Product.countDocuments({
      $or: [{ price: 0 }, { price: null }],
    });
    const avgPrice = await Product.aggregate([
      { $match: { price: { $gt: 0 } } },
      { $group: { _id: null, avg: { $avg: "$price" } } },
    ]);

    if (priceZero === 0) {
      results.passed.push("All products have valid prices");
      console.log(
        `   ✅ All products have prices (avg: £${avgPrice[0]?.avg.toFixed(2)})\n`,
      );
    } else {
      results.failed.push(`${priceZero} products with price=0`);
      console.log(`   ❌ ${priceZero} products have price=0\n`);
    }

    // Test 4: Under £5 Products
    console.log("🧪 Test 4: Under £5 Filter...");
    const under5 = await Product.countDocuments({ price: { $gt: 0, $lte: 5 } });
    if (under5 > 0) {
      results.passed.push(`${under5} products under £5`);
      console.log(`   ✅ Found ${under5} products under £5\n`);

      // Show samples
      const samples = await Product.find({ price: { $lte: 5 } })
        .limit(3)
        .lean();
      console.log("   Samples:");
      samples.forEach((p) => {
        console.log(`     - ${p.name}: £${p.price.toFixed(2)}`);
      });
      console.log();
    } else {
      results.warnings.push("No products under £5");
      console.log("   ⚠️  No products under £5\n");
    }

    // Test 5: Image Status
    console.log("🧪 Test 5: Product Images...");
    const withImages = await Product.countDocuments({
      imageUrl: { $exists: true, $ne: null, $ne: "" },
    });
    const googleUrls = await Product.countDocuments({
      imageUrl: { $regex: /google\.com\/search/i },
    });

    if (googleUrls > 0) {
      results.failed.push(`${googleUrls} products still have Google URLs`);
      console.log(`   ❌ ${googleUrls} products have Google search URLs\n`);
    } else {
      results.passed.push("No Google search URLs");
      console.log(`   ✅ No Google search URLs\n`);
    }

    console.log(`   📊 ${withImages} products have images`);
    console.log(`   📊 ${total - withImages} products use placeholder\n`);

    if (withImages > 50) {
      results.passed.push(`${withImages} products have real images`);
    } else {
      results.warnings.push(`Only ${withImages} products have images`);
    }

    // Test 6: Categories
    console.log("🧪 Test 6: Categories...");
    const categories = await Category.countDocuments();
    const distinctCats = await Product.distinct("category");

    if (categories >= 3 && distinctCats.length >= 3) {
      results.passed.push(`${categories} categories configured`);
      console.log(
        `   ✅ ${categories} categories: ${distinctCats.join(", ")}\n`,
      );
    } else {
      results.warnings.push("Category setup incomplete");
      console.log(`   ⚠️  Only ${categories} categories\n`);
    }

    // Test 7: Data Quality
    console.log("🧪 Test 7: Data Quality...");
    const withSKU = await Product.countDocuments({
      sku: { $exists: true, $ne: "" },
    });
    const withName = await Product.countDocuments({
      name: { $exists: true, $ne: "" },
    });
    const withBrand = await Product.countDocuments({
      brand: { $exists: true, $ne: "" },
    });

    const quality = {
      sku: ((withSKU / total) * 100).toFixed(1),
      name: ((withName / total) * 100).toFixed(1),
      brand: ((withBrand / total) * 100).toFixed(1),
    };

    console.log(`   SKU:   ${quality.sku}% (${withSKU}/${total})`);
    console.log(`   Name:  ${quality.name}% (${withName}/${total})`);
    console.log(`   Brand: ${quality.brand}% (${withBrand}/${total})\n`);

    if (quality.sku >= 99 && quality.name >= 99) {
      results.passed.push("Data quality excellent");
    } else {
      results.warnings.push("Some data quality issues");
    }

    // Test 8: Sample Product Detail
    console.log("🧪 Test 8: Sample Product Details...");
    const sampleProduct = await Product.findOne({ price: { $gt: 0 } }).lean();
    if (sampleProduct) {
      console.log(`   Product: ${sampleProduct.name}`);
      console.log(`   SKU: ${sampleProduct.sku}`);
      console.log(`   Price: £${sampleProduct.price.toFixed(2)}`);
      if (sampleProduct.rrp > sampleProduct.price) {
        console.log(`   RRP: £${sampleProduct.rrp.toFixed(2)} (DISCOUNTED)`);
      }
      console.log(`   Category: ${sampleProduct.category || "N/A"}`);
      console.log(`   Brand: ${sampleProduct.brand || "N/A"}`);
      console.log(`   Color: ${sampleProduct.color || "N/A"}`);
      console.log(
        `   Sizes: ${Array.isArray(sampleProduct.sizes) ? sampleProduct.sizes.join(", ") : sampleProduct.sizes || "N/A"}`,
      );
      console.log(
        `   Image: ${sampleProduct.imageUrl ? "✅ Yes" : "❌ No (will show placeholder)"}\n`,
      );
      results.passed.push("Product details complete");
    }

    // FINAL VERDICT
    console.log("═══════════════════════════════════════════════\n");

    if (results.failed.length === 0) {
      console.log("╔════════════════════════════════════════════════╗");
      console.log("║     ✅  ALL TESTS PASSED - READY TO DEPLOY!    ║");
      console.log("╚════════════════════════════════════════════════╝\n");
    } else {
      console.log("╔════════════════════════════════════════════════╗");
      console.log("║     ⚠️  SOME TESTS FAILED                      ║");
      console.log("╚════════════════════════════════════════════════╝\n");
    }

    console.log("📊 TEST SUMMARY:");
    console.log(`   ✅ Passed: ${results.passed.length}`);
    console.log(`   ⚠️  Warnings: ${results.warnings.length}`);
    console.log(`   ❌ Failed: ${results.failed.length}\n`);

    if (results.passed.length > 0) {
      console.log("✅ PASSED:");
      results.passed.forEach((p) => console.log(`   • ${p}`));
      console.log();
    }

    if (results.warnings.length > 0) {
      console.log("⚠️  WARNINGS:");
      results.warnings.forEach((w) => console.log(`   • ${w}`));
      console.log();
    }

    if (results.failed.length > 0) {
      console.log("❌ FAILED:");
      results.failed.forEach((f) => console.log(`   • ${f}`));
      console.log("\n   Run: node ultra-fast-price-fix.js\n");
    }

    console.log("═══════════════════════════════════════════════\n");

    if (results.failed.length === 0) {
      console.log("🚀 NEXT STEPS:");
      console.log("   1. Test locally: npm run dev (frontend & backend)");
      console.log("   2. Upload images: node upload-folder-images.js");
      console.log("   3. Deploy to production\n");
    }
  } catch (error) {
    console.error("❌ TEST ERROR:", error.message);
    results.failed.push(`System error: ${error.message}`);
  } finally {
    await mongoose.connection.close();
    process.exit(results.failed.length > 0 ? 1 : 0);
  }
}

finalTest();
