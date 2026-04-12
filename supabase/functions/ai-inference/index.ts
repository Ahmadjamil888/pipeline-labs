// deno-lint-ignore-file no-explicit-any
import { GoogleGenAI } from "npm:@genai/gemini";

// Global Deno namespace for IDE compatibility
// Runtime: Deno is available in Supabase Edge Functions
 declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `
You are an expert AI Data Scientist at Pipeline Labs.

You analyze datasets and produce:
- Data type detection (tabular, nominal, json)
- Best visualizations
- Transformations when needed
- Clear reasoning

Rules:
- Be precise and structured
- Prefer actionable insights over long explanations
- If data is present, always infer structure first
`;

const ai = new GoogleGenAI({
  apiKey: Deno.env.get("GEMINI_API_KEY") || "",
});

// 🔥 Optimized Gemini streaming call
async function streamGemini(prompt: string, systemPrompt: string) {
  const stream = await ai.models.generateContentStream({
    model: "gemini-2.5-flash",
    config: {
      temperature: 0.3,
      topP: 0.9,
      maxOutputTokens: 4096,
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${systemPrompt}\n\nUSER INPUT:\n${prompt}`,
          },
        ],
      },
    ],
  });

  return stream;
}

// CORS handler
function handleCors() {
  return new Response("ok", { headers: corsHeaders });
}

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") return handleCors();

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => null);

    if (!body?.prompt) {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const stream = await streamGemini(
      body.prompt,
      body.systemPrompt || SYSTEM_PROMPT
    );

    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text =
              chunk.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }

          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message || "Server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}