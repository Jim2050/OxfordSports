const path = require("path");
const XLSX = require("xlsx");
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

function argValue(flag, fallback = "") {
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

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function buildExcelSizeMap(workbookPath) {
  const workbook = XLSX.readFile(workbookPath);
  const bySku = new Map();

  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });

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
          sourceRows: 0,
        });
      }

      const bucket = bySku.get(sku);
      bucket.sourceRows += 1;
      bucket.rawEntries.push(...parsed.entries);
      bucket.hadNegativeSizes = bucket.hadNegativeSizes || parsed.hadNegativeSizes;
      bucket.invalidTokens.push(...parsed.invalidTokens);
    }
  }

  return bySku;
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} :: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return data;
}

async function fetchAllProducts(apiBase) {
  let page = 1;
  let pages = 1;
  const all = [];

  do {
    const data = await fetchJson(`${apiBase}/products?page=${page}&limit=500`);
    const items = Array.isArray(data) ? data : data.products || [];
    all.push(...items);
    pages = Number(data.pages) || 1;
    page += 1;
  } while (page <= pages);

  return all;
}

async function adminLogin(apiBase, email, password) {
  const data = await fetchJson(`${apiBase}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!data?.token) throw new Error("Admin login succeeded but no token returned");
  return data.token;
}

async function updateProductSizes(apiBase, token, sku, sizes, quantity) {
  return fetchJson(`${apiBase}/admin/products/${encodeURIComponent(sku)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ sizes, quantity }),
  });
}

async function main() {
  const apply = hasFlag("--apply");
  const allowNegative = hasFlag("--allow-negative");
  const workbookPath = path.resolve(__dirname, argValue("--file", "../updatedclient.xlsx"));
  const apiBase = argValue("--api", "https://jimpph-production.up.railway.app/api").replace(/\/$/, "");
  const adminEmail = argValue("--email", process.env.ADMIN_EMAIL || "");
  const adminPassword = argValue("--password", process.env.ADMIN_PASSWORD || "");

  if (!adminEmail || !adminPassword) {
    throw new Error("Missing admin credentials. Pass --email and --password.");
  }

  console.log(`Workbook: ${workbookPath}`);
  console.log(`API: ${apiBase}`);
  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}`);
  console.log(`Allow negative-size normalization: ${allowNegative ? "YES" : "NO"}`);

  const excelMap = buildExcelSizeMap(workbookPath);
  const products = await fetchAllProducts(apiBase);

  console.log(`Excel SKUs with size data: ${excelMap.size}`);
  console.log(`Products fetched from API: ${products.length}`);

  const candidates = [];
  const skippedQtyMismatch = [];
  const skippedInvalidTokens = [];
  const skippedNegative = [];

  for (const product of products) {
    if (!dbHasOnlyOneSize(product)) continue;

    const sku = normalizeSku(product.sku);
    const excelRec = excelMap.get(sku);
    if (!excelRec) continue;

    if (excelRec.invalidTokens.length > 0) {
      skippedInvalidTokens.push({ sku, name: product.name });
      continue;
    }

    if (!allowNegative && excelRec.hadNegativeSizes) {
      skippedNegative.push({ sku, name: product.name });
      continue;
    }

    const normalized = normalizeSizeEntries(excelRec.rawEntries, product.category);
    const specific = normalized.filter(
      (entry) => String(entry.size || "").trim().toUpperCase() !== "ONE SIZE",
    );
    if (specific.length === 0) continue;

    const excelQty = sumQty(specific);
    const dbQty = Number(product.totalQuantity ?? product.quantity ?? 0);

    if (excelQty <= 0 || dbQty <= 0) continue;
    if (excelQty !== dbQty) {
      skippedQtyMismatch.push({ sku, name: product.name, dbQty, excelQty });
      continue;
    }

    candidates.push({
      sku,
      name: product.name,
      quantity: excelQty,
      sizes: specific,
    });
  }

  console.log(`Safe candidates: ${candidates.length}`);
  console.log(`Skipped qty mismatch: ${skippedQtyMismatch.length}`);
  console.log(`Skipped invalid token: ${skippedInvalidTokens.length}`);
  console.log(`Skipped negative size: ${skippedNegative.length}`);

  if (!apply) {
    console.log("\nSample candidates (first 20):");
    console.log(JSON.stringify(candidates.slice(0, 20), null, 2));
    return;
  }

  const token = await adminLogin(apiBase, adminEmail, adminPassword);
  let updated = 0;
  const failures = [];

  const batches = chunk(candidates, 20);
  for (const batch of batches) {
    const results = await Promise.allSettled(
      batch.map((item) =>
        updateProductSizes(apiBase, token, item.sku, item.sizes, item.quantity),
      ),
    );

    results.forEach((result, idx) => {
      const item = batch[idx];
      if (result.status === "fulfilled") {
        updated += 1;
      } else {
        failures.push({ sku: item.sku, error: String(result.reason?.message || result.reason) });
      }
    });
  }

  console.log(`Updated products: ${updated}`);
  console.log(`Failed updates: ${failures.length}`);
  if (failures.length > 0) {
    console.log(JSON.stringify(failures.slice(0, 40), null, 2));
  }
}

main().catch((error) => {
  console.error("Reconcile via API failed:", error.message || error);
  process.exit(1);
});
