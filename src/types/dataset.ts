export type ColumnType = 'numerical' | 'categorical' | 'text' | 'datetime' | 'irrelevant';

export interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'scatter' | 'heatmap' | 'histogram' | 'boxplot';
  data: any[];
  xKey?: string;
  yKey?: string;
  zKey?: string;
  title: string;
  description?: string;
}

export interface DatasetVersion {
  id: string;
  dataset_id: string;
  version_data: Record<string, unknown>[];
  change_summary: string;
  created_at: string;
}

export interface ColumnAnalysis {
  name: string;
  type: ColumnType;
  nullCount: number;
  nullPercent: number;
  uniqueCount: number;
  uniquePercent: number;
  sample: unknown[];
  mean?: number;
  median?: number;
  std?: number;
  mode?: string;
  min?: number;
  max?: number;
  q1?: number;
  q3?: number;
  skewness?: number;
  kurtosis?: number;
  categoryFrequencies?: Record<string, number>;
  isConstant: boolean;
  isId: boolean;
  isEmail?: boolean;
  keep: boolean;
  scalingMethod: 'none' | 'normalize' | 'standardize';
  warning?: string;
}

export interface DatasetState {
  rawData: Record<string, unknown>[];
  columns: ColumnAnalysis[];
  currentData: Record<string, unknown>[];
  versions: DatasetVersion[];
  charts: ChartConfig[];
  aiReasonings: AIReasoning[];
}

export interface AIReasoning {
  column: string;
  action: string;
  reason: string;
  suggestion?: string;
  type: 'drop' | 'keep' | 'transform' | 'warning' | 'suggestion';
}

export type PipelineStep = 'upload' | 'analyze' | 'clean' | 'transform' | 'explore' | 'export';
