const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/ApiError");
const Proof = require("../models/proofModel");
const uploadImage = require("../utils/uploadToCloudinary");
const { uploadSingleImage } = require("../middlewares/uploadMiddleware");

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

exports.uploadProofSingleImage = uploadSingleImage("image");

exports.uploadProofImage = asyncHandler(async (req, res, next) => {
  if (!req.file) return next();

  req.body.image = await uploadImage(req.file.buffer, "proofs");
  next();
});

exports.createProof = asyncHandler(async (req, res) => {
  const proof = await Proof.create({
    title: req.body.title,
    description: req.body.description,
    image: req.body.image,
  });

  res.status(201).json({ status: "success", data: proof });
});

exports.getProofs = asyncHandler(async (req, res) => {
  const query = req.query || {};
  if (Object.keys(query).some((field) => !["page", "limit"].includes(field))) {
    throw new ApiError("معاملات الاستعلام غير مسموحة", 400);
  }
  const page = parsePaginationValue(query.page, "page", 1, 10000);
  const limit = parsePaginationValue(query.limit, "limit", 6, 50);
  const totalItems = await Proof.countDocuments();
  const proofs = await Proof.find()
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  res.status(200).json({
    status: "success",
    results: proofs.length,
    paginationResult: {
      currentPage: page,
      limit,
      totalItems,
      numberOfPages: Math.ceil(totalItems / limit),
      ...(page > 1 ? { prev: page - 1 } : {}),
      ...(page * limit < totalItems ? { next: page + 1 } : {}),
    },
    data: proofs,
  });
});

exports.getProof = asyncHandler(async (req, res, next) => {
  const proof = await Proof.findById(req.params.id);
  if (!proof) return next(new ApiError("التوثيق المطلوب غير موجود", 404));

  res.status(200).json({ status: "success", data: proof });
});

exports.updateProof = asyncHandler(async (req, res, next) => {
  const updates = {};
  for (const field of ["title", "description", "image"]) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  const proof = await Proof.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });
  if (!proof) return next(new ApiError("التوثيق المطلوب غير موجود", 404));

  res.status(200).json({ status: "success", data: proof });
});

exports.deleteProof = asyncHandler(async (req, res, next) => {
  const proof = await Proof.findByIdAndDelete(req.params.id);
  if (!proof) return next(new ApiError("التوثيق المطلوب غير موجود", 404));

  res.status(204).send();
});
