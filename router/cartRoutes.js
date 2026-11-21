const express = require("express");
const router = express.Router();

const {
  addServiceToCart,
  getLoggedUserCart,
  removeCartService,
  clearLoggedUserCart,
  updateCartServiceQuantity,
} = require("../services/cartServices");

const {
  addToCartValidator,
  updateCartItemValidator,
  removeCartItemValidator,
} = require("../utils/validator/cartValidation");

const { protect, allowedTo } = require("../services/authServices");

// add to cart
router.post(
  "/",
  protect,
  allowedTo("user"),
  addToCartValidator,
  addServiceToCart,
);

// get cart
router.get("/", protect, allowedTo("user"), getLoggedUserCart);

// remove item
router.delete(
  "/:itemId",
  protect,
  allowedTo("user"),
  removeCartItemValidator,
  removeCartService,
);

// clear cart
router.delete("/", protect, allowedTo("user"), clearLoggedUserCart);

// update quantity
router.put(
  "/:itemId",
  protect,
  allowedTo("user"),
  updateCartItemValidator,
  updateCartServiceQuantity,
);

module.exports = router;
