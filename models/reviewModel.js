const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const reviewSchema = new Schema(
  {
    title: {
      type: String,
    },
    rating: {
      type: Number,
      required: [true, "Rating is required"],
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
    },
    service: {
      type: mongoose.Schema.ObjectId,
      ref: "Service",
      required: [true, "Review must belong Service"],
    },
  },
  { timestamps: true },
);
reviewSchema.index({ user: 1, service: 1 }, { unique: true });
reviewSchema.pre(/^find/, function (next) {
  this.populate({
    path: "user",
    select: "firstName avatar",
  });
  next();
});

const reviewModel = mongoose.model("Review", reviewSchema);
module.exports = reviewModel;
