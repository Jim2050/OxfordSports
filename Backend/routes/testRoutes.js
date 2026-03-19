/**
 * Test & Verification Routes
 * Purpose: Comprehensive health checks, data integrity validation, and deployment verification
 * 
 * These endpoints are for monitoring and validating the platform during development/recovery
 */

const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Product = require("../models/Product");
const Category = require("../models/Category");

// ═════════════════════════════════════════════════════════════
// 1. DATABASE HEALTH CHECK
// ═════════════════════════════════════════════════════════════

router.get("/health/database", async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Test basic connection
    const readyState = mongoose.connection.readyState;
    if (readyState !== 1) {
      return res.status(503).json({
        status: "unhealthy",
        database: "DISCONNECTED",
        readyState: readyState, // 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
        timestamp: new Date().toISOString(),
      });
    }

    // Test query performance
    const stats = await Product.collection.stats();
    const queryTime = Date.now() - startTime;

    return res.json({
      status: "healthy",
      database: {
        connection: "mongodb",
        state: "connected",
        readyState: readyState,
        database: mongoose.connection.db?.databaseName || "unknown",
      },
      collections: {
        products: {
          count: stats.count || 0,
          averageDocSize: Math.round(stats.avgObjSize || 0),
          totalSize: stats.size || 0,
        },
      },
      queryTime: `${queryTime}ms`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      status: "unhealthy",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// ═════════════════════════════════════════════════════════════
// 2. PRODUCT DATA INTEGRITY CHECK
// ═════════════════════════════════════════════════════════════

router.get("/health/products", async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments({});
    const activeProducts = await Product.countDocuments({ isActive: true });
    const productsWithImages = await Product.countDocuments({ imageUrl: { $ne: "" } });
    const productsWithoutImages = await Product.countDocuments({ imageUrl: { $in: ["", null] } });
    
    // Check for malformed sizes
    const productsWithMalformedSizes = await Product.countDocuments({
      sizes: { $not: { $type: "array" } },
    });

    // Check for duplicate SKUs (should be 0)
    const duplicateSKUs = await Product.aggregate([
      { $group: { _id: "$sku", count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ]);

    // Get sample malformed records
    const malformedSamples = await Product.find({ sizes: { $not: { $type: "array" } } })
      .limit(5)
      .select("sku name sizes");

    return res.json({
      status: totalProducts > 0 ? "healthy" : "warning",
      productCount: {
        total: totalProducts,
        active: activeProducts,
        inactive: totalProducts - activeProducts,
      },
      imageStatus: {
        withImages: productsWithImages,
        withoutImages: productsWithoutImages,
        imagePercentage: totalProducts > 0 ? Math.round((productsWithImages / totalProducts) * 100) : 0,
      },
      dataQuality: {
        malformedSizes: productsWithMalformedSizes,
        duplicateSKUs: duplicateSKUs.length,
        duplicateSKUExamples: duplicateSKUs.slice(0, 5),
      },
      malformedSamples: malformedSamples,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// ═════════════════════════════════════════════════════════════
// 3. CLOUDINARY IMAGE MAPPING VERIFICATION
// ═════════════════════════════════════════════════════════════

router.get("/health/cloudinary-mapping", async (req, res) => {
  try {
    // Find all products with cloudinary URLs
    const cloudinaryProducts = await Product.find({ imageUrl: { $regex: "cloudinary" } })
      .select("sku name imageUrl")
      .limit(100);

    const validUrls = [];
    const invalidUrls = [];
    const missingPublicIds = [];

    for (const product of cloudinaryProducts) {
      const url = product.imageUrl || "";
      
      // Check if URL is valid Cloudinary format
      if (url.includes("res.cloudinary.com") && url.includes(".jpg" || ".png" || ".webp")) {
        validUrls.push({
          sku: product.sku,
          url: url.substring(0, 80) + "...",
          hasPublicId: !!product.imagePublicId,
        });
      } else {
        invalidUrls.push({
          sku: product.sku,
          url: url.substring(0, 80) + "...",
        });
      }

      if (!product.imagePublicId) {
        missingPublicIds.push(product.sku);
      }
    }

    return res.json({
      status: invalidUrls.length === 0 ? "healthy" : "warning",
      summary: {
        totalChecked: cloudinaryProducts.length,
        validUrls: validUrls.length,
        invalidUrls: invalidUrls.length,
        missingPublicIds: missingPublicIds.length,
      },
      samples: {
        validExamples: validUrls.slice(0, 5),
        invalidExamples: invalidUrls.slice(0, 5),
        missingPublicIdSamples: missingPublicIds.slice(0, 5),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// ═════════════════════════════════════════════════════════════
// 4. CATEGORY STRUCTURE VERIFICATION
// ═════════════════════════════════════════════════════════════

router.get("/health/categories", async (req, res) => {
  try {
    const categories = await Category.find({}).select("name slug productCount");
    
    // Verify product counts match database
    const categoryChecks = [];
    for (const cat of categories) {
      const actualCount = await Product.countDocuments({
        category: { $regex: cat.name, $options: "i" },
      });

      categoryChecks.push({
        name: cat.name,
        slug: cat.slug,
        recordedCount: cat.productCount || 0,
        actualCount: actualCount,
        mismatch: cat.productCount !== actualCount,
      });
    }

    const mismatches = categoryChecks.filter((c) => c.mismatch);

    return res.json({
      status: mismatches.length === 0 ? "healthy" : "warning",
      totalCategories: categories.length,
      categoryDetails: categoryChecks,
      countMismatches: mismatches.length,
      mismatchExamples: mismatches.slice(0, 5),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// ═════════════════════════════════════════════════════════════
// 5. SIZE PARSING VERIFICATION
// ═════════════════════════════════════════════════════════════

router.get("/health/size-parsing", async (req, res) => {
  try {
    // Find products with single sizes
    const singleSizeProducts = await Product.find({ "sizes.0": { $exists: true } })
      .select("sku name sizes totalQuantity")
      .limit(50);

    const samples = [];
    let correctParsing = 0;
    let incorrectParsing = 0;

    for (const product of singleSizeProducts) {
      if (product.sizes && Array.isArray(product.sizes)) {
        const firstSize = product.sizes[0];
        if (firstSize && firstSize.size && typeof firstSize.quantity === "number") {
          correctParsing++;
          samples.push({
            sku: product.sku,
            size: firstSize.size,
            quantity: firstSize.quantity,
            totalQuantity: product.totalQuantity,
            matches: firstSize.quantity === product.totalQuantity ? "✅" : "⚠️",
          });
        } else {
          incorrectParsing++;
        }
      }
    }

    const malformedZeroQuantitySizes = await Product.countDocuments({
      sizes: { $elemMatch: { quantity: 0 } },
    });

    return res.json({
      status: incorrectParsing === 0 ? "healthy" : "warning",
      parsingSummary: {
        samplesChecked: singleSizeProducts.length,
        correctParsing: correctParsing,
        incorrectParsing: incorrectParsing,
        zeroQuantitySizes: malformedZeroQuantitySizes,
      },
      samples: samples.slice(0, 10),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// ═════════════════════════════════════════════════════════════
// 6. BRAND STANDARDIZATION CHECK
// ═════════════════════════════════════════════════════════════

router.get("/health/brand-standardization", async (req, res) => {
  try {
    // Find all unique brands
    const brands = await Product.distinct("brand");
    
    // Find adidas variations
    const adidasVariations = brands.filter((b) =>
      b.toLowerCase().includes("adidas")
    );

    // Find all adidas products
    const adidasProducts = await Product.find({
      brand: { $regex: "adidas", $options: "i" },
    })
      .select("sku brand")
      .limit(20);

    // Count brand inconsistencies
    const brandGrouping = await Product.aggregate([
      {
        $group: {
          _id: { $toLower: "$brand" },
          variations: { $addToSet: "$brand" },
          count: { $sum: 1 },
        },
      },
      { $match: { "variations.1": { $exists: true } } },
    ]);

    return res.json({
      status: adidasVariations.length <= 1 ? "healthy" : "warning",
      brandSummary: {
        totalUniqueBrands: brands.length,
        adidasVariations: adidasVariations,
        brandsWithInconsistentCasing: brandGrouping.length,
      },
      adidasProductSamples: adidasProducts.slice(0, 10),
      inconsistentCasingExamples: brandGrouping.slice(0, 5),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// ═════════════════════════════════════════════════════════════
// 7. COMPREHENSIVE SYSTEM HEALTH CHECK
// ═════════════════════════════════════════════════════════════

router.get("/health/system", async (req, res) => {
  try {
    // Check database connection
    const readyState = mongoose.connection.readyState;
    const dbHealthy = readyState === 1;

    // Check product count
    const totalProducts = await Product.countDocuments({});
    const productsHealthy = totalProducts > 0;

    // Get quick stats
    const activeProducts = await Product.countDocuments({ isActive: true });
    const productsWithImages = await Product.countDocuments({ imageUrl: { $ne: "" } });

    const overallStatus = dbHealthy && productsHealthy ? "HEALTHY" : "WARNING";

    return res.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      database: {
        state: dbHealthy ? "connected" : "disconnected",
        readyState: readyState,
      },
      products: {
        state: productsHealthy ? "healthy" : "unhealthy",
        total: totalProducts,
        active: activeProducts,
        withImages: productsWithImages,
      },
      uptime: Math.round(process.uptime()) + "s",
    });
  } catch (error) {
    return res.status(500).json({
      status: "ERROR",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// ═════════════════════════════════════════════════════════════
// 8. SINGLE PRODUCT DETAIL CHECK
// ═════════════════════════════════════════════════════════════

router.get("/health/product/:sku", async (req, res) => {
  try {
    const { sku } = req.params;
    const product = await Product.findOne({ sku: sku.toUpperCase() });

    if (!product) {
      return res.status(404).json({
        status: "not_found",
        sku: sku,
        message: "Product not found",
        timestamp: new Date().toISOString(),
      });
    }

    return res.json({
      status: "found",
      product: {
        sku: product.sku,
        name: product.name,
        category: product.category,
        subcategory: product.subcategory,
        brand: product.brand,
        imageUrl: product.imageUrl ? product.imageUrl.substring(0, 80) + "..." : null,
        imageStatus: product.imageUrl ? "linked" : "missing",
        price: product.salePrice,
        totalQuantity: product.totalQuantity,
        sizes: product.sizes,
        isActive: product.isActive,
      },
      validation: {
        hasImage: !!product.imageUrl,
        sizeFormat: Array.isArray(product.sizes) ? "array" : "invalid",
        quantityMatches:
          product.sizes &&
          Array.isArray(product.sizes) &&
          product.sizes.reduce((sum, s) => sum + (s.quantity || 0), 0) === product.totalQuantity,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
