const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const CartSchema = new Schema(
  {
    cartItems: [
      {
        service: {
          type: mongoose.Schema.ObjectId,
          ref: "Service",
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        price: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],

    totalCartPrice: { type: Number, default: 0, min: 0 },
    revision: { type: Number, default: 0, min: 0 },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Cart", CartSchema);
