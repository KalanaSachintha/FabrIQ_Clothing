const { HfInference } = require("@huggingface/inference");

const hf = new HfInference(process.env.HF_TOKEN);

const generateTshirtDesign = async (req, res) => {
  try {
    const { userPrompt } = req.body;

    // "Master Prompt" wrapping to ensure high quality for printing
    const finalPrompt = `${userPrompt}, professional t-shirt graphic, clean vector art, isolated on plain white background, high contrast, 4k resolution`;

    const response = await hf.textToImage({
      model: "black-forest-labs/FLUX.1-dev", // This is the best free-tier model in 2026
      inputs: finalPrompt,
      parameters: {
        guidance_scale: 7.5,
      },
    });

    // The AI returns a Blob. We convert it to a Base64 string so React can show it easily.
    const buffer = await response.arrayBuffer();
    const base64Image = Buffer.from(buffer).toString("base64");
    const dataUrl = `data:image/png;base64,${base64Image}`;

    res.status(200).json({ imageUrl: dataUrl });
  } catch (error) {
    console.error("AI Error:", error);
    res.status(500).json({ message: "Failed to generate design" });
  }
};

module.exports = { generateTshirtDesign };
