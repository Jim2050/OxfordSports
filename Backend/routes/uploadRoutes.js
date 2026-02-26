const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { parseExcel } = require("../services/excelService");
const productStore = require("../services/productStore");
const { matchImagesFromZip } = require("../services/imageMatchService");

// ── Multer config ──
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "..", "uploads", "temp");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${unique}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
});

/**
 * POST /api/upload/excel
 * Upload .xlsx → parse → upsert into products.json
 */
router.post("/excel", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const filePath = req.file.path;

    // Parse Excel
    const { rows, headers, mapping, unmappedHeaders } = parseExcel(filePath);

    if (rows.length === 0) {
      // Clean up
      try {
        fs.unlinkSync(filePath);
      } catch {}
      return res
        .status(400)
        .json({ error: "Excel file is empty or could not be parsed." });
    }

    // Upsert into store
    const result = productStore.bulkUpsert(rows);

    // Clean up temp file
    try {
      fs.unlinkSync(filePath);
    } catch {}

    res.json({
      ...result,
      headers,
      mapping,
      unmappedHeaders,
    });
  } catch (err) {
    console.error("Excel upload error:", err);
    res.status(500).json({ error: `Failed to process Excel: ${err.message}` });
  }
});

/**
 * POST /api/upload/images
 * Upload .zip of images → match to products by SKU filename
 */
router.post("/images", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    if (ext !== ".zip") {
      try {
        fs.unlinkSync(req.file.path);
      } catch {}
      return res.status(400).json({ error: "Please upload a .zip archive." });
    }

    const result = matchImagesFromZip(req.file.path);
    res.json(result);
  } catch (err) {
    console.error("Image upload error:", err);
    res.status(500).json({ error: `Failed to process images: ${err.message}` });
  }
});

module.exports = router;
