const fs = require("fs");
const path = require("path");
const https = require("https");
const XLSX = require("xlsx");

const API_BASE = process.env.API_BASE || "https://oxford-sports.up.railway.app/api";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@oxfordsports.net";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Godaddy1971turbs*";

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
            reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed).slice(0, 700)}`));
          } catch {
            if (res.statusCode >= 200 && res.statusCode < 300) return resolve({ raw: data });
            reject(new Error(`HTTP ${res.statusCode}: ${String(data).slice(0, 700)}`));
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

function writeWorkbook(filePath) {
  const headers = [
    "Code",
    "Category",
    "Brand",
    "Style",
    "Colour Desc",
    "UK Size",
    "Barcode",
    "RRP",
    "Trade",
    "Qty",
  ];

  const rows = [
    ["CTV2LTC1", "LICENSED TEAM CLOTHING", "adidas", "Manchester United JSY Home", "Red", "M(1); L(1)", "V2101", 60, 30, 2],
    ["CTV2BG1", "CLOTHING", "adidas B grade", "B Grade Hoodie", "Black", "S(2)", "V2201", 25, 10, 2],
    ["CTV2SP1", "SPORTS", "adidas", "Rugby Training Ball", "White", "ONE SIZE(3)", "V2301", 20, 8, 3],
    ["CTV2BR1", "BRANDS", "adidas", "Brand Showcase Tee", "Blue", "M(1)", "V2401", 15, 7, 1],
    ["CTV2U51", "UNDER £5", "adidas", "Budget Socks", "White", "ONE SIZE(5)", "V2501", 4, 3, 5],
    ["CTV2JL1", "JOB LOTS", "adidas", "Mixed Job Lot Pack", "Multi", "ONE SIZE(2)", "V2601", 5, 2, 2],

    // malformed in these categories
    ["CTV2LTCBAD", "LICENSED TEAM CLOTHING", "adidas", "LTC bad size", "Red", "40273(2)", "V2102", 60, 30, 2],
    ["CTV2SPBAD", "SPORTS", "adidas", "Sports bad size", "White", "-9(1)", "V2302", 20, 8, 1],

    // duplicate sku variant same upload
    ["CTV2DUP1", "FOOTWEAR", "adidas", "Dup V2 A", "White", "7(1)", "VDUP1", 40, 20, 1],
    ["ctv2dup1 ", "FOOTWEAR", "adidas", "Dup V2 B", "White", "8(1)", "VDUP2", 40, 20, 1],
  ];

  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Master");
  XLSX.writeFile(wb, filePath);
}

async function getProductBySku(sku) {
  try {
    const product = await requestJson("GET", `${API_BASE}/products/${encodeURIComponent(sku)}`);
    return { exists: true, product };
  } catch (err) {
    if (String(err.message).includes("HTTP 404")) return { exists: false, product: null };
    throw err;
  }
}

async function cleanupSkus(token, skus) {
  const headers = { Authorization: `Bearer ${token}` };
  for (const sku of skus) {
    try {
      await requestJson("DELETE", `${API_BASE}/admin/products/${encodeURIComponent(sku)}`, null, headers);
    } catch {
      // ignore not found
    }
  }
}

async function main() {
  const loginBody = JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  const login = await requestJson("POST", `${API_BASE}/admin/login`, loginBody, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(loginBody),
  });
  const token = login.token;
  if (!token) throw new Error("Admin login failed");

  const skus = [
    "CTV2LTC1",
    "CTV2BG1",
    "CTV2SP1",
    "CTV2BR1",
    "CTV2U51",
    "CTV2JL1",
    "CTV2LTCBAD",
    "CTV2SPBAD",
    "CTV2DUP1",
  ];

  await cleanupSkus(token, skus);

  const workbookPath = path.join(__dirname, "..", "category_stress_upload_v2.xlsx");
  writeWorkbook(workbookPath);

  const { boundary, body } = buildMultipart(workbookPath);
  const importRes = await requestJson("POST", `${API_BASE}/admin/import-products`, body, {
    Authorization: `Bearer ${token}`,
    "Content-Type": `multipart/form-data; boundary=${boundary}`,
    "Content-Length": body.length,
  });

  const checks = {};
  for (const sku of skus) {
    checks[sku] = await getProductBySku(sku);
  }

  const summary = {
    apiBase: API_BASE,
    executionTime: importRes.executionTime,
    importCounts: {
      imported: importRes.imported,
      updated: importRes.updated,
      failed: importRes.failed,
      warnings: importRes.warnings,
      duplicateSkuGroupsInUpload: importRes.duplicateSkuGroupsInUpload || 0,
      duplicateRowsMerged: importRes.duplicateRowsMerged || 0,
    },
    categoryAssertions: {
      licensedTeamClothing: checks.CTV2LTC1.exists ? checks.CTV2LTC1.product.category : "MISSING",
      bGradeRecategorized: checks.CTV2BG1.exists ? checks.CTV2BG1.product.category : "MISSING",
      sports: checks.CTV2SP1.exists ? checks.CTV2SP1.product.category : "MISSING",
      brands: checks.CTV2BR1.exists ? checks.CTV2BR1.product.category : "MISSING",
      under5: checks.CTV2U51.exists ? checks.CTV2U51.product.category : "MISSING",
      jobLots: checks.CTV2JL1.exists ? checks.CTV2JL1.product.category : "MISSING",
    },
    malformedBlocked: {
      ltcBadBlocked: !checks.CTV2LTCBAD.exists,
      sportsBadBlocked: !checks.CTV2SPBAD.exists,
    },
    duplicateHandled: {
      persistedOnce: checks.CTV2DUP1.exists,
      sizes: checks.CTV2DUP1.exists ? checks.CTV2DUP1.product.sizes : [],
    },
  };

  summary.pass =
    summary.malformedBlocked.ltcBadBlocked &&
    summary.malformedBlocked.sportsBadBlocked &&
    summary.duplicateHandled.persistedOnce;

  console.log("CATEGORY_STRESS_TEST_V2_SUMMARY=" + JSON.stringify(summary));
}

main().catch((err) => {
  console.error("CATEGORY_STRESS_TEST_V2_ERROR=" + err.message);
  process.exit(1);
});
