/**
 * Verify import results in MongoDB
 */
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const Product = require("./models/Product");
const Category = require("./models/Category");
const ImportBatch = require("./models/ImportBatch");

async function verify() {
  await mongoose.connect(process.env.MONGO_URI);

  const total = await Product.countDocuments();
  console.log("Total products:", total);

  // TEST001: 5 size variants → 1 product
  const test001 = await Product.findOne({ sku: "TEST001" }).lean();
  console.log("\n=== TEST001 (5 size variants consolidated) ===");
  console.log("Name:", test001.name);
  console.log("Category:", test001.category);
  console.log("Color:", test001.color);
  console.log("Sizes:", JSON.stringify(test001.sizes));
  console.log("Price (trade):", test001.price);
  console.log("RRP:", test001.rrp);
  console.log("Quantity:", test001.quantity);
  console.log(
    "ImageUrl:",
    test001.imageUrl || "(empty - Google Images filtered)",
  );

  // TEST002: real image URL kept
  const test002 = await Product.findOne({ sku: "TEST002" }).lean();
  console.log("\n=== TEST002 (real image URL preserved) ===");
  console.log("Name:", test002.name);
  console.log("Category:", test002.category);
  console.log("Sizes:", JSON.stringify(test002.sizes));
  console.log("ImageUrl:", test002.imageUrl);

  // TEST003: duplicate SKU merged
  const test003 = await Product.findOne({ sku: "TEST003" }).lean();
  console.log("\n=== TEST003 (duplicate SKU merged with sizes) ===");
  console.log("Category:", test003.category);
  console.log("Sizes:", JSON.stringify(test003.sizes));
  console.log("Barcode:", test003.barcode);

  // TEST011: from FIREBIRD sheet
  const test011 = await Product.findOne({ sku: "TEST011" }).lean();
  console.log("\n=== TEST011 (FIREBIRD sheet) ===");
  console.log("Name:", test011.name);
  console.log("Sizes:", JSON.stringify(test011.sizes));
  console.log("SheetName:", test011.sheetName);

  // Under £5 products
  const under5 = await Product.countDocuments({ price: { $lte: 5 } });
  console.log("\n=== Aggregates ===");
  console.log("Under £5 products:", under5);

  // With images
  const withImg = await Product.countDocuments({
    imageUrl: { $ne: "", $exists: true },
  });
  console.log("Products with images:", withImg);

  // Categories
  const cats = await Category.find({}).lean();
  console.log("\n=== Categories Auto-Created ===");
  cats.forEach((c) =>
    console.log(
      "  " + c.name + " (slug: " + c.slug + ", active: " + c.isActive + ")",
    ),
  );

  // Distinct colors
  const colors = await Product.distinct("color", { color: { $ne: "" } });
  console.log("\n=== Distinct Colors ===");
  console.log(colors.join(", "));

  // Batch record
  const batch = await ImportBatch.findOne({}).sort({ createdAt: -1 }).lean();
  console.log("\n=== Import Batch Record ===");
  console.log("Filename:", batch.filename);
  console.log("Status:", batch.status);
  console.log("Total rows:", batch.totalRows);
  console.log("Imported:", batch.importedRows);
  console.log("Updated:", batch.updatedRows);
  console.log("Failed:", batch.failedRows);
  console.log("Errors:", batch.errorLog.length);

  // Test filtering endpoints
  const mensProducts = await Product.countDocuments({
    category: { $regex: "^mens$", $options: "i" },
    isActive: true,
  });
  const womensProducts = await Product.countDocuments({
    category: { $regex: "^womens$", $options: "i" },
    isActive: true,
  });
  const juniorProducts = await Product.countDocuments({
    category: { $regex: "^junior$", $options: "i" },
    isActive: true,
  });
  console.log("\n=== Category Filter Counts ===");
  console.log("Mens:", mensProducts);
  console.log("Womens:", womensProducts);
  console.log("Junior:", juniorProducts);

  // List all products summary
  console.log("\n=== All Products Summary ===");
  const all = await Product.find({}).sort({ sku: 1 }).lean();
  all.forEach((p) => {
    console.log(
      `  ${p.sku} | ${p.name} | ${p.category} | ${p.color} | sizes:${JSON.stringify(p.sizes)} | £${p.price} | RRP:£${p.rrp} | sheet:${p.sheetName}`,
    );
  });

  await mongoose.disconnect();
}

verify().catch(console.error);
