import { GoogleGenAI } from "npm:@google/genai";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SYSTEM_PROMPT = `You are an expert AI Data Scientist at Pipeline Labs. 
Your goal is to help users explore, clean, and experiment with their datasets.

When analyzing data:
1. First identify the data type: TABULAR (rows/columns), NOMINAL (categorical), or JSON (nested)
2. Recommend appropriate visualizations: bar charts for categorical, line charts for trends, scatter for correlations, heatmaps for matrices
3. Suggest data optimizations: normalization, encoding, feature engineering

STRICT OUTPUT RULES:
1. Always "THOUGHTS: [Logic]" first to think aloud.
2. For DATA TRANSFORMATION (drop columns, fill nulls, filters), output a <transform> block with JSON array.
3. For VISUALIZATIONS, output a <chart> block with JSON object specifying chart type and config.
4. For DATA TYPE detection, mention: "DATA_TYPE: [tabular|nominal|json]"
5. Keep the main message conversational and explain the 'why'.`;

// Initialize Gemini AI
const ai = new GoogleGenAI({
  apiKey: Deno.env.get("GEMINI_API_KEY"),
});

// Primary: Gemini 1.5 Flash via SDK
async function callGemini(prompt: string, systemPrompt: string, stream = false) {
  console.log('[AI] Using Gemini SDK...');

  try {
    const fullPrompt = `${systemPrompt}\n\n${prompt}`;

    if (stream) {
      // Streaming response
      const response = await ai.models.generateContentStream({
        model: "gemini-1.5-flash",
        contents: fullPrompt,
      });
      return { stream: response, provider: "gemini-1.5-flash" };
    } else {
      // Non-streaming response
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: fullPrompt,
      });

      const text = response.text;
      console.log("[AI] Gemini raw text:", text?.substring(0, 200) + "...");

      if (!text) {
        throw new Error("Empty Gemini response");
      }

      return { content: text, provider: "gemini-1.5-flash" };
    }
  } catch (err) {
    console.error("[AI] Gemini SDK error:", err);
    throw err;
  }
}

// Fallback: OpenRouter with free model
async function callOpenRouterFree(prompt: string, systemPrompt: string, apiKey: string) {
  console.log('[AI] Falling back to OpenRouter/free...');
  
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://pipeline-labs.vercel.app',
      'X-Title': 'Pipeline Labs AI',
    },
    body: JSON.stringify({
      model: 'mistralai/mistral-7b-instruct:free',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('[AI] OpenRouter error:', response.status, errText);
    throw new Error(`OpenRouter error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const content = 
    data.choices?.[0]?.message?.content || 
    data.choices?.[0]?.text || 
    '';
  
  return { content, provider: 'openrouter-free' };
}

// Verify Supabase JWT (optional - allow anonymous)
async function verifyAuth(req: Request): Promise<boolean> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return true; // Allow anonymous
  
  // If authorization header exists, we could verify it
  // For now, accept all requests
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Handle GET requests - return status
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ success: true, status: 'AI Inference API is running', version: '1.0' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Debug logging
    console.log("Gemini key exists:", !!Deno.env.get("GEMINI_API_KEY"));
    console.log("OpenRouter key exists:", !!Deno.env.get("OPENROUTER_API_KEY"));

    // Check auth (permissive - allows anonymous)
    const isAuth = await verifyAuth(req);
    if (!isAuth) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse JSON body with error handling
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { prompt, systemPrompt, stream = false } = body;

    if (!prompt) {
      return new Response(
        JSON.stringify({ success: false, error: 'Prompt is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const finalSystemPrompt = systemPrompt || SYSTEM_PROMPT;
    
    let result;
    let usedProvider = '';

    // Try Gemini 1.5 Flash first
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (geminiKey) {
      try {
        const geminiResult = await callGemini(prompt, finalSystemPrompt, stream);
        
        // Handle streaming response
        if (stream && geminiResult.stream) {
          const encoder = new TextEncoder();
          const geminiStream = geminiResult.stream;

          const readableStream = new ReadableStream({
            async start(controller) {
              try {
                for await (const chunk of geminiStream) {
                  const text = chunk.text;
                  if (text) {
                    controller.enqueue(encoder.encode(text));
                  }
                }
                controller.close();
              } catch (err) {
                console.error("[AI] Stream error:", err);
                controller.error(err);
              }
            },
          });

          return new Response(readableStream, {
            headers: {
              ...corsHeaders,
              "Content-Type": "text/plain",
              "Transfer-Encoding": "chunked",
            },
          });
        }
        
        // Non-streaming response
        result = geminiResult.content;
        usedProvider = geminiResult.provider;
        console.log(`[AI] Successfully used ${usedProvider}`);
      } catch (geminiError) {
        const errorMsg = geminiError instanceof Error ? geminiError.message : 'Gemini failed';
        console.error('[AI] Gemini failed:', errorMsg);
        
        // Fallback to OpenRouter
        const openrouterKey = Deno.env.get('OPENROUTER_API_KEY');
        if (openrouterKey) {
          const orResult = await callOpenRouterFree(prompt, finalSystemPrompt, openrouterKey);
          result = orResult.content;
          usedProvider = orResult.provider;
          console.log(`[AI] Successfully used ${usedProvider}`);
        } else {
          throw new Error('No fallback API available');
        }
      }
    } else {
      // No Gemini key, try OpenRouter directly
      const openrouterKey = Deno.env.get('OPENROUTER_API_KEY');
      if (!openrouterKey) {
        return new Response(
          JSON.stringify({ success: false, error: 'AI not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const orResult = await callOpenRouterFree(prompt, finalSystemPrompt, openrouterKey);
      result = orResult.content;
      usedProvider = orResult.provider;
    }

    return new Response(
      JSON.stringify({ success: true, result, provider: usedProvider }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed';
    console.error('ai-inference error:', msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
