const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const asyncHandler = require("express-async-handler");
// =============================

const User = require("../models/userModels");
const ApiError = require("../utils/ApiError");
const sendEmail = require("../utils/sendEmail");

const RESET_CODE_TTL_MS = 10 * 60 * 1000;
const RESET_GRANT_TTL_MS = 5 * 60 * 1000;
const RESET_CODE_REQUEST_COOLDOWN_MS = 60 * 1000;
const RESET_CODE_MAX_ATTEMPTS = 3;
const RESET_CODE_RESPONSE =
  "إذا كان البريد مسجلًا لدينا، فسيصلك رمز استعادة كلمة المرور.";

const hashResetCode = (code) =>
  crypto
    .createHmac("sha256", process.env.JWT_KEY_SECRIPT)
    .update(code)
    .digest("hex");

const resetCodeMatches = (code, storedHash) => {
  const providedHash = Buffer.from(hashResetCode(code), "hex");
  const expectedHash = Buffer.from(storedHash, "hex");

  return (
    providedHash.length === expectedHash.length &&
    crypto.timingSafeEqual(providedHash, expectedHash)
  );
};

/* =========================
   Helper: Generate Token
========================= */
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_KEY_SECRIPT, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  });
};

/* =========================
   Register Service
========================= */
exports.registerService = asyncHandler(async (req, res, next) => {
  const { firstName, lastName, email, password } = req.body;

  const user = await User.create({
    firstName,
    lastName,
    email,
    password,
  });

  const token = generateToken({
    id: user._id,
    role: user.role,
    tokenVersion: user.tokenVersion || 0,
  });

  res.status(201).json({
    success: true,
    message: "User registered successfully",
    data: {
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    },
  });
});

/* =========================
   Login Service
========================= */
exports.loginService = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select("+password +tokenVersion");

  if (!user || !user.isActive) {
    throw new ApiError("البريد الإلكتروني أو كلمة المرور غير صحيحة", 401);
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    throw new ApiError("البريد الإلكتروني أو كلمة المرور غير صحيحة", 401);
  }

  const token = generateToken({
    id: user._id,
    role: user.role,
    tokenVersion: user.tokenVersion || 0,
  });
  res.status(200).json({
    token,
    message: ` Welcome ${user.firstName}`,
    user: {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      role: user.role,
    },
  });
});

