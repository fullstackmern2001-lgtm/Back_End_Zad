const { check } = require("express-validator");
const validMiddleware = require("../../middlewares/validMiddleware");

const titleValidation = (required) => {
  const validation = check("title");

  if (!required) validation.optional();

  return validation
    .trim()
    .notEmpty()
    .withMessage("الرجاء إدخال عنوان الخبر")
    .isLength({ min: 3, max: 150 })
    .withMessage("عنوان الخبر يجب أن يكون بين 3 و150 حرفًا");
};

const descriptionValidation = (required) => {
  const validation = check("description");

  if (!required) validation.optional();

  return validation
    .trim()
    .notEmpty()
    .withMessage("الرجاء إدخال وصف الخبر")
    .isLength({ max: 5000 })
    .withMessage("وصف الخبر طويل جدًا");
};

const imageValidation = (required) => {
  const validation = check("image");

  if (!required) validation.optional();

  return validation
    .trim()
    .notEmpty()
    .withMessage("الرجاء إضافة صورة الخبر")
    .isURL()
    .withMessage("صورة الخبر يجب أن تكون رابطًا صالحًا");
};

const publishedAtValidation = (required) => {
  const validation = check("publishedAt");

  if (!required) validation.optional();

  return validation
    .notEmpty()
    .withMessage("الرجاء إدخال تاريخ نشر الخبر")
    .isISO8601()
    .withMessage("تاريخ نشر الخبر غير صالح")
    .toDate();
};

exports.CreateNewsValidation = [
  titleValidation(true),
  descriptionValidation(true),
  imageValidation(true),
  publishedAtValidation(true),
  validMiddleware,
];

exports.GetNewsValidation = [
  check("id").isMongoId().withMessage("معرف الخبر غير صالح"),
  validMiddleware,
];

exports.UpdateNewsValidation = [
  check("id").isMongoId().withMessage("معرف الخبر غير صالح"),
  titleValidation(true),
  descriptionValidation(true),
  imageValidation(true),
  publishedAtValidation(true),
  validMiddleware,
];

exports.DeleteNewsValidation = [
  check("id").isMongoId().withMessage("معرف الخبر غير صالح"),
  validMiddleware,
];
