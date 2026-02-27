/**
 * Phase 1 – Database Diagnostic Script
 * Verifies DB connection, product data, price=0 root cause, image status
 */
const mongoose = require("mongoose");
const path = require("path");
const XLSX = require("xlsx");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const Product = require("./models/Product");
const Category = require("./models/Category");
const ImportBatch = require("./models/ImportBatch");

async function diagnose() {
  // ── 1. Connection ──
  console.log("═══ PHASE 1: DATABASE VERIFICATION ═══\n");
  console.log(
    "MONGO_URI:",
    process.env.MONGO_URI.replace(/:[^:@]+@/, ":****@"),
  );
  await mongoose.connect(process.env.MONGO_URI);
  const dbName = mongoose.connection.db.databaseName;
  console.log("Connected to DB:", dbName);
  console.log("Host:", mongoose.connection.host);

  // ── 2. Product count ──
  const total = await Product.countDocuments();
  const active = await Product.countDocuments({ isActive: true });
  console.log("\nTotal products:", total);
  console.log("Active products:", active);

  // ── 3. Sample 5 products with all key fields ──
  console.log("\n─── 5 Sample Products ───");
  const samples = await Product.find({}).limit(5).lean();
  for (const p of samples) {
    console.log({
      sku: p.sku,
      name: p.name,
      price: p.price,
      rrp: p.rrp,
      category: p.category,
      subcategory: p.subcategory,
      color: p.color,
      sizes: p.sizes,
      imageUrl: p.imageUrl || "(empty)",
      imagePublicId: p.imagePublicId || "(empty)",
      barcode: p.barcode ? p.barcode.substring(0, 30) : "(empty)",
    });
  }

  // ── 4. Price = 0 analysis ──
  const priceZero = await Product.countDocuments({ price: 0 });
  const priceNull = await Product.countDocuments({ price: null });
  const priceGt0 = await Product.countDocuments({ price: { $gt: 0 } });
  console.log("\n─── Price Analysis ───");
  console.log("Price = 0:", priceZero);
  console.log("Price = null:", priceNull);
  console.log("Price > 0:", priceGt0);

  if (priceZero > 0) {
    console.log("\nSample price=0 products:");
    const zeroProds = await Product.find({ price: 0 }).limit(5).lean();
    for (const p of zeroProds) {
      console.log(
        `  ${p.sku} | name: ${p.name} | rrp: ${p.rrp} | sheet: ${p.sheetName}`,
      );
    }
  }

  // ── 5. Image analysis ──
  const withImage = await Product.countDocuments({
    imageUrl: { $ne: "", $exists: true },
  });
  const emptyImage = await Product.countDocuments({
    $or: [{ imageUrl: "" }, { imageUrl: { $exists: false } }],
  });
  console.log("\n─── Image Analysis ───");
  console.log("Products with imageUrl:", withImage);
  console.log("Products without imageUrl:", emptyImage);

  if (withImage > 0) {
    console.log("Sample imageUrls:");
    const imgProds = await Product.find({ imageUrl: { $ne: "" } })
      .limit(3)
      .lean();
    for (const p of imgProds) {
      console.log(`  ${p.sku}: ${p.imageUrl}`);
    }
  }

  // ── 6. Category analysis ──
  const cats = await Category.find({}).lean();
  const prodCats = await Product.distinct("category", {
    category: { $ne: "" },
  });
  console.log("\n─── Category Analysis ───");
  console.log("Category collection:", cats.map((c) => c.name).join(", "));
  console.log("Distinct product categories:", prodCats.join(", "));

  // ── 7. Import batches ──
  const batches = await ImportBatch.find({})
    .sort({ createdAt: -1 })
    .limit(3)
    .lean();
  console.log("\n─── Recent Import Batches ───");
  for (const b of batches) {
    console.log(
      `  ${b.filename} | status: ${b.status} | rows: ${b.totalRows} | imported: ${b.importedRows} | updated: ${b.updatedRows} | failed: ${b.failedRows} | ${b.createdAt}`,
    );
  }

  // ── 8. Excel column analysis – diagnose price mapping ──
  console.log("\n═══ PHASE 1B: EXCEL COLUMN MAPPING DIAGNOSIS ═══\n");
  const excelPath = path.join(__dirname, "..", "New_adidas_January_2026.xlsx");
  const wb = XLSX.readFile(excelPath);

  for (const sheetName of wb.SheetNames) {
    const data = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" });
    if (data.length === 0) continue;

    const headers = Object.keys(data[0]);
    console.log(`Sheet "${sheetName}" headers:`, headers);

    // Check first 3 non-empty data rows
    let checked = 0;
    for (const row of data) {
      if (!row.Code && !row.code) continue;
      if (checked >= 3) break;
      checked++;
      console.log(`  Row ${checked}:`, {
        Code: row.Code || row.code,
        Trade: row.Trade,
        Price: row.Price,
        RRP: row.RRP,
        "Image Link": row["Image Link"],
        Image: row.Image,
      });
    }

    // Count empty Trade values in this sheet
    let emptyTrade = 0;
    let zeroTrade = 0;
    let emptyPrice = 0;
    let totalRows = 0;
    for (const row of data) {
      if (!row.Code && !row.code) continue;
      totalRows++;
      const trade = row.Trade;
      const price = row.Price;
      if (trade === "" || trade === undefined || trade === null) emptyTrade++;
      if (trade === 0 || trade === "0") zeroTrade++;
      if (price === "" || price === undefined || price === null) emptyPrice++;
    }
    console.log(
      `  Stats: totalRows=${totalRows}, emptyTrade=${emptyTrade}, zeroTrade=${zeroTrade}, emptyPrice=${emptyPrice}`,
    );
  }

  // ── 9. Trace the column detection logic for FIREBIRD sheet ──
  console.log("\n─── Column Detection Trace (FIREBIRD) ───");
  const fbData = XLSX.utils.sheet_to_json(wb.Sheets["FIREBIRD"], {
    defval: "",
  });
  if (fbData.length > 0) {
    const fbHeaders = Object.keys(fbData[0]);
    console.log("FIREBIRD headers:", fbHeaders);
    // Check if "Trade" maps to price or if "Price" steals it
    const normalizeHeader = (h) =>
      (h || "")
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9 ()£]/g, "")
        .replace(/\s+/g, " ");

    const priceAliases = [
      "trade",
      "trade price",
      "wholesale price",
      "our price",
      "price",
      "unit price",
      "cost",
      "sell price",
      "price (£)",
      "price gbp",
      "gbp",
    ];

    for (const h of fbHeaders) {
      const norm = normalizeHeader(h);
      if (priceAliases.includes(norm)) {
        console.log(
          `  Header "${h}" (normalized: "${norm}")  →  MATCHES price alias`,
        );
      }
    }

    // Show first FIREBIRD row Trade vs Price values
    const fbRow1 = fbData[0];
    console.log(
      "  FIREBIRD row 1 Trade:",
      fbRow1.Trade,
      "| Price:",
      fbRow1.Price,
    );
    console.log(
      "  If 'Trade' maps to price first, Price column is unmapped → value used is Trade column",
    );

    // Check what the LAST firebird product's Trade value is
    const lastFbRow = fbData[fbData.length - 1];
    console.log(
      "  FIREBIRD last row Trade:",
      lastFbRow.Trade,
      "| Price:",
      lastFbRow.Price,
    );
    if (lastFbRow.Trade === "" || lastFbRow.Trade === undefined) {
      console.log(
        "  ⚠️  FIREBIRD last row has EMPTY Trade → parseFloat('') = NaN → falls to 0!",
      );
    }
  }

  await mongoose.disconnect();
  console.log("\n═══ DIAGNOSIS COMPLETE ═══");
}

diagnose().catch((err) => {
  console.error("Diagnosis failed:", err);
  process.exit(1);
});
