const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { prompt, model, systemPrompt, stream = false } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ success: false, error: 'Prompt is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'AI not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[AI] Processing prompt with model: ${model || 'gemini-2.0-flash'} (stream=${stream})`);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://pipelinelabs-ashen.vercel.app',
        'X-Title': 'Pipeline Labs',
      },
      body: JSON.stringify({
        model: model || 'google/gemini-2.0-flash-001',
        stream,
        messages: [
          {
            role: 'system',
            content: systemPrompt || `You are an expert AI Data Scientist at Pipeline Labs. 
Your goal is to help users explore, clean, and experiment with their datasets.

STRICT OUTPUT RULES:
1. Always "THOUGHTS: [Logic]" first to think aloud.
2. For DATA TRANSFORMATION (drop columns, fill nulls, filters), output a <transform> block with JSON array.
3. For VISUALIZATIONS, output a <chart> block with JSON object.
4. Keep the main message conversational and explain the 'why'.`
          },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenRouter error:', response.status, errText);
      return new Response(
        JSON.stringify({ success: false, error: `AI error: ${response.status}`, details: errText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (stream) {
      console.log('[AI] Starting stream response');
      return new Response(response.body, {
        headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
      });
    } else {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      return new Response(JSON.stringify({ success: true, result: content }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed';
    console.error('ai-inference error:', msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
