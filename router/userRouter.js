const express = require("express");
const router = express.Router();

const {
  uploadUserSingleImage,
  resizeImage,
  updateLoggedUser,
  getOne,
  getLoggedUserData,
  changePassword,
  getAdminAccounts,
  createAdminAccount,
  updateAdminAccount,
  setAdminAccountStatus,
  deleteAdminAccount,
} = require("../services/userServices");

const {
  updateLoggedUserValidation,
  changeValidateUserPassword,
  createAdminAccountValidation,
  updateAdminAccountValidation,
  setAdminAccountStatusValidation,
  deleteAdminAccountValidation,
} = require("../utils/validator/userValidation");

const { protect, allowedTo } = require("../services/authServices");
const { passwordChangeLimiter } = require("../middlewares/rateLimiters");

router
  .route("/admin/accounts")
  .get(protect, allowedTo("admin"), getAdminAccounts)
  .post(
    protect,
    allowedTo("admin"),
    createAdminAccountValidation,
    createAdminAccount,
  );
router.put(
  "/admin/accounts/:id",
  protect,
  allowedTo("admin"),
  updateAdminAccountValidation,
  updateAdminAccount,
);
router.patch(
  "/admin/accounts/:id/status",
  protect,
  allowedTo("admin"),
  setAdminAccountStatusValidation,
  setAdminAccountStatus,
);
router.delete(
  "/admin/accounts/:id",
  protect,
  allowedTo("admin"),
  deleteAdminAccountValidation,
  deleteAdminAccount,
);

/**
 * @desc    Update logged-in user info
 * @route   PUT /api/v1/user/:id
 * @access  Private/User
 */
router.put(
  "/:id",
  protect,
  uploadUserSingleImage,
  resizeImage,
  updateLoggedUserValidation,
  updateLoggedUser,
);

/**
 * @desc    Get logged-in user data
 * @route   GET /api/v1/user/getMe
 * @access  Private/User
 */
router.get("/getMe", protect, getLoggedUserData, getOne);

/**
 * @desc    Change logged-in user's password
 * @route   PUT /api/v1/user/changePassword/:id
 * @access  Private/User
 */
router.put(
  "/changePassword/:id",
  protect,
  passwordChangeLimiter,
  changeValidateUserPassword,
  changePassword,
);

module.exports = router;
