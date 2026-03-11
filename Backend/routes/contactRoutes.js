/**
 * Contact Routes — Public contact form
 * POST /api/contact
 */

const express = require("express");
const router = express.Router();
const { sendContactForm } = require("../controllers/contactController");

router.post("/", sendContactForm);

module.exports = router;
