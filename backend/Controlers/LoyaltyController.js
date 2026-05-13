const Loyalty = require('../Model/LoyaltyModel');

function isAdmin(req) {
  return String(req.user?.role || '').trim().toLowerCase() === 'admin';
}

function normalizeId(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Object && value._id) return String(value._id);
  return String(value);
}

exports.assignDiscount = async (req, res) => {
  try {
    const { userIds, discountPercent, description, applyOnNextPurchase = true, expiresAt, minSpend = 0 } = req.body || {};
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'userIds must be a non-empty array' });
    }
    const pct = Number(discountPercent);
    if (!Number.isFinite(pct) || pct <= 0) {
      return res.status(400).json({ error: 'discountPercent must be a positive number' });
    }

    // If DB is not connected, return mock success
      const dbConnected = req.app?.locals?.dbConnected;
      if (!dbConnected) {
        // store mock entries in memory so GET /api/loyalty can return them during development
        req.app.locals.mockLoyalty = req.app.locals.mockLoyalty || [];
        const now = new Date();
        const mockDocs = docs.map((d) => ({
          ...d,
          _id: `mock-${Math.random().toString(36).slice(2, 9)}`,
          createdAt: now,
        }));
        req.app.locals.mockLoyalty.unshift(...mockDocs);
        return res.json({ message: 'Mock: discount assignment accepted', assigned: userIds.length, created: mockDocs });
      }

    const docs = userIds.map((uid) => ({
      userId: String(uid),
      discountPercent: pct,
      minSpend: Number(minSpend) || 0,
      description: description || '',
      applyOnNextPurchase: !!applyOnNextPurchase,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    }));

    const created = await Loyalty.insertMany(docs);
    return res.json({ message: 'Discounts assigned', assigned: created.length });
  } catch (err) {
    console.error('assignDiscount error', err && err.message);
    return res.status(500).json({ error: 'Failed to assign discounts' });
  }
};

// GET /api/loyalty - list loyalty discounts
exports.listLoyalty = async (req, res) => {
  try {
    // If DB is not connected, return an empty array (mock mode)
    const dbConnected = req.app?.locals?.dbConnected;
    if (!dbConnected) {
      return res.json([]);
    }

    const docs = await Loyalty.find({})
      .sort({ createdAt: -1 })
      .lean();

    return res.json(docs || []);
  } catch (err) {
    console.error('listLoyalty error', err && err.message);
    return res.status(500).json({ error: 'Failed to fetch loyalty discounts' });
  }
};

// DELETE /api/loyalty/:id
exports.deleteLoyaltyDiscount = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await Loyalty.findById(id);
    if (!doc) return res.status(404).json({ error: 'Loyalty discount not found' });

    const requesterIsAdmin = isAdmin(req);
    const owns = normalizeId(doc.userId) === normalizeId(req.user?._id);

    if (!requesterIsAdmin && !owns) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await doc.deleteOne();
    return res.json({ message: 'Loyalty discount removed' });
  } catch (err) {
    console.error('deleteLoyaltyDiscount error', err && err.message);
    return res.status(500).json({ error: 'Failed to remove loyalty discount' });
  }
};

// PUT /api/loyalty/:id
exports.updateLoyaltyDiscount = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await Loyalty.findById(id);
    if (!doc) return res.status(404).json({ error: 'Loyalty discount not found' });

    const requesterIsAdmin = isAdmin(req);
    const owns = normalizeId(doc.userId) === normalizeId(req.user?._id);
    if (!requesterIsAdmin && !owns) return res.status(403).json({ error: 'Forbidden' });

    const { discountPercent, minSpend, description, expiresAt } = req.body || {};
    if (typeof discountPercent !== 'undefined') {
      const pct = Number(discountPercent);
      if (!Number.isFinite(pct) || pct <= 0) return res.status(400).json({ error: 'Invalid discountPercent' });
      doc.discountPercent = pct;
    }
    if (typeof minSpend !== 'undefined') doc.minSpend = Number(minSpend) || 0;
    if (typeof description !== 'undefined') doc.description = description;
    if (typeof expiresAt !== 'undefined') doc.expiresAt = expiresAt ? new Date(expiresAt) : undefined;

    await doc.save();
    return res.json({ message: 'Loyalty discount updated', discount: doc });
  } catch (err) {
    console.error('updateLoyaltyDiscount error', err && err.message);
    return res.status(500).json({ error: 'Failed to update loyalty discount' });
  }
};
