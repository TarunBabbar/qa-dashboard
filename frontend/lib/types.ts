// Shared domain types for the QA Dashboard front-end.
// These can later align with backend DTOs.

export interface Project {
  id: string;
  name: string;
  description?: string;
  repoUrl?: string;
  createdAt: string; // ISO
  updatedAt?: string; // ISO
  // new fields for mapping and project creation
  testSuite?: string;
  language?: string;
  frameworkType?: string;
  tools?: string[];
  frameworkIds?: string[]; // framework ids (many-to-many)
}

export interface Framework {
  id: string;
  name: string;
  language?: string;
  type?: string; // e.g. 'UI', 'API', 'E2E'
  tools?: string[];
  description?: string;
  repoUrl?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface FrameworkCreatePayload {
  name: string;
  language: string;
  type: string;
  tools: string[];
  description?: string;
  repoUrl?: string;
  tags?: string[];
}

export interface TestRunSummary {
  id: string;
  frameworkId: string;
  projectId?: string;
  status: 'queued' | 'running' | 'passed' | 'failed' | 'error' | 'canceled';
  totalTests: number;
  passed: number;
  failed: number;
  durationSeconds: number;
  startedAt: string;
  completedAt?: string;
  commit?: string;
  branch?: string;
}

export interface ReportSummary {
  passRate: number; // 0-1
  avgDurationSeconds: number;
  flakyTests: number;
  totalRuns: number;
  period: string; // e.g. '7d'
}

export interface PassRatePoint {
  date: string; // ISO date (day granularity)
  passRate: number; // 0-1
  totalRuns: number;
}

export interface ApiResponse<T> {
  data: T;
  error?: string;
}
