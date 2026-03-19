const mongoose = require("mongoose");
const {
  deriveBrandCanonical,
  deriveCategoryCanonical,
  deriveGenderCanonical,
  deriveSportCanonical,
  deriveSubcategoryCanonical,
} = require("../utils/taxonomyUtils");

/**
 * Size-stock sub-schema: each entry is one size with its quantity.
 * Example: { size: "8", quantity: 3 }
 */
const sizeEntrySchema = new mongoose.Schema(
  {
    size: { type: String, required: true, trim: true },
    quantity: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const productSchema = new mongoose.Schema(
  {
    sku: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    category: { type: String, default: "", index: true },
    subcategory: { type: String, default: "" },
    categoryCanonical: { type: String, default: "", index: true },
    subcategoryCanonical: { type: String, default: "", index: true },
    sportCanonical: { type: String, default: "", index: true },
    genderCanonical: { type: String, default: "", index: true },
    brand: { type: String, default: "", index: true },
    brandCanonical: { type: String, default: "", index: true },
    color: { type: String, default: "" },
    barcode: { type: String, default: "" },

    /* ── Pricing ── */
    salePrice: { type: Number, required: true, min: 0, index: true },
    rrp: { type: Number, default: 0, min: 0 },

    /* ── Sizes with per-size stock ── */
    sizes: { type: [sizeEntrySchema], default: [] },

    /* ── Total quantity (sum of all sizes; computed on save) ── */
    totalQuantity: { type: Number, default: 0, min: 0 },

    /* ── Images ── */
    imageUrl: { type: String, default: "" },
    imagePublicId: { type: String, default: "" },

    /* ── Metadata ── */
    sheetName: { type: String, default: "" },
    isActive: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        // Backward-compat aliases for frontend
        ret.image = ret.imageUrl || "";
        ret.stockQuantity = ret.totalQuantity || 0;
        // Only overwrite price/quantity if source values are valid numbers
        const sp = Number(ret.salePrice);
        if (!isNaN(sp) && sp >= 0) ret.price = sp;
        ret.quantity = ret.totalQuantity || 0;
        // Discount percentage (computed)
        const rrp = Number(ret.rrp) || 0;
        const sale = !isNaN(sp) ? sp : Number(ret.price) || 0;
        ret.discountPercentage =
          rrp > 0 && sale < rrp ? Math.round(((rrp - sale) / rrp) * 100) : 0;
        // Legacy sizeStock map for backward compat
        const sizeStock = {};
        if (Array.isArray(ret.sizes)) {
          ret.sizes.forEach((s) => {
            if (s && s.size) sizeStock[s.size] = Number(s.quantity) || 0;
          });
        }
        ret.sizeStock = sizeStock;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform(_doc, ret) {
        ret.image = ret.imageUrl || "";
        ret.stockQuantity = ret.totalQuantity || 0;
        const sp = Number(ret.salePrice);
        if (!isNaN(sp) && sp >= 0) ret.price = sp;
        ret.quantity = ret.totalQuantity || 0;
        const rrp = Number(ret.rrp) || 0;
        const sale = !isNaN(sp) ? sp : Number(ret.price) || 0;
        ret.discountPercentage =
          rrp > 0 && sale < rrp ? Math.round(((rrp - sale) / rrp) * 100) : 0;
        const sizeStock = {};
        if (Array.isArray(ret.sizes)) {
          ret.sizes.forEach((s) => {
            if (s && s.size) sizeStock[s.size] = Number(s.quantity) || 0;
          });
        }
        ret.sizeStock = sizeStock;
        return ret;
      },
    },
  },
);

// ── Pre-save: compute totalQuantity + canonical fields ──
productSchema.pre("save", function (next) {
  try {
    if (Array.isArray(this.sizes)) {
      this.totalQuantity = this.sizes.reduce(
        (sum, s) => sum + (s.quantity || 0),
        0,
      );
    }

    this.categoryCanonical = deriveCategoryCanonical(this.category);
    this.subcategoryCanonical = deriveSubcategoryCanonical(
      this.categoryCanonical || this.category,
      this.subcategory,
    );
    this.sportCanonical = deriveSportCanonical({
      name: this.name,
      description: this.description,
      category: this.category,
      subcategory: this.subcategory,
    });
    this.genderCanonical = deriveGenderCanonical({
      rawGender: this.genderCanonical,
      sku: this.sku,
      name: this.name,
      description: this.description,
      category: this.category,
      subcategory: this.subcategory,
    });
    this.brandCanonical = deriveBrandCanonical(this.brand);
    next();
  } catch (error) {
    next(error);
  }
});

// ── Text index for full-text search ──
productSchema.index(
  {
    name: "text",
    description: "text",
    brand: "text",
    sku: "text",
    color: "text",
  },
  { weights: { name: 10, sku: 8, brand: 5, color: 3, description: 2 } },
);

// ── Compound index for category + subcategory browsing ──
productSchema.index({ category: 1, subcategory: 1 });

// ── Canonical query indexes for taxonomy v4 ──
productSchema.index({ isActive: 1, categoryCanonical: 1, subcategoryCanonical: 1 });
productSchema.index({ isActive: 1, sportCanonical: 1 });
productSchema.index({ isActive: 1, genderCanonical: 1 });
productSchema.index({ isActive: 1, brandCanonical: 1 });

// ── Compound index for active products with images-first sort ──
productSchema.index({ isActive: 1, imageUrl: 1, createdAt: -1 });

// ── Index for sorting by createdAt ──
productSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Product", productSchema);
