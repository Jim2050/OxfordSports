/**
 * Import Parser (Extracted from importController.js)
 * ───────────────────────────────────────────────────
 * Standalone Excel/CSV parsing utilities for the dry-run pipeline.
 * These functions are pure data transformers — no database writes.
 */

const XLSX = require('xlsx');
const log = require('./logger');
const { parseSizeEntries } = require('../utils/taxonomyUtils');
const { normalizeSizeEntries } = require('../utils/sizeStockUtils');

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
    "article no",
    "article no.",
    "art no",
    "art no.",
    "artno",
    "style code",
    "ref",
    "reference",
    "product", // Feb adidas export uses "Product" for SKU codes
    "material",
    "material number",
    "material no",
    "material no.",
    "global material number",
    "item number",
    "style",
    "model",
    "model number",
    "articleid",
    "article id",
    "no",
    "no.",
    "id",
    "productid",
    "ean",
    "barcode",
    "ean/upc",
    "style number",
    "style no",
    "style no.",
  ],
  name: [
    "style",
    "style desc",
    "style description",
    "product name",
    "name",
    "title",
    "description",
    "article description",
    "model name",
    "model description",
    "product description",
    "item name",
    "item description",
    "material description",
    "description 1",
    "description 2",
  ],
  description: [
    "long description",
    "notes",
    "product details",
    "details",
    "desc",
    "web description",
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
  rrp: ["rrp", "retail price", "recommended retail price", "srp", "msrp", "retail"],
  category: [
    "gender",
    "category",
    "cat",
    "department",
    "type",
    "product type",
    "group",
    "division",
    "consumer",
    "age group",
  ],
  subcategory: [
    "subcategory",
    "sub category",
    "sub-category",
    "club",
    "team",
    "brand line",
    "collection",
    "category description",
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
    "color name",
    "colour name",
  ],
  sizes: [
    "uk size",
    "size",
    "sizes",
    "size range",
    "available sizes",
    "sizes available",
    "size desc",
  ],
  barcode: ["barcode", "ean", "upc", "ean13", "gtin", "bar code", "eanupc"],
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
    "free stock",
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

  // ── Fallback heuristics for critical fields ──
  if (!mapping.sku) {
    const skuH = headers.find((h) => /\bcode\b|sku|article|ref\b|material|art\s*no|art\.no|product\s*id|item\s*no/i.test(h));
    if (skuH) mapping.sku = skuH;
  }
  if (!mapping.name) {
    const nameH = headers.find((h) => /^(style|name|title|product\s+name|description)$/i.test(h) || /^(style|name|title|article|material)\s+(desc|description)$/i.test(h));
    if (nameH && nameH !== mapping.sku) mapping.name = nameH;
  }
  if (!mapping.price) {
    const priceH = headers.find((h) => /trade|price|cost|sale|£|gbp|net|landing|offer|fob|wholesale|total|amount|value|msrp|rrp|retail/i.test(h));
    if (priceH) mapping.price = priceH;
  }
  if (!mapping.category) {
    const catH = headers.find((h) => /gender|category|department|division|consumer|age\s*group/i.test(h));
    if (catH) mapping.category = catH;
  }
  if (!mapping.imageUrl) {
    const imgH = headers.find((h) => /image|img|photo|picture|url|link|file/i.test(h));
    if (imgH) mapping.imageUrl = imgH;
  }

  // ── Price precedence fix: prefer SALE over Trade when both exist ──
  const saleHeader = headers.find((h) => /(^|\s)(sale|sale price)(\s|$)|\bsale\b|\bsale price\b/i.test(h));
  const tradeHeader = headers.find((h) => /(^|\s)trade(\s|$)|\btrade price\b/i.test(h));
  if (saleHeader && tradeHeader && mapping.price === tradeHeader) {
    mapping.price = saleHeader;
  }

  // ── Post-mapping fixup: if sku+description mapped but no name, use description as name ──
  if (mapping.sku && mapping.description && !mapping.name) {
    mapping.name = mapping.description;
    delete mapping.description;
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

      // Price fallback logic - matches importController.js
      if (row.price === "" || row.price === undefined || row.price === null) {
        const _priceRe = /price|trade|cost|sale|£|gbp|net|landing|offer|fob|wholesale|special|total|amount|value/i;
        if (raw.Price !== undefined && raw.Price !== "") {
          row._rawPrice = raw.Price;
        } else {
          const mappedCols = new Set(Object.values(currentMapping));
          for (const hdr of headers) {
            if (mappedCols.has(hdr) && hdr === currentMapping.price) continue;
            if (_priceRe.test(hdr) && raw[hdr] !== undefined && raw[hdr] !== "" && raw[hdr] !== null) {
              const testVal = parseFloat(String(raw[hdr]).replace(/[£$€,\s]/g, ""));
              if (!isNaN(testVal) && testVal > 0) {
                row._rawPrice = raw[hdr];
                break;
              }
            }
          }
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
  if (rows.length === 0) return rows;

  const allSkus = [...new Set(rows.map((r) => (r.sku ? String(r.sku).trim().toUpperCase() : "")).filter(Boolean))];
  const parentSkus = new Map();
  for (const sku of allSkus) {
    const children = allSkus.filter((s) => s !== sku && s.startsWith(sku) && s.length > sku.length);
    if (children.length >= 1) {
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
  const skuMap = new Map();

  for (const row of rows) {
    const sku = row.sku ? String(row.sku).trim().toUpperCase() : "";
    if (!sku) continue;

    const parsedQty = parseInt(row.quantity);
    const rowQty = isNaN(parsedQty) ? 0 : Math.max(0, parsedQty);
    const rawSize = row.sizes ? String(row.sizes).trim() : "";
    const rawSizeProvided = rawSize.length > 0;

    // Use the robust parser from taxonomyUtils
    const parsedSizes = parseSizeEntries(rawSize, rowQty);
    const rowSizes = parsedSizes.entries;
    const normalizedRowSizes = normalizeSizeEntries(rowSizes, row.category);

    const strictSizeFailure = rawSizeProvided && rowQty > 0 && normalizedRowSizes.length === 0;

    if (skuMap.has(sku)) {
      const existing = skuMap.get(sku);

      if (normalizedRowSizes.length > 0) {
        for (const entry of normalizedRowSizes) {
          const found = existing.sizeEntries.find((e) => e.size === entry.size);
          if (found) {
            found.quantity += entry.quantity;
          } else {
            existing.sizeEntries.push({ ...entry });
          }
        }
      }

      const newBarcode = row.barcode ? String(row.barcode).trim() : "";
      if (newBarcode && !existing.barcodes.includes(newBarcode)) {
        existing.barcodes.push(newBarcode);
      }

      for (const field of ['name', 'description', 'category', 'subcategory', 'brand', 'color']) {
        if (!existing[field] && row[field]) existing[field] = row[field];
      }

      if ((!existing.price || existing.price === 0) && row.price) existing.price = row.price;
      if ((!existing.rrp || existing.rrp === 0) && row.rrp) existing.rrp = row.rrp;
      if (!existing._rawPrice && row._rawPrice) existing._rawPrice = row._rawPrice;

      if (parsedSizes.invalidTokens.length > 0) {
        existing._sizeWarnings = existing._sizeWarnings || [];
        existing._sizeWarnings.push(`Invalid size token(s): ${parsedSizes.invalidTokens.join(", ")}`);
      }
    } else {
      const barcode = row.barcode ? String(row.barcode).trim() : "";
      const sizeEntries = [];
      const sizeErrors = [];

      if (parsedSizes.invalidTokens.length > 0) {
        sizeErrors.push(`Invalid size token(s): ${parsedSizes.invalidTokens.join(", ")}`);
      }
      if (parsedSizes.checksumMismatch) {
        sizeErrors.push(`Embedded size quantities (${parsedSizes.parsedTotal}) do not match QTY (${rowQty})`);
      }

      if (normalizedRowSizes.length > 0) {
        for (const entry of normalizedRowSizes) {
          const found = sizeEntries.find((e) => e.size === entry.size);
          if (found) {
            found.quantity += entry.quantity;
          } else {
            sizeEntries.push({ size: entry.size, quantity: entry.quantity });
          }
        }
      } else if (rawSizeProvided && rowQty > 0) {
        sizeErrors.push("Provided size values could not be parsed");
      }

      skuMap.set(sku, {
        ...row,
        sku,
        _sizeWarnings: sizeErrors,
        _rawSizeProvided: rawSizeProvided,
        _sizeParseFailed: strictSizeFailure || (rawSizeProvided && sizeEntries.length === 0),
        sizeEntries: normalizeSizeEntries(sizeEntries, row.category),
        barcodes: barcode ? [barcode] : [],
      });
    }
  }

  // Final quantity summation for summary
  const result = Array.from(skuMap.values()).map(p => ({
    ...p,
    quantity: (p.sizeEntries || []).reduce((sum, s) => sum + (s.quantity || 0), 0)
  }));

  return result;
}

module.exports = {
  parseExcelFile,
  normalizeParentChildSkus,
  consolidateBySku,
  COLUMN_MAP,
};
