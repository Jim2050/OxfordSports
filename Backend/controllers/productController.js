const Product = require("../models/Product");
const Category = require("../models/Category");

// ── Category keyword mapping for front-end slugs → DB values ──
const CATEGORY_KEYWORDS = {
  mens: ["^mens$"],
  womens: ["^womens$", "^women$", "^female$", "^ladies$"],
  junior: ["^junior$", "^juniors$", "^kids$", "^youth$", "^boys$", "^girls$"],
  "rugby-category": ["rugby"],
  rugby: ["rugby"],
  football: ["football", "soccer"],
  footwear: ["footwear", "shoes", "boots", "trainers"],
};

/**
 * GET /api/products
 * Public — returns products with optional filters.
 * Query params: category, subcategory, color, maxPrice, minPrice, brand, search, page, limit, sort
 */
exports.getProducts = async (req, res) => {
  try {
    const {
      category,
      subcategory,
      color,
      maxPrice,
      minPrice,
      brand,
      search,
      page = 1,
      limit = 200,
      sort,
    } = req.query;

    const conditions = [{ isActive: true }];

    // Category filter with keyword matching
    if (category) {
      const cat = category.toLowerCase();
      const keywords = CATEGORY_KEYWORDS[cat] || [cat.replace(/-/g, " ")];
      conditions.push({
        $or: keywords.map((kw) => ({
          category: { $regex: kw, $options: "i" },
        })),
      });
    }

    // Subcategory filter
    if (subcategory) {
      conditions.push({
        subcategory: { $regex: subcategory.replace(/-/g, " "), $options: "i" },
      });
    }

    // Color filter
    if (color) {
      conditions.push({
        color: { $regex: color, $options: "i" },
      });
    }

    // Price range
    if (maxPrice) conditions.push({ price: { $lte: parseFloat(maxPrice) } });
    if (minPrice) conditions.push({ price: { $gte: parseFloat(minPrice) } });

    // Brand exact (case-insensitive)
    if (brand) {
      conditions.push({ brand: { $regex: `^${brand}$`, $options: "i" } });
    }

    // Full-text search (regex fallback)
    if (search) {
      const q = search.trim();
      conditions.push({
        $or: [
          { name: { $regex: q, $options: "i" } },
          { sku: { $regex: q, $options: "i" } },
          { brand: { $regex: q, $options: "i" } },
          { color: { $regex: q, $options: "i" } },
          { description: { $regex: q, $options: "i" } },
        ],
      });
    }

    const filter =
      conditions.length === 1 ? conditions[0] : { $and: conditions };

    // Sorting
    let sortObj = { createdAt: -1 };
    if (sort === "price_asc") sortObj = { price: 1 };
    else if (sort === "price_desc") sortObj = { price: -1 };
    else if (sort === "name_asc") sortObj = { name: 1 };

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(500, Math.max(1, parseInt(limit)));

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort(sortObj)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Product.countDocuments(filter),
    ]);

    res.json({
      products,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/products/brands
 * Return distinct brand names.
 */
exports.getBrands = async (_req, res) => {
  try {
    const brands = await Product.distinct("brand", {
      isActive: true,
      brand: { $ne: "" },
    });
    res.json({ brands: brands.sort() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/products/categories
 * Return categories from the Category collection + product counts.
 */
exports.getCategories = async (_req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .sort({ displayOrder: 1, name: 1 })
      .lean();

    // Add product count per category
    const withCounts = await Promise.all(
      categories.map(async (cat) => {
        const count = await Product.countDocuments({
          category: { $regex: `^${cat.name}$`, $options: "i" },
          isActive: true,
        });
        return { ...cat, productCount: count };
      }),
    );

    res.json({ categories: withCounts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/products/colors
 * Return distinct color values.
 */
exports.getColors = async (_req, res) => {
  try {
    const colors = await Product.distinct("color", {
      isActive: true,
      color: { $ne: "" },
    });
    res.json({ colors: colors.sort() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/products/:sku
 * Return a single product by SKU.
 */
exports.getProductBySku = async (req, res) => {
  try {
    const product = await Product.findOne({
      sku: req.params.sku.toUpperCase(),
      isActive: true,
    }).lean();

    if (!product) {
      return res.status(404).json({ error: "Product not found." });
    }

    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
