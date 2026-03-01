/**
 * Diagnose raw MongoDB product data — runs directly against the DB
 * bypassing Mongoose schema to see what's ACTUALLY stored.
 */
const mongoose = require("mongoose");

async function run() {
  await mongoose.connect(
    "mongodb+srv://bhuttokashifali957:mongodb%4012@cluster0.puflo.mongodb.net/Oxford",
  );

  const db = mongoose.connection.db;
  const col = db.collection("products");

  // Get 3 raw documents
  const raw = await col.find({}).limit(3).toArray();
  for (const doc of raw) {
    console.log("=== RAW DOC ===");
    console.log("SKU:", doc.sku);
    console.log("Fields:", Object.keys(doc).join(", "));
    console.log("price:", doc.price, "(" + typeof doc.price + ")");
    console.log("salePrice:", doc.salePrice, "(" + typeof doc.salePrice + ")");
    console.log("rrp:", doc.rrp, "(" + typeof doc.rrp + ")");
    console.log("quantity:", doc.quantity, "(" + typeof doc.quantity + ")");
    console.log(
      "totalQuantity:",
      doc.totalQuantity,
      "(" + typeof doc.totalQuantity + ")",
    );
    console.log("sizes:", JSON.stringify(doc.sizes));
    console.log("sizeStock:", JSON.stringify(doc.sizeStock));
    console.log("");
  }

  const total = await col.countDocuments();
  console.log("Total products:", total);

  // Count documents with various fields
  const withSalePrice = await col.countDocuments({ salePrice: { $gt: 0 } });
  const withPrice = await col.countDocuments({ price: { $gt: 0 } });
  const withRrp = await col.countDocuments({ rrp: { $gt: 0 } });
  const withSizesArray = await col.countDocuments({
    sizes: { $exists: true, $not: { $size: 0 } },
  });
  const withSizeStock = await col.countDocuments({
    sizeStock: { $exists: true, $ne: {} },
  });
  const withQuantity = await col.countDocuments({ quantity: { $gt: 0 } });
  const withTotalQuantity = await col.countDocuments({
    totalQuantity: { $gt: 0 },
  });

  console.log("\n=== FIELD STATS ===");
  console.log("With salePrice > 0:", withSalePrice);
  console.log("With price > 0:", withPrice);
  console.log("With rrp > 0:", withRrp);
  console.log("With sizes array non-empty:", withSizesArray);
  console.log("With sizeStock non-empty:", withSizeStock);
  console.log("With quantity > 0:", withQuantity);
  console.log("With totalQuantity > 0:", withTotalQuantity);

  // Check if any product has the old schema format
  const sample = await col.findOne({ price: { $exists: true } });
  if (sample) {
    console.log("\n=== SAMPLE OLD-FORMAT DOC ===");
    console.log(JSON.stringify(sample, null, 2));
  }

  // Check what salePrice looks like
  const salePriceSample = await col.findOne({ salePrice: { $exists: true } });
  if (salePriceSample) {
    console.log("\n=== SAMPLE WITH salePrice ===");
    console.log("sku:", salePriceSample.sku);
    console.log("salePrice:", salePriceSample.salePrice);
    console.log("price:", salePriceSample.price);
  }

  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
