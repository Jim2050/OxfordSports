const mongoose = require("mongoose");

/**
 * Order Item sub-schema — one line per product+size combination.
 */
const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    sku: { type: String, required: true },
    name: { type: String, required: true },
    size: { type: String, default: "" },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

/**
 * Order schema — groups one or more items into a single order.
 */
const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    customerName: { type: String, required: true },
    customerEmail: { type: String, required: true },
    customerCompany: { type: String, default: "" },
    customerPhone: { type: String, default: "" },
    deliveryAddress: { type: String, default: "" },
    items: {
      type: [orderItemSchema],
      validate: [(v) => v.length > 0, "Order must contain at least one item."],
    },
    totalAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "completed",
        "cancelled",
      ],
      default: "pending",
      index: true,
    },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

/**
 * Auto-generate a readable order number before save.
 * Format: OS-YYYYMMDD-XXXX (sequential per day).
 */
orderSchema.pre("save", async function () {
  if (this.orderNumber) return; // already set
  const today = new Date();
  const dateStr =
    today.getFullYear().toString() +
    String(today.getMonth() + 1).padStart(2, "0") +
    String(today.getDate()).padStart(2, "0");
  const prefix = `OS-${dateStr}-`;
  const last = await this.constructor
    .findOne({ orderNumber: { $regex: `^${prefix}` } })
    .sort({ orderNumber: -1 })
    .lean();
  const seq = last ? parseInt(last.orderNumber.split("-").pop()) + 1 : 1;
  this.orderNumber = `${prefix}${String(seq).padStart(4, "0")}`;
});

module.exports = mongoose.model("Order", orderSchema);
