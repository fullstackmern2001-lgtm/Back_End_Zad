const mongoose = require("mongoose");

const checkoutAttemptSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: true,
    },
    cartId: {
      type: mongoose.Schema.ObjectId,
      ref: "Cart",
      required: true,
    },
    cartRevision: {
      type: Number,
      required: true,
      min: 0,
    },
    idempotencyKey: {
      type: String,
      required: true,
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
        unitAmountMinor: { type: Number, required: true, min: 0 },
        minQuantity: { type: Number, required: true, min: 1 },
        quantity: { type: Number, required: true, min: 1 },
        totalItemPrice: { type: Number, required: true, min: 0 },
        totalItemAmountMinor: { type: Number, required: true, min: 0 },
      },
    ],
    currency: {
      type: String,
      required: true,
      lowercase: true,
      enum: ["usd"],
    },
    subtotalAmountMinor: { type: Number, required: true, min: 0 },
    discountAmountMinor: { type: Number, required: true, default: 0, min: 0 },
    taxAmountMinor: { type: Number, required: true, default: 0, min: 0 },
    shippingAmountMinor: { type: Number, required: true, default: 0, min: 0 },
    totalAmountMinor: { type: Number, required: true, min: 0 },
    stripeSessionId: {
      type: String,
      unique: true,
      sparse: true,
    },
    checkoutUrl: String,
    expiresAt: Date,
    status: {
      type: String,
      enum: ["creating_session", "open", "paid", "failed", "expired"],
      default: "creating_session",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    order: {
      type: mongoose.Schema.ObjectId,
      ref: "Order",
    },
    processedEventIds: {
      type: [String],
      default: [],
    },
    paidAt: Date,
  },
  { timestamps: true },
);

checkoutAttemptSchema.index(
  { user: 1, idempotencyKey: 1 },
  { unique: true },
);
checkoutAttemptSchema.index(
  { user: 1, cartId: 1, cartRevision: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
  },
);
checkoutAttemptSchema.index({ status: 1, expiresAt: 1 });

module.exports = mongoose.model("CheckoutAttempt", checkoutAttemptSchema);
