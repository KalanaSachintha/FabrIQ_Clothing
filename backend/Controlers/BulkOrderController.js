const BulkOrder = require("../Model/BulkOrderModel");
const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

const createBulkOrder = async (req, res) => {
  try {
    const { user, quantity, quality, contactNumber } = req.body;
    let image1 = "";
    let image2 = "";

    if (req.files) {
      if (req.files.image1 && req.files.image1[0]) {
        image1 = `/uploads/${req.files.image1[0].filename}`;
      }
      if (req.files.image2 && req.files.image2[0]) {
        image2 = `/uploads/${req.files.image2[0].filename}`;
      }
    }

    if (!image1 || !image2) {
      return res.status(400).json({ message: "Both images are required" });
    }

    const bulkOrder = new BulkOrder({
      user,
      image1,
      image2,
      quantity,
      quality,
      contactNumber,
    });

    await bulkOrder.save();
    return res.status(201).json({ message: "Bulk order submitted successfully", bulkOrder });
  } catch (error) {
    return res.status(500).json({ message: "Error submitting bulk order", error });
  }
};

const getBulkOrders = async (req, res) => {
  try {
    const orders = await BulkOrder.find().populate("user", "name email");
    return res.status(200).json(orders);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching bulk orders", error });
  }
};

module.exports = {
  createBulkOrder,
  getBulkOrders,
  upload,
};
