const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");
const SupplierDiscountController = require("../Controlers/SupplierDiscountController");

router.get("/", requireAuth, SupplierDiscountController.listSupplierDiscounts);
router.post("/", requireAuth, SupplierDiscountController.createSupplierDiscount);
router.delete("/:id", requireAuth, SupplierDiscountController.deleteSupplierDiscount);
router.put("/:id", requireAuth, SupplierDiscountController.updateSupplierDiscount);

module.exports = router;
