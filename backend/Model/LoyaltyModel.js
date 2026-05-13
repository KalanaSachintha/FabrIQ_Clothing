const mongoose = require('mongoose');

const LoyaltySchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  discountPercent: { type: Number, required: true },
  minSpend: { type: Number, default: 0 },
  description: { type: String },
  applyOnNextPurchase: { type: Boolean, default: true },
  used: { type: Boolean, default: false },
  createdAt: { type: Date, default: () => new Date() },
  expiresAt: { type: Date },
});

module.exports = mongoose.models.Loyalty || mongoose.model('Loyalty', LoyaltySchema);
