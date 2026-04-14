import React, { createContext, useContext, useState, useCallback } from 'react';
import { aiApi } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import type { ColumnAnalysis, DatasetState, PipelineStep, ChartConfig, DatasetVersion } from '@/types/dataset';
import { parseCSV, parseJSON, analyzeColumns, executeTransform } from '@/lib/dataProcessing';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isThinking?: boolean;
}

interface PipelineContextType {
  step: PipelineStep;
  setStep: (s: PipelineStep) => void;
  dataset: DatasetState;
  fileName: string;
  isProcessing: boolean;
  messages: Message[];
  handleUpload: (file: File) => Promise<void>;
  runAnalysis: () => Promise<void>;
  updateColumn: (name: string, updates: Partial<ColumnAnalysis>) => void;
  sendMessage: (content: string) => Promise<void>;
  saveVersion: (summary: string) => Promise<void>;
  undoChange: () => Promise<void>;
  applyTransform: (transformedData: Record<string, unknown>[], summary: string) => Promise<void>;
  loadDatasetRecord: (datasetId: string) => Promise<void>;
}

const PipelineContext = createContext<PipelineContextType | null>(null);

export const usePipeline = () => {
  const ctx = useContext(PipelineContext);
  if (!ctx) throw new Error('usePipeline must be inside PipelineProvider');
  return ctx;
};

const emptyState: DatasetState = {
  rawData: [],
  columns: [],
  currentData: [],
  versions: [],
  charts: [],
  aiReasonings: [],
};

