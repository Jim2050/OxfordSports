const User = require("../models/User");
const Product = require("../models/Product");
const Category = require("../models/Category");
const DeletedProductBatch = require("../models/DeletedProductBatch");
const generateToken = require("../utils/generateToken");
const cloudinary = require("../config/cloudinary");
const fs = require("fs");

/**
 * POST /api/admin/login
 * Authenticate an admin user and return JWT.
 */
exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ── Backward-compat: password-only login (find the admin user) ──
    if (!email && password) {
      const admin = await User.findOne({ role: "admin" }).select("+password");
      if (!admin || !(await admin.comparePassword(password))) {
        return res
          .status(401)
          .json({ success: false, error: "Incorrect password." });
      }
      const token = generateToken(admin._id, admin.role);
      return res.json({ success: true, token, user: admin.toJSON() });
    }

    // ── Standard email + password login ──
    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email and password are required." });
    }

    const user = await User.findOne({
      email: email.toLowerCase(),
      role: "admin",
    }).select("+password");

    if (!user || !(await user.comparePassword(password))) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid admin credentials." });
    }

    const token = generateToken(user._id, user.role);
    res.json({ success: true, token, user: user.toJSON() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/admin/products
 * Add a single product.
 */
exports.addProduct = async (req, res) => {
  try {
    const {
      sku,
      name,
      description,
      category,
      subcategory,
      brand,
      color,
      barcode,
      price,
      salePrice,
      rrp,
      sizes,
      quantity,
    } = req.body;

    if (!name)
      return res.status(400).json({ error: "Product name is required." });

    const finalSalePrice = parseFloat(salePrice || price);
    if (isNaN(finalSalePrice) || finalSalePrice < 0) {
      return res.status(400).json({ error: "Valid sale price is required." });
    }

    // Build sizes array: accept either new format [{size,quantity}] or legacy "S, M, L" string
    let sizesArray = [];
    if (Array.isArray(sizes) && sizes.length > 0) {
      if (typeof sizes[0] === "object" && sizes[0].size !== undefined) {
        sizesArray = sizes.map((s) => ({
          size: String(s.size).trim(),
          quantity: parseInt(s.quantity) || 0,
        }));
      } else {
        // Legacy: array of strings
        const qty = parseInt(quantity) || 0;
        const perSize = sizes.length > 0 ? Math.floor(qty / sizes.length) : 0;
        sizesArray = sizes.map((s) => ({
          size: String(s).trim(),
          quantity: perSize,
        }));
      }
    } else if (typeof sizes === "string" && sizes.trim()) {
      const sizeList = sizes
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const qty = parseInt(quantity) || 0;
      const perSize =
        sizeList.length > 0 ? Math.floor(qty / sizeList.length) : 0;
      sizesArray = sizeList.map((s) => ({ size: s, quantity: perSize }));
    } else if (parseInt(quantity) > 0) {
      sizesArray = [{ size: "ONE SIZE", quantity: parseInt(quantity) }];
    }

    const totalQuantity = sizesArray.reduce(
      (sum, s) => sum + (s.quantity || 0),
      0,
    );

    const productData = {
      sku: sku ? sku.trim().toUpperCase() : `AUTO-${Date.now()}`,
      name: name.trim(),
      description: description || "",
      category: category || "",
      subcategory: subcategory || "",
      brand: brand || "",
      color: color || "",
      barcode: barcode || "",
      salePrice: finalSalePrice,
      rrp: rrp ? parseFloat(rrp) : 0,
      sizes: sizesArray,
      totalQuantity,
    };

    const product = await Product.findOneAndUpdate(
      { sku: productData.sku },
      productData,
      { upsert: true, returnDocument: "after", runValidators: true },
    );

    const isNew = product.createdAt.getTime() === product.updatedAt.getTime();

    res.status(201).json({
      success: true,
      product,
      imported: isNew ? 1 : 0,
      updated: isNew ? 0 : 1,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res
        .status(409)
        .json({ error: "A product with this SKU already exists." });
    }
    res.status(500).json({ error: err.message });
  }
};

/**
 * PUT /api/admin/products/:sku
 * Update an existing product by SKU.
 */
exports.updateProduct = async (req, res) => {
  try {
    const sku = req.params.sku.toUpperCase();
    const product = await Product.findOne({ sku });

    if (!product) {
      return res.status(404).json({ error: "Product not found." });
    }

    // Merge only provided fields
    const simpleFields = [
      "name",
      "description",
      "category",
      "subcategory",
      "brand",
      "color",
      "barcode",
      "imageUrl",
    ];
    simpleFields.forEach((f) => {
      if (req.body[f] !== undefined) product[f] = req.body[f];
    });

    // Price fields (accept both legacy "price" and new "salePrice")
    if (req.body.salePrice !== undefined) {
      product.salePrice = parseFloat(req.body.salePrice);
    } else if (req.body.price !== undefined) {
      product.salePrice = parseFloat(req.body.price);
    }
    if (req.body.rrp !== undefined) {
      product.rrp = parseFloat(req.body.rrp);
    }

    // Sizes: accept new format [{size,quantity}] or legacy string "S, M, L"
    if (req.body.sizes !== undefined) {
      const s = req.body.sizes;
      if (Array.isArray(s) && s.length > 0 && typeof s[0] === "object") {
        product.sizes = s.map((e) => ({
          size: String(e.size).trim(),
          quantity: parseInt(e.quantity) || 0,
        }));
      } else if (typeof s === "string" && s.trim()) {
        const sizeList = s
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);
        const qty = parseInt(req.body.quantity) || 0;
        const perSize =
          sizeList.length > 0 ? Math.floor(qty / sizeList.length) : 0;
        product.sizes = sizeList.map((x) => ({ size: x, quantity: perSize }));
      } else if (Array.isArray(s)) {
        // Legacy string array
        const qty = parseInt(req.body.quantity) || 0;
        const perSize = s.length > 0 ? Math.floor(qty / s.length) : 0;
        product.sizes = s.map((x) => ({
          size: String(x).trim(),
          quantity: perSize,
        }));
      }
    }

    // Recompute totalQuantity
    product.totalQuantity = (product.sizes || []).reduce(
      (sum, e) => sum + (e.quantity || 0),
      0,
    );

    await product.save();

    res.json({ success: true, product, updated: 1 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * DELETE /api/admin/products/:sku
 * Soft-delete a single product by SKU (backs up before removing).
 */
exports.deleteProduct = async (req, res) => {
  try {
    const sku = req.params.sku.toUpperCase();
    const product = await Product.findOne({ sku }).lean();

    if (!product) {
      return res.status(404).json({ error: "Product not found." });
    }

    // Backup the single product before deleting
    await DeletedProductBatch.create({
      deletedBy: req.user?._id,
      reason: `Single product deleted: ${sku}`,
      count: 1,
      products: [product],
    });

    await Product.findOneAndDelete({ sku });

    res.json({ success: true, message: `Product ${sku} deleted (backup saved).` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * DELETE /api/admin/products
 * Clear ALL products — requires confirmation code.
 * Creates a full backup before deletion so products can be restored.
 *
 * Body: { confirmCode: "DELETE-ALL-<count>" }
 * The frontend must send the exact confirmation code matching the product count.
 */
exports.deleteAllProducts = async (req, res) => {
  try {
    const count = await Product.countDocuments({});

    if (count === 0) {
      return res.json({ success: true, message: "No products to delete." });
    }

    // Require confirmation code: "DELETE-ALL-<count>"
    const expectedCode = `DELETE-ALL-${count}`;
    const providedCode = (req.body?.confirmCode || "").trim();

    if (providedCode !== expectedCode) {
      return res.status(400).json({
        error: `Safety check failed. To delete all ${count} products, send confirmCode: "${expectedCode}". This action creates a backup first.`,
        expectedCode,
        productCount: count,
      });
    }

    // Create backup snapshot of ALL products
    const allProducts = await Product.find({}).lean();
    await DeletedProductBatch.create({
      deletedBy: req.user?._id,
      reason: `Bulk clear all — ${count} products`,
      count,
      products: allProducts,
    });

    // Now delete
    const result = await Product.deleteMany({});
    res.json({
      success: true,
      message: `All ${result.deletedCount} products cleared. Backup saved — you can restore within 30 days.`,
      backupCreated: true,
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/admin/deleted-batches
 * List all backup batches available for restore.
 */
exports.getDeletedBatches = async (_req, res) => {
  try {
    const batches = await DeletedProductBatch.find({})
      .select("reason count restored restoredAt createdAt")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    res.json({ batches });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/admin/restore-products/:batchId
 * Restore products from a deleted batch backup.
 * This re-inserts all products from the backup snapshot.
 * Skips products whose SKU already exists (to avoid duplicates).
 */
exports.restoreProducts = async (req, res) => {
  try {
    const batch = await DeletedProductBatch.findById(req.params.batchId);
    if (!batch) {
      return res.status(404).json({ error: "Backup batch not found." });
    }
    if (batch.restored) {
      return res.status(400).json({ error: "This batch has already been restored." });
    }

    const products = batch.products || [];
    let restored = 0;
    let skipped = 0;

    for (const p of products) {
      // Remove MongoDB internal fields so we can re-insert cleanly
      const { _id, __v, createdAt, updatedAt, ...productData } = p;
      try {
        await Product.create(productData);
        restored++;
      } catch (e) {
        // Duplicate key (SKU already exists) — skip
        if (e.code === 11000) {
          skipped++;
        } else {
          skipped++;
        }
      }
    }

    // Mark batch as restored
    batch.restored = true;
    batch.restoredAt = new Date();
    await batch.save();

    res.json({
      success: true,
      message: `Restored ${restored} products (${skipped} skipped — already exist).`,
      restored,
      skipped,
      total: products.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/admin/categories
 * Get categories from Category collection + distinct product categories.
 */
exports.getCategories = async (_req, res) => {
  try {
    const [dbCategories, productCategories, productSubcategories] =
      await Promise.all([
        Category.find({ isActive: true })
          .sort({ displayOrder: 1, name: 1 })
          .lean(),
        Product.distinct("category", { category: { $ne: "" } }),
        Product.distinct("subcategory", { subcategory: { $ne: "" } }),
      ]);

    res.json({
      categories: dbCategories,
      productCategories: productCategories.sort(),
      subcategories: productSubcategories.sort(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/admin/fix-subcategories
 * One-time migration: scan all products lacking a subcategory,
 * auto-detect Rugby / Football / Footwear from their name,
 * and write the result back to MongoDB.
 * Safe to call multiple times — only updates products with empty subcategory.
 */
exports.fixSubcategories = async (_req, res) => {
  try {
    const RUGBY_RE = /rugby/i;
    const FOOTBALL_RE =
      /\bfootball\b|soccer|\bfc\b|\bf\.c\.|premier league|champions league/i;
    const FOOTWEAR_RE =
      /\bboot\b|\bboots\b|\btrainer\b|\btrainers\b|\bshoe\b|\bshoes\b|footwear|sneaker|running/i;

    // Fetch all products with empty/missing subcategory in batches
    let updated = 0;
    const BATCH = 500;
    let skip = 0;
    let hasMore = true;

    while (hasMore) {
      const products = await Product.find(
        { subcategory: { $in: ["", null] } },
        { _id: 1, name: 1, description: 1 },
      )
        .skip(skip)
        .limit(BATCH)
        .lean();

      if (products.length === 0) {
        hasMore = false;
        break;
      }

      const bulkOps = [];
      for (const p of products) {
        const haystack = (
          (p.name || "") +
          " " +
          (p.description || "")
        ).toLowerCase();
        let sub = "";
        if (RUGBY_RE.test(haystack)) sub = "Rugby";
        else if (FOOTBALL_RE.test(haystack)) sub = "Football";
        else if (FOOTWEAR_RE.test(haystack)) sub = "Footwear";

        if (sub) {
          bulkOps.push({
            updateOne: {
              filter: { _id: p._id },
              update: { $set: { subcategory: sub } },
            },
          });
        }
      }

      if (bulkOps.length > 0) {
        const r = await Product.bulkWrite(bulkOps, { ordered: false });
        updated += r.modifiedCount || 0;
      }

      skip += BATCH;
      if (products.length < BATCH) hasMore = false;
    }

    res.json({
      success: true,
      updated,
      message: `Subcategory fix applied to ${updated} products.`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/admin/fix-brands
 * One-time migration: set brand = "adidas" on all products that have an empty brand.
 * Safe to call multiple times — only touches products where brand is currently empty.
 * Accepts optional body: { brand: "adidas" } to override the default.
 */
exports.fixBrands = async (req, res) => {
  try {
    const brandValue = (req.body?.brand || "adidas").trim();
    const result = await Product.updateMany(
      { brand: { $in: ["", null, undefined] } },
      { $set: { brand: brandValue } },
    );
    res.json({
      success: true,
      updated: result.modifiedCount,
      message: `Brand set to "${brandValue}" on ${result.modifiedCount} products.`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/admin/export
 * Export all products as JSON. Frontend converts to CSV.
 */
exports.exportProducts = async (_req, res) => {
  try {
    const products = await Product.find({}).lean();
    res.json({ products });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/admin/stats
 * Dashboard statistics.
 */
exports.getStats = async (_req, res) => {
  try {
    const [
      total,
      underFive,
      withImages,
      categories,
      subcategories,
      brands,
      colors,
      recentBatches,
    ] = await Promise.all([
      Product.countDocuments({}),
      Product.countDocuments({ salePrice: { $lte: 5 } }),
      Product.countDocuments({ imageUrl: { $ne: "" } }),
      Product.distinct("category", { category: { $ne: "" } }),
      Product.distinct("subcategory", { subcategory: { $ne: "" } }),
      Product.distinct("brand", { brand: { $ne: "" } }),
      Product.distinct("color", { color: { $ne: "" } }),
      require("../models/ImportBatch")
        .find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    res.json({
      total,
      underFive,
      withImages,
      categoryCount: categories.length,
      categories,
      subcategoryCount: subcategories.length,
      subcategories,
      brandCount: brands.length,
      brands,
      colorCount: colors.length,
      recentBatches,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/admin/products/:sku/upload-image
 * Upload a single image for a product (via Cloudinary).
 * Expects multipart form with file field "image".
 */
exports.uploadProductImage = async (req, res) => {
  try {
    const sku = req.params.sku.toUpperCase();
    const product = await Product.findOne({ sku });
    if (!product) {
      return res.status(404).json({ error: "Product not found." });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No image file provided." });
    }

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "oxford-sports",
      public_id: sku.replace(/[^a-zA-Z0-9_-]/g, "_"),
      overwrite: true,
      transformation: [{ width: 800, height: 800, crop: "limit", quality: "auto" }],
    });

    // Clean up temp file
    try { fs.unlinkSync(req.file.path); } catch {}

    // Update product
    product.imageUrl = result.secure_url;
    product.imagePublicId = result.public_id;
    await product.save();

    res.json({
      success: true,
      imageUrl: result.secure_url,
      product,
    });
  } catch (err) {
    // Clean up temp file on error
    if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch {}
    res.status(500).json({ error: err.message });
  }
};

/**
 * PUT /api/admin/products/bulk-recategorize
 * Move products from one category to another, or recategorize a list of SKUs.
 * Body: { skus: ["SKU1","SKU2"], category: "NEW_CAT", subcategory: "NEW_SUB" }
 * OR: { fromCategory: "OLD_CAT", category: "NEW_CAT", subcategory: "NEW_SUB" }
 */
exports.bulkRecategorize = async (req, res) => {
  try {
    const { skus, fromCategory, category, subcategory } = req.body;

    if (!category && !subcategory) {
      return res.status(400).json({ error: "Provide at least category or subcategory." });
    }

    let filter = {};
    if (skus && Array.isArray(skus) && skus.length > 0) {
      filter.sku = { $in: skus.map(s => s.toUpperCase()) };
    } else if (fromCategory) {
      filter.category = { $regex: `^${fromCategory}$`, $options: "i" };
    } else {
      return res.status(400).json({ error: "Provide skus array or fromCategory." });
    }

    const update = {};
    if (category) update.category = category;
    if (subcategory) update.subcategory = subcategory;

    const result = await Product.updateMany(filter, { $set: update });

    res.json({
      success: true,
      updated: result.modifiedCount,
      message: `${result.modifiedCount} products recategorized.`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
