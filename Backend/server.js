const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

// ── Validate required environment variables ──
const REQUIRED_ENV = ["MONGO_URI", "JWT_SECRET"];
const missingEnv = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missingEnv.length > 0) {
  console.error(
    `\n❌  Missing required environment variables: ${missingEnv.join(", ")}\n` +
      `   Copy .env.example to .env and fill in the values.\n`,
  );
  process.exit(1);
}

// Warn about optional but important vars
const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "";
if (cloudName === "your_cloud_name") {
  console.warn(
    "⚠️   CLOUDINARY_CLOUD_NAME not set — images will be stored locally in /uploads/products/",
  );
} else {
  console.log(`✅  Cloudinary configured (cloud: ${cloudName})`);
}
if (!process.env.CLIENT_ORIGIN) {
  console.warn(
    "⚠️   CLIENT_ORIGIN not set — CORS will allow all origins (dev only)",
  );
}

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const fs = require("fs");

const connectDB = require("./config/db");
const User = require("./models/User");

const productRoutes = require("./routes/productRoutes");
const adminRoutes = require("./routes/adminRoutes");
const contactRoutes = require("./routes/contactRoutes");
const authRoutes = require("./routes/authRoutes");
const orderRoutes = require("./routes/orderRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const app = express();
const PORT = process.env.PORT || 5000;

// ── Trust proxy (Railway runs behind a reverse proxy) ──
app.set("trust proxy", 1);

// ── Ensure upload directories exist ──
const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
const TEMP_DIR = path.join(UPLOADS_DIR, "temp");
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

// ── Middleware ──
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(",").map((s) => s.trim())
  : [];
app.use(
  cors({
    origin: allowedOrigins.length > 0
      ? (origin, cb) => {
          if (!origin || allowedOrigins.includes(origin)) cb(null, true);
          else cb(new Error("Not allowed by CORS"));
        }
      : "*",
    credentials: true,
  }),
);
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Rate limiter — 200 requests per minute per IP ──
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again in a minute." },
});
app.use("/api", limiter);

// ── Longer timeout for import routes (5 minutes) ──
app.use("/api/admin/import-products", (_req, res, next) => {
  res.setTimeout(300000);
  next();
});
app.use("/api/admin/upload-images", (_req, res, next) => {
  res.setTimeout(1800000); // 30 min for large image batches
  next();
});

// ── Serve uploaded images statically ──
app.use("/uploads", express.static(UPLOADS_DIR));

// ── API Routes ──
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/contact", contactRoutes);

// ── Health check ──
app.get("/api/health", async (_req, res) => {
  const Product = require("./models/Product");
  const count = await Product.countDocuments().catch(() => 0);
  const cName = process.env.CLOUDINARY_CLOUD_NAME || "";
  const cloudinaryConfigured = !!cName && cName !== "your_cloud_name";
  res.json({
    status: "ok",
    products: count,
    db: "mongodb",
    cloudinary: cloudinaryConfigured ? "configured" : "NOT configured — images will save locally (ephemeral)",
  });
});

// ── Root route ──
app.get("/", (_req, res) => {
  res.json({
    message: "Oxford Sports API",
    version: "1.0.0",
    endpoints: {
      health: "/api/health",
      products: "/api/products",
      auth: "/api/auth",
      admin: "/api/admin",
      contact: "/api/contact",
    },
  });
});

// ── Error middleware ──
app.use(notFound);
app.use(errorHandler);

// ── Seed default admin user ──
async function seedAdmin() {
  try {
    const existing = await User.findOne({ role: "admin" });
    if (!existing) {
      const adminEmail = process.env.ADMIN_EMAIL || "admin@oxfordsports.net";
      const adminPass = process.env.ADMIN_PASSWORD;
      if (!adminPass) {
        console.warn("⚠️  ADMIN_PASSWORD env not set — skipping admin seed");
        return;
      }
      await User.create({
        name: "Admin",
        email: adminEmail,
        password: adminPass,
        role: "admin",
      });
      console.log("✅ Default admin user seeded");
    }
  } catch (err) {
    console.error("Admin seed error:", err.message);
  }
}

// ── Start server ──
async function start() {
  await connectDB();
  await seedAdmin();
  app.listen(PORT, () => {
    console.log(`\n🚀  Oxford Sports API running on http://localhost:${PORT}`);
    console.log(`📦  Database: MongoDB Atlas\n`);
  });
}

start();
