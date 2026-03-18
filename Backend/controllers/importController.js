const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const AdmZip = require("adm-zip");
const Product = require("../models/Product");
const Category = require("../models/Category");
const ImportBatch = require("../models/ImportBatch");
const cloudinary = require("../config/cloudinary");
const {
  resolveProductImage,
  batchResolveImages,
} = require("../utils/imageResolver");
const {
  TOP_LEVEL_CATEGORIES,
  deriveBrandCanonical,
  deriveCategoryCanonical,
  deriveGenderCanonical,
  deriveSportCanonical,
  deriveSubcategoryCanonical,
  parseSizeEntries,
} = require("../utils/taxonomyUtils");
const { normalizeSizeEntries } = require("../utils/sizeStockUtils");

function normalizeImportedSubcategory(category, subcategory, name, description = "") {
  const cat = String(category || "").trim().toUpperCase();
  const raw = String(subcategory || "").trim();
  const upper = raw.toUpperCase();
  const combined = `${String(name || "").toUpperCase()} ${String(description || "").toUpperCase()} ${upper}`;
  if (!upper) return "";

  // Common OCR variants in the provided CSV (e.g. "Shirts & Ierseys").
  if (/\bSHIRTS?\s*&\s*.[A-Z]*ERSEYS?\b/.test(upper)) {
    return cat === "LICENSED TEAM CLOTHING" ? "TEAM JERSEYS" : "T-SHIRTS";
  }

  if (upper === "HOODS & SWEATERS") {
    return "HOODED SWEATERS";
  }

  if (upper === "HATS & CAPS") {
    return "HEADWEAR";
  }

  if (cat === "CLOTHING") {
    if (/\bPOLO\b/.test(combined)) return "POLO SHIRTS";
    if (/\bCROP TOP\b|\bTUBE TOP\b|\bVEST\b|\bBRA\b/.test(combined)) return "VESTS & BRAS";
    if (/\bSKIRT\b|\bSKORT\b/.test(combined)) return "SKIRTS & SKORTS";
    if (/\bDRESS\b|\bBODYSUIT\b/.test(combined)) return "DRESSES & BODYSUITS";
    if (/\bTRACK TOP\b|\bTRACK JACKET\b|\bTT\b|\bFIREBIRD TRACK TOP\b/.test(combined)) return "TRACKSUITS JACKETS";
    if (/\bJOGGER\b|\bJOGGERS\b|\bPANT\b|\bPANTS\b|\bTRACK PANT\b|\bTRACKSUIT BOTTOM\b/.test(combined)) return "TRACKSUIT BOTTOMS";
    if (/\bTRACKSUIT\b/.test(combined) || upper === "TRACKSUITS & JOGGERS") return "TRACKSUIT SETS";
    if (/\bHOOD\b|\bHOODIE\b|\bHOODY\b/.test(combined)) return "HOODED SWEATERS";
    if (/\bSWEATER\b|\bSWEATSHIRT\b|\bCREW SWEAT\b|\bJUMPER\b|\bKNIT\b/.test(combined)) return "JUMPERS & SWEATERS";
    if (/\bSOCK\b/.test(combined)) return "SOCKS";
    if (/\bGLOVE\b/.test(combined)) return "GLOVES";
    if (/\bHEADWEAR\b|\bHAT\b|\bCAP\b|\bBEANIE\b/.test(combined)) return "HEADWEAR";
    if (/\bSWIM\b|\bBIKINI\b/.test(combined)) return "SWIMWEAR";
    if (/\bT-SHIRT\b|\bT SHIRT\b|\bTEE\b|\bTOP\b|\bTANK\b|\bSHIRT\b/.test(combined)) return "T-SHIRTS";
  }

  if (cat === "LICENSED TEAM CLOTHING") {
    if (/\bBAG\b|\bHOLDALL\b|\bBACKPACK\b/.test(combined)) return "BAGS & HOLDALLS";
    if (/\bHAT\b|\bCAP\b|\bBEANIE\b|\bHEADWEAR\b/.test(combined)) return "HEADWEAR";
    if (/\bGLOVE\b/.test(combined)) return "GLOVES";
    if (/\bSOCK\b/.test(combined)) return "SOCKS";
    if (/\bTRACK TOP\b|\bTRACK JACKET\b|\bTT\b/.test(combined)) return "TRACKSUIT JACKETS";
    if (/\bJOGGER\b|\bPANT\b|\bPANTS\b|\bTRACK PANT\b/.test(combined)) return "TRACKSUIT BOTTOMS";
    if (/\bTRACKSUIT\b/.test(combined)) return "TRACKSUIT SETS";
    if (/\bHOOD\b|\bHOODIE\b/.test(combined)) return "HOODED SWEATERS";
    if (/\bJUMPER\b|\bSWEATER\b|\bSWEATSHIRT\b/.test(combined)) return "JUMPERS & SWEATERS";
    if (/\bSHORT\b/.test(combined)) return "SHORTS";
    if (/\bJACKET\b|\bCOAT\b/.test(combined)) return "JACKETS & COATS";
    if (/\bJSY\b|\bJERSEY\b|\bREPLICA\b/.test(combined)) return "TEAM JERSEYS";
    if (/\bTEE\b|\bT-SHIRT\b|\bT SHIRT\b|\bSHIRT\b/.test(combined)) return "T-SHIRTS";
    if (/\bACCESSOR/.test(combined)) return "ACCESSORIES & MEMORABILIA";
  }

  return raw;
}

function normalizeImportedName(name, category, subcategory) {
  const raw = String(name || "").trim();
  if (!raw) return "";

  const cat = String(category || "").trim().toUpperCase();
  const sub = String(subcategory || "").trim().toUpperCase();

  // Source files sometimes contain a footwear title against clothing shorts rows.
  // Normalize obvious contradictions so card titles align with taxonomy and image.
  if (
    cat === "CLOTHING" &&
    sub === "SHORTS" &&
    /\bFOOTBALL\s+BOOTS\b/i.test(raw)
  ) {
    return raw.replace(/\bFOOTBALL\s+BOOTS\b/gi, "Shorts").replace(/\s+/g, " ").trim();
  }

  return raw;
}

// Production-safe logger — silent in production, verbose in development
const isDev = process.env.NODE_ENV !== "production";
const debug = isDev ? console.log.bind(console) : () => {};

// ═══════════════════════════════════════════════════════════════
//  COLUMN ALIAS MAP — handles client Excel + generic formats
//  Client sheets: Master (Code, Image Link, Gender, Style, Colour Desc, UK Size, Barcode, RRP, Trade)
//  FIREBIRD sheet: Code, Image, Gender, Style Desc, Colour Desc, UK Size, Barcode, RRP, Trade, Price, Qty
// ═══════════════════════════════════════════════════════════════
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
    "item",
    "description name",
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
    "stock quantity", // Added to match "Stock Quantity" column
    "available",
    "units",
    "pcs",
  ],
  imageUrl: [
    "image link",
    "image url",
    "image",
    "img",
    "photo",
    "picture",
    "image file",
    "image url", // Added to match "Image URL" column
    "filename",
    "empty1", // unnamed second column in adidas Master sheet (__EMPTY_1 → 'empty1')
  ],
};

/**
 * Normalize a header string for matching.
 */
function normalizeHeader(h) {
  return (h || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 ()£]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Detect column mapping from header row.
 * Prefers explicitly-named columns over unnamed __EMPTY* columns.
 */
function detectMapping(headers) {
  const mapping = {};
  const unmappedHeaders = [];

  // Sort headers: named columns first, __EMPTY* columns last
  // This ensures "Image Link" is preferred over "__EMPTY_1" etc.
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
    const skuH = headers.find((h) => /\bcode\b|sku|article|ref\b/i.test(h));
    if (skuH) mapping.sku = skuH;
  }
  if (!mapping.name) {
    const nameH = headers.find((h) => /style|name|title|product/i.test(h));
    if (nameH && nameH !== mapping.sku) mapping.name = nameH;
  }
  if (!mapping.price) {
    const priceH = headers.find((h) => /trade|price|cost|sale|£|gbp|net|landing|offer|fob|wholesale|total|amount|value/i.test(h));
    if (priceH) mapping.price = priceH;
  }
  if (!mapping.category) {
    const catH = headers.find((h) => /gender|category|department/i.test(h));
    if (catH) mapping.category = catH;
  }
  if (!mapping.imageUrl) {
    const imgH = headers.find((h) => /image|img|photo|picture/i.test(h));
    if (imgH) mapping.imageUrl = imgH;
  }

  // ── Price precedence fix: prefer SALE over Trade when both exist ──
  // Client files can include both columns (e.g. FIREBIRD sheet).
  // SALE is the intended customer-facing sell price.
  const saleHeader = headers.find((h) => /(^|\s)(sale|sale price)(\s|$)|\bsale\b|\bsale price\b/i.test(h));
  const tradeHeader = headers.find((h) => /(^|\s)trade(\s|$)|\btrade price\b/i.test(h));
  if (saleHeader && tradeHeader && mapping.price === tradeHeader) {
    mapping.price = saleHeader;
  }

  // ── Post-mapping fixup: if sku+description mapped but no name, use description as name ──
  // Handles Feb adidas format where "Description" column contains the actual product name
  if (mapping.sku && mapping.description && !mapping.name) {
    mapping.name = mapping.description;
    delete mapping.description;
  }

  return { mapping, unmappedHeaders };
}

/**
 * Detect parent-child SKU relationships and normalize rows.
 * Handles Firebird/adidas export where IF6180 is parent summary,
 * IF6180GRY122 etc. are per-size child rows.
 * Skips parent summary rows, maps children to parent SKU,
 * and extracts size from name/description when no size column.
 */
function normalizeParentChildSkus(rows, hasSizeMapping) {
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
  const parentSkus = new Map(); // parentSku -> parent row data (for name)
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
      });
    }
  }

  if (parentSkus.size === 0) return rows;

  debug(
    `[IMPORT] Parent-child SKU pattern detected: ${parentSkus.size} parent(s): ${[...parentSkus.keys()].slice(0, 5).join(", ")}`,
  );

  const result = [];
  for (const row of rows) {
    const sku = row.sku ? String(row.sku).trim().toUpperCase() : "";

    // Skip parent/summary rows (they have aggregate qty, not per-size)
    if (parentSkus.has(sku)) continue;

    // Check if this is a child of a parent
    let matched = false;
    for (const [parentSku, parentInfo] of parentSkus) {
      if (sku.startsWith(parentSku) && sku.length > parentSku.length) {
        // Replace child SKU with parent SKU for consolidation
        row.sku = parentSku;

        // Extract size from name/description
        // Handles: "...UK 3.5", "...XL", "...One Size", "...7-8Y"
        if (!row.sizes || String(row.sizes).trim() === "") {
          const text = String(row.name || "");
          // Try UK size first (e.g. "UK 3.5")
          const ukMatch = text.match(/UK\s+(\d+(?:\.\d+)?)/i);
          if (ukMatch) {
            row.sizes = ukMatch[1];
          } else {
            // Try standard sizes at end of string: XS, S, M, L, XL, XXL, XXXL, or age sizes like 7-8Y
            const stdMatch = text.match(
              /\b(XXXL|XXL|XL|XS|S|M|L|\d+-\d+Y)\s*$/i,
            );
            if (stdMatch) {
              row.sizes = stdMatch[1].toUpperCase();
            }
          }
        }

        // Use parent's clean name instead of child's name+color+size string
        if (parentInfo.name) {
          row.name = parentInfo.name;
        }

        matched = true;
        break;
      }
    }

    result.push(row);
  }

  debug(
    `[IMPORT] Parent-child normalization: ${rows.length} rows -> ${result.length} rows (${rows.length - result.length} parent summaries skipped)`,
  );
  return result;
}

/**
 * Parse ALL sheets in an Excel workbook into mapped row objects.
 * Returns combined rows from all sheets.
 */
