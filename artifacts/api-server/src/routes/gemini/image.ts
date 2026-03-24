import { Router } from "express";
import { generateImage } from "@workspace/integrations-gemini-ai/image";

const router = Router();

router.post("/generate-image", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const { b64_json, mimeType } = await generateImage(prompt);
    res.json({ b64_json, mimeType });
  } catch (err) {
    req.log.error({ err }, "Failed to generate image");
    res.status(500).json({ error: "Failed to generate image" });
  }
});

export default router;