exports.requestPasswordReset = asyncHandler(async (req, res) => {
  const email = req.body.email.toLowerCase();
  const user = await User.findOne({ email }).select(
    "+passwordResetRequestedAt",
  );

  if (user) {
    const now = new Date();
    const cooldownBefore = new Date(
      now.getTime() - RESET_CODE_REQUEST_COOLDOWN_MS,
    );

    const code = crypto.randomInt(0, 1000000).toString().padStart(6, "0");
    const codeHash = hashResetCode(code);

    const resetRequest = await User.findOneAndUpdate(
      {
        _id: user._id,
        $or: [
          { passwordResetRequestedAt: { $exists: false } },
          { passwordResetRequestedAt: { $lte: cooldownBefore } },
          { passwordResetAttempts: { $gte: RESET_CODE_MAX_ATTEMPTS } },
        ],
      },
      {
        $set: {
          passwordResetCodeHash: codeHash,
          passwordResetExpires: new Date(now.getTime() + RESET_CODE_TTL_MS),
          passwordResetAttempts: 0,
          passwordResetRequestedAt: now,
        },
        $unset: {
          passwordResetGrantHash: 1,
          passwordResetGrantExpires: 1,
        },
      },
      { new: true },
    );

    if (resetRequest) {
      try {
        await sendEmail({
          email: user.email,
          subject: "استعادة كلمة المرور | زاد الخير",
          message: `مرحبًا بك في زاد الخير،\n\nتلقينا طلبًا لاستعادة كلمة المرور الخاصة بحسابك.\n\nرمز التحقق الخاص بك: ${code}\n\nتنتهي صلاحية هذا الرمز خلال 10 دقائق من وقت إصداره، ويمكن استخدامه مرة واحدة فقط. إذا لم تطلب استعادة كلمة المرور، فتجاهل هذه الرسالة ولا تشارك الرمز مع أي شخص.\n\nمع خالص التحية،\nفريق زاد الخير`,
          html: `
            <div dir="rtl" style="margin:0;padding:32px 16px;background-color:#f0fdf4;font-family:Arial,Tahoma,sans-serif;color:#374151">
              <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dcfce7;border-radius:20px;overflow:hidden">
                <div style="padding:28px 32px;background:#14532d;text-align:center">
                  <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700">زاد الخير</h1>
                  <p style="margin:8px 0 0;color:#dcfce7;font-size:14px">استعادة كلمة المرور</p>
                </div>
                <div style="padding:32px">
                  <h2 style="margin:0 0 16px;color:#14532d;font-size:21px">مرحبًا بك في زاد الخير،</h2>
                  <p style="margin:0 0 22px;font-size:16px;line-height:1.9">تلقينا طلبًا لاستعادة كلمة المرور الخاصة بحسابك. استخدم رمز التحقق التالي لإكمال العملية:</p>
                  <div style="margin:0 0 22px;padding:18px;border:1px dashed #16a34a;border-radius:14px;background:#f0fdf4;text-align:center;direction:ltr">
                    <span style="color:#14532d;font-size:34px;font-weight:700;letter-spacing:10px">${code}</span>
                  </div>
                  <p style="margin:0 0 12px;font-size:15px;line-height:1.8"><strong style="color:#14532d">تنتهي صلاحية الرمز خلال 10 دقائق</strong> من وقت إصداره، ويمكن استخدامه مرة واحدة فقط.</p>
                  <p style="margin:0;padding:14px 16px;border-radius:10px;background:#f9fafb;color:#6b7280;font-size:14px;line-height:1.8">إذا لم تطلب استعادة كلمة المرور، فتجاهل هذه الرسالة. حفاظًا على أمان حسابك، لا تشارك هذا الرمز مع أي شخص.</p>
                </div>
                <div style="padding:18px 32px;border-top:1px solid #e5e7eb;text-align:center;color:#6b7280;font-size:13px">
                  مع خالص التحية، فريق زاد الخير
                </div>
              </div>
            </div>
          `,
        });
      } catch {
        await User.updateOne(
          { _id: user._id, passwordResetCodeHash: codeHash },
          {
            $unset: {
              passwordResetCodeHash: 1,
              passwordResetExpires: 1,
            },
            $set: { passwordResetAttempts: 0 },
          },
        );
        throw new ApiError(
          "تعذر إرسال رسالة الاستعادة حاليًا. يرجى المحاولة لاحقًا.",
          503,
        );
      }
    }
  }

  res.status(200).json({
    status: "success",
    message: RESET_CODE_RESPONSE,
  });
});

