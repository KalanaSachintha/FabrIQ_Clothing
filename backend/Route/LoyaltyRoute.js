const express = require('express');
const router = express.Router();
const { assignDiscount, listLoyalty, deleteLoyaltyDiscount, updateLoyaltyDiscount } = require('../Controlers/LoyaltyController');
const { requireAuth } = require('../middleware/auth');

// POST /api/loyalty/assign-discount
router.post('/assign-discount', requireAuth, assignDiscount);

// GET /api/loyalty
router.get('/', requireAuth, listLoyalty);

// DELETE /api/loyalty/:id
router.delete('/:id', requireAuth, deleteLoyaltyDiscount);

// PUT /api/loyalty/:id
router.put('/:id', requireAuth, updateLoyaltyDiscount);

module.exports = router;
