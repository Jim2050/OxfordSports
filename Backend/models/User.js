const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 6, select: false },
    company: { type: String, default: "" },
    mobileNumber: { type: String, default: "", trim: true },
    deliveryAddress: { type: String, default: "", trim: true },
    role: {
      type: String,
      enum: ["member", "admin"],
      default: "member",
    },
    isApproved: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// ── Hash password before save ──
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// ── Compare candidate password against stored hash ──
userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// ── Auto-strip password from JSON output ──
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
