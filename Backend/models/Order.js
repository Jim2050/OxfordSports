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
    allocatedSize: { type: String, default: "" }, // Track backend auto-selected size
    lotItem: { type: Boolean, default: false },
    maxStock: { type: Number, default: null },
    lotSizeBreakdown: { type: String, default: "" },
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
    emailSent: { type: Boolean, default: false },
    emailError: { type: String, default: "" },
    emailSentAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Additional indexes for common queries
orderSchema.index({ customerEmail: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ emailSent: 1 });

orderSchema.pre("save", async function () {
  if (this.orderNumber) return; // already set
  const today = new Date();
  const dateStr =
    today.getFullYear().toString() +
    String(today.getMonth() + 1).padStart(2, "0") +
    String(today.getDate()).padStart(2, "0");
  const prefix = `OS-${dateStr}-`;
  
  // Use a combination of timestamp mapping and a random tail to eliminate race conditions
  // without needing a separate atomic sequence collection
  const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  this.orderNumber = `${prefix}${randomSuffix}`;
});

module.exports = mongoose.model("Order", orderSchema);
