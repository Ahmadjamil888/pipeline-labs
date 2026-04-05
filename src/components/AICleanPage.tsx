import React, { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import { usePipeline } from '@/context/PipelineContext';
import { ChartConfig } from '@/types/dataset';
import { motion, AnimatePresence } from 'framer-motion';
import Plotly from 'plotly.js-dist-min';

export const AICleanPage: React.FC = () => {
  const { 
    dataset, fileName, messages, isProcessing, sendMessage, undoChange, applyTransform 
  } = usePipeline();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSend = () => {
    if (!input.trim() || isProcessing) return;
    sendMessage(input);
    setInput('');
  };

  const handleExport = () => {
    if (!dataset.currentData.length) return;
    const csv = Papa.unparse(dataset.currentData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `cleaned_${fileName || 'dataset'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden bg-slate-50/50">
      {/* Left Chat Sidebar (350px) */}
      <div className="w-[350px] flex flex-col border-r bg-white/80 backdrop-blur-md shadow-2xl z-20 transition-all duration-300">
        <div className="p-5 border-b flex justify-between items-center premium-blur relative z-10 border-white/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-violet-200">
              <span className="material-symbols-outlined text-xl">auto_awesome</span>
            </div>
            <div>
              <h2 className="font-black text-slate-800 tracking-tight leading-tight">AI Scientist</h2>
              <div className="flex items-center gap-1.5 leading-none">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest opacity-60">Autonomous Active</p>
              </div>
            </div>
          </div>
          {dataset.versions.length > 0 && (
            <button 
              onClick={undoChange}
              className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-violet-600 hover:scale-110 active:scale-95"
              title="Undo Last Transformation"
            >
              <span className="material-symbols-outlined text-sm">undo</span>
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 vibrant-gradient">
          <AnimatePresence>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`max-w-[90%] p-4 rounded-3xl text-sm shadow-sm transition-all hover:shadow-md ${
                    msg.role === 'user' 
                      ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-tr-none' 
                      : 'glass-card rounded-tl-none border-white/40'
                  }`}
                >
                  {msg.isThinking && <div className="flex items-center gap-2 mb-2 text-[10px] uppercase tracking-wider font-bold text-violet-500 animate-pulse">
                    <span className="material-symbols-outlined text-xs">monitoring</span> AI is Analyzing...
                  </div>}
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {msg.role === 'assistant' ? (
                      <div className="space-y-4">
                        {msg.content.includes('THOUGHTS:') && (
                          <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-200/30 backdrop-blur-sm">
                            <div className="text-[10px] uppercase text-violet-500 font-black mb-1 opacity-60 tracking-widest">Analyst Reasoning</div>
                            <div className="italic text-slate-500 text-xs leading-relaxed">
                              {msg.content.match(/THOUGHTS:([\s\S]*?)(?=\n\n|$)/)?.[1] || "Deciphering data structures..."}
                            </div>
                          </div>
                        )}
                        <div className="text-slate-800 font-medium">
                          {msg.content
                            .replace(/THOUGHTS:([\s\S]*?)(?=\n\n|$)/, '')
                            .replace(/<chart>[\s\S]*?<\/chart>/g, '')
                            .replace(/<transform>[\s\S]*?<\/transform>/g, '')
                            .trim()}
                        </div>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t bg-white/50 backdrop-blur-md">
          <div className="relative group">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask for an experiment..."
              className="w-full bg-slate-100/50 border border-slate-200/50 rounded-2xl py-3 pl-4 pr-12 text-sm focus:ring-2 focus:ring-violet-400 transition-all group-hover:bg-slate-200/80"
            />
            <button 
              onClick={handleSend}
              disabled={isProcessing}
              className="absolute right-2 top-2 p-1.5 bg-violet-600 text-white rounded-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-violet-200"
            >
              <span className="material-symbols-outlined">send</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top: Insights/Charts */}
        <div className="h-1/2 p-8 overflow-y-auto border-b bg-slate-50/10">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                <span className="material-symbols-outlined text-3xl text-violet-600 p-2 bg-violet-50 rounded-2xl">insights</span> 
                Live Insights
              </h3>
              <p className="text-xs text-slate-500 mt-1 ml-14">Interactive visualizations derived from your recent experiments.</p>
            </div>
            <div className="text-[10px] text-slate-400 bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm uppercase font-black tracking-widest">
              {dataset.charts.length} Insights Found
            </div>
          </div>
          
          {dataset.charts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-30 mt-[-40px]">
              <div className="w-24 h-24 rounded-[40px] bg-slate-100 flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-5xl">analytics</span>
              </div>
              <p className="text-lg font-medium text-slate-500">No visualizations yet.</p>
              <p className="text-sm text-slate-400 mt-1 text-center max-w-xs">Ask me to "Show distribution of X" or "Find correlations" to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              {dataset.charts.map((chart, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  whileHover={{ y: -5 }}
                  className="bg-white p-6 rounded-[40px] shadow-xl shadow-slate-200/50 border border-slate-100 group transition-all h-[400px] flex flex-col relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-2 bg-slate-50 rounded-xl hover:bg-slate-100 text-slate-400">
                      <span className="material-symbols-outlined text-sm">open_in_full</span>
                    </button>
                  </div>
                  <div className="mb-4">
                    <h4 className="font-black text-slate-800 text-lg tracking-tight">{chart.title}</h4>
                    {chart.description && <p className="text-xs text-slate-400 font-medium">{chart.description}</p>}
                  </div>
                  <div className="flex-1 w-full min-h-0 bg-slate-50/30 rounded-3xl">
                    <DynamicChart chart={chart} />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom: Data Grid */}
        <div className="flex-1 p-8 overflow-hidden bg-white relative">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                <span className="material-symbols-outlined text-3xl text-indigo-600 p-2 bg-indigo-50 rounded-2xl">table_rows</span> 
                Data Explorer
              </h3>
              <p className="text-xs text-slate-500 mt-1 ml-14">Showing first 20 of {dataset.currentData.length} records</p>
            </div>
            <button 
              onClick={handleExport}
              className="group px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold text-sm flex items-center gap-2 hover:bg-violet-600 transition-all shadow-xl shadow-slate-200 hover:shadow-violet-200 active:scale-95"
            >
              <span className="material-symbols-outlined text-sm group-hover:animate-bounce">download</span> 
              Download CSV
            </button>
          </div>

          <div className="border border-slate-100 rounded-[32px] overflow-auto h-[calc(100%-80px)] shadow-2xl shadow-slate-200/40 bg-white">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="sticky top-0 bg-white border-b z-20">
                <tr>
                  {dataset.currentData.length > 0 && Object.keys(dataset.currentData[0]).map(key => (
                    <th key={key} className="px-6 py-5 font-black text-slate-400 uppercase tracking-widest text-[10px] bg-slate-50/50 min-w-[200px]">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {dataset.currentData.slice(0, 20).map((row, i) => (
                  <tr key={i} className="hover:bg-violet-50/20 transition-colors">
                    {Object.values(row).map((val, j) => (
                      <td key={j} className="px-6 py-4 text-slate-600 font-medium">
                        <div className="truncate max-w-[250px]" title={String(val)}>
                          {String(val ?? 'null')}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const DynamicChart: React.FC<{ chart: any }> = ({ chart }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chartRef.current && chart.data) {
      const layout = {
        ...chart.layout,
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Inter, sans-serif', size: 11 },
        margin: { t: 40, r: 20, b: 60, l: 60 },
        autosize: true,
        showlegend: chart.data.length > 1,
        hovermode: 'closest' as const,
        colorway: ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899']
      };

      const config = {
        responsive: true,
        displayModeBar: false,
      };

      Plotly.newPlot(chartRef.current, chart.data, layout, config);
    }
  }, [chart]);

  return <div ref={chartRef} className="w-full h-full" />;
};
