/**
 * Auth Routes — Member registration and login
 * POST /api/auth/register
 * POST /api/auth/login
 * GET  /api/auth/me
 */

const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
const memberStore = require("../services/memberStore");

const JWT_SECRET = process.env.JWT_SECRET || "oxford-sports-secret-2026";
const JWT_EXPIRES = "7d";

function signToken(member) {
  return jwt.sign({ id: member.id, role: member.role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES,
  });
}

/**
 * POST /api/auth/register
 */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, company } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ error: "Name, email, and password are required." });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters." });
    }

    const member = await memberStore.register({
      name,
      email,
      password,
      company,
    });
    const token = signToken(member);

    res.status(201).json({
      success: true,
      token,
      user: member,
    });
  } catch (err) {
    if (err.message.includes("already exists")) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/auth/login
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email and password are required." });
    }

    const member = await memberStore.authenticate(email, password);
    if (!member) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = signToken(member);

    res.json({
      success: true,
      token,
      user: member,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/auth/me
 * Returns current user profile (requires valid token)
 */
router.get("/me", (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided." });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const member = memberStore.findById(decoded.id);

    if (!member) {
      return res.status(404).json({ error: "User not found." });
    }

    res.json({ success: true, user: member });
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Invalid or expired token." });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
