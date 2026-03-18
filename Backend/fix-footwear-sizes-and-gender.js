const mongoose = require("mongoose");
const path = require("path");

// Try to load from .env (local), otherwise use process.env (Railway)
require("dotenv").config({ path: path.join(__dirname, ".env") });

const Product = require("./models/Product");
const { deriveGenderCanonical } = require("./utils/taxonomyUtils");

function normalizeFootwearSizeLabel(size) {
  const raw = String(size || "").trim().toUpperCase();
  if (!raw) return "";

  const prefixedUk = raw.match(/^(2[1-9])(?:\.0)?$/);
  if (prefixedUk) {
    return String(Number(prefixedUk[1]) - 20);
  }

  const numeric = raw.match(/^-?\d+(?:\.\d+)?$/);
  if (numeric) {
    const absolute = Math.abs(Number(raw));
    if (!Number.isFinite(absolute)) return "";
    if (absolute < 1 || absolute > 15.5) return "";
    return Number.isInteger(absolute) ? String(absolute) : String(absolute);
  }

  if (/^\d{4,}$/.test(raw)) return "";
  return raw;
}

function normalizeFootwearSizeEntries(entries = []) {
  const merged = new Map();
  for (const entry of entries) {
    const normalized = normalizeFootwearSizeLabel(entry?.size);
    const qty = Math.max(0, Number(entry?.quantity) || 0);
    if (!normalized || qty <= 0) continue;
    merged.set(normalized, (merged.get(normalized) || 0) + qty);
  }
  return Array.from(merged.entries()).map(([size, quantity]) => ({
    size,
    quantity,
  }));
}

function sameSizeEntries(a = [], b = []) {
  if (a.length !== b.length) return false;
  const left = [...a]
    .map((s) => `${String(s.size)}:${Number(s.quantity) || 0}`)
    .sort();
  const right = [...b]
    .map((s) => `${String(s.size)}:${Number(s.quantity) || 0}`)
    .sort();
  return left.every((value, idx) => value === right[idx]);
}

async function run() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("MONGO_URI is missing in Backend/.env");
  }

  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB");

  const cursor = Product.find({
    category: { $regex: /^FOOTWEAR$/i },
    isActive: true,
  }).cursor();

  let scanned = 0;
  let sizeUpdated = 0;
  let genderUpdated = 0;
  let totalUpdated = 0;

  for await (const product of cursor) {
    scanned += 1;
    const originalSizes = Array.isArray(product.sizes) ? product.sizes : [];
    const normalizedSizes = normalizeFootwearSizeEntries(originalSizes);
    const sizesChanged = !sameSizeEntries(originalSizes, normalizedSizes);

    const currentGender = String(product.genderCanonical || "").trim().toUpperCase();
    const needsGender = !currentGender;
    let derivedGender = currentGender;

    if (needsGender) {
      derivedGender = deriveGenderCanonical({
        rawGender: currentGender,
        sku: product.sku,
        name: product.name,
        description: product.description,
        category: product.category,
        subcategory: product.subcategory,
        sizes: normalizedSizes,
      });
    }

    const genderChanged = needsGender && !!derivedGender;

    if (!sizesChanged && !genderChanged) {
      continue;
    }

    if (sizesChanged) {
      product.sizes = normalizedSizes;
      product.totalQuantity = normalizedSizes.reduce(
        (sum, entry) => sum + (Number(entry.quantity) || 0),
        0,
      );
      sizeUpdated += 1;
    }

    if (genderChanged) {
      product.genderCanonical = derivedGender;
      genderUpdated += 1;
    }

    await product.save();
    totalUpdated += 1;
  }

  console.log(`Scanned footwear products: ${scanned}`);
  console.log(`Products with size fixes: ${sizeUpdated}`);
  console.log(`Products with gender fixes: ${genderUpdated}`);
  console.log(`Total updated products: ${totalUpdated}`);

  await mongoose.connection.close();
  console.log("Database cleanup complete");
}

run().catch(async (error) => {
  console.error("Cleanup failed:", error.message);
  try {
    await mongoose.connection.close();
  } catch {
    // Ignore close errors
  }
  process.exit(1);
});
