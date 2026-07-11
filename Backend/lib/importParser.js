/**
 * Import Parser (Extracted from importController.js)
 * ───────────────────────────────────────────────────
 * Standalone Excel/CSV parsing utilities for the dry-run pipeline.
 * These functions are pure data transformers — no database writes.
 */

const XLSX = require('xlsx');
const log = require('./logger');

/**
 * Intelligent column mapping.
 * Maps common header variations → canonical field names.
 */
const COLUMN_MAP = {
  sku: [
    "code",
    "sku",
    "product code",
    "item code",
    "article",
    "article number",
    "style code",
    "ref",
    "reference",
    "product", // Feb adidas export uses "Product" for SKU codes
  ],
  name: [
    "style",
    "style desc",
    "style description",
    "product name",
    "name",
    "title",
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
    "trade",
    "trade price",
    "trade (£)",
    "trade price (£)",
    "wholesale price",
    "wholesale",
    "our price",
    "price",
    "unit price",
    "cost",
    "cost price",
    "sell price",
    "sale",
    "sale price",
    "sale (£)",
    "price (£)",
    "price gbp",
    "gbp",
    "net",
    "nett",
    "net price",
    "nett price",
    "landing",
    "landing price",
    "offer price",
    "special price",
    "special offer",
    "clearance price",
    "clearance",
    "fob",
    "fob price",
    "ex vat",
    "total",
    "total price",
    "amount",
    "value",
  ],
  rrp: ["rrp", "retail price", "recommended retail price", "srp", "msrp"],
  category: [
    "gender",
    "category",
    "cat",
    "department",
    "type",
    "product type",
    "group",
  ],
  subcategory: [
    "subcategory",
    "sub category",
    "sub-category",
    "club",
    "team",
    "brand line",
    "collection",
  ],
  brand: [
    "brand",
    "manufacturer",
    "make",
    "label",
    "empty", // unnamed first column in adidas Master sheet (__EMPTY → 'empty')
    "supplier",
    "vendor",
  ],
  color: [
    "colour desc",
    "colour description",
    "color desc",
    "color description",
    "colour",
    "color",
    "col",
  ],
  sizes: [
    "uk size",
    "size",
    "sizes",
    "size range",
    "available sizes",
    "sizes available",
  ],
  barcode: ["barcode", "ean", "upc", "ean13", "gtin", "bar code"],
  quantity: [
    "qty",
    "quantity",
    "stock",
    "stock qty",
    "stock quantity",
    "qty available",
    "available qty",
    "available",
    "units",
    "pcs",
    "total quantity",
    "on hand",
    "stock on hand",
  ],
  imageUrl: [
    "image link",
    "image url",
    "image",
    "img",
    "photo",
    "picture",
    "image file",
    "filename",
    "empty1", // unnamed second column in adidas Master sheet (__EMPTY_1 → 'empty1')
  ],
};

function normalizeHeader(h) {
  return (h || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 ()£]/g, "")
    .replace(/\s+/g, " ");
}

function detectMapping(headers) {
  const mapping = {};
  const unmappedHeaders = [];

  const sortedHeaders = [...headers].sort((a, b) => {
    const aEmpty = a.startsWith("__EMPTY") ? 1 : 0;
    const bEmpty = b.startsWith("__EMPTY") ? 1 : 0;
    return aEmpty - bEmpty;
  });

  for (const raw of sortedHeaders) {
    const norm = normalizeHeader(raw);
    let matched = false;
    for (const [field, aliases] of Object.entries(COLUMN_MAP)) {
      if (aliases.includes(norm)) {
        if (!mapping[field]) {
          mapping[field] = raw;
          matched = true;
          break;
        }
      }
    }
    if (!matched && !Object.values(mapping).includes(raw)) {
      unmappedHeaders.push(raw);
    }
  }

  // Fallback heuristics
  if (!mapping.sku) {
    const skuH = headers.find((h) => /\bcode\b|sku|article|ref\b/i.test(h));
    if (skuH) mapping.sku = skuH;
  }
  if (!mapping.name) {
    const nameH = headers.find((h) => /^(style|name|title|product\s+name)$/i.test(h) || /^(style|name|title)\s+(desc|description)$/i.test(h));
    if (nameH && nameH !== mapping.sku) mapping.name = nameH;
  }
  if (!mapping.price) {
    const priceH = headers.find((h) => /trade|price|cost|sale|£|gbp|net|landing|offer|fob|wholesale|total|amount|value/i.test(h));
    if (priceH) mapping.price = priceH;
  }

  return { mapping, unmappedHeaders };
}

