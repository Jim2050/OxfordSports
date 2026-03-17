const Product = require("../models/Product");
const Category = require("../models/Category");
const Subcategory = require("../models/Subcategory");
const {
  deriveBrandCanonical,
  deriveCategoryCanonical,
  deriveSubcategoryCanonical,
} = require("../utils/taxonomyUtils");

// Escape user input for safe use in $regex queries (prevent ReDoS / NoSQL injection)
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Category keyword mapping for front-end slugs → DB values ──
// These keywords are searched in BOTH category AND name/subcategory fields
// for sport-specific slugs so products remain findable even when Excel stores
// "Mens/Womens" in the category column (with sport info only in the name).
const CATEGORY_KEYWORDS = {
  mens: ["^mens$"],
  womens: ["^womens$", "^women$", "^female$", "^ladies$"],
  junior: ["^junior$", "^juniors$", "^kids$", "^youth$", "^boys$", "^girls$"],
  sports: ["sports"],
  "rugby-category": ["rugby"],
  rugby: ["rugby"],
  football: ["football", "soccer", "fc ", "f\\.c\\."],
  footwear: ["footwear", "shoe", "boot", "trainer", "sneaker", "running"],
};

// Slugs where we must search name + subcategory in addition to category
const SPORT_SLUGS = new Set([
  "sports",
  "rugby-category",
  "rugby",
  "football",
  "footwear",
]);

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
      limit = 100,
      sort,
    } = req.query;

    const conditions = [{ isActive: true }];

    // Category filter with keyword matching
    if (category) {
      const cat = category.toLowerCase();
      const keywords = CATEGORY_KEYWORDS[cat] || [cat.replace(/-/g, " ")];
      const canonicalCategory = deriveCategoryCanonical(category);
      const sportFilter = subcategory ? deriveSubcategoryCanonical("SPORTS", subcategory) : "";

      if (cat === "mens" || cat === "womens" || cat === "junior") {
        conditions.push({
          $or: [
            { genderCanonical: cat === "mens" ? "MENS" : cat === "womens" ? "WOMENS" : "JUNIOR" },
            ...keywords.map((kw) => ({
              category: { $regex: kw, $options: "i" },
            })),
          ],
        });
      } else if (cat === "sports") {
        const sportOr = [];
        if (sportFilter) {
          sportOr.push({ sportCanonical: sportFilter });
          sportOr.push({ subcategory: { $regex: escapeRegex(subcategory.replace(/-/g, " ")), $options: "i" } });
          sportOr.push({ name: { $regex: escapeRegex(subcategory.replace(/-/g, " ")), $options: "i" } });
          sportOr.push({ description: { $regex: escapeRegex(subcategory.replace(/-/g, " ")), $options: "i" } });
        } else {
          sportOr.push({ sportCanonical: { $nin: ["", null] } });
          sportOr.push({ categoryCanonical: "SPORTS" });
        }
        conditions.push({ $or: sportOr });

      } else if (SPORT_SLUGS.has(cat)) {
        // Sport pages: search across category, name AND subcategory fields
        // so products with "Mens" category but "Argentina Rugby Jersey" name are found
        conditions.push({
          $or: keywords.flatMap((kw) => [
            { category: { $regex: kw, $options: "i" } },
            { name: { $regex: kw, $options: "i" } },
            { subcategory: { $regex: kw, $options: "i" } },
            { description: { $regex: kw, $options: "i" } },
          ]),
        });
      } else {
        const categoryOr = keywords.map((kw) => ({
          category: { $regex: kw, $options: "i" },
        }));
        if (canonicalCategory) {
          categoryOr.unshift({ categoryCanonical: canonicalCategory });
        }
        conditions.push({ $or: categoryOr });
      }
    }

    // Subcategory filter
    if (subcategory && String(category || "").toLowerCase() !== "sports") {
      const canonicalSubcategory = deriveSubcategoryCanonical(category, subcategory);
      conditions.push({
        $or: [
          ...(canonicalSubcategory
            ? [{ subcategoryCanonical: canonicalSubcategory }]
            : []),
          {
            subcategory: {
              $regex: escapeRegex(subcategory.replace(/-/g, " ")),
              $options: "i",
            },
          },
        ],
      });
    }

    // Color filter
    if (color) {
      conditions.push({
        color: { $regex: escapeRegex(color), $options: "i" },
      });
    }

    // Price range (use salePrice — the actual selling price)
    if (maxPrice)
      conditions.push({ salePrice: { $lte: parseFloat(maxPrice) } });
    if (minPrice)
      conditions.push({ salePrice: { $gte: parseFloat(minPrice) } });

    // Brand exact (case-insensitive)
    if (brand) {
      const canonicalBrand = deriveBrandCanonical(brand);
      conditions.push({
        $or: [
          ...(canonicalBrand ? [{ brandCanonical: canonicalBrand }] : []),
          { brand: { $regex: `^${escapeRegex(brand)}$`, $options: "i" } },
        ],
      });
    }

    // Full-text search (regex fallback)
    if (search) {
      const q = escapeRegex(search.trim());
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

    // Sorting — products with images always come first
    let sortObj = { createdAt: -1 };
    if (sort === "price_asc") sortObj = { salePrice: 1 };
    else if (sort === "price_desc") sortObj = { salePrice: -1 };
    else if (sort === "name_asc") sortObj = { name: 1 };

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(500, Math.max(1, parseInt(limit)));

    // Aggregate: products WITH images first, then by chosen sort
    const pipeline = [
      { $match: filter },
      { $addFields: {
        _hasImage: {
          $cond: [
            { $and: [
              { $ne: ["$imageUrl", ""] },
              { $ne: ["$imageUrl", null] },
              { $ifNull: ["$imageUrl", false] },
            ]},
            0,  // 0 = has image (sort first)
            1,  // 1 = no image (sort last)
          ]
        }
      }},
      { $sort: { _hasImage: 1, ...sortObj } },
      { $skip: (pageNum - 1) * limitNum },
      { $limit: limitNum },
      { $unset: "_hasImage" },
    ];

    const [products, total] = await Promise.all([
      Product.aggregate(pipeline),
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
 * Uses aggregation to avoid N+1 query problem.
 */
exports.getCategories = async (_req, res) => {
  try {
    const [categories, subcategories, categoryCounts, rawCategoryCounts, subcategoryCounts, rawSubcategoryCounts, brandCounts, sportCounts, underFiveCount, brandTotalCount, sportTotalCount] =
      await Promise.all([
        Category.find({ isActive: true })
          .sort({ displayOrder: 1, name: 1 })
          .lean(),
        Subcategory.find({ isActive: true })
          .sort({ name: 1 })
          .lean(),
        Product.aggregate([
          { $match: { isActive: true, categoryCanonical: { $nin: ["", null] } } },
          { $group: { _id: "$categoryCanonical", count: { $sum: 1 } } },
        ]),
        Product.aggregate([
          { $match: { isActive: true, category: { $nin: ["", null] } } },
          { $group: { _id: { $toUpper: "$category" }, count: { $sum: 1 } } },
        ]),
        Product.aggregate([
          {
            $match: {
              isActive: true,
              categoryCanonical: { $nin: ["", null] },
              subcategoryCanonical: { $nin: ["", null] },
            },
          },
          {
            $group: {
              _id: {
                category: "$categoryCanonical",
                subcategory: "$subcategoryCanonical",
              },
              count: { $sum: 1 },
            },
          },
        ]),
        Product.aggregate([
          {
            $match: {
              isActive: true,
              category: { $nin: ["", null] },
              subcategory: { $nin: ["", null] },
            },
          },
          {
            $group: {
              _id: {
                category: { $toUpper: "$category" },
                subcategory: { $toUpper: "$subcategory" },
              },
              count: { $sum: 1 },
            },
          },
        ]),
        Product.aggregate([
          { $match: { isActive: true, brandCanonical: { $nin: ["", null] } } },
          { $group: { _id: "$brandCanonical", count: { $sum: 1 } } },
        ]),
        Product.aggregate([
          { $match: { isActive: true, sportCanonical: { $nin: ["", null] } } },
          { $group: { _id: "$sportCanonical", count: { $sum: 1 } } },
        ]),
        Product.countDocuments({ isActive: true, salePrice: { $lte: 5 } }),
        Product.countDocuments({
          isActive: true,
          $or: [
            { brandCanonical: { $nin: ["", null] } },
            { brand: { $nin: ["", null] } },
          ],
        }),
        Product.countDocuments({ isActive: true, sportCanonical: { $nin: ["", null] } }),
      ]);

    const categoryCountMap = new Map(
      categoryCounts.map((entry) => [String(entry._id || "").toUpperCase(), entry.count]),
    );
    const rawCategoryCountMap = new Map(
      rawCategoryCounts.map((entry) => [String(entry._id || "").toUpperCase(), entry.count]),
    );
    const subcategoryCountMap = new Map(
      subcategoryCounts.map((entry) => [
        `${String(entry._id.category || "").toUpperCase()}::${String(entry._id.subcategory || "").toUpperCase()}`,
        entry.count,
      ]),
    );
    const rawSubcategoryCountMap = new Map(
      rawSubcategoryCounts.map((entry) => [
        `${String(entry._id.category || "").toUpperCase()}::${String(entry._id.subcategory || "").toUpperCase()}`,
        entry.count,
      ]),
    );
    const brandCountMap = new Map(
      brandCounts.map((entry) => [String(entry._id || "").toUpperCase(), entry.count]),
    );
    const sportCountMap = new Map(
      sportCounts.map((entry) => [String(entry._id || "").toUpperCase(), entry.count]),
    );

    const subcategoriesByCategoryId = subcategories.reduce((acc, subcategory) => {
      const key = String(subcategory.category);
      if (!acc.has(key)) {
        acc.set(key, []);
      }
      acc.get(key).push(subcategory);
      return acc;
    }, new Map());

    const withCounts = categories.map((cat) => {
      const categoryName = String(cat.name || "").toUpperCase();
      const categorySubcategories = subcategoriesByCategoryId.get(String(cat._id)) || [];

      let productCount =
        categoryCountMap.get(categoryName) || rawCategoryCountMap.get(categoryName) || 0;

      if (categoryName === "UNDER £5") {
        productCount = underFiveCount;
      } else if (categoryName === "BRANDS") {
        productCount = brandTotalCount;
      } else if (categoryName === "SPORTS") {
        productCount = sportTotalCount;
      }

      const enrichedSubcategories = categorySubcategories.map((subcategory) => {
        const subcategoryName = String(subcategory.name || "").toUpperCase();
        let subcategoryProductCount =
          subcategoryCountMap.get(`${categoryName}::${subcategoryName}`) ||
          rawSubcategoryCountMap.get(`${categoryName}::${subcategoryName}`) ||
          0;

        if (categoryName === "BRANDS") {
          subcategoryProductCount = brandCountMap.get(subcategoryName) || 0;
        } else if (categoryName === "SPORTS") {
          subcategoryProductCount = sportCountMap.get(subcategoryName) || 0;
        }

        return {
          ...subcategory,
          productCount: subcategoryProductCount,
        };
      });

      return {
        ...cat,
        productCount,
        subcategories: enrichedSubcategories,
      };
    });

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
 * GET /api/products/subcategories?category=FOOTWEAR
 * Return subcategories for a given category name.
 */
exports.getSubcategories = async (req, res) => {
  try {
    const { category } = req.query;
    if (!category) {
      return res.json({ subcategories: [] });
    }
    // Find the category document
    const cat = await Category.findOne({
      name: { $regex: `^${escapeRegex(category)}$`, $options: "i" },
      isActive: true,
    });
    if (!cat) {
      return res.json({ subcategories: [] });
    }
    const subs = await Subcategory.find({ category: cat._id, isActive: true })
      .sort({ name: 1 })
      .lean();
    res.json({ subcategories: subs });
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
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found." });
    }

    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
