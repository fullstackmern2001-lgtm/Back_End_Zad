const { check } = require("express-validator");
const validMiddleware = require("../../middlewares/validMiddleware");

const Review = require("../../models/reviewModel");
const Service = require("../../models/serviceModel");

// ✅ CREATE REVIEW
exports.CreateValidateReview = [
  check("rating")
    .notEmpty()
    .withMessage("التقييم مطلوب")
    .isFloat({ min: 1, max: 5 })
    .withMessage("يجب أن يكون التقييم بين 1 و5"),

  check("service")
    .isMongoId()
    .withMessage("معرف الخدمة غير صالح")
    .bail()
    .custom(async (val, { req }) => {
      const service = await Service.findById(val);
      if (!service) {
        throw new Error("الخدمة غير موجودة");
      }

      const review = await Review.findOne({
        user: req.user._id,
        service: val,
      });

      if (review) {
        throw new Error("لقد قيّمت هذه الخدمة مسبقًا");
      }

      return true;
    }),

  validMiddleware,
];

// ✅ GET REVIEW
exports.GetValidateReview = [
  check("id").isMongoId().withMessage("معرف التقييم غير صالح"),
  validMiddleware,
];

// ✅ UPDATE REVIEW
exports.UpdateValidateReview = [
  check("id")
    .isMongoId()
    .withMessage("معرف التقييم غير صالح")
    .bail()
    .custom(async (val, { req }) => {
      const review = await Review.findById(val);

      if (!review) {
        throw new Error("التقييم غير موجود");
      }
      // تأكد انه صاحب الريفيو
      if (
        String(review.user?._id || review.user) !== String(req.user._id)
      ) {
        throw new Error("ليس لديك صلاحية تنفيذ هذا الإجراء");
      }

      return true;
    }),
  check("rating")
    .optional()
    .isFloat({ min: 1, max: 5 })
    .withMessage("يجب أن يكون التقييم بين 1 و5"),
  check("title")
    .optional()
    .isString()
    .withMessage("التعليق يجب أن يكون نصًا")
    .bail()
    .isLength({ max: 1000 })
    .withMessage("التعليق طويل جدًا"),

  validMiddleware,
];

// ✅ DELETE REVIEW
exports.DeleteValidateReview = [
  check("id")
    .isMongoId()
    .withMessage("معرف التقييم غير صالح")
    .bail()
    .custom(async (val, { req }) => {
      const review = await Review.findById(val);

      if (!review) {
        throw new Error("التقييم غير موجود");
      }

      // لو user عادي
      if (req.user.role === "user") {
        if (
          String(review.user?._id || review.user) !== String(req.user._id)
        ) {
          throw new Error("ليس لديك صلاحية حذف هذا التقييم");
        }
      }

      return true;
    }),

  validMiddleware,
];
