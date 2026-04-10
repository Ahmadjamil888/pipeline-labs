const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SYSTEM_PROMPT = `You are an expert AI Data Scientist at Pipeline Labs. 
Your goal is to help users explore, clean, and experiment with their datasets.

STRICT OUTPUT RULES:
1. Always "THOUGHTS: [Logic]" first to think aloud.
2. For DATA TRANSFORMATION (drop columns, fill nulls, filters), output a <transform> block with JSON array.
3. For VISUALIZATIONS, output a <chart> block with JSON object.
4. Keep the main message conversational and explain the 'why'.`;

// Primary: Gemini 2.5 Flash via direct API
async function callGemini(prompt: string, systemPrompt: string, apiKey: string) {
  console.log('[AI] Trying Gemini 2.5 Flash...');
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: systemPrompt },
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
        }
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  return { content, provider: 'gemini-2.5-flash' };
}

// Fallback: OpenRouter with free model
async function callOpenRouterFree(prompt: string, systemPrompt: string, apiKey: string) {
  console.log('[AI] Falling back to OpenRouter/free...');
  
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://pipelinelabs-ashen.vercel.app',
      'X-Title': 'Pipeline Labs',
    },
    body: JSON.stringify({
      model: 'google/gemma-3-4b-it:free',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  
  return { content, provider: 'openrouter-free' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { prompt, systemPrompt, stream = false } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ success: false, error: 'Prompt is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Note: Gemini doesn't support streaming in the same way, so we'll handle non-streaming
    const finalSystemPrompt = systemPrompt || SYSTEM_PROMPT;
    
    let result;
    let usedProvider = '';

    // Try Gemini 2.5 Flash first
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (geminiKey) {
      try {
        const geminiResult = await callGemini(prompt, finalSystemPrompt, geminiKey);
        result = geminiResult.content;
        usedProvider = geminiResult.provider;
        console.log(`[AI] Successfully used ${usedProvider}`);
      } catch (geminiError) {
        console.error('[AI] Gemini failed:', geminiError.message);
        
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
