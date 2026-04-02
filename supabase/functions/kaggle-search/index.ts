import { corsHeaders } from '@supabase/supabase-js/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { query, limit } = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ success: false, error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const username = Deno.env.get('KAGGLE_USERNAME');
    const apiKey = Deno.env.get('KAGGLE_API_KEY');
    if (!username || !apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Kaggle credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const auth = btoa(`${username}:${apiKey}`);
    const params = new URLSearchParams({ search: query });
    if (limit) params.set('page', '1');

    const response = await fetch(`https://www.kaggle.com/api/v1/datasets/list?${params}`, {
      headers: { 'Authorization': `Basic ${auth}` },
    });

    const data = await response.json();
    if (!response.ok) {
      return new Response(
        JSON.stringify({ success: false, error: `Kaggle API error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed';
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
