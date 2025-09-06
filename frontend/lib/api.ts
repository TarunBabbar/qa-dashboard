// Ensure Node.js types are available for process.env
/// <reference types="node" />
import { ApiResponse, Framework, FrameworkCreatePayload, PassRatePoint, Project, ReportSummary, TestRunSummary } from './types';

// Generic fetch wrapper (can evolve: auth headers, error normalization, retry logic)
async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
    if (!res.ok) {
      const text = await res.text();
      return { data: undefined as unknown as T, error: text || res.statusText };
    }
    const json = await res.json();
    return { data: json };
  } catch (e: any) {
    return { data: undefined as unknown as T, error: e.message || 'Network error' };
  }
}

// Mock endpoints (placeholder). Later switch to real /api routes or backend base URL.
export async function listProjects(): Promise<ApiResponse<Project[]>> {
  try {
    const res = await fetch('/api/projects');
    const json = await res.json();
    const data = json?.projects ?? json?.data ?? (Array.isArray(json) ? json : []);
    return { data };
  } catch (e: any) {
    return { data: [], error: e.message };
  }
}

export async function getProject(id: string): Promise<ApiResponse<Project>> {
  try {
    const res = await fetch(`/api/projects/${id}`);
    const json = await res.json();
    const data = json?.data ?? json?.project ?? json;
    return { data };
  } catch (e: any) {
    return { data: undefined as unknown as Project, error: e.message };
  }
}

export async function createProject(payload: Partial<Project>): Promise<ApiResponse<Project>> {
  try {
    const res = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const json = await res.json();
    const data = json?.data ?? json?.project ?? json;
    return { data };
  } catch (e: any) {
    return { data: undefined as unknown as Project, error: e.message };
  }
}

export async function updateProject(id: string, patch: Partial<Project>): Promise<ApiResponse<Project>> {
  try {
    const res = await fetch(`/api/projects/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    const json = await res.json();
    return { data: json.data };
  } catch (e: any) {
    return { data: undefined as unknown as Project, error: e.message };
  }
}

export async function listFrameworks(): Promise<ApiResponse<Framework[]>> {
  return { data: [] };
}

export async function createFramework(payload: FrameworkCreatePayload): Promise<ApiResponse<Framework>> {
  // Simulate return with generated id & timestamps
  const now = new Date().toISOString();
  return { data: { id: crypto.randomUUID(), createdAt: now, updatedAt: now, ...payload } } as ApiResponse<Framework>;
}

export async function listRecentRuns(): Promise<ApiResponse<TestRunSummary[]>> {
  return { data: [] };
}

export async function getReportSummary(period = '7d'): Promise<ApiResponse<ReportSummary>> {
  return { data: { passRate: 0.82, avgDurationSeconds: 320, flakyTests: 5, totalRuns: 42, period } };
}

export async function getPassRateTrend(period = '30d'): Promise<ApiResponse<PassRatePoint[]>> {
  // Simple synthetic data
  const today = new Date();
  const days = parseInt(period); // crude parse expecting '30d'
  const len = isNaN(days) ? 30 : days;
  const data: PassRatePoint[] = Array.from({ length: len }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (len - 1 - i));
    const passRate = 0.7 + Math.sin(i / 5) * 0.1 + (Math.random() * 0.05);
    return { date: d.toISOString().slice(0, 10), passRate: Math.min(0.99, Math.max(0.4, passRate)), totalRuns: 10 + Math.floor(Math.random() * 15) };
  });
  return { data };
}

export { apiFetch };

// AI assistant helpers
// Backend base URL must come from environment to avoid hardcoded values in code.
// Prefer NEXT_PUBLIC_BACKEND_URL set in the environment (Next.js exposes NEXT_PUBLIC_* to the browser).
export const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL;
if (!backendBase) {
  console.warn('NEXT_PUBLIC_BACKEND_URL is not set. Please configure it in your .env file.');
}

export async function generateAICode(projectId: string, tool: string, language: string, prompt: string) {
  const res = await fetch(`${backendBase}/api/ai/generate-code`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, tool, language, prompt }) });
  return res.json();
}

export async function applyAICode(projectId: string, files: { path: string; content: string }[], message?: string) {
  const res = await fetch(`${backendBase}/api/ai/apply-code`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, files, message }) });
  return res.json();
}

export async function revertAICode(revertId: string) {
  const res = await fetch(`${backendBase}/api/ai/revert`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revertId }) });
  return res.json();
}
