// Shared type definitions for the backend API

export type FileEntry = { 
  path: string; 
  content: string; 
};

export type Project = {
  id: string;
  name: string;
  description?: string;
  tooling?: string[];
  languages?: string[];
  testSuite?: string;
  language?: string;
  frameworkType?: string;
  tools?: string[];
  createdAt?: string;
  updatedAt?: string;
  files?: FileEntry[];
};

export type Run = {
  id: string;
  projectId: string;
  tool: string;
  startedAt: string;
  endedAt: string;
  status: string;
  results: string;
};

export type RevertRecord = {
  id: string;
  projectId: string;
  createdAt: string;
  filesBefore: FileEntry[]; // snapshot of files before apply
  filesAfter: FileEntry[]; // snapshot after apply
  message?: string;
};

// Wrapper types for JSON file structures
export type ProjectsWrapper = { projects: Project[] };
export type RunsWrapper = { runs: Run[] };
export type RevertsWrapper = { reverts: RevertRecord[] };

// Child process type for test runs
export type Child = import('child_process').ChildProcess;