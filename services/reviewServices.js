// reviewServices.js
const Review = require("../models/reviewModel");
const Factory = require("./handelFactor");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("express-async-handler");

exports.setServiceId = (req, res, next) => {
  if (!req.body.service && req.params.serviceId) {
    req.body.service = req.params.serviceId;
  }
  req.body.user = req.user._id;
  next();
};

exports.createFilterObj = (req, res, next) => {
  let filter = {};
  if (req.params.serviceId) filter = { service: req.params.serviceId };
  else if (req.query.service) filter = { service: req.query.service };
  req.filterObj = filter;
  next();
};

exports.createReview = async (req, res, next) => {
  try {
    const review = await Review.create(req.body);

    // نعمل populate للـ user مباشرة بعد الإنشاء
    await review.populate({ path: "user", select: "firstName avatar" });

    res.status(201).json({
      status: "success",
      data: review,
    });
  } catch (err) {
    next(err);
  }
};
// CRUD
exports.getReviews = Factory.getAll(Review);

exports.getAllReviewsForAdmin = async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const totalItems = await Review.countDocuments();
    const reviews = await Review.find()
      .populate({ path: "service", select: "name image" })
      .sort("-createdAt")
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      status: "success",
      results: reviews.length,
      paginationResult: {
        currentPage: page,
        limit,
        totalItems,
        numberOfPages: Math.ceil(totalItems / limit),
        ...(page > 1 ? { prev: page - 1 } : {}),
        ...(page * limit < totalItems ? { next: page + 1 } : {}),
      },
      data: reviews,
    });
  } catch (error) {
    next(error);
  }
};

exports.getServiceReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find()
      .populate({
        path: "service",
        select: "name image",
      })
      .sort("-createdAt")
      .limit(Number(req.query.limit) || 20);

    const serviceReviews = reviews.filter((review) => review.service);

    res.status(200).json({
      results: serviceReviews.length,
      data: serviceReviews,
    });
  } catch (error) {
    next(error);
  }
};

// exports.createReview = Factory.createOne(Review);
exports.getReview = Factory.getOne(Review);
exports.updateReview = asyncHandler(async (req, res, next) => {
  const updates = {};
  for (const field of ["rating", "title"]) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  const filter = { _id: req.params.id, user: req.user._id };
  const review =
    Object.keys(updates).length > 0
      ? await Review.findOneAndUpdate(filter, updates, {
          new: true,
          runValidators: true,
        })
      : await Review.findOne(filter);

  if (!review) {
    return next(new ApiError("العنصر المطلوب غير موجود", 404));
  }

  return res.status(200).json({ data: review });
});
exports.deleteReview = Factory.deleteOne(Review);
