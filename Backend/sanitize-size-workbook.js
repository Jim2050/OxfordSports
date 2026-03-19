const XLSX = require("xlsx");
const path = require("path");

const inputPath = path.resolve(__dirname, "../updatedclient.xlsx");
const outputPath = path.resolve(__dirname, "../updatedclient_sizes_fixed.xlsx");

const sizeCols = ["UK Size", "size", "Size", "sizes", "Sizes"];

function normalizeToken(token) {
  const raw = String(token ?? "")
    .replace(/[\u2212\u2012\u2013\u2014\u2015]/g, "-")
    .trim();
  if (!raw) return raw;

  const embedded = raw.match(/^([-+]?\d+(?:\.\d+)?)\s*\((\d+)\)$/);
  if (embedded) {
    const n = Math.abs(Number(embedded[1]));
    if (Number.isFinite(n)) {
      const label = Number.isInteger(n) ? String(n) : String(n);
      return `${label}(${embedded[2]})`;
    }
  }

  if (/^[-+]?\d+(?:\.\d+)?$/.test(raw)) {
    const n = Math.abs(Number(raw));
    if (Number.isFinite(n)) return Number.isInteger(n) ? String(n) : String(n);
  }

  return raw;
}

function normalizeCell(value) {
  const raw = String(value ?? "");
  if (!raw.trim()) return raw;

  if (raw.includes(";")) {
    return raw
      .split(";")
      .map((p) => normalizeToken(p))
      .join(";");
  }

  if (raw.includes(",")) {
    return raw
      .split(",")
      .map((p) => normalizeToken(p))
      .join(",");
  }

  return normalizeToken(raw);
}

const wb = XLSX.readFile(inputPath);
for (const sheetName of wb.SheetNames) {
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

  let changed = 0;
  for (const row of rows) {
    for (const col of sizeCols) {
      if (row[col] === undefined || row[col] === "") continue;
      const before = String(row[col]);
      const after = normalizeCell(before);
      if (after !== before) {
        row[col] = after;
        changed += 1;
      }
      break;
    }
  }

  wb.Sheets[sheetName] = XLSX.utils.json_to_sheet(rows, { skipHeader: false });
  console.log(`SHEET ${sheetName}: changed ${changed}`);
}

XLSX.writeFile(wb, outputPath);
console.log(`WROTE ${outputPath}`);
