/**
 * Excel Parser Service
 * Smart column mapping that handles Adidas, Puma, and generic spreadsheet formats.
 */

const XLSX = require("xlsx");

// ── Column name aliases (case-insensitive matching) ──
const COLUMN_MAP = {
  sku: [
    "sku",
    "product code",
    "item code",
    "code",
    "article",
    "article number",
    "style",
    "style code",
    "ref",
    "reference",
  ],
  name: [
    "product name",
    "name",
    "title",
    "item",
    "description name",
    "product",
    "item name",
    "item description",
  ],
  description: [
    "description",
    "desc",
    "details",
    "product description",
    "long description",
    "notes",
  ],
  price: [
    "price",
    "rrp",
    "unit price",
    "cost",
    "sell price",
    "wholesale price",
    "trade price",
    "our price",
    "price (£)",
    "price gbp",
    "gbp",
  ],
  category: ["category", "cat", "department", "type", "product type", "group"],
  subcategory: [
    "subcategory",
    "sub category",
    "sub-category",
    "club",
    "team",
    "brand line",
    "collection",
  ],
  brand: ["brand", "manufacturer", "make", "label"],
  sizes: ["sizes", "size", "size range", "available sizes", "sizes available"],
  quantity: [
    "quantity",
    "qty",
    "stock",
    "stock qty",
    "available",
    "units",
    "pcs",
  ],
  imageUrl: [
    "image",
    "image url",
    "image link",
    "img",
    "photo",
    "picture",
    "image file",
    "filename",
  ],
};

/**
 * Parse an Excel file and return structured product rows.
 * @param {string} filePath - Path to the .xlsx/.xls/.csv file
 * @returns {{ rows: object[], headers: string[], mapping: object, unmappedHeaders: string[] }}
 */
function parseExcel(filePath) {
  const workbook = XLSX.readFile(filePath, {
    cellDates: true,
    cellNF: false,
    cellText: false,
  });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Convert to array of objects (first row = headers)
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  if (rawRows.length === 0) {
    return { rows: [], headers: [], mapping: {}, unmappedHeaders: [] };
  }

  // Get original headers
  const headers = Object.keys(rawRows[0]);

  // Auto-map headers to our schema fields
  const mapping = {};
  const mappedHeaders = new Set();

  for (const [field, aliases] of Object.entries(COLUMN_MAP)) {
    for (const header of headers) {
      const normalised = header.toLowerCase().trim();
      if (aliases.includes(normalised)) {
        mapping[field] = header;
        mappedHeaders.add(header);
        break;
      }
    }
  }

  // Fallback heuristics for unmapped critical fields
  if (!mapping.name) {
    // First text-heavy column that isn't already mapped
    const candidate = headers.find(
      (h) =>
        !mappedHeaders.has(h) &&
        rawRows.some((r) => typeof r[h] === "string" && r[h].length > 5),
    );
    if (candidate) {
      mapping.name = candidate;
      mappedHeaders.add(candidate);
    }
  }

  if (!mapping.price) {
    // First column that contains numbers with £ or decimal values
    const candidate = headers.find((h) => {
      if (mappedHeaders.has(h)) return false;
      return rawRows.some((r) => {
        const v = String(r[h]);
        return /£?\d+\.?\d{0,2}$/.test(v.trim());
      });
    });
    if (candidate) {
      mapping.price = candidate;
      mappedHeaders.add(candidate);
    }
  }

  if (!mapping.sku) {
    // First column with short alphanumeric codes
    const candidate = headers.find((h) => {
      if (mappedHeaders.has(h)) return false;
      return rawRows.some((r) => {
        const v = String(r[h]).trim();
        return v.length > 2 && v.length < 30 && /^[A-Za-z0-9\-_/]+$/.test(v);
      });
    });
    if (candidate) {
      mapping.sku = candidate;
      mappedHeaders.add(candidate);
    }
  }

  const unmappedHeaders = headers.filter((h) => !mappedHeaders.has(h));

  // Map rows to our schema
  const rows = rawRows.map((raw) => {
    const row = {};
    for (const [field, header] of Object.entries(mapping)) {
      let val = raw[header];
      // Clean price values
      if (field === "price" && typeof val === "string") {
        val = val.replace(/[£$,\s]/g, "");
      }
      row[field] = val !== undefined && val !== null ? val : "";
    }
    return row;
  });

  return { rows, headers, mapping, unmappedHeaders };
}

module.exports = { parseExcel };
