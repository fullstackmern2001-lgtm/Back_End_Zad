const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/ApiError");
const sendEmail = require("../utils/sendEmail");

exports.sendContactMessage = asyncHandler(async (req, res) => {
  const port = Number(process.env.EMAIL_PORT);
  const mailConfigIsMissing = [
    process.env.CONTACT_EMAIL,
    process.env.EMAIL_HOST,
    process.env.EMAIL_USER,
    process.env.EMAIL_PASSWORD,
  ].some((value) => !value);

  if (
    mailConfigIsMissing ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new ApiError("خدمة إرسال البريد غير مهيأة على الخادم", 503);
  }

  const { name, email, phone, message } = req.body;

  await sendEmail({
    email: process.env.CONTACT_EMAIL,
    replyTo: email,
    subject: "رسالة جديدة من نموذج التواصل",
    message: `الاسم: ${name}\nالبريد الإلكتروني: ${email}\nرقم الهاتف: ${phone}\n\nالرسالة:\n${message}`,
  });

  res.status(200).json({
    status: "success",
    message: "تم إرسال رسالتك بنجاح",
  });
});
