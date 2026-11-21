const asyncHandler = require("express-async-handler");
const uploadImage = require("../utils/uploadToCloudinary");
const ApiError = require("../utils/ApiError");
const Service = require("../models/serviceModel");
const Review = require("../models/reviewModel");
const { uploadSingleImage } = require("../middlewares/uploadMiddleware");

const serviceQueryFields = new Set([
  "page",
  "limit",
  "keyword",
  "minPrice",
  "maxPrice",
  "sort",
  "category",
]);

const serviceSortOptions = new Map([
  ["cheapest", { price: 1 }],
  ["expensive", { price: -1 }],
  ["newest", { createdAt: -1 }],
  ["-createdAt", { createdAt: -1 }],
]);
const serviceWriteFields = [
  "name",
  "description",
  "image",
  "minQuantity",
  "price",
  "category",
];

const getQueryString = (query, field, maxLength = 100) => {
  const value = query[field];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > maxLength) {
    throw new ApiError(`قيمة ${field} غير صالحة`, 400);
  }
  return value;
};

const parseQueryNumber = (value, field) => {
  if (
    typeof value !== "string" ||
    !/^\d+(?:\.\d+)?$/.test(value) ||
    !Number.isFinite(Number(value))
  ) {
    throw new ApiError(`قيمة ${field} يجب أن تكون رقمًا صالحًا`, 400);
  }
  return Number(value);
};

const parsePaginationValue = (value, field, defaultValue, maximum) => {
  if (value === undefined) return defaultValue;
  if (
    typeof value !== "string" ||
    !/^[1-9]\d*$/.test(value) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) > maximum
  ) {
    throw new ApiError(
      `قيمة ${field} يجب أن تكون عددًا صحيحًا بين 1 و${maximum}`,
      400,
    );
  }
  return Number(value);
};

exports.uploadServiceSingleImage = uploadSingleImage("image");

exports.resizeImage = asyncHandler(async (req, res, next) => {
  if (!req.file) return next();

  req.body.image = await uploadImage(req.file.buffer, "services");
  next();
});

const ensureService = asyncHandler(async (req, res, next) => {
  const service = await Service.findById(req.params.id);
  if (!service) return next(new ApiError("الخدمة غير موجودة", 404));
  req.service = service;
  next();
});

exports.ensureService = ensureService;

exports.createService = asyncHandler(async (req, res) => {
  const values = Object.fromEntries(
    serviceWriteFields
      .filter((field) => req.body[field] !== undefined)
      .map((field) => [field, req.body[field]]),
  );
  const service = await Service.create(values);
  res.status(201).json({ status: "success", data: service });
});

exports.getServices = asyncHandler(async (req, res) => {
  const query = req.query || {};
  for (const field of Object.keys(query)) {
    if (!serviceQueryFields.has(field)) {
      throw new ApiError(`معامل الاستعلام ${field} غير مسموح`, 400);
    }
  }

  const page = parsePaginationValue(query.page, "page", 1, 10000);
  const limit = parsePaginationValue(query.limit, "limit", 10, 50);
  const skip = (page - 1) * limit;
  const filter = {};
  const keyword = getQueryString(query, "keyword");
  if (keyword) {
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.name = { $regex: escapedKeyword, $options: "i" };
  }

  const category = getQueryString(query, "category", 64);
  if (category) {
    if (!/^[a-f\d]{24}$/i.test(category)) {
      throw new ApiError("معرف التصنيف غير صالح", 400);
    }
    filter.category = category;
  }

  const minPriceValue = getQueryString(query, "minPrice", 32);
  const maxPriceValue = getQueryString(query, "maxPrice", 32);
  const minPrice = minPriceValue === undefined || minPriceValue === ""
    ? null
    : parseQueryNumber(minPriceValue, "minPrice");
  const maxPrice = maxPriceValue === undefined || maxPriceValue === ""
    ? null
    : parseQueryNumber(maxPriceValue, "maxPrice");
  if (
    (minPrice !== null && minPrice < 0) ||
    (maxPrice !== null && maxPrice < 0) ||
    (minPrice !== null && maxPrice !== null && minPrice > maxPrice)
  ) {
    throw new ApiError("نطاق السعر غير صالح", 400);
  }

  if (minPrice !== null || maxPrice !== null) {
    filter.price = {};
    if (minPrice !== null) filter.price.$gte = minPrice;
    if (maxPrice !== null) filter.price.$lte = maxPrice;
  }

  const sortValue = getQueryString(query, "sort", 32);
  const sortKey = sortValue || "newest";
  if (!serviceSortOptions.has(sortKey)) {
    throw new ApiError("قيمة الترتيب غير مسموح بها", 400);
  }
  const sort = serviceSortOptions.get(sortKey);
  const totalServices = await Service.countDocuments(filter);
  const services = await Service.find(filter)
    .populate("category", "name")
    .sort(sort)
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    status: "success",
    results: totalServices,
    paginationResult: {
      currentPage: page,
      limit,
      numberOfPages: Math.ceil(totalServices / limit),
    },
    data: services,
  });
});

exports.getService = asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id);

  if (!service) throw new ApiError("الخدمة غير موجودة", 404);
  const [reviewSummary] = await Review.aggregate([
    { $match: { service: service._id } },
    {
      $group: {
        _id: "$service",
        reviewCount: { $sum: 1 },
        averageRating: { $avg: "$rating" },
      },
    },
  ]);
  res.status(200).json({
    status: "success",
    data: {
      ...service.toObject(),
      reviewCount: reviewSummary?.reviewCount || 0,
      averageRating: reviewSummary?.averageRating || 0,
    },
  });
});

exports.updateService = asyncHandler(async (req, res) => {
  for (const field of serviceWriteFields) {
    if (req.body[field] !== undefined) {
      req.service[field] = req.body[field];
    }
  }
  await req.service.save();
  res.status(200).json({ status: "success", data: req.service });
});

exports.deleteService = asyncHandler(async (req, res) => {
  await req.service.deleteOne();
  res.status(204).send();
});

exports.getSimilarServices = asyncHandler(async (req, res) => {
  const services = req.service.category
    ? await Service.find({
        _id: { $ne: req.service._id },
        category: req.service.category,
      })
        .populate("category", "name")
        .sort({ createdAt: -1 })
        .limit(8)
    : [];

  res.status(200).json({
    status: "success",
    results: services.length,
    data: services,
  });
});
