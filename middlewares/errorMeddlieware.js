const ApiError = require("../utils/ApiError");

const handleJWTError = (error) => {
  if (error.name === "TokenExpiredError") {
    return new ApiError("انتهت صلاحية جلستك، يرجى تسجيل الدخول مرة أخرى", 401);
  }
  if (
    error.name === "JsonWebTokenError" ||
    error.name === "NotBeforeError"
  ) {
    return new ApiError(
      "بيانات تسجيل الدخول غير صالحة، يرجى تسجيل الدخول مرة أخرى",
      401,
    );
  }
  return error;
};

const handleDatabaseError = (error) => {
  if (error.name === "ValidationError") {
    return new ApiError(
      "البيانات المدخلة غير صالحة، يرجى التحقق من الحقول",
      400,
    );
  }
  if (error.code === 11000) {
    return new ApiError("هذه البيانات مسجلة مسبقًا", 409);
  }
  return error;
};

const globalErrorHandler = (err, req, res, next) => {
  const error = handleJWTError(handleDatabaseError(err));
  const statusCode = error.statusCode || 500;
  const status = error.status || "error";

  if (process.env.NODE_ENV === "development") {
    return res.status(statusCode).json({
      status,
      error,
      message: error.message,
      stack: error.stack,
    });
  }

  return res.status(statusCode).json({
    status,
    message:
      error.isOperational === true
        ? error.message
        : "حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى",
  });
};

module.exports = globalErrorHandler;
