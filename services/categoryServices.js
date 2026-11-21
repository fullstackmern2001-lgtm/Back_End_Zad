const asyncHandler = require("express-async-handler");
const uploadImage = require("../utils/uploadToCloudinary");
const ApiError = require("../utils/ApiError");
const Category = require("../models/categoryModel");
const Service = require("../models/serviceModel");
const { uploadSingleImage } = require("../middlewares/uploadMiddleware");

exports.uploadCategorySingleImage = uploadSingleImage("image");

exports.resizeCategoryImage = asyncHandler(async (req, res, next) => {
  if (!req.file) return next();

  req.body.image = await uploadImage(req.file.buffer, "categories");
  next();
});

exports.getCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find().sort({ name: 1 });
  res.status(200).json({
    status: "success",
    results: categories.length,
    data: categories,
  });
});

exports.getCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new ApiError("التصنيف غير موجود", 404);
  res.status(200).json({ status: "success", data: category });
});

exports.createCategory = asyncHandler(async (req, res) => {
  const category = await Category.create({
    name: req.body.name,
    image: req.body.image,
  });
  res.status(201).json({ status: "success", data: category });
});

exports.updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new ApiError("التصنيف غير موجود", 404);

  category.name = req.body.name;
  if (req.body.image) category.image = req.body.image;
  await category.save();
  res.status(200).json({ status: "success", data: category });
});

exports.deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new ApiError("التصنيف غير موجود", 404);

  if (await Service.exists({ category: category._id })) {
    throw new ApiError(
      "لا يمكن حذف هذا التصنيف لوجود خدمات مرتبطة به. غيّر تصنيف الخدمات أولًا.",
      409,
    );
  }

  await category.deleteOne();
  res.status(204).send();
});
