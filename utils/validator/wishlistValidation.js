const { check } = require("express-validator");
const mongoose = require("mongoose");

const validMiddleware = require("../../middlewares/validMiddleware");
const Service = require("../../models/serviceModel");

exports.addToWishlistValidator = [
  check("serviceId")
    .notEmpty()
    .withMessage("معرف الخدمة مطلوب")

    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage("معرف الخدمة غير صالح")

    .custom(async (value) => {
      const service = await Service.findById(value);
      if (!service) {
        throw new Error("الخدمة غير موجودة");
      }
      return true;
    }),

  validMiddleware,
];

exports.removeFromWishlistValidator = [
  check("serviceId")
    .notEmpty()
    .withMessage("معرف الخدمة مطلوب")

    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage("معرف الخدمة غير صالح"),

  validMiddleware,
];
