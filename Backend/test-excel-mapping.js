/**
 * ═══════════════════════════════════════════════════════════════
 *  test-excel-mapping.js — Dry-run: parse the client Excel and
 *  verify that column mapping, price, and imageUrl are correct.
 *  Does NOT touch MongoDB.
 * ═══════════════════════════════════════════════════════════════
 *
 *  Usage:  node test-excel-mapping.js
 */

const path = require("path");
const XLSX = require("xlsx");

// ── Re-use the same COLUMN_MAP and helpers from importController ──
// (Inlined here so the test is standalone — keeps importController unchanged.)

const COLUMN_MAP = {
  sku: [
    "code",
    "sku",
    "product code",
    "item code",
    "article",
    "article number",
    "style code",
    "ref",
    "reference",
  ],
  name: [
    "style",
    "style desc",
    "style description",
    "product name",
    "name",
    "title",
    "item",
    "description name",
    "product",
    "item name",
    "item description",
  ],
  description: [
    "description",
    "desc",
    "details",
    "product description",
    "long description",
    "notes",
  ],
  price: [
    "trade",
    "trade price",
    "trade (£)",
    "trade price (£)",
    "wholesale price",
    "our price",
    "price",
    "unit price",
    "cost",
    "sell price",
    "sale",
    "sale price",
    "sale (£)",
    "price (£)",
    "price gbp",
    "gbp",
  ],
  rrp: ["rrp", "retail price", "recommended retail price", "srp", "msrp"],
  category: [
    "gender",
    "category",
    "cat",
    "department",
    "type",
    "product type",
    "group",
  ],
  subcategory: [
    "subcategory",
    "sub category",
    "sub-category",
    "club",
    "team",
    "brand line",
    "collection",
  ],
  brand: [
    "brand",
    "manufacturer",
    "make",
    "label",
    "empty",
    "supplier",
    "vendor",
  ],
  color: [
    "colour desc",
    "colour description",
    "color desc",
    "color description",
    "colour",
    "color",
    "col",
  ],
  sizes: [
    "uk size",
    "size",
    "sizes",
    "size range",
    "available sizes",
    "sizes available",
  ],
  barcode: ["barcode", "ean", "upc", "ean13", "gtin", "bar code"],
  quantity: [
    "qty",
    "quantity",
    "stock",
    "stock qty",
    "available",
    "units",
    "pcs",
  ],
  imageUrl: [
    "image link",
    "image url",
    "image",
    "img",
    "photo",
    "picture",
    "image file",
    "filename",
    "empty1",
  ],
};

function normalizeHeader(h) {
  return (h || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 ()£]/g, "")
    .replace(/\s+/g, " ");
}

function detectMapping(headers) {
  const mapping = {};
  const unmapped = [];
  const sorted = [...headers].sort((a, b) => {
    return (
      (a.startsWith("__EMPTY") ? 1 : 0) - (b.startsWith("__EMPTY") ? 1 : 0)
    );
  });
  for (const raw of sorted) {
    const norm = normalizeHeader(raw);
    let matched = false;
    for (const [field, aliases] of Object.entries(COLUMN_MAP)) {
      if (aliases.includes(norm) && !mapping[field]) {
        mapping[field] = raw;
        matched = true;
        break;
      }
    }
    if (!matched && !Object.values(mapping).includes(raw)) unmapped.push(raw);
  }
  if (!mapping.sku) {
    const h = headers.find((h) => /\bcode\b|sku|article|ref\b/i.test(h));
    if (h) mapping.sku = h;
  }
  if (!mapping.name) {
    const h = headers.find((h) => /style|name|title|product/i.test(h));
    if (h && h !== mapping.sku) mapping.name = h;
  }
  if (!mapping.price) {
    const h = headers.find((h) => /trade|price|cost|sale|£|gbp/i.test(h));
    if (h) mapping.price = h;
  }
  if (!mapping.category) {
    const h = headers.find((h) => /gender|category|department/i.test(h));
    if (h) mapping.category = h;
  }
  if (!mapping.imageUrl) {
    const h = headers.find((h) => /image|img|photo|picture/i.test(h));
    if (h) mapping.imageUrl = h;
  }

  // Keep test behavior consistent with importer: SALE takes precedence over Trade
  const saleHeader = headers.find((h) => /(^|\s)(sale|sale price)(\s|$)|\bsale\b|\bsale price\b/i.test(h));
  const tradeHeader = headers.find((h) => /(^|\s)trade(\s|$)|\btrade price\b/i.test(h));
  if (saleHeader && tradeHeader && mapping.price === tradeHeader) {
    mapping.price = saleHeader;
  }

  return { mapping, unmapped };
}

function parsePrice(raw) {
  if (raw === undefined || raw === null || raw === "")
    return { value: null, error: "empty" };
  if (typeof raw === "number") {
    if (isNaN(raw)) return { value: null, error: "NaN" };
    if (raw < 0) return { value: null, error: `negative: ${raw}` };
    return { value: raw, error: null };
  }
  const cleaned = String(raw)
    .replace(/[£$€,\s]/g, "")
    .replace(/[^0-9.\-]/g, "");
  if (!cleaned) return { value: null, error: `unparseable: "${raw}"` };
  const num = parseFloat(cleaned);
  if (isNaN(num)) return { value: null, error: `NaN after parse: "${raw}"` };
  if (num < 0) return { value: null, error: `negative: ${num}` };
  return { value: num, error: null };
}

