const { check, query } = require("express-validator");
const validMiddleware = require("../../middlewares/validMiddleware");

const titleValidation = (required) => {
  const validation = check("title");
  if (!required) validation.optional();

  return validation
    .trim()
    .notEmpty()
    .withMessage("الرجاء إدخال عنوان التوثيق")
    .isLength({ min: 3, max: 150 })
    .withMessage("عنوان التوثيق يجب أن يكون بين 3 و150 حرفًا");
};

const descriptionValidation = (required) => {
  const validation = check("description");
  if (!required) validation.optional();

  return validation
    .trim()
    .notEmpty()
    .withMessage("الرجاء إدخال وصف التوثيق")
    .isLength({ min: 3, max: 5000 })
    .withMessage("وصف التوثيق يجب أن يكون بين 3 و5000 حرف");
};

const imageValidation = (required) => {
  const validation = check("image");
  if (!required) validation.optional();

  return validation
    .notEmpty()
    .withMessage("الرجاء إضافة صورة التوثيق")
    .isURL()
    .withMessage("صورة التوثيق يجب أن تكون رابطًا صالحًا");
};

exports.GetProofsValidation = [
  query("page")
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage("رقم الصفحة يجب أن يكون بين 1 و10000"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("عدد العناصر في الصفحة يجب أن يكون بين 1 و50"),
  validMiddleware,
];

exports.GetProofValidation = [
  check("id").isMongoId().withMessage("معرف التوثيق غير صالح"),
  validMiddleware,
];

exports.CreateProofValidation = [
  titleValidation(true),
  descriptionValidation(true),
  imageValidation(true),
  validMiddleware,
];

exports.UpdateProofValidation = [
  check("id").isMongoId().withMessage("معرف التوثيق غير صالح"),
  titleValidation(false),
  descriptionValidation(false),
  imageValidation(false),
  validMiddleware,
];

exports.DeleteProofValidation = [
  check("id").isMongoId().withMessage("معرف التوثيق غير صالح"),
  validMiddleware,
];
