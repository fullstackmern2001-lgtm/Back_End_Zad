const asyncHandler = require("express-async-handler");
const bcrypt = require("bcryptjs");

const User = require("../models/userModels");
const ApiError = require("../utils/ApiError");
const { uploadSingleImage } = require("../middlewares/uploadMiddleware");
const Factory = require("./handelFactor");
const uploadImage = require("../utils/uploadToCloudinary");

exports.uploadUserSingleImage = uploadSingleImage("avatar");

exports.resizeImage = asyncHandler(async (req, res, next) => {
  if (!req.file) return next();

  req.body.avatar = await uploadImage(req.file.buffer, "users");
  next();
});

// desc Update User by id
// @router Put /api/v1/user/userId
// @access Privte

exports.updateLoggedUser = asyncHandler(async (req, res, next) => {
  const allowedFields = ["firstName", "lastName", "email", "phone", "avatar"];

  const filteredBody = {};

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      filteredBody[field] = req.body[field];
    }
  });

  const user = await User.findByIdAndUpdate(req.user._id, filteredBody, {
    new: true,
    runValidators: true,
  });

  if (!user) {
    return next(new ApiError("المستخدم غير موجود", 404));
  }

  res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    data: user,
  });
});
exports.getLoggedUserData = (req, res, next) => {
  req.params.id = req.user._id;
  next();
};

// @desc    Get Logged user data
// @route   GET /api/users/getMe
// @access  Private/Protect
exports.getOne = Factory.getOne(User);

exports.changePassword = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user._id).select(
    "+password +tokenVersion",
  );
  if (!user) {
    return next(new ApiError("المستخدم غير موجود", 404));
  }

  const currentPasswordMatches = await bcrypt.compare(
    req.body.currentPassword,
    user.password,
  );
  if (!currentPasswordMatches) {
    return next(new ApiError("كلمة المرور الحالية غير صحيحة", 400));
  }

  user.password = req.body.newPassword;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  const updatedUser = user.toObject();
  delete updatedUser.password;
  delete updatedUser.tokenVersion;
  res
    .status(200)
    .json({ data: updatedUser, message: "Success Change Password" });
});

exports.getAdminAccounts = asyncHandler(async (req, res) => {
  const accounts = await User.find()
    .select("firstName lastName email role isActive createdAt")
    .sort({ createdAt: -1 });

  res.status(200).json({
    results: accounts.length,
    data: accounts,
  });
});

exports.createAdminAccount = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, password } = req.body;
  const account = await User.create({
    firstName,
    lastName,
    email,
    password,
    role: "user",
  });

  res.status(201).json({
    message: "تم إنشاء الحساب بنجاح",
    data: {
      _id: account._id,
      firstName: account.firstName,
      lastName: account.lastName,
      email: account.email,
      role: account.role,
      isActive: account.isActive,
      createdAt: account.createdAt,
    },
  });
});

exports.updateAdminAccount = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, role } = req.body;
  const account = await User.findOneAndUpdate(
    { _id: req.params.id, role: "user" },
    { firstName, lastName, email, role },
    { new: true, runValidators: true },
  ).select("firstName lastName email role isActive createdAt");

  if (!account) {
    throw new ApiError("حساب المستخدم غير موجود أو لا يمكن تعديله", 404);
  }

  res.status(200).json({
    message: "تم تحديث الحساب بنجاح",
    data: account,
  });
});

exports.setAdminAccountStatus = asyncHandler(async (req, res) => {
  const account = await User.findOneAndUpdate(
    { _id: req.params.id, role: "user" },
    {
      $set: { isActive: req.body.isActive },
      $inc: { tokenVersion: 1 },
    },
    { new: true },
  ).select("firstName lastName email role isActive createdAt");

  if (!account) {
    throw new ApiError("حساب المستخدم غير موجود أو لا يمكن تعديله", 404);
  }

  res.status(200).json({
    message: account.isActive
      ? "تم إعادة تفعيل الحساب"
      : "تم تعليق الحساب وإخراج المستخدم من الجلسات",
    data: account,
  });
});

exports.deleteAdminAccount = asyncHandler(async (req, res) => {
  const account = await User.findOneAndDelete({
    _id: req.params.id,
    role: "user",
  });

  if (!account) {
    throw new ApiError("حساب المستخدم غير موجود أو لا يمكن حذفه", 404);
  }

  res.status(200).json({
    message: "تم حذف الحساب بنجاح",
  });
});
