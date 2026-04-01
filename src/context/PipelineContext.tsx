import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ColumnAnalysis, DatasetState, PipelineStep, AIReasoning } from '@/types/dataset';
import { parseCSV, parseJSON, analyzeColumns, cleanData, transformData, toLLMReady } from '@/lib/dataProcessing';
import { getAIReasonings } from '@/lib/aiReasoning';

interface PipelineContextType {
  step: PipelineStep;
  setStep: (s: PipelineStep) => void;
  dataset: DatasetState;
  fileName: string;
  isProcessing: boolean;
  handleUpload: (file: File) => Promise<void>;
  runAnalysis: () => Promise<void>;
  runCleaning: () => void;
  runTransform: () => void;
  updateColumn: (name: string, updates: Partial<ColumnAnalysis>) => void;
}

const PipelineContext = createContext<PipelineContextType | null>(null);

export const usePipeline = () => {
  const ctx = useContext(PipelineContext);
  if (!ctx) throw new Error('usePipeline must be inside PipelineProvider');
  return ctx;
};

const emptyState: DatasetState = {
  rawData: [], columns: [], cleanedData: [], transformedData: [], llmReadyData: [], aiReasonings: [],
};

export const PipelineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [step, setStep] = useState<PipelineStep>('upload');
  const [dataset, setDataset] = useState<DatasetState>(emptyState);
  const [fileName, setFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleUpload = useCallback(async (file: File) => {
    setIsProcessing(true);
    try {
      const text = await file.text();
      const isJSON = file.name.endsWith('.json');
      const rawData = isJSON ? parseJSON(text) : parseCSV(text);
      setFileName(file.name);
      setDataset({ ...emptyState, rawData });
      setStep('analyze');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const runAnalysis = useCallback(async () => {
    setIsProcessing(true);
    try {
      const columns = analyzeColumns(dataset.rawData);
      const aiReasonings = await getAIReasonings(columns);
      setDataset(prev => ({ ...prev, columns, aiReasonings }));
      setStep('clean');
    } finally {
      setIsProcessing(false);
    }
  }, [dataset.rawData]);

  const runCleaning = useCallback(() => {
    const cleanedData = cleanData(dataset.rawData, dataset.columns);
    setDataset(prev => ({ ...prev, cleanedData }));
    setStep('transform');
  }, [dataset.rawData, dataset.columns]);

  const runTransform = useCallback(() => {
    const transformedData = transformData(dataset.cleanedData, dataset.columns);
    const llmReadyData = toLLMReady(transformedData);
    setDataset(prev => ({ ...prev, transformedData, llmReadyData }));
    setStep('export');
  }, [dataset.cleanedData, dataset.columns]);

  const updateColumn = useCallback((name: string, updates: Partial<ColumnAnalysis>) => {
    setDataset(prev => ({
      ...prev,
      columns: prev.columns.map(c => c.name === name ? { ...c, ...updates } : c),
    }));
  }, []);

  return (
    <PipelineContext.Provider value={{
      step, setStep, dataset, fileName, isProcessing,
      handleUpload, runAnalysis, runCleaning, runTransform, updateColumn,
    }}>
      {children}
    </PipelineContext.Provider>
  );
};