export const PipelineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [step, setStep] = useState<PipelineStep>('upload');
  const [dataset, setDataset] = useState<DatasetState>(emptyState);
  const [fileName, setFileName] = useState('');
  const [datasetId, setDatasetId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  const handleUpload = useCallback(async (file: File) => {
    if (!user) {
      toast.error('Please sign in to upload datasets');
      return;
    }

    setIsProcessing(true);
    try {
      const text = await file.text();
      const isJSON = file.name.endsWith('.json');
      const rawData = isJSON ? parseJSON(text) : parseCSV(text);

      const filePath = `${user.id}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('datasets')
        .upload(filePath, file, {
          contentType: file.type || 'text/csv',
          upsert: true
        });

      if (uploadError) throw uploadError;

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
          preview_rows: rawData.slice(0, 20),
        })
        .select()
        .single();

      if (dbError) throw dbError;

      setFileName(file.name);
      setDatasetId(datasetRecord?.id || '');
      setDataset({ ...emptyState, rawData, currentData: rawData });
      setStep('analyze');
      setMessages([{
        role: 'assistant',
        content: `I've received your dataset "${file.name}". Let me analyze the structure and start our exploration!`
      }]);
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
      const columns = analyzeColumns(dataset.currentData);
      setDataset(prev => ({ ...prev, columns }));
      setStep('explore');

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Analysis complete. I see ${columns.length} columns. What shall we explore first? I can generate stats, or we can try some "what if" scenarios.`
      }]);
    } finally {
      setIsProcessing(false);
    }
  }, [dataset.currentData]);

  const saveVersion = useCallback(async (summary: string) => {
    if (!datasetId) {
      toast.error('No dataset loaded');
      return;
    }

    const { data: versionRecord, error: versionError } = await supabase
      .from('dataset_versions')
      .insert({
        dataset_id: datasetId,
        version_data: dataset.currentData,
        change_summary: summary,
      })
      .select()
      .single();

    if (versionError) {
      console.error('Failed to save version:', versionError);
      toast.error('Failed to save version');
      return;
    }

    const newVersion: DatasetVersion = {
      id: versionRecord.id,
      dataset_id: datasetId,
      version_data: JSON.parse(JSON.stringify(dataset.currentData)),
      change_summary: summary,
      created_at: versionRecord.created_at,
    };

    setDataset(prev => ({
      ...prev,
      versions: [...prev.versions, newVersion]
    }));
  }, [dataset.currentData, datasetId]);

  const undoChange = useCallback(async () => {
    if (dataset.versions.length === 0) {
      toast.error('No versions to undo');
      return;
    }

    const lastVersion = dataset.versions[dataset.versions.length - 1];
    setDataset(prev => ({
      ...prev,
      currentData: lastVersion.version_data,
      versions: prev.versions.slice(0, -1)
    }));

    setMessages(prev => [...prev, {
      role: 'assistant',
      content: `Reverted changes: ${lastVersion.change_summary}`
    }]);
    toast.success('Undo successful');
  }, [dataset.versions]);

  const applyTransform = useCallback(async (transformedData: Record<string, unknown>[], summary: string) => {
    await saveVersion(summary);
    setDataset(prev => ({
      ...prev,
      currentData: transformedData
    }));
    toast.success(`Applied: ${summary}`);
  }, [saveVersion]);

  const loadDatasetRecord = useCallback(async (id: string) => {
    setIsProcessing(true);
    try {
      const { data: ds, error } = await supabase
        .from('datasets')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      const { data: storageData, error: storageError } = await supabase.storage
        .from('datasets')
        .download(ds.storage_path);

      if (storageError) throw storageError;

      const text = await storageData.text();
      const isJSON = ds.storage_path.endsWith('.json');
      const rawData = isJSON ? parseJSON(text) : parseCSV(text);

      setFileName(ds.file_name);
      setDatasetId(ds.id);
      setDataset({
        ...emptyState,
        rawData,
        currentData: rawData,
        columns: analyzeColumns(rawData)
      });
      setStep('explore');
      setMessages([{
        role: 'assistant',
        content: `I've loaded your dataset "${ds.file_name}". What would you like to explore?`
      }]);
    } catch (err: any) {
      toast.error('Failed to load dataset: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const updateColumn = useCallback((name: string, updates: Partial<ColumnAnalysis>) => {
    setDataset(prev => ({
      ...prev,
      columns: prev.columns.map(c => c.name === name ? { ...c, ...updates } : c),
    }));
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    setMessages(prev => [...prev, { role: 'user', content }]);
    setIsProcessing(true);

    try {
      setMessages(prev => [...prev, { role: 'assistant', content: '', isThinking: true }]);

      const history = messages.slice(-8).map((message) => ({
        role: message.role,
        content: message.content,
      }));
      const response = await aiApi.chat(content, datasetId || undefined, history);
      const assistantMsg = String(response?.content || '');

      setMessages(prev => {
        const last = prev[prev.length - 1];
        return [...prev.slice(0, -1), { ...last, content: assistantMsg, isThinking: false }];
      });

      const transformMatch = assistantMsg.match(/<transform>([\s\S]*?)<\/transform>/);
      if (transformMatch) {
        try {
          const transformConfig = JSON.parse(transformMatch[1]);
          const transformed = executeTransform(dataset.currentData, transformConfig);
          await applyTransform(transformed, transformConfig.description || `AI: ${transformConfig.action}`);
        } catch (e) {
          console.error('Failed to apply transform', e);
        }
      }

      const chartMatch = assistantMsg.match(/<chart>([\s\S]*?)<\/chart>/);
      if (chartMatch) {
        try {
          const chartConfig: ChartConfig = JSON.parse(chartMatch[1]);
          setDataset(prev => ({
            ...prev,
            charts: [...prev.charts, chartConfig]
          }));
        } catch (e) {
          console.error('Failed to parse chart JSON', e);
        }
      }
    } catch (error: any) {
      console.error('Chat error:', error);
      toast.error(error.message || 'AI failed to respond');
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (!last || last.role !== 'assistant') {
          return prev;
        }
        return [...prev.slice(0, -1), { ...last, content: 'AI failed to respond.', isThinking: false }];
      });
    } finally {
      setIsProcessing(false);
    }
  }, [applyTransform, dataset.currentData, datasetId, messages]);

  return (
    <PipelineContext.Provider value={{
      step, setStep, dataset, fileName, isProcessing, messages,
      handleUpload, runAnalysis, updateColumn, sendMessage, saveVersion, undoChange, applyTransform, loadDatasetRecord
    }}>
      {children}
    </PipelineContext.Provider>
  );
};
