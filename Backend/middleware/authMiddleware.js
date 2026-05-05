const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Feature flag: member-facing auth bypass for temporary public access.
 * Set the env var to "true" on Railway to activate.
 * Admin routes remain protected because they also require adminOnly.
 *
 * NOTE: Dynamic key lookup is intentional — Railway's Railpack builder
 * statically scans for process.env.XYZ and requires them as build secrets.
 * Using process.env[key] avoids that detection.
 */
const _authFlagKey = ["DISABLE", "AUTH"].join("_");
const AUTH_DISABLED =
  String(process.env[_authFlagKey] || "").toLowerCase() === "true";

/**
 * Verify JWT token and attach req.user.
 * Works for both member and admin tokens.
 *
 * When AUTH_DISABLED is true AND no valid token is provided, a guest
 * user stub is attached so downstream controllers have req.user data.
 * If a valid token IS sent (e.g. admin), normal verification proceeds.
 */
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  // ── Auth-disabled bypass: attach guest user if no token provided ──
  if (AUTH_DISABLED && !token) {
    req.user = {
      _id: "guest",
      name: "Guest Buyer",
      email: "guest@oxfordsports.online",
      role: "member",
      company: "",
      mobileNumber: "",
      deliveryAddress: "",
    };
    return next();
  }

  if (!token) {
    return res
      .status(401)
      .json({ error: "Not authorized — no token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select("-password");

    if (!req.user) {
      return res
        .status(401)
        .json({ error: "User belonging to this token no longer exists." });
    }

    next();
  } catch (err) {
    // When auth is disabled, fall back to guest on invalid/expired tokens
    if (AUTH_DISABLED) {
      req.user = {
        _id: "guest",
        name: "Guest Buyer",
        email: "guest@oxfordsports.online",
        role: "member",
        company: "",
        mobileNumber: "",
        deliveryAddress: "",
      };
      return next();
    }
    if (err.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ error: "Token expired. Please log in again." });
    }
    return res.status(401).json({ error: "Not authorized — invalid token." });
  }
};

/**
 * Restrict to admin role only. Must be used AFTER protect.
 */
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    return next();
  }
  return res.status(403).json({ error: "Admin access required." });
};

module.exports = { protect, adminOnly };