function parseExcelFile(filePath) {
  const workbook = XLSX.readFile(filePath);
  const allRows = [];
  let allHeaders = [];
  let mainMapping = {};
  let allUnmapped = [];
  const sheetSummary = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (rawData.length === 0) {
      sheetSummary.push({ name: sheetName, rows: 0 });
      continue;
    }

    const headers = Object.keys(rawData[0]);
    const { mapping, unmappedHeaders } = detectMapping(headers);

    // Use the first sheet's mapping as the reference
    if (Object.keys(mainMapping).length === 0) {
      mainMapping = mapping;
      allHeaders = headers;
      allUnmapped = unmappedHeaders;
    }

    const currentMapping =
      Object.keys(mapping).length > 0 ? mapping : mainMapping;

    let rowCount = 0;
    for (const raw of rawData) {
      // Skip completely empty rows
      const values = Object.values(raw).filter(
        (v) => v !== "" && v !== null && v !== undefined,
      );
      if (values.length === 0) continue;

      const row = { _sheetName: sheetName };
      for (const [field, col] of Object.entries(currentMapping)) {
        row[field] = raw[col] !== undefined ? raw[col] : "";
      }

      // Fallback: if mapped price column was empty, try other price-like columns
      if (row.price === "" || row.price === undefined || row.price === null) {
        const _priceRe = /price|trade|cost|sale|£|gbp|net|landing|offer|fob|wholesale|special|total|amount|value/i;
        // First try exact "Price" key (common in adidas sheets)
        if (raw.Price !== undefined && raw.Price !== "") {
          row._rawPrice = raw.Price;
        } else {
          // Scan ALL other columns for any price-like header with a numeric value
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

    sheetSummary.push({
      name: sheetName,
      rows: rowCount,
      mapping: Object.keys(currentMapping),
    });
  }

  return {
    rows: allRows,
    headers: allHeaders,
    mapping: mainMapping,
    unmappedHeaders: allUnmapped,
    sheetSummary,
  };
}

/**
 * Consolidate rows by SKU — merges size variants into a single product.
 * Same SKU with different sizes becomes one product with sizes array.
 * NEW: sizes is now an array of { size, quantity } objects.
 */
function consolidateBySku(rows) {
  const skuMap = new Map();

  for (const row of rows) {
    const sku = row.sku ? String(row.sku).trim().toUpperCase() : "";
    if (!sku) continue;

    const parsedQty = parseInt(row.quantity);
    const rowQty = isNaN(parsedQty) ? 1 : Math.max(0, parsedQty);
    const rawSize = row.sizes ? String(row.sizes).trim() : "";
    const rawSizeProvided = rawSize.length > 0;
    const parsedSizes = parseSizeEntries(rawSize, rowQty);
    const rowSizes = parsedSizes.entries;
    const normalizedRowSizes = normalizeSizeEntries(rowSizes, row.category);
    const droppedDuringNormalization =
      rawSizeProvided && rowSizes.length > 0 && normalizedRowSizes.length < rowSizes.length;
    const strictSizeFailure =
      rawSizeProvided &&
      (parsedSizes.invalidTokens.length > 0 || parsedSizes.hadNegativeSizes || droppedDuringNormalization);

    if (skuMap.has(sku)) {
      const existing = skuMap.get(sku);

      if (parsedSizes.invalidTokens.length > 0) {
        existing._sizeWarnings = existing._sizeWarnings || [];
        existing._sizeWarnings.push(
          `Invalid size token(s): ${parsedSizes.invalidTokens.join(", ")}`,
        );
      }
      if (parsedSizes.checksumMismatch) {
        existing._sizeWarnings = existing._sizeWarnings || [];
        existing._sizeWarnings.push(
          `Embedded size quantities (${parsedSizes.parsedTotal}) do not match QTY (${rowQty})`,
        );
      }
      existing._hadNegativeSizes = existing._hadNegativeSizes || parsedSizes.hadNegativeSizes;
      existing._rawSizeProvided = existing._rawSizeProvided || rawSizeProvided;
      existing._sizeParseFailed = existing._sizeParseFailed || strictSizeFailure;

      if (rawSizeProvided && rowSizes.length > 0 && normalizedRowSizes.length === 0) {
        existing._sizeWarnings = existing._sizeWarnings || [];
        existing._sizeWarnings.push("All parsed sizes were rejected by normalization rules");
      }
      if (droppedDuringNormalization) {
        existing._sizeWarnings = existing._sizeWarnings || [];
        existing._sizeWarnings.push("Some parsed sizes were rejected by normalization rules");
      }

      // Merge sizes with quantities
      if (normalizedRowSizes.length > 0) {
        for (const entry of normalizedRowSizes) {
          const found = existing.sizeEntries.find((e) => e.size === entry.size);
          if (found) {
            found.quantity += entry.quantity;
          } else {
            existing.sizeEntries.push({
              size: entry.size,
              quantity: entry.quantity,
            });
          }
        }
      } else if (!rawSizeProvided && rowQty > 0) {
        // Row has quantity but no size — add to "ONE SIZE" bucket
        const found = existing.sizeEntries.find((e) => e.size === "ONE SIZE");
        if (found) {
          found.quantity += rowQty;
        } else if (existing.sizeEntries.length === 0) {
          existing.sizeEntries.push({ size: "ONE SIZE", quantity: rowQty });
        } else {
          // Distribute to first entry if no specific size
          existing.sizeEntries[0].quantity += rowQty;
        }
      }

      const beforeNormalizeCount = existing.sizeEntries.length;
      existing.sizeEntries = normalizeSizeEntries(existing.sizeEntries, existing.category);
      if (beforeNormalizeCount > 0 && existing.sizeEntries.length === 0) {
        existing._sizeWarnings = existing._sizeWarnings || [];
        existing._sizeWarnings.push("All merged sizes were rejected by normalization rules");
      }

      // Merge barcode
      const newBarcode = row.barcode ? String(row.barcode).trim() : "";
      if (newBarcode && !existing.barcodes.includes(newBarcode)) {
        existing.barcodes.push(newBarcode);
      }

      // Update price/rrp if existing has 0 and row has value
      if (!existing.price && row.price) existing.price = row.price;
      if (!existing.rrp && row.rrp) existing.rrp = row.rrp;
      if (!existing._rawPrice && row._rawPrice)
        existing._rawPrice = row._rawPrice;
    } else {
      const barcode = row.barcode ? String(row.barcode).trim() : "";
      const sizeEntries = [];

      const sizeErrors = [];
      if (parsedSizes.invalidTokens.length > 0) {
        sizeErrors.push(`Invalid size token(s): ${parsedSizes.invalidTokens.join(", ")}`);
      }
      if (parsedSizes.checksumMismatch) {
        sizeErrors.push(
          `Embedded size quantities (${parsedSizes.parsedTotal}) do not match QTY (${rowQty})`,
        );
      }
      if (droppedDuringNormalization) {
        sizeErrors.push("Some parsed sizes were rejected by normalization rules");
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
      } else if (!rawSizeProvided && rowQty > 0) {
        // No explicit size column value
        sizeEntries.push({ size: "ONE SIZE", quantity: rowQty });
      } else if (rawSizeProvided) {
        sizeErrors.push("Provided size value could not be normalized");
      }

      skuMap.set(sku, {
        ...row,
        sku,
        _sizeWarnings: sizeErrors,
        _hadNegativeSizes: parsedSizes.hadNegativeSizes,
        _rawSizeProvided: rawSizeProvided,
        _sizeParseFailed:
          strictSizeFailure || (rawSizeProvided && sizeEntries.length === 0),
        sizeEntries: normalizeSizeEntries(sizeEntries, row.category),
        barcodes: barcode ? [barcode] : [],
      });
    }
  }

  return Array.from(skuMap.values());
}

/**
 * Create a URL-friendly slug from a string.
 */
function slugify(str) {
  return (str || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Auto-create Category documents from the distinct gender/category values.
 */
async function ensureCategories(categoryNames) {
  const created = [];
  for (const name of categoryNames) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const slug = slugify(trimmed);
    try {
      await Category.findOneAndUpdate(
        { slug },
        { $setOnInsert: { name: trimmed, slug, isActive: true } },
        { upsert: true },
      );
      created.push(trimmed);
    } catch (err) {
      // Ignore duplicate key errors
      if (err.code !== 11000) throw err;
    }
  }
  return created;
}

/**
 * Safely parse a price value from Excel — handles £ symbols, commas, strings.
 * Returns { value: number|null, error: string|null }
 */
function parsePrice(raw) {
  if (raw === undefined || raw === null || raw === "") {
    return { value: null, error: "empty" };
  }
  // If already a number, use directly
  if (typeof raw === "number") {
    if (isNaN(raw)) return { value: null, error: "NaN" };
    if (raw < 0) return { value: null, error: `negative: ${raw}` };
    return { value: raw, error: null };
  }
  // String: strip £, commas, spaces, currency symbols
  const cleaned = String(raw)
    .replace(/[£$€,\s]/g, "")
    .replace(/[^0-9.\-]/g, "");
  if (!cleaned) return { value: null, error: `unparseable: "${raw}"` };
  const num = parseFloat(cleaned);
  if (isNaN(num)) return { value: null, error: `NaN after parse: "${raw}"` };
  if (num < 0) return { value: null, error: `negative: ${num}` };
  return { value: num, error: null };
}

/** Known image file extensions */
const IMG_EXTENSIONS = /\.(jpe?g|png|webp|gif|svg|bmp|avif)(\?.*)?$/i;

/**
 * Validate a URL string — must be a direct image URL.
 * Rejects Google/Bing search pages, bare text, and non-image landing pages.
 */
function isDirectImageUrl(url) {
  if (!url) return false;
  const s = String(url).trim();
  if (s.length < 10) return false;
  const lower = s.toLowerCase();
  if (lower === "google images" || lower === "google image") return false;
  // Reject known search-engine image pages
  if (
    lower.includes("google.com/search") ||
    lower.includes("bing.com/images") ||
    lower.includes("tbm=isch")
  )
    return false;
  if (!lower.startsWith("http://") && !lower.startsWith("https://"))
    return false;
  // Accept direct image file extensions
  if (IMG_EXTENSIONS.test(lower)) return true;
  // Accept known CDNs that serve images without file extension
  if (
    lower.includes("cloudinary.com") ||
    lower.includes("imgur.com") ||
    lower.includes("images.unsplash.com") ||
    lower.includes("cdn.shopify.com")
  )
    return true;
  // Reject everything else (landing pages, search results)
  return false;
}

/**
 * Legacy compat — accepts any HTTP(S) URL that isn't obviously a search page.
 * Used for "at least it's a URL" validation (non-strict).
 */
function isValidImageUrl(url) {
  if (!url) return false;
  const s = String(url).trim();
  if (s.length < 10) return false;
  const lower = s.toLowerCase();
  if (lower === "google images" || lower === "google image") return false;
  if (
    lower.includes("google.com/search") ||
    lower.includes("bing.com/images") ||
    lower.includes("tbm=isch")
  )
    return false;
  return lower.startsWith("http://") || lower.startsWith("https://");
}

/**
 * POST /api/admin/import-products
 * Accept .xlsx → parse ALL sheets → consolidate size variants → upsert into MongoDB.
 * Handles 5000+ rows with batch processing.
 */
exports.importProducts = async (req, res) => {
  let batch;
  const filePath = req.file?.path;
  const startTime = Date.now();

  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    // Create ImportBatch record
    batch = await ImportBatch.create({
      filename: req.file.originalname,
      importedBy: req.user?._id,
      status: "processing",
    });

    // Parse ALL sheets in the workbook
    const { rows, headers, mapping, unmappedHeaders, sheetSummary } =
      parseExcelFile(filePath);

    debug(
      `[IMPORT] Parsed ${rows.length} raw rows from ${sheetSummary.length} sheets`,
    );
    debug(`[IMPORT] Column mapping:`, JSON.stringify(mapping, null, 2));
    debug(
      `[IMPORT] Sheet breakdown:`,
      sheetSummary.map((s) => `${s.name}(${s.rows})`).join(", "),
    );
    // Log price column explicitly for debugging import failures
    debug(`[IMPORT] Price column mapped to: "${mapping.price || 'NONE'}"  | RRP column: "${mapping.rrp || 'NONE'}"`);
    if (unmappedHeaders.length > 0) {
      debug(`[IMPORT] Unmapped headers:`, unmappedHeaders);
    }

    // ── Phase 1 diagnostic: log first 3 parsed rows ──
    for (let d = 0; d < Math.min(3, rows.length); d++) {
      debug(`[IMPORT] Parsed row ${d}:`, JSON.stringify(rows[d], null, 2));
    }

    if (rows.length === 0) {
      batch.status = "failed";
      batch.errorLog.push({
        row: 0,
        sku: "",
        reason: "File is empty or could not be parsed.",
      });
      await batch.save();
      cleanup(filePath);
      return res
        .status(400)
        .json({ error: "Excel file is empty or could not be parsed." });
    }

    // ── Normalize parent-child SKU patterns (Feb adidas format) ──
    const hasSizeMapping = !!mapping.sizes;
    const normalizedRows = normalizeParentChildSkus(rows, hasSizeMapping);
    if (normalizedRows.length !== rows.length) {
      debug(
        `[IMPORT] Parent-child normalization reduced ${rows.length} -> ${normalizedRows.length} rows`,
      );
    }

    const uploadSkuFrequency = new Map();
    for (const r of normalizedRows) {
      const sku = r.sku ? String(r.sku).trim().toUpperCase() : "";
      if (!sku) continue;
      uploadSkuFrequency.set(sku, (uploadSkuFrequency.get(sku) || 0) + 1);
    }
    const duplicateSkuGroupsInUpload = Array.from(uploadSkuFrequency.values()).filter((count) => count > 1).length;
    const duplicateRowsMerged = Array.from(uploadSkuFrequency.values())
      .filter((count) => count > 1)
      .reduce((sum, count) => sum + (count - 1), 0);
    if (duplicateSkuGroupsInUpload > 0) {
      debug(
        `[IMPORT] Upload contains ${duplicateSkuGroupsInUpload} duplicate SKU groups (${duplicateRowsMerged} extra rows)`,
      );
    }

    // ── Consolidate same-SKU rows (size merging) ──
    const consolidated = consolidateBySku(normalizedRows);
    debug(
      `[IMPORT] Consolidated ${normalizedRows.length} rows → ${consolidated.length} unique products`,
    );

    // ── Detect workbook-wide brand default ──
    // In the adidas Master sheet, the brand ("adidas") is in the unnamed first
    // column (__EMPTY → mapped to brand). FIREBIRD sheet has no brand column,
    // so we fall back to the most common non-empty brand across all rows.
    const brandFreq = {};
    for (const r of consolidated) {
      const b = r.brand ? String(r.brand).trim() : "";
      if (b) brandFreq[b] = (brandFreq[b] || 0) + 1;
    }
    const brandDefault =
      Object.keys(brandFreq).sort((a, b) => brandFreq[b] - brandFreq[a])[0] ||
      "";
    if (brandDefault) {
      debug(
        `[IMPORT] Brand default detected: "${brandDefault}" (${brandFreq[brandDefault]} products) — applied to rows with no brand`,
      );
    }

    // Log price fallback usage
    const priceFallbackCount = consolidated.filter(
      (r) => r._rawPrice !== undefined,
    ).length;
    if (priceFallbackCount > 0) {
      debug(
        `[IMPORT] ${priceFallbackCount} products using Price column fallback (Trade was empty)`,
      );
    }

    // ── Collect distinct categories and auto-create them ──
    const distinctCategories = Array.from(TOP_LEVEL_CATEGORIES).filter(
      (name) => name !== "HOME",
    );
    const createdCategories = await ensureCategories(distinctCategories);

    let imported = 0;
    let updated = 0;
    let failed = 0;
    let warnings = 0;
    const errors = [];
    const warningDetails = [];
    const pendingImageProducts = [];

    // ── Process in batches of 500 for memory efficiency ──
    const BATCH_SIZE = 500;
    const operations = [];

    for (let i = 0; i < consolidated.length; i++) {
      const row = consolidated[i];
      const sku = row.sku;

      if (Array.isArray(row._sizeWarnings) && row._sizeWarnings.length > 0) {
        warnings++;
        warningDetails.push({
          row: i + 1,
          sku,
          reason: row._sizeWarnings.join("; "),
        });
      }

      // Validate: must have SKU
      if (!sku) {
        failed++;
        errors.push({
          row: i + 1,
          sku: "",
          reason: "Missing SKU/Code",
        });
        continue;
      }

      if (row._sizeParseFailed || (row._rawSizeProvided && (!Array.isArray(row.sizeEntries) || row.sizeEntries.length === 0))) {
        failed++;
        errors.push({
          row: i + 1,
          sku,
          reason: "Malformed sizes: provided size values could not be normalized",
        });
        continue;
      }

      // Name: use style/style desc, fall back to SKU
      let name = row.name ? String(row.name).trim() : "";
      if (!name) {
        // Use SKU + color as fallback name
        const color = row.color ? String(row.color).trim() : "";
        name = color ? `${sku} - ${color}` : sku;
      }

      // ── Parse price using safe utility with multiple fallbacks ──
      let rawPrice = row.price;
      if (rawPrice === "" || rawPrice === undefined || rawPrice === null) {
        rawPrice = row._rawPrice;
      }
      let priceResult = parsePrice(rawPrice);
      const rrpResult = parsePrice(row.rrp);
      const rrp = rrpResult.value || 0;

      // Fallback 1: use RRP when trade/sale price is missing
      if (priceResult.error && priceResult.value === null && rrp > 0) {
        priceResult = { value: rrp, error: null };
        warnings++;
        warningDetails.push({
          row: i + 1,
          sku,
          reason: `No trade/sale price found; used RRP £${rrp.toFixed(2)}`,
        });
        if (i < 5) debug(`[IMPORT] Row ${i + 1} (${sku}): no trade price, using RRP £${rrp}`);
      }
      // Fallback 2: last resort — default to 0 with warning instead of failing
      if (priceResult.error && priceResult.value === null) {
        priceResult = { value: 0, error: null };
        warnings++;
        warningDetails.push({
          row: i + 1,
          sku,
          reason: `No price found; defaulted to £0.00 (update manually)`,
        });
        if (i < 5) debug(`[IMPORT] Row ${i + 1} (${sku}): no price at all, defaulted to £0`);
      }
      const price = priceResult.value;

      const originalCategoryValue = row.category ? String(row.category).trim() : "";
      const canonicalFromInput = deriveCategoryCanonical(originalCategoryValue);

      const productData = {
        sku,
        name: normalizeImportedName(name, canonicalFromInput || originalCategoryValue, row.subcategory),
        description: row.description ? String(row.description).trim() : "",
        category: canonicalFromInput || originalCategoryValue,
        subcategory: row.subcategory ? String(row.subcategory).trim() : "",
        brand: row.brand ? String(row.brand).trim() : brandDefault, // fallback to workbook-wide brand (e.g. "adidas")
        color: row.color ? String(row.color).trim() : "",
        barcode: (row.barcodes || []).join(", "),
        salePrice: +price.toFixed(2),
        rrp: +rrp.toFixed(2),
        sizes: row.sizeEntries || [],
        totalQuantity: (row.sizeEntries || []).reduce(
          (sum, s) => sum + (s.quantity || 0),
          0,
        ),
        sheetName: row._sheetName || "",
        isActive: true,
      };

      // ══════════════════════════════════════════════════════════════════
      //  AUTO-CATEGORIZE — comprehensive keyword rules (#20)
      //  Assigns category (FOOTWEAR / CLOTHING / ACCESSORIES) and
      //  subcategory when the Excel only provides gender or nothing.
      // ══════════════════════════════════════════════════════════════════
      const upperName = (name || "").toUpperCase();
      const upperDesc = (productData.description || "").toUpperCase();
      const upperSku  = (sku || "").toUpperCase();
      const combined  = `${upperName} ${upperDesc} ${upperSku}`;
      const catUpper  = (productData.category || "").toUpperCase();

      // ── Footwear indicators ──
      const FOOTWEAR_MODELS = /\b(NEMEZIZ|COPA|PREDATOR|SPEEDFLOW|ULTRABOOST|ULTRA BOOST|NMD|SUPERSTAR|STAN SMITH|GAZELLE|SAMBA|FORUM|OZWEEGO|GRAND COURT|CONTINENTAL|RIVALRY|NIZZA|DAME|HARDEN|D\.O\.N|DONOVAN|TRAE|ADIZERO|DURAMO|SUPERNOVA|SOLAR|QUESTAR|RUNFALCON|RESPONSE|TERREX|SEELEY|ZX |YEEZY|4DFWD|ALPHABOOST|ALPHABOUNCE|SHOWTHEWAY|FLUIDFLOW|LITE RACER|RACER TR|KAPTIR|LITE 2|EDGE LUX|DROPSET|Court|COURTJAM|BARRICADE|SOLEMATCH|GAMECOURT|DROPSTEP|MIDCITY|HOOPS|BREAKNET|ADVANTAGE|ROGUERA|DAILY|VS PACE|BRAVADA|VULCRAID|VULC RAID)\b/;
      const FOOTWEAR_STUDS = /\b(FG|SG|TF|AG|IN|FxG|MG|HG)\b/;
      const FOOTWEAR_KEYWORDS = /\b(BOOT|BOOTS|TRAINER|TRAINERS|SHOE|SHOES|SNEAKER|SNEAKERS|FOOTWEAR|RUNNING|SLIDE|SLIDES|SANDAL|SANDALS|FLIP FLOP|FLIP FLOPS|MULE|MULES|CLOG|CLOGS|SLIPPER|SLIPPERS|SOCK SHOE|SLIP ON|SLIP-ON|SOCCER SHOE|FOOTBALL BOOT)\b/;

      // ── Clothing abbreviation indicators (adidas naming convention) ──
      const CLOTHING_ABBREVS = /\b(SHO|JKT|PT|TT|HD|TEE|JSY|POLO|VEST|SWT|SH|BRA|CROP|TANK|TIGHT|LEGGING|LEGGINGS|PANT|PANTS|TROUSER|TROUSERS|TRACKSUIT|TRACK TOP|TRACK PANT|HOODIE|HOODY|SWEATSHIRT|SWEAT|SHORTS|JERSEY|JACKET|WINDBREAKER|PARKA|GILET|FLEECE|ROMPER|ONESIE|BASE LAYER|MIDLAYER|SHIRT|LS SHIRT|SS SHIRT|POLO SHIRT|T SHIRT)\b/;
      const CLOTHING_KEYWORDS = /\b(CLOTHING|APPAREL|GARMENT|TOP|BOTTOM|KIT|JERSEY|REPLICA|ANTHEM|WARM UP|WINDBREAKER|ANORAK|FLEECE|KNIT|WOVEN|MESH)\b/;

      // ── Accessories indicators ──
      const ACCESSORIES_KEYWORDS = /\b(BAG|BAGS|BALL|BALLS|TOWEL|TOWELS|BOTTLE|BOTTLES|SHIN|SHIN GUARD|SHIN PAD|SHINGUARD|GLOVE|GLOVES|CAP|CAPS|HAT|HATS|SCARF|SCARVES|BEANIE|BEANIES|HEADBAND|WRISTBAND|ARMBAND|SOCK|SOCKS|ANKLE SOCK|CREW SOCK|PROTECTOR|WATER BOTTLE|GYMSACK|GYM SACK|GYM BAG|BACKPACK|DUFFEL|DUFFLE|RUCKSACK|TEAM BAG|HOLDALL|WASHBAG|KEYRING|LANYARD|PENCIL CASE|WALLET|PURSE|WATCH|SUNGLASSES|BELT|STUD|STUDS|LACE|LACES|INSOLE|SHIN SOCK)\b/;

      // ── Team / Country abbreviations → subcategory ──
      const TEAM_MAP = {
        "FFR": "France Rugby", "RFU": "England Rugby", "WRU": "Wales Rugby",
        "SRU": "Scotland Rugby", "IRFU": "Ireland Rugby", "NZRU": "New Zealand Rugby",
        "SARU": "South Africa Rugby", "ARU": "Australia Rugby",
        "ALL BLACKS": "New Zealand Rugby", "SPRINGBOK": "South Africa Rugby",
        "WALLABIES": "Australia Rugby", "LES BLEUS": "France Rugby",
        "MUFC": "Manchester United", "MUFC ": "Manchester United",
        "AFC": "Arsenal", "ARSENAL": "Arsenal",
        "JUVE": "Juventus", "JUVENTUS": "Juventus",
        "REAL MADRID": "Real Madrid", "RMCF": "Real Madrid",
        "BAYERN": "Bayern Munich", "FCB": "Bayern Munich",
        "MANCHESTER UNITED": "Manchester United",
        "MANCHESTER UTD": "Manchester United",
        "MAN UTD": "Manchester United", "MAN UNITED": "Manchester United",
        "CHELSEA": "Chelsea", "CFC": "Chelsea",
        "LIVERPOOL": "Liverpool", "LFC": "Liverpool",
        "TOTTENHAM": "Tottenham", "SPURS": "Tottenham", "THFC": "Tottenham",
        "LEICESTER": "Leicester",
        "CELTIC": "Celtic", "RANGERS": "Rangers",
        "BENFICA": "Benfica", "AJAX": "Ajax",
      };

      // ── Sport detection for subcategory ──
      const SPORT_MAP = {
        "RUGBY": "Rugby", "FOOTBALL": "Football", "SOCCER": "Football",
        "TENNIS": "Tennis", "GOLF": "Golf", "RUNNING": "Running",
        "BASKETBALL": "Basketball", "CRICKET": "Cricket",
        "HOCKEY": "Hockey", "NETBALL": "Netball", "BOXING": "Boxing",
        "SWIMMING": "Swimming", "GYM": "Training", "TRAINING": "Training",
        "YOGA": "Yoga", "FITNESS": "Training", "OUTDOOR": "Outdoor",
        "HIKING": "Outdoor", "TRAIL": "Outdoor",
      };

      // ── Step 0: Licensed Team Clothing detection (#4) ──
      // Check BEFORE general category assignment — takes priority
      const upperType = (row.type ? String(row.type).trim() : "").toUpperCase();
      const upperColor = (productData.color || "").toUpperCase();
      let isLicensedTeam = false;

      // Rule 1: TEAM_MAP match in name/desc/sku
      for (const key of Object.keys(TEAM_MAP)) {
        if (combined.includes(key)) { isLicensedTeam = true; break; }
      }
      // Rule 2: JSY abbreviation (adidas jersey code)
      if (!isLicensedTeam && /\bJSY\b/.test(combined)) isLicensedTeam = true;
      // Rule 3: "Football Shirts" in Type column
      if (!isLicensedTeam && /FOOTBALL SHIRT/i.test(upperType)) isLicensedTeam = true;
      // Rule 4: REPLICA keyword in name/desc/color
      if (!isLicensedTeam && /\bREPLICA\b/.test(`${combined} ${upperColor}`)) isLicensedTeam = true;

      if (isLicensedTeam) {
        productData.category = "LICENSED TEAM CLOTHING";
        // Keep subcategory from TEAM_MAP if not already set
        if (!productData.subcategory) {
          for (const [key, subcat] of Object.entries(TEAM_MAP)) {
            if (combined.includes(key)) {
              productData.subcategory = subcat;
              break;
            }
          }
        }
      }

      // ── Step 0b: B Grade detection — brand contains "B grade" ──
      const upperBrand = (productData.brand || "").toUpperCase();
      if (!isLicensedTeam && /\bB[\s-]*GRADE\b/i.test(upperBrand)) {
        productData.category = "B GRADE";
        // Clean brand: remove "B grade" suffix to keep just the actual brand
        productData.brand = productData.brand.replace(/\s*B[\s-]*grade\s*/i, "").trim() || productData.brand;
      }

      // ── Step 1: Auto-assign category if missing or only gender ──
      const isGenderOnly = /^(MENS?|WOMENS?|WOMEN|FEMALE|LADIES|JUNIOR|JUNIORS|KIDS|YOUTH|BOYS?|GIRLS?|UNISEX|INFANT|BABY|TODDLER)$/i.test(catUpper);
      if (!isLicensedTeam && (!catUpper || isGenderOnly)) {
        if (FOOTWEAR_MODELS.test(combined) || FOOTWEAR_STUDS.test(combined) || FOOTWEAR_KEYWORDS.test(combined)) {
          productData.category = "FOOTWEAR";
        } else if (ACCESSORIES_KEYWORDS.test(combined)) {
          productData.category = "ACCESSORIES";
        } else if (CLOTHING_ABBREVS.test(combined) || CLOTHING_KEYWORDS.test(combined)) {
          productData.category = "CLOTHING";
        } else {
          // Default: if we truly can't tell, mark as CLOTHING (largest group)
          productData.category = productData.category || "CLOTHING";
        }
      }

      // ── Step 2: Auto-assign subcategory if missing ──

      // 2a. Footwear-specific subcategories (matches nav menu)
      if (!productData.subcategory && productData.category === "FOOTWEAR") {
        if (FOOTWEAR_STUDS.test(combined) || /\b(NEMEZIZ|COPA|PREDATOR|SPEEDFLOW|SOCCER SHOE|FOOTBALL BOOT|X SPEEDPORTAL|X CRAZYFAST|PREDSTRIKE)\b/.test(combined)) {
          productData.subcategory = "Football Boots";
        } else if (/\b(RUGBY|KAKARI|MALICE|FLANKER)\b/.test(combined)) {
          productData.subcategory = "Rugby Boots";
        } else if (/\b(GOLF|CODECHAOS|ZG21|TOUR360|S2G|SOLARMOTION|REBELCROSS)\b/.test(combined)) {
          productData.subcategory = "Golf Shoes";
        } else if (/\b(TENNIS|PADEL|BARRICADE|COURTJAM|SOLEMATCH|GAMECOURT|COURTFLASH|DEFIANT)\b/.test(combined)) {
          productData.subcategory = "Tennis / Padel Shoes";
        } else if (/\b(SLIDE|SLIDES|SANDAL|SANDALS|FLIP FLOP|FLIP FLOPS|SHOWER|ADILETTE|COMFORT SLIDE)\b/.test(combined)) {
          productData.subcategory = "Beach Footwear";
        } else if (/\b(TERREX|HIKING|TRAIL|OUTDOOR|WALKING)\b/.test(combined)) {
          productData.subcategory = "Specialist Footwear";
        } else {
          productData.subcategory = "Trainers";
        }
      }

      // 2b. Clothing-specific subcategories (matches nav menu)
      if (!productData.subcategory && productData.category === "CLOTHING") {
        if (/\b(JSY|JERSEY|SHIRT|POLO|TEE|T-SHIRT|T SHIRT|SS TEE|LS TEE|GRAPHIC TEE|TOP|CROP TOP|TANK)\b/.test(combined)) {
          productData.subcategory = "Shirts";
        } else if (/\bSHO\b|\b(SHORTS|SHORT)\b/.test(combined)) {
          productData.subcategory = "Shorts";
        } else if (/\b(JKT|JACKET|COAT|PARKA|WINDBREAKER|ANORAK|GILLET|GILET|PADDED|BOMBER)\b/.test(combined)) {
          productData.subcategory = "Jackets & Coats";
        } else if (/\b(HOOD|HOODIE|HOODY|SWEAT|SWT|CREW SWEAT|PULLOVER|FLEECE)\b|\bHD\b/.test(combined)) {
          productData.subcategory = "Hoods & Sweaters";
        } else if (/\b(SOCK|SOCKS|GLOVE|GLOVES)\b/.test(combined)) {
          productData.subcategory = "Socks & Gloves";
        } else if (/\b(HAT|HATS|CAP|CAPS|BEANIE|HEADBAND|HEADWEAR)\b/.test(combined)) {
          productData.subcategory = "Hats & Caps";
        } else if (/\b(TRACKSUIT|JOGGER|JOGGERS|TRACK PANT|TRACK PANTS|TRG PNT|TRK PNT|PANTS|PES JKT|FIREBIRD)\b|\bPT\b|\bTT\b/.test(combined)) {
          productData.subcategory = "Tracksuits & Joggers";
        } else if (/\b(SWIM|BIKINI|SWIMMING|SWIM SHORT)\b/.test(combined)) {
          productData.subcategory = "Swimwear";
        } else if (/\b(LEGGING|LEGGINGS|TIGHT|TIGHTS)\b/.test(combined)) {
          productData.subcategory = "Leggings";
        } else if (/\b(VEST|BRA|BRAS|CROP)\b/.test(combined)) {
          productData.subcategory = "Vests & Bras";
        } else {
          productData.subcategory = "Shirts"; // default clothing subcategory
        }
      }

      // 2c. Accessories-specific subcategories (matches nav menu)
      if (!productData.subcategory && productData.category === "ACCESSORIES") {
        if (/\b(BALL|BALLS|FOOTBALL|MATCH BALL|TRAINING BALL)\b/.test(combined)) {
          productData.subcategory = "Balls";
        } else if (/\b(BAG|BAGS|BACKPACK|HOLDALL|DUFFEL|RUCKSACK|GYMSACK|GYM SACK|TOTE)\b/.test(combined)) {
          productData.subcategory = "Bags & Holdalls";
        } else if (/\b(HAT|HATS|CAP|CAPS|BEANIE|HEADBAND|HEADWEAR)\b/.test(combined)) {
          productData.subcategory = "Headwear";
        } else if (/\b(GLOVE|GLOVES|GOALKEEPER|GK)\b/.test(combined)) {
          productData.subcategory = "Gloves";
        } else if (/\b(RACKET|BAT|RACQUET|PADDLE)\b/.test(combined)) {
          productData.subcategory = "Rackets & Bats";
        } else if (/\b(TOWEL|TOWELS)\b/.test(combined)) {
          productData.subcategory = "Sports Towels";
        } else if (/\b(SHIN|GUARD|GUARDS|PAD|PADS|PROTECTIVE|ANKLE)\b/.test(combined)) {
          productData.subcategory = "Protective Gear";
        } else if (/\b(SUNGLASS|SUNGLASSES|EYEWEAR)\b/.test(combined)) {
          productData.subcategory = "Sunglasses";
        } else if (/\b(WATCH|MONITOR|TRACKER|FITNESS BAND)\b/.test(combined)) {
          productData.subcategory = "Watches Monitors";
        } else if (/\b(SOCK|SOCKS)\b/.test(combined)) {
          productData.subcategory = "Socks & Gloves"; // socks in accessories go here
        } else if (/\b(BOTTLE|WATER)\b/.test(combined)) {
          productData.subcategory = "Bags & Holdalls"; // bottles grouped with bags
        }
      }

      if (!productData.subcategory) {
        // Check for team/country first (most specific)
        for (const [key, subcat] of Object.entries(TEAM_MAP)) {
          if (combined.includes(key)) {
            productData.subcategory = subcat;
            break;
          }
        }
      }

      productData.subcategory = normalizeImportedSubcategory(
        productData.category,
        productData.subcategory,
        productData.name,
        productData.description,
      );
      if (!productData.subcategory) {
        // Check for sport keywords
        for (const [key, subcat] of Object.entries(SPORT_MAP)) {
          const re = new RegExp(`\\b${key}\\b`);
          if (re.test(combined)) {
            productData.subcategory = subcat;
            break;
          }
        }
      }
      if (!productData.subcategory) {
        // Fallback: detect from category if it's a sport name
        const catWord = catUpper.replace(/^(MENS?|WOMENS?|JUNIOR|KIDS)\s*/i, "").trim();
        if (SPORT_MAP[catWord]) {
          productData.subcategory = SPORT_MAP[catWord];
        }
      }

      productData.categoryCanonical = deriveCategoryCanonical(productData.category);
      productData.subcategoryCanonical = deriveSubcategoryCanonical(
        productData.categoryCanonical || productData.category,
        productData.subcategory,
      );
      productData.sportCanonical = deriveSportCanonical({
        name: productData.name,
        description: productData.description,
        category: productData.category,
        subcategory: productData.subcategory,
      });
      productData.genderCanonical = deriveGenderCanonical({
        rawGender: row.gender || originalCategoryValue,
        sku,
        name: productData.name,
        description: productData.description,
        category: productData.category,
        subcategory: productData.subcategory,
        sizes: productData.sizes,
        hadNegativeSizes: !!row._hadNegativeSizes,
      });
      productData.brandCanonical = deriveBrandCanonical(productData.brand);

      // ── Image URL: store only direct image URLs ──
      // Google/Bing search URLs saved to _pendingImageQuery for auto-resolution
      // IMPORTANT: Do NOT set imageUrl to "" — it would overwrite images uploaded via ZIP
      const rawImageUrl = row.imageUrl ? String(row.imageUrl).trim() : "";
      if (isDirectImageUrl(rawImageUrl)) {
        productData.imageUrl = rawImageUrl;
      } else if (isValidImageUrl(rawImageUrl)) {
        // HTTP URL but not a direct image (Google search link) — queue for resolution
        // Don't touch imageUrl — preserve any existing Cloudinary image
        productData._pendingImageQuery = rawImageUrl;
        if (i < 5) {
          debug(
            `[IMPORT] Row ${i + 1} imageUrl queued for auto-resolution: "${rawImageUrl.substring(0, 80)}"`,
          );
        }
      } else {
        // No valid image in Excel — do NOT overwrite existing imageUrl
        if (rawImageUrl && i < 5) {
          debug(
            `[IMPORT] Row ${i + 1} imageUrl is not a valid URL: "${rawImageUrl}" — use ZIP image upload`,
          );
        }
      }

      // Track products that need image resolution (for post-import phase)
      if (productData._pendingImageQuery) {
        pendingImageProducts.push({
          sku: productData.sku,
          brand: productData.brand,
          name: productData.name,
          currentUrl: productData._pendingImageQuery,
        });
        delete productData._pendingImageQuery;
      }

      // Separate image fields — only $set them when Excel provides a valid URL
      // Otherwise use $setOnInsert so existing images survive re-imports
      const hasExcelImage = !!productData.imageUrl;
      const imageFields = {};
      if (hasExcelImage) {
        imageFields.imageUrl = productData.imageUrl;
      }
      delete productData.imageUrl; // remove from main $set

      const updateOp = { $set: productData };
      if (!hasExcelImage) {
        // Only set imageUrl on brand-new products (upsert insert)
        updateOp.$setOnInsert = { imageUrl: "", imagePublicId: "" };
      } else {
        // Excel provided a valid direct image URL — overwrite
        updateOp.$set.imageUrl = imageFields.imageUrl;
      }

      operations.push({
        updateOne: {
          filter: { sku },
          update: updateOp,
          upsert: true,
        },
      });
    }

    // ── Execute in bulk batches ──
    debug(
      `[IMPORT] Executing ${operations.length} operations in batches of ${BATCH_SIZE}`,
    );
    for (let i = 0; i < operations.length; i += BATCH_SIZE) {
      const chunk = operations.slice(i, i + BATCH_SIZE);
      const result = await Product.bulkWrite(chunk, { ordered: false });
      imported += result.upsertedCount || 0;
      updated += result.modifiedCount || 0;
      debug(
        `[IMPORT] Batch ${Math.floor(i / BATCH_SIZE) + 1}: upserted=${result.upsertedCount || 0}, modified=${result.modifiedCount || 0}`,
      );
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    // ── Post-import: auto-resolve images from Google search URLs (async, non-blocking) ──
    let imageResolved = 0;
    let imageFailed = 0;
    if (pendingImageProducts.length > 0) {
      debug(
        `[IMPORT] Starting auto image resolution for ${pendingImageProducts.length} products...`,
      );
      // Resolve up to 50 images during import (rest handled by /resolve-images endpoint)
      const batch50 = pendingImageProducts.slice(0, 50);
      try {
        const { resolved, failed: imgFailed } = await batchResolveImages(
          batch50,
          3,
          (r, f, t) => {
            if ((r + f) % 10 === 0)
              debug(
                `[IMAGE-RESOLVE] Progress: ${r} resolved, ${f} failed of ${t}`,
              );
          },
        );
        imageResolved = resolved.length;
        imageFailed = imgFailed.length;

        // Update resolved products in DB
        if (resolved.length > 0) {
          const imgOps = resolved.map((r) => ({
            updateOne: {
              filter: { sku: r.sku },
              update: { $set: { imageUrl: r.imageUrl } },
            },
          }));
          await Product.bulkWrite(imgOps, { ordered: false });
          debug(`[IMPORT] Auto-resolved ${resolved.length} product images`);
        }
        if (imgFailed.length > 0) {
          debug(
            `[IMPORT] Image resolution failed for ${imgFailed.length} products (first 5):`,
            imgFailed.slice(0, 5).map((f) => `${f.sku}: ${f.reason}`),
          );
        }
        if (pendingImageProducts.length > 50) {
          debug(
            `[IMPORT] ${pendingImageProducts.length - 50} products still need image resolution — use POST /api/admin/resolve-images`,
          );
        }
      } catch (imgErr) {
        console.error("[IMPORT] Image auto-resolution error:", imgErr.message);
      }
    }

    // Log import summary
    debug(
      `[IMPORT] Complete: ${imported} inserted, ${updated} updated, ${failed} failed, ${imageResolved} images resolved in ${elapsed}s`,
    );
    if (errors.length > 0) {
      debug(
        `[IMPORT] Failed rows (first 10):`,
        JSON.stringify(errors.slice(0, 10), null, 2),
      );
    }

    // Update batch record
    batch.totalRows = rows.length;
    batch.importedRows = imported;
    batch.updatedRows = updated;
    batch.failedRows = failed;
    batch.errorLog = errors;
    batch.status = "complete";
    await batch.save();

    cleanup(filePath);

    res.json({
      success: true,
      batchId: batch._id,
      totalRawRows: rows.length,
      consolidatedProducts: consolidated.length,
      duplicateSkuGroupsInUpload,
      duplicateRowsMerged,
      imported,
      updated,
      failed,
      warnings,
      warningDetails: warningDetails.slice(0, 50),
      imageResolved,
      imageFailed,
      imagePending: Math.max(0, pendingImageProducts.length - 50),
      errors: errors.slice(0, 50),
      headers,
      mapping,
      unmappedHeaders,
      sheetSummary,
      categoriesCreated: createdCategories,
      executionTime: `${elapsed}s`,
    });
  } catch (err) {
    console.error("Import error:", err);
    if (batch) {
      batch.status = "failed";
      batch.errorLog.push({ row: 0, sku: "", reason: err.message });
      await batch.save().catch(() => {});
    }
    cleanup(filePath);
    res.status(500).json({ error: `Import failed: ${err.message}` });
  }
};

/**
 * POST /api/admin/upload-images
 * Accept a ZIP of images. Filenames must match product SKUs.
 * Responds immediately with a jobId, processes in background.
 */

// In-memory job tracker
const imageJobs = new Map();

exports.uploadImages = async (req, res) => {
  const filePath = req.file?.path;

  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const ALLOWED_IMG = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);

    let imagesToProcess = [];
    let tempExtractDir = null;

    if (ext === ".zip") {
      const zip = new AdmZip(filePath);
      const entries = zip.getEntries();
      tempExtractDir = path.join(path.dirname(filePath), `images-${Date.now()}`);
      fs.mkdirSync(tempExtractDir, { recursive: true });

      for (const entry of entries) {
        if (entry.isDirectory) continue;
        const filename = path.basename(entry.entryName);
        if (filename.startsWith(".") || filename.startsWith("__")) continue;
        const imgExt = path.extname(filename).toLowerCase();
        if (!ALLOWED_IMG.has(imgExt)) continue;

        const outPath = path.join(tempExtractDir, filename);
        fs.writeFileSync(outPath, entry.getData());
        imagesToProcess.push({
          path: outPath,
          filename,
          stem: path.basename(filename, imgExt).trim().toUpperCase(),
        });
      }
    } else if (ALLOWED_IMG.has(ext)) {
      imagesToProcess.push({
        path: filePath,
        filename: req.file.originalname,
        stem: path.basename(req.file.originalname, ext).trim().toUpperCase(),
      });
    } else {
      cleanup(filePath);
      return res
        .status(400)
        .json({ error: "Upload a .zip archive or an image file." });
    }

    if (imagesToProcess.length === 0) {
      cleanup(filePath);
      return res.status(400).json({ error: "No valid image files found in the archive." });
    }

    // For small batches (≤20 images), process synchronously and return result directly
    if (imagesToProcess.length <= 20) {
      const result = await processImageBatch(imagesToProcess, filePath, tempExtractDir);
      return res.json(result);
    }

    // For large batches, respond immediately and process in background
    const jobId = `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const job = {
      id: jobId,
      status: "processing",
      total: imagesToProcess.length,
      processed: 0,
      matched: 0,
      unmatched: 0,
      errors: [],
      unmatchedFiles: [],
      startedAt: new Date(),
    };
    imageJobs.set(jobId, job);

    // Respond immediately
    res.json({
      jobId,
      status: "processing",
      total: imagesToProcess.length,
      message: `Processing ${imagesToProcess.length} images in the background. Poll /api/admin/image-upload-status/${jobId} for progress.`,
    });

    // Process in background (fire-and-forget)
    processImageBatch(imagesToProcess, filePath, tempExtractDir, job)
      .then((result) => {
        job.status = "complete";
        job.matched = result.matched;
        job.unmatched = result.unmatched;
        job.errors = result.errors;
        job.unmatchedFiles = result.unmatchedFiles;
        job.completedAt = new Date();
        console.log(`[IMAGE JOB ${jobId}] Complete — ${result.matched} matched, ${result.unmatched} unmatched, ${result.errors.length} errors`);
        // Auto-cleanup job data after 1 hour
        setTimeout(() => imageJobs.delete(jobId), 3600000);
      })
      .catch((err) => {
        job.status = "failed";
        job.errors.push(err.message);
        console.error(`[IMAGE JOB ${jobId}] Failed:`, err.message);
        setTimeout(() => imageJobs.delete(jobId), 3600000);
      });

  } catch (err) {
    console.error("Image upload error:", err);
    cleanup(filePath);
    res.status(500).json({ error: `Image processing failed: ${err.message}` });
  }
};

/**
 * Process a batch of images — shared by sync and async paths.
 * If `job` is provided, updates progress in real-time.
 */
async function processImageBatch(imagesToProcess, filePath, tempExtractDir, job = null) {
  // Pre-fetch all SKUs into memory for O(1) lookups
  const allProducts = await Product.find({}, "sku imagePublicId").lean();
  const skuMap = new Map();
  const cleanSkuMap = new Map();
  for (const p of allProducts) {
    const upper = p.sku.toUpperCase();
    skuMap.set(upper, p);
    cleanSkuMap.set(upper.replace(/[\s_-]/g, ""), p);
  }

  let matched = 0;
  let unmatched = 0;
  const unmatchedFiles = [];
  const errors = [];

  const cName = process.env.CLOUDINARY_CLOUD_NAME || "";
  const cloudinaryEnabled = !!cName && cName !== "your_cloud_name";
  const BATCH_SIZE = 10;
  const bulkOps = [];

  for (let i = 0; i < imagesToProcess.length; i += BATCH_SIZE) {
    const batch = imagesToProcess.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (img) => {
        let product = skuMap.get(img.stem);
        // Try splitting on dash (e.g. "GK5757-001" → "GK5757")
        if (!product && img.stem.includes("-")) {
          product = skuMap.get(img.stem.split("-")[0]);
        }
        // Try stripping spaces/underscores/dashes
        if (!product) {
          const cleanStem = img.stem.replace(/[\s_-]/g, "");
          product = cleanSkuMap.get(cleanStem);
        }
        // Try stripping trailing letters (e.g. "DH2860B" → "DH2860", "JP3701B" → "JP3701")
        if (!product) {
          const baseStem = img.stem.replace(/[A-Z]+$/i, "");
          if (baseStem !== img.stem) {
            product = skuMap.get(baseStem) || cleanSkuMap.get(baseStem.replace(/[\s_-]/g, ""));
          }
        }
        if (!product) {
          return { status: "unmatched", filename: img.filename, stem: img.stem };
        }

        let imageUrl = "";
        let imagePublicId = "";

        if (cloudinaryEnabled) {
          if (product.imagePublicId) {
            await cloudinary.uploader.destroy(product.imagePublicId).catch(() => {});
          }
          const upload = await cloudinary.uploader.upload(img.path, {
            folder: "oxford-sports/products",
            public_id: product.sku,
            overwrite: true,
          });
          imageUrl = upload.secure_url;
          imagePublicId = upload.public_id;
        } else {
          const uploadsDir = path.join(__dirname, "..", "uploads", "products");
          fs.mkdirSync(uploadsDir, { recursive: true });
          const destFilename = `${product.sku}${path.extname(img.filename)}`;
          fs.copyFileSync(img.path, path.join(uploadsDir, destFilename));
          imageUrl = `/uploads/products/${destFilename}`;
        }

        return { status: "matched", sku: product.sku, imageUrl, imagePublicId };
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled") {
        const val = r.value;
        if (val.status === "matched") {
          matched++;
          const updateFields = { imageUrl: val.imageUrl };
          if (val.imagePublicId) updateFields.imagePublicId = val.imagePublicId;
          bulkOps.push({
            updateOne: {
              filter: { sku: val.sku },
              update: { $set: updateFields },
            },
          });
        } else {
          unmatched++;
          unmatchedFiles.push(val.filename);
        }
      } else {
        const imgFile = batch[results.indexOf(r)]?.filename || "unknown";
        errors.push(`${imgFile}: ${r.reason?.message || "upload failed"}`);
      }
    }

    // Update job progress if tracking
    if (job) {
      job.processed = Math.min(i + BATCH_SIZE, imagesToProcess.length);
      job.matched = matched;
      job.unmatched = unmatched;
    }

    // Flush bulk ops every 100
    if (bulkOps.length >= 100) {
      await Product.bulkWrite(bulkOps).catch((e) =>
        console.error("[IMAGE] bulkWrite error:", e.message)
      );
      bulkOps.length = 0;
    }
  }

  if (bulkOps.length > 0) {
    await Product.bulkWrite(bulkOps).catch((e) =>
      console.error("[IMAGE] bulkWrite error:", e.message)
    );
  }

  // Cleanup
  cleanup(filePath);
  if (tempExtractDir && fs.existsSync(tempExtractDir)) {
    fs.rmSync(tempExtractDir, { recursive: true, force: true });
  }

  return { matched, unmatched, unmatchedFiles, errors };
}

/**
 * GET /api/admin/image-upload-status/:jobId
 * Poll for background image upload progress.
 */
exports.getImageUploadStatus = (_req, res) => {
  const { jobId } = _req.params;
  const job = imageJobs.get(jobId);
  if (!job) {
    return res.status(404).json({ error: "Job not found or expired." });
  }
  res.json({
    jobId: job.id,
    status: job.status,
    total: job.total,
    processed: job.processed,
    matched: job.matched,
    unmatched: job.unmatched,
    errors: job.errors,
    unmatchedFiles: job.status === "complete" ? job.unmatchedFiles : [],
    percent: job.total > 0 ? Math.round((job.processed / job.total) * 100) : 0,
  });
};

/**
 * GET /api/admin/import-batches
 * Return recent import batch history.
 */
exports.getImportBatches = async (_req, res) => {
  try {
    const batches = await ImportBatch.find({})
      .sort({ createdAt: -1 })
      .limit(20)
      .populate("importedBy", "name email")
      .lean();

    res.json({ batches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/admin/resolve-images
 * Batch-resolve images for all products that have empty imageUrl.
 * Attempts auto-resolution from brand + SKU + name via web image search.
 * Query params: ?limit=100&concurrency=3
 */
exports.resolveImages = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query?.limit) || 100, 500);
    const concurrency = Math.min(parseInt(req.query?.concurrency) || 3, 5);

    // Find products without images
    const products = await Product.find({
      $or: [{ imageUrl: "" }, { imageUrl: { $exists: false } }],
      isActive: true,
    })
      .select("sku brand name imageUrl")
      .limit(limit)
      .lean();

    if (products.length === 0) {
      return res.json({
        success: true,
        message: "All products already have images.",
        resolved: 0,
        failed: 0,
        remaining: 0,
      });
    }

    debug(
      `[RESOLVE-IMAGES] Starting resolution for ${products.length} products (concurrency: ${concurrency})`,
    );

    const toResolve = products.map((p) => ({
      sku: p.sku,
      brand: p.brand || "",
      name: p.name || "",
      currentUrl: "",
    }));

    const { resolved, failed } = await batchResolveImages(
      toResolve,
      concurrency,
      (r, f, t) => {
        if ((r + f) % 10 === 0)
          debug(
            `[RESOLVE-IMAGES] Progress: ${r} resolved, ${f} failed of ${t}`,
          );
      },
    );

    // Update resolved products in DB
    if (resolved.length > 0) {
      const ops = resolved.map((r) => ({
        updateOne: {
          filter: { sku: r.sku },
          update: { $set: { imageUrl: r.imageUrl } },
        },
      }));
      await Product.bulkWrite(ops, { ordered: false });
    }

    // Count remaining products without images
    const remaining = await Product.countDocuments({
      $or: [{ imageUrl: "" }, { imageUrl: { $exists: false } }],
      isActive: true,
    });

    debug(
      `[RESOLVE-IMAGES] Done: ${resolved.length} resolved, ${failed.length} failed, ${remaining} remaining`,
    );

    res.json({
      success: true,
      resolved: resolved.length,
      failed: failed.length,
      failedSkus: failed.slice(0, 20),
      remaining,
      resolvedSkus: resolved.slice(0, 20).map((r) => ({
        sku: r.sku,
        imageUrl: r.imageUrl.substring(0, 100),
      })),
    });
  } catch (err) {
    console.error("[RESOLVE-IMAGES] Error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/admin/fix-prices
 * One-time migration: re-reads the Excel file mapping and fixes products
 * that have price=0 in MongoDB by copying rrp to price as fallback,
 * OR preferably re-importing from the Excel SALE column.
 *
 * This is a safety net for products imported before the SALE column fix.
 */
exports.fixPrices = async (req, res) => {
  try {
    // Find all products with salePrice = 0 that have rrp > 0
    const zeroPrice = await Product.find({
      salePrice: 0,
      rrp: { $gt: 0 },
      isActive: true,
    }).lean();

    if (zeroPrice.length === 0) {
      return res.json({
        success: true,
        message: "No products with salePrice=0 found. All prices are correct.",
        fixed: 0,
      });
    }

    // For these products, we set salePrice = rrp as a fallback
    const ops = zeroPrice.map((p) => ({
      updateOne: {
        filter: { _id: p._id },
        update: { $set: { salePrice: p.rrp } },
      },
    }));

    const result = await Product.bulkWrite(ops, { ordered: false });

    res.json({
      success: true,
      found: zeroPrice.length,
      fixed: result.modifiedCount,
      message: `Set salePrice = rrp for ${result.modifiedCount} products. Re-import Excel for correct sale prices.`,
      sampleFixed: zeroPrice.slice(0, 10).map((p) => ({
        sku: p.sku,
        oldPrice: p.salePrice,
        newPrice: p.rrp,
        rrp: p.rrp,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Helper to remove temp files silently ──
function cleanup(filePath) {
  if (filePath) {
    try {
      fs.unlinkSync(filePath);
    } catch {}
  }
}
