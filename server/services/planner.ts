// =====================================================
// AI PLANNER LAYER
// Analyzes datasets and generates structured training plans.
// This is NOT execution — just a plan.
// =====================================================

interface DatasetAnalysis {
  data_type: 'tabular' | 'text' | 'image' | 'audio' | 'mixed';
  row_count: number;
  column_count: number;
  columns: ColumnInfo[];
  label_column: string | null;
  task_type: TaskType;
  suggested_models: ModelSuggestion[];
  preprocessing_steps: string[];
  data_quality_score: number; // 0-100
}

interface ColumnInfo {
  name: string;
  type: 'numerical' | 'categorical' | 'text' | 'datetime' | 'id';
  unique_count: number;
  null_percent: number;
  sample_values: string[];
}

type TaskType =
  | 'classification'
  | 'regression'
  | 'text_classification'
  | 'ner'
  | 'llm_finetuning'
  | 'image_classification'
  | 'object_detection'
  | 'clustering'
  | 'anomaly_detection';

interface ModelSuggestion {
  name: string;
  framework: string;
  gpu_required: string;
  estimated_time_minutes: number;
  estimated_cost_usd: number;
  confidence: number;
}

export interface TrainingPlan {
  task: TaskType;
  model: string;
  framework: string;
  train_test_split: string;
  batch_size: number;
  optimizer: string;
  learning_rate: number;
  epochs: number;
  gpu_required: string;
  preprocessing: string[];
  metrics: string[];
  estimated_time_minutes: number;
  estimated_cost_usd: number;
  hyperparameter_search?: {
    method: string;
    params: Record<string, number[]>;
  };
}

// =====================================================
// STEP A: Dataset Analysis
// =====================================================
export function analyzeDataset(data: Record<string, unknown>[]): DatasetAnalysis {
  if (!data.length) {
    return {
      data_type: 'tabular',
      row_count: 0,
      column_count: 0,
      columns: [],
      label_column: null,
      task_type: 'classification',
      suggested_models: [],
      preprocessing_steps: [],
      data_quality_score: 0,
    };
  }

  const keys = Object.keys(data[0]);
  const columns: ColumnInfo[] = keys.map(name => {
    const values = data.map(row => row[name]);
    const nonNull = values.filter(v => v !== null && v !== undefined && v !== '');
    const uniqueValues = new Set(nonNull.map(String));
    const sampleValues = nonNull.slice(0, 5).map(String);

    // Detect type
    const numCount = nonNull.filter(v => !isNaN(Number(v)) && v !== '').length;
    const avgLength = nonNull.reduce<number>((sum, v) => sum + String(v).length, 0) / Math.max(nonNull.length, 1);
    const uniquePercent = (uniqueValues.size / Math.max(nonNull.length, 1)) * 100;

    let type: ColumnInfo['type'] = 'categorical';
    if (uniquePercent > 95 && nonNull.length > 10) type = 'id';
    else if (numCount > nonNull.length * 0.8) type = 'numerical';
    else if (avgLength > 50) type = 'text';
    else if (/^\d{4}-\d{2}-\d{2}/.test(String(nonNull[0]))) type = 'datetime';

    return {
      name,
      type,
      unique_count: uniqueValues.size,
      null_percent: ((values.length - nonNull.length) / values.length) * 100,
      sample_values: sampleValues,
    };
  });

  // Detect data type
  const textColumns = columns.filter(c => c.type === 'text');
  const numericalColumns = columns.filter(c => c.type === 'numerical');
  const categoricalColumns = columns.filter(c => c.type === 'categorical');
  const idColumns = columns.filter(c => c.type === 'id');

  let data_type: DatasetAnalysis['data_type'] = 'tabular';
  if (textColumns.length > 0 && numericalColumns.length === 0 && categoricalColumns.length <= 1) {
    data_type = 'text';
  }

  // Detect label column (target variable)
  const labelColumn = detectLabelColumn(columns, data);

  // Detect task type
  const taskType = detectTaskType(columns, labelColumn, data);

  // Suggest models
  const suggestedModels = suggestModels(taskType, data.length, columns);

  // Preprocessing steps
  const preprocessingSteps = suggestPreprocessing(columns, taskType);

  // Data quality score
  const qualityScore = calculateQualityScore(columns, data.length);

  return {
    data_type,
    row_count: data.length,
    column_count: keys.length,
    columns,
    label_column: labelColumn,
    task_type: taskType,
    suggested_models: suggestedModels,
    preprocessing_steps: preprocessingSteps,
    data_quality_score: qualityScore,
  };
}

