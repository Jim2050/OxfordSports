/**
 * Import Parser (Extracted from importController.js)
 * ───────────────────────────────────────────────────
 * Standalone Excel/CSV parsing utilities for the dry-run pipeline.
 * These functions are pure data transformers — no database writes.
 *
 * Used by:
 *   - importDryRunController.js (preview mode)
 *   - importQueue.js (background processing)
 */

const XLSX = require('xlsx');
const log = require('./logger');

/**
 * Intelligent column mapping.
 * Maps common header variations → canonical field names.
 */
const COLUMN_MAP = {
  // SKU
  'sku': 'sku', 'code': 'sku', 'product code': 'sku', 'item code': 'sku',
  'style code': 'sku', 'style': 'sku', 'article': 'sku', 'article number': 'sku',
  'item number': 'sku', 'product id': 'sku',

  // Name
  'name': 'name', 'product name': 'name', 'title': 'name', 'description': 'name',
  'product': 'name', 'item name': 'name', 'item': 'name', 'product description': 'name',

  // Price
  'price': 'price', 'sale price': 'price', 'cost': 'price', 'unit price': 'price',
  'wholesale price': 'price', 'trade price': 'price', 'our price': 'price',
  'net price': 'price', 'selling price': 'price',

  // RRP
  'rrp': 'rrp', 'retail price': 'rrp', 'retail': 'rrp', 'msrp': 'rrp',
  'recommended retail price': 'rrp', 'rrp price': 'rrp',

  // Category
  'category': 'category', 'dept': 'category', 'department': 'category',
  'product type': 'category', 'type': 'category', 'group': 'category',

  // Subcategory
  'subcategory': 'subcategory', 'sub category': 'subcategory',
  'sub-category': 'subcategory', 'sub type': 'subcategory',

  // Brand
  'brand': 'brand', 'manufacturer': 'brand', 'vendor': 'brand',
  'supplier': 'brand', 'make': 'brand',

  // Color
  'color': 'color', 'colour': 'color', 'col': 'color',

  // Barcode
  'barcode': 'barcode', 'ean': 'barcode', 'upc': 'barcode',
  'gtin': 'barcode', 'ean13': 'barcode',

  // Sizes
  'size': 'sizes', 'sizes': 'sizes', 'uk size': 'sizes', 'eu size': 'sizes',
  'size range': 'sizes',

  // Quantity
  'quantity': 'quantity', 'qty': 'quantity', 'stock': 'quantity',
  'stock qty': 'quantity', 'available': 'quantity', 'in stock': 'quantity',
  'units': 'quantity', 'on hand': 'quantity',

  // Image
  'image': 'imageUrl', 'image url': 'imageUrl', 'imageurl': 'imageUrl',
  'picture': 'imageUrl', 'photo': 'imageUrl', 'img': 'imageUrl',
};

/**
 * Parse an Excel or CSV file into structured rows.
 * Auto-detects column mapping from headers.
 *
 * @param {string} filePath - Path to the uploaded file
 * @returns {{ rows: object[], headers: string[], mapping: Record<string,string>, unmappedHeaders: string[], sheetSummary: Array<{name:string,rows:number}> }}
 */
function parseExcelFile(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const allRows = [];
  const sheetSummary = [];
  let detectedMapping = {};
  let allHeaders = [];
  let unmappedHeaders = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rawData.length === 0) {
      sheetSummary.push({ name: sheetName, rows: 0 });
      continue;
    }

    const headers = Object.keys(rawData[0]);

    // Auto-map columns on the first sheet with data
    if (Object.keys(detectedMapping).length === 0) {
      const mapped = {};
      const unmapped = [];

      for (const header of headers) {
        const normalized = header.toLowerCase().trim().replace(/[_\-\.]/g, ' ');
        const canonical = COLUMN_MAP[normalized];
        if (canonical) {
          mapped[canonical] = header; // canonical → original header name
        } else {
          unmapped.push(header);
        }
      }
      detectedMapping = mapped;
      unmappedHeaders = unmapped;
      allHeaders = headers;
    }

    // Transform rows using detected mapping
    for (const raw of rawData) {
      // Skip completely empty rows
      const values = Object.values(raw).filter(
        (v) => v !== '' && v !== null && v !== undefined
      );
      if (values.length === 0) continue;

      const row = { _sheetName: sheetName };

      // Map known columns
      for (const [canonical, originalHeader] of Object.entries(detectedMapping)) {
        row[canonical] = raw[originalHeader] ?? '';
      }

      // Preserve unmapped columns for debugging
      for (const header of unmappedHeaders) {
        if (raw[header] !== '' && raw[header] !== undefined) {
          row[`_unmapped_${header}`] = raw[header];
        }
      }

      allRows.push(row);
    }

    sheetSummary.push({ name: sheetName, rows: rawData.length });
  }

  log.info('import-parser', 'Excel parsed', {
    sheets: sheetSummary.length,
    totalRows: allRows.length,
    mappedColumns: Object.keys(detectedMapping),
    unmappedHeaders,
  });

  return {
    rows: allRows,
    headers: allHeaders,
    mapping: detectedMapping,
    unmappedHeaders,
    sheetSummary,
  };
}

