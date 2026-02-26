const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const AdmZip = require("adm-zip");
const Product = require("../models/Product");
const ImportBatch = require("../models/ImportBatch");
const cloudinary = require("../config/cloudinary");

// ═══════════════════════════════════════════════════════════════
//  COLUMN ALIAS MAP — handles Adidas, Puma, generic price lists
// ═══════════════════════════════════════════════════════════════
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
        mapping[field] = raw;
        matched = true;
        break;
      }
    }
    if (!matched) unmappedHeaders.push(raw);
  }

  // Fallback heuristics for critical fields
  if (!mapping.sku) {
    const skuH = headers.find((h) => /sku|code|article|style|ref/i.test(h));
    if (skuH) mapping.sku = skuH;
  }
  if (!mapping.name) {
    const nameH = headers.find((h) => /name|title|product|item/i.test(h));
    if (nameH && nameH !== mapping.sku) mapping.name = nameH;
  }
  if (!mapping.price) {
    const priceH = headers.find((h) => /price|cost|£|gbp/i.test(h));
    if (priceH) mapping.price = priceH;
  }

  return { mapping, unmappedHeaders };
}

/**
 * Parse an Excel file into mapped row objects.
 */
function parseExcelFile(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  if (rawData.length === 0)
    return { rows: [], headers: [], mapping: {}, unmappedHeaders: [] };

  const headers = Object.keys(rawData[0]);
  const { mapping, unmappedHeaders } = detectMapping(headers);

  const rows = rawData.map((raw) => {
    const row = {};
    for (const [field, col] of Object.entries(mapping)) {
      row[field] = raw[col] !== undefined ? raw[col] : "";
    }
    return row;
  });

  return { rows, headers, mapping, unmappedHeaders };
}

/**
 * POST /api/admin/import-products
 * Accept .xlsx → parse → upsert into MongoDB.
 * Handles 5000+ rows with batch processing.
 */
exports.importProducts = async (req, res) => {
  let batch;
  const filePath = req.file?.path;

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

    // Parse the Excel file
    const { rows, headers, mapping, unmappedHeaders } =
      parseExcelFile(filePath);

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

    let imported = 0;
    let updated = 0;
    let failed = 0;
    const errors = [];

    // ── Process in batches of 500 for memory efficiency ──
    const BATCH_SIZE = 500;
    const operations = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Validate name
      if (!row.name || String(row.name).trim() === "") {
        // If no name mapped, try to use the first non-empty text field
        if (!row.name) {
          failed++;
          errors.push({
            row: i + 2,
            sku: row.sku || null,
            reason: "Missing product name",
          });
          continue;
        }
      }

      // Validate / parse price
      const price = parseFloat(row.price);
      if (isNaN(price) || price < 0) {
        if (row.price === "" || row.price === undefined) {
          // Allow zero price for clearance items
        } else {
          failed++;
          errors.push({
            row: i + 2,
            sku: row.sku || null,
            reason: `Invalid price: ${row.price}`,
          });
          continue;
        }
      }

      // Generate SKU if missing
      const sku = row.sku
        ? String(row.sku).trim().toUpperCase()
        : `AUTO-${Date.now()}-${i}`;

      const productData = {
        sku,
        name: String(row.name).trim(),
        description: row.description ? String(row.description).trim() : "",
        category: row.category ? String(row.category).trim() : "",
        subcategory: row.subcategory ? String(row.subcategory).trim() : "",
        brand: row.brand ? String(row.brand).trim() : "",
        price: isNaN(price) ? 0 : price,
        sizes: row.sizes ? String(row.sizes).trim() : "",
        quantity: row.quantity ? parseInt(row.quantity) || 0 : 0,
        isActive: true,
      };

      // If row has imageUrl, keep it
      if (row.imageUrl) productData.imageUrl = String(row.imageUrl).trim();

      operations.push({
        updateOne: {
          filter: { sku },
          update: { $set: productData },
          upsert: true,
        },
      });
    }

    // ── Execute in bulk batches ──
    for (let i = 0; i < operations.length; i += BATCH_SIZE) {
      const chunk = operations.slice(i, i + BATCH_SIZE);
      const result = await Product.bulkWrite(chunk, { ordered: false });
      imported += result.upsertedCount || 0;
      updated += result.modifiedCount || 0;
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
      total: rows.length,
      imported,
      updated,
      failed,
      errors,
      headers,
      mapping,
      unmappedHeaders,
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
        // Find product by SKU
        const product = await Product.findOne({ sku: img.stem });

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
            public_id: img.stem,
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
          const destFilename = `${img.stem}${path.extname(img.filename)}`;
          const destPath = path.join(uploadsDir, destFilename);
          fs.copyFileSync(img.path, destPath);
          imageUrl = `/uploads/products/${destFilename}`;
        }

        // Update product
        product.imageUrl = imageUrl;
        if (imagePublicId) product.imagePublicId = imagePublicId;
        await product.save();
        matched++;
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
