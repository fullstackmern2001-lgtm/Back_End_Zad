const multer = require("multer");
const sharp = require("sharp");
const ApiError = require("../utils/ApiError");

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_INPUT_PIXELS = 40_000_000;

const mimeTypesByFormat = {
  jpeg: new Set(["image/jpeg", "image/jpg"]),
  png: new Set(["image/png"]),
  webp: new Set(["image/webp"]),
};
const allowedMimeTypes = new Set(
  Object.values(mimeTypesByFormat).flatMap((mimeTypes) => [...mimeTypes]),
);

const multerOptions = () => {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter(req, file, callback) {
      if (!allowedMimeTypes.has(file.mimetype)) {
        return callback(
          new ApiError("يسمح برفع صور JPEG وPNG وWEBP فقط", 415),
        );
      }

      callback(null, true);
    },
  });

  return upload;
};

const validateImageFile = async (file) => {
  try {
    const image = sharp(file.buffer, {
      failOn: "warning",
      limitInputPixels: MAX_INPUT_PIXELS,
    });
    const metadata = await image.metadata();

    if (!mimeTypesByFormat[metadata.format]?.has(file.mimetype)) {
      throw new ApiError("محتوى الصورة لا يطابق نوع الملف المعلن", 415);
    }

    await image.stats();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("ملف الصورة غير صالح أو تالف", 400);
  }
};

const normalizeMulterError = (error) => {
  if (!(error instanceof multer.MulterError)) return error;

  if (error.code === "LIMIT_FILE_SIZE") {
    return new ApiError("يجب ألا يتجاوز حجم الصورة 5MB", 413);
  }

  if (error.code === "LIMIT_UNEXPECTED_FILE") {
    return new ApiError("حقل رفع الصورة غير صالح", 400);
  }

  return new ApiError("تعذر معالجة ملف الصورة", 400);
};

const validateUploadedFiles = async (req) => {
  const files = req.file
    ? [req.file]
    : Object.values(req.files || {}).reduce(
        (allFiles, fieldFiles) => allFiles.concat(fieldFiles),
        [],
      );

  for (const file of files) {
    await validateImageFile(file);
  }
};

const withImageValidation = (uploadMiddleware) => (req, res, next) => {
  uploadMiddleware(req, res, (error) => {
    if (error) return next(normalizeMulterError(error));

    validateUploadedFiles(req).then(
      () => next(),
      (validationError) => next(validationError),
    );
  });
};

// للسماح بصورة واحدة
exports.uploadSingleImage = (fieldName) =>
  withImageValidation(multerOptions().single(fieldName));
// للسماح بعدة صور
exports.uploadOfMixImage = (arrOfFields) =>
  withImageValidation(multerOptions().fields(arrOfFields));
