require("dotenv").config();

const path = require("path");
const XLSX = require("xlsx");
const connectDB = require("./config/db");
const Product = require("./models/Product");
const { parseSizeEntries } = require("./utils/taxonomyUtils");
const { normalizeSizeEntries } = require("./utils/sizeStockUtils");

const SKU_HEADERS = ["Code", "code", "SKU", "sku"];
const SIZE_HEADERS = [
  "UK Size",
  "uk size",
  "Size",
  "size",
  "Sizes",
  "sizes",
  "Available Sizes",
  "available sizes",
];
const QTY_HEADERS = ["Qty", "qty", "QTY", "Quantity", "quantity"];

function getArgValue(flag, fallback = "") {
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function readCell(row, candidates) {
  for (const key of candidates) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") {
      return row[key];
    }
  }
  return "";
}

function parseQty(rawQty) {
  const parsed = Number.parseInt(String(rawQty ?? "").trim(), 10);
  if (Number.isNaN(parsed)) return 1;
  return Math.max(0, parsed);
}

function normalizeSku(rawSku) {
  return String(rawSku || "").trim().toUpperCase();
}

function sumQty(entries) {
  return entries.reduce((sum, entry) => sum + (Number(entry?.quantity) || 0), 0);
}

function dbHasOnlyOneSize(product) {
  const sizes = Array.isArray(product?.sizes) ? product.sizes : [];
  if (sizes.length === 0) return false;

  const positive = sizes.filter((s) => (Number(s?.quantity) || 0) > 0);
  if (positive.length === 0) return false;

  const specific = positive.filter(
    (s) => String(s?.size || "").trim().toUpperCase() !== "ONE SIZE",
  );
  if (specific.length > 0) return false;

  return positive.some(
    (s) => String(s?.size || "").trim().toUpperCase() === "ONE SIZE",
  );
}

function buildExcelSizeMap(workbookPath) {
  const workbook = XLSX.readFile(workbookPath);
  const bySku = new Map();

  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      defval: "",
    });

    for (const row of rows) {
      const sku = normalizeSku(readCell(row, SKU_HEADERS));
      if (!sku) continue;

      const rawSize = String(readCell(row, SIZE_HEADERS) || "").trim();
      if (!rawSize) continue;

      const qty = parseQty(readCell(row, QTY_HEADERS));
      const parsed = parseSizeEntries(rawSize, qty);

      if (!bySku.has(sku)) {
        bySku.set(sku, {
          rawEntries: [],
          hadNegativeSizes: false,
          invalidTokens: [],
          checksumMismatches: 0,
          sourceRows: 0,
        });
      }

      const bucket = bySku.get(sku);
      bucket.sourceRows += 1;
      bucket.rawEntries.push(...parsed.entries);
      bucket.hadNegativeSizes = bucket.hadNegativeSizes || parsed.hadNegativeSizes;
      bucket.invalidTokens.push(...parsed.invalidTokens);
      if (parsed.checksumMismatch) bucket.checksumMismatches += 1;
    }
  }

  return bySku;
}

async function main() {
  const apply = hasFlag("--apply");
  const allowNegative = hasFlag("--allow-negative");
  const workbookPath = path.resolve(
    __dirname,
    getArgValue("--file", "../updatedclient.xlsx"),
  );

  console.log(`Workbook: ${workbookPath}`);
  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}`);
  console.log(`Allow negative-size normalization: ${allowNegative ? "YES" : "NO"}`);

  const excelMap = buildExcelSizeMap(workbookPath);
  console.log(`Excel SKUs with size data: ${excelMap.size}`);

  await connectDB();

  const products = await Product.find({ totalQuantity: { $gt: 0 } })
    .select("sku name category totalQuantity sizes")
    .lean();

  let scanned = 0;
  let dbOneSizeOnly = 0;
  let candidates = 0;
  let updated = 0;
  const skippedDueToQtyMismatch = [];
  const skippedDueToInvalidTokens = [];
  const skippedDueToNegative = [];
  const sampleCandidates = [];
  const updates = [];

  for (const product of products) {
    scanned += 1;
    const sku = normalizeSku(product.sku);
    if (!sku) continue;

    if (!dbHasOnlyOneSize(product)) continue;
    dbOneSizeOnly += 1;

    const excelRec = excelMap.get(sku);
    if (!excelRec) continue;

    if (excelRec.invalidTokens.length > 0) {
      skippedDueToInvalidTokens.push({
        sku,
        name: product.name,
        invalidTokens: Array.from(new Set(excelRec.invalidTokens)).slice(0, 5),
      });
      continue;
    }

    if (!allowNegative && excelRec.hadNegativeSizes) {
      skippedDueToNegative.push({ sku, name: product.name });
      continue;
    }

    const normalized = normalizeSizeEntries(excelRec.rawEntries, product.category);
    const specific = normalized.filter(
      (entry) => String(entry.size || "").trim().toUpperCase() !== "ONE SIZE",
    );

    if (specific.length === 0) continue;

    const excelQty = sumQty(specific);
    const dbQty = Number(product.totalQuantity) || 0;

    if (excelQty <= 0) continue;
    if (dbQty !== excelQty) {
      skippedDueToQtyMismatch.push({
        sku,
        name: product.name,
        dbQty,
        excelQty,
      });
      continue;
    }

    candidates += 1;
    if (sampleCandidates.length < 30) {
      sampleCandidates.push({
        sku,
        name: product.name,
        dbSizes: product.sizes,
        excelSizes: specific,
        qty: excelQty,
      });
    }

    if (apply) {
      updates.push({
        updateOne: {
          filter: { _id: product._id },
          update: {
            $set: {
              sizes: specific,
              totalQuantity: excelQty,
            },
          },
        },
      });
    }
  }

  if (apply && updates.length > 0) {
    const result = await Product.bulkWrite(updates, { ordered: false });
    updated = result.modifiedCount || 0;
  }

  console.log("\n=== Summary ===");
  console.log(`Products scanned: ${scanned}`);
  console.log(`DB products with ONE SIZE only: ${dbOneSizeOnly}`);
  console.log(`Safe repair candidates: ${candidates}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (qty mismatch): ${skippedDueToQtyMismatch.length}`);
  console.log(`Skipped (invalid tokens in source): ${skippedDueToInvalidTokens.length}`);
  console.log(`Skipped (negative size source): ${skippedDueToNegative.length}`);

  console.log("\n=== Candidate Sample (up to 30) ===");
  console.log(JSON.stringify(sampleCandidates, null, 2));

  if (skippedDueToQtyMismatch.length > 0) {
    console.log("\n=== Qty Mismatch Sample (up to 20) ===");
    console.log(JSON.stringify(skippedDueToQtyMismatch.slice(0, 20), null, 2));
  }

  if (skippedDueToNegative.length > 0) {
    console.log("\n=== Negative Size Sample (up to 20) ===");
    console.log(JSON.stringify(skippedDueToNegative.slice(0, 20), null, 2));
  }

  process.exit(0);
}

main().catch((error) => {
  console.error("Reconciliation failed:", error?.message || error);
  process.exit(1);
});
