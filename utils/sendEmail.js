const nodemailer = require("nodemailer");

const sendEmail = async (options) => {
  const port = Number(process.env.EMAIL_PORT);
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: options.email,
    replyTo: options.replyTo,
    subject: options.subject,
    text: options.message,
    html: options.html,
  });
};

module.exports = sendEmail;
