const express = require("express");
const router = express.Router();

const {
  loginService,
  registerService,
  requestPasswordReset,
  verifyPasswordResetCode,
  resetPassword,
} = require("../services/authServices");
const {
  CreateValidUser,
  LoginValidUser,
  ForgotPasswordValid,
  VerifyPasswordResetCodeValid,
  ResetPasswordValid,
} = require("../utils/validator/authValidation");
const {
  loginLimiter,
  registerLimiter,
  passwordResetRequestLimiter,
  passwordResetVerifyLimiter,
} = require("../middlewares/rateLimiters");

/**
 * @desc   Register new user
 * @route  POST /api/v1/auth/register
 * @access Public
 */
router.post("/register", registerLimiter, CreateValidUser, registerService);

/**
 * @desc   Login user
 * @route  POST /api/v1/auth/login
 * @access Public
 */
router.post("/login", loginLimiter, LoginValidUser, loginService);

router.post(
  "/forgot-password",
  passwordResetRequestLimiter,
  ForgotPasswordValid,
  requestPasswordReset,
);
router.post(
  "/verify-reset-code",
  passwordResetVerifyLimiter,
  VerifyPasswordResetCodeValid,
  verifyPasswordResetCode,
);
router.post(
  "/reset-password",
  passwordResetVerifyLimiter,
  ResetPasswordValid,
  resetPassword,
);

module.exports = router;
