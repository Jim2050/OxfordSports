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
    price: { type: Number, required: true, min: 0, index: true },
    sizes: { type: String, default: "" },
    quantity: { type: Number, default: 0 },
    imageUrl: { type: String, default: "" },
    imagePublicId: { type: String, default: "" },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

// ── Text index for full-text search ──
productSchema.index(
  { name: "text", description: "text", brand: "text", sku: "text" },
  { weights: { name: 10, sku: 8, brand: 5, description: 2 } },
);

module.exports = mongoose.model("Product", productSchema);
