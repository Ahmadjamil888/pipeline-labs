import Papa from 'papaparse';
import type { ColumnAnalysis, ColumnType, DatasetState } from '@/types/dataset';

export function parseCSV(text: string): Record<string, unknown>[] {
  const result = Papa.parse(text, { header: true, skipEmptyLines: true, dynamicTyping: true });
  return result.data as Record<string, unknown>[];
}

export function parseJSON(text: string): Record<string, unknown>[] {
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed : [parsed];
}

export function analyzeColumns(data: Record<string, unknown>[]): ColumnAnalysis[] {
  if (!data.length) return [];
  const keys = Object.keys(data[0]);
  
  return keys.map(name => {
    const values = data.map(row => row[name]);
    const nonNull = values.filter(v => v !== null && v !== undefined && v !== '');
    const nullCount = values.length - nonNull.length;
    const nullPercent = (nullCount / values.length) * 100;
    const uniqueValues = new Set(nonNull.map(String));
    const uniqueCount = uniqueValues.size;
    const uniquePercent = (uniqueCount / Math.max(nonNull.length, 1)) * 100;
    const isConstant = uniqueCount <= 1;
    const isId = uniquePercent > 95 && uniqueCount > 10 && nonNull.length > 10;
    
    const type = detectType(nonNull, name, uniquePercent, isId);
    const analysis: ColumnAnalysis = {
      name, type, nullCount, nullPercent, uniqueCount, uniquePercent,
      sample: nonNull.slice(0, 5),
      isConstant, isId,
      keep: !isConstant && !isId && nullPercent < 80,
      scalingMethod: type === 'numerical' ? 'standardize' : 'none',
    };

    if (type === 'numerical') {
      const nums = nonNull.map(Number).filter(n => !isNaN(n));
      if (nums.length) {
        analysis.mean = nums.reduce((a, b) => a + b, 0) / nums.length;
        const sorted = [...nums].sort((a, b) => a - b);
        analysis.median = sorted[Math.floor(sorted.length / 2)];
        const variance = nums.reduce((sum, n) => sum + (n - analysis.mean!) ** 2, 0) / nums.length;
        analysis.std = Math.sqrt(variance);
      }
    }

    if (type === 'categorical') {
      const freq: Record<string, number> = {};
      nonNull.forEach(v => { const s = String(v); freq[s] = (freq[s] || 0) + 1; });
      analysis.mode = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0];
    }

    return analysis;
  });
}

function detectType(values: unknown[], name: string, uniquePercent: number, isId: boolean): ColumnType {
  if (isId) return 'irrelevant';
  const nameLower = name.toLowerCase();
  if (/\b(id|uuid|index)\b/.test(nameLower) && uniquePercent > 90) return 'irrelevant';
  
  const sample = values.slice(0, 50);
  const datePatterns = [/^\d{4}-\d{2}-\d{2}/, /^\d{2}\/\d{2}\/\d{4}/, /^\d{2}-\d{2}-\d{4}/];
  const dateCount = sample.filter(v => datePatterns.some(p => p.test(String(v)))).length;
  if (dateCount > sample.length * 0.7) return 'datetime';
  
  const numCount = sample.filter(v => !isNaN(Number(v)) && v !== '' && v !== null).length;
  if (numCount > sample.length * 0.8) return 'numerical';
  
  if (uniquePercent < 50 || values.length < 20) return 'categorical';
  
  const avgLength = sample.reduce((sum, v) => sum + String(v).length, 0) / sample.length;
  if (avgLength > 50) return 'text';
  
  return 'categorical';
}

export function cleanData(data: Record<string, unknown>[], columns: ColumnAnalysis[]): Record<string, unknown>[] {
  let cleaned = data.map(row => ({ ...row }));
  
  // Remove duplicates
  const seen = new Set<string>();
  cleaned = cleaned.filter(row => {
    const key = JSON.stringify(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  // Fill missing values
  columns.filter(c => c.keep).forEach(col => {
    cleaned.forEach(row => {
      if (row[col.name] === null || row[col.name] === undefined || row[col.name] === '') {
        if (col.type === 'numerical' && col.median !== undefined) {
          row[col.name] = col.median;
        } else if (col.type === 'categorical' && col.mode) {
          row[col.name] = col.mode;
        } else {
          row[col.name] = 'Unknown';
        }
      }
    });
  });
  
  // Remove outliers for numerical columns (IQR method)
  columns.filter(c => c.keep && c.type === 'numerical').forEach(col => {
    const vals = cleaned.map(r => Number(r[col.name])).filter(n => !isNaN(n)).sort((a, b) => a - b);
    if (vals.length < 10) return;
    const q1 = vals[Math.floor(vals.length * 0.25)];
    const q3 = vals[Math.floor(vals.length * 0.75)];
    const iqr = q3 - q1;
    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;
    cleaned = cleaned.filter(r => {
      const v = Number(r[col.name]);
      return !isNaN(v) && v >= lower && v <= upper;
    });
  });
  
  return cleaned;
}

export function transformData(data: Record<string, unknown>[], columns: ColumnAnalysis[]): Record<string, unknown>[] {
  const keptCols = columns.filter(c => c.keep);
  
  return data.map(row => {
    const newRow: Record<string, unknown> = {};
    
    keptCols.forEach(col => {
      const val = row[col.name];
      
      if (col.type === 'datetime') {
        try {
          const d = new Date(String(val));
          if (!isNaN(d.getTime())) {
            newRow[`${col.name}_year`] = d.getFullYear();
            newRow[`${col.name}_month`] = d.getMonth() + 1;
            newRow[`${col.name}_day`] = d.getDate();
            newRow[`${col.name}_dayofweek`] = d.getDay();
          }
        } catch { newRow[col.name] = val; }
      } else if (col.type === 'categorical') {
        // One-hot encode
        const categories = [...new Set(data.map(r => String(r[col.name])))].slice(0, 20);
        categories.forEach(cat => {
          newRow[`${col.name}_${cat}`] = String(val) === cat ? 1 : 0;
        });
      } else if (col.type === 'numerical') {
        const num = Number(val);
        if (col.scalingMethod === 'standardize' && col.std && col.std > 0) {
          newRow[col.name] = Number(((num - col.mean!) / col.std).toFixed(4));
        } else if (col.scalingMethod === 'normalize' && col.mean !== undefined) {
          const vals = data.map(r => Number(r[col.name])).filter(n => !isNaN(n));
          const min = Math.min(...vals);
          const max = Math.max(...vals);
          newRow[col.name] = max > min ? Number(((num - min) / (max - min)).toFixed(4)) : 0;
        } else {
          newRow[col.name] = num;
        }
      } else {
        newRow[col.name] = val;
      }
    });
    
    return newRow;
  });
}

export function toLLMReady(data: Record<string, unknown>[]): Record<string, unknown>[] {
  return data.map((row, i) => ({
    features: { ...row },
    label: null,
    metadata: { index: i },
  }));
}

export function exportCSV(data: Record<string, unknown>[]): string {
  return Papa.unparse(data);
}

export function exportJSON(data: Record<string, unknown>[]): string {
  return JSON.stringify(data, null, 2);
}