/**
 * Normalize a size token.
 */
function normalizeSizeToken(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

/**
 * Extract size from child description by comparing it with parent description.
 */
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
      const ukNormalized = token
        .toUpperCase()
        .replace(/^UK\s*/i, "")
        .trim();
      return `UK ${ukNormalized}`;
    }
    return token.toUpperCase();
  }

  return "";
}

/**
 * Normalize parent-child SKU relationships.
 * Some suppliers (like adidas) list a parent SKU summary and child size rows separately.
 * This logic identifies parents, skips summary rows, and maps children to the parent SKU.
 *
 * @param {Array<object>} rows
 * @param {boolean} hasSizeMapping
 * @returns {Array<object>}
 */
function normalizeParentChildSkus(rows, hasSizeMapping = false) {
  if (rows.length === 0 || hasSizeMapping) return rows;

  // Collect all SKUs
  const allSkus = [
    ...new Set(
      rows
        .map((r) => (r.sku ? String(r.sku).trim().toUpperCase() : ""))
        .filter(Boolean),
    ),
  ];

  // Find parent SKUs: a SKU that is a prefix of at least 2 other longer SKUs
  const parentSkus = new Map(); // parentSku -> parent row data (for name/description)
  for (const sku of allSkus) {
    const children = allSkus.filter(
      (s) => s !== sku && s.startsWith(sku) && s.length > sku.length,
    );
    if (children.length >= 2) {
      // Find the parent row to get its clean name
      const parentRow = rows.find(
        (r) => String(r.sku || "").trim().toUpperCase() === sku,
      );
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

    // Skip parent/summary rows (they have aggregate qty, not per-size)
    if (parentSkus.has(sku)) continue;

    // Check if this is a child of a parent
    for (const [parentSku, parentInfo] of parentSkus) {
      if (sku.startsWith(parentSku) && sku.length > parentSku.length) {
        const childDescription = String(row.name || "").trim();
        const parentDescription = String(parentInfo.name || "").trim();

        if (!row.sizes && childDescription) {
          const extractedSize = extractSizeFromChildDescription(
            childDescription,
            parentDescription,
          );
          if (extractedSize) {
            row.sizes = extractedSize;
            row._sizeExtractedFromDescription = true;
          }
        }

        // Replace child SKU with parent SKU for consolidation
        row.sku = parentSku;

        // Use parent's clean name instead of child's name+color+size string
        if (parentInfo.name) {
          row.name = parentInfo.name;
        }
        break;
      }
    }

    result.push(row);
  }

  return result;
}

/**
 * Consolidate parsed rows by SKU.
 * Merges duplicate SKU entries, summing quantities.
 *
 * @param {Array<object>} rows
 * @returns {Array<object>}
 */
function consolidateBySku(rows) {
  const map = new Map();

  for (const row of rows) {
    const sku = String(row.sku || '').trim().toUpperCase();
    if (!sku) continue;

    if (!map.has(sku)) {
      map.set(sku, { ...row, sku });
    } else {
      const existing = map.get(sku);
      // Sum quantities
      existing.quantity = (parseInt(existing.quantity) || 0) + (parseInt(row.quantity) || 0);
      // Merge sizes if both have size data
      if (row.sizes && existing.sizes) {
        existing.sizes = `${existing.sizes},${row.sizes}`;
      } else if (row.sizes) {
        existing.sizes = row.sizes;
      }
      // Prefer non-empty values for other fields
      for (const field of ['name', 'price', 'rrp', 'category', 'brand', 'color', 'imageUrl']) {
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
