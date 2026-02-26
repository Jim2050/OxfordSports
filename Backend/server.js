require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const fs = require("fs");

const productRoutes = require("./routes/productRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const adminRoutes = require("./routes/adminRoutes");
const contactRoutes = require("./routes/contactRoutes");
const authRoutes = require("./routes/authRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// ── Ensure data directories exist ──
const DATA_DIR = path.join(__dirname, "data");
const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ── Initialise products.json if missing ──
const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");
if (!fs.existsSync(PRODUCTS_FILE)) {
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify([], null, 2));
}

// ── Initialise members.json if missing ──
const MEMBERS_FILE = path.join(DATA_DIR, "members.json");
if (!fs.existsSync(MEMBERS_FILE)) {
  fs.writeFileSync(MEMBERS_FILE, JSON.stringify([], null, 2));
}

// ── Middleware ──
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*", credentials: true }));
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Serve uploaded images statically ──
app.use("/uploads", express.static(UPLOADS_DIR));

// ── API Routes ──
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/contact", contactRoutes);

// ── Health check ──
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    products: require("./services/productStore").count(),
  });
});

// ── Serve frontend (production) ──
const FRONTEND_DIST = path.join(__dirname, "..", "Frontend", "dist");
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  // SPA fallback — serve index.html for any non-API route
  app.get("/{*splat}", (req, res) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) return;
    res.sendFile(path.join(FRONTEND_DIST, "index.html"));
  });
}

// ── Global error handler ──
app.use((err, _req, res, _next) => {
  console.error("Server Error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀  Oxford Sports API running on http://localhost:${PORT}\n`);
});
