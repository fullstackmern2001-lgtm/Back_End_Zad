const { check } = require("express-validator");
const Service = require("../../models/serviceModel");
const Category = require("../../models/categoryModel");
const validMiddleware = require("../../middlewares/validMiddleware");

const categoryValidation = (required) => {
  const validation = check("category");
  if (!required) validation.optional();

  return validation
    .notEmpty()
    .withMessage("الرجاء اختيار تصنيف الخدمة")
    .bail()
    .isMongoId()
    .withMessage("معرف التصنيف غير صالح")
    .bail()
    .custom(async (value) => {
      if (!(await Category.exists({ _id: value }))) {
        throw new Error("التصنيف المحدد غير موجود");
      }
    });
};

const imageValidation = check("image")
  .notEmpty()
  .withMessage("الرجاء إضافة صورة الخدمة")
  .isURL()
  .withMessage("الصورة يجب أن تكون رابط صالح");

exports.CreateServiceValidation = [
  check("name")
    .trim()
    .notEmpty()
    .withMessage("الرجاء إدخال اسم الخدمة")
    .bail()
    .isLength({ min: 2 })
    .withMessage("اسم الخدمة يجب أن يكون على الأقل حرفين")
    .bail()
    .custom(async (value) => {
      const service = await Service.findOne({ name: value });
      if (service) throw new Error("اسم الخدمة موجود بالفعل");
    }),
  check("description")
    .trim()
    .notEmpty()
    .isString()
    .withMessage("وصف الخدمة يجب أن يكون نصًا")
    .bail()
    .isLength({ max: 5000 })
    .withMessage("وصف الخدمة طويل جدًا"),
  check("price")
    .notEmpty()
    .withMessage("الرجاء إدخال سعر الخدمة")
    .isFloat({ min: 0 })
    .withMessage("سعر الخدمة يجب أن يكون رقمًا صالحًا"),
  check("minQuantity")
    .notEmpty()
    .withMessage("الرجاء إدخال أقل كمية للتبرع")
    .isInt({ min: 1 })
    .withMessage("أقل كمية للتبرع يجب أن تكون عددًا صحيحًا أكبر من صفر"),
  categoryValidation(true),
  imageValidation,
  validMiddleware,
];

exports.GetServiceValidation = [
  check("id").isMongoId().withMessage("معرف الخدمة غير صالح"),
  validMiddleware,
];

exports.UpdateServiceValidation = [
  check("id").isMongoId().withMessage("معرف الخدمة غير صالح"),
  check("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("اسم الخدمة لا يمكن أن يكون فارغًا")
    .bail()
    .isLength({ min: 2 })
    .withMessage("اسم الخدمة يجب أن يكون على الأقل حرفين")
    .bail()
    .custom(async (value, { req }) => {
      const service = await Service.findOne({
        name: value,
        _id: { $ne: req.params.id },
      });
      if (service) throw new Error("اسم الخدمة موجود بالفعل");
    }),
  check("description")
    .optional()
    .trim()
    .notEmpty()
    .isString()
    .withMessage("وصف الخدمة يجب أن يكون نصًا")
    .bail()
    .isLength({ max: 5000 })
    .withMessage("وصف الخدمة طويل جدًا"),
  check("price")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("سعر الخدمة يجب أن يكون رقمًا صالحًا"),
  check("minQuantity")
    .optional()
    .isInt({ min: 1 })
    .withMessage("أقل كمية للتبرع يجب أن تكون عددًا صحيحًا أكبر من صفر"),
  categoryValidation(false),
  check("image").optional().isURL().withMessage("الصورة يجب أن تكون رابط صالح"),
  validMiddleware,
];

exports.DeleteServiceValidation = [
  check("id").isMongoId().withMessage("معرف الخدمة غير صالح"),
  validMiddleware,
];
