const BulkPricing = require("../Model/BulkPricingModel");

exports.createOrUpdatePricing = async (req, res) => {
  try {
    const { quality, priceUnder20, priceUnder50, priceUnder100, priceUnder250, price250AndAbove } = req.body;
    
    if (!quality) {
      return res.status(400).json({ message: "Quality name is required." });
    }

    let pricing = await BulkPricing.findOne({ quality });
    if (pricing) {
      pricing.priceUnder20 = priceUnder20;
      pricing.priceUnder50 = priceUnder50;
      pricing.priceUnder100 = priceUnder100;
      pricing.priceUnder250 = priceUnder250;
      pricing.price250AndAbove = price250AndAbove;
      await pricing.save();
      return res.status(200).json({ message: "Pricing updated successfully", pricing });
    } else {
      pricing = new BulkPricing({
        quality,
        priceUnder20,
        priceUnder50,
        priceUnder100,
        priceUnder250,
        price250AndAbove
      });
      await pricing.save();
      return res.status(201).json({ message: "Pricing created successfully", pricing });
    }
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getAllPricing = async (req, res) => {
  try {
    const pricingList = await BulkPricing.find().sort({ quality: 1 });
    res.status(200).json(pricingList);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.deletePricing = async (req, res) => {
  try {
    const { id } = req.params;
    await BulkPricing.findByIdAndDelete(id);
    res.status(200).json({ message: "Pricing removed successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
