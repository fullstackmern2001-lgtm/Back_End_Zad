const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    minQuantity: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isInteger,
    },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    image: { type: String, required: true },
  },
  {
    timestamps: true,
    collection: "services",
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

serviceSchema.virtual("reviews", {
  ref: "Review",
  foreignField: "service",
  localField: "_id",
});

module.exports = mongoose.model("Service", serviceSchema);
