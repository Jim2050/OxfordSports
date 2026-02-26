const express = require("express");
const router = express.Router();

/**
 * POST /api/admin/login
 * Simple password check — no user accounts needed.
 */
router.post("/login", (req, res) => {
  const { password } = req.body;
  const correctPassword = process.env.ADMIN_PASSWORD || "admin";

  if (password === correctPassword) {
    return res.json({ success: true, token: "admin-session" });
  }

  return res.status(401).json({ success: false, error: "Incorrect password." });
});

module.exports = router;
