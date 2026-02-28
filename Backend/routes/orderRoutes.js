/**
 * Order Routes
 * POST /api/orders          — Place a new order (member)
 * GET  /api/orders/mine     — Get own orders (member)
 */

const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { placeOrder, getMyOrders } = require("../controllers/orderController");

// All order routes require authentication
router.use(protect);

router.post("/", placeOrder);
router.get("/mine", getMyOrders);

module.exports = router;
