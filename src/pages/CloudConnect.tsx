import { useState, useEffect } from 'react';
import { cloudApi } from '@/lib/api';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cloud, Plus, Trash2, CheckCircle2, AlertCircle,
  Loader2, ChevronDown, ChevronUp, Shield, Key
} from 'lucide-react';

interface CloudProvider {
  id: string;
  provider: 'aws' | 'azure' | 'gcp' | 'runpod';
  label: string;
  credentials: Record<string, string>;
  is_active: boolean;
  last_verified_at: string | null;
  created_at: string;
}

const providerConfig = {
  aws: {
    name: 'AWS',
    description: 'SageMaker / EC2 GPU Instances',
    color: '#FF9900',
    fields: [
      { key: 'access_key_id', label: 'Access Key ID', type: 'text', placeholder: 'AKIA...' },
      { key: 'secret_access_key', label: 'Secret Access Key', type: 'password', placeholder: '••••••••' },
      { key: 'region', label: 'Default Region', type: 'select', options: ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'] },
    ],
  },
  azure: {
    name: 'Azure',
    description: 'Azure ML / Virtual Machines',
    color: '#0078D4',
    fields: [
      { key: 'subscription_id', label: 'Subscription ID', type: 'text', placeholder: 'UUID' },
      { key: 'tenant_id', label: 'Tenant ID', type: 'text', placeholder: 'UUID' },
      { key: 'client_id', label: 'Client ID', type: 'text', placeholder: 'UUID' },
      { key: 'client_secret', label: 'Client Secret', type: 'password', placeholder: '••••••••' },
      { key: 'resource_group', label: 'Resource Group', type: 'text', placeholder: 'ml-resources' },
      { key: 'region', label: 'Region', type: 'select', options: ['eastus', 'westus2', 'westeurope', 'southeastasia'] },
    ],
  },
  gcp: {
    name: 'GCP',
    description: 'Vertex AI / Compute Engine',
    color: '#4285F4',
    fields: [
      { key: 'project_id', label: 'Project ID', type: 'text', placeholder: 'my-project-123' },
      { key: 'service_account_key', label: 'Service Account Key (Base64)', type: 'textarea', placeholder: 'Paste your JSON key...' },
      { key: 'region', label: 'Region', type: 'select', options: ['us-central1', 'us-east1', 'europe-west1', 'asia-east1'] },
    ],
  },
  runpod: {
    name: 'RunPod',
    description: 'Simple GPU Cloud — Just an API Key',
    color: '#7C3AED',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'rpa-...' },
    ],
  },
};

