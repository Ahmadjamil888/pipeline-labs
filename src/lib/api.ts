// =====================================================
// Frontend API Client for Pipeline Labs Backend
// =====================================================

import { supabase } from './supabase';

const API_BASE = '/api';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || '';
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
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

  return response.json();
}

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
