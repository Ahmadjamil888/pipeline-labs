import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePipeline } from '@/context/PipelineContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, Download, Sparkles, BarChart3, Undo2, 
  Upload, Loader2, AlertCircle, CheckCircle2, 
  Database, Table2, ArrowLeft, MessageSquare,
  ChevronRight, FileSpreadsheet, Wand2, LogIn
} from 'lucide-react';

interface SuggestionChip {
  label: string;
  action: string;
}

interface DatasetInfo {
  id: string;
  name: string;
  rowCount: number;
  columnCount: number;
  size: string;
  status: 'processing' | 'ready' | 'uploaded';
  createdAt: string;
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toLocaleString();
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export const AICleanPage: React.FC = () => {
  const { 
    dataset, messages, isProcessing, sendMessage, undoChange, 
    fileName 
  } = usePipeline();
  
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [datasetInfo, setDatasetInfo] = useState<DatasetInfo | null>(null);
  const [isLoadingDataset, setIsLoadingDataset] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Load dataset metadata from URL if available
  useEffect(() => {
    const loadDatasetMeta = async () => {
      // First check if user is authenticated
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
      
      // DEBUG: Log auth details for RLS troubleshooting
      console.log('[DEBUG] Auth User ID:', currentUser?.id);
      console.log('[DEBUG] Auth Error:', authError);
      console.log('[DEBUG] User Metadata:', currentUser?.user_metadata);
      
      if (authError || !currentUser) {
        console.error('Auth error:', authError);
        setAuthError('Please sign in to access this dataset');
        setIsLoadingDataset(false);
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const datasetId = params.get('dataset');
      
      // DEBUG: Log dataset ID being queried
      console.log('[DEBUG] Dataset ID from URL:', datasetId);
      
      if (!datasetId) {
        setIsLoadingDataset(false);
        return;
      }
      
      setIsLoadingDataset(true);
      setAuthError(null);
      
      try {
        const { data, error } = await supabase
          .from('datasets')
          .select('*')
          .eq('id', datasetId)
          .single();
        
        // DEBUG: Log the response
        console.log('[DEBUG] Dataset response:', data);
        console.log('[DEBUG] Dataset user_id:', data?.user_id);
        console.log('[DEBUG] Match check:', { 
          authUid: currentUser.id, 
          datasetUserId: data?.user_id,
          match: currentUser.id === data?.user_id 
        });
        
        if (error) {
          // Handle 403 specifically
          if (error.code === '403' || error.message?.includes('permission')) {
            setAuthError('Access denied. Please sign in again or check your permissions.');
            throw error;
          }
          throw error;
        }
        
        if (data) {
          setDatasetInfo({
            id: data.id,
            name: data.file_name,
            rowCount: data.row_count || 0,
            columnCount: data.column_count || 0,
            size: formatFileSize(0),
            status: (data.status as 'processing' | 'ready' | 'uploaded') || 'uploaded',
            createdAt: data.created_at
          });
          setRetryCount(0); // Reset retry count on success
        }
      } catch (err: any) {
        console.error('Failed to load dataset info:', err);
        
        // Retry logic for auth errors (up to 2 retries)
        if (retryCount < 2 && (err.code === '403' || err.message?.includes('JWT'))) {
          console.log(`Retrying dataset load (attempt ${retryCount + 1})...`);
          setRetryCount(prev => prev + 1);
          
          // Try to refresh session
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            console.error('Session refresh failed:', refreshError);
            setAuthError('Session expired. Please sign in again.');
          } else {
            // Retry after short delay
            setTimeout(() => loadDatasetMeta(), 500);
            return;
          }
        }
      } finally {
        setIsLoadingDataset(false);
      }
    };
    
    loadDatasetMeta();
  }, [retryCount]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isProcessing) return;
    sendMessage(input);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, isProcessing, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleExport = useCallback(async () => {
    if (!dataset.currentData.length) {
      toast.error('No data to export');
      return;
    }
    
    try {
      const { exportCSV } = await import('@/lib/dataProcessing');
      const csv = exportCSV(dataset.currentData);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${fileName?.split('.')[0] || 'dataset'}_cleaned.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Dataset exported successfully');
    } catch (error) {
      toast.error('Failed to export dataset');
    }
  }, [dataset.currentData, fileName]);

  const sendSuggestion = (action: string) => {
    sendMessage(action);
  };

  const getDefaultSuggestions = (): SuggestionChip[] => [
    { label: 'Show missing values', action: 'Show me the breakdown of missing values in this dataset' },
    { label: 'Fill missing data', action: 'Fill all missing values using appropriate methods for each column type' },
    { label: 'Remove duplicates', action: 'Remove duplicate rows from the dataset' },
    { label: 'Analyze data quality', action: 'Analyze the overall data quality and identify issues' },
  ];

  const getStatusBadge = () => {
    const status = datasetInfo?.status || 'uploaded';
    const isProcessingStatus = status === 'processing';
    
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
        isProcessingStatus 
          ? 'bg-yellow-500/10 text-yellow-400' 
          : 'bg-green-500/10 text-green-400'
      }`}>
        {isProcessingStatus ? (
          <>
            <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            Processing
          </>
        ) : (
          <>
            <CheckCircle2 className="w-3 h-3" />
            Ready
          </>
        )}
      </div>
    );
  };

  const renderCellValue = (value: unknown): React.ReactNode => {
    if (value === null || value === undefined || value === '') {
      return <span className="text-neutral-500 italic">null</span>;
    }
    return String(value);
  };

  // Auth error state
  if (authError) {
    return (
      <div className="flex flex-col h-full bg-[#0a0a0a] text-white">
        {/* Top Bar */}
        <div className="h-16 border-b border-white/5 bg-[#0f0f0f]/80 backdrop-blur-xl flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <img 
              src="/favicon.ico" 
              alt="Pipeline Labs" 
              className="h-6 w-auto opacity-90"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/logo-light.png';
              }}
            />
            <span className="text-sm text-neutral-500">/</span>
            <span className="text-sm text-neutral-400">AI Data Scientist</span>
          </div>
        </div>

        {/* Auth Error State */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md px-6">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-6">
              <LogIn className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Sign In Required</h2>
            <p className="text-sm text-neutral-400 mb-6">
              {authError}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a 
                href="/auth" 
                className="inline-flex items-center justify-center gap-2 bg-white text-black px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-neutral-200 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </a>
              <button
                onClick={() => {
                  setAuthError(null);
                  setRetryCount(0);
                  window.location.reload();
                }}
                className="inline-flex items-center justify-center gap-2 bg-white/5 text-white border border-white/10 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors"
              >
                <Loader2 className="w-4 h-4" />
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Empty state when no dataset
  if (!dataset.currentData.length && !isLoadingDataset) {
    return (
      <div className="flex flex-col h-full bg-[#0a0a0a] text-white">
        {/* Top Bar */}
        <div className="h-16 border-b border-white/5 bg-[#0f0f0f]/80 backdrop-blur-xl flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <img 
              src="/favicon.ico" 
              alt="Pipeline Labs" 
              className="h-6 w-auto opacity-90"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/logo-light.png';
              }}
            />
            <span className="text-sm text-neutral-500">/</span>
            <span className="text-sm text-neutral-400">AI Data Scientist</span>
          </div>
        </div>

        {/* Empty State */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md px-6">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-6">
              <Database className="w-8 h-8 text-neutral-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">No Dataset Selected</h2>
            <p className="text-sm text-neutral-400 mb-6">
              Select a dataset from your library or upload a new one to start cleaning with AI.
            </p>
            <a 
              href="/dashboard/datasets" 
              className="inline-flex items-center gap-2 bg-white text-black px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-neutral-200 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Go to Datasets
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] text-white overflow-hidden">
      {/* Top Bar */}
      <header className="h-16 border-b border-white/5 bg-[#0f0f0f]/80 backdrop-blur-xl flex items-center justify-between px-6 shrink-0 z-20">
        <div className="flex items-center gap-4">
          <a 
            href="/dashboard/datasets" 
            className="p-2 hover:bg-white/5 rounded-lg transition-colors text-neutral-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </a>
          <div className="flex items-center gap-3">
            <img 
              src="/favicon.ico" 
              alt="Pipeline Labs" 
              className="h-5 w-auto"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/logo-light.png';
              }}
            />
            <span className="text-neutral-600">/</span>
            <span className="text-sm font-medium truncate max-w-[200px] sm:max-w-[300px]">
              {datasetInfo?.name || fileName || 'Untitled Dataset'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {dataset.versions.length > 0 && (
            <button
              onClick={undoChange}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors text-neutral-400 hover:text-white"
              title="Undo last change"
            >
              <Undo2 className="w-4 h-4" />
            </button>
          )}
          
          <button 
            className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm text-neutral-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            <Wand2 className="w-4 h-4" />
            <span>AI Analysis</span>
          </button>
          
          <button 
            className="hidden sm:flex items-center gap-2 px-3 py-2 text-sm text-neutral-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            <BarChart3 className="w-4 h-4" />
            <span>Plots</span>
          </button>
          
          <button
            onClick={handleExport}
            disabled={!dataset.currentData.length}
            className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-lg text-sm font-medium hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat Panel */}
        <div className="w-full sm:w-[380px] flex flex-col border-r border-white/5 bg-[#0f0f0f]/50 backdrop-blur-xl">
          {/* Chat Header */}
          <div className="p-5 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                <Sparkles className="w-5 h-5 text-[#d5c5a6]" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Pipeline AI</h3>
                <p className="text-xs text-neutral-500">Ask about your data or request transformations</p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div 
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-white/10"
          >
            <AnimatePresence mode="popLayout">
              {messages.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-8"
                >
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                    <MessageSquare className="w-6 h-6 text-neutral-500" />
                  </div>
                  <p className="text-sm text-neutral-500">
                    Start a conversation with AI to clean and analyze your data
                  </p>
                </motion.div>
              )}

              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-medium ${
                    msg.role === 'user' 
                      ? 'bg-white/10 text-white' 
                      : 'bg-[#d5c5a6]/10 text-[#d5c5a6]'
                  }`}>
                    {msg.role === 'user' ? (
                      user?.email?.[0].toUpperCase() || 'U'
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                  </div>
                  <div className={`flex-1 max-w-[85%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                    <div className={`inline-block text-sm leading-relaxed px-4 py-3 rounded-2xl ${
                      msg.role === 'user'
                        ? 'bg-white/10 text-white rounded-tr-sm'
                        : 'bg-white/5 text-neutral-200 rounded-tl-sm border border-white/5'
                    }`}>
                      {msg.isThinking && (
                        <div className="flex items-center gap-2 mb-2">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span className="text-xs text-neutral-400">Analyzing...</span>
                        </div>
                      )}
                      <div className="whitespace-pre-wrap">
                        {msg.content.replace(/<(chart|transform)>[\s\S]*?<\/(chart|transform)>/g, '').trim()}
                      </div>
                    </div>
                    
                    {/* Suggestion Chips for AI messages */}
                    {msg.role === 'assistant' && i === messages.length - 1 && !msg.isThinking && (
                      <div className="flex flex-wrap gap-2 mt-3 justify-start">
                        {getDefaultSuggestions().map((chip) => (
                          <button
                            key={chip.label}
                            onClick={() => sendSuggestion(chip.action)}
                            className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-full transition-all text-neutral-300 hover:text-white"
                          >
                            {chip.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <div className="p-4 border-t border-white/5">
            <div className="relative bg-white/5 border border-white/10 rounded-xl focus-within:border-white/20 focus-within:bg-white/[0.07] transition-all">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your data or request transformations..."
                rows={1}
                className="w-full bg-transparent border-none rounded-xl px-4 py-3 pr-12 text-sm text-white placeholder:text-neutral-500 resize-none outline-none min-h-[44px] max-h-[120px]"
                disabled={isProcessing}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isProcessing}
                className="absolute right-2 bottom-2 p-2 bg-white text-black rounded-lg hover:bg-neutral-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-[10px] text-neutral-600 mt-2 text-center">
              AI may produce inaccurate results. Verify important information.
            </p>
          </div>
        </div>

        {/* Dataset Preview */}
        <div className="hidden sm:flex flex-1 flex-col bg-[#0a0a0a]">
          {/* Dataset Info Bar */}
          <div className="h-14 border-b border-white/5 flex items-center justify-between px-6 shrink-0">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-sm">
                <Table2 className="w-4 h-4 text-neutral-500" />
                <span className="text-neutral-400">Rows:</span>
                <span className="font-medium">{formatNumber(datasetInfo?.rowCount || dataset.currentData.length)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <FileSpreadsheet className="w-4 h-4 text-neutral-500" />
                <span className="text-neutral-400">Columns:</span>
                <span className="font-medium">{datasetInfo?.columnCount || (dataset.currentData[0] ? Object.keys(dataset.currentData[0]).length : 0)}</span>
              </div>
              {datasetInfo?.size && (
                <div className="flex items-center gap-2 text-sm">
                  <Database className="w-4 h-4 text-neutral-500" />
                  <span className="text-neutral-400">Size:</span>
                  <span className="font-medium">{datasetInfo.size}</span>
                </div>
              )}
            </div>
            {getStatusBadge()}
          </div>

          {/* Data Table */}
          <div className="flex-1 overflow-auto p-6">
            {dataset.currentData.length > 0 ? (
              <div className="border border-white/5 rounded-xl overflow-hidden bg-white/[0.02]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[#0f0f0f] z-10">
                    <tr className="border-b border-white/10">
                      {Object.keys(dataset.currentData[0]).map((key) => (
                        <th 
                          key={key} 
                          className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider whitespace-nowrap"
                        >
                          <div className="flex items-center gap-1">
                            {key}
                            <ChevronRight className="w-3 h-3 text-neutral-600 rotate-90" />
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {dataset.currentData.slice(0, 100).map((row, idx) => (
                      <tr 
                        key={idx} 
                        className="hover:bg-white/[0.03] transition-colors"
                      >
                        {Object.values(row).map((val, j) => (
                          <td 
                            key={j} 
                            className="px-4 py-3 text-neutral-300 whitespace-nowrap"
                          >
                            <div className="truncate max-w-[200px]" title={String(val ?? '')}>
                              {renderCellValue(val)}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {dataset.currentData.length > 100 && (
                  <div className="px-4 py-3 text-center text-xs text-neutral-500 border-t border-white/5">
                    Showing first 100 rows of {formatNumber(dataset.currentData.length)} total
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <AlertCircle className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
                  <p className="text-neutral-500">No data available</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AICleanPage;

