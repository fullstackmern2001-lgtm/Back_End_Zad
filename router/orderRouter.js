const express = require("express");
const router = express.Router();

const {
  getAllOrder,
  getOrder,
  filterOrderForLoggedUser,
  updateOrderDelivered,
  checkoutSession,
} = require("../services/orderServices");

const authServces = require("../services/authServices");
const {
  checkoutLimiter,
} = require("../middlewares/rateLimiters");

// checkout stripe
router.post(
  "/checkout-session/:cartId",
  authServces.protect,
  authServces.allowedTo("user"),
  checkoutLimiter,
  checkoutSession,
);

// Backward compatibility for already-deployed frontend clients.
router.get(
  "/checkout-session/:cartId",
  authServces.protect,
  authServces.allowedTo("user"),
  checkoutLimiter,
  checkoutSession,
);

// get orders (user + admin)
router.get(
  "/",
  authServces.protect,
  authServces.allowedTo("user", "admin"),
  filterOrderForLoggedUser,
  getAllOrder,
);

// get single order
router.get(
  "/:id",
  authServces.protect,
  authServces.allowedTo("user", "admin"),
  getOrder,
);

// ================= ADMIN =================

// update delivered
router.put(
  "/:id/deliver",
  authServces.protect,
  authServces.allowedTo("admin"),
  updateOrderDelivered,
);

module.exports = router;
