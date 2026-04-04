import React, { createContext, useContext, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
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
  const { user } = useAuth();
  const [step, setStep] = useState<PipelineStep>('upload');
  const [dataset, setDataset] = useState<DatasetState>(emptyState);
  const [fileName, setFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleUpload = useCallback(async (file: File) => {
    if (!user) {
      toast.error('Please sign in to upload datasets');
      return;
    }

    setIsProcessing(true);
    try {
      // Parse file locally first
      const text = await file.text();
      const isJSON = file.name.endsWith('.json');
      const rawData = isJSON ? parseJSON(text) : parseCSV(text);
      
      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop() || 'csv';
      
      const { error: uploadError } = await supabase.storage
        .from('datasets')
        .upload(filePath, file, {
          contentType: file.type || 'text/csv',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('datasets')
        .getPublicUrl(filePath);

      // Create dataset record in database
      const { data: datasetRecord, error: dbError } = await supabase
        .from('datasets')
        .insert({
          user_id: user.id,
          file_name: file.name,
          mime_type: file.type || 'text/csv',
          storage_path: filePath,
          row_count: rawData.length,
          column_count: rawData.length > 0 ? Object.keys(rawData[0]).length : 0,
          status: 'uploaded',
          preview_rows: JSON.parse(JSON.stringify(rawData.slice(0, 20))),
        })
        .select()
        .single();

      if (dbError) throw dbError;

      setFileName(file.name);
      setDataset({ ...emptyState, rawData });
      setStep('analyze');
      toast.success('Dataset uploaded successfully!');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload dataset');
    } finally {
      setIsProcessing(false);
    }
  }, [user]);

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
