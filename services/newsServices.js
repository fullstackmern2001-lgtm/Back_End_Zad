const asyncHandler = require("express-async-handler");
const uploadImage = require("../utils/uploadToCloudinary");
const News = require("../models/newsModel");
const Factory = require("./handelFactor");
const { uploadSingleImage } = require("../middlewares/uploadMiddleware");

exports.uploadNewsSingleImage = uploadSingleImage("image");

exports.uploadNewsImage = asyncHandler(async (req, res, next) => {
  if (!req.file) return next();

  req.body.image = await uploadImage(req.file.buffer, "news");
  next();
});

exports.createNews = Factory.createOne(News);
exports.getNews = asyncHandler(async (req, res) => {
  const news = await News.find().sort({ publishedAt: -1, createdAt: -1 });

  res.status(200).json({
    status: "success",
    results: news.length,
    data: news,
  });
});
exports.getOneNews = Factory.getOne(News);
exports.updateNews = Factory.updateOne(News);
exports.deleteNews = Factory.deleteOne(News);
