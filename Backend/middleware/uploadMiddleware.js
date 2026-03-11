const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const TEMP_DIR = path.join(__dirname, "..", "uploads", "temp");
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

// ── Disk storage with cryptographically random filenames ──
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, TEMP_DIR),
  filename: (_req, file, cb) => {
    const unique = crypto.randomBytes(16).toString("hex");
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${unique}${ext}`);
  },
});

// ── Excel upload (single .xlsx / .xls / .csv) ──
const uploadExcel = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [".xlsx", ".xls", ".csv"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error("Only .xlsx, .xls, or .csv files are allowed."));
  },
}).single("file");

// ── ZIP / image upload (single file — typically a .zip archive) ──
const uploadZip = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB for image archives
  fileFilter: (_req, file, cb) => {
    const allowed = [".zip", ".jpg", ".jpeg", ".png", ".webp"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error("Only .zip or image files are allowed."));
  },
}).single("file");

// ── Multiple images upload (up to 100 at once) ──
const uploadMultipleImages = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
  fileFilter: (_req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error("Only image files (.jpg, .png, .webp, .gif) are allowed."));
  },
}).array("images", 100);

module.exports = { uploadExcel, uploadZip, uploadMultipleImages };
