const User = require("../models/User");
const Product = require("../models/Product");
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
      price,
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
      price: parseFloat(price),
      sizes: sizes || "",
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
      "price",
      "sizes",
      "quantity",
      "imageUrl",
    ];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) {
        product[f] = f === "price" ? parseFloat(req.body[f]) : req.body[f];
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
 * Get distinct category values from products.
 */
exports.getCategories = async (_req, res) => {
  try {
    const categories = await Product.distinct("category", {
      category: { $ne: "" },
    });
    res.json({ categories: categories.sort() });
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
    const [total, underFive, withImages, categories, recentBatches] =
      await Promise.all([
        Product.countDocuments({}),
        Product.countDocuments({ price: { $lte: 5 } }),
        Product.countDocuments({ imageUrl: { $ne: "" } }),
        Product.distinct("category", { category: { $ne: "" } }),
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
      recentBatches,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
