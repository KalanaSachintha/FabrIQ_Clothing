const { HfInference } = require("@huggingface/inference");

const hf = new HfInference(process.env.HF_TOKEN);

const generateTshirtDesign = async (req, res) => {
  try {
    const { userPrompt } = req.body;

    if (!process.env.HF_TOKEN) {
      console.error("AI Error: HF_TOKEN is missing from environment variables.");
      return res.status(500).json({ 
        message: "AI configuration error: Missing API Token. Please check Render environment variables." 
      });
    }

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
    
    if (buffer.byteLength < 100) {
       // Likely an error response from HF returned as a small buffer
       const text = new TextDecoder().decode(buffer);
       console.error("AI HF Error Response:", text);
       throw new Error(`AI Model returned an error: ${text.slice(0, 100)}`);
    }

    const base64Image = Buffer.from(buffer).toString("base64");
    const dataUrl = `data:image/png;base64,${base64Image}`;

    res.status(200).json({ imageUrl: dataUrl });
  } catch (error) {
    console.error("AI Error:", error);
    res.status(500).json({ 
      message: error.message || "Failed to generate design",
      detail: error.toString()
    });
  }
};

module.exports = { generateTshirtDesign };
