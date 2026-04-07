const mongoose = require("mongoose");

const importBatchSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    importedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    totalRows: { type: Number, default: 0 },
    importedRows: { type: Number, default: 0 },
    updatedRows: { type: Number, default: 0 },
    failedRows: { type: Number, default: 0 },
    errorLog: [
      {
        row: Number,
        sku: String,
        reason: String,
      },
    ],
    diagnostics: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ["pending", "processing", "complete", "failed"],
      default: "pending",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("ImportBatch", importBatchSchema);
