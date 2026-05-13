const express = require("express");
const router = express.Router();
const {
  getAllProducts,
  getProductCategories,
  addProduct,
  getbyId,
  updateProduct,
  deleteProduct,
  upload,
} = require("../Controlers/ProductController");


router.get("/", getAllProducts);
router.get("/categories", getProductCategories);
router.get("/:pid", getbyId);
const uploadAny = upload.any();

router.post("/", uploadAny, addProduct);
router.put("/:pid", uploadAny, updateProduct);
router.delete("/:pid", deleteProduct);

module.exports = router;
