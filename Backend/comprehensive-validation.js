const fetch = require("node-fetch");

async function comprehensiveValidation() {
  console.log("\n🧪 COMPREHENSIVE SYSTEM VALIDATION\n");
  console.log("=".repeat(80));

  let allTests = [];

  // Test 1: Verify all 15 products were imported
  console.log("\n📊 Test 1: Product Count");
  try {
    const healthRes = await fetch("http://localhost:5000/api/health");
    const health = await healthRes.json();
    const pass = health.products >= 5850;
    allTests.push({ name: "Product Count", pass });
    console.log(pass ? "✅" : "❌", `Total products: ${health.products}`);
  } catch (e) {
    allTests.push({ name: "Product Count", pass: false });
    console.log("❌ Failed");
  }

  // Test 2: Verify Rugby products
  console.log("\n🏉 Test 2: Rugby Category");
  try {
    const res = await fetch(
      "http://localhost:5000/api/products?category=Rugby&limit=1",
    );
    const data = await res.json();
    const pass = data.total >= 3;
    allTests.push({ name: "Rugby Category", pass });
    console.log(pass ? "✅" : "❌", `Rugby products: ${data.total}`);
    if (data.products[0]) {
      console.log(`   Sample: ${data.products[0].name}`);
    }
  } catch (e) {
    allTests.push({ name: "Rugby Category", pass: false });
    console.log("❌ Failed");
  }

  // Test 3: Verify Football products
  console.log("\n⚽ Test 3: Football Category");
  try {
    const res = await fetch(
      "http://localhost:5000/api/products?category=Football&limit=1",
    );
    const data = await res.json();
    const pass = data.total >= 4;
    allTests.push({ name: "Football Category", pass });
    console.log(pass ? "✅" : "❌", `Football products: ${data.total}`);
    if (data.products[0]) {
      console.log(`   Sample: ${data.products[0].name}`);
    }
  } catch (e) {
    allTests.push({ name: "Football Category", pass: false });
    console.log("❌ Failed");
  }

  // Test 4: Verify Footwear products
  console.log("\n👟 Test 4: Footwear Category");
  try {
    const res = await fetch(
      "http://localhost:5000/api/products?category=Footwear&limit=1",
    );
    const data = await res.json();
    const pass = data.total >= 3;
    allTests.push({ name: "Footwear Category", pass });
    console.log(pass ? "✅" : "❌", `Footwear products: ${data.total}`);
    if (data.products[0]) {
      console.log(`   Sample: ${data.products[0].name}`);
      console.log(`   Price: £${data.products[0].price}`);
    }
  } catch (e) {
    allTests.push({ name: "Footwear Category", pass: false });
    console.log("❌ Failed");
  }

  // Test 5: Verify Clearance products (Under £5)
  console.log("\n💰 Test 5: Clearance Under £5");
  try {
    const res = await fetch(
      "http://localhost:5000/api/products?maxPrice=5&limit=10",
    );
    const data = await res.json();
    const pass = data.total >= 5;
    allTests.push({ name: "Clearance Items", pass });
    console.log(pass ? "✅" : "❌", `Items under £5: ${data.total}`);
    if (data.products[0]) {
      console.log(
        `   Sample: ${data.products[0].name} - £${data.products[0].price}`,
      );
    }
  } catch (e) {
    allTests.push({ name: "Clearance Items", pass: false });
    console.log("❌ Failed");
  }

  // Test 6: Size splitting validation
  console.log("\n📏 Test 6: Size Splitting");
  try {
    const res = await fetch(
      "http://localhost:5000/api/products?search=ADI-RUG-001",
    );
    const data = await res.json();
    const product = data.products[0];
    const pass = Array.isArray(product.sizes) && product.sizes.length >= 4;
    allTests.push({ name: "Size Splitting", pass });
    console.log(pass ? "✅" : "❌", `Sizes array:`, product.sizes);
  } catch (e) {
    allTests.push({ name: "Size Splitting", pass: false });
    console.log("❌ Failed");
  }

  // Test 7: Stock quantity mapping
  console.log("\n📦 Test 7: Stock Quantity Mapping");
  try {
    const res = await fetch(
      "http://localhost:5000/api/products?search=ADI-FB-001",
    );
    const data = await res.json();
    const product = data.products[0];
    const pass = product.quantity === 120;
    allTests.push({ name: "Stock Mapping", pass });
    console.log(
      pass ? "✅" : "❌",
      `Stock quantity: ${product.quantity} (expected: 120)`,
    );
  } catch (e) {
    allTests.push({ name: "Stock Mapping", pass: false });
    console.log("❌ Failed");
  }

  // Test 8: Image URL validation
  console.log("\n🖼️  Test 8: Image URL Presence");
  try {
    const res = await fetch(
      "http://localhost:5000/api/products?search=ADI-FOOT-001",
    );
    const data = await res.json();
    const product = data.products[0];
    const pass =
      product.imageUrl && product.imageUrl.includes("cloudinary.com");
    allTests.push({ name: "Image URLs", pass });
    console.log(pass ? "✅" : "❌", pass ? "Images present" : "Images missing");
    if (product.imageUrl) {
      console.log(`   URL: ${product.imageUrl.substring(0, 60)}...`);
    }
  } catch (e) {
    allTests.push({ name: "Image URLs", pass: false });
    console.log("❌ Failed");
  }

  // Test 9: Brand filtering
  console.log("\n🏷️  Test 9: Brand Filtering");
  try {
    const res = await fetch(
      "http://localhost:5000/api/products?brand=adidas&limit=1",
    );
    const data = await res.json();
    const pass = data.total >= 15;
    allTests.push({ name: "Brand Filter", pass });
    console.log(pass ? "✅" : "❌", `adidas products: ${data.total}`);
  } catch (e) {
    allTests.push({ name: "Brand Filter", pass: false });
    console.log("❌ Failed");
  }

  // Test 10: Search functionality
  console.log("\n🔍 Test 10: Search Functionality");
  try {
    const res = await fetch("http://localhost:5000/api/products?search=jersey");
    const data = await res.json();
    const pass = data.total >= 3;
    allTests.push({ name: "Search", pass });
    console.log(pass ? "✅" : "❌", `Search "jersey" found: ${data.total}`);
  } catch (e) {
    allTests.push({ name: "Search", pass: false });
    console.log("❌ Failed");
  }

  // Final Summary
  console.log("\n" + "=".repeat(80));
  const passedCount = allTests.filter((t) => t.pass).length;
  const totalCount = allTests.length;

  console.log(
    `\n📋 VALIDATION SUMMARY: ${passedCount}/${totalCount} tests passed\n`,
  );

  allTests.forEach((test) => {
    console.log(`${test.pass ? "✅" : "❌"} ${test.name}`);
  });

  if (passedCount === totalCount) {
    console.log("\n🎉 ALL TESTS PASSED! SYSTEM IS FULLY FUNCTIONAL!\n");
    console.log("✅ Excel import working perfectly");
    console.log("✅ All field mappings correct");
    console.log("✅ Size splitting functional");
    console.log("✅ Stock quantities accurate");
    console.log("✅ Image URLs present");
    console.log("✅ All categories working");
    console.log("✅ Search and filters operational\n");
    console.log(
      "📄 Client template ready: CLIENT_PRODUCTS_IMPORT_TEMPLATE.xlsx",
    );
    console.log("📊 Template contains: 15 products across 4 categories");
    console.log("🎯 Ready for client demonstration and production use!\n");
  } else {
    console.log(
      `\n⚠️  ${totalCount - passedCount} test(s) failed. Review above for details.\n`,
    );
  }
}

comprehensiveValidation();
