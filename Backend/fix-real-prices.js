/**
 * ═══════════════════════════════════════════════════════════════
 *  EMERGENCY FIX - Import REAL Sale Prices from Excel
 * ═══════════════════════════════════════════════════════════════
 *  The Excel has SALE column with actual discounted prices (avg £18.73)
 *  but we incorrectly used RRP. This re-imports with correct mapping.
 */
const mongoose = require("mongoose");
const XLSX = require("xlsx");
const path = require("path");
require("dotenv").config();

const Product = require("./models/Product");

async function fixRealPrices() {
  console.log("═══ IMPORTING REAL SALE PRICES ═══\n");

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    // Read Excel
    const excelPath = path.join(__dirname, "..", "updatedclient.xlsx");
    console.log("Reading Excel:", excelPath);

    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    console.log(`Found ${data.length} rows\n`);

    // Process data and update prices
    let updated = 0;
    let under5 = 0;
    let notFound = 0;

    for (const row of data) {
      const code = row.Code || row.code;
      const sale = parseFloat(row.SALE || row.Sale || row["Sale Price"]);
      const rrp = parseFloat(row.RRP);

      if (!code || (!sale && !rrp)) continue;

      // Find product by SKU
      const product = await Product.findOne({ sku: code });

      if (product) {
        // Use SALE if available, otherwise RRP
        const newPrice = !isNaN(sale) && sale > 0 ? sale : rrp;

        if (!isNaN(newPrice) && newPrice > 0) {
          product.price = newPrice;
          product.rrp = rrp || newPrice;
          await product.save();

          updated++;
          if (newPrice <= 5) under5++;

          if (updated % 500 === 0) {
            console.log(`  ✓ Updated ${updated} prices...`);
          }
        }
      } else {
        notFound++;
      }
    }

    console.log(`\n✅ PRICE UPDATE COMPLETE!`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Under £5: ${under5}`);
    console.log(`   Not found in DB: ${notFound}`);

    // Verify
    const stats = {
      total: await Product.countDocuments(),
      under5Count: await Product.countDocuments({ price: { $gt: 0, $lte: 5 } }),
      avgPrice: await Product.aggregate([
        { $match: { price: { $gt: 0 } } },
        { $group: { _id: null, avg: { $avg: "$price" } } },
      ]),
    };

    console.log(`\n📊 New Database Stats:`);
    console.log(`   Total products: ${stats.total}`);
    console.log(`   Under £5: ${stats.under5Count}`);
    console.log(`   Average price: £${stats.avgPrice[0]?.avg.toFixed(2)}`);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("\n🔌 Connection closed");
  }
}

fixRealPrices();
