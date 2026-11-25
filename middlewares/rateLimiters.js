const { rateLimit } = require("express-rate-limit");

const parsePositiveIntegerEnv = (name, defaultValue, maximum) => {
  const value = process.env[name];
  if (value === undefined) return defaultValue;

  if (
    !/^[1-9]\d*$/.test(value) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) > maximum
  ) {
    throw new Error(`${name} must be a positive integer no greater than ${maximum}`);
  }

  return Number(value);
};

const getRateLimitSettings = (prefix, defaultWindowMs, defaultLimit) => ({
  windowMs: parsePositiveIntegerEnv(
    `${prefix}_RATE_LIMIT_WINDOW_MS`,
    defaultWindowMs,
    2147483647,
  ),
  limit: parsePositiveIntegerEnv(
    `${prefix}_RATE_LIMIT_MAX`,
    defaultLimit,
    Number.MAX_SAFE_INTEGER,
  ),
});

const createRateLimiter = (windowMs, limit, message, options = {}) =>
  rateLimit({
    windowMs,
    limit,
    statusCode: 429,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: "fail",
      message,
    },
    skip: (req) => req.method === "OPTIONS",
    ...options,
  });

const defaultWindowMs = 15 * 60 * 1000;

const WEBHOOK_PATH_SEGMENTS = ["webhook-checkout", "paypal-webhook"];

const apiSettings = getRateLimitSettings("API", defaultWindowMs, 300);
exports.apiLimiter = createRateLimiter(
  apiSettings.windowMs,
  apiSettings.limit,
  "Too many requests. Please try again later.",
  {
    skip: (req) =>
      req.method === "OPTIONS" ||
      WEBHOOK_PATH_SEGMENTS.some((segment) => req.path.includes(segment)),
  },
);

const loginSettings = getRateLimitSettings("LOGIN", defaultWindowMs, 10);
exports.loginLimiter = createRateLimiter(
  loginSettings.windowMs,
  loginSettings.limit,
  "Too many login attempts. Please try again later.",
  { skipSuccessfulRequests: true },
);

const registerSettings = getRateLimitSettings(
  "REGISTER",
  60 * 60 * 1000,
  5,
);
exports.registerLimiter = createRateLimiter(
  registerSettings.windowMs,
  registerSettings.limit,
  "Too many registration attempts. Please try again later.",
);

const passwordChangeSettings = getRateLimitSettings(
  "PASSWORD_CHANGE",
  defaultWindowMs,
  5,
);
exports.passwordChangeLimiter = createRateLimiter(
  passwordChangeSettings.windowMs,
  passwordChangeSettings.limit,
  "Too many password change attempts. Please try again later.",
);

const checkoutSettings = getRateLimitSettings(
  "CHECKOUT",
  defaultWindowMs,
  20,
);
exports.checkoutLimiter = createRateLimiter(
  checkoutSettings.windowMs,
  checkoutSettings.limit,
  "Too many checkout attempts. Please try again later.",
);

const contactSettings = getRateLimitSettings(
  "CONTACT",
  60 * 60 * 1000,
  5,
);
exports.contactLimiter = createRateLimiter(
  contactSettings.windowMs,
  contactSettings.limit,
  "وصلت إلى الحد المسموح لإرسال الرسائل. يرجى المحاولة لاحقًا.",
);

const passwordResetRequestSettings = getRateLimitSettings(
  "PASSWORD_RESET_REQUEST",
  60 * 60 * 1000,
  5,
);
exports.passwordResetRequestLimiter = createRateLimiter(
  passwordResetRequestSettings.windowMs,
  passwordResetRequestSettings.limit,
  "وصلت إلى الحد المسموح لطلبات استعادة كلمة المرور. حاول لاحقًا.",
);

const passwordResetVerifySettings = getRateLimitSettings(
  "PASSWORD_RESET_VERIFY",
  defaultWindowMs,
  15,
);
exports.passwordResetVerifyLimiter = createRateLimiter(
  passwordResetVerifySettings.windowMs,
  passwordResetVerifySettings.limit,
  "وصلت إلى الحد المسموح لمحاولات التحقق. حاول لاحقًا.",
);
