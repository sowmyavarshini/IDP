import type { DocumentResult, MemoryStore } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  uploadDocument(file: File): Promise<{ document_id: string; message: string }> {
    const form = new FormData();
    form.append('file', file);
    return request('/api/upload', { method: 'POST', body: form });
  },

  getDocumentStatus(id: string): Promise<{
    id: string; file_name: string; status: string;
    document_type?: string; classification_confidence?: number;
    confidence_score?: number; pipeline_steps: unknown[]; created_at?: string;
  }> {
    return request(`/api/documents/${id}/status`);
  },

  getDocument(id: string): Promise<DocumentResult> {
    return request(`/api/documents/${id}`);
  },

  listDocuments(limit = 50): Promise<DocumentResult[]> {
    return request(`/api/documents?limit=${limit}`);
  },

  submitFeedback(id: string, feedback: string, corrections: Record<string, unknown> = {}): Promise<void> {
    return request(`/api/documents/${id}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback, corrections }),
    });
  },

  getMemory(): Promise<MemoryStore> {
    return request('/api/memory');
  },

  deleteDocument(id: string): Promise<void> {
    return request(`/api/documents/${id}`, { method: 'DELETE' });
  },

  checkHealth(): Promise<{ status: string }> {
    return request('/api/health');
  },
};
