import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { plannerApi, cloudApi, jobsApi } from '@/lib/api';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Loader2, CheckCircle2, AlertCircle, Play,
  Settings2, Zap, TrendingUp, Database, Cpu, Clock,
  DollarSign, ChevronRight, Sparkles, Edit3, Save, X
} from 'lucide-react';

interface DatasetAnalysis {
  data_type: string;
  row_count: number;
  column_count: number;
  columns: { name: string; type: string; unique_count: number; null_percent: number }[];
  label_column: string | null;
  task_type: string;
  suggested_models: { name: string; framework: string; gpu_required: string; estimated_time_minutes: number; estimated_cost_usd: number; confidence: number }[];
  preprocessing_steps: string[];
  data_quality_score: number;
}

interface TrainingPlan {
  task: string;
  model: string;
  framework: string;
  train_test_split: string;
  batch_size: number;
  optimizer: string;
  learning_rate: number;
  epochs: number;
  gpu_required: string;
  preprocessing: string[];
  metrics: string[];
  estimated_time_minutes: number;
  estimated_cost_usd: number;
  hyperparameter_search?: { method: string; params: Record<string, number[]> };
  reasoning?: string;
}

interface CloudProvider {
  id: string;
  provider: string;
  label: string;
  is_active: boolean;
}

