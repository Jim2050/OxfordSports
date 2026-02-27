/**
 * Post-real-import verification
 */
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const Product = require("./models/Product");
const Category = require("./models/Category");

async function verify() {
  await mongoose.connect(process.env.MONGO_URI);

  const total = await Product.countDocuments();
  const mens = await Product.countDocuments({
    category: { $regex: "^mens$", $options: "i" },
  });
  const womens = await Product.countDocuments({
    category: { $regex: "^womens$", $options: "i" },
  });
  const junior = await Product.countDocuments({
    category: { $regex: "^junior$", $options: "i" },
  });
  const under5 = await Product.countDocuments({ price: { $lte: 5 } });
  const withImg = await Product.countDocuments({ imageUrl: { $ne: "" } });
  const colors = await Product.distinct("color", { color: { $ne: "" } });
  const categories = await Category.find({}).lean();

  // Products with multi-size arrays
  const multiSize = await Product.countDocuments({
    "sizes.1": { $exists: true },
  });

  // Price stats
  const priceStats = await Product.aggregate([
    {
      $group: {
        _id: null,
        avg: { $avg: "$price" },
        min: { $min: "$price" },
        max: { $max: "$price" },
      },
    },
  ]);

  // Sample FIREBIRD products
  const firebirds = await Product.find({ sheetName: "FIREBIRD" })
    .limit(3)
    .lean();

  console.log("=== POST-IMPORT VERIFICATION (Real Client File) ===");
  console.log("Total products:", total);
  console.log("Mens:", mens);
  console.log("Womens:", womens);
  console.log("Junior:", junior);
  console.log("Total categorized:", mens + womens + junior);
  console.log("Under £5:", under5);
  console.log("With images:", withImg);
  console.log("Unique colors:", colors.length);
  console.log("Products with multiple sizes:", multiSize);
  console.log("\nPrice stats:", JSON.stringify(priceStats[0]));
  console.log("\nCategories in DB:");
  categories.forEach((c) =>
    console.log("  " + c.name + " (slug: " + c.slug + ")"),
  );

  console.log("\nSample FIREBIRD products:");
  firebirds.forEach((p) => {
    console.log(
      "  " +
        p.sku +
        " | " +
        p.name +
        " | sizes:" +
        JSON.stringify(p.sizes) +
        " | £" +
        p.price,
    );
  });

  // Sample size-consolidated product
  const multiSizeProduct = await Product.findOne({
    "sizes.3": { $exists: true },
  }).lean();
  if (multiSizeProduct) {
    console.log("\nSample multi-size product:");
    console.log("  " + multiSizeProduct.sku + " | " + multiSizeProduct.name);
    console.log("  Sizes:", JSON.stringify(multiSizeProduct.sizes));
    console.log("  Barcodes:", multiSizeProduct.barcode);
  }

  await mongoose.disconnect();
}
verify().catch(console.error);
