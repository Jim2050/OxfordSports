/**
 * Diagnostic script to find all products with invalid size codes
 * This identifies other products that might have the same KK7793 issue
 */

const mongoose = require("mongoose");
require("dotenv").config();
const Product = require("./models/Product");
const { isValidSizeCode } = require("./utils/sizeStockUtils");

async function findInvalidSizes() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    console.log("✅ Connected to MongoDB\n");

    const products = await Product.find({ isActive: true }).lean();
    console.log(`Scanning ${products.length} active products...\n`);

    const productsWithInvalidSizes = [];

    for (const product of products) {
      const sizes = Array.isArray(product.sizes) ? product.sizes : [];
      const invalidSizes = sizes.filter(s => !isValidSizeCode(s.size, product.category));

      if (invalidSizes.length > 0) {
        productsWithInvalidSizes.push({
          sku: product.sku,
          name: product.name,
          category: product.category,
          totalQuantity: product.totalQuantity,
          invalidSizes: invalidSizes.map(s => ({ size: s.size, quantity: s.quantity })),
          validSizes: sizes.filter(s => isValidSizeCode(s.size, product.category)).length
        });
      }
    }

    if (productsWithInvalidSizes.length === 0) {
      console.log("✅ No products with invalid size codes found!");
    } else {
      console.log(`⚠️  Found ${productsWithInvalidSizes.length} products with invalid sizes:\n`);
      console.table(productsWithInvalidSizes.map(p => ({
        SKU: p.sku,
        Name: p.name,
        Category: p.category,
        Total: p.totalQuantity,
        Invalid: p.invalidSizes.map(s => `${s.size}(${s.quantity})`).join("; "),
        Valid: p.validSizes
      })));
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

findInvalidSizes();
