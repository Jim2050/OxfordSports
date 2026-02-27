/**
 * CHECK EXCEL STRUCTURE - See actual SALE vs RRP values
 */
const XLSX = require("xlsx");
const path = require("path");

const excelPath = path.join(__dirname, "..", "updatedclient.xlsx");
console.log("Reading:", excelPath, "\n");

const workbook = XLSX.readFile(excelPath);
const sheetName = workbook.SheetNames[0];
console.log("Sheet:", sheetName, "\n");

const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet, { defval: "" });

console.log("Total rows:", data.length);
console.log("\n=== HEADERS ===");
console.log(Object.keys(data[0]).join(" | "));

console.log("\n=== FIRST 10 ROWS - PRICE ANALYSIS ===");
for (let i = 0; i < Math.min(10, data.length); i++) {
  const row = data[i];
  console.log(`\nRow ${i + 1}:`);
  console.log(`  Code: ${row.Code || row.code || "(empty)"}`);
  console.log(`  Name: ${row.Style || row["Style Desc"] || "(empty)"}`);
  console.log(`  RRP: ${row.RRP || "(empty)"}`);
  console.log(
    `  SALE: ${row.SALE || row.Sale || row["Sale Price"] || "(empty)"}`,
  );
  console.log(`  Trade: ${row.Trade || row.TRADE || "(empty)"}`);
  console.log(
    `  Image: ${String(row["Image Link"] || row.Image || "(empty)").substring(0, 60)}`,
  );
}

console.log("\n=== PRICE STATISTICS ===");
let hasRRP = 0,
  hasSALE = 0,
  hasTrade = 0;
let saleValues = [],
  rrpValues = [],
  tradeValues = [];

for (const row of data) {
  const rrp = parseFloat(row.RRP);
  const sale = parseFloat(row.SALE || row.Sale || row["Sale Price"]);
  const trade = parseFloat(row.Trade || row.TRADE);

  if (!isNaN(rrp) && rrp > 0) {
    hasRRP++;
    rrpValues.push(rrp);
  }
  if (!isNaN(sale) && sale > 0) {
    hasSALE++;
    saleValues.push(sale);
  }
  if (!isNaN(trade) && trade > 0) {
    hasTrade++;
    tradeValues.push(trade);
  }
}

console.log(
  `Rows with RRP: ${hasRRP} (avg: £${(rrpValues.reduce((a, b) => a + b, 0) / rrpValues.length).toFixed(2)})`,
);
console.log(
  `Rows with SALE: ${hasSALE} (avg: £${hasSALE ? (saleValues.reduce((a, b) => a + b, 0) / saleValues.length).toFixed(2) : 0})`,
);
console.log(
  `Rows with Trade: ${hasTrade} (avg: £${hasTrade ? (tradeValues.reduce((a, b) => a + b, 0) / tradeValues.length).toFixed(2) : 0})`,
);

// Check how many have SALE < RRP (actual discount)
let discounted = 0;
let under5 = 0;
for (const row of data) {
  const rrp = parseFloat(row.RRP);
  const sale = parseFloat(row.SALE || row.Sale);
  if (!isNaN(sale) && sale > 0) {
    if (sale <= 5) under5++;
    if (!isNaN(rrp) && sale < rrp) discounted++;
  }
}

console.log(`\nProducts with SALE < RRP (discounted): ${discounted}`);
console.log(`Products with SALE <= £5: ${under5}`);