export default function CloudConnect() {
  const [providers, setProviders] = useState<CloudProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'aws' | 'azure' | 'gcp' | 'runpod' | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [label, setLabel] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadProviders = async () => {
    try {
      const data = await cloudApi.listProviders();
      setProviders(data || []);
    } catch (err) {
      console.error('Failed to load providers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadProviders(); }, []);

  const handleAdd = async () => {
    if (!selectedProvider) return;
    const config = providerConfig[selectedProvider];
    const requiredFields = config.fields.filter(f => f.type !== 'select');
    const missing = requiredFields.some(f => !formData[f.key]?.trim());
    if (missing) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsAdding(true);
    try {
      await cloudApi.addProvider(
        selectedProvider,
        label || `My ${config.name}`,
        formData
      );
      toast.success(`${config.name} cloud provider added successfully`);
      setShowAddModal(false);
      setSelectedProvider(null);
      setFormData({});
      setLabel('');
      await loadProviders();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add provider');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await cloudApi.deleteProvider(id);
      toast.success('Cloud provider removed');
      await loadProviders();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  const handleFieldChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
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
          <h2 className="text-3xl font-light text-white tracking-tight">Cloud Connect</h2>
          <p className="text-neutral-400 mt-1">Connect your cloud accounts to run ML training jobs</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-white text-neutral-900 px-5 py-2.5 rounded-full font-bold text-sm hover:scale-105 transition-transform flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Cloud
        </button>
      </div>

      {/* Security Notice */}
      <div className="bg-[#1c1b1b] rounded-xl p-5 border border-white/5 flex items-start gap-4">
        <Shield className="w-5 h-5 text-[#d5c5a6] shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-neutral-300 font-medium">Your keys stay secure</p>
          <p className="text-xs text-neutral-500 mt-1">
            API keys are stored in your Supabase vault with Row Level Security. Only you can access them.
            AI never directly controls your cloud — it generates training plans that the system executes via safe API adapters.
          </p>
        </div>
      </div>

      {/* Provider Cards */}
      {providers.length === 0 ? (
        <div className="text-center py-16">
          <Cloud className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
          <p className="text-neutral-400 mb-2">No cloud providers connected</p>
          <p className="text-neutral-500 text-sm">Add your AWS, Azure, GCP, or RunPod credentials to start training</p>
        </div>
      ) : (
        <div className="space-y-3">
          {providers.map((provider) => {
            const config = providerConfig[provider.provider];
            const isExpanded = expandedId === provider.id;

            return (
              <motion.div
                key={provider.id}
                layout
                className="bg-[#1c1b1b] rounded-xl border border-white/5 overflow-hidden"
              >
                <div
                  className="p-5 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : provider.id)}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center border border-white/10"
                      style={{ backgroundColor: `${config.color}15` }}
                    >
                      <Cloud className="w-5 h-5" style={{ color: config.color }} />
                    </div>
                    <div>
                      <p className="font-medium text-white text-sm">{provider.label}</p>
                      <p className="text-xs text-neutral-500">{config.name} — {config.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {provider.is_active ? (
                      <span className="px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-xs bg-neutral-700 text-neutral-400">Inactive</span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(provider.id); }}
                      className="p-1.5 text-neutral-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-neutral-500" /> : <ChevronDown className="w-4 h-4 text-neutral-500" />}
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 border-t border-white/5 pt-4 space-y-3">
                        <p className="text-xs text-neutral-500 uppercase tracking-wider">Credentials</p>
                        {Object.entries(provider.credentials).map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between">
                            <span className="text-sm text-neutral-400">{key.replace(/_/g, ' ')}</span>
                            <span className="text-sm text-neutral-300 font-mono">{value}</span>
                          </div>
                        ))}
                        {provider.last_verified_at && (
                          <p className="text-xs text-neutral-600 mt-2">
                            Last verified: {new Date(provider.last_verified_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add Cloud Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1c1b1b] rounded-2xl border border-white/10 max-w-lg w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-xl font-medium text-white">Add Cloud Provider</h3>
                  <p className="text-sm text-neutral-400 mt-1">Connect your cloud account with API credentials</p>
                </div>

                {!selectedProvider ? (
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(providerConfig).map(([key, config]) => (
                      <button
                        key={key}
                        onClick={() => setSelectedProvider(key as any)}
                        className="p-4 rounded-xl border border-white/10 hover:border-white/20 transition-colors text-left"
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                          style={{ backgroundColor: `${config.color}15` }}
                        >
                          <Cloud className="w-4 h-4" style={{ color: config.color }} />
                        </div>
                        <p className="font-medium text-white text-sm">{config.name}</p>
                        <p className="text-xs text-neutral-500 mt-1">{config.description}</p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <button
                      onClick={() => { setSelectedProvider(null); setFormData({}); }}
                      className="text-sm text-neutral-400 hover:text-white transition-colors"
                    >
                      ← Back to providers
                    </button>

                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${providerConfig[selectedProvider].color}15` }}
                      >
                        <Cloud className="w-4 h-4" style={{ color: providerConfig[selectedProvider].color }} />
                      </div>
                      <span className="font-medium text-white">{providerConfig[selectedProvider].name}</span>
                    </div>

                    <div>
                      <label className="text-xs text-neutral-500 uppercase tracking-wider">Label</label>
                      <input
                        type="text"
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        placeholder={`My ${providerConfig[selectedProvider].name}`}
                        className="w-full mt-1 bg-neutral-900 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:border-white/20 focus:outline-none"
                      />
                    </div>

                    {providerConfig[selectedProvider].fields.map((field) => (
                      <div key={field.key}>
                        <label className="text-xs text-neutral-500 uppercase tracking-wider">{field.label}</label>
                        {field.type === 'textarea' ? (
                          <textarea
                            value={formData[field.key] || ''}
                            onChange={(e) => handleFieldChange(field.key, e.target.value)}
                            placeholder={field.placeholder}
                            rows={4}
                            className="w-full mt-1 bg-neutral-900 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:border-white/20 focus:outline-none font-mono resize-none"
                          />
                        ) : field.type === 'select' ? (
                          <select
                            value={formData[field.key] || ''}
                            onChange={(e) => handleFieldChange(field.key, e.target.value)}
                            className="w-full mt-1 bg-neutral-900 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-white/20 focus:outline-none"
                          >
                            <option value="">Select...</option>
                            {field.options?.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={field.type}
                            value={formData[field.key] || ''}
                            onChange={(e) => handleFieldChange(field.key, e.target.value)}
                            placeholder={field.placeholder}
                            className="w-full mt-1 bg-neutral-900 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:border-white/20 focus:outline-none"
                          />
                        )}
                      </div>
                    ))}

                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={() => setShowAddModal(false)}
                        className="flex-1 px-4 py-2.5 rounded-lg text-sm text-neutral-400 border border-white/10 hover:bg-white/5 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleAdd}
                        disabled={isAdding}
                        className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-white text-neutral-900 hover:bg-neutral-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isAdding ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Validating...
                          </>
                        ) : (
                          <>
                            <Key className="w-4 h-4" />
                            Add & Validate
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
