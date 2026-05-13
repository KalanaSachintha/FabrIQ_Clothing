const mongoose = require('mongoose');
const Cart = require('../Model/CartModel');

const normalizeVariantValue = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const buildVariantKey = (productId, color, size) => {
  const colorToken = (color || 'default').toLowerCase();
  const sizeToken = (size || 'onesize').toLowerCase();
  return `${productId}:${colorToken}:${sizeToken}`;
};

const getCart = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    console.log(`[CartController] getCart called for user ${userId}`);
    const cart = await Cart.findOne({ userId }).lean();
    return res.status(200).json({ items: cart ? cart.items : [] });
  } catch (err) {
    console.error('getCart error:', err);
    res.status(500).json({ message: 'Error fetching cart', error: err.message });
  }
};

const upsertCart = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    console.log(`[CartController] upsertCart called for user ${userId} with ${Array.isArray(req.body.items) ? req.body.items.length : 0} items`);

    const incoming = Array.isArray(req.body.items) ? req.body.items : [];
    // sanitize items: ensure productId and positive integer quantity
    const items = incoming
      .map((it) => {
        const pid = it.productId || it._id;
        if (!pid || !mongoose.Types.ObjectId.isValid(String(pid))) return null;
        const q = Number(it.quantity || 0);
        if (!Number.isInteger(q) || q <= 0) return null;
        const supplierId = it.supplierId || it.supplier || null;
        let supplierObj = undefined;
        if (supplierId && mongoose.Types.ObjectId.isValid(String(supplierId))) {
          supplierObj = new mongoose.Types.ObjectId(String(supplierId));
        }
        const color = normalizeVariantValue(it.color || it.selectedColor || it.colorName);
        const size = normalizeVariantValue(it.size || it.selectedSize || it.sizeLabel);
        const variantKeyInput = normalizeVariantValue(it.variantKey || it.lineId || it.cartLineId);
        const variantKey = variantKeyInput || buildVariantKey(String(pid), color, size);

        return {
          productId: new mongoose.Types.ObjectId(String(pid)),
          productName: it.productName || it.name || '',
          supplierId: supplierObj,
          price: Number(it.price || 0),
          quantity: q,
          color,
          size,
          variantKey,
        };
      })
      .filter(Boolean);

    const updated = await Cart.findOneAndUpdate(
      { userId },
      { $set: { items } },
      { upsert: true, new: true }
    );

    return res.status(200).json({ items: updated.items });
  } catch (err) {
    console.error('upsertCart error:', err);
    res.status(500).json({ message: 'Error updating cart', error: err.message });
  }
};

const clearCart = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    console.log(`[CartController] clearCart called for user ${userId} - deleting cart document`);
    // Remove the cart document for this user entirely
    await Cart.deleteOne({ userId });
    res.status(200).json({ message: 'Cart cleared and cart record removed' });
  } catch (err) {
    console.error('clearCart error:', err);
    res.status(500).json({ message: 'Error clearing cart', error: err.message });
  }
};

module.exports = { getCart, upsertCart, clearCart };
