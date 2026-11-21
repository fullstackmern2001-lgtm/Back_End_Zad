const { check } = require("express-validator");
const validMiddleware = require("../../middlewares/validMiddleware");

module.exports = [
  check("name")
    .isString()
    .withMessage("الاسم غير صالح")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("الاسم مطلوب")
    .bail()
    .isLength({ max: 100 })
    .withMessage("الاسم طويل جدًا"),
  check("email")
    .isString()
    .withMessage("البريد الإلكتروني غير صالح")
    .bail()
    .trim()
    .isEmail()
    .withMessage("يرجى إدخال بريد إلكتروني صالح")
    .bail()
    .isLength({ max: 254 })
    .withMessage("البريد الإلكتروني طويل جدًا"),
  check("phone")
    .isString()
    .withMessage("رقم الهاتف غير صالح")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("رقم الهاتف مطلوب")
    .bail()
    .isLength({ max: 30 })
    .withMessage("رقم الهاتف طويل جدًا"),
  check("message")
    .isString()
    .withMessage("نص الرسالة غير صالح")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("الرسالة مطلوبة")
    .bail()
    .isLength({ max: 5000 })
    .withMessage("الرسالة طويلة جدًا"),
  validMiddleware,
];
