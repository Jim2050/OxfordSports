/**
 * FAST Database Fix - Uses bulkWrite for maximum performance
 */
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const Product = require("./models/Product");

async function fixDatabase() {
  console.log("═══ FAST DATABASE FIX ═══\n");

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    // ── FIX 1: Copy RRP to price where price=0 ──
    console.log("─── Fixing Prices ───");
    const productsToFix = await Product.find({
      $or: [{ price: 0 }, { price: null }],
      rrp: { $gt: 0 },
    })
      .select("_id rrp")
      .lean();

    console.log(`Found ${productsToFix.length} products with price=0`);

    if (productsToFix.length > 0) {
      const bulkOps = productsToFix.map((p) => ({
        updateOne: {
          filter: { _id: p._id },
          update: { $set: { price: p.rrp } },
        },
      }));

      const result = await Product.bulkWrite(bulkOps);
      console.log(`✅ Fixed ${result.modifiedCount} prices\n`);
    }

    // ── FIX 2: Clear Google search URLs ──
    console.log("─── Clearing Google URLs ───");
    const imgResult = await Product.updateMany(
      { imageUrl: { $regex: /google\.com\/search|tbm=isch/i } },
      { $set: { imageUrl: null } },
    );
    console.log(`✅ Cleared ${imgResult.modifiedCount} Google URLs\n`);

    // ── VERIFICATION ──
    console.log("─── Final Stats ───");
    const stats = {
      total: await Product.countDocuments(),
      priceZero: await Product.countDocuments({ price: 0 }),
      pricePositive: await Product.countDocuments({ price: { $gt: 0 } }),
      withImages: await Product.countDocuments({
        imageUrl: { $exists: true, $ne: null, $regex: /^https?:\/\//i },
      }),
      noImages: await Product.countDocuments({
        $or: [{ imageUrl: null }, { imageUrl: "" }],
      }),
    };

    console.log(`Total products: ${stats.total}`);
    console.log(`Price = 0: ${stats.priceZero}`);
    console.log(`Price > 0: ${stats.pricePositive}`);
    console.log(`With imageUrl: ${stats.withImages}`);
    console.log(`Will show placeholder: ${stats.noImages}`);

    console.log("\n✅ FIX COMPLETE!");
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("\n🔌 Connection closed");
  }
}

fixDatabase();
