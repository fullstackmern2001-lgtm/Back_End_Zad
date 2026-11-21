const { check } = require("express-validator");
const Category = require("../../models/categoryModel");
const validMiddleware = require("../../middlewares/validMiddleware");

const nameValidation = (required) => {
  const validation = check("name");
  if (!required) validation.optional();

  return validation
    .trim()
    .notEmpty()
    .withMessage("الرجاء إدخال اسم التصنيف")
    .bail()
    .isLength({ min: 2, max: 80 })
    .withMessage("اسم التصنيف يجب أن يكون بين حرفين و80 حرفًا")
    .bail()
    .custom(async (value, { req }) => {
      const filter = { name: value };
      if (req.params.id) filter._id = { $ne: req.params.id };
      if (await Category.exists(filter)) {
        throw new Error("اسم التصنيف موجود بالفعل");
      }
    });
};

const imageValidation = (required) => {
  const validation = check("image");
  if (!required) validation.optional();

  return validation
    .trim()
    .notEmpty()
    .withMessage("الرجاء إضافة صورة التصنيف")
    .bail()
    .isURL()
    .withMessage("صورة التصنيف يجب أن تكون رابطًا صالحًا");
};

exports.CreateCategoryValidation = [
  nameValidation(true),
  imageValidation(true),
  validMiddleware,
];

exports.GetCategoryValidation = [
  check("id").isMongoId().withMessage("معرف التصنيف غير صالح"),
  validMiddleware,
];

exports.UpdateCategoryValidation = [
  check("id").isMongoId().withMessage("معرف التصنيف غير صالح"),
  nameValidation(true),
  imageValidation(false),
  validMiddleware,
];

exports.DeleteCategoryValidation = [
  check("id").isMongoId().withMessage("معرف التصنيف غير صالح"),
  validMiddleware,
];
