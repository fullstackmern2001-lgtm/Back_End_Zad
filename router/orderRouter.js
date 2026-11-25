const express = require("express");
const router = express.Router();

const {
  getAllOrder,
  getOrder,
  filterOrderForLoggedUser,
  updateOrderDelivered,
  checkoutSession,
  getStripeCheckoutStatus,
  capturePayPalCheckout,
  cancelPayPalCheckout,
  paypalWebhook,
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

router.post(
  "/paypal/capture/:paypalOrderId",
  authServces.protect,
  authServces.allowedTo("user"),
  checkoutLimiter,
  capturePayPalCheckout,
);

router.post(
  "/paypal/cancel/:paypalOrderId",
  authServces.protect,
  authServces.allowedTo("user"),
  checkoutLimiter,
  cancelPayPalCheckout,
);

router.post("/paypal-webhook", paypalWebhook);

// Backward compatibility for already-deployed frontend clients.
router.get(
  "/checkout-session/:cartId",
  authServces.protect,
  authServces.allowedTo("user"),
  checkoutLimiter,
  checkoutSession,
);

router.get(
  "/checkout-session/:sessionId/status",
  authServces.protect,
  authServces.allowedTo("user"),
  checkoutLimiter,
  getStripeCheckoutStatus,
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
