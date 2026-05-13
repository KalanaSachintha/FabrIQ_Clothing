const express = require("express");
const router = express.Router();
const {
  createBulkOrder,
  getBulkOrders,
  upload,
} = require("../Controlers/BulkOrderController");

router.post(
  "/",
  upload.fields([
    { name: "image1", maxCount: 1 },
    { name: "image2", maxCount: 1 },
  ]),
  createBulkOrder
);

router.get("/", getBulkOrders);

module.exports = router;
