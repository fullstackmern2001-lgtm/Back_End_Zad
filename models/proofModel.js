const mongoose = require("mongoose");

const proofSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 150,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 5000,
    },
    image: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Proof", proofSchema);
