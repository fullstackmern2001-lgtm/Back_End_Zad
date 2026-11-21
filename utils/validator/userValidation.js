const { check } = require("express-validator");
const User = require("../../models/userModels");
const validMiddleware = require("../../middlewares/validMiddleware");
const { isStrongPassword, message: passwordStrengthMessage } = require("../passwordPolicy");

exports.updateLoggedUserValidation = [
  check("firstName")
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage("الاسم الأول يجب أن يتكون من حرفين على الأقل")
    .isString()
    .withMessage("الاسم الأول يجب أن يكون نصًا"),

  check("lastName")
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage("اسم العائلة يجب أن يتكون من حرفين على الأقل")
    .isString()
    .withMessage("اسم العائلة يجب أن يكون نصًا"),

  check("email")
    .optional()
    .trim()
    .isEmail()
    .withMessage("البريد الإلكتروني غير صالح")
    .custom(async (val, { req }) => {
      const user = await User.findOne({ email: val });

      // إذا لقى مستخدم بنفس الإيميل وكان مش نفس المستخدم الحالي
      if (user && user._id.toString() !== req.user._id.toString()) {
        return Promise.reject(new Error("البريد الإلكتروني مستخدم مسبقًا"));
      }
    }),

  check("phone")
    .optional()
    .trim()
    .isMobilePhone(["ar-PS"])
    .withMessage("رقم الهاتف الفلسطيني غير صالح"),

  check("avatar").optional(),

  // 🚫 منع تعديل role
  check("role").not().exists().withMessage("لا يمكنك تغيير صلاحية الحساب"),

  // 🚫 منع تعديل password من هنا
  check("password").not().exists().withMessage("استخدم صفحة تغيير كلمة المرور"),

  validMiddleware,
];

exports.changeValidateUserPassword = [
  check("id")
    .isMongoId()
    .withMessage("معرف المستخدم غير صالح")
    .custom((id, { req }) => {
      if (id !== req.user._id.toString()) {
        throw new Error("يمكنك تغيير كلمة المرور الخاصة بحسابك فقط");
      }
      return true;
    }),
  check("currentPassword").notEmpty().withMessage("الرجاء إدخال كلمة المرور الحالية"),
  check("newPassword")
    .isString()
    .withMessage("كلمة المرور الجديدة غير صالحة")
    .bail()
    .notEmpty()
    .withMessage("الرجاء إدخال كلمة المرور الجديدة")
    .bail()
    .isLength({ max: 128 })
    .withMessage("كلمة المرور طويلة جدًا")
    .bail()
    .custom(isStrongPassword)
    .withMessage(passwordStrengthMessage),
  check("confirmPassword")
    .isString()
    .withMessage("الرجاء تأكيد كلمة المرور الجديدة")
    .bail()
    .custom(async (val, { req }) => {
      if (req.body.newPassword !== val) {
        throw new Error("كلمتا المرور غير متطابقتين");
      }
      return true;
    }),
  validMiddleware,
];

exports.createAdminAccountValidation = [
  check("firstName")
    .isString()
    .withMessage("الاسم الأول غير صالح")
    .bail()
    .trim()
    .isLength({ min: 2, max: 30 })
    .withMessage("الاسم الأول يجب أن يكون بين حرفين و30 حرفًا"),
  check("lastName")
    .isString()
    .withMessage("اسم العائلة غير صالح")
    .bail()
    .trim()
    .isLength({ min: 2, max: 30 })
    .withMessage("اسم العائلة يجب أن يكون بين حرفين و30 حرفًا"),
  check("email")
    .isString()
    .withMessage("البريد الإلكتروني غير صالح")
    .bail()
    .trim()
    .isEmail()
    .withMessage("البريد الإلكتروني غير صالح")
    .bail()
    .custom(async (value) => {
      const user = await User.findOne({ email: value });
      if (user) throw new Error("البريد الإلكتروني مستخدم مسبقًا");
    }),
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

exports.updateAdminAccountValidation = [
  check("id").isMongoId().withMessage("معرف الحساب غير صالح"),
  check("firstName")
    .isString()
    .withMessage("الاسم الأول غير صالح")
    .bail()
    .trim()
    .isLength({ min: 2, max: 30 })
    .withMessage("الاسم الأول يجب أن يكون بين حرفين و30 حرفًا"),
  check("lastName")
    .isString()
    .withMessage("اسم العائلة غير صالح")
    .bail()
    .trim()
    .isLength({ min: 2, max: 30 })
    .withMessage("اسم العائلة يجب أن يكون بين حرفين و30 حرفًا"),
  check("email")
    .isString()
    .withMessage("البريد الإلكتروني غير صالح")
    .bail()
    .trim()
    .isEmail()
    .withMessage("البريد الإلكتروني غير صالح")
    .bail()
    .custom(async (value, { req }) => {
      const user = await User.findOne({ email: value });
      if (user && user._id.toString() !== req.params.id) {
        throw new Error("البريد الإلكتروني مستخدم مسبقًا");
      }
    }),
  check("role")
    .isIn(["user", "admin"])
    .withMessage("صلاحية الحساب غير صالحة"),
  validMiddleware,
];

exports.setAdminAccountStatusValidation = [
  check("id").isMongoId().withMessage("معرف الحساب غير صالح"),
  check("isActive")
    .isBoolean()
    .withMessage("حالة الحساب غير صالحة")
    .toBoolean(),
  validMiddleware,
];

exports.deleteAdminAccountValidation = [
  check("id").isMongoId().withMessage("معرف الحساب غير صالح"),
  validMiddleware,
];
