const express = require("express");
const router = express.Router();

const { handleChatMessage } = require("../Controlers/ChatController");

// Public endpoint for the fashion assistant chatbot
router.post("/message", handleChatMessage);

module.exports = router;
