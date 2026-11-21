const cloudinary = require("./cloudinary");
const ApiError = require("./ApiError");

const uploadImage = (buffer, folder) =>
  new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      { folder, format: "webp", resource_type: "image" },
      (error, result) => {
        if (error) {
          if (
            error.code === "CERT_HAS_EXPIRED" ||
            error.message?.includes("certificate has expired")
          ) {
            reject(
              new ApiError(
                "تعذر الاتصال الآمن بخدمة رفع الصور لأن شهادة الاتصال منتهية. تحقق من تاريخ الجهاز والتوقيت أو إعدادات الشبكة.",
                502,
              ),
            );
            return;
          }

          if (
            error.http_code === 401 ||
            error.message?.toLowerCase().includes("api key") ||
            error.message?.toLowerCase().includes("invalid")
          ) {
            reject(
              new ApiError(
                "بيانات إعداد خدمة رفع الصور غير صحيحة. راجع إعدادات Cloudinary.",
                502,
              ),
            );
            return;
          }

          if (error.message?.includes("Stale request")) {
            reject(
              new ApiError(
                "الرجاء ضبط الساعة والتاريخ في جهازك ثم المحاولة مرة أخرى",
                400,
              ),
            );
            return;
          }

          reject(new ApiError("فشل رفع الصورة", 502));
          return;
        }

        if (!result?.secure_url) {
          reject(new ApiError("لم يتم الحصول على رابط الصورة", 502));
          return;
        }

        resolve(result.secure_url);
      },
    );

    upload.end(buffer);
  });

module.exports = uploadImage;
