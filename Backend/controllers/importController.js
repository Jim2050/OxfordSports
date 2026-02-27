const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const AdmZip = require("adm-zip");
const Product = require("../models/Product");
const Category = require("../models/Category");
const ImportBatch = require("../models/ImportBatch");
const cloudinary = require("../config/cloudinary");

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
    "wholesale price",
    "our price",
    "price",
    "unit price",
    "cost",
    "sell price",
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
  brand: ["brand", "manufacturer", "make", "label"],
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
    "filename",
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
 */
function detectMapping(headers) {
  const mapping = {};
  const unmappedHeaders = [];

  for (const raw of headers) {
    const norm = normalizeHeader(raw);
    let matched = false;
    for (const [field, aliases] of Object.entries(COLUMN_MAP)) {
      if (aliases.includes(norm)) {
        // Don't override if already matched (prefer earlier alias match)
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
    const priceH = headers.find((h) => /trade|price|cost|£|gbp/i.test(h));
    if (priceH) mapping.price = priceH;
  }
  if (!mapping.category) {
    const catH = headers.find((h) => /gender|category|department/i.test(h));
    if (catH) mapping.category = catH;
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
 */
function consolidateBySku(rows) {
  const skuMap = new Map();

  for (const row of rows) {
    const sku = row.sku ? String(row.sku).trim().toUpperCase() : "";
    if (!sku) continue;

    if (skuMap.has(sku)) {
      const existing = skuMap.get(sku);
      // Merge size
      const newSize = row.sizes ? String(row.sizes).trim() : "";
      if (newSize && !existing.sizes.includes(newSize)) {
        existing.sizes.push(newSize);
      }
      // Merge barcode
      const newBarcode = row.barcode ? String(row.barcode).trim() : "";
      if (newBarcode && !existing.barcodes.includes(newBarcode)) {
        existing.barcodes.push(newBarcode);
      }
      // Sum quantity
      const qty = parseInt(row.quantity) || 0;
      existing.quantity += qty;
    } else {
      const size = row.sizes ? String(row.sizes).trim() : "";
      const barcode = row.barcode ? String(row.barcode).trim() : "";
      skuMap.set(sku, {
        ...row,
        sku,
        sizes: size ? [size] : [],
        barcodes: barcode ? [barcode] : [],
        quantity: parseInt(row.quantity) || 0,
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
 * Check if an image URL is a real usable URL (not "Google Images" placeholder).
 */
function isValidImageUrl(url) {
  if (!url) return false;
  const s = String(url).trim().toLowerCase();
  if (s === "google images" || s === "google image") return false;
  return s.startsWith("http://") || s.startsWith("https://");
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

    console.log(
      `[IMPORT] Parsed ${rows.length} raw rows from ${sheetSummary.length} sheets`,
    );
    console.log(`[IMPORT] Column mapping:`, JSON.stringify(mapping));
    console.log(
      `[IMPORT] Sheet breakdown:`,
      sheetSummary.map((s) => `${s.name}(${s.rows})`).join(", "),
    );

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
    console.log(
      `[IMPORT] Consolidated ${rows.length} rows → ${consolidated.length} unique products`,
    );

    // Log price fallback usage
    const priceFallbackCount = consolidated.filter(
      (r) => r._rawPrice !== undefined,
    ).length;
    if (priceFallbackCount > 0) {
      console.log(
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

      // Parse prices — prefer Trade, fall back to Price column if Trade is empty
      let rawPrice = row.price;
      if (rawPrice === "" || rawPrice === undefined || rawPrice === null) {
        // Trade was empty — check if the original row has a "Price" column
        rawPrice = row._rawPrice || 0;
      }
      const tradePrice = parseFloat(rawPrice);
      const price = isNaN(tradePrice) || tradePrice < 0 ? 0 : tradePrice;
      const rrpVal = parseFloat(row.rrp);
      const rrp = isNaN(rrpVal) || rrpVal < 0 ? 0 : rrpVal;

      const productData = {
        sku,
        name,
        description: row.description ? String(row.description).trim() : "",
        category: row.category ? String(row.category).trim() : "",
        subcategory: row.subcategory ? String(row.subcategory).trim() : "",
        brand: row.brand ? String(row.brand).trim() : "",
        color: row.color ? String(row.color).trim() : "",
        barcode: (row.barcodes || []).join(", "),
        price,
        rrp,
        sizes: row.sizes || [],
        quantity: row.quantity || 0,
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

      // Only set imageUrl if it's a real URL (not "Google Images" placeholder)
      // Log which rows have image URLs for debugging
      if (isValidImageUrl(row.imageUrl)) {
        productData.imageUrl = String(row.imageUrl).trim();
      } else if (row.imageUrl && String(row.imageUrl).trim()) {
        // Log non-URL image values so admin knows what format the Excel uses
        if (i < 5) {
          console.log(
            `[IMPORT] Row ${i + 1} imageUrl is not a valid URL: "${String(row.imageUrl).trim()}" — use ZIP image upload to attach images`,
          );
        }
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
    console.log(
      `[IMPORT] Executing ${operations.length} operations in batches of ${BATCH_SIZE}`,
    );
    for (let i = 0; i < operations.length; i += BATCH_SIZE) {
      const chunk = operations.slice(i, i + BATCH_SIZE);
      const result = await Product.bulkWrite(chunk, { ordered: false });
      imported += result.upsertedCount || 0;
      updated += result.modifiedCount || 0;
      console.log(
        `[IMPORT] Batch ${Math.floor(i / BATCH_SIZE) + 1}: upserted=${result.upsertedCount || 0}, modified=${result.modifiedCount || 0}`,
      );
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

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
        console.log(
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

// ── Helper to remove temp files silently ──
function cleanup(filePath) {
  if (filePath) {
    try {
      fs.unlinkSync(filePath);
    } catch {}
  }
}
