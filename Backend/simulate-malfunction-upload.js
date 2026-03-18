const fs = require("fs");
const path = require("path");
const https = require("https");
const XLSX = require("xlsx");

const API_BASE = process.env.API_BASE || "https://oxford-sports.up.railway.app/api";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@oxfordsports.net";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Godaddy1971turbs*";

const TEST_SKUS = [
  "MFMAL001",
  "MFMAL002",
  "MFMAL003",
  "MFDUP001",
  "MFMAL004",
  "MFMAL005",
];

function requestJson(method, urlString, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlString);
    const req = https.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        path: u.pathname + u.search,
        method,
        port: u.port || 443,
        headers,
        timeout: 180000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = data ? JSON.parse(data) : {};
            if (res.statusCode >= 200 && res.statusCode < 300) return resolve(parsed);
            reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed).slice(0, 800)}`));
          } catch {
            if (res.statusCode >= 200 && res.statusCode < 300) return resolve({ raw: data });
            reject(new Error(`HTTP ${res.statusCode}: ${String(data).slice(0, 800)}`));
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

function buildMultipart(filePath) {
  const boundary = "----FormBoundary" + Date.now();
  const fileName = path.basename(filePath);
  const fileData = fs.readFileSync(filePath);

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

  return { boundary, body: Buffer.concat(parts) };
}

function makeWorkbook(filePath) {
  const headers = [
    "Code",
    "Image Link",
    "Gender",
    "Style",
    "Colour Desc",
    "UK Size",
    "Barcode",
    "RRP",
    "Trade",
    "Qty",
  ];

  const rows = [
    ["MFMAL001", "", "Mens", "Malform 40273", "BLACK", "40273(3)", "1001", 20, 12, 3],
    ["MFMAL002", "", "Mens", "Malform 29_91", "BLUE", "29(1),91(1)", "1002", 22, 13, 2],
    ["MFMAL003", "", "Mens", "No size one-size valid", "RED", "", "1003", 18, 10, 5],
    ["MFDUP001", "", "Mens", "Dup row A", "WHITE", "8(1)", "1004", 30, 15, 1],
    ["mfdup001 ", "", "Mens", "Dup row B", "WHITE", "9(1)", "1005", 30, 15, 1],
    ["", "", "Mens", "Missing SKU should fail", "GREEN", "10(1)", "1006", 10, 5, 1],
    ["MFMAL004", "", "Mens", "Negative size", "BLACK", "-9(1)", "1007", 10, 5, 1],
    ["MFMAL005", "", "Mens", "Broken token", "BLACK", "ABC(-1)", "1008", 10, 5, 1],
  ];

  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Master");
  XLSX.writeFile(wb, filePath);
}

function isMalformedSizeLabel(size) {
  const label = String(size || "").trim().toUpperCase();
  if (!label) return true;
  if (/^-?\d{4,}$/.test(label)) return true;
  if (label.startsWith("-")) return true;
  return false;
}

async function main() {
  const loginBody = JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  const login = await requestJson("POST", `${API_BASE}/admin/login`, loginBody, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(loginBody),
  });
  const token = login.token;
  if (!token) throw new Error("Admin login failed");
  const authHeaders = { Authorization: `Bearer ${token}` };

  // Cleanup prior test artifacts
  for (const sku of TEST_SKUS) {
    try {
      await requestJson("DELETE", `${API_BASE}/admin/products/${encodeURIComponent(sku)}`, null, authHeaders);
    } catch {
      // ignore not-found
    }
  }

  const tmpFile = path.join(__dirname, "..", "malfunction_simulation_upload.xlsx");
  makeWorkbook(tmpFile);
  const { boundary, body } = buildMultipart(tmpFile);

  const importRes = await requestJson("POST", `${API_BASE}/admin/import-products`, body, {
    Authorization: `Bearer ${token}`,
    "Content-Type": `multipart/form-data; boundary=${boundary}`,
    "Content-Length": body.length,
  });

  const exportRes = await requestJson("GET", `${API_BASE}/admin/export`, null, authHeaders);
  const products = Array.isArray(exportRes.products) ? exportRes.products : [];

  const matched = products.filter((p) => {
    const sku = String(p.sku || "").trim().toUpperCase();
    return sku.startsWith("MFMAL") || sku.startsWith("MFDUP");
  });

  let duplicateExtra = 0;
  const group = new Map();
  for (const p of matched) {
    const sku = String(p.sku || "").trim().toUpperCase();
    group.set(sku, (group.get(sku) || 0) + 1);
  }
  for (const [, c] of group) {
    if (c > 1) duplicateExtra += c - 1;
  }

  const malformedRows = [];
  for (const p of matched) {
    const sizes = Array.isArray(p.sizes) ? p.sizes : [];
    for (const s of sizes) {
      if (isMalformedSizeLabel(s.size) || Number(s.quantity) < 0) {
        malformedRows.push({ sku: p.sku, size: s.size, quantity: s.quantity });
      }
    }
  }

  const summary = {
    importResponse: {
      imported: importRes.imported,
      updated: importRes.updated,
      failed: importRes.failed,
      warnings: importRes.warnings,
      sampleWarnings: Array.isArray(importRes.warningDetails) ? importRes.warningDetails.slice(0, 10) : [],
      sampleErrors: Array.isArray(importRes.errors) ? importRes.errors.slice(0, 10) : [],
    },
    matchedProductsCount: matched.length,
    duplicateExtraRecordsForTestSkus: duplicateExtra,
    malformedSizeRowsFound: malformedRows,
    resultingProducts: matched.map((p) => ({
      sku: p.sku,
      name: p.name,
      totalQuantity: p.totalQuantity,
      sizes: p.sizes,
      genderCanonical: p.genderCanonical,
    })),
  };

  console.log("MALFUNCTION_SIMULATION_SUMMARY=" + JSON.stringify(summary));
}

main().catch((err) => {
  console.error("MALFUNCTION_SIMULATION_ERROR=" + err.message);
  process.exit(1);
});
