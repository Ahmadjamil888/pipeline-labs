import { Router, Request, Response } from 'express';
import Papa from 'papaparse';
import { getAuth } from '../auth';
import { supabaseAdmin } from '../supabase';
import { analyzeDataset } from '../services/planner';
import { generateGeminiText } from '../services/gemini';

export const aiRouter = Router();

function buildFallbackChat(message: string, datasetSummary: Record<string, unknown> | null): string {
  const lower = message.toLowerCase();
  const hasSmallDatasetHint = lower.includes('small') || lower.includes('few rows');
  const taskType = typeof datasetSummary?.task_type === 'string' ? datasetSummary.task_type : 'classification';

  if (lower.includes('split') || lower.includes('train') || lower.includes('validation')) {
    return [
      `For a ${taskType} workflow, start with a ${hasSmallDatasetHint ? '70/15/15' : '80/10/10'} split if you need train/validation/test sets.`,
      'Use stratification when the target is imbalanced.',
      'Run k-fold cross validation before locking the final hyperparameters if the dataset is small.',
      'Check for duplicate rows and leakage across the split boundary before training.',
    ].join(' ');
  }

  return [
    'Gemini is unavailable right now, so Pipeline Labs is returning the local fallback copilot.',
    'Start by validating schema consistency, missing-value density, class imbalance, duplicates, and leakage risks.',
    'Then create a reproducible split, encode categorical fields, normalize numeric features, and document the workflow before launching training.',
  ].join(' ');
}

function buildFallbackReasonings(columns: Record<string, any>[]) {
  return columns.map((column) => ({
    column: String(column.name || 'unknown'),
    action: (column.isId || column.type === 'id') ? 'dropped' : column.type === 'categorical' ? 'transformed' : 'kept',
    reason: (column.isId || column.type === 'id')
      ? 'Identifier-like field is likely to leak row identity rather than model signal.'
      : column.type === 'categorical'
      ? 'Categorical values should be encoded before training and checked for high-cardinality skew.'
      : 'Column can stay in the dataset after standard null and distribution checks.',
    suggestion: column.nullPercent > 20
      ? 'Review missing-value handling before training.'
      : 'Validate this feature against leakage and drift during split generation.',
    type: (column.isId || column.type === 'id') ? 'drop' : column.type === 'categorical' ? 'transform' : 'keep',
  }));
}

async function loadDatasetPreview(userId: string, datasetId?: string): Promise<{
  datasetSummary: Record<string, unknown> | null;
  previewRows: Record<string, unknown>[];
}> {
  if (!datasetId) {
    return { datasetSummary: null, previewRows: [] };
  }

  const { data: dataset, error } = await supabaseAdmin
    .from('datasets')
    .select('*')
    .eq('id', datasetId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !dataset) {
    throw new Error('Dataset not found');
  }

  let previewRows = Array.isArray(dataset.preview_rows) ? dataset.preview_rows : [];

  if ((!previewRows || previewRows.length === 0) && dataset.storage_path) {
    const { data: file, error: storageError } = await supabaseAdmin.storage
      .from('datasets')
      .download(dataset.storage_path);

    if (!storageError && file) {
      const text = await file.text();
      if (dataset.storage_path.endsWith('.json')) {
        const parsed = JSON.parse(text);
        previewRows = Array.isArray(parsed) ? parsed.slice(0, 20) : [parsed];
      } else {
        const parsed = Papa.parse(text, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
        });
        previewRows = (parsed.data as Record<string, unknown>[]).slice(0, 20);
      }
    }
  }

  const analysis = analyzeDataset(previewRows);
  return {
    datasetSummary: {
      id: dataset.id,
      file_name: dataset.file_name,
      row_count: dataset.row_count,
      column_count: dataset.column_count,
      task_type: dataset.task_type ?? analysis.task_type,
      label_column: dataset.label_column ?? analysis.label_column,
      data_type: dataset.data_type ?? analysis.data_type,
      quality_score: analysis.data_quality_score,
      columns: analysis.columns,
    },
    previewRows: previewRows.slice(0, 8),
  };
}

aiRouter.post('/chat', async (req: Request, res: Response) => {
  try {
    const auth = getAuth(req);
    const { message, history, datasetId } = req.body ?? {};

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'message is required' });
      return;
    }

    const { datasetSummary, previewRows } = await loadDatasetPreview(auth.userId, datasetId);
    const priorMessages = Array.isArray(history) ? history.slice(-8) : [];

    let responseText: string;
    try {
      responseText = await generateGeminiText(
        [
          'You are Pipeline Labs AI, an expert ML platform copilot.',
          'Your job is to help users clean data, design training workflows, and prepare LLM/ML datasets for production training.',
          'You understand train/validation/test splits, leakage detection, class imbalance, deduplication, feature engineering, cross validation, stratification, normalization, prompt-format preparation, and cloud execution tradeoffs.',
          'When useful, suggest concrete transformations using a single <transform>{...}</transform> JSON block.',
          'Supported transform actions are drop, fill, filter, encode, normalize.',
          'If a chart would help, optionally include one <chart>{...}</chart> JSON block.',
          'Keep the response practical and concise.',
        ].join(' '),
        JSON.stringify(
          {
            dataset: datasetSummary,
            previewRows,
            history: priorMessages,
            userMessage: message,
          },
          null,
          2
        )
      );
    } catch (error) {
      console.warn('[AI] Falling back to local chat response:', error);
      responseText = buildFallbackChat(message, datasetSummary);
    }

    res.json({
      content: responseText,
    });
  } catch (err: any) {
    console.error('[AI] Chat error:', err);
    res.status(500).json({ error: err.message || 'AI request failed' });
  }
});

aiRouter.post('/reasonings', async (req: Request, res: Response) => {
  try {
    const { columns } = req.body ?? {};
    if (!Array.isArray(columns)) {
      res.status(400).json({ error: 'columns array is required' });
      return;
    }

    try {
      const content = await generateGeminiText(
        'You are a senior data scientist. Return only valid JSON.',
        `Analyze these columns and return a JSON array of objects with keys column, action, reason, suggestion, type.\n${JSON.stringify(columns, null, 2)}`
      );

      const cleaned = content.replace(/```json\s*/g, '').replace(/```/g, '').trim();
      res.json(JSON.parse(cleaned));
    } catch (error) {
      console.warn('[AI] Falling back to local reasonings:', error);
      res.json(buildFallbackReasonings(columns));
    }
  } catch (err: any) {
    console.error('[AI] Reasonings error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate reasonings' });
  }
});