function isValidImageUrl(url) {
  if (!url) return false;
  const s = String(url).trim();
  if (s.length < 10) return false;
  const lower = s.toLowerCase();
  if (lower === "google images" || lower === "google image") return false;
  return lower.startsWith("http://") || lower.startsWith("https://");
}

// ═══════════════════════════════════════════════════════════════
//  MAIN: parse the client Excel and report mapping results
// ═══════════════════════════════════════════════════════════════

const EXCEL_PATH = path.resolve(__dirname, "..", "updatedclient.xlsx");

console.log(`\n📂 Reading: ${EXCEL_PATH}\n`);

const wb = XLSX.readFile(EXCEL_PATH);

let totalRows = 0;
let priceOk = 0;
let priceZero = 0;
let priceFail = 0;
let imgOk = 0;
let imgEmpty = 0;
let skuMissing = 0;

for (const sheetName of wb.SheetNames) {
  const data = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" });
  if (data.length === 0) {
    console.log(`  Sheet "${sheetName}": empty`);
    continue;
  }

  const headers = Object.keys(data[0]);
  const { mapping, unmapped } = detectMapping(headers);

  console.log(`═══ Sheet: "${sheetName}" — ${data.length} rows ═══`);
  console.log(`  Headers: ${headers.join(" | ")}`);
  console.log(`  Mapping:`);
  for (const [field, col] of Object.entries(mapping)) {
    console.log(`    ${field.padEnd(14)} ← "${col}"`);
  }
  if (unmapped.length) console.log(`  Unmapped: ${unmapped.join(", ")}`);

  // Show first 3 non-empty rows
  let shown = 0;
  for (const raw of data) {
    if (shown >= 3) break;
    const sku = mapping.sku ? String(raw[mapping.sku] || "").trim() : "";
    if (!sku) continue;

    const row = {};
    for (const [field, col] of Object.entries(mapping)) row[field] = raw[col];

    const priceRes = parsePrice(row.price);
    const imgUrl = row.imageUrl ? String(row.imageUrl).trim() : "";
    const imgValid = isValidImageUrl(imgUrl);

    console.log(`\n  Row sample #${shown + 1}:`);
    console.log(`    SKU       : ${sku}`);
    console.log(`    Name      : ${row.name || "(empty)"}`);
    console.log(
      `    Price raw : ${JSON.stringify(row.price)} → parsed: ${priceRes.value} ${priceRes.error ? "⚠ " + priceRes.error : "✓"}`,
    );
    console.log(`    RRP       : ${row.rrp}`);
    console.log(`    Category  : ${row.category}`);
    console.log(`    Brand     : ${row.brand || "(empty)"}`);
    console.log(`    Color     : ${row.color}`);
    console.log(
      `    Image URL : ${imgUrl ? imgUrl.substring(0, 80) + "..." : "(empty)"} ${imgValid ? "✓" : "✗"}`,
    );
    shown++;
  }

  // Count stats across all rows
  for (const raw of data) {
    const sku = mapping.sku ? String(raw[mapping.sku] || "").trim() : "";
    if (!sku) {
      skuMissing++;
      continue;
    }
    totalRows++;
    const priceRes = parsePrice(mapping.price ? raw[mapping.price] : undefined);
    if (priceRes.value !== null && priceRes.value > 0) priceOk++;
    else if (priceRes.value === 0) priceZero++;
    else priceFail++;

    const imgUrl = mapping.imageUrl
      ? String(raw[mapping.imageUrl] || "").trim()
      : "";
    if (isValidImageUrl(imgUrl)) imgOk++;
    else imgEmpty++;
  }
  console.log("");
}

console.log(`\n════════════════════════════════════════`);
console.log(`  SUMMARY`);
console.log(`════════════════════════════════════════`);
console.log(`  Total rows with SKU : ${totalRows}`);
console.log(`  Rows missing SKU    : ${skuMissing}`);
console.log(`  Price > 0           : ${priceOk} ✓`);
console.log(`  Price = 0           : ${priceZero}`);
console.log(`  Price invalid/empty : ${priceFail} ✗`);
console.log(`  Image URL valid     : ${imgOk} ✓`);
console.log(`  Image URL missing   : ${imgEmpty} ✗`);
console.log(`════════════════════════════════════════\n`);

if (priceOk > 0 && priceFail === 0) {
  console.log("✅ Price mapping: FIXED — all products have valid prices");
} else if (priceOk > 0) {
  console.log(
    `⚠️  Price mapping: PARTIAL — ${priceOk} ok, ${priceFail} failed`,
  );
} else {
  console.log("❌ Price mapping: BROKEN — no valid prices detected");
}

if (imgOk > 0) {
  console.log(`✅ Image URL mapping: ${imgOk} products have valid HTTP URLs`);
} else {
  console.log("⚠️  Image URL mapping: No valid image URLs found in Excel");
}
console.log("");