exports.verifyPasswordResetCode = asyncHandler(async (req, res) => {
  const { email, code } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "+passwordResetCodeHash +passwordResetExpires +passwordResetAttempts",
  );

  if (
    !user ||
    !user.passwordResetCodeHash ||
    !user.passwordResetExpires ||
    user.passwordResetExpires <= new Date() ||
    user.passwordResetAttempts >= RESET_CODE_MAX_ATTEMPTS
  ) {
    throw new ApiError(
      "رمز الاستعادة غير صالح أو منتهي الصلاحية. اطلب رمزًا جديدًا.",
      400,
    );
  }

  if (!resetCodeMatches(code, user.passwordResetCodeHash)) {
    const updatedUser = await User.findOneAndUpdate(
      {
        _id: user._id,
        passwordResetCodeHash: user.passwordResetCodeHash,
        passwordResetExpires: { $gt: new Date() },
        passwordResetAttempts: { $lt: RESET_CODE_MAX_ATTEMPTS },
      },
      { $inc: { passwordResetAttempts: 1 } },
      { new: true },
    ).select("+passwordResetAttempts");

    if (
      updatedUser?.passwordResetAttempts >= RESET_CODE_MAX_ATTEMPTS
    ) {
      await User.updateOne(
        {
          _id: user._id,
          passwordResetCodeHash: user.passwordResetCodeHash,
          passwordResetAttempts: { $gte: RESET_CODE_MAX_ATTEMPTS },
        },
        {
          $unset: {
            passwordResetCodeHash: 1,
            passwordResetExpires: 1,
          },
        },
      );
      throw new ApiError(
        "تم إيقاف هذا الرمز بعد 3 محاولات خاطئة. اطلب رمزًا جديدًا.",
        400,
      );
    }

    if (!updatedUser) {
      throw new ApiError(
        "رمز الاستعادة غير صالح أو منتهي الصلاحية. اطلب رمزًا جديدًا.",
        400,
      );
    }

    throw new ApiError("رمز الاستعادة غير صحيح", 400);
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  const grantHash = hashResetCode(resetToken);
  const resetGrant = await User.findOneAndUpdate(
    {
      _id: user._id,
      passwordResetCodeHash: user.passwordResetCodeHash,
      passwordResetExpires: { $gt: new Date() },
      passwordResetAttempts: { $lt: RESET_CODE_MAX_ATTEMPTS },
    },
    {
      $set: {
        passwordResetGrantHash: grantHash,
        passwordResetGrantExpires: new Date(Date.now() + RESET_GRANT_TTL_MS),
      },
      $unset: {
        passwordResetCodeHash: 1,
        passwordResetExpires: 1,
        passwordResetAttempts: 1,
      },
    },
    { new: true },
  );

  if (!resetGrant) {
    throw new ApiError(
      "رمز الاستعادة غير صالح أو منتهي الصلاحية. اطلب رمزًا جديدًا.",
      400,
    );
  }

  res.status(200).json({
    status: "success",
    message: "تم التحقق من الرمز بنجاح.",
    resetToken,
  });
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const { resetToken, password } = req.body;
  const passwordHash = await bcrypt.hash(password, 10);
  const updatedUser = await User.findOneAndUpdate(
    {
      passwordResetGrantHash: hashResetCode(resetToken),
      passwordResetGrantExpires: { $gt: new Date() },
    },
    {
      $set: { password: passwordHash },
      $inc: { tokenVersion: 1 },
      $unset: {
        passwordResetCodeHash: 1,
        passwordResetExpires: 1,
        passwordResetAttempts: 1,
        passwordResetGrantHash: 1,
        passwordResetGrantExpires: 1,
      },
    },
    { new: true, runValidators: true },
  );

  if (!updatedUser) {
    throw new ApiError(
      "انتهت صلاحية جلسة الاستعادة. ابدأ طلب استعادة جديدًا.",
      400,
    );
  }

  res.status(200).json({
    status: "success",
    message: "تم تغيير كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن.",
  });
});

// للتاكد من ان المستخدم سجل دخول او لا
exports.protect = asyncHandler(async (req, res, next) => {
  // 1) check if token exeist , if exsit get
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }
  if (!token) {
    return next(new ApiError("يرجى تسجيل الدخول أولًا", 401));
  }
  // 2) Verify token
  const decoded = jwt.verify(token, process.env.JWT_KEY_SECRIPT);
  // 3) check if user exsist
  const currentUser = await User.findById(decoded.id).select("+tokenVersion");
  if (!currentUser) {
    return next(
      new ApiError(
        "the user that belong to this token does no longer exist",
        401,
      ),
    );
  }
  if (!currentUser.isActive) {
    return next(
      new ApiError("تم تعليق هذا الحساب، يرجى التواصل مع الإدارة", 403),
    );
  }
  if ((decoded.tokenVersion || 0) !== (currentUser.tokenVersion || 0)) {
    return next(
      new ApiError(
        "Your session is no longer valid. Please log in again.",
        401,
      ),
    );
  }
  req.user = currentUser;
  next();
});

// @desc    Authorization (User Permissions)
// ["admin", "manager"]

exports.allowedTo = (...roles) =>
  asyncHandler(async (req, res, next) => {
    // 1) access role
    // 2) access user
    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError("ليس لديك صلاحية الوصول إلى هذه الصفحة", 403),
      );
    }
    next();
  });
