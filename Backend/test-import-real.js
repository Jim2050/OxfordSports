/**
 * Live test: import the REAL client file New_adidas_January_2026.xlsx
 * This is the actual 12,342-row Excel the client uses
 */
const fs = require("fs");
const http = require("http");
const path = require("path");

const TOKEN = process.env.TOKEN || process.argv[2] || "";
if (!TOKEN) {
  console.error("Usage: node test-import-real.js <TOKEN>");
  process.exit(1);
}

const filePath = path.join(__dirname, "..", "New_adidas_January_2026.xlsx");
if (!fs.existsSync(filePath)) {
  console.error("File not found:", filePath);
  process.exit(1);
}

console.log("Uploading:", filePath);
console.log("File size:", (fs.statSync(filePath).size / 1024).toFixed(1), "KB");

const boundary = "----FormBoundary" + Date.now();
const fileData = fs.readFileSync(filePath);

const parts = [];
parts.push(
  Buffer.from(
    "--" +
      boundary +
      "\r\n" +
      'Content-Disposition: form-data; name="file"; filename="New_adidas_January_2026.xlsx"\r\n' +
      "Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n",
  ),
);
parts.push(fileData);
parts.push(Buffer.from("\r\n--" + boundary + "--\r\n"));
const body = Buffer.concat(parts);

console.log("Request body size:", (body.length / 1024).toFixed(1), "KB");
console.log("Uploading to /api/admin/import-products ...");

const startTime = Date.now();

const options = {
  hostname: "localhost",
  port: 5000,
  path: "/api/admin/import-products",
  method: "POST",
  headers: {
    Authorization: "Bearer " + TOKEN,
    "Content-Type": "multipart/form-data; boundary=" + boundary,
    "Content-Length": body.length,
  },
  timeout: 300000, // 5 minutes
};

const req = http.request(options, (res) => {
  let data = "";
  res.on("data", (chunk) => (data += chunk));
  res.on("end", () => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log("\nHTTP Status:", res.statusCode);
    console.log("Client-side elapsed:", elapsed + "s");
    try {
      const j = JSON.parse(data);
      console.log(JSON.stringify(j, null, 2));
    } catch {
      console.log("Raw response:", data.substring(0, 500));
    }
  });
});
req.on("error", (e) => console.error("Request error:", e.message));
req.on("timeout", () => {
  console.error("Request timed out after 5 minutes");
  req.destroy();
});
req.write(body);
req.end();
