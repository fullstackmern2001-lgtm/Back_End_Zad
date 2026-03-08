const asyncHandler = require("express-async-handler");
const Cart = require("../models/cartModel");
const Product = require("../models/productModel");
const ApiError = require("../utils/ApiError");
const calcTotalCartPrice = require("../utils/calcTotalCartPrice");

// ==================== Add Product to Cart ====================
exports.addProductsToCart = asyncHandler(async (req, res, next) => {
  const { productId, color, size } = req.body;

  const product = await Product.findById(productId);
  if (!product) return next(new ApiError("Product not found", 404));

  let cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    // Create new cart
    cart = await Cart.create({
      user: req.user._id,
      cartItems: [
        {
          product: productId,
          color,
          size,
          price: product.discountedPrice,
          quantity: 1,
        },
      ],
    });
  } else {
    // Check if product exists
    const productIndex = cart.cartItems.findIndex(
      (item) =>
        item.product.toString() === productId &&
        item.color === color &&
        item.size === size,
    );

    if (productIndex > -1) {
      cart.cartItems[productIndex].quantity += 1;
    } else {
      cart.cartItems.push({
        product: productId,
        color,
        size,
        price: product.discountedPrice,
        quantity: 1,
      });
    }
  }

  // Calculate total
  await calcTotalCartPrice(cart);

  // Populate cart before sending
  cart = await Cart.findById(cart._id).populate({
    path: "cartItems.product",
    select: "name image discountedPrice ratingsAverage brand category",
    populate: [
      { path: "brand", select: "name -_id" },
      { path: "category", select: "name -_id" },
    ],
  });

  res.status(200).json({
    status: "success",
    message: "Products added to cart successfully",
    numberOfCartItem: cart.cartItems.length,
    data: cart,
  });
});

// ==================== Get Logged User Cart ====================
exports.getLoggedUserCart = asyncHandler(async (req, res, next) => {
  const cart = await Cart.findOne({ user: req.user._id }).populate({
    path: "cartItems.product",
    select: "name image ratingsAverage brand category discountedPrice",
    populate: [
      { path: "brand", select: "name -_id" },
      { path: "category", select: "name -_id" },
    ],
  });

  if (!cart)
    return next(new ApiError(`No cart found for user: ${req.user._id}`, 404));

  res.status(200).json({
    status: "success",
    numberOfCartItem: cart.cartItems.length,
    data: cart,
  });
});

// ==================== Remove Product from Cart ====================
exports.removeCartProduct = asyncHandler(async (req, res, next) => {
  const { itemId } = req.params;

  let cart = await Cart.findOneAndUpdate(
    { user: req.user._id },
    { $pull: { cartItems: { _id: itemId } } },
    { new: true },
  );

  if (!cart)
    return next(new ApiError(`No cart found for user: ${req.user._id}`, 404));

  await calcTotalCartPrice(cart);

  cart = await Cart.findById(cart._id).populate({
    path: "cartItems.product",
    select: "name image ratingsAverage brand category discountedPrice",
    populate: [
      { path: "brand", select: "name -_id" },
      { path: "category", select: "name -_id" },
    ],
  });

  res.status(200).json({
    status: "success",
    numberOfCartItem: cart.cartItems.length,
    data: cart,
  });
});

// ==================== Clear Cart ====================
exports.clearLoggedUserCart = asyncHandler(async (req, res, next) => {
  await Cart.findOneAndDelete({ user: req.user._id });
  res.status(204).json({
    status: "success",
    message: "All products removed from cart",
  });
});

// ==================== Update Cart Product Quantity ====================
exports.updateCartProductCount = asyncHandler(async (req, res, next) => {
  const { itemId } = req.params;
  const { quantity } = req.body;

  let cart = await Cart.findOne({ user: req.user._id });
  if (!cart)
    return next(new ApiError(`No cart found for user: ${req.user._id}`, 404));

  const itemIndex = cart.cartItems.findIndex(
    (item) => item._id.toString() === itemId,
  );

  if (itemIndex === -1)
    return next(new ApiError(`No cart item found with id: ${itemId}`));

  cart.cartItems[itemIndex].quantity = quantity;

  await calcTotalCartPrice(cart);

  cart = await Cart.findById(cart._id).populate({
    path: "cartItems.product",
    select: "name image ratingsAverage brand category discountedPrice",
    populate: [
      { path: "brand", select: "name -_id" },
      { path: "category", select: "name -_id" },
    ],
  });

  res.status(200).json({
    status: "success",
    numberOfCartItem: cart.cartItems.length,
    data: cart,
  });
});
