const express = require("express");

const router = express.Router();

const {
  uploadNewsSingleImage,
  uploadNewsImage,
  createNews,
  getNews,
  getOneNews,
  updateNews,
  deleteNews,
} = require("../services/newsServices");

const {
  CreateNewsValidation,
  GetNewsValidation,
  UpdateNewsValidation,
  DeleteNewsValidation,
} = require("../utils/validator/newsValidation");

const { protect, allowedTo } = require("../services/authServices");

router
  .route("/")
  .get(getNews)
  .post(
    protect,
    allowedTo("admin"),
    uploadNewsSingleImage,
    uploadNewsImage,
    CreateNewsValidation,
    createNews,
  );

router
  .route("/:id")
  .get(GetNewsValidation, getOneNews)
  .put(
    protect,
    allowedTo("admin"),
    uploadNewsSingleImage,
    uploadNewsImage,
    UpdateNewsValidation,
    updateNews,
  )
  .delete(
    protect,
    allowedTo("admin"),
    DeleteNewsValidation,
    deleteNews,
  );

module.exports = router;
