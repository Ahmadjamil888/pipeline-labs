import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { monitoringApi, jobsApi } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Activity, Loader2, CheckCircle2, AlertCircle, XCircle,
  Clock, Cpu, TrendingUp, ScrollText, RefreshCw, StopCircle,
  BarChart3, ArrowLeft
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface TrainingJob {
  id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  final_metrics: Record<string, number> | null;
  instance_type: string | null;
  instance_region: string | null;
  training_plans?: { plan: any; datasets?: { file_name: string } };
  cloud_providers?: { provider: string; label: string };
}

interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  message: string;
}

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  pending: { color: 'text-yellow-400', icon: <Clock className="w-4 h-4" />, label: 'Pending' },
  provisioning: { color: 'text-yellow-400', icon: <Loader2 className="w-4 h-4 animate-spin" />, label: 'Provisioning' },
  installing: { color: 'text-blue-400', icon: <Loader2 className="w-4 h-4 animate-spin" />, label: 'Installing Deps' },
  running: { color: 'text-green-400', icon: <Activity className="w-4 h-4 animate-pulse" />, label: 'Training' },
  completed: { color: 'text-green-400', icon: <CheckCircle2 className="w-4 h-4" />, label: 'Completed' },
  failed: { color: 'text-red-400', icon: <XCircle className="w-4 h-4" />, label: 'Failed' },
  cancelled: { color: 'text-neutral-400', icon: <XCircle className="w-4 h-4" />, label: 'Cancelled' },
};

