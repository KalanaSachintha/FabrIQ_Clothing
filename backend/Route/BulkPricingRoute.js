const express = require("express");
const router = express.Router();
const bulkPricingController = require("../Controlers/BulkPricingController");

router.post("/", bulkPricingController.createOrUpdatePricing);
router.get("/", bulkPricingController.getAllPricing);
router.delete("/:id", bulkPricingController.deletePricing);

module.exports = router;
