const path = require("path");
const https = require("https");
const XLSX = require("xlsx");

const API_BASE = process.env.API_BASE || "https://oxford-sports.up.railway.app/api";
const SOURCE_FILE = process.env.SOURCE_FILE || path.join(__dirname, "..", "oxford-sports-products-2026-03-12_titles_trainers_capitalised.csv");

function requestJson(method, urlString) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlString);
    const req = https.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        path: u.pathname + u.search,
        method,
        port: u.port || 443,
        timeout: 120000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = data ? JSON.parse(data) : {};
            if (res.statusCode >= 200 && res.statusCode < 300) return resolve(parsed);
            reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed).slice(0, 500)}`));
          } catch {
            reject(new Error(`HTTP ${res.statusCode}: ${String(data).slice(0, 500)}`));
          }
        });
      },
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("Request timeout")));
    req.end();
  });
}

function getSizes(product) {
  const splitPackedSizes = (rawSize, fallbackQty = 0) => {
    const text = String(rawSize || "").trim();
    if (!text) return [];
    const parts = text.split(";").map((s) => s.trim()).filter(Boolean);
    if (parts.length <= 1) return [{ size: text, quantity: Number(fallbackQty) || 0 }];
    return parts.map((part) => {
      const match = part.match(/^(.*)\((\d+)\)$/);
      if (!match) return { size: part, quantity: Number(fallbackQty) || 0 };
      return { size: match[1].trim(), quantity: Number(match[2]) || 0 };
    });
  };

  if (!product || !Array.isArray(product.sizes) || product.sizes.length === 0) return [];

  const sizes = product.sizes;
  if (typeof sizes[0] === "object" && sizes[0].size !== undefined) {
    const expanded = sizes.flatMap((entry) => splitPackedSizes(entry?.size, entry?.quantity));
    const merged = new Map();
    for (const entry of expanded) {
      const size = String(entry?.size || "").trim();
      if (!size) continue;
      const quantity = Number(entry?.quantity) || 0;
      if (quantity <= 0) continue;
      merged.set(size, (merged.get(size) || 0) + quantity);
    }
    return Array.from(merged.entries()).map(([size, quantity]) => ({ size, quantity }));
  }

  const sizeStock = product.sizeStock || {};
  return sizes
    .map((s) => ({ size: String(s), quantity: sizeStock[String(s)] || 0 }))
    .filter((entry) => entry.size.trim() !== "");
}

function normalizeSku(v) {
  return String(v || "").trim().toUpperCase();
}

function loadSourceIndex(filePath) {
  const wb = XLSX.readFile(filePath, { raw: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
  const index = new Map();
  for (const row of rows) {
    const sku = normalizeSku(row.SKU || row.Code || row.sku || row.code);
    if (!sku) continue;
    index.set(sku, {
      sku,
      title: String(row.Title || row.Style || "").trim(),
      category: String(row.Category || row.Gender || "").trim(),
      sizes: String(row.Sizes || row["UK Size"] || row.Size || "").trim(),
      qty: String(row.QTY || row.Qty || row.Quantity || "").trim(),
    });
  }
  return index;
}

async function fetchAllByCategory(categorySlug) {
  const out = [];
  let page = 1;
  let pages = 1;
  do {
    const data = await requestJson("GET", `${API_BASE}/products?category=${encodeURIComponent(categorySlug)}&page=${page}&limit=500`);
    const products = Array.isArray(data.products) ? data.products : [];
    out.push(...products);
    pages = Number(data.pages || 1);
    page += 1;
  } while (page <= pages);
  return out;
}

async function main() {
  const sourceIndex = loadSourceIndex(SOURCE_FILE);

  const categorySlugs = [
    "footwear",
    "clothing",
    "accessories",
    "licensed-team-clothing",
    "b-grade",
    "job-lots",
    "under-5",
    "brands",
    "sports",
    "football",
    "rugby-category",
  ];

  const report = [];

  for (const slug of categorySlugs) {
    const products = await fetchAllByCategory(slug);
    let hasAnySizes = 0;
    let hasDisplaySizes = 0;
    let hiddenBecauseOneSizeOnly = 0;
    let emptySizeArray = 0;

    const sourceHasSizesUiHiddenSamples = [];

    for (const p of products) {
      const sizes = getSizes(p);
      const displaySizes = sizes.filter((s) => String(s.size || "").trim().toUpperCase() !== "ONE SIZE");

      if (sizes.length > 0) hasAnySizes += 1;
      if (displaySizes.length > 0) hasDisplaySizes += 1;
      if (sizes.length > 0 && displaySizes.length === 0) {
        const nonOneSize = sizes.some((s) => String(s.size || "").trim().toUpperCase() !== "ONE SIZE");
        if (!nonOneSize) hiddenBecauseOneSizeOnly += 1;
      }
      if (sizes.length === 0) emptySizeArray += 1;

      const sku = normalizeSku(p.sku);
      const src = sourceIndex.get(sku);
      if (
        src &&
        src.sizes &&
        displaySizes.length === 0 &&
        sourceHasSizesUiHiddenSamples.length < 8
      ) {
        sourceHasSizesUiHiddenSamples.push({
          sku,
          uiSizes: sizes,
          sourceSizes: src.sizes,
          sourceQty: src.qty,
          productCategory: p.category,
        });
      }
    }

    report.push({
      category: slug,
      totalProducts: products.length,
      productsWithAnySizes: hasAnySizes,
      productsWithVisibleCardSizes: hasDisplaySizes,
      hiddenBecauseOnlyOneSize: hiddenBecauseOneSizeOnly,
      productsWithNoSizes: emptySizeArray,
      sampleSourceSizesButNoVisibleCardSizes: sourceHasSizesUiHiddenSamples,
    });
  }

  console.log("UI_CATEGORY_SIZE_AUDIT_SUMMARY=" + JSON.stringify({
    apiBase: API_BASE,
    sourceFile: SOURCE_FILE,
    categories: report,
  }));
}

main().catch((err) => {
  console.error("UI_CATEGORY_SIZE_AUDIT_ERROR=" + err.message);
  process.exit(1);
});
