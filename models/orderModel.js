const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const orderSchema = new Schema(
  {
    user: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: [true, "User Required"],
    },
    stripeSessionId: {
      type: String,
      unique: true,
      sparse: true,
      select: false,
    },
    checkoutAttempt: {
      type: mongoose.Schema.ObjectId,
      ref: "CheckoutAttempt",
      unique: true,
      sparse: true,
    },
    cartItems: [
      {
        service: {
          type: mongoose.Schema.ObjectId,
          ref: "Service",
          required: true,
        },
        serviceName: { type: String, required: true },
        serviceImage: { type: String, default: "" },
        price: { type: Number, required: true, min: 0 },
        minQuantity: { type: Number, required: true, min: 1 },
        quantity: { type: Number, required: true, min: 1 },
        totalItemPrice: { type: Number, required: true, min: 0 },
      },
    ],
    totalOrderPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    totalAmountMinor: {
      type: Number,
      min: 0,
    },
    currency: {
      type: String,
      lowercase: true,
      enum: ["usd"],
    },
    paymentMethodType: {
      type: String,
      enum: ["card", "legacy"],
      default: "card",
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
    paidAt: {
      type: Date,
    },
    isDelivered: {
      type: Boolean,
      default: false,
    },
    deliveredAt: Date,
    status: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
  },
  { timestamps: true },
);

orderSchema.pre(/^find/, function (next) {
  this.populate({
    path: "user",
    select: "firstName lastName email phone avatar",
  }).populate({ path: "cartItems.service", select: "name image" });
  next();
});
const orderModel = mongoose.model("Order", orderSchema);
module.exports = orderModel;