function parseExcelFile(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const allRows = [];
  const sheetSummary = [];
  let mainMapping = {};
  let allHeaders = [];
  let allUnmapped = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rawData.length === 0) {
      sheetSummary.push({ name: sheetName, rows: 0 });
      continue;
    }

    const headers = Object.keys(rawData[0]);
    const { mapping, unmappedHeaders } = detectMapping(headers);

    if (Object.keys(mainMapping).length === 0) {
      mainMapping = mapping;
      allHeaders = headers;
      allUnmapped = unmappedHeaders;
    }

    const currentMapping = Object.keys(mapping).length > 0 ? mapping : mainMapping;

    let rowCount = 0;
    for (const raw of rawData) {
      const values = Object.values(raw).filter((v) => v !== '' && v !== null && v !== undefined);
      if (values.length === 0) continue;

      const row = { _sheetName: sheetName };
      for (const [field, col] of Object.entries(currentMapping)) {
        row[field] = raw[col] !== undefined ? raw[col] : "";
      }

      // Price fallback
      if (row.price === "" || row.price === undefined) {
        if (raw.Price !== undefined && raw.Price !== "") {
          row._rawPrice = raw.Price;
        }
      }

      allRows.push(row);
      rowCount++;
    }

    sheetSummary.push({ name: sheetName, rows: rowCount });
  }

  return {
    rows: allRows,
    headers: allHeaders,
    mapping: mainMapping,
    unmappedHeaders: allUnmapped,
    sheetSummary,
  };
}

function normalizeSizeToken(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function extractSizeFromChildDescription(childDescription, parentDescription = "") {
  const child = normalizeSizeToken(childDescription);
  if (!child) return "";

  const parent = normalizeSizeToken(parentDescription);
  let remainder = child;

  if (parent) {
    const escapedParent = parent.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    remainder = remainder.replace(new RegExp(`^${escapedParent}\\s*`, "i"), "").trim();
  }

  if (!remainder || remainder.length === child.length) {
    const parts = child.split(/\s+/);
    if (parts.length > 1) {
      remainder = parts.slice(1).join(" ");
    }
  }

  const patterns = [
    /(UK\s*\d+(?:\.\d+)?)$/i,
    /(\d+-\d+\s*Y(?:RS?)?)$/i,
    /((?:2X|3X|4X)?[SMLX]{1,3}L?)$/i,
    /(\d+(?:\.\d+)?)$/,
  ];

  for (const pattern of patterns) {
    const match = remainder.match(pattern);
    if (!match) continue;
    const token = normalizeSizeToken(match[1]);
    if (!token) continue;
    if (/^UK\s*\d/i.test(token)) {
      const ukNormalized = token.toUpperCase().replace(/^UK\s*/i, "").trim();
      return `UK ${ukNormalized}`;
    }
    return token.toUpperCase();
  }

  return "";
}

function normalizeParentChildSkus(rows, hasSizeMapping = false) {
  if (rows.length === 0 || hasSizeMapping) return rows;

  const allSkus = [...new Set(rows.map((r) => (r.sku ? String(r.sku).trim().toUpperCase() : "")).filter(Boolean))];
  const parentSkus = new Map();
  for (const sku of allSkus) {
    const children = allSkus.filter((s) => s !== sku && s.startsWith(sku) && s.length > sku.length);
    if (children.length >= 2) {
      const parentRow = rows.find((r) => String(r.sku || "").trim().toUpperCase() === sku);
      parentSkus.set(sku, {
        name: parentRow ? String(parentRow.name || "").trim() : "",
        description: parentRow ? String(parentRow.description || "").trim() : "",
      });
    }
  }

  if (parentSkus.size === 0) return rows;

  const result = [];
  for (const row of rows) {
    const sku = row.sku ? String(row.sku).trim().toUpperCase() : "";
    if (parentSkus.has(sku)) continue;

    for (const [parentSku, parentInfo] of parentSkus) {
      if (sku.startsWith(parentSku) && sku.length > parentSku.length) {
        const childDescription = String(row.description || row.name || "").trim();
        const parentDescription = String(parentInfo.description || parentInfo.name || "").trim();

        if (!row.sizes && childDescription) {
          const extractedSize = extractSizeFromChildDescription(childDescription, parentDescription);
          if (extractedSize) {
            row.sizes = extractedSize;
            row._sizeExtractedFromDescription = true;
          }
        }
        row.sku = parentSku;
        if (parentInfo.name) row.name = parentInfo.name;
        break;
      }
    }
    result.push(row);
  }

  return result;
}

function consolidateBySku(rows) {
  const map = new Map();
  for (const row of rows) {
    const sku = String(row.sku || '').trim().toUpperCase();
    if (!sku) continue;

    const qty = parseInt(row.quantity) || 0;
    if (!map.has(sku)) {
      const sizeEntries = [];
      if (row.sizes) {
        sizeEntries.push({ size: String(row.sizes).trim(), quantity: qty });
      }
      map.set(sku, { ...row, sku, sizeEntries, quantity: qty });
    } else {
      const existing = map.get(sku);
      existing.quantity += qty;
      if (row.sizes) {
        const s = String(row.sizes).trim();
        const found = existing.sizeEntries.find(e => e.size === s);
        if (found) {
          found.quantity += qty;
        } else {
          existing.sizeEntries.push({ size: s, quantity: qty });
        }
      }
      for (const field of ['name', 'price', 'rrp', 'category', 'brand', 'color', 'imageUrl', 'description']) {
        if (!existing[field] && row[field]) existing[field] = row[field];
      }
    }
  }
  return Array.from(map.values());
}

module.exports = {
  parseExcelFile,
  normalizeParentChildSkus,
  consolidateBySku,
  COLUMN_MAP,
};
