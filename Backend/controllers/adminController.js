const User = require("../models/User");
const Product = require("../models/Product");
const Category = require("../models/Category");
const DeletedProductBatch = require("../models/DeletedProductBatch");
const generateToken = require("../utils/generateToken");
const cloudinary = require("../config/cloudinary");
const fs = require("fs");
const { parseSizesInput } = require("../utils/sizeStockUtils");

/**
 * POST /api/admin/login
 * Authenticate an admin user and return JWT.
 */
exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ── Require both email and password ──
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

    const finalSalePrice = +parseFloat(salePrice || price).toFixed(2);
    if (isNaN(finalSalePrice) || finalSalePrice < 0) {
      return res.status(400).json({ error: "Valid sale price is required." });
    }

    const parsedTotalQty = parseInt(quantity);
    const totalQtyInput = isNaN(parsedTotalQty) ? 0 : Math.max(0, parsedTotalQty);

    // Build sizes array using shared parser for consistency with import pipeline.
    let sizesArray = parseSizesInput(sizes, totalQtyInput, category);
    if (sizesArray.length === 0 && totalQtyInput > 0) {
      sizesArray = [{ size: "ONE SIZE", quantity: totalQtyInput }];
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

    const categoryForSizeParsing =
      req.body.category !== undefined ? req.body.category : product.category;

    // Sizes: parse via shared utility to prevent malformed labels and qty drift.
    if (req.body.sizes !== undefined) {
      const parsedQty = parseInt(req.body.quantity);
      const totalQtyInput = isNaN(parsedQty)
        ? Math.max(0, Number(product.totalQuantity) || 0)
        : Math.max(0, parsedQty);

      const parsedSizes = parseSizesInput(
        req.body.sizes,
        totalQtyInput,
        categoryForSizeParsing,
      );

      if (parsedSizes.length > 0) {
        product.sizes = parsedSizes;
      } else if (totalQtyInput > 0) {
        product.sizes = [{ size: "ONE SIZE", quantity: totalQtyInput }];
      } else {
        product.sizes = [];
      }
      
      // Only log update in development mode (verbose logging disabled for performance)
      if (process.env.DEBUG_UPDATES === "true") {
        console.debug(`[UPDATE] ${sku}: sizes input="${req.body.sizes}" qty=${totalQtyInput} → result=${JSON.stringify(product.sizes)}`);
      }
    }

    // Recompute totalQuantity
    product.totalQuantity = (product.sizes || []).reduce(
      (sum, e) => sum + (e.quantity || 0),
      0,
    );

    const savedProduct = await product.save();
    
    if (!savedProduct) {
      return res.status(500).json({ error: "Product save returned null - validation may have failed." });
    }

    res.json({ success: true, product: savedProduct, updated: 1 });
  } catch (err) {
    // Enhanced error logging for debugging
    console.error(`[ERROR] updateProduct failed:`, err.message, err.stack);
    res.status(500).json({ 
      error: err.message,
      details: process.env.NODE_ENV === "production" ? undefined : err.stack
    });
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
    // ── Footwear subcategory rules (must match nav menu) ──
    const FOOTBALL_BOOTS_RE = /\b(NEMEZIZ|COPA|PREDATOR|SPEEDFLOW|X SPEEDPORTAL|X CRAZYFAST|PREDSTRIKE|SOCCER SHOE|FOOTBALL BOOT)\b|\b(FG|SG|TF|AG|FxG|MG|HG)\b/i;
    const RUGBY_BOOTS_RE = /\b(RUGBY|KAKARI|MALICE|FLANKER)\b/i;
    const GOLF_SHOES_RE = /\b(GOLF|CODECHAOS|ZG21|TOUR360|S2G|SOLARMOTION|REBELCROSS)\b/i;
    const TENNIS_SHOES_RE = /\b(TENNIS|PADEL|BARRICADE|COURTJAM|SOLEMATCH|GAMECOURT|COURTFLASH|DEFIANT)\b/i;
    const BEACH_RE = /\b(SLIDE|SLIDES|SANDAL|SANDALS|FLIP FLOP|FLIP FLOPS|SHOWER|ADILETTE|COMFORT SLIDE)\b/i;
    const SPECIALIST_RE = /\b(TERREX|HIKING|TRAIL|OUTDOOR|WALKING)\b/i;

    // ── Category detection regexes ──
    const FOOTWEAR_MODELS = /\b(SUPERSTAR|STAN SMITH|GAZELLE|SAMBA|CAMPUS|FORUM|NMD|ULTRA\s?BOOST|ULTRABOOST|YEEZY|OZWEEGO|ZX|CONTINENTAL|SUPERNOVA|PURE\s?BOOST|SOLAR\s?BOOST|RESPONSE|ADIZERO|ADISTAR|QUESTAR|DURAMO|GALAXY|RUNFALCON|LITE RACER|SWIFT RUN|MULTIX|NITE JOGGER|RETROPY|OZELIA|OZRAH|RIVALRY|DROPSET|DROPSTEP|STREETBALL|HOOPS|ENTRAP|TENSAUR|FORTARUN|RAPIDARUN|4DFWD|DAME|HARDEN|D\.O\.N\.|TRAE|ADILETTE|CLOUDFOAM)\b/i;
    const FOOTWEAR_STUDS = /\b(FG|SG|AG|TF|FxG|MG|HG|IN|IC|FIRM GROUND|SOFT GROUND|TURF|INDOOR|ARTIFICIAL GROUND|MOULDED)\b/i;
    const FOOTWEAR_KEYWORDS = /\b(SHOE|SHOES|BOOT|BOOTS|TRAINER|TRAINERS|SNEAKER|SNEAKERS|CLEAT|CLEATS|FOOTWEAR|SLIDER|SLIDERS|SLIDE|SANDAL|FLIP FLOP|RUNNING SHOE|FOOTBALL BOOT|RUGBY BOOT|GOLF SHOE|TENNIS SHOE)\b/i;
    const CLOTHING_ABBREVS = /\b(JSY|JKT|SHO|TEE|HD|SWT|BRA|TIGHT|PT|TT)\b/i;
    const CLOTHING_KEYWORDS = /\b(SHIRT|SHORTS|JACKET|HOODIE|HOODY|SWEATSHIRT|SWEATER|JERSEY|T-SHIRT|POLO|VEST|LEGGING|LEGGINGS|TIGHTS|CROP|PANTS|JOGGER|JOGGERS|TRACKSUIT|COAT|PARKA|WINDBREAKER|ANORAK|GILET|GILLET|FLEECE|PULLOVER|CREW|TANK|BIKINI|SWIMSUIT|COSTUME|SKIRT|DRESS|ONESIE|ROMPER|BODYSUIT|TROUSERS|SHORTS|RAINCOAT|TEE SHIRT|TRACK TOP|TRACK PANT)\b/i;
    const ACCESSORIES_KEYWORDS = /\b(BAG|BAGS|BALL|BALLS|TOWEL|TOWELS|BOTTLE|BOTTLES|SHIN|SHIN GUARD|SHIN PAD|SHINGUARD|GLOVE|GLOVES|CAP|CAPS|HAT|HATS|SCARF|SCARVES|BEANIE|BEANIES|HEADBAND|WRISTBAND|ARMBAND|SOCK|SOCKS|BACKPACK|DUFFEL|DUFFLE|RUCKSACK|HOLDALL|WASHBAG|KEYRING|LANYARD|WALLET|PURSE|WATCH|SUNGLASSES|BELT)\b/i;
    const GENDER_ONLY = /^(MENS?|WOMENS?|WOMEN|FEMALE|LADIES|JUNIOR|JUNIORS|KIDS|YOUTH|BOYS?|GIRLS?|UNISEX|INFANT|BABY|TODDLER)$/i;

    // ── Old category → new category+subcategory mapping ──
    const OLD_CAT_MAP = {
      "football shorts": ["CLOTHING", "Shorts"], "shorts": ["CLOTHING", "Shorts"],
      "t-shirts": ["CLOTHING", "Shirts"], "polo shirts": ["CLOTHING", "Shirts"],
      "football shirts": ["CLOTHING", "Shirts"], "vests": ["CLOTHING", "Vests & Bras"],
      "fitness and gym tops": ["CLOTHING", "Shirts"], "long dresses": ["CLOTHING", "Shirts"],
      "track pants": ["CLOTHING", "Tracksuits & Joggers"], "track tops": ["CLOTHING", "Tracksuits & Joggers"],
      "track jackets": ["CLOTHING", "Tracksuits & Joggers"], "tracksuits": ["CLOTHING", "Tracksuits & Joggers"],
      "track and training pants": ["CLOTHING", "Tracksuits & Joggers"],
      "three quarter pants": ["CLOTHING", "Tracksuits & Joggers"], "trousers": ["CLOTHING", "Tracksuits & Joggers"],
      "hooded sweat": ["CLOTHING", "Hoods & Sweaters"], "crew sweat": ["CLOTHING", "Hoods & Sweaters"],
      "fleece": ["CLOTHING", "Hoods & Sweaters"], "knitwear": ["CLOTHING", "Hoods & Sweaters"],
      "coats": ["CLOTHING", "Jackets & Coats"], "jackets": ["CLOTHING", "Jackets & Coats"],
      "lightweight jackets": ["CLOTHING", "Jackets & Coats"], "raincoats": ["CLOTHING", "Jackets & Coats"],
      "gillet": ["CLOTHING", "Jackets & Coats"],
      "bikini": ["CLOTHING", "Swimwear"], "swimming costumes": ["CLOTHING", "Swimwear"],
      "swim shorts": ["CLOTHING", "Swimwear"],
      "leggings": ["CLOTHING", "Leggings"], "long skirts": ["CLOTHING", "Leggings"],
      "trainers": ["FOOTWEAR", "Trainers"], "running shoes": ["FOOTWEAR", "Trainers"],
      "football boots": ["FOOTWEAR", "Football Boots"], "rugby boots": ["FOOTWEAR", "Rugby Boots"],
      "beach shoes": ["FOOTWEAR", "Beach Footwear"], "golf shoes": ["FOOTWEAR", "Golf Shoes"],
      "football socks": ["CLOTHING", "Socks & Gloves"], "adult's socks": ["CLOTHING", "Socks & Gloves"],
      "football gloves": ["ACCESSORIES", "Gloves"], "casual bags": ["ACCESSORIES", "Bags & Holdalls"],
      "peak caps": ["ACCESSORIES", "Headwear"], "football accessories": ["ACCESSORIES", "Protective Gear"],
      "assorted accessories": ["ACCESSORIES", "Bags & Holdalls"], "mens belts": ["ACCESSORIES", "Bags & Holdalls"],
    };

    // ── Team / sport subcategory rules ──
    const TEAM_MAP = {
      "MUFC": "Manchester United", "MAN UTD": "Manchester United",
      "AFC": "Arsenal", "ARSENAL": "Arsenal",
      "CFC": "Chelsea", "CHELSEA": "Chelsea",
      "LFC": "Liverpool", "LIVERPOOL": "Liverpool",
      "MCFC": "Manchester City", "MAN CITY": "Manchester City",
      "THFC": "Tottenham", "SPURS": "Tottenham",
      "LCFC": "Leicester", "NUFC": "Newcastle",
      "LUFC": "Leeds", "WHUFC": "West Ham",
      "REAL MADRID": "Real Madrid", "BAYERN": "Bayern Munich",
      "JUVENTUS": "Juventus", "JUVE": "Juventus",
      "ALL BLACKS": "New Zealand Rugby", "FFR": "France Rugby",
      "WRU": "Wales Rugby", "SRU": "Scotland Rugby",
      "IRFU": "Ireland Rugby", "AJAX": "Ajax",
      "CELTIC": "Celtic", "RANGERS": "Rangers", "BENFICA": "Benfica",
      "ARU": "Australia Rugby", "SARU": "South Africa Rugby",
      "NZRU": "New Zealand Rugby", "WALLABIES": "Australia Rugby",
      "SPRINGBOK": "South Africa Rugby",
    };
    const SPORT_MAP = {
      "RUGBY": "Rugby", "FOOTBALL": "Football", "SOCCER": "Football",
      "TENNIS": "Tennis", "GOLF": "Golf", "RUNNING": "Running",
      "BASKETBALL": "Basketball", "CRICKET": "Cricket",
      "HOCKEY": "Hockey", "BOXING": "Boxing",
      "SWIMMING": "Swimming", "GYM": "Training", "TRAINING": "Training",
      "YOGA": "Yoga", "FITNESS": "Training",
    };

    function detectCategory(combined) {
      if (FOOTWEAR_MODELS.test(combined) || FOOTWEAR_STUDS.test(combined) || FOOTWEAR_KEYWORDS.test(combined)) return "FOOTWEAR";
      if (ACCESSORIES_KEYWORDS.test(combined)) return "ACCESSORIES";
      if (CLOTHING_ABBREVS.test(combined) || CLOTHING_KEYWORDS.test(combined)) return "CLOTHING";
      return "CLOTHING";
    }

    let updated = 0;
    const BATCH = 500;
    let skip = 0;
    let hasMore = true;

    while (hasMore) {
      const products = await Product.find(
        { $or: [
          { subcategory: { $in: ["", null] } },
          { subcategory: { $exists: false } },
          { subcategory: "Footwear" },
          { subcategory: "Rugby" },
          { category: { $nin: ["FOOTWEAR", "CLOTHING", "ACCESSORIES"] } },
        ]},
        { _id: 1, name: 1, description: 1, sku: 1, category: 1, subcategory: 1 },
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
        const combined = `${p.name || ""} ${p.description || ""} ${p.sku || ""}`.toUpperCase();
        let cat = (p.category || "").trim();
        let sub = (p.subcategory || "").trim();
        const updateFields = {};

        // Step 1: Fix old/non-standard categories
        const catLower = cat.toLowerCase();
        if (OLD_CAT_MAP[catLower]) {
          const [newCat, newSub] = OLD_CAT_MAP[catLower];
          updateFields.category = newCat;
          cat = newCat;
          if (!sub) { updateFields.subcategory = newSub; sub = newSub; }
        } else if (GENDER_ONLY.test(cat)) {
          const newCat = detectCategory(combined);
          updateFields.category = newCat;
          cat = newCat;
        } else if (!["FOOTWEAR", "CLOTHING", "ACCESSORIES"].includes(cat.toUpperCase())) {
          const newCat = detectCategory(combined);
          updateFields.category = newCat;
          cat = newCat;
        }

        const catUpper = cat.toUpperCase();

        // Step 2: Fix subcategory if still empty
        if (!sub) {
          // Footwear-specific subcategories
          if (catUpper === "FOOTWEAR") {
            if (FOOTBALL_BOOTS_RE.test(combined)) sub = "Football Boots";
            else if (RUGBY_BOOTS_RE.test(combined)) sub = "Rugby Boots";
            else if (GOLF_SHOES_RE.test(combined)) sub = "Golf Shoes";
            else if (TENNIS_SHOES_RE.test(combined)) sub = "Tennis / Padel Shoes";
            else if (BEACH_RE.test(combined)) sub = "Beach Footwear";
            else if (SPECIALIST_RE.test(combined)) sub = "Specialist Footwear";
            else sub = "Trainers";
          }

          // Clothing-specific subcategories
          if (!sub && catUpper === "CLOTHING") {
            if (/\b(JSY|JERSEY|SHIRT|POLO|TEE|T-SHIRT|T SHIRT|SS TEE|LS TEE|GRAPHIC TEE|TOP|CROP TOP|TANK)\b/.test(combined)) sub = "Shirts";
            else if (/\bSHO\b|\b(SHORTS|SHORT)\b/.test(combined)) sub = "Shorts";
            else if (/\b(JKT|JACKET|COAT|PARKA|WINDBREAKER|ANORAK|GILLET|GILET|PADDED|BOMBER)\b/.test(combined)) sub = "Jackets & Coats";
            else if (/\b(HOOD|HOODIE|HOODY|SWEAT|SWT|CREW SWEAT|PULLOVER|FLEECE)\b|\bHD\b/.test(combined)) sub = "Hoods & Sweaters";
            else if (/\b(SOCK|SOCKS|GLOVE|GLOVES)\b/.test(combined)) sub = "Socks & Gloves";
            else if (/\b(HAT|HATS|CAP|CAPS|BEANIE|HEADBAND|HEADWEAR)\b/.test(combined)) sub = "Hats & Caps";
            else if (/\b(TRACKSUIT|JOGGER|JOGGERS|TRACK PANT|TRACK PANTS|TRG PNT|TRK PNT|PANTS|PES JKT|FIREBIRD)\b|\bPT\b|\bTT\b/.test(combined)) sub = "Tracksuits & Joggers";
            else if (/\b(SWIM|BIKINI|SWIMMING|SWIM SHORT)\b/.test(combined)) sub = "Swimwear";
            else if (/\b(LEGGING|LEGGINGS|TIGHT|TIGHTS)\b/.test(combined)) sub = "Leggings";
            else if (/\b(VEST|BRA|BRAS|CROP)\b/.test(combined)) sub = "Vests & Bras";
            else sub = "Shirts";
          }

          // Accessories-specific subcategories
          if (!sub && catUpper === "ACCESSORIES") {
            if (/\b(BALL|BALLS|FOOTBALL|MATCH BALL|TRAINING BALL)\b/.test(combined)) sub = "Balls";
            else if (/\b(BAG|BAGS|BACKPACK|HOLDALL|DUFFEL|RUCKSACK|GYMSACK|GYM SACK|TOTE)\b/.test(combined)) sub = "Bags & Holdalls";
            else if (/\b(HAT|HATS|CAP|CAPS|BEANIE|HEADBAND|HEADWEAR)\b/.test(combined)) sub = "Headwear";
            else if (/\b(GLOVE|GLOVES|GOALKEEPER|GK)\b/.test(combined)) sub = "Gloves";
            else if (/\b(RACKET|BAT|RACQUET|PADDLE)\b/.test(combined)) sub = "Rackets & Bats";
            else if (/\b(TOWEL|TOWELS)\b/.test(combined)) sub = "Sports Towels";
            else if (/\b(SHIN|GUARD|GUARDS|PAD|PADS|PROTECTIVE|ANKLE)\b/.test(combined)) sub = "Protective Gear";
            else if (/\b(SUNGLASS|SUNGLASSES|EYEWEAR)\b/.test(combined)) sub = "Sunglasses";
            else if (/\b(WATCH|MONITOR|TRACKER|FITNESS BAND)\b/.test(combined)) sub = "Watches Monitors";
            else if (/\b(SOCK|SOCKS)\b/.test(combined)) sub = "Socks & Gloves";
            else if (/\b(BOTTLE|WATER)\b/.test(combined)) sub = "Bags & Holdalls";
          }

          // Team/country subcategories
          if (!sub) {
            for (const [key, subcat] of Object.entries(TEAM_MAP)) {
              if (combined.includes(key)) { sub = subcat; break; }
            }
          }

          // Sport keyword subcategories
          if (!sub) {
            for (const [key, subcat] of Object.entries(SPORT_MAP)) {
              if (new RegExp(`\\b${key}\\b`).test(combined)) { sub = subcat; break; }
            }
          }

          if (sub) updateFields.subcategory = sub;
        }

        if (Object.keys(updateFields).length > 0) {
          bulkOps.push({
            updateOne: {
              filter: { _id: p._id },
              update: { $set: updateFields },
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
 * GET /api/admin/products
 * Admin-only product listing with optional search and inactive inclusion.
 */
exports.getProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 500,
      search = "",
      includeInactive = "true",
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(2000, Math.max(1, parseInt(limit, 10) || 500));
    const q = String(search || "").trim();

    const filter = {};

    if (String(includeInactive).toLowerCase() !== "true") {
      filter.isActive = true;
    }

    if (q) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { sku: { $regex: escaped, $options: "i" } },
        { name: { $regex: escaped, $options: "i" } },
        { brand: { $regex: escaped, $options: "i" } },
        { category: { $regex: escaped, $options: "i" } },
        { subcategory: { $regex: escaped, $options: "i" } },
        { color: { $regex: escaped, $options: "i" } },
      ];
    }

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort({ updatedAt: -1, createdAt: -1 })
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

/**
 * POST /api/admin/fix-prices
 * One-time cleanup: round all product prices to 2 decimal places.
 * Fixes floating-point artifacts like 17.64444444444445.
 */
exports.fixPrices = async (_req, res) => {
  try {
    const products = await Product.find({}).select("salePrice rrp").lean();
    let fixed = 0;
    const bulkOps = [];

    for (const p of products) {
      const roundedSale = +Number(p.salePrice || 0).toFixed(2);
      const roundedRrp = +Number(p.rrp || 0).toFixed(2);
      if (roundedSale !== p.salePrice || roundedRrp !== p.rrp) {
        bulkOps.push({
          updateOne: {
            filter: { _id: p._id },
            update: { $set: { salePrice: roundedSale, rrp: roundedRrp } },
          },
        });
        fixed++;
      }
    }

    if (bulkOps.length > 0) {
      await Product.bulkWrite(bulkOps, { ordered: false });
    }

    res.json({
      success: true,
      message: `Rounded prices on ${fixed} of ${products.length} products.`,
      fixed,
      total: products.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/admin/cleanup-categories
 * Remove Category documents that have 0 products and are not in the
 * expected main categories list (FOOTWEAR, CLOTHING, ACCESSORIES, etc.).
 */
exports.cleanupCategories = async (_req, res) => {
  try {
    const KEEP = new Set([
      "FOOTWEAR", "CLOTHING", "ACCESSORIES",
      "LICENSED TEAM CLOTHING", "B GRADE", "SPORTS",
    ]);

    const allCats = await Category.find({}).lean();
    let removed = 0;

    for (const cat of allCats) {
      if (KEEP.has(cat.name.toUpperCase())) continue;
      // Check if any products still use this category
      const count = await Product.countDocuments({
        category: { $regex: `^${cat.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
      });
      if (count === 0) {
        await Category.findByIdAndDelete(cat._id);
        removed++;
      }
    }

    res.json({
      success: true,
      message: `Removed ${removed} unused Category documents.`,
      removed,
      total: allCats.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
