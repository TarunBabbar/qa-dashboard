import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import cors from 'cors';

// OpenAI runtime loader (single instance)
let openaiClient: any;

function initOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    openaiClient = undefined;
    return;
  }
  try {
    const openaiModule = require('openai');
    if (openaiModule?.Configuration && openaiModule?.OpenAIApi) {
      const Configuration = openaiModule.Configuration;
      const OpenAIApi = openaiModule.OpenAIApi;
      const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
      openaiClient = new OpenAIApi(configuration);
    } else if (openaiModule?.OpenAI) {
      const OpenAI = openaiModule.OpenAI;
      openaiClient = new OpenAI(process.env.OPENAI_API_KEY);
    } else {
      openaiClient = undefined;
    }
  } catch {
    openaiClient = undefined;
  }
}
dotenv.config();
initOpenAIClient();

// Types
type FileEntry = { path: string; content: string };
type Project = {
  id: string;
  name: string;
  description?: string;
  tooling?: string[];
  languages?: string[];
  createdAt?: string;
  updatedAt?: string;
  files?: FileEntry[];
};
type Run = {
  id: string;
  projectId: string;
  tool: string;
  startedAt: string;
  endedAt: string;
  status: string;
  results: string;
};

type ProjectsWrapper = { projects: Project[] };
type RunsWrapper = { runs: Run[] };

const app = express();
// Default port: 3001 to avoid conflicts with Next.js dev server (which commonly uses 3000).
// You can override this by setting PORT in your environment, e.g. `PORT=4000 npm run dev`.
const port: number = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use(cors());

const dataDir = path.resolve(__dirname, '../../data');
const projectsPath = path.join(dataDir, 'projects.json');
const runsPath = path.join(dataDir, 'runs.json');
const usersPath = path.join(dataDir, 'users.json'); // reserved for future

