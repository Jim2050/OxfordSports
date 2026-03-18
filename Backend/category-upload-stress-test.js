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

function writeWorkbook(filePath) {
  const headers = ["Code", "Image Link", "Gender", "Style", "Colour Desc", "UK Size", "Barcode", "RRP", "Trade", "Qty"];

  const rows = [
    // FOOTWEAR
    ["CTFW001", "", "Mens", "Predator Boot Valid", "Black", "8(2); 9(1)", "B1001", 50, 30, 3],
    ["CTFW002", "", "Mens", "Predator Boot BadHuge", "Black", "40273(3)", "B1002", 55, 35, 3],
    ["CTFW003", "", "Mens", "Predator Boot BadNegative", "Black", "-9(1)", "B1003", 55, 35, 1],

    // CLOTHING
    ["CTCL001", "", "Womens", "Training Tee Valid", "Blue", "S(2); M(2)", "B2001", 25, 12, 4],
    ["CTCL002", "", "Womens", "Training Tee BrokenToken", "Blue", "ABC(-1)", "B2002", 25, 12, 1],

    // ACCESSORIES
    ["CTAC001", "", "Unisex", "Gym Bag Valid", "Red", "ONE SIZE(5)", "B3001", 20, 10, 5],
    ["CTAC002", "", "Unisex", "Gym Bag BadMixed", "Red", "ONE SIZE(2); 99999(1)", "B3002", 20, 10, 3],

    // DUPLICATE in same upload
    ["CTFWDUP1", "", "Mens", "Dup Boot A", "White", "7(1)", "BDUP1", 40, 20, 1],
    ["ctfwdup1 ", "", "Mens", "Dup Boot B", "White", "8(1)", "BDUP2", 40, 20, 1],
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
      // ignore
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

  const testSkus = ["CTFW001", "CTFW002", "CTFW003", "CTCL001", "CTCL002", "CTAC001", "CTAC002", "CTFWDUP1"];
  await cleanupSkus(token, testSkus);

  const workbookPath = path.join(__dirname, "..", "category_stress_upload.xlsx");
  writeWorkbook(workbookPath);
  const { boundary, body } = buildMultipart(workbookPath);

  const importRes = await requestJson("POST", `${API_BASE}/admin/import-products`, body, {
    Authorization: `Bearer ${token}`,
    "Content-Type": `multipart/form-data; boundary=${boundary}`,
    "Content-Length": body.length,
  });

  const checks = {};
  for (const sku of testSkus) {
    checks[sku] = await getProductBySku(sku);
  }

  const categoryChecks = {
    footwear: {
      validExists: checks.CTFW001.exists,
      malformedHugeBlocked: !checks.CTFW002.exists,
      malformedNegativeBlocked: !checks.CTFW003.exists,
    },
    clothing: {
      validExists: checks.CTCL001.exists,
      malformedTokenBlocked: !checks.CTCL002.exists,
    },
    accessories: {
      validExists: checks.CTAC001.exists,
      malformedMixedBlocked: !checks.CTAC002.exists,
    },
    duplicateHandling: {
      duplicateSkuGroupsInUpload: importRes.duplicateSkuGroupsInUpload || 0,
      duplicateRowsMerged: importRes.duplicateRowsMerged || 0,
      noDuplicateRecordPersisted: checks.CTFWDUP1.exists,
      dupSkuSizes: checks.CTFWDUP1.exists ? checks.CTFWDUP1.product.sizes : [],
    },
  };

  const summary = {
    apiBase: API_BASE,
    uploadExecutionTime: importRes.executionTime,
    importCounts: {
      imported: importRes.imported,
      updated: importRes.updated,
      failed: importRes.failed,
      warnings: importRes.warnings,
    },
    categoryChecks,
    pass:
      categoryChecks.footwear.validExists &&
      categoryChecks.footwear.malformedHugeBlocked &&
      categoryChecks.footwear.malformedNegativeBlocked &&
      categoryChecks.clothing.validExists &&
      categoryChecks.clothing.malformedTokenBlocked &&
      categoryChecks.accessories.validExists &&
      categoryChecks.accessories.malformedMixedBlocked,
  };

  console.log("CATEGORY_STRESS_TEST_SUMMARY=" + JSON.stringify(summary));
}

main().catch((err) => {
  console.error("CATEGORY_STRESS_TEST_ERROR=" + err.message);
  process.exit(1);
});
