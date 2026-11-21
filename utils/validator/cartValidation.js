const { check } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validMiddleware");
const Service = require("../../models/serviceModel");

exports.addToCartValidator = [
  check("serviceId")
    .notEmpty()
    .withMessage("معرف الخدمة مطلوب")
    .bail()
    .isMongoId()
    .withMessage("معرف الخدمة غير صالح")
    .bail()
    .custom(async (val, { req }) => {
      const service = await Service.findById(val);
      if (!service) {
        throw new Error("الخدمة غير موجودة");
      }
      req.service = service;
      return true;
    }),
  validatorMiddleware,
];

exports.updateCartItemValidator = [
  check("itemId").isMongoId().withMessage("معرف الخدمة في السلة غير صالح"),
  check("quantity")
    .notEmpty()
    .withMessage("الكمية مطلوبة")
    .isInt({ min: 1 })
    .withMessage("يجب أن تكون الكمية أكبر من صفر"),
  validatorMiddleware,
];

exports.removeCartItemValidator = [
  check("itemId").isMongoId().withMessage("معرف الخدمة في السلة غير صالح"),
  validatorMiddleware,
];
