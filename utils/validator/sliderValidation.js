const { check } = require("express-validator");
const Slider = require("../../models/sliderModel");
const validMiddleware = require("../../middlewares/validMiddleware");

/* =========================
   Create Slider Validation
========================= */
exports.CreateSliderValidation = [
  check("name")
    .trim()
    .notEmpty()
    .withMessage("الرجاء إدخال اسم السلايدر")
    .bail()
    .isLength({ min: 2, max: 30 })
    .withMessage("اسم السلايدر يجب أن يكون بين حرفين و30 حرفًا")
    .bail()
    .isString()
    .withMessage("اسم السلايدر يجب أن يكون نصًا")
    .bail()
    .custom(async (val) => {
      const slider = await Slider.findOne({ name: val });
      if (slider) {
        return Promise.reject(new Error("اسم السلايدر موجود مسبقًا"));
      }
    }),

  check("des")
    .optional()
    .trim()
    .isString()
    .withMessage("وصف السلايدر يجب أن يكون نصًا"),

  check("image")
    .trim()
    .notEmpty()
    .withMessage("الرجاء إضافة صورة السلايدر")
    .bail()
    .isString()
    .withMessage("بيانات صورة السلايدر غير صالحة")
    .bail()
    .isURL()
    .withMessage("رابط صورة السلايدر غير صالح"),

  validMiddleware,
];

/* =========================
   Get Slider Validation
========================= */
exports.GetSliderValidation = [
  check("id").isMongoId().withMessage("معرف السلايدر غير صالح"),
  validMiddleware,
];

/* =========================
   Update Slider Validation
========================= */
exports.UpdateSliderValidation = [
  check("id").isMongoId().withMessage("معرف السلايدر غير صالح"),

  check("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("اسم السلايدر لا يمكن أن يكون فارغًا")
    .bail()
    .isLength({ min: 2, max: 30 })
    .withMessage("اسم السلايدر يجب أن يكون بين حرفين و30 حرفًا")
    .bail()
    .isString()
    .withMessage("اسم السلايدر يجب أن يكون نصًا")
    .bail()
    .custom(async (val, { req }) => {
      const slider = await Slider.findOne({
        name: val,
        _id: { $ne: req.params.id },
      });
      if (slider) {
        return Promise.reject(new Error("اسم السلايدر موجود مسبقًا"));
      }
    }),

  check("des")
    .optional()
    .trim()
    .isString()
    .withMessage("وصف السلايدر يجب أن يكون نصًا"),

  check("image")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("صورة السلايدر لا يمكن أن تكون فارغة")
    .bail()
    .isString()
    .withMessage("بيانات صورة السلايدر غير صالحة")
    .bail()
    .isURL()
    .withMessage("رابط صورة السلايدر غير صالح"),

  validMiddleware,
];

/* =========================
   Delete Slider Validation
========================= */
exports.DeleteSliderValidation = [
  check("id").isMongoId().withMessage("معرف السلايدر غير صالح"),
  validMiddleware,
];
