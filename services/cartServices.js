const asyncHandler = require("express-async-handler");
const Cart = require("../models/cartModel");
const Service = require("../models/serviceModel");
const ApiError = require("../utils/ApiError");
const calcTotalCartPrice = require("../utils/calcTotalCartPrice");

// ==================== Add Service to Cart ====================
exports.addServiceToCart = asyncHandler(async (req, res, next) => {
  const { serviceId, quantity = 1 } = req.body;
  const parsedQuantity = Number(quantity);

  const service = await Service.findById(serviceId);
  if (!service) return next(new ApiError("الخدمة غير موجودة", 404));

  const minimumQuantity = Math.max(
    1,
    Math.ceil(Number(service.minQuantity ?? 1)),
  );
  const requestedQuantity = Number.isFinite(parsedQuantity)
    ? parsedQuantity
    : minimumQuantity;

  if (
    !Number.isInteger(requestedQuantity) ||
    requestedQuantity < minimumQuantity
  ) {
    return next(
      new ApiError(
        `الحد الأدنى للتبرع لهذه الخدمة هو ${minimumQuantity} قطعة`,
        400,
      ),
    );
  }

  const itemPrice = Number(service.price);

  let cart = await Cart.findOne({ user: req.user._id });
  const existingItem = cart?.cartItems.find(
    (item) => item.service.toString() === serviceId,
  );
  if (!cart) {
    cart = await Cart.create({
      user: req.user._id,
      cartItems: [
        {
          service: serviceId,
          quantity: requestedQuantity,
          price: itemPrice,
        },
      ],
    });
  } else {
    if (existingItem) {
      existingItem.quantity += requestedQuantity;
      existingItem.price = itemPrice;
    } else {
      cart.cartItems.push({
        service: serviceId,
        quantity: requestedQuantity,
        price: itemPrice,
      });
    }
    cart.revision = (cart.revision || 0) + 1;
  }

  await calcTotalCartPrice(cart);

  cart = await Cart.findById(cart._id).populate({
    path: "cartItems.service",
    select: "name description image price minQuantity",
  });

  res.status(200).json({
    status: "success",
    message: "Service added to cart successfully",
    numberOfCartItem: cart.cartItems.length,
    data: cart,
  });
});

// ==================== Get Logged User Cart ====================
exports.getLoggedUserCart = asyncHandler(async (req, res, next) => {
  let cart = await Cart.findOne({ user: req.user._id }).populate({
    path: "cartItems.service",
    select: "name description image price minQuantity",
  });

  if (!cart) {
    return res.status(200).json({
      status: "success",
      numberOfCartItem: 0,
      data: {
        cartItems: [],
        totalCartPrice: 0,
      },
    });
  }

  const validCartItems = cart.cartItems.filter((item) => item.service);
  if (validCartItems.length !== cart.cartItems.length) {
    cart.cartItems = validCartItems;
    cart.revision = (cart.revision || 0) + 1;
    await calcTotalCartPrice(cart);
  }

  res.status(200).json({
    status: "success",
    numberOfCartItem: cart.cartItems.length,
    data: cart,
  });
});

// ==================== Remove Service from Cart ====================
exports.removeCartService = asyncHandler(async (req, res, next) => {
  const { itemId } = req.params;

  let cart = await Cart.findOneAndUpdate(
    { user: req.user._id },
    { $pull: { cartItems: { _id: itemId } } },
    { new: true },
  );

  if (!cart) return next(new ApiError("لا توجد سلة لهذا المستخدم", 404));

  cart.revision = (cart.revision || 0) + 1;
  await calcTotalCartPrice(cart);

  cart = await Cart.findById(cart._id).populate({
    path: "cartItems.service",
    select: "name description image price minQuantity",
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
    message: "All services removed from cart",
  });
});

// ==================== Update Cart Product Quantity ====================
exports.updateCartServiceQuantity = asyncHandler(async (req, res, next) => {
  const { itemId } = req.params;
  const { quantity } = req.body;

  let cart = await Cart.findOne({ user: req.user._id });
  if (!cart) return next(new ApiError("لا توجد سلة لهذا المستخدم", 404));

  const itemIndex = cart.cartItems.findIndex(
    (item) => item._id.toString() === itemId,
  );

  if (itemIndex === -1)
    return next(new ApiError("عنصر السلة المطلوب غير موجود", 404));

  const cartItem = cart.cartItems[itemIndex];
  const service = await Service.findById(cartItem.service).select("minQuantity price");
  if (!service) return next(new ApiError("الخدمة غير موجودة", 404));
  const minQuantity = Math.max(1, Math.ceil(Number(service.minQuantity ?? 1)));
  const requestedQuantity = Number(quantity);

  if (!Number.isInteger(requestedQuantity) || requestedQuantity < minQuantity) {
    return next(
      new ApiError(
        `الحد الأدنى للتبرع لهذه الخدمة هو ${minQuantity} قطعة`,
        400,
      ),
    );
  }

  cart.cartItems[itemIndex].quantity = requestedQuantity;
  cart.cartItems[itemIndex].price = Number(service.price);
  cart.revision = (cart.revision || 0) + 1;

  await calcTotalCartPrice(cart);

  cart = await Cart.findById(cart._id).populate({
    path: "cartItems.service",
    select: "name description image price minQuantity",
  });

  res.status(200).json({
    status: "success",
    numberOfCartItem: cart.cartItems.length,
    data: cart,
  });
});
