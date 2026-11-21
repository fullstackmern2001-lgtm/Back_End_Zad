const express = require("express");
const router = express.Router();

const {
  uploadCategorySingleImage,
  resizeCategoryImage,
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
} = require("../services/categoryServices");
const {
  CreateCategoryValidation,
  GetCategoryValidation,
  UpdateCategoryValidation,
  DeleteCategoryValidation,
} = require("../utils/validator/categoryValidation");
const { protect, allowedTo } = require("../services/authServices");

router
  .route("/")
  .get(getCategories)
  .post(
    protect,
    allowedTo("admin"),
    uploadCategorySingleImage,
    resizeCategoryImage,
    CreateCategoryValidation,
    createCategory,
  );

router
  .route("/:id")
  .get(GetCategoryValidation, getCategory)
  .put(
    protect,
    allowedTo("admin"),
    uploadCategorySingleImage,
    resizeCategoryImage,
    UpdateCategoryValidation,
    updateCategory,
  )
  .delete(
    protect,
    allowedTo("admin"),
    DeleteCategoryValidation,
    deleteCategory,
  );

module.exports = router;
