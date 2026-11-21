const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
      unique: true,
    },
    image: { type: String, required: true },
  },
  { timestamps: true, collection: "categories" },
);

module.exports = mongoose.model("Category", categorySchema);
