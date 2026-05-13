const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const bulkOrderSchema = new Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    image1: {
      type: String,
      required: true,
    },
    image2: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    quality: {
      type: String,
      enum: ["190GSM", "220GSM", "250GSM", "280GSM"],
      required: true,
    },
    contactNumber: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      default: "Pending",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BulkOrder", bulkOrderSchema);
