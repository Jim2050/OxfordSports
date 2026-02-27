/**
 * ════════════════════════════════════════════════════════════
 *  EMERGENCY DATABASE FIX SCRIPT
 * ════════════════════════════════════════════════════════════
 *  Fixes ALL price=0 products by copying RRP to price field
 *  Marks Google search imageUrls as null for fallback handling
 */
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const Product = require("./models/Product");

async function fixDatabase() {
  console.log("═══ EMERGENCY DATABASE FIX ═══\n");

  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    // ── FIX 1: Migrate price=0 to use RRP (BULK UPDATE) ──
    console.log("─── Fixing Prices (price=0 → rrp) ───");
    const priceFixResult = await Product.updateMany(
      {
        $or: [{ price: 0 }, { price: null }],
        rrp: { $gt: 0 },
      },
      [{ $set: { price: "$rrp" } }],
    );
    console.log(`✅ Fixed ${priceFixResult.modifiedCount} product prices\n`);

    // ── FIX 2: Clear Google search image URLs (BULK UPDATE) ──
    console.log("─── Fixing Image URLs (Clear Google search URLs) ───");
    const imageFixResult = await Product.updateMany(
      {
        imageUrl: { $regex: /google\.com\/search|tbm=isch/i },
      },
      {
        $set: { imageUrl: null },
      },
    );
    console.log(
      `✅ Cleared ${imageFixResult.modifiedCount} Google search URLs\n`,
    );

    // ── VERIFICATION ──
    console.log("─── Verification ───");
    const stillZero = await Product.countDocuments({ price: 0 });
    const withPrice = await Product.countDocuments({ price: { $gt: 0 } });
    const withImages = await Product.countDocuments({
      imageUrl: { $exists: true, $ne: null, $regex: /^https?:\/\//i },
    });
    const withoutImages = await Product.countDocuments({
      $or: [{ imageUrl: null }, { imageUrl: "" }],
    });

    console.log(`Price = 0: ${stillZero}`);
    console.log(`Price > 0: ${withPrice}`);
    console.log(`With valid imageUrl: ${withImages}`);
    console.log(`Without imageUrl (will show placeholder): ${withoutImages}`);

    console.log("\n✅ DATABASE FIX COMPLETE!");
  } catch (error) {
    console.error("❌ Fix failed:", error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log("\n🔌 Database connection closed");
  }
}

// Run the fix
fixDatabase();
