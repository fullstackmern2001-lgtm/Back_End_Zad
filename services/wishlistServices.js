const asyncHandler = require("express-async-handler");

const User = require("../models/userModels");
const ApiError = require("../utils/ApiError");

exports.removeFromWishlist = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id);

  if (!user.wishlist.some((id) => id.toString() === req.params.serviceId)) {
    return next(new ApiError("الخدمة غير موجودة في قائمة المفضلة", 404));
  }

  user.wishlist.pull(req.params.serviceId);
  await user.save();

  res.status(200).json({
    status: "success",
    message: "Service removed from wishlist",
    data: user.wishlist,
  });
});

exports.getWishlist = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id).populate("wishlist");
  if (!user) {
    return next(
      new ApiError("لا توجد قائمة مفضلة لهذا المستخدم", 404),
    );
  }
  res.status(200).json({
    status: "success",
    results: user.wishlist.length,
    data: user.wishlist,
  });
});

exports.toggleWishlist = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id);
  if (!user) return next(new ApiError("المستخدم غير موجود", 404));

  const serviceId = req.body.serviceId;

  const exists = user.wishlist.some((id) => id.toString() === serviceId);

  if (exists) {
    user.wishlist.pull(serviceId);
  } else {
    user.wishlist.push(serviceId);
  }

  await user.save();

  await user.populate({
    path: "wishlist",
    select: "name description image price minQuantity",
  });

  res.status(200).json({
    status: "success",
    message: exists
      ? "Service removed from wishlist"
      : "Service added to wishlist",
    data: user.wishlist,
  });
});
