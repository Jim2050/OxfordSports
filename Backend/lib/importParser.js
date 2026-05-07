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
 * Normalize parent-child SKU relationships.
 * Some suppliers list a parent SKU and child size rows separately.
 * This merges them into consolidated rows.
 *
 * @param {Array<object>} rows
 * @param {boolean} hasSizeMapping
 * @returns {Array<object>}
 */
function normalizeParentChildSkus(rows, hasSizeMapping = false) {
  if (!hasSizeMapping) return rows;

  const parentMap = new Map();
  const output = [];

  for (const row of rows) {
    const sku = String(row.sku || '').trim().toUpperCase();
    if (!sku) { output.push(row); continue; }

    // Check for parent-child pattern: PARENT-SIZE or PARENT.SIZE
    const parentMatch = sku.match(/^(.+?)[-.](\d+[.\d]*)$/);
    if (parentMatch) {
      const parentSku = parentMatch[1];
      const sizeValue = parentMatch[2];
      if (!parentMap.has(parentSku)) {
        parentMap.set(parentSku, { ...row, sku: parentSku, _childSizes: [] });
      }
      const parent = parentMap.get(parentSku);
      parent._childSizes.push({
        size: sizeValue,
        quantity: parseInt(row.quantity) || 0,
      });
    } else {
      output.push(row);
    }
  }

  // Merge parent rows with collected child sizes
  for (const [, parent] of parentMap) {
    if (parent._childSizes.length > 0) {
      parent.sizes = parent._childSizes.map((s) => `${s.size}`).join(',');
      parent.quantity = parent._childSizes.reduce((sum, s) => sum + s.quantity, 0);
      parent._sizeDetails = parent._childSizes;
    }
    delete parent._childSizes;
    output.push(parent);
  }

  return output;
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
