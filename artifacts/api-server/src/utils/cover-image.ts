import { ai } from "@workspace/integrations-gemini-ai";

/**
 * Builds a tailored image-generation prompt by first asking Gemini to identify
 * the most visually compelling, content-specific subject for this research.
 */
export async function buildResearchCoverPrompt(
  title: string,
  summary: string,
  tags: string[],
  findings?: string,
): Promise<string> {
  const metaprompt = `You are a creative director at a premium design studio. Based on this research article, identify ONE specific, concrete visual subject for a cover image.

Article title: "${title}"
Summary: ${summary?.slice(0, 300) || "(none)"}
Tags: ${tags?.join(", ") || "(none)"}
Key findings: ${findings?.slice(0, 200) || "(none)"}

Rules:
- Be SPECIFIC to the actual topic (never generic "data streams" or "nodes")
- Use concrete imagery tied to the real subject matter
  e.g. "robotic arm welding a car chassis", "DNA helix with glowing CRISPR scissors",
       "satellite orbiting Earth with signal beams", "urban solar panel grid at sunset"
- One sentence only — the visual subject, nothing else

Reply with ONLY the one-sentence visual subject.`;

  const result = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: metaprompt }] }],
    config: { maxOutputTokens: 80, thinkingConfig: { thinkingBudget: 0 } },
  });

  const visualSubject = result.text?.trim() || `abstract representation of "${title}"`;

  return (
    `Create a sophisticated editorial cover image. Main visual subject: ${visualSubject}. ` +
    `Style: premium innovation magazine, cinematic depth-of-field, dark dramatic background ` +
    `with electric indigo and cyan accent lighting. Photorealistic or high-quality 3D render ` +
    `aesthetic. Professional studio lighting, rich shadows, ultra-detailed foreground elements. ` +
    `Absolutely NO text, NO words, NO letters, NO numbers anywhere in the image. Square format. ` +
    `Ultra high quality 4K.`
  );
}
