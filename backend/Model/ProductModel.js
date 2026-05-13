const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const colorVariantSchema = new Schema(
  {
    colorName: { type: String, required: true, trim: true },
    imageUrls: { type: [String], default: [] },
    stockAmount: { type: Number, default: 0, min: 0 },
    availableSizes: { type: [String], default: [] },
    sizeStocks: {
      type: [
        new Schema(
          {
            size: { type: String, trim: true },
            stockAmount: { type: Number, default: 0, min: 0 },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { _id: false }
);

const productSchema = new Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true, min: 1 },
  description: { type: String, required: true },
  imageUrl: { type: String, required: true },
  galleryImageUrls: { type: [String], default: [] },
  colorVariants: { type: [colorVariantSchema], default: [] },
  category: { type: String, required: true },
  brand: { type: String, required: true },
  gender: { type: String, enum: ["Men", "Female", "Unisex"], default: "Unisex" },
  inStock: { type: Boolean, default: false },
  stockAmount: { type: Number, default: 0 },
  supplierId: { type: Schema.Types.ObjectId, ref: "User" },
  supplierProductId: { type: Schema.Types.ObjectId, ref: "SupplierProduct" },
  availableColors: { type: [String], default: [] },
  expireTrackingEnabled: { type: Boolean, default: false },
  expiryDate: { type: Date },
  expiryReminderDays: { type: Number, min: 0 },
  expiryNotificationSentAt: { type: Date },
  lastExpiryNotificationId: { type: Schema.Types.ObjectId, ref: "Notification" },
});

productSchema.methods.adjustStock = function (lines = []) {
  if (lines.length === 0) return this;

  for (const line of lines) {
    const quantity = Number(line.quantity || 0);
    const color = line.color || line.selectedColor || line.colorName;
    const size = line.size || line.selectedSize || line.sizeLabel;

    // 1. Update total product stock
    this.stockAmount = Math.max(0, this.stockAmount - quantity);

    // 2. Identify and update variant stock if colour/size is specified
    if (color && Array.isArray(this.colorVariants)) {
      const variant = this.colorVariants.find(
        (v) => (v.colorName || "").trim().toLowerCase() === String(color).trim().toLowerCase()
      );

      if (variant) {
        // Update variant-level total stock
        variant.stockAmount = Math.max(0, variant.stockAmount - quantity);

        // Update size-specific stock if size is known
        if (size && Array.isArray(variant.sizeStocks)) {
          const sizeStock = variant.sizeStocks.find(
            (ss) => (ss.size || "").trim().toLowerCase() === String(size).trim().toLowerCase()
          );
          if (sizeStock) {
            sizeStock.stockAmount = Math.max(0, sizeStock.stockAmount - quantity);
          }
        }
      }
    }
  }

  // Final visibility check
  this.inStock = this.stockAmount > 0;
  return this;
};

module.exports = mongoose.model("ProductModel", productSchema);
