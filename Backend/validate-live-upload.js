const fs = require("fs");
const path = require("path");
const https = require("https");
const XLSX = require("xlsx");

const API_BASE = process.env.API_BASE || "https://oxford-sports.up.railway.app/api";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@oxfordsports.net";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Godaddy1971turbs*";
const TEST_FILE = process.env.TEST_FILE || path.join(__dirname, "..", "demo_test_upload.xlsx");

const SKU_ALIASES = [
  "sku",
  "code",
  "product code",
  "item code",
  "article",
  "style code",
  "ref",
  "reference",
  "product",
];

function requestJson(method, urlString, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        path: url.pathname + url.search,
        method,
        port: url.port || 443,
        headers,
        timeout: 180000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            const parsed = data ? JSON.parse(data) : {};
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed).slice(0, 600)}`));
            }
          } catch {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ raw: data });
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${String(data).slice(0, 600)}`));
            }
          }
        });
      },
    );

    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("Request timeout")));

    if (body) req.write(body);
    req.end();
  });
}

function normalizeHeader(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ");
}

function pickSkuColumn(headers) {
  const normalized = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));
  for (const alias of SKU_ALIASES) {
    const found = normalized.find((h) => h.norm === alias);
    if (found) return found.raw;
  }
  for (const alias of SKU_ALIASES) {
    const found = normalized.find((h) => h.norm.includes(alias));
    if (found) return found.raw;
  }
  return null;
}

function extractUploadSkus(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Test file not found: ${filePath}`);
  }

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });

  if (!rows.length) {
    throw new Error("Test file has no rows");
  }

  const headers = Object.keys(rows[0]);
  const skuColumn = pickSkuColumn(headers);
  if (!skuColumn) {
    throw new Error(`Could not find SKU-like column in headers: ${headers.join(", ")}`);
  }

  const skus = new Set();
  for (const row of rows) {
    const sku = String(row[skuColumn] || "").trim().toUpperCase();
    if (sku) skus.add(sku);
  }

  return {
    sheetName,
    rowCount: rows.length,
    skuColumn,
    skus: Array.from(skus),
  };
}

function buildMultipart(filePath) {
  const boundary = "----FormBoundary" + Date.now();
  const fileData = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);

  const parts = [];
  parts.push(
    Buffer.from(
      "--" +
        boundary +
        "\r\n" +
        `Content-Disposition: form-data; name=\"file\"; filename=\"${fileName}\"\r\n` +
        "Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n",
    ),
  );
  parts.push(fileData);
  parts.push(Buffer.from("\r\n--" + boundary + "--\r\n"));

  const body = Buffer.concat(parts);
  return { boundary, body };
}

function findBySku(products, sku) {
  return products.filter((p) => String(p.sku || "").trim().toUpperCase() === sku);
}

function hasMalformedSizeLabel(product) {
  const sizes = Array.isArray(product.sizes) ? product.sizes : [];
  for (const s of sizes) {
    const label = String(s && s.size ? s.size : "").trim();
    const qty = Number(s && s.quantity != null ? s.quantity : 0);
    if (/^-?\d{4,}$/.test(label)) return true;
    if (!Number.isFinite(qty) || qty < 0) return true;
  }
  return false;
}

async function main() {
  console.log("LIVE UPLOAD VALIDATION START");
  console.log(`API: ${API_BASE}`);
  console.log(`File: ${TEST_FILE}`);

  const parsed = extractUploadSkus(TEST_FILE);
  console.log(`Sheet: ${parsed.sheetName}`);
  console.log(`Rows in file: ${parsed.rowCount}`);
  console.log(`SKU column: ${parsed.skuColumn}`);
  console.log(`Unique SKUs in file: ${parsed.skus.length}`);

  const loginBody = JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  const login = await requestJson("POST", `${API_BASE}/admin/login`, loginBody, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(loginBody),
  });
  const token = login.token;
  if (!token) throw new Error("Admin login failed: missing token");

  const beforeExport = await requestJson("GET", `${API_BASE}/admin/export`, null, {
    Authorization: `Bearer ${token}`,
  });
  const beforeProducts = Array.isArray(beforeExport.products) ? beforeExport.products : [];

  const { boundary, body } = buildMultipart(TEST_FILE);
  const importRes = await requestJson("POST", `${API_BASE}/admin/import-products`, body, {
    Authorization: `Bearer ${token}`,
    "Content-Type": `multipart/form-data; boundary=${boundary}`,
    "Content-Length": body.length,
  });

  const afterExport = await requestJson("GET", `${API_BASE}/admin/export`, null, {
    Authorization: `Bearer ${token}`,
  });
  const afterProducts = Array.isArray(afterExport.products) ? afterExport.products : [];

  let missingAfter = 0;
  let duplicateAfter = 0;
  let malformedAfter = 0;
  let genderMissingAfter = 0;

  for (const sku of parsed.skus) {
    const matches = findBySku(afterProducts, sku);
    if (matches.length === 0) {
      missingAfter++;
      continue;
    }
    if (matches.length > 1) duplicateAfter += matches.length - 1;

    for (const product of matches) {
      if (hasMalformedSizeLabel(product)) malformedAfter++;
      if (!String(product.genderCanonical || "").trim()) genderMissingAfter++;
    }
  }

  let newSkusCreated = 0;
  let existingSkusUpdatedOrRetained = 0;
  for (const sku of parsed.skus) {
    const beforeCount = findBySku(beforeProducts, sku).length;
    const afterCount = findBySku(afterProducts, sku).length;
    if (beforeCount === 0 && afterCount > 0) newSkusCreated++;
    if (beforeCount > 0 && afterCount > 0) existingSkusUpdatedOrRetained++;
  }

  const summary = {
    file: path.basename(TEST_FILE),
    rowsInFile: parsed.rowCount,
    uniqueSkusInFile: parsed.skus.length,
    importResponse: importRes,
    beforeTotalProducts: beforeProducts.length,
    afterTotalProducts: afterProducts.length,
    newSkusCreated,
    existingSkusUpdatedOrRetained,
    validation: {
      missingAfter,
      duplicateExtraRecordsAfter: duplicateAfter,
      malformedRecordsAfter: malformedAfter,
      missingGenderCanonicalRecordsAfter: genderMissingAfter,
    },
    pass:
      missingAfter === 0 &&
      duplicateAfter === 0 &&
      malformedAfter === 0,
  };

  console.log("VALIDATION_SUMMARY=" + JSON.stringify(summary));
}

main().catch((err) => {
  console.error("VALIDATION_ERROR=" + err.message);
  process.exit(1);
});
