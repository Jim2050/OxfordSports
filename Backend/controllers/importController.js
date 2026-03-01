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
    "trade",
    "trade price",
    "trade (£)",
    "trade price (£)",
    "wholesale price",
    "our price",
    "price",
    "unit price",
    "cost",
    "sell price",
    "sale",
    "sale price",
    "sale (£)",
    "price (£)",
    "price gbp",
    "gbp",
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
    const priceH = headers.find((h) => /trade|price|cost|sale|£|gbp/i.test(h));
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

  return { mapping, unmappedHeaders };
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

      // Fallback: if Trade mapped to price but was empty, try raw "Price" column
      if (
        (row.price === "" || row.price === undefined || row.price === null) &&
        raw.Price !== undefined &&
        raw.Price !== ""
      ) {
        row._rawPrice = raw.Price;
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
    // Split comma-separated sizes (e.g. "8, 9, 10")
    const rowSizes = rawSize
      ? rawSize
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    if (skuMap.has(sku)) {
      const existing = skuMap.get(sku);

      // Merge sizes with quantities
      if (rowSizes.length > 0) {
        for (const s of rowSizes) {
          const found = existing.sizeEntries.find((e) => e.size === s);
          if (found) {
            found.quantity += rowQty;
          } else {
            existing.sizeEntries.push({ size: s, quantity: rowQty });
          }
        }
      } else if (!rawSize && rowQty > 0) {
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

      if (rowSizes.length > 0) {
        for (const s of rowSizes) {
          const found = sizeEntries.find((e) => e.size === s);
          if (found) {
            found.quantity += rowQty;
          } else {
            sizeEntries.push({ size: s, quantity: rowQty });
          }
        }
      } else if (rowQty > 0) {
        // No explicit size column value
        sizeEntries.push({ size: "ONE SIZE", quantity: rowQty });
      }

      skuMap.set(sku, {
        ...row,
        sku,
        sizeEntries,
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

    // ── Consolidate same-SKU rows (size merging) ──
    const consolidated = consolidateBySku(rows);
    debug(
      `[IMPORT] Consolidated ${rows.length} rows → ${consolidated.length} unique products`,
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
    const distinctCategories = [
      ...new Set(
        consolidated
          .map((r) => (r.category ? String(r.category).trim() : ""))
          .filter(Boolean),
      ),
    ];
    const createdCategories = await ensureCategories(distinctCategories);

    let imported = 0;
    let updated = 0;
    let failed = 0;
    const errors = [];
    const pendingImageProducts = [];

    // ── Process in batches of 500 for memory efficiency ──
    const BATCH_SIZE = 500;
    const operations = [];

    for (let i = 0; i < consolidated.length; i++) {
      const row = consolidated[i];
      const sku = row.sku;

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

      // Name: use style/style desc, fall back to SKU
      let name = row.name ? String(row.name).trim() : "";
      if (!name) {
        // Use SKU + color as fallback name
        const color = row.color ? String(row.color).trim() : "";
        name = color ? `${sku} - ${color}` : sku;
      }

      // ── Parse price using safe utility ──
      let rawPrice = row.price;
      if (rawPrice === "" || rawPrice === undefined || rawPrice === null) {
        rawPrice = row._rawPrice;
      }
      const priceResult = parsePrice(rawPrice);
      if (priceResult.error && priceResult.value === null) {
        // Price is missing or invalid — reject row, do NOT default to 0
        failed++;
        errors.push({
          row: i + 1,
          sku,
          reason: `Invalid price: ${priceResult.error} (raw: "${rawPrice}")`,
        });
        continue;
      }
      const price = priceResult.value;

      const rrpResult = parsePrice(row.rrp);
      const rrp = rrpResult.value || 0;

      const productData = {
        sku,
        name,
        description: row.description ? String(row.description).trim() : "",
        category: row.category ? String(row.category).trim() : "",
        subcategory: row.subcategory ? String(row.subcategory).trim() : "",
        brand: row.brand ? String(row.brand).trim() : brandDefault, // fallback to workbook-wide brand (e.g. "adidas")
        color: row.color ? String(row.color).trim() : "",
        barcode: (row.barcodes || []).join(", "),
        salePrice: price,
        rrp,
        sizes: row.sizeEntries || [],
        totalQuantity: (row.sizeEntries || []).reduce(
          (sum, s) => sum + (s.quantity || 0),
          0,
        ),
        sheetName: row._sheetName || "",
        isActive: true,
      };

      // ── Auto-detect sport from product name → populate subcategory ──
      // This allows Rugby/Football/Footwear pages to filter correctly
      // even when Excel only has Gender (Mens/Womens) in the category column.
      if (!productData.subcategory) {
        const lowerName = (name + " " + productData.description).toLowerCase();
        if (/rugby/.test(lowerName)) {
          productData.subcategory = "Rugby";
        } else if (
          /\bfootball\b|soccer|\bfc\b|\bf\.c\.|premier league|champions league/.test(
            lowerName,
          )
        ) {
          productData.subcategory = "Football";
        } else if (
          /\bboot\b|\bboots\b|\btrainer\b|\btrainers\b|\bshoe\b|\bshoes\b|footwear|sneaker|running/.test(
            lowerName,
          )
        ) {
          productData.subcategory = "Footwear";
        }
      }

      // ── Image URL: store only direct image URLs ──
      // Google/Bing search URLs saved to _pendingImageQuery for auto-resolution
      const rawImageUrl = row.imageUrl ? String(row.imageUrl).trim() : "";
      if (isDirectImageUrl(rawImageUrl)) {
        productData.imageUrl = rawImageUrl;
      } else if (isValidImageUrl(rawImageUrl)) {
        // HTTP URL but not a direct image (Google search link) — queue for resolution
        productData.imageUrl = "";
        productData._pendingImageQuery = rawImageUrl;
        if (i < 5) {
          debug(
            `[IMPORT] Row ${i + 1} imageUrl queued for auto-resolution: "${rawImageUrl.substring(0, 80)}"`,
          );
        }
      } else {
        productData.imageUrl = "";
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

      operations.push({
        updateOne: {
          filter: { sku },
          update: { $set: productData },
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
      imported,
      updated,
      failed,
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
 * Uploads each to Cloudinary and links to the product.
 */
exports.uploadImages = async (req, res) => {
  const filePath = req.file?.path;

  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const ALLOWED_IMG = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

    let imagesToProcess = [];

    if (ext === ".zip") {
      // ── Extract ZIP ──
      const zip = new AdmZip(filePath);
      const entries = zip.getEntries();
      const tempDir = path.join(path.dirname(filePath), `images-${Date.now()}`);
      fs.mkdirSync(tempDir, { recursive: true });

      for (const entry of entries) {
        if (entry.isDirectory) continue;
        const filename = path.basename(entry.entryName);
        if (filename.startsWith(".") || filename.startsWith("__")) continue;
        const imgExt = path.extname(filename).toLowerCase();
        if (!ALLOWED_IMG.has(imgExt)) continue;

        const outPath = path.join(tempDir, filename);
        fs.writeFileSync(outPath, entry.getData());
        imagesToProcess.push({
          path: outPath,
          filename,
          stem: path.basename(filename, imgExt).trim().toUpperCase(),
        });
      }
    } else if (ALLOWED_IMG.has(ext)) {
      // Single image file
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

    let matched = 0;
    let unmatched = 0;
    const unmatchedFiles = [];
    const errors = [];

    for (const img of imagesToProcess) {
      try {
        // Find product by SKU (exact or partial match)
        let product = await Product.findOne({ sku: img.stem });

        // Try partial match: filename might be "KC0689-BLK" → try stripping suffix
        if (!product && img.stem.includes("-")) {
          const baseSku = img.stem.split("-")[0];
          product = await Product.findOne({ sku: baseSku });
        }

        if (!product) {
          unmatched++;
          unmatchedFiles.push(img.filename);
          continue;
        }

        // Upload to Cloudinary
        let imageUrl = "";
        let imagePublicId = "";

        const cloudinaryEnabled =
          process.env.CLOUDINARY_CLOUD_NAME &&
          process.env.CLOUDINARY_CLOUD_NAME !== "your_cloud_name";

        if (cloudinaryEnabled) {
          // Delete old image if exists
          if (product.imagePublicId) {
            await cloudinary.uploader
              .destroy(product.imagePublicId)
              .catch(() => {});
          }

          const upload = await cloudinary.uploader.upload(img.path, {
            folder: "oxford-sports/products",
            public_id: product.sku,
            overwrite: true,
            transformation: [
              { width: 800, crop: "limit" },
              { quality: "auto", fetch_format: "auto" },
            ],
          });

          imageUrl = upload.secure_url;
          imagePublicId = upload.public_id;
        } else {
          // ── Fallback: save to local /uploads/products/ ──
          const uploadsDir = path.join(__dirname, "..", "uploads", "products");
          fs.mkdirSync(uploadsDir, { recursive: true });
          const destFilename = `${product.sku}${path.extname(img.filename)}`;
          const destPath = path.join(uploadsDir, destFilename);
          fs.copyFileSync(img.path, destPath);
          imageUrl = `/uploads/products/${destFilename}`;
        }

        // Update product
        product.imageUrl = imageUrl;
        if (imagePublicId) product.imagePublicId = imagePublicId;
        await product.save();
        matched++;
        debug(
          `[IMAGE] Matched ${img.filename} → ${product.sku} | URL: ${imageUrl.substring(0, 80)}...`,
        );
      } catch (imgErr) {
        errors.push(`${img.filename}: ${imgErr.message}`);
      }
    }

    // Cleanup temp files
    cleanup(filePath);
    // If ZIP was extracted, cleanup extracted dir
    const tempDir = imagesToProcess[0]?.path
      ? path.dirname(imagesToProcess[0].path)
      : null;
    if (tempDir && tempDir.includes("images-")) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    res.json({ matched, unmatched, unmatchedFiles, errors });
  } catch (err) {
    console.error("Image upload error:", err);
    cleanup(filePath);
    res.status(500).json({ error: `Image processing failed: ${err.message}` });
  }
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
