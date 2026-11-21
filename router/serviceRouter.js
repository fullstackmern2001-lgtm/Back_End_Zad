const express = require("express");
const router = express.Router();

const {
  uploadServiceSingleImage,
  resizeImage,
  ensureService,
  createService,
  getServices,
  getService,
  updateService,
  deleteService,
  getSimilarServices,
} = require("../services/serviceServices");
const {
  CreateServiceValidation,
  GetServiceValidation,
  UpdateServiceValidation,
  DeleteServiceValidation,
} = require("../utils/validator/serviceValidation");
const { protect, allowedTo } = require("../services/authServices");

router
  .route("/")
  .get(getServices)
  .post(
    protect,
    allowedTo("admin"),
    uploadServiceSingleImage,
    resizeImage,
    CreateServiceValidation,
    createService,
  );

router
  .route("/:id")
  .get(GetServiceValidation, getService)
  .put(
    protect,
    allowedTo("admin"),
    uploadServiceSingleImage,
    resizeImage,
    UpdateServiceValidation,
    ensureService,
    updateService,
  )
  .delete(
    protect,
    allowedTo("admin"),
    DeleteServiceValidation,
    ensureService,
    deleteService,
  );

router.get(
  "/:id/similar",
  GetServiceValidation,
  ensureService,
  getSimilarServices,
);

module.exports = router;