function detectLabelColumn(columns: ColumnInfo[], data: Record<string, unknown>[]): string | null {
  // Heuristics for finding the label/target column:
  // 1. Column named "label", "target", "class", "y", "outcome"
  // 2. Low-cardinality categorical column (not an ID)
  // 3. Last categorical column

  const nameHints = ['label', 'target', 'class', 'y', 'outcome', 'sentiment', 'category', 'label_id'];
  const byName = columns.find(c => nameHints.some(h => c.name.toLowerCase().includes(h)) && c.type === 'categorical');
  if (byName) return byName.name;

  // Low cardinality categorical (2-20 unique values, not ID)
  const candidates = columns
    .filter(c => c.type === 'categorical' && c.unique_count >= 2 && c.unique_count <= 20 && c.null_percent < 20)
    .sort((a, b) => a.unique_count - b.unique_count);

  if (candidates.length > 0) return candidates[0].name;

  return null;
}

function detectTaskType(columns: ColumnInfo[], labelColumn: string | null, data: Record<string, unknown>[]): TaskType {
  if (!labelColumn) {
    // No clear label — unsupervised
    return 'clustering';
  }

  const labelCol = columns.find(c => c.name === labelColumn);
  if (!labelCol) return 'classification';

  // Text data with label → text classification or NER
  if (labelCol.type === 'categorical') {
    const textCols = columns.filter(c => c.type === 'text');
    if (textCols.length > 0) {
      // If label has many unique values, might be NER
      if (labelCol.unique_count > 20) return 'ner';
      return 'text_classification';
    }

    // Binary or multiclass
    if (labelCol.unique_count <= 2) return 'classification';
    if (labelCol.unique_count <= 20) return 'classification';
    // Many categories — could be text classification
    return 'text_classification';
  }

  if (labelCol.type === 'numerical') {
    // Check if it's really continuous or discrete
    if (labelCol.unique_count <= 20) return 'classification';
    return 'regression';
  }

  if (labelCol.type === 'text') {
    return 'llm_finetuning';
  }

  return 'classification';
}

function suggestModels(taskType: TaskType, rowCount: number, columns: ColumnInfo[]): ModelSuggestion[] {
  const models: Record<TaskType, ModelSuggestion[]> = {
    classification: [
      { name: 'RandomForest', framework: 'sklearn', gpu_required: 'none', estimated_time_minutes: 2, estimated_cost_usd: 0.01, confidence: 0.85 },
      { name: 'XGBoost', framework: 'xgboost', gpu_required: 'none', estimated_time_minutes: 5, estimated_cost_usd: 0.02, confidence: 0.9 },
      { name: 'distilbert-base-uncased', framework: 'pytorch', gpu_required: 'T4', estimated_time_minutes: 30, estimated_cost_usd: 0.35, confidence: 0.7 },
    ],
    regression: [
      { name: 'RandomForest', framework: 'sklearn', gpu_required: 'none', estimated_time_minutes: 2, estimated_cost_usd: 0.01, confidence: 0.8 },
      { name: 'XGBoost', framework: 'xgboost', gpu_required: 'none', estimated_time_minutes: 5, estimated_cost_usd: 0.02, confidence: 0.9 },
      { name: 'LinearRegression', framework: 'sklearn', gpu_required: 'none', estimated_time_minutes: 1, estimated_cost_usd: 0.01, confidence: 0.6 },
    ],
    text_classification: [
      { name: 'distilbert-base-uncased', framework: 'pytorch', gpu_required: 'T4', estimated_time_minutes: 30, estimated_cost_usd: 0.35, confidence: 0.95 },
      { name: 'bert-base-uncased', framework: 'pytorch', gpu_required: 'T4', estimated_time_minutes: 45, estimated_cost_usd: 0.50, confidence: 0.85 },
      { name: 'roberta-base', framework: 'pytorch', gpu_required: 'T4', estimated_time_minutes: 50, estimated_cost_usd: 0.55, confidence: 0.8 },
    ],
    ner: [
      { name: 'dslim/bert-base-NER', framework: 'pytorch', gpu_required: 'T4', estimated_time_minutes: 40, estimated_cost_usd: 0.45, confidence: 0.9 },
      { name: 'dbmdz/bert-large-cased-finetuned-conll03-english', framework: 'pytorch', gpu_required: 'A10G', estimated_time_minutes: 60, estimated_cost_usd: 0.80, confidence: 0.75 },
    ],
    llm_finetuning: [
      { name: 'meta-llama/Llama-3.2-1B', framework: 'pytorch', gpu_required: 'A10G', estimated_time_minutes: 90, estimated_cost_usd: 1.20, confidence: 0.85 },
      { name: 'microsoft/phi-2', framework: 'pytorch', gpu_required: 'A10G', estimated_time_minutes: 120, estimated_cost_usd: 1.60, confidence: 0.8 },
    ],
    image_classification: [
      { name: 'resnet50', framework: 'pytorch', gpu_required: 'T4', estimated_time_minutes: 30, estimated_cost_usd: 0.35, confidence: 0.9 },
      { name: 'vit-base-patch16-224', framework: 'pytorch', gpu_required: 'T4', estimated_time_minutes: 45, estimated_cost_usd: 0.50, confidence: 0.85 },
    ],
    object_detection: [
      { name: 'yolos-small', framework: 'pytorch', gpu_required: 'T4', estimated_time_minutes: 60, estimated_cost_usd: 0.70, confidence: 0.85 },
      { name: 'detr-resnet-50', framework: 'pytorch', gpu_required: 'A10G', estimated_time_minutes: 90, estimated_cost_usd: 1.20, confidence: 0.75 },
    ],
    clustering: [
      { name: 'KMeans', framework: 'sklearn', gpu_required: 'none', estimated_time_minutes: 1, estimated_cost_usd: 0.01, confidence: 0.8 },
      { name: 'DBSCAN', framework: 'sklearn', gpu_required: 'none', estimated_time_minutes: 3, estimated_cost_usd: 0.02, confidence: 0.7 },
    ],
    anomaly_detection: [
      { name: 'IsolationForest', framework: 'sklearn', gpu_required: 'none', estimated_time_minutes: 2, estimated_cost_usd: 0.01, confidence: 0.85 },
      { name: 'Autoencoder', framework: 'pytorch', gpu_required: 'T4', estimated_time_minutes: 20, estimated_cost_usd: 0.25, confidence: 0.7 },
    ],
  };

  // Adjust for dataset size
  let suggestions = models[taskType] || models.classification;

  // For small datasets, prefer simpler models
  if (rowCount < 1000) {
    suggestions = suggestions.filter(m => m.framework === 'sklearn' || m.framework === 'xgboost');
    if (suggestions.length === 0) suggestions = models[taskType].slice(0, 1);
  }

  return suggestions;
}

