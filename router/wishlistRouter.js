const express = require("express");
const router = express.Router();

const {
  removeFromWishlist,
  getWishlist,
  toggleWishlist,
} = require("../services/wishlistServices");

const {
  addToWishlistValidator,
  removeFromWishlistValidator,
} = require("../utils/validator/wishlistValidation");

const { protect } = require("../services/authServices");

/**
 * @desc    Get logged-in user's wishlist
 * @route   GET /api/v1/wishlist
 * @access  Private/User
 */
router.get("/", protect, getWishlist);

/**
 * @desc    Toggle a service in the wishlist
 * @route   POST /api/v1/wishlist
 * @access  Private/User
 */
router.post("/", protect, addToWishlistValidator, toggleWishlist);

/**
 * @desc    Remove service from wishlist
 * @route   DELETE /api/v1/wishlist/:serviceId
 * @access  Private/User
 */
router.delete(
  "/:serviceId",
  protect,
  removeFromWishlistValidator,
  removeFromWishlist,
);

module.exports = router;
