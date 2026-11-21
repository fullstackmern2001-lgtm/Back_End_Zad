const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 30,
    },

    lastName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 30,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 10,
      select: false,
    },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    avatar: {
      type: String,
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
    tokenVersion: {
      type: Number,
      default: 0,
      select: false,
    },
    passwordResetCodeHash: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
    passwordResetAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    passwordResetRequestedAt: {
      type: Date,
      select: false,
    },
    passwordResetGrantHash: {
      type: String,
      select: false,
    },
    passwordResetGrantExpires: {
      type: Date,
      select: false,
    },
    wishlist: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "Service",
      },
    ],
  },
  {
    timestamps: true,
  },
);

/* =========================
   🔐 Hash Password
========================= */
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

/* =========================
   🔑 Compare Password
========================= */
userSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model("User", userSchema);
