/**
 * AI Response Parser
 * Extracts <chart> and <transform> blocks from AI responses
 */

export interface ChartConfig {
  type: 'bar' | 'line' | 'scatter' | 'pie' | 'heatmap' | 'histogram';
  x?: string;
  y?: string;
  title?: string;
  color?: string;
  data?: Array<Record<string, any>>;
}

export interface TransformConfig {
  action: 'drop' | 'fill' | 'filter' | 'encode' | 'normalize';
  column?: string;
  value?: any;
  condition?: string;
}

export interface ParsedAIResponse {
  text: string;           // Clean text without blocks
  chart: ChartConfig | null;
  transform: TransformConfig[] | null;
  dataType: 'tabular' | 'nominal' | 'json' | null;
  thoughts: string | null;
}

/**
 * Extract blocks from AI response text
 */
export function extractBlocks(text: string): ParsedAIResponse {
  // Extract <chart> block
  const chartMatch = text.match(/<chart>([\s\S]*?)<\/chart>/);
  let chart: ChartConfig | null = null;
  if (chartMatch) {
    try {
      chart = JSON.parse(chartMatch[1].trim());
    } catch (e) {
      console.warn('Failed to parse chart block:', e);
    }
  }

  // Extract <transform> block
  const transformMatch = text.match(/<transform>([\s\S]*?)<\/transform>/);
  let transform: TransformConfig[] | null = null;
  if (transformMatch) {
    try {
      const parsed = JSON.parse(transformMatch[1].trim());
      transform = Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
      console.warn('Failed to parse transform block:', e);
    }
  }

  // Extract DATA_TYPE
  const dataTypeMatch = text.match(/DATA_TYPE:\s*(tabular|nominal|json)/i);
  const dataType = dataTypeMatch 
    ? (dataTypeMatch[1].toLowerCase() as 'tabular' | 'nominal' | 'json') 
    : null;

  // Extract THOUGHTS
  const thoughtsMatch = text.match(/THOUGHTS:\s*([^\n]+)/i);
  const thoughts = thoughtsMatch ? thoughtsMatch[1].trim() : null;

  // Clean text (remove blocks for display)
  const cleanText = text
    .replace(/<chart>[\s\S]*?<\/chart>/g, '')
    .replace(/<transform>[\s\S]*?<\/transform>/g, '')
    .replace(/DATA_TYPE:\s*(tabular|nominal|json)/gi, '')
    .replace(/THOUGHTS:\s*[^\n]+/gi, '')
    .trim();

  return {
    text: cleanText,
    chart,
    transform,
    dataType,
    thoughts,
  };
}

/**
 * Check if text contains actionable blocks
 */
export function hasActionableBlocks(text: string): boolean {
  return text.includes('<chart>') || text.includes('<transform>');
}

/**
 * Format chart data for Recharts
 */
export function formatChartData(
  data: Array<Record<string, any>>, 
  xKey: string, 
  yKey: string
): Array<{ name: string; value: number }> {
  return data.map(row => ({
    name: String(row[xKey]),
    value: Number(row[yKey]) || 0,
  }));
}

/**
 * Auto-detect chart type based on data
 */
export function suggestChartType(
  columns: string[], 
  sampleData: Array<Record<string, any>>
): ChartConfig['type'] {
  // Check for categorical vs numeric columns
  const numericCols = columns.filter(col => 
    sampleData.every(row => !isNaN(Number(row[col])))
  );
  
  const categoricalCols = columns.filter(col => 
    !numericCols.includes(col)
  );

  // Suggest based on column types
  if (numericCols.length >= 2) {
    return 'scatter'; // Correlation
  }
  if (categoricalCols.length >= 1 && numericCols.length >= 1) {
    return 'bar'; // Comparison
  }
  if (numericCols.length === 1) {
    return 'histogram'; // Distribution
  }
  
  return 'bar'; // Default
}

/**
 * Apply transform operations to dataset
 */
export function applyTransforms(
  data: Array<Record<string, any>>,
  transforms: TransformConfig[]
): Array<Record<string, any>> {
  let result = [...data];

  for (const t of transforms) {
    switch (t.action) {
      case 'drop':
        if (t.column) {
          result = result.map(row => {
            const { [t.column!]: _, ...rest } = row;
            return rest;
          });
        }
        break;
      
      case 'fill':
        if (t.column && t.value !== undefined) {
          result = result.map(row => ({
            ...row,
            [t.column!]: row[t.column!] ?? t.value,
          }));
        }
        break;
      
      case 'filter':
        if (t.condition) {
          // Simple filter evaluation
          result = result.filter(row => {
            try {
              return eval(t.condition!.replace(/\b(\w+)\b/g, (match) => {
                return row[match] !== undefined ? JSON.stringify(row[match]) : match;
              }));
            } catch {
              return true;
            }
          });
        }
        break;
      
      case 'normalize':
        if (t.column) {
          const values = result.map(row => Number(row[t.column!])).filter(v => !isNaN(v));
          const min = Math.min(...values);
          const max = Math.max(...values);
          const range = max - min || 1;
          
          result = result.map(row => ({
            ...row,
            [`${t.column}_normalized`]: (Number(row[t.column!]) - min) / range,
          }));
        }
        break;
    }
  }

  return result;
}