export default function MonitorPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const jobId = searchParams.get('job');

  const [jobs, setJobs] = useState<TrainingJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<TrainingJob | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [metrics, setMetrics] = useState<Record<string, { epoch: number; value: number }[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadJobs = useCallback(async () => {
    try {
      const data = await jobsApi.list();
      setJobs(data || []);
      if (jobId && !selectedJob) {
        const job = data?.find((j: TrainingJob) => j.id === jobId);
        if (job) setSelectedJob(job);
      }
    } catch (err) {
      console.error('Failed to load jobs:', err);
    } finally {
      setIsLoading(false);
    }
  }, [jobId, selectedJob]);

  const loadJobDetails = useCallback(async (id: string) => {
    try {
      const [statusData, logsData, metricsData] = await Promise.all([
        monitoringApi.getStatus(id),
        monitoringApi.getLogs(id, 200),
        monitoringApi.getMetrics(id),
      ]);
      setLogs(logsData || []);
      setMetrics(metricsData || {});
      setSelectedJob(statusData);
    } catch (err) {
      console.error('Failed to load job details:', err);
    }
  }, []);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  useEffect(() => {
    if (selectedJob?.id) {
      loadJobDetails(selectedJob.id);
    }
  }, [selectedJob?.id, loadJobDetails]);

  // Auto-refresh for active jobs
  useEffect(() => {
    if (!autoRefresh || !selectedJob?.id) return;
    const isActive = ['pending', 'provisioning', 'installing', 'running'].includes(selectedJob.status);
    if (!isActive) return;

    const interval = setInterval(() => {
      loadJobDetails(selectedJob.id);
      loadJobs();
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh, selectedJob?.id, selectedJob?.status, loadJobDetails, loadJobs]);

  const handleCancel = async (id: string) => {
    try {
      await jobsApi.cancel(id);
      toast.success('Training job cancelled');
      await loadJobs();
      if (selectedJob?.id === id) await loadJobDetails(id);
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel');
    }
  };

  const formatDuration = (start: string | null, end: string | null) => {
    if (!start) return '—';
    const s = new Date(start).getTime();
    const e = end ? new Date(end).getTime() : Date.now();
    const diffMin = Math.floor((e - s) / 60000);
    if (diffMin < 60) return `${diffMin}m`;
    return `${Math.floor(diffMin / 60)}h ${diffMin % 60}m`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-neutral-500" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-light text-white tracking-tight">Training Monitor</h2>
          <p className="text-neutral-400 mt-1">Monitor your ML training jobs in real-time</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { loadJobs(); if (selectedJob?.id) loadJobDetails(selectedJob.id); }}
            className="p-2 text-neutral-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <label className="flex items-center gap-2 text-sm text-neutral-400">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-neutral-600 bg-neutral-800"
            />
            Auto-refresh
          </label>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Jobs List */}
        <div className="w-72 shrink-0 space-y-2">
          {jobs.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
              <p className="text-neutral-400 text-sm">No training jobs yet</p>
              <button
                onClick={() => navigate('/dashboard/train')}
                className="mt-3 text-sm text-[#d5c5a6] hover:underline"
              >
                Create a training plan →
              </button>
            </div>
          ) : (
            jobs.map((job) => {
              const config = statusConfig[job.status] || statusConfig.pending;
              return (
                <button
                  key={job.id}
                  onClick={() => setSelectedJob(job)}
                  className={`w-full p-4 rounded-xl border text-left transition-colors ${
                    selectedJob?.id === job.id
                      ? 'border-[#d5c5a6] bg-[#d5c5a6]/5'
                      : 'border-white/5 bg-[#1c1b1b] hover:border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-medium flex items-center gap-1 ${config.color}`}>
                      {config.icon}
                      {config.label}
                    </span>
                    <span className="text-xs text-neutral-600">
                      {formatDuration(job.started_at, job.completed_at)}
                    </span>
                  </div>
                  <p className="text-sm text-white truncate">
                    {job.training_plans?.datasets?.file_name || 'Training Job'}
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {job.training_plans?.plan?.model || '—'} • {job.cloud_providers?.provider?.toUpperCase() || 'Local'}
                  </p>
                </button>
              );
            })
          )}
        </div>

        {/* Job Detail */}
        <div className="flex-1 min-w-0 space-y-4">
          {!selectedJob ? (
            <div className="flex items-center justify-center h-64 text-neutral-500">
              Select a job to view details
            </div>
          ) : (
            <>
              {/* Job Header */}
              <div className="bg-[#1c1b1b] rounded-xl p-5 border border-white/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <a href="/dashboard/jobs" className="p-1 text-neutral-400 hover:text-white">
                      <ArrowLeft className="w-4 h-4" />
                    </a>
                    <div>
                      <h3 className="font-medium text-white">
                        {selectedJob.training_plans?.datasets?.file_name || 'Training Job'}
                      </h3>
                      <p className="text-xs text-neutral-500">
                        {selectedJob.training_plans?.plan?.model} • {selectedJob.instance_type || '—'} • {selectedJob.instance_region || '—'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
                      statusConfig[selectedJob.status]?.color || 'text-neutral-400'
                    } bg-white/5`}>
                      {statusConfig[selectedJob.status]?.icon}
                      {statusConfig[selectedJob.status]?.label || selectedJob.status}
                    </span>
                    {['pending', 'provisioning', 'installing', 'running'].includes(selectedJob.status) && (
                      <button
                        onClick={() => handleCancel(selectedJob.id)}
                        className="px-3 py-1.5 rounded-lg text-xs text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-colors flex items-center gap-1"
                      >
                        <StopCircle className="w-3 h-3" />
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                {/* Final Metrics */}
                {selectedJob.final_metrics && (
                  <div className="mt-4 pt-4 border-t border-white/5">
                    <p className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Final Metrics</p>
                    <div className="flex flex-wrap gap-3">
                      {Object.entries(selectedJob.final_metrics).map(([key, value]) => (
                        <div key={key} className="bg-neutral-900/50 rounded-lg px-4 py-2">
                          <p className="text-xs text-neutral-500">{key}</p>
                          <p className="text-lg font-light text-white">{typeof value === 'number' ? value.toFixed(4) : value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedJob.error_message && (
                  <div className="mt-4 p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                    <p className="text-sm text-red-400 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      {selectedJob.error_message}
                    </p>
                  </div>
                )}
              </div>

              {/* Metrics Chart */}
              {Object.keys(metrics).length > 0 && (
                <div className="bg-[#1c1b1b] rounded-xl p-5 border border-white/5">
                  <h4 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-[#d5c5a6]" />
                    Training Metrics
                  </h4>
                  <div className="space-y-4">
                    {Object.entries(metrics).map(([name, data]) => (
                      <div key={name}>
                        <p className="text-xs text-neutral-500 mb-2 capitalize">{name.replace(/_/g, ' ')}</p>
                        <ResponsiveContainer width="100%" height={120}>
                          <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis dataKey="epoch" stroke="#666" tick={{ fontSize: 10 }} />
                            <YAxis stroke="#666" tick={{ fontSize: 10 }} />
                            <Tooltip
                              contentStyle={{ backgroundColor: '#1c1b1b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                              labelStyle={{ color: '#999' }}
                              itemStyle={{ color: '#d5c5a6' }}
                            />
                            <Line
                              type="monotone"
                              dataKey="value"
                              stroke="#d5c5a6"
                              strokeWidth={2}
                              dot={false}
                              activeDot={{ r: 4 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Logs */}
              <div className="bg-[#1c1b1b] rounded-xl border border-white/5 overflow-hidden">
                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                  <h4 className="text-sm font-medium text-white flex items-center gap-2">
                    <ScrollText className="w-4 h-4 text-[#d5c5a6]" />
                    Logs
                  </h4>
                  <span className="text-xs text-neutral-600">{logs.length} entries</span>
                </div>
                <div className="h-64 overflow-y-auto p-4 font-mono text-xs space-y-1 bg-[#0a0a0a]">
                  {logs.length === 0 ? (
                    <p className="text-neutral-600">No logs yet...</p>
                  ) : (
                    logs.map((log) => (
                      <div key={log.id} className={`flex gap-2 ${
                        log.level === 'error' ? 'text-red-400' :
                        log.level === 'warn' ? 'text-yellow-400' :
                        'text-neutral-300'
                      }`}>
                        <span className="text-neutral-600 shrink-0">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span>{log.message}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
