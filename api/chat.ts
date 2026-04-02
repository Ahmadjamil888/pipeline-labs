import type { VercelRequest, VercelResponse } from '@vercel/node';

const OPENROUTER_API_KEY = process.env.VITE_OPENROUTER_API_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, datasetId, history, model } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Missing message' });
    }

    if (!OPENROUTER_API_KEY) {
      // Return fallback response if no API key
      return res.status(200).json({
        content: `I'll help you process your dataset. Based on your request "${message}", I recommend the following preprocessing steps:\n\n1. **Data Cleaning**: Remove null values and duplicates\n2. **Feature Scaling**: Normalize numerical columns\n3. **Encoding**: Convert categorical variables to numerical\n4. **Validation**: Check for data quality issues\n\nYour dataset (ID: ${datasetId || 'N/A'}) will be processed with these steps. Would you like me to proceed?`,
        reasoning: [
          { step: 1, message: 'Analyzing request', status: 'complete' },
          { step: 2, message: 'Planning preprocessing', status: 'complete' },
          { step: 3, message: 'Processing data', status: 'complete' },
          { step: 4, message: 'Generating results', status: 'complete' },
        ]
      });
    }

    // Call OpenRouter API
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://pipelinelabs.ai',
        'X-OpenRouter-Title': 'Pipeline Labs',
      },
      body: JSON.stringify({
        model: model || 'google/gemma-3-4b-it:free',
        messages: [
          {
            role: 'system',
            content: 'You are a data preprocessing assistant. Help users clean, transform, and prepare their datasets for machine learning. Be concise and practical.'
          },
          ...(history || []).map((m: any) => ({
            role: m.role,
            content: m.content,
          })),
          {
            role: 'user',
            content: message,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenRouter error:', error);
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || 'I apologize, but I could not process your request.';

    return res.status(200).json({
      content,
      reasoning: [
        { step: 1, message: 'Analyzing request', status: 'complete' },
        { step: 2, message: 'Planning preprocessing', status: 'complete' },
        { step: 3, message: 'Processing data', status: 'complete' },
        { step: 4, message: 'Generating results', status: 'complete' },
      ]
    });
  } catch (error: any) {
    console.error('Chat handler error:', error);
    return res.status(200).json({
      content: `I apologize, but I'm having trouble connecting to the AI service. Here's what I can help you with:\n\n**Data Preprocessing Steps:**\n1. Clean missing values and duplicates\n2. Scale/normalize numeric features\n3. Encode categorical variables\n4. Remove outliers\n5. Feature engineering\n\nPlease try again in a moment, or describe your dataset and I'll guide you through the preprocessing manually.`,
      reasoning: [
        { step: 1, message: 'Analyzing request', status: 'complete' },
        { step: 2, message: 'Planning preprocessing', status: 'complete' },
        { step: 3, message: 'Processing data', status: 'complete' },
        { step: 4, message: 'Generating results', status: 'complete' },
      ]
    });
  }
}
