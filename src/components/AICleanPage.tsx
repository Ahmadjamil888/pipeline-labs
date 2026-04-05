import React, { useState, useEffect, useRef } from 'react';
import { usePipeline } from '@/context/PipelineContext';
import { ChartConfig } from '@/types/dataset';
import { exportCSV } from '@/lib/dataProcessing';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, PieChart, Pie, Cell, ComposedChart, Area
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

export const AICleanPage: React.FC = () => {
  const { 
    dataset, messages, isProcessing, sendMessage, undoChange, fileName 
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
    const csv = exportCSV(dataset.currentData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${fileName?.split('.')[0] || 'dataset'}_clean.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-[#131313] text-[#e5e2e1]" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Premium Header Layout Matching Positioning */}
      <header className="h-20 border-b border-white/5 px-8 flex items-center justify-between shrink-0 bg-black/20 backdrop-blur-3xl z-30">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
              <span className="material-symbols-outlined text-black text-xl">auto_fix</span>
            </div>
            <span className="font-bold tracking-tighter text-xl">AI Data Scientist</span>
          </div>
          <nav className="hidden xl:flex items-center gap-6 text-sm text-neutral-400 font-medium">
            <span className="text-white">Active Dataset: {fileName || 'Untitled'}</span>
            <span className="opacity-40">|</span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">table_rows</span> {dataset.currentData.length} Rows
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">history</span> {dataset.versions.length} Version History
            </span>
          </nav>
        </div>
        
        <div className="flex items-center gap-4">
          {dataset.versions.length > 0 && (
            <button 
              onClick={undoChange}
              className="p-2 hover:bg-white/10 rounded-full transition-all text-neutral-400 hover:text-white"
              title="Undo Last Step"
            >
              <span className="material-symbols-outlined text-xl">undo</span>
            </button>
          )}
          <div className="h-8 w-[1px] bg-white/10 mx-2" />
          <button 
            onClick={handleExport}
            className="bg-white text-black px-6 py-2 rounded-full text-xs font-bold hover:scale-105 active:scale-95 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
          >
            <span className="material-symbols-outlined text-xs">download</span>
            Export Dataset
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Side: Agent Interaction (Dark Mode) */}
        <div className="w-[400px] flex flex-col border-r border-white/5 bg-black/10 transition-all duration-500">
          <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-white/5">
            <AnimatePresence>
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-30 mt-20">
                  <span className="material-symbols-outlined text-5xl mb-4">robot_2</span>
                  <p className="text-sm font-light">Describe your cleaning or analysis goal.<br />I'll handle the transformations.</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-[100%] p-4 rounded-2xl text-sm leading-relaxed border ${
                      msg.role === 'user' 
                        ? 'bg-neutral-800 border-white/10 text-white rounded-tr-none' 
                        : 'bg-black/30 border-white/5 rounded-tl-none'
                    }`}
                  >
                    {msg.isThinking && (
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
                        <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '400ms' }} />
                        <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-widest ml-2">Analyzing</span>
                      </div>
                    )}
                    <div className="whitespace-pre-wrap">
                      {msg.content.replace(/<(chart|transform)>[\s\S]*?<\/(chart|transform)>/g, '').trim()}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          <div className="p-6 bg-black/20 border-t border-white/5">
            <div className="relative">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask me to clean the data..."
                className="w-full bg-white/5 border border-white/10 text-white rounded-2xl py-4 pl-5 pr-14 text-sm focus:ring-1 focus:ring-white/40 outline-none transition-all placeholder:text-neutral-600"
              />
              <button 
                onClick={handleSend}
                disabled={isProcessing}
                className="absolute right-2 top-2 bottom-2 w-10 bg-white text-black rounded-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center disabled:opacity-30 disabled:scale-100"
              >
                <span className="material-symbols-outlined text-lg">arrow_upward</span>
              </button>
            </div>
            <p className="text-[10px] text-neutral-500 mt-3 text-center uppercase tracking-widest font-medium opacity-50">Experimental AI Data Analyst v2.0</p>
          </div>
        </div>

        {/* Right Side: Visual Data Center */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top: Insights Area */}
          <div className="h-2/5 p-8 overflow-y-auto border-b border-white/5 bg-white/[0.01]">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-2 h-2 rounded-full bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.5)]" />
              <h3 className="text-sm uppercase tracking-widest font-bold text-neutral-500">Live Workspace Analysis</h3>
            </div>
            
            {dataset.charts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-10">
                <span className="material-symbols-outlined text-[120px]">bubble_chart</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {dataset.charts.map((chart, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-neutral-900 border border-white/5 p-6 rounded-[2rem] h-[340px] flex flex-col shadow-2xl"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="space-y-1">
                        <h4 className="text-white font-medium text-lg tracking-tight">{chart.title}</h4>
                        {chart.description && <p className="text-xs text-neutral-500 font-light">{chart.description}</p>}
                      </div>
                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                        <span className="material-symbols-outlined text-neutral-400 text-sm">filter_list</span>
                      </div>
                    </div>
                    <div className="flex-1 w-full min-h-0 opacity-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <DynamicChart chart={chart} />
                      </ResponsiveContainer>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom: Pro Data Grid */}
          <div className="flex-1 p-8 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                <h3 className="text-sm uppercase tracking-widest font-bold text-neutral-500">Structured Data Explorer</h3>
                <span className="text-[10px] text-neutral-600 bg-white/5 px-2 py-0.5 rounded-full ml-4">
                  Viewing sample of {dataset.currentData.length} records
                </span>
              </div>
            </div>

            <div className="flex-1 border border-white/10 rounded-[2rem] overflow-hidden bg-black/20 shadow-inner group transition-all duration-500 hover:border-white/20">
              <div className="h-full overflow-auto scrollbar-thin scrollbar-white/10">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="sticky top-0 bg-[#131313] z-20">
                    <tr className="border-b border-white/10">
                      {dataset.currentData.length > 0 && Object.keys(dataset.currentData[0]).map(key => (
                        <th key={key} className="px-6 py-5 font-bold text-neutral-400 uppercase tracking-wider min-w-[160px]">
                          <div className="flex items-center gap-2">
                            {key}
                            <span className="material-symbols-outlined text-[12px] opacity-20">unfold_more</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {dataset.currentData.slice(0, 30).map((row, i) => (
                      <tr key={i} className="hover:bg-white/[0.03] transition-all group/row">
                        {Object.values(row).map((val, j) => (
                          <td key={j} className="px-6 py-4 border-r border-white/5 last:border-r-0 text-neutral-300 font-light">
                            <div className="truncate max-w-[220px]" title={String(val)}>
                              {val === null || val === undefined || val === '' ? (
                                <span className="text-red-500/50 italic font-medium">null</span>
                              ) : (
                                String(val)
                              )}
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
      </div>
    </div>
  );
};

const DynamicChart: React.FC<{ chart: ChartConfig }> = ({ chart }) => {
  const { type, data, xKey, yKey } = chart;
  
  if (type === 'bar') {
    return (
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
        <XAxis dataKey={xKey} axisLine={false} tickLine={false} style={{ fontSize: '10px' }} />
        <YAxis axisLine={false} tickLine={false} style={{ fontSize: '10px' }} />
        <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
        <Bar dataKey={yKey} fill="#8b5cf6" radius={[4, 4, 0, 0]} />
      </BarChart>
    );
  }
  
  if (type === 'line') {
    return (
      <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
        <XAxis dataKey={xKey} axisLine={false} tickLine={false} style={{ fontSize: '10px' }} />
        <YAxis axisLine={false} tickLine={false} style={{ fontSize: '10px' }} />
        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
        <Line type="monotone" dataKey={yKey} stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, fill: '#8b5cf6' }} activeDot={{ r: 6 }} />
      </LineChart>
    );
  }

  if (type === 'scatter') {
    return (
      <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
        <XAxis dataKey={xKey} axisLine={false} tickLine={false} style={{ fontSize: '10px' }} type="number" name={xKey} />
        <YAxis dataKey={yKey} axisLine={false} tickLine={false} style={{ fontSize: '10px' }} type="number" name={yKey} />
        <Tooltip cursor={{ strokeDasharray: '3 3' }} />
        <Scatter data={data} fill="#8b5cf6" />
      </ScatterChart>
    );
  }

  if (type === 'pie') {
    return (
      <PieChart>
        <Pie
          data={data}
          innerRadius={60}
          outerRadius={80}
          paddingAngle={5}
          dataKey={yKey || 'value'}
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend verticalAlign="bottom" height={36} />
      </PieChart>
    );
  }

  return <div>Unsupported Chart Type</div>;
};

