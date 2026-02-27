/**
 * ═══════════════════════════════════════════════════════════
 *  PRODUCTION READINESS VERIFICATION
 * ═══════════════════════════════════════════════════════════
 */
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const Product = require("./models/Product");
const Category = require("./models/Category");

async function verify() {
  console.log("═══ PRODUCTION READINESS CHECK ═══\n");

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected\n");

    // ── 1. Price Status ──
    console.log("─── PRICE STATUS ───");
    const priceStats = {
      total: await Product.countDocuments(),
      zero: await Product.countDocuments({ price: 0 }),
      positive: await Product.countDocuments({ price: { $gt: 0 } }),
      under5: await Product.countDocuments({ price: { $gt: 0, $lte: 5 } }),
      avgPrice: await Product.aggregate([
        { $match: { price: { $gt: 0 } } },
        { $group: { _id: null, avg: { $avg: "$price" } } },
      ]),
    };

    console.log(`Total products: ${priceStats.total}`);
    console.log(
      `Price = 0: ${priceStats.zero} ${priceStats.zero > 0 ? "❌" : "✅"}`,
    );
    console.log(`Price > 0: ${priceStats.positive} ✅`);
    console.log(`Under £5: ${priceStats.under5}`);
    console.log(`Avg price: £${priceStats.avgPrice[0]?.avg.toFixed(2) || 0}`);

    // ── 2. Image Status ──
    console.log("\n─── IMAGE STATUS ───");
    const imageStats = {
      withImages: await Product.countDocuments({
        imageUrl: { $exists: true, $ne: null, $ne: "" },
      }),
      withoutImages: await Product.countDocuments({
        $or: [
          { imageUrl: null },
          { imageUrl: "" },
          { imageUrl: { $exists: false } },
        ],
      }),
      googleUrls: await Product.countDocuments({
        imageUrl: { $regex: /google\.com\/search|tbm=isch/i },
      }),
    };

    console.log(`With valid imageUrl: ${imageStats.withImages}`);
    console.log(`Without imageUrl (placeholder): ${imageStats.withoutImages}`);
    console.log(
      `Still has Google URLs: ${imageStats.googleUrls} ${imageStats.googleUrls > 0 ? "❌" : "✅"}`,
    );

    // Sample images
    const sampleWithImages = await Product.findOne({
      imageUrl: { $ne: null, $ne: "" },
    }).select("sku name imageUrl");
    if (sampleWithImages) {
      console.log(`\nSample with image:`);
      console.log(
        `  ${sampleWithImages.sku}: ${sampleWithImages.imageUrl.substring(0, 80)}...`,
      );
    }

    // ── 3. Category Status ──
    console.log("\n─── CATEGORY STATUS ───");
    const categories = await Category.countDocuments();
    const productsWithCat = await Product.countDocuments({
      category: { $ne: null, $ne: "" },
    });
    const distinctCategories = await Product.distinct("category");

    console.log(`Categories in DB: ${categories}`);
    console.log(`Products with category: ${productsWithCat}`);
    console.log(`Distinct categories: ${distinctCategories.join(", ")}`);

    // ── 4. Data Quality ──
    console.log("\n─── DATA QUALITY ───");
    const quality = {
      withSKU: await Product.countDocuments({
        sku: { $exists: true, $ne: "" },
      }),
      withName: await Product.countDocuments({
        name: { $exists: true, $ne: "" },
      }),
      withBrand: await Product.countDocuments({
        brand: { $exists: true, $ne: "" },
      }),
      withSizes: await Product.countDocuments({
        sizes: { $exists: true, $not: { $size: 0 } },
      }),
      withColor: await Product.countDocuments({
        color: { $exists: true, $ne: "" },
      }),
    };

    console.log(
      `With SKU: ${quality.withSKU}/${priceStats.total} (${((quality.withSKU / priceStats.total) * 100).toFixed(1)}%)`,
    );
    console.log(
      `With Name: ${quality.withName}/${priceStats.total} (${((quality.withName / priceStats.total) * 100).toFixed(1)}%)`,
    );
    console.log(
      `With Brand: ${quality.withBrand}/${priceStats.total} (${((quality.withBrand / priceStats.total) * 100).toFixed(1)}%)`,
    );
    console.log(
      `With Sizes: ${quality.withSizes}/${priceStats.total} (${((quality.withSizes / priceStats.total) * 100).toFixed(1)}%)`,
    );
    console.log(
      `With Color: ${quality.withColor}/${priceStats.total} (${((quality.withColor / priceStats.total) * 100).toFixed(1)}%)`,
    );

    // ── 5. Sample Products ──
    console.log("\n─── SAMPLE PRODUCTS (First 3) ───");
    const samples = await Product.find({ price: { $gt: 0 } })
      .limit(3)
      .lean();
    for (const p of samples) {
      console.log(`\n${p.sku} - ${p.name}`);
      console.log(
        `  Price: £${p.price.toFixed(2)} ${p.rrp > p.price ? `(RRP: £${p.rrp.toFixed(2)})` : ""}`,
      );
      console.log(`  Category: ${p.category || "N/A"}`);
      console.log(`  Color: ${p.color || "N/A"}`);
      console.log(
        `  Sizes: ${Array.isArray(p.sizes) ? p.sizes.join(", ") : p.sizes || "N/A"}`,
      );
      console.log(
        `  Image: ${p.imageUrl ? p.imageUrl.substring(0, 60) + "..." : "NO IMAGE (will show placeholder)"}`,
      );
    }

    // ── FINAL VERDICT ──
    console.log("\n═══ DEPLOYMENT READINESS ═══");
    const issues = [];
    if (priceStats.zero > 0)
      issues.push(`${priceStats.zero} products with price=0`);
    if (imageStats.googleUrls > 0)
      issues.push(`${imageStats.googleUrls} products with Google URLs`);
    if (quality.withSKU < priceStats.total)
      issues.push(`${priceStats.total - quality.withSKU} products missing SKU`);

    if (issues.length === 0) {
      console.log("✅ ALL CHECKS PASSED - READY FOR PRODUCTION!");
    } else {
      console.log("⚠️  Issues found:");
      issues.forEach((issue) => console.log(`   - ${issue}`));
      console.log(
        "\nNote: These issues won't prevent deployment but should be addressed.",
      );
    }

    console.log("\n📊 Summary:");
    console.log(`   • ${priceStats.positive} products with valid prices`);
    console.log(`   • ${imageStats.withImages} products with images`);
    console.log(
      `   • ${imageStats.withoutImages} products will show placeholder`,
    );
    console.log(`   • ${priceStats.under5} products under £5`);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("\n🔌 Connection closed");
  }
}

verify();
