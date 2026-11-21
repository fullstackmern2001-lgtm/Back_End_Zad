const express = require("express");
const { protect, allowedTo } = require("../services/authServices");
const {
  uploadProofSingleImage,
  uploadProofImage,
  createProof,
  getProofs,
  getProof,
  updateProof,
  deleteProof,
} = require("../services/proofServices");
const {
  CreateProofValidation,
  GetProofsValidation,
  GetProofValidation,
  UpdateProofValidation,
  DeleteProofValidation,
} = require("../utils/validator/proofValidation");

const router = express.Router();

router
  .route("/")
  .get(GetProofsValidation, getProofs)
  .post(
    protect,
    allowedTo("admin"),
    uploadProofSingleImage,
    uploadProofImage,
    CreateProofValidation,
    createProof,
  );

router
  .route("/:id")
  .get(GetProofValidation, getProof)
  .put(
    protect,
    allowedTo("admin"),
    uploadProofSingleImage,
    uploadProofImage,
    UpdateProofValidation,
    updateProof,
  )
  .delete(
    protect,
    allowedTo("admin"),
    DeleteProofValidation,
    deleteProof,
  );

module.exports = router;