function suggestPreprocessing(columns: ColumnInfo[], taskType: TaskType): string[] {
  const steps: string[] = [];

  // Handle missing values
  const hasNulls = columns.some(c => c.null_percent > 0);
  if (hasNulls) steps.push('handle_missing_values');

  // Remove ID columns
  const hasIds = columns.some(c => c.type === 'id');
  if (hasIds) steps.push('drop_id_columns');

  // Encode categoricals for ML
  const hasCategoricals = columns.some(c => c.type === 'categorical');
  if (hasCategoricals && !['text_classification', 'ner', 'llm_finetuning'].includes(taskType)) {
    steps.push('encode_categoricals');
  }

  // Scale numericals
  const hasNumericals = columns.some(c => c.type === 'numerical');
  if (hasNumericals && ['classification', 'regression', 'clustering', 'anomaly_detection'].includes(taskType)) {
    steps.push('scale_numericals');
  }

  // Text-specific
  if (['text_classification', 'ner', 'llm_finetuning'].includes(taskType)) {
    steps.push('tokenize');
    steps.push('pad_sequences');
  }

  // Train/test split
  steps.push('train_test_split');

  return steps;
}

function calculateQualityScore(columns: ColumnInfo[], rowCount: number): number {
  let score = 100;

  // Penalize high null rates
  const avgNullPercent = columns.reduce((sum, c) => sum + c.null_percent, 0) / Math.max(columns.length, 1);
  score -= avgNullPercent * 0.5;

  // Penalize ID columns (wasted features)
  const idColumns = columns.filter(c => c.type === 'id').length;
  score -= idColumns * 5;

  // Penalize very small datasets
  if (rowCount < 100) score -= 20;
  else if (rowCount < 500) score -= 10;

  // Penalize too many features relative to rows
  if (columns.length > rowCount / 10) score -= 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

// =====================================================
// STEP B: Training Plan Generation
// =====================================================
export function generateTrainingPlan(analysis: DatasetAnalysis, userPreferences?: Partial<TrainingPlan>): TrainingPlan {
  const topModel = analysis.suggested_models[0];

  // Default plan based on analysis
  const plan: TrainingPlan = {
    task: analysis.task_type,
    model: topModel?.name || 'RandomForest',
    framework: topModel?.framework || 'sklearn',
    train_test_split: '80/20',
    batch_size: getDefaultBatchSize(analysis.task_type, analysis.row_count),
    optimizer: getDefaultOptimizer(analysis.task_type),
    learning_rate: getDefaultLearningRate(analysis.task_type),
    epochs: getDefaultEpochs(analysis.task_type, analysis.row_count),
    gpu_required: topModel?.gpu_required || 'none',
    preprocessing: analysis.preprocessing_steps,
    metrics: getDefaultMetrics(analysis.task_type),
    estimated_time_minutes: topModel?.estimated_time_minutes || 5,
    estimated_cost_usd: topModel?.estimated_cost_usd || 0.01,
  };

  // Add hyperparameter search for larger datasets
  if (analysis.row_count > 500 && topModel?.framework !== 'sklearn') {
    plan.hyperparameter_search = {
      method: 'grid',
      params: {
        learning_rate: [1e-5, 2e-5, 5e-5],
        batch_size: [8, 16, 32],
      },
    };
  }

  // Override with user preferences
  return { ...plan, ...userPreferences };
}

function getDefaultBatchSize(taskType: TaskType, rowCount: number): number {
  if (['text_classification', 'ner', 'llm_finetuning', 'image_classification', 'object_detection'].includes(taskType)) {
    return rowCount < 1000 ? 8 : 16;
  }
  return 32;
}

function getDefaultOptimizer(taskType: TaskType): string {
  if (['text_classification', 'ner', 'llm_finetuning', 'image_classification', 'object_detection'].includes(taskType)) {
    return 'adamw';
  }
  return 'adam';
}

function getDefaultLearningRate(taskType: TaskType): number {
  if (['llm_finetuning'].includes(taskType)) return 2e-5;
  if (['text_classification', 'ner', 'image_classification'].includes(taskType)) return 5e-5;
  return 0.001;
}

function getDefaultEpochs(taskType: TaskType, rowCount: number): number {
  if (['text_classification', 'ner', 'image_classification'].includes(taskType)) {
    return rowCount < 1000 ? 5 : 3;
  }
  if (taskType === 'llm_finetuning') return rowCount < 500 ? 5 : 3;
  if (['classification', 'regression'].includes(taskType)) {
    return 100; // sklearn-style
  }
  return 10;
}

function getDefaultMetrics(taskType: TaskType): string[] {
  const metricMap: Record<TaskType, string[]> = {
    classification: ['accuracy', 'f1_score', 'precision', 'recall'],
    regression: ['mse', 'mae', 'r2'],
    text_classification: ['accuracy', 'f1_score', 'loss'],
    ner: ['precision', 'recall', 'f1_score'],
    llm_finetuning: ['loss', 'perplexity'],
    image_classification: ['accuracy', 'top5_accuracy', 'loss'],
    object_detection: ['mAP', 'precision', 'recall'],
    clustering: ['silhouette_score', 'inertia'],
    anomaly_detection: ['precision', 'recall', 'f1_score'],
  };
  return metricMap[taskType] || ['loss', 'accuracy'];
}

// =====================================================
// AI-Enhanced Planner (uses Gemini for deeper analysis)
// =====================================================
export async function aiEnhancedPlan(
  analysis: DatasetAnalysis,
  dataPreview: Record<string, unknown>[],
  userObjective?: string,
  geminiApiKey?: string
): Promise<TrainingPlan> {
  // First, get the rule-based plan as baseline
  const basePlan = generateTrainingPlan(analysis);

  if (!geminiApiKey) {
    return basePlan;
  }

  try {
    const prompt = `You are an expert ML engineer. Analyze this dataset and generate a training plan.

Dataset Analysis:
- Type: ${analysis.data_type}
- Rows: ${analysis.row_count}, Columns: ${analysis.column_count}
- Label Column: ${analysis.label_column || 'auto-detect'}
- Task Type: ${analysis.task_type}
- Data Quality Score: ${analysis.data_quality_score}/100
- Columns: ${JSON.stringify(analysis.columns.map(c => ({ name: c.name, type: c.type, unique: c.unique_count, nulls: c.null_percent.toFixed(1) + '%' })))}

Data Preview (first 3 rows):
${JSON.stringify(dataPreview.slice(0, 3), null, 2)}

${userObjective ? `User Objective: ${userObjective}` : ''}

Generate a JSON training plan with these fields:
{
  "task": "task_type",
  "model": "model_name",
  "framework": "pytorch|sklearn|xgboost|tensorflow",
  "train_test_split": "80/20",
  "batch_size": 16,
  "optimizer": "adamw",
  "learning_rate": 0.001,
  "epochs": 3,
  "gpu_required": "T4|none",
  "preprocessing": ["step1", "step2"],
  "metrics": ["metric1", "metric2"],
  "estimated_time_minutes": 30,
  "estimated_cost_usd": 0.35,
  "hyperparameter_search": { "method": "grid", "params": {} },
  "reasoning": "Brief explanation of why this plan was chosen"
}

Return ONLY the JSON, no other text.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
        }),
      }
    );

    const result = await response.json() as any;
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const aiPlan = JSON.parse(jsonMatch[0]);
      return { ...basePlan, ...aiPlan };
    }
  } catch (err) {
    console.error('[AI Planner] Gemini call failed, using rule-based plan:', err);
  }

  return basePlan;
}
