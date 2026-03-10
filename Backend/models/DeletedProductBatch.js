const mongoose = require("mongoose");

/**
 * Stores a snapshot of products before bulk deletion.
 * Allows admin to restore products if accidentally deleted.
 */
const deletedProductBatchSchema = new mongoose.Schema(
  {
    /** Who triggered the deletion */
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    /** Reason / trigger description */
    reason: { type: String, default: "Manual clear all" },

    /** How many products were in this batch */
    count: { type: Number, required: true },

    /** Full product data snapshot (JSON array) */
    products: { type: mongoose.Schema.Types.Mixed, required: true },

    /** Whether this batch has been restored */
    restored: { type: Boolean, default: false },
    restoredAt: { type: Date },
  },
  { timestamps: true },
);

// Auto-expire old backups after 30 days to save space
deletedProductBatchSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 },
);

module.exports = mongoose.model("DeletedProductBatch", deletedProductBatchSchema);
