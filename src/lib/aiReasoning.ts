import type { ColumnAnalysis, AIReasoning } from '@/types/dataset';

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '';

export async function getAIReasonings(columns: ColumnAnalysis[]): Promise<AIReasoning[]> {
  const prompt = `Analyze these dataset columns and provide reasoning for each. Return a JSON array.

Columns:
${columns.map(c => `- "${c.name}": type=${c.type}, nulls=${c.nullPercent.toFixed(1)}%, unique=${c.uniquePercent.toFixed(1)}%, constant=${c.isConstant}, isId=${c.isId}, kept=${c.keep}, samples=${JSON.stringify(c.sample.slice(0, 3))}`).join('\n')}

For each column return:
{"column":"name","action":"kept/dropped/transformed","reason":"why","suggestion":"improvement idea","type":"keep|drop|transform|warning|suggestion"}

Return ONLY a JSON array, no markdown.`;

  if (!OPENROUTER_API_KEY) {
    return generateFallbackReasonings(columns);
  }

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openrouter/auto',
        messages: [
          { role: 'system', content: 'You are a data science expert. Respond with valid JSON only.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    const cleaned = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned) as AIReasoning[];
  } catch {
    return generateFallbackReasonings(columns);
  }
}

function generateFallbackReasonings(columns: ColumnAnalysis[]): AIReasoning[] {
  return columns.map(col => {
    if (col.isId) return {
      column: col.name, action: 'Dropped', type: 'drop' as const,
      reason: `High uniqueness (${col.uniquePercent.toFixed(0)}%) suggests this is an identifier column with no predictive value.`,
      suggestion: 'Consider keeping if this links to external data sources.',
    };
    if (col.isConstant) return {
      column: col.name, action: 'Dropped', type: 'drop' as const,
      reason: 'Column has constant or near-constant values — zero variance means zero information.',
    };
    if (col.nullPercent > 80) return {
      column: col.name, action: 'Dropped', type: 'drop' as const,
      reason: `${col.nullPercent.toFixed(0)}% missing values — too sparse to be useful without significant imputation bias.`,
    };
    if (col.type === 'numerical') return {
      column: col.name, action: 'Kept & Standardized', type: 'keep' as const,
      reason: `Numerical feature with ${col.nullPercent.toFixed(0)}% nulls filled with median (${col.median?.toFixed(2)}). Standardized for model convergence.`,
      suggestion: col.std && col.mean && col.std > col.mean * 2 ? 'High variance detected — consider log transform.' : undefined,
    };
    if (col.type === 'categorical') return {
      column: col.name, action: 'One-hot encoded', type: 'transform' as const,
      reason: `${col.uniqueCount} categories detected. One-hot encoding applied for ML compatibility.`,
      suggestion: col.uniqueCount > 15 ? 'High cardinality — consider target encoding or grouping rare categories.' : undefined,
    };
    if (col.type === 'datetime') return {
      column: col.name, action: 'Decomposed', type: 'transform' as const,
      reason: 'Date column split into year, month, day, and day-of-week features for temporal pattern capture.',
    };
    return {
      column: col.name, action: 'Kept', type: 'keep' as const,
      reason: `Text column retained. May be useful for NLP features or as metadata.`,
      suggestion: 'Consider TF-IDF or embedding extraction for ML models.',
    };
  });
}
