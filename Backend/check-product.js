const fetch = require("node-fetch");

async function checkImportedProduct() {
  console.log("\n🔍 CHECKING IMPORTED PRODUCT DETAILS\n");

  try {
    // Get specific product by SKU
    const response = await fetch(
      "http://localhost:5000/api/products?search=ADI-CLR-001",
    );
    const data = await response.json();

    if (data.products && data.products.length > 0) {
      const product = data.products[0];
      console.log("📦 Product Details:");
      console.log(JSON.stringify(product, null, 2));

      console.log("\n🔍 Field Check:");
      console.log("✓ SKU:", product.sku || "❌ MISSING");
      console.log("✓ Name:", product.name || "❌ MISSING");
      console.log(
        "✓ Description:",
        product.description ? "✅ Present" : "❌ MISSING",
      );
      console.log("✓ Category:", product.category || "❌ MISSING");
      console.log("✓ Subcategory:", product.subcategory || "❌ MISSING");
      console.log("✓ Brand:", product.brand || "❌ MISSING");
      console.log("✓ Price:", product.price || "❌ MISSING");
      console.log("✓ Sizes:", product.sizes || "❌ MISSING");
      console.log(
        "✓ Stock Quantity:",
        product.stockQuantity !== undefined
          ? product.stockQuantity
          : "❌ MISSING",
      );
      console.log("✓ Image URL:", product.image || "❌ MISSING");
      console.log("✓ Image:", product.image || "❌ MISSING");
    } else {
      console.log("❌ Product not found");
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

checkImportedProduct();
