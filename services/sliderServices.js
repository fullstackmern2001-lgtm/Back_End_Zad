const asyncHandler = require("express-async-handler");

const Factory = require("./handelFactor");
const Slider = require("../models/sliderModel");
const { uploadSingleImage } = require("../middlewares/uploadMiddleware");
const uploadImage = require("../utils/uploadToCloudinary");

exports.uploadSliderSingleImage = uploadSingleImage("image");

exports.resizeImage = asyncHandler(async (req, res, next) => {
  if (!req.file) return next();

  req.body.image = await uploadImage(req.file.buffer, "slider");
  next();
});

// @ desc Create Slider
// @router post /api/v1/slider
// @access Privet
exports.CreateSlider = Factory.createOne(Slider);

// @desc GET Slider
// @router Get /api/v1/slider
// @access Public
exports.getSliders = Factory.getAll(Slider, "", {
  filterFields: {
    name: { type: "string", maxLength: 30 },
  },
  searchFields: ["name"],
  sortFields: ["name", "createdAt", "updatedAt"],
  selectFields: ["name", "des", "image", "createdAt", "updatedAt"],
  defaultLimit: 50,
  maxLimit: 50,
  maxPage: 10000,
});

// desc Get Specific Slider by id
// @router Get /api/v1/slider/sliderId
// @access Public
exports.GetSlider = Factory.getOne(Slider);

// desc Update Slider by id
// @router Put /api/v1/slider/sliderId
// @access Public
exports.UpdateSlider = Factory.updateOne(Slider);
// desc Delete Slider by id
// @router Put /api/v1/slider/sliderId
// @access Public
exports.deleteSlider = Factory.deleteOne(Slider);
