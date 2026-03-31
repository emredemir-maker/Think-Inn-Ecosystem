import { GoogleGenAI } from "@google/genai";

const replitApiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
const replitBaseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
const standardApiKey = process.env.GEMINI_API_KEY;

const apiKey = replitApiKey || standardApiKey;

if (!apiKey) {
  throw new Error(
    "A Gemini API key is required. Set GEMINI_API_KEY (standard) or AI_INTEGRATIONS_GEMINI_API_KEY (Replit integration).",
  );
}

const isReplitProxy =
  replitApiKey &&
  replitBaseUrl &&
  !replitBaseUrl.includes("generativelanguage.googleapis.com");

export const ai = new GoogleGenAI({
  apiKey,
  ...(isReplitProxy
    ? { httpOptions: { apiVersion: "", baseUrl: replitBaseUrl } }
    : {}),
});