export default function TrainingPlanPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const datasetId = searchParams.get('dataset');

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<DatasetAnalysis | null>(null);
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [cloudProviders, setCloudProviders] = useState<CloudProvider[]>([]);
  const [selectedCloudId, setSelectedCloudId] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedPlan, setEditedPlan] = useState<TrainingPlan | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [objective, setObjective] = useState('');

  const loadCloudProviders = useCallback(async () => {
    try {
      const data = await cloudApi.listProviders();
      setCloudProviders(data?.filter((p: CloudProvider) => p.is_active) || []);
    } catch (err) {
      console.error('Failed to load cloud providers:', err);
    }
  }, []);

  useEffect(() => { loadCloudProviders(); }, [loadCloudProviders]);

  const handleAnalyze = async () => {
    if (!datasetId) {
      toast.error('No dataset selected');
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await plannerApi.analyze(datasetId, objective || undefined);
      setAnalysis(result.analysis);
      setPlan(result.plan);
      setEditedPlan(result.plan);
      setPlanId(result.planId);
      toast.success('Dataset analyzed! Review your training plan below.');
    } catch (err: any) {
      toast.error(err.message || 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSavePlan = async () => {
    if (!planId || !editedPlan) return;
    try {
      await plannerApi.updatePlan(planId, { plan: editedPlan });
      setPlan(editedPlan);
      setIsEditing(false);
      toast.success('Training plan updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save plan');
    }
  };

  const handleApproveAndTrain = async () => {
    if (!planId) {
      toast.error('No training plan selected');
      return;
    }
    if (!selectedCloudId) {
      toast.error('Select a cloud provider before starting training');
      return;
    }

    // Validate plan parameters before starting
    if (plan) {
      if (plan.epochs < 1 || plan.epochs > 100) {
        toast.error('Epochs must be between 1 and 100');
        return;
      }
      if (plan.batch_size < 1 || plan.batch_size > 256) {
        toast.error('Batch size must be between 1 and 256');
        return;
      }
      if (plan.learning_rate < 0 || plan.learning_rate > 1) {
        toast.error('Learning rate must be between 0 and 1');
        return;
      }
    }

    // Approve plan first
    try {
      await plannerApi.updatePlan(planId, { status: 'approved' });
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve plan');
      return;
    }

    setIsStarting(true);
    try {
      const result = await jobsApi.start(planId, selectedCloudId);
      toast.success('Training job started!');
      navigate(`/dashboard/jobs?job=${result.jobId}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to start training');
      // Revert status on failure
      try {
        await plannerApi.updatePlan(planId, { status: 'draft' });
      } catch (revertErr) {
        console.error('Failed to revert plan status:', revertErr);
      }
    } finally {
      setIsStarting(false);
    }
  };

  const getTaskBadge = (task: string) => {
    const colors: Record<string, string> = {
      classification: 'bg-blue-500/20 text-blue-400',
      regression: 'bg-green-500/20 text-green-400',
      text_classification: 'bg-purple-500/20 text-purple-400',
      ner: 'bg-orange-500/20 text-orange-400',
      llm_finetuning: 'bg-pink-500/20 text-pink-400',
      clustering: 'bg-yellow-500/20 text-yellow-400',
    };
    return colors[task] || 'bg-neutral-700 text-neutral-400';
  };

  const getQualityColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <div>
          <h2 className="text-3xl font-light text-white tracking-tight">AI Training Planner</h2>
          <p className="text-neutral-400 mt-1">Generate an SDK-ready training workflow that runs on customer-owned cloud and storage.</p>
        </div>
        <div className="bg-[#1c1b1b] rounded-2xl p-5 border border-white/5">
          <p className="text-xs text-neutral-500 uppercase tracking-wider mb-3">MVP Workflow</p>
          <div className="space-y-3 text-sm text-neutral-300">
            <div className="rounded-2xl border border-white/5 bg-neutral-900/40 px-4 py-3">1. Analyze dataset and generate a plan</div>
            <div className="rounded-2xl border border-white/5 bg-neutral-900/40 px-4 py-3">2. Review or edit the training parameters</div>
            <div className="rounded-2xl border border-white/5 bg-neutral-900/40 px-4 py-3">3. Launch through the SDK onto connected cloud and storage</div>
          </div>
        </div>
      </div>

      {/* Step 1: Analyze Dataset */}
      {!analysis && (
        <div className="space-y-6">
          <div className="bg-[#1c1b1b] rounded-2xl p-8 border border-white/5 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#d5c5a6]/10 flex items-center justify-center mx-auto mb-6">
              <Brain className="w-8 h-8 text-[#d5c5a6]" />
            </div>
            <h3 className="text-xl font-medium text-white mb-2">
              {datasetId ? 'Ready to Analyze' : 'Select a Dataset First'}
            </h3>
            <p className="text-neutral-400 text-sm max-w-md mx-auto mb-6">
              {datasetId
                ? 'Our AI will detect data types, identify the target column, and suggest the best model + hyperparameters for your dataset.'
                : 'Go to Datasets and select one to train on.'
              }
            </p>

            {datasetId && (
              <>
                <div className="max-w-md mx-auto mb-4">
                  <label className="text-xs text-neutral-500 uppercase tracking-wider block text-left mb-1">
                    Training Objective (optional)
                  </label>
                  <input
                    type="text"
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                    placeholder="e.g., Maximize F1 score for minority class"
                    className="w-full bg-neutral-900 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:border-white/20 focus:outline-none"
                  />
                </div>
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="bg-white text-neutral-900 px-6 py-3 rounded-2xl font-bold text-sm hover:scale-105 transition-transform disabled:opacity-50 flex items-center gap-2 mx-auto"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing Dataset...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Analyze & Generate Plan
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Review Plan */}
      {analysis && plan && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Analysis Summary */}
            <div className="bg-[#1c1b1b] rounded-2xl p-6 border border-white/5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-white flex items-center gap-2">
                  <Database className="w-5 h-5 text-[#d5c5a6]" />
                  Dataset Analysis
                </h3>
                <span className={`text-2xl font-light ${getQualityColor(analysis.data_quality_score)}`}>
                  {analysis.data_quality_score}/100
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-neutral-900/50 rounded-lg p-3">
                  <p className="text-xs text-neutral-500 uppercase">Data Type</p>
                  <p className="text-sm text-white font-medium capitalize">{analysis.data_type}</p>
                </div>
                <div className="bg-neutral-900/50 rounded-lg p-3">
                  <p className="text-xs text-neutral-500 uppercase">Rows × Columns</p>
                  <p className="text-sm text-white font-medium">{analysis.row_count} x {analysis.column_count}</p>
                </div>
                <div className="bg-neutral-900/50 rounded-lg p-3">
                  <p className="text-xs text-neutral-500 uppercase">Label Column</p>
                  <p className="text-sm text-white font-medium">{analysis.label_column || 'Auto-detect'}</p>
                </div>
                <div className="bg-neutral-900/50 rounded-lg p-3">
                  <p className="text-xs text-neutral-500 uppercase">Detected Task</p>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getTaskBadge(analysis.task_type)}`}>
                    {analysis.task_type.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              {/* Column Overview */}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left py-2 text-xs text-neutral-500 uppercase">Column</th>
                      <th className="text-left py-2 text-xs text-neutral-500 uppercase">Type</th>
                      <th className="text-left py-2 text-xs text-neutral-500 uppercase">Unique</th>
                      <th className="text-left py-2 text-xs text-neutral-500 uppercase">Nulls</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.columns.slice(0, 8).map((col) => (
                      <tr key={col.name} className="border-b border-white/5">
                        <td className="py-2 text-neutral-300">{col.name}</td>
                        <td className="py-2 text-neutral-400 capitalize">{col.type}</td>
                        <td className="py-2 text-neutral-400">{col.unique_count}</td>
                        <td className="py-2 text-neutral-400">{col.null_percent.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Training Plan */}
            <div className="bg-[#1c1b1b] rounded-2xl p-6 border border-white/5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-white flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-[#d5c5a6]" />
                  Training Plan
                  <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${getTaskBadge(plan.task)}`}>
                    {plan.task.replace(/_/g, ' ')}
                  </span>
                </h3>
                <button
                  onClick={() => { setIsEditing(!isEditing); setEditedPlan(plan); }}
                  className="text-sm text-neutral-400 hover:text-white flex items-center gap-1 transition-colors"
                >
                  {isEditing ? <X className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                  {isEditing ? 'Cancel' : 'Edit'}
                </button>
              </div>

              {plan.reasoning && (
                <div className="mb-4 p-3 rounded-lg bg-[#d5c5a6]/5 border border-[#d5c5a6]/10">
                  <p className="text-xs text-[#d5c5a6] flex items-start gap-2">
                    <Sparkles className="w-3 h-3 mt-0.5 shrink-0" />
                    {plan.reasoning}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {isEditing ? (
                  <>
                    <div>
                      <label className="text-xs text-neutral-500 uppercase">Model</label>
                      <input
                        type="text"
                        value={editedPlan?.model || ''}
                        onChange={(e) => setEditedPlan(prev => prev ? { ...prev, model: e.target.value } : null)}
                        className="w-full mt-1 bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-white/20 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-neutral-500 uppercase">Epochs</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        step="1"
                        value={editedPlan?.epochs || 3}
                        onChange={(e) => {
                          const value = parseInt(e.target.value);
                          if (isNaN(value) || value < 1) {
                            setEditedPlan(prev => prev ? { ...prev, epochs: 1 } : null);
                          } else if (value > 100) {
                            setEditedPlan(prev => prev ? { ...prev, epochs: 100 } : null);
                          } else {
                            setEditedPlan(prev => prev ? { ...prev, epochs: value } : null);
                          }
                        }}
                        className="w-full mt-1 bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-white/20 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-neutral-500 uppercase">Batch Size</label>
                      <input
                        type="number"
                        min="1"
                        max="256"
                        step="1"
                        value={editedPlan?.batch_size || 16}
                        onChange={(e) => {
                          const value = parseInt(e.target.value);
                          if (isNaN(value) || value < 1) {
                            setEditedPlan(prev => prev ? { ...prev, batch_size: 1 } : null);
                          } else if (value > 256) {
                            setEditedPlan(prev => prev ? { ...prev, batch_size: 256 } : null);
                          } else {
                            setEditedPlan(prev => prev ? { ...prev, batch_size: value } : null);
                          }
                        }}
                        className="w-full mt-1 bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-white/20 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-neutral-500 uppercase">Learning Rate</label>
                      <input
                        type="text"
                        value={editedPlan?.learning_rate || 0.001}
                        onChange={(e) => setEditedPlan(prev => prev ? { ...prev, learning_rate: parseFloat(e.target.value) || 0.001 } : null)}
                        className="w-full mt-1 bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-white/20 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-neutral-500 uppercase">Train/Test Split</label>
                      <select
                        value={editedPlan?.train_test_split || '80/20'}
                        onChange={(e) => setEditedPlan(prev => prev ? { ...prev, train_test_split: e.target.value } : null)}
                        className="w-full mt-1 bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-white/20 focus:outline-none"
                      >
                        <option value="70/30">70/30</option>
                        <option value="80/20">80/20</option>
                        <option value="90/10">90/10</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-neutral-500 uppercase">GPU</label>
                      <select
                        value={editedPlan?.gpu_required || 'none'}
                        onChange={(e) => setEditedPlan(prev => prev ? { ...prev, gpu_required: e.target.value } : null)}
                        className="w-full mt-1 bg-neutral-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-white/20 focus:outline-none"
                      >
                        <option value="none">No GPU (CPU only)</option>
                        <option value="T4">NVIDIA T4</option>
                        <option value="A10G">NVIDIA A10G</option>
                        <option value="V100">NVIDIA V100</option>
                        <option value="A100">NVIDIA A100</option>
                      </select>
                    </div>
                    <div className="col-span-2 md:col-span-3">
                      <button
                        onClick={handleSavePlan}
                        className="px-4 py-2 rounded-2xl text-sm font-medium bg-white text-neutral-900 hover:bg-neutral-200 transition-colors flex items-center gap-2"
                      >
                        <Save className="w-4 h-4" />
                        Save Changes
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <PlanItem icon={<Zap className="w-4 h-4" />} label="Model" value={plan.model} />
                    <PlanItem icon={<Cpu className="w-4 h-4" />} label="Framework" value={plan.framework} />
                    <PlanItem icon={<TrendingUp className="w-4 h-4" />} label="Epochs" value={String(plan.epochs)} />
                    <PlanItem icon={<Settings2 className="w-4 h-4" />} label="Batch Size" value={String(plan.batch_size)} />
                    <PlanItem icon={<Settings2 className="w-4 h-4" />} label="Optimizer" value={plan.optimizer} />
                    <PlanItem icon={<Settings2 className="w-4 h-4" />} label="Learning Rate" value={String(plan.learning_rate)} />
                    <PlanItem icon={<Cpu className="w-4 h-4" />} label="GPU Required" value={plan.gpu_required === 'none' ? 'CPU Only' : plan.gpu_required} />
                    <PlanItem icon={<Clock className="w-4 h-4" />} label="Est. Time" value={`${plan.estimated_time_minutes} min`} />
                    <PlanItem icon={<DollarSign className="w-4 h-4" />} label="Est. Cost" value={`$${plan.estimated_cost_usd.toFixed(2)}`} />
                  </>
                )}
              </div>

              {/* Preprocessing Steps */}
              {!isEditing && (
                <div className="mt-4 pt-4 border-t border-white/5">
                  <p className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Preprocessing Pipeline</p>
                  <div className="flex flex-wrap gap-2">
                    {plan.preprocessing.map((step, i) => (
                      <span key={i} className="px-3 py-1 rounded-full text-xs bg-white/5 text-neutral-300 border border-white/5 flex items-center gap-1">
                        <ChevronRight className="w-3 h-3 text-[#d5c5a6]" />
                        {step.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Metrics */}
              {!isEditing && (
                <div className="mt-3">
                  <p className="text-xs text-neutral-500 uppercase tracking-wider mb-2">Metrics to Track</p>
                  <div className="flex flex-wrap gap-2">
                    {plan.metrics.map((m, i) => (
                      <span key={i} className="px-3 py-1 rounded-full text-xs bg-[#d5c5a6]/5 text-[#d5c5a6] border border-[#d5c5a6]/10">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Step 3: Select Cloud & Start */}
            <div className="bg-[#1c1b1b] rounded-2xl p-6 border border-white/5">
              <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                <Play className="w-5 h-5 text-[#d5c5a6]" />
                Launch Training
              </h3>

              <div className="mb-4 rounded-2xl border border-white/5 bg-neutral-900/40 px-4 py-4">
                <p className="text-sm text-neutral-300">
                  Users connect their own cloud and storage. Pipeline Labs validates access, prepares the workflow, and executes against customer-owned infrastructure through the SDK contract.
                </p>
              </div>

              {cloudProviders.length === 0 && (
                <div className="mb-4 p-4 rounded-lg bg-yellow-500/5 border border-yellow-500/10">
                  <p className="text-sm text-yellow-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Connect a cloud provider before starting a training run.
                  </p>
                  <button
                    onClick={() => navigate('/dashboard/cloud')}
                    className="mt-2 text-sm text-[#d5c5a6] hover:underline"
                  >
                    {'Go to Cloud Connect ->'}
                  </button>
                </div>
              )}

              {cloudProviders.length > 0 && (
                <div className="mb-4">
                  <label className="text-xs text-neutral-500 uppercase tracking-wider block mb-2">
                    Select Cloud Provider
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {cloudProviders.map((cp) => (
                      <button
                        key={cp.id}
                        onClick={() => setSelectedCloudId(cp.id)}
                        className={`p-4 rounded-2xl border text-left transition-colors ${
                          selectedCloudId === cp.id
                            ? 'border-[#d5c5a6] bg-[#d5c5a6]/5'
                            : 'border-white/10 hover:border-white/20'
                        }`}
                      >
                        <p className="font-medium text-white text-sm">{cp.label}</p>
                        <p className="text-xs text-neutral-500 uppercase">{cp.provider}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleApproveAndTrain}
                disabled={isStarting || !selectedCloudId}
                className="w-full bg-white text-neutral-900 px-6 py-3 rounded-2xl font-bold text-sm hover:scale-[1.02] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isStarting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Starting Training Job...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Approve Plan & Start Training
                  </>
                )}
              </button>
            </div>

            {/* Re-analyze button */}
            <button
              onClick={() => { setAnalysis(null); setPlan(null); setPlanId(null); }}
              className="text-sm text-neutral-500 hover:text-white transition-colors"
            >
              {'<- Re-analyze with different objective'}
            </button>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

function PlanItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-neutral-900/50 rounded-lg p-3">
      <div className="flex items-center gap-2 text-xs text-neutral-500 uppercase">
        {icon}
        {label}
      </div>
      <p className="text-sm text-white font-medium mt-1">{value}</p>
    </div>
  );
}
