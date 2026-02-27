/**
 * Live test: import demo_test_upload.xlsx via the API
 * Usage: TOKEN=xxx node test-import.js
 */
const fs = require("fs");
const http = require("http");
const path = require("path");

const TOKEN = process.env.TOKEN || process.argv[2] || "";
if (!TOKEN) {
  console.error("Usage: TOKEN=xxx node test-import.js");
  process.exit(1);
}

const filePath = path.join(__dirname, "..", "demo_test_upload.xlsx");
const boundary = "----FormBoundary" + Date.now();
const fileData = fs.readFileSync(filePath);

const parts = [];
parts.push(
  Buffer.from(
    "--" +
      boundary +
      "\r\n" +
      'Content-Disposition: form-data; name="file"; filename="demo_test_upload.xlsx"\r\n' +
      "Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n",
  ),
);
parts.push(fileData);
parts.push(Buffer.from("\r\n--" + boundary + "--\r\n"));
const body = Buffer.concat(parts);

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
};

const req = http.request(options, (res) => {
  let data = "";
  res.on("data", (chunk) => (data += chunk));
  res.on("end", () => {
    console.log("HTTP Status:", res.statusCode);
    try {
      const j = JSON.parse(data);
      console.log(JSON.stringify(j, null, 2));
    } catch {
      console.log("Raw response:", data);
    }
  });
});
req.on("error", (e) => console.error("Request error:", e.message));
req.write(body);
req.end();