function ensureDirExists(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJson<T>(filePath: string, defaultValue: T): T {
  try {
    if (!fs.existsSync(filePath)) return defaultValue;
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

function writeJson<T>(filePath: string, data: T): void {
  ensureDirExists(filePath);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// Load baseline data
let projectData = readJson<ProjectsWrapper>(projectsPath, { projects: [] });
if (!projectData || !Array.isArray(projectData.projects)) {
  projectData = { projects: [] };
}
let runsData = readJson<RunsWrapper>(runsPath, { runs: [] });
if (!runsData || !Array.isArray(runsData.runs)) {
  runsData = { runs: [] };
}

// Endpoints
app.get('/healthz', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/projects', (req: Request, res: Response) => {
  res.json(projectData);
});

app.post('/api/projects', (req: Request, res: Response) => {
  const payload: Partial<Project> = req.body;
  const newProject: Project = {
    id: 'proj-' + Date.now(),
    name: payload.name ?? 'Untitled Project',
    description: payload.description ?? '',
    tooling: payload.tooling ?? ['Selenium', 'Playwright', 'Cypress'],
    languages: payload.languages ?? ['JavaScript', 'TypeScript'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    files: Array.isArray(payload.files) ? (payload.files as FileEntry[]) : []
  };
  projectData.projects.push(newProject);
  writeJson<{ projects: Project[] }>(projectsPath, projectData);
  res.status(201).json(newProject);
});

app.get('/api/projects/:id', (req: Request, res: Response) => {
  const id = req.params.id;
  const proj = projectData.projects.find(p => p.id === id);
  if (!proj) return res.status(404).json({ error: 'Project not found' });
  res.json(proj);
});

app.put('/api/projects/:id', (req: Request, res: Response) => {
  const id = req.params.id;
  const payload: Partial<Project> = req.body;
  const index = projectData.projects.findIndex(p => p.id === id);
  if (index === -1) return res.status(404).json({ error: 'Project not found' });
  const existing = projectData.projects[index];
  const updated: Project = {
    ...existing,
    ...payload,
    id,
    updatedAt: new Date().toISOString(),
  } as Project;
  projectData.projects[index] = updated;
  writeJson<{ projects: Project[] }>(projectsPath, projectData);
  res.json(updated);
});

app.delete('/api/projects/:id', (req: Request, res: Response) => {
  const id = req.params.id;
  const idx = projectData.projects.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Project not found' });
  const removed = projectData.projects.splice(idx, 1)[0];
  writeJson<{ projects: Project[] }>(projectsPath, projectData);
  res.json({ removed });
});

app.get('/api/projects/:id/files', (req: Request, res: Response) => {
  const id = req.params.id;
  const proj = projectData.projects.find(p => p.id === id);
  if (!proj) return res.status(404).json({ error: 'Project not found' });
  res.json({ files: proj.files ?? [] });
});

app.get('/api/projects/:id/files/*', (req: Request, res: Response) => {
  const id = req.params.id;
  const filePath = req.params[0];
  const proj = projectData.projects.find(p => p.id === id);
  if (!proj) return res.status(404).json({ error: 'Project not found' });
  const file = (proj.files ?? []).find(f => f.path === filePath);
  if (!file) return res.status(404).json({ error: 'File not found' });
  res.json({ path: file.path, content: file.content });
});

app.put('/api/projects/:id/files/*', (req: Request, res: Response) => {
  const id = req.params.id;
  const filePath = req.params[0];
  const content = req.body?.content ?? '';
  const proj = projectData.projects.find(p => p.id === id);
  if (!proj) return res.status(404).json({ error: 'Project not found' });

  const files = proj.files ?? [];
  const idx = files.findIndex(f => f.path === filePath);
  if (idx >= 0) {
    files[idx].content = content;
  } else {
    files.push({ path: filePath, content });
  }
  proj.files = files;
  proj.updatedAt = new Date().toISOString();
  writeJson<{ projects: Project[] }>(projectsPath, projectData);
  res.json({ id, path: filePath, content });
});

app.delete('/api/projects/:id/files/*', (req: Request, res: Response) => {
  const id = req.params.id;
  const filePath = req.params[0];
  const proj = projectData.projects.find(p => p.id === id);
  if (!proj) return res.status(404).json({ error: 'Project not found' });
  const files = (proj.files ?? []).filter(f => f.path !== filePath);
  proj.files = files;
  proj.updatedAt = new Date().toISOString();
  writeJson<{ projects: Project[] }>(projectsPath, projectData);
  res.json({ id, deleted: filePath });
});

// AI generation endpoint
app.post('/api/ai/generate-code', async (req: Request, res: Response) => {
  const { projectId, tool, language, prompt } = req.body as any;
  if (!process.env.OPENAI_API_KEY) {
    return res.status(400).json({ error: 'OPENAI_API_KEY not configured in environment' });
  }

  let generatedCode = '';
  try {
    if (!openaiClient) {
      initOpenAIClient();
      if (!openaiClient) {
        throw new Error('OpenAI client not initialized');
      }
    }
    const userPrompt = `You are an AI assistant that writes ${language} code for a ${tool} project. Project: ${projectId}. Prompt: ${prompt ?? ''}`;
    const response = await openaiClient!.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: userPrompt }],
      max_tokens: 800,
      temperature: 0.25,
    });
    const content = (response as any)?.data?.choices?.[0]?.message?.content ?? '';
    generatedCode = content.trim() || `// AI generated code for ${tool} in ${language}`;
  } catch (err) {
    const message = (err as Error).message;
    console.error('AI generation error', err);
    generatedCode = `// AI generation error: ${message}`;
    res.status(500).json({ projectId, tool, language, generatedCode, promptUsed: prompt, error: message });
    return;
  }

  res.json({ projectId, tool, language, generatedCode, promptUsed: prompt });
});

// Runs
app.get('/api/runs', (req: Request, res: Response) => {
  res.json({ runs: runsData.runs });
});

app.post('/api/runs', (req: Request, res: Response) => {
  const payload: Partial<Run> = req.body;
  const newRun: Run = {
    id: 'run-' + Date.now(),
    projectId: payload.projectId ?? '',
    tool: payload.tool ?? 'Unknown',
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    status: payload.status ?? 'scheduled',
    results: payload.results ?? ''
  };
  runsData.runs.push(newRun);
  writeJson<{ runs: Run[] }>(runsPath, runsData);
  res.status(201).json(newRun);
});

// 404 fallback
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

app.listen(port, () => {
  console.log(`Backend skeleton listening at http://localhost:${port}`);
  if (!process.env.PORT) {
    console.log('Note: using default port 3001 to avoid common conflicts. Set PORT env to change this.');
  }
});