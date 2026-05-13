const express = require("express");
const router = express.Router();
const { generateTshirtDesign } = require("../Controlers/aiController");

router.post("/generate", generateTshirtDesign);

module.exports = router;
