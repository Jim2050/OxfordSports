/**
 * Phase 4 — Clean Test Run
 * 1. Delete all demo products (TEST*)
 * 2. Delete all existing products to start fresh
 * 3. Re-import real client Excel
 * 4. Verify: product count, price=0 count, image status, categories
 * 5. Test image upload for 5 SKUs
 */
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const http = require("http");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const Product = require("./models/Product");
const Category = require("./models/Category");
const ImportBatch = require("./models/ImportBatch");

const TOKEN = process.argv[2] || "";
if (!TOKEN) {
  console.error("Usage: node clean-test.js <JWT_TOKEN>");
  process.exit(1);
}

function apiRequest(method, apiPath, body) {
  return new Promise((resolve, reject) => {
    const isMultipart = body && body.boundary;
    const options = {
      hostname: "localhost",
      port: 5000,
      path: apiPath,
      method,
      headers: {
        Authorization: "Bearer " + TOKEN,
      },
      timeout: 300000,
    };
    if (isMultipart) {
      options.headers["Content-Type"] =
        "multipart/form-data; boundary=" + body.boundary;
      options.headers["Content-Length"] = body.data.length;
    } else if (body) {
      options.headers["Content-Type"] = "application/json";
    }

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
    if (isMultipart) {
      req.write(body.data);
    } else if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function buildMultipart(filePath, filename) {
  const boundary = "----FormBoundary" + Date.now();
  const fileData = fs.readFileSync(filePath);
  const parts = [];
  parts.push(
    Buffer.from(
      "--" +
        boundary +
        "\r\n" +
        'Content-Disposition: form-data; name="file"; filename="' +
        filename +
        '"\r\n' +
        "Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n",
    ),
  );
  parts.push(fileData);
  parts.push(Buffer.from("\r\n--" + boundary + "--\r\n"));
  return { boundary, data: Buffer.concat(parts) };
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to:", mongoose.connection.db.databaseName);

  // ── Step 1: Clean slate ──
  console.log("\n═══ STEP 1: CLEAN SLATE ═══");
  const deleteResult = await Product.deleteMany({});
  console.log("Deleted products:", deleteResult.deletedCount);
  const catDelete = await Category.deleteMany({});
  console.log("Deleted categories:", catDelete.deletedCount);
  const batchDelete = await ImportBatch.deleteMany({});
  console.log("Deleted import batches:", batchDelete.deletedCount);

  const remaining = await Product.countDocuments();
  console.log("Products remaining:", remaining);

  // ── Step 2: Import real client Excel via API ──
  console.log("\n═══ STEP 2: IMPORT CLIENT EXCEL ═══");
  const excelPath = path.join(__dirname, "..", "New_adidas_January_2026.xlsx");
  console.log("File:", excelPath);
  console.log("Size:", (fs.statSync(excelPath).size / 1024).toFixed(1), "KB");

  const mp = buildMultipart(excelPath, "New_adidas_January_2026.xlsx");
  const importResult = await apiRequest(
    "POST",
    "/api/admin/import-products",
    mp,
  );
  console.log("HTTP Status:", importResult.status);
  console.log("Import result:", JSON.stringify(importResult.body, null, 2));

  // ── Step 3: Verify MongoDB state ──
  console.log("\n═══ STEP 3: POST-IMPORT VERIFICATION ═══");
  const total = await Product.countDocuments();
  const active = await Product.countDocuments({ isActive: true });
  console.log("Total products:", total);
  console.log("Active:", active);

  // Price analysis
  const priceZero = await Product.countDocuments({ price: 0 });
  const priceGt0 = await Product.countDocuments({ price: { $gt: 0 } });
  console.log("Price = 0:", priceZero);
  console.log("Price > 0:", priceGt0);

  if (priceZero > 0) {
    console.log("\nSample price=0 products (if any remain):");
    const zeroProds = await Product.find({ price: 0 }).limit(5).lean();
    for (const p of zeroProds) {
      console.log(
        `  ${p.sku} | ${p.name} | rrp:${p.rrp} | sheet:${p.sheetName}`,
      );
    }
  }

  // Image analysis
  const withImage = await Product.countDocuments({
    imageUrl: { $ne: "", $exists: true },
  });
  console.log("\nProducts with imageUrl:", withImage);

  // Categories
  const cats = await Category.find({}).lean();
  console.log("Categories:", cats.map((c) => c.name).join(", "));

  // Category product counts
  for (const cat of cats) {
    const count = await Product.countDocuments({
      category: { $regex: new RegExp("^" + cat.name + "$", "i") },
    });
    console.log(`  ${cat.name}: ${count} products`);
  }

  // Sample 5 products
  console.log("\n─── 5 Sample Products ───");
  const samples = await Product.find({ price: { $gt: 0 } })
    .limit(5)
    .lean();
  for (const p of samples) {
    console.log(
      `  ${p.sku} | ${p.name} | £${p.price} | rrp:£${p.rrp} | cat:${p.category} | color:${p.color} | sizes:${JSON.stringify(p.sizes)} | img:${p.imageUrl || "(none)"}`,
    );
  }

  // Check one of the previously-price-0 SKUs
  console.log("\n─── Previously price=0 SKUs check ───");
  const checkSkus = ["KL2473", "KK7799", "KK7798", "KK7793", "KK7779"];
  for (const sku of checkSkus) {
    const p = await Product.findOne({ sku }).lean();
    if (p) {
      console.log(`  ${p.sku} | price: £${p.price} | rrp: £${p.rrp}`);
    } else {
      console.log(`  ${sku}: not found`);
    }
  }

  // ── Step 4: API endpoint tests ──
  console.log("\n═══ STEP 4: API ENDPOINT TESTS ═══");

  const health = await apiRequest("GET", "/api/health");
  console.log("Health:", JSON.stringify(health.body));

  const prods = await apiRequest("GET", "/api/products?limit=3");
  console.log(
    `Products API: ${prods.body.total} total, ${prods.body.pages} pages`,
  );

  const mensProds = await apiRequest("GET", "/api/products?category=mens");
  console.log("Mens filter:", mensProds.body.total, "products");

  const womensProds = await apiRequest("GET", "/api/products?category=womens");
  console.log("Womens filter:", womensProds.body.total, "products");

  const juniorProds = await apiRequest("GET", "/api/products?category=junior");
  console.log("Junior filter:", juniorProds.body.total, "products");

  const under5 = await apiRequest("GET", "/api/products?maxPrice=5");
  console.log("Under £5:", under5.body.total, "products");

  const catsApi = await apiRequest("GET", "/api/products/categories");
  console.log(
    "Categories API:",
    catsApi.body.categories
      .map((c) => `${c.name}(${c.productCount})`)
      .join(", "),
  );

  const colorsApi = await apiRequest("GET", "/api/products/colors");
  console.log("Colors API:", colorsApi.body.colors.length, "distinct colors");

  // Stats
  const stats = await apiRequest("GET", "/api/admin/stats");
  console.log("Admin stats:", {
    total: stats.body.total,
    underFive: stats.body.underFive,
    withImages: stats.body.withImages,
    categoryCount: stats.body.categoryCount,
    colorCount: stats.body.colorCount,
  });

  await mongoose.disconnect();
  console.log("\n═══ CLEAN TEST COMPLETE ═══");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
