import React, { useState, useEffect, useRef } from 'react';
import { usePipeline } from '@/context/PipelineContext';
import { ChartConfig } from '@/types/dataset';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, PieChart, Pie, Cell, ComposedChart, Area
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

export const AICleanPage: React.FC = () => {
  const { 
    dataset, messages, isProcessing, sendMessage, undoChange, applyTransform 
  } = usePipeline();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSend = () => {
    if (!input.trim() || isProcessing) return;
    sendMessage(input);
    setInput('');
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden bg-slate-50/50">
      {/* Left Chat Sidebar (350px) */}
      <div className="w-[350px] flex flex-col border-r bg-white/80 backdrop-blur-md shadow-xl z-10 transition-all duration-300">
        <div className="p-4 border-b bg-gradient-to-r from-violet-600 to-indigo-600 text-white flex justify-between items-center">
          <div>
            <h2 className="font-bold text-lg">AI Data Scientist</h2>
            <p className="text-xs opacity-80">Autonomous Exploration Active</p>
          </div>
          {dataset.versions.length > 0 && (
            <button 
              onClick={undoChange}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              title="Undo Last Transformation"
            >
              <span className="material-symbols-outlined text-sm">undo</span>
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <AnimatePresence>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`max-w-[90%] p-3 rounded-2xl text-sm shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-violet-600 text-white rounded-tr-none' 
                      : 'bg-white border rounded-tl-none'
                  }`}
                >
                  {msg.isThinking && <div className="flex items-center gap-2 mb-2 text-[10px] uppercase tracking-wider font-bold text-violet-500 animate-pulse">
                    <span className="material-symbols-outlined text-xs">monitoring</span> AI is Analyzing...
                  </div>}
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {msg.content.replace(/<chart>[\s\S]*?<\/chart>/g, '').trim()}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t bg-white">
          <div className="relative group">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask for an experiment..."
              className="w-full bg-slate-100 border-none rounded-2xl py-3 pl-4 pr-12 text-sm focus:ring-2 focus:ring-violet-400 transition-all group-hover:bg-slate-200/50"
            />
            <button 
              onClick={handleSend}
              disabled={isProcessing}
              className="absolute right-2 top-2 p-1.5 bg-violet-600 text-white rounded-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
            >
              <span className="material-symbols-outlined">send</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top: Insights/Charts (Flexible Height) */}
        <div className="h-1/2 p-6 overflow-y-auto border-b bg-slate-50/30">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-violet-600">bar_chart</span> Live Insights
            </h3>
            <div className="text-xs text-slate-500 bg-white px-3 py-1 rounded-full border shadow-sm">
              {dataset.charts.length} Visualizations Generated
            </div>
          </div>
          
          {dataset.charts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-40">
              <span className="material-symbols-outlined text-6xl mb-4">analytics</span>
              <p>No visualizations yet. Ask me to "Show distribution of X" or "Find correlations".</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {dataset.charts.map((chart, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-white p-6 rounded-3xl shadow-sm border group hover:shadow-xl transition-all h-[350px] flex flex-col"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-bold text-slate-700">{chart.title}</h4>
                      {chart.description && <p className="text-xs text-slate-500">{chart.description}</p>}
                    </div>
                    <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-100 rounded transition-all">
                      <span className="material-symbols-outlined text-sm">fullscreen</span>
                    </button>
                  </div>
                  <div className="flex-1 w-full min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <DynamicChart chart={chart} />
                    </ResponsiveContainer>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom: Data Grid */}
        <div className="flex-1 p-6 overflow-hidden bg-white">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-600">table_view</span> Data Explorer
              <span className="text-xs font-normal text-slate-400 ml-2">Showing 20 of {dataset.currentData.length} records</span>
            </h3>
            <div className="flex gap-2">
               <button className="text-xs py-1.5 px-3 rounded-xl border hover:bg-slate-50 transition-all flex items-center gap-1">
                 <span className="material-symbols-outlined text-xs">download</span> Export
               </button>
            </div>
          </div>

          <div className="border rounded-2xl overflow-auto h-[calc(100%-40px)] shadow-inner bg-slate-50/30">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="sticky top-0 bg-white border-b z-20 shadow-sm">
                <tr>
                  {dataset.currentData.length > 0 && Object.keys(dataset.currentData[0]).map(key => (
                    <th key={key} className="px-4 py-3 font-semibold text-slate-600 bg-slate-100/50 min-w-[150px]">
                      <div className="flex items-center justify-between">
                        {key}
                        <span className="material-symbols-outlined text-[10px] opacity-40">unfold_more</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataset.currentData.slice(0, 20).map((row, i) => (
                  <tr key={i} className="bg-white hover:bg-violet-50/30 border-b last:border-0 transition-colors">
                    {Object.values(row).map((val, j) => (
                      <td key={j} className="px-4 py-2 border-r last:border-r-0 text-slate-600">
                        <div className="truncate max-w-[200px]" title={String(val)}>
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

const DynamicChart: React.FC<{ chart: ChartConfig }> = ({ chart }) => {
  const { type, data, xKey, yKey, zKey } = chart;
  
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
