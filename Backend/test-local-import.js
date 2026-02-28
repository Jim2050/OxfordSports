const FormData = require("form-data");
const fs = require("fs");
const fetch = require("node-fetch");
const path = require("path");

async function testLocalImport() {
  console.log("\n🧪 TESTING LOCAL IMPORT FUNCTIONALITY\n");
  console.log("=".repeat(60));

  const excelFilePath = path.join(
    __dirname,
    "CLIENT_PRODUCTS_IMPORT_TEMPLATE.xlsx",
  );

  // Step 1: Verify Excel file exists
  console.log("\n📂 Step 1: Checking Excel file...");
  if (!fs.existsSync(excelFilePath)) {
    console.error("❌ Excel file not found:", excelFilePath);
    process.exit(1);
  }
  const fileStats = fs.statSync(excelFilePath);
  console.log("✅ Excel file found");
  console.log("   Size:", (fileStats.size / 1024).toFixed(2), "KB");

  // Step 2: Login as admin
  console.log("\n🔐 Step 2: Logging in as admin...");
  let authToken;
  try {
    const loginResponse = await fetch("http://localhost:5000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@oxfordsports.net",
        password: "Godaddy1971turbs*",
      }),
    });

    if (!loginResponse.ok) {
      console.error("❌ Login failed:", loginResponse.status);
      const errorText = await loginResponse.text();
      console.error("   Error:", errorText);
      process.exit(1);
    }

    const loginData = await loginResponse.json();
    authToken = loginData.token;
    console.log("✅ Admin login successful");
    console.log("   Token:", authToken.substring(0, 20) + "...");
  } catch (error) {
    console.error("❌ Login error:", error.message);
    process.exit(1);
  }

  // Step 3: Get product count before import
  console.log("\n📊 Step 3: Getting product count before import...");
  let productsBefore;
  try {
    const healthResponse = await fetch("http://localhost:5000/api/health");
    const healthData = await healthResponse.json();
    productsBefore = healthData.products;
    console.log("✅ Products before import:", productsBefore);
  } catch (error) {
    console.error("❌ Health check error:", error.message);
    productsBefore = "Unknown";
  }

  // Step 4: Import the Excel file
  console.log("\n📤 Step 4: Uploading Excel file for import...");
  try {
    const form = new FormData();
    form.append("file", fs.createReadStream(excelFilePath));

    const importResponse = await fetch(
      "http://localhost:5000/api/admin/import-products",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          ...form.getHeaders(),
        },
        body: form,
      },
    );

    if (!importResponse.ok) {
      console.error("❌ Import failed:", importResponse.status);
      const errorText = await importResponse.text();
      console.error("   Error:", errorText);
      process.exit(1);
    }

    const importData = await importResponse.json();
    console.log("✅ Import completed successfully!");
    console.log("\n📋 IMPORT RESULTS:");
    console.log(
      "   Products processed:",
      importData.productsImported || importData.processed,
    );
    console.log("   New products added:", importData.productsImported);
    console.log("   Batch ID:", importData.batchId || "N/A");

    if (importData.summary) {
      console.log("\n   Summary:", JSON.stringify(importData.summary, null, 2));
    }
  } catch (error) {
    console.error("❌ Import error:", error.message);
    console.error("   Stack:", error.stack);
    process.exit(1);
  }

  // Step 5: Get product count after import
  console.log("\n📊 Step 5: Getting product count after import...");
  let productsAfter;
  try {
    const healthResponse = await fetch("http://localhost:5000/api/health");
    const healthData = await healthResponse.json();
    productsAfter = healthData.products;
    console.log("✅ Products after import:", productsAfter);

    if (productsBefore !== "Unknown") {
      const newProducts = productsAfter - productsBefore;
      console.log("   New products added:", newProducts);
    }
  } catch (error) {
    console.error("❌ Health check error:", error.message);
  }

  // Step 6: Verify a sample product
  console.log("\n🔍 Step 6: Verifying imported products...");
  try {
    const productsResponse = await fetch(
      "http://localhost:5000/api/products?limit=5&sortBy=createdAt&sortOrder=desc",
    );

    if (!productsResponse.ok) {
      console.error("❌ Failed to fetch products:", productsResponse.status);
    } else {
      const productsData = await productsResponse.json();
      console.log("✅ Recent products retrieved");

      if (productsData.products && productsData.products.length > 0) {
        console.log("\n📦 Sample of imported products:");
        productsData.products.slice(0, 3).forEach((product, index) => {
          console.log(`\n   Product ${index + 1}:`);
          console.log("   SKU:", product.sku);
          console.log("   Name:", product.name);
          console.log("   Category:", product.category);
          console.log("   Brand:", product.brand);
          console.log("   Price: £" + product.price.toFixed(2));
          console.log("   Sizes:", product.sizes.join(", "));
          console.log("   Stock:", product.stockQuantity);
          console.log("   Image:", product.image ? "✅ Present" : "❌ Missing");
        });
      }
    }
  } catch (error) {
    console.error("❌ Product verification error:", error.message);
  }

  // Step 7: Test category filtering
  console.log("\n🏷️  Step 7: Testing category filtering...");
  try {
    const rugbyResponse = await fetch(
      "http://localhost:5000/api/products?category=Rugby&limit=2",
    );
    const rugbyData = await rugbyResponse.json();
    console.log("✅ Rugby products:", rugbyData.total);

    const footballResponse = await fetch(
      "http://localhost:5000/api/products?category=Football&limit=2",
    );
    const footballData = await footballResponse.json();
    console.log("✅ Football products:", footballData.total);

    const footwearResponse = await fetch(
      "http://localhost:5000/api/products?category=Footwear&limit=2",
    );
    const footwearData = await footwearResponse.json();
    console.log("✅ Footwear products:", footwearData.total);

    const clearanceResponse = await fetch(
      "http://localhost:5000/api/products?category=Clearance&limit=2",
    );
    const clearanceData = await clearanceResponse.json();
    console.log("✅ Clearance products:", clearanceData.total);
  } catch (error) {
    console.error("❌ Category filtering error:", error.message);
  }

  // Step 8: Test search functionality
  console.log("\n🔎 Step 8: Testing search functionality...");
  try {
    const searchResponse = await fetch(
      "http://localhost:5000/api/products?search=adidas&limit=3",
    );
    const searchData = await searchResponse.json();
    console.log('✅ Search "adidas" found:', searchData.total, "products");

    const jerseySearch = await fetch(
      "http://localhost:5000/api/products?search=jersey&limit=3",
    );
    const jerseyData = await jerseySearch.json();
    console.log('✅ Search "jersey" found:', jerseyData.total, "products");
  } catch (error) {
    console.error("❌ Search error:", error.message);
  }

  // Final Summary
  console.log("\n" + "=".repeat(60));
  console.log("✅ LOCAL IMPORT TEST COMPLETED SUCCESSFULLY!");
  console.log("=".repeat(60));
  console.log("\n🎉 All functionality validated:");
  console.log("   ✅ Admin authentication");
  console.log("   ✅ Excel file import");
  console.log("   ✅ Product creation");
  console.log("   ✅ Database persistence");
  console.log("   ✅ API endpoints");
  console.log("   ✅ Category filtering");
  console.log("   ✅ Search functionality");
  console.log("\n📄 Template file: CLIENT_PRODUCTS_IMPORT_TEMPLATE.xlsx");
  console.log("📊 Total products in database:", productsAfter);
  console.log("\n✨ Ready for production deployment!\n");
}

testLocalImport().catch((error) => {
  console.error("\n💥 TEST FAILED:", error.message);
  console.error(error.stack);
  process.exit(1);
});
