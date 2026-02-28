const mongoose = require("mongoose");

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
    brand: { type: String, default: "", index: true },
    color: { type: String, default: "" },
    barcode: { type: String, default: "" },
    price: { type: Number, required: true, min: 0, index: true },
    rrp: { type: Number, default: 0, min: 0 },
    sizes: { type: [String], default: [] },
    /**
     * Per-size stock map — e.g. { "S": 50, "M": 30, "L": 20, "XL": 10 }
     * When present, the cart enforces stock-per-size limits.
     * When absent/empty, product uses the flat `quantity` field.
     */
    sizeStock: { type: Map, of: Number, default: {} },
    quantity: { type: Number, default: 0 },
    imageUrl: { type: String, default: "" },
    imagePublicId: { type: String, default: "" },
    sheetName: { type: String, default: "" },
    isActive: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        // Add 'image' alias for 'imageUrl' for frontend compatibility
        ret.image = ret.imageUrl;
        // Add 'stockQuantity' alias for 'quantity'
        ret.stockQuantity = ret.quantity;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: function (doc, ret) {
        ret.image = ret.imageUrl;
        ret.stockQuantity = ret.quantity;
        return ret;
      },
    },
  },
);

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

module.exports = mongoose.model("Product", productSchema);
