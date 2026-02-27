const User = require("../models/User");
const Product = require("../models/Product");
const Category = require("../models/Category");
const generateToken = require("../utils/generateToken");

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
      rrp,
      sizes,
      quantity,
    } = req.body;

    if (!name)
      return res.status(400).json({ error: "Product name is required." });
    if (price === undefined || price === null) {
      return res.status(400).json({ error: "Price is required." });
    }

    const productData = {
      sku: sku ? sku.trim().toUpperCase() : `AUTO-${Date.now()}`,
      name: name.trim(),
      description: description || "",
      category: category || "",
      subcategory: subcategory || "",
      brand: brand || "",
      color: color || "",
      barcode: barcode || "",
      price: parseFloat(price),
      rrp: rrp ? parseFloat(rrp) : 0,
      sizes: Array.isArray(sizes) ? sizes : sizes ? [sizes] : [],
      quantity: quantity ? parseInt(quantity) : 0,
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
    const fields = [
      "name",
      "description",
      "category",
      "subcategory",
      "brand",
      "color",
      "barcode",
      "price",
      "rrp",
      "sizes",
      "quantity",
      "imageUrl",
    ];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) {
        if (f === "price" || f === "rrp") {
          product[f] = parseFloat(req.body[f]);
        } else if (f === "sizes") {
          product[f] = Array.isArray(req.body[f])
            ? req.body[f]
            : req.body[f]
              ? [req.body[f]]
              : [];
        } else {
          product[f] = req.body[f];
        }
      }
    });

    await product.save();

    res.json({ success: true, product, updated: 1 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * DELETE /api/admin/products/:sku
 * Delete a single product by SKU.
 */
exports.deleteProduct = async (req, res) => {
  try {
    const result = await Product.findOneAndDelete({
      sku: req.params.sku.toUpperCase(),
    });

    if (!result) {
      return res.status(404).json({ error: "Product not found." });
    }

    res.json({ success: true, message: "Product deleted." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * DELETE /api/admin/products
 * Clear ALL products.
 */
exports.deleteAllProducts = async (_req, res) => {
  try {
    const result = await Product.deleteMany({});
    res.json({
      success: true,
      message: `All products cleared (${result.deletedCount} removed).`,
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
      colors,
      recentBatches,
    ] = await Promise.all([
      Product.countDocuments({}),
      Product.countDocuments({ price: { $lte: 5 } }),
      Product.countDocuments({ imageUrl: { $ne: "" } }),
      Product.distinct("category", { category: { $ne: "" } }),
      Product.distinct("subcategory", { subcategory: { $ne: "" } }),
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
      colorCount: colors.length,
      recentBatches,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
