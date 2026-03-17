require("dotenv").config();

const mongoose = require("mongoose");
const Product = require("./models/Product");
const {
  deriveBrandCanonical,
  deriveCategoryCanonical,
  deriveGenderCanonical,
  deriveSportCanonical,
  deriveSubcategoryCanonical,
} = require("./utils/taxonomyUtils");

const DRY_RUN = process.argv.includes("--dry-run");

function buildCanonicalFields(product) {
  const categoryCanonical = deriveCategoryCanonical(product.category);
  const subcategoryCanonical = deriveSubcategoryCanonical(
    categoryCanonical || product.category,
    product.subcategory,
  );
  const brandCanonical = deriveBrandCanonical(product.brand);
  const genderCanonical = deriveGenderCanonical({
    rawGender: product.genderCanonical,
    sku: product.sku,
    name: product.name,
    description: product.description,
    category: product.category,
    subcategory: product.subcategory,
  });
  const sportCanonical = deriveSportCanonical({
    name: product.name,
    description: product.description,
    category: product.category,
    subcategory: product.subcategory,
  });

  return {
    categoryCanonical,
    subcategoryCanonical,
    brandCanonical,
    genderCanonical,
    sportCanonical,
  };
}

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required in the environment.");
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected to MongoDB: ${mongoose.connection.host}`);

  const cursor = Product.find({}).cursor();
  let scanned = 0;
  let changed = 0;
  let unchanged = 0;
  let bulkOps = [];

  for await (const product of cursor) {
    scanned += 1;
    const nextValues = buildCanonicalFields(product);
    const hasChanges = Object.entries(nextValues).some(
      ([key, value]) => String(product[key] || "") !== String(value || ""),
    );

    if (!hasChanges) {
      unchanged += 1;
      continue;
    }

    changed += 1;
    bulkOps.push({
      updateOne: {
        filter: { _id: product._id },
        update: { $set: nextValues },
      },
    });

    if (!DRY_RUN && bulkOps.length >= 500) {
      await Product.bulkWrite(bulkOps, { ordered: false });
      bulkOps = [];
    }
  }

  if (!DRY_RUN && bulkOps.length > 0) {
    await Product.bulkWrite(bulkOps, { ordered: false });
  }

  console.log(`Scanned: ${scanned}`);
  console.log(`Changed: ${changed}`);
  console.log(`Unchanged: ${unchanged}`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);

  await mongoose.disconnect();
}

main()
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error(`Canonical backfill failed: ${error.message}`);
    try {
      await mongoose.disconnect();
    } catch {
      // Ignore disconnect failures during shutdown.
    }
    process.exit(1);
  });