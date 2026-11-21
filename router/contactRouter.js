const express = require("express");
const { sendContactMessage } = require("../services/contactServices");
const contactValidation = require("../utils/validator/contactValidation");
const { contactLimiter } = require("../middlewares/rateLimiters");

const router = express.Router();

router.post("/", contactLimiter, contactValidation, sendContactMessage);

module.exports = router;
