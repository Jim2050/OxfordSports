/**
 * ULTRA-FAST BULK PRICE FIX - Uses bulkWrite for speed
 */
const mongoose = require("mongoose");
const XLSX = require("xlsx");
const path = require("path");
require("dotenv").config();
const Product = require("./models/Product");

async function ultraFastPriceFix() {
  console.log("═══ ULTRA-FAST PRICE FIX ═══\n");

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected\n");

    // Read Excel
    const workbook = XLSX.readFile(
      path.join(__dirname, "..", "updatedclient.xlsx"),
    );
    const data = XLSX.utils.sheet_to_json(
      workbook.Sheets[workbook.SheetNames[0]],
    );

    console.log(`Processing ${data.length} rows...\n`);

    // Build bulk operations
    const bulkOps = [];
    for (const row of data) {
      const sku = row.Code || row.code;
      const sale = parseFloat(row.SALE || row.Sale);
      const rrp = parseFloat(row.RRP);

      if (!sku) continue;

      const price = !isNaN(sale) && sale > 0 ? sale : rrp;
      if (isNaN(price) || price <= 0) continue;

      bulkOps.push({
        updateOne: {
          filter: { sku },
          update: {
            $set: {
              price,
              rrp: !isNaN(rrp) && rrp > 0 ? rrp : price,
            },
          },
        },
      });
    }

    console.log(`Bulk updating ${bulkOps.length} products...\n`);

    if (bulkOps.length > 0) {
      const result = await Product.bulkWrite(bulkOps, { ordered: false });
      console.log(`✅ Updated ${result.modifiedCount} products\n`);
    }

    // Verify
    const stats = {
      total: await Product.countDocuments(),
      under5: await Product.countDocuments({ price: { $gt: 0, $lte: 5 } }),
      under10: await Product.countDocuments({ price: { $gt: 5, $lte: 10 } }),
      under20: await Product.countDocuments({ price: { $gt: 10, $lte: 20 } }),
      under50: await Product.countDocuments({ price: { $gt: 20, $lte: 50 } }),
      over50: await Product.countDocuments({ price: { $gt: 50 } }),
      avgPrice: await Product.aggregate([
        { $match: { price: { $gt: 0 } } },
        { $group: { _id: null, avg: { $avg: "$price" } } },
      ]),
    };

    console.log("📊 FINAL DATABASE STATUS:");
    console.log(`   Total: ${stats.total}`);
    console.log(`   Under £5: ${stats.under5}`);
    console.log(`   £5-£10: ${stats.under10}`);
    console.log(`   £10-£20: ${stats.under20}`);
    console.log(`   £20-£50: ${stats.under50}`);
    console.log(`   Over £50: ${stats.over50}`);
    console.log(`   Average: £${stats.avgPrice[0]?.avg.toFixed(2)}`);

    // Sample products
    console.log("\n📝 Sample Products:");
    const samples = await Product.find({ price: { $lte: 5 } })
      .limit(5)
      .lean();
    for (const p of samples) {
      console.log(
        `   ${p.sku}: £${p.price.toFixed(2)} (RRP: £${p.rrp?.toFixed(2)})`,
      );
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("\n✅ COMPLETE!");
  }
}

ultraFastPriceFix();
