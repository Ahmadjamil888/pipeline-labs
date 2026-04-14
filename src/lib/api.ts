// =====================================================
// Frontend API Client for Pipeline Labs Backend
// =====================================================

import { supabase } from './supabase';

const API_BASE = '/api';
const API_KEY_STORAGE_KEY = 'pipeline_api_key';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || '';
  const apiKey = typeof window !== 'undefined' ? window.localStorage.getItem(API_KEY_STORAGE_KEY) : null;

  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(apiKey ? { 'x-api-key': apiKey } : {}),
  };
}

async function apiCall(path: string, options: RequestInit = {}): Promise<any> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(err.error || 'API call failed');
  }

  // Guard against empty bodies (e.g., 204 No Content)
  const contentType = response.headers.get('Content-Type');
  const contentLength = response.headers.get('Content-Length');
  
  if (response.status === 204 || contentLength === '0' || !contentType?.includes('json')) {
    return null;
  }

  const text = await response.text();
  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Failed to parse response as JSON: ${text}`);
  }
}

export const authApi = {
  me: () => apiCall('/auth/me'),

  exportData: () => apiCall('/auth/export'),

  listApiKeys: () => apiCall('/auth/api-keys'),

  createApiKey: (name: string, expiresAt?: string) =>
    apiCall('/auth/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name, expiresAt }),
    }),

  revokeApiKey: (id: string) =>
    apiCall(`/auth/api-keys/${id}`, { method: 'DELETE' }),

  saveApiKey: (key: string) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(API_KEY_STORAGE_KEY, key);
    }
  },

  clearSavedApiKey: () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
  },
};

// =====================================================
// PLANNER API
// =====================================================
export const plannerApi = {
  analyze: (datasetId: string, userObjective?: string) =>
    apiCall('/planner/analyze', {
      method: 'POST',
      body: JSON.stringify({ datasetId, userObjective }),
    }),

  getPlan: (planId: string) =>
    apiCall(`/planner/${planId}`),

  updatePlan: (planId: string, updates: { plan?: any; status?: string }) =>
    apiCall(`/planner/${planId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  listPlans: () =>
    apiCall('/planner'),
};

// =====================================================
// CLOUD API
// =====================================================
export const cloudApi = {
  listProviders: () =>
    apiCall('/cloud/providers'),

  addProvider: (provider: string, label: string, credentials: Record<string, string>) =>
    apiCall('/cloud/providers', {
      method: 'POST',
      body: JSON.stringify({ provider, label, credentials }),
    }),

  updateProvider: (id: string, updates: { label?: string; credentials?: Record<string, string>; is_active?: boolean }) =>
    apiCall(`/cloud/providers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  deleteProvider: (id: string) =>
    apiCall(`/cloud/providers/${id}`, { method: 'DELETE' }),

  estimateCost: (providerId: string, gpuType: string, estimatedHours: number) =>
    apiCall('/cloud/estimate-cost', {
      method: 'POST',
      body: JSON.stringify({ providerId, gpuType, estimatedHours }),
    }),
};

// =====================================================
// JOBS API
// =====================================================
export const jobsApi = {
  start: (planId: string, cloudProviderId: string) =>
    apiCall('/jobs/start', {
      method: 'POST',
      body: JSON.stringify({ planId, cloudProviderId }),
    }),

  list: () =>
    apiCall('/jobs'),

  get: (jobId: string) =>
    apiCall(`/jobs/${jobId}`),

  cancel: (jobId: string) =>
    apiCall(`/jobs/${jobId}/cancel`, { method: 'POST' }),
};

// =====================================================
// MONITORING API
// =====================================================
export const monitoringApi = {
  getLogs: (jobId: string, limit = 100, offset = 0) =>
    apiCall(`/monitoring/${jobId}/logs?limit=${limit}&offset=${offset}`),

  getMetrics: (jobId: string) =>
    apiCall(`/monitoring/${jobId}/metrics`),

  getStatus: (jobId: string) =>
    apiCall(`/monitoring/${jobId}/status`),
};

export const aiApi = {
  chat: (message: string, datasetId?: string, history?: Array<{ role: string; content: string }>) =>
    apiCall('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message, datasetId, history }),
    }),

  reasonings: (columns: unknown[]) =>
    apiCall('/ai/reasonings', {
      method: 'POST',
      body: JSON.stringify({ columns }),
    }),
};
