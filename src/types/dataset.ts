export type ColumnType = 'numerical' | 'categorical' | 'text' | 'datetime' | 'irrelevant';

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
  isConstant: boolean;
  isId: boolean;
  keep: boolean;
  scalingMethod: 'none' | 'normalize' | 'standardize';
}

export interface DatasetState {
  rawData: Record<string, unknown>[];
  columns: ColumnAnalysis[];
  cleanedData: Record<string, unknown>[];
  transformedData: Record<string, unknown>[];
  llmReadyData: Record<string, unknown>[];
  aiReasonings: AIReasoning[];
}

export interface AIReasoning {
  column: string;
  action: string;
  reason: string;
  suggestion?: string;
  type: 'drop' | 'keep' | 'transform' | 'warning' | 'suggestion';
}

export type PipelineStep = 'upload' | 'analyze' | 'clean' | 'transform' | 'export';
