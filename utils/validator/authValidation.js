const { check } = require("express-validator");
const User = require("../../models/userModels");
const validMiddleware = require("../../middlewares/validMiddleware");
const { isStrongPassword, message: passwordStrengthMessage } = require("../passwordPolicy");

/* =========================
   Register Validation
========================= */
exports.CreateValidUser = [
  check("firstName")
    .trim()
    .notEmpty()
    .withMessage("الرجاء إدخال الاسم الأول")
    .isLength({ min: 2 })
    .withMessage("الاسم الأول يجب أن يتكون من حرفين على الأقل")
    .isString()
    .withMessage("الاسم الأول يجب أن يكون نصًا"),

  check("lastName")
    .trim()
    .notEmpty()
    .withMessage("الرجاء إدخال اسم العائلة")
    .isLength({ min: 2 })
    .withMessage("اسم العائلة يجب أن يتكون من حرفين على الأقل")
    .isString()
    .withMessage("اسم العائلة يجب أن يكون نصًا"),

  check("email")
    .trim()
    .notEmpty()
    .withMessage("الرجاء إدخال البريد الإلكتروني")
    .isEmail()
    .withMessage("البريد الإلكتروني غير صالح")
    .custom(async (val) => {
      const user = await User.findOne({ email: val });
      if (user) {
        return Promise.reject(new Error("البريد الإلكتروني مستخدم مسبقًا"));
      }
    }),

  check("password")
    .notEmpty()
    .withMessage("الرجاء إدخال كلمة المرور")
    .bail()
    .isString()
    .withMessage("كلمة المرور غير صالحة")
    .bail()
    .custom(isStrongPassword)
    .withMessage(passwordStrengthMessage)
    .custom((val, { req }) => {
      if (req.body.passwordConfirm !== val) {
        throw new Error("كلمتا المرور غير متطابقتين");
      }
      return true;
    }),

  check("passwordConfirm")
    .isString()
    .withMessage("الرجاء تأكيد كلمة المرور")
    .bail()
    .custom((value, { req }) => value === req.body.password)
    .withMessage("كلمتا المرور غير متطابقتين"),

  check("avatar").optional(),
  check("role").optional().isIn(["user", "admin"]),

  validMiddleware,
];

/* =========================
   Login Validation
========================= */
exports.LoginValidUser = [
  check("email")
    .trim()
    .notEmpty()
    .withMessage("الرجاء إدخال البريد الإلكتروني")
    .isEmail()
    .withMessage("البريد الإلكتروني غير صالح"),

  check("password").trim().notEmpty().withMessage("الرجاء إدخال كلمة المرور"),

  validMiddleware,
];

exports.ForgotPasswordValid = [
  check("email")
    .trim()
    .notEmpty()
    .withMessage("الرجاء إدخال البريد الإلكتروني")
    .bail()
    .isEmail()
    .withMessage("البريد الإلكتروني غير صالح")
    .bail()
    .isLength({ max: 254 })
    .withMessage("البريد الإلكتروني غير صالح"),
  validMiddleware,
];

exports.VerifyPasswordResetCodeValid = [
  check("email")
    .trim()
    .isEmail()
    .withMessage("البريد الإلكتروني غير صالح"),
  check("code")
    .matches(/^\d{6}$/)
    .withMessage("رمز التحقق يجب أن يتكون من 6 أرقام"),
  validMiddleware,
];

exports.ResetPasswordValid = [
  check("resetToken")
    .matches(/^[a-f0-9]{64}$/i)
    .withMessage("جلسة الاستعادة غير صالحة أو منتهية الصلاحية"),
  check("password")
    .isString()
    .withMessage("كلمة المرور غير صالحة")
    .bail()
    .isLength({ max: 128 })
    .withMessage("كلمة المرور طويلة جدًا")
    .bail()
    .custom(isStrongPassword)
    .withMessage(passwordStrengthMessage),
  check("passwordConfirm")
    .isString()
    .withMessage("تأكيد كلمة المرور غير صالح")
    .bail()
    .custom((value, { req }) => value === req.body.password)
    .withMessage("كلمتا المرور غير متطابقتين"),
  validMiddleware,
];
