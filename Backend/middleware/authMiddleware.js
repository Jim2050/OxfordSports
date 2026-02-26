const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Verify JWT token and attach req.user.
 * Works for both member and admin tokens.
 */
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
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
