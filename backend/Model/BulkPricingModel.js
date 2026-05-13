const mongoose = require("mongoose");

const bulkPricingSchema = new mongoose.Schema(
  {
    quality: {
      type: String,
      required: true,
      unique: true,
    },
    priceUnder20: {
      type: Number,
      required: true,
      default: 0,
    },
    priceUnder50: {
      type: Number,
      required: true,
      default: 0,
    },
    priceUnder100: {
      type: Number,
      required: true,
      default: 0,
    },
    priceUnder250: {
      type: Number,
      required: true,
      default: 0,
    },
    price250AndAbove: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BulkPricing", bulkPricingSchema);
