import { GoogleGenAI } from '@google/genai';

let client: GoogleGenAI | null = null;
let cachedApiKey: string | null = null;

function getClient(apiKeyOverride?: string): GoogleGenAI {
  const apiKey = apiKeyOverride || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required');
  }

  if (!client || cachedApiKey !== apiKey) {
    client = new GoogleGenAI({ apiKey });
    cachedApiKey = apiKey;
  }

  return client;
}

export async function generateGeminiText(systemInstruction: string, userPrompt: string, apiKeyOverride?: string): Promise<string> {
  const ai = getClient(apiKeyOverride);
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    contents: userPrompt,
    config: {
      systemInstruction,
      temperature: 0.2,
    },
  });

  return response.text ?? '';
}
