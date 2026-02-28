const mongoose = require("mongoose");
require("dotenv").config();

async function deleteTestProducts() {
  console.log("\n🧹 CLEANING UP TEST PRODUCTS\n");

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const Product = mongoose.model(
      "Product",
      new mongoose.Schema({}, { strict: false }),
    );

    // Delete products with SKUs starting with ADI- (our test products)
    const result = await Product.deleteMany({
      sku: { $regex: /^ADI-/i },
    });

    console.log(`✅ Deleted ${result.deletedCount} test products`);

    await mongoose.connection.close();
    console.log("✅ Database connection closed\n");
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

deleteTestProducts();
