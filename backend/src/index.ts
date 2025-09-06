import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import cors from 'cors';
import OpenAI from "openai";
import net from 'net';

// Load environment variables early
dotenv.config();

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const aiModel = process.env.OPENAI_MODEL!;

router.post("/agent-brief", async (req, res) => {
  const { prompt } = req.body ?? {};
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const stream = await openai.chat.completions.create({
    model: aiModel,
    stream: true,
    messages: [
      { role: "system", content:
        "You are a brisk, friendly test-planner. Acknowledge the request, restate it crisply, list the plan in bullets, set expectations. Keep it short, use emojis sparingly (✅, 🔧, ⏱️), no code." },
      { role: "user", content: prompt }
    ],
  });

  for await (const part of stream) {
    const token = part.choices?.[0]?.delta?.content ?? "";
    if (token) res.write(`data:${token}\n\n`);
  }
  res.write("data:[DONE]\n\n");
  res.end();
});

export default router;

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

type RevertRecord = {
  id: string;
  projectId: string;
  createdAt: string;
  filesBefore: FileEntry[]; // snapshot of files before apply
  filesAfter: FileEntry[]; // snapshot after apply
  message?: string;
};

type RevertsWrapper = { reverts: RevertRecord[] };

const app = express();
// Default port: 3001 to avoid conflicts with Next.js dev server (which commonly uses 3000).
// You can override this by setting PORT in your environment, e.g. `PORT=4000 npm run dev`.
const host = process.env.HOST || '0.0.0.0';
const port: number = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use(cors());
app.use("/api/ai", router); 

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
let revertsPath = path.join(dataDir, 'reverts.json');
let revertsData = readJson<RevertsWrapper>(revertsPath, { reverts: [] });
if (!revertsData || !Array.isArray(revertsData.reverts)) {
  revertsData = { reverts: [] };
}

// --- Test Run Orchestration: in-memory process tracking and SSE clients ---
type Child = import('child_process').ChildProcess;
const runChildren: Map<string, Child> = new Map();
const canceledRuns: Set<string> = new Set();
const sseClients: Map<string, Set<Response>> = new Map();

function broadcastLog(runId: string, chunk: Buffer | string) {
  const set = sseClients.get(runId);
  if (!set || set.size === 0) return;
  const text = (chunk instanceof Buffer ? chunk.toString('utf8') : String(chunk));
  const payload = JSON.stringify(text);
  for (const res of set) {
    try { res.write(`data: ${payload}\n\n`); } catch {}
  }
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
    const model = process.env.OPENAI_MODEL;

   const systemPrompt = `
You are a senior software engineer and test automation architect. 
When given a user scenario, generate a complete, ready-to-run automation project 
based on the selected Framework Type, Programming Language, and Tool. 
Only generate code using supported combinations defined in the mapping (FRAMEWORK_TO_LANGUAGES_AND_TOOLS). 
Never invent unsupported combinations.

## Supported Frameworks, Languages, and Tools
The generator will always reference a predefined JSON mapping object called FRAMEWORK_TO_LANGUAGES_AND_TOOLS 
(provided externally, not shown inside this system message).

## Project Design Principles
- Always enforce **SOLID principles** and **clean architecture**.
- For **UI Testing**, strictly apply **Page Object Model (POM)** with one class per page/component.
- For **API, Unit, BDD, Integration, Performance, Security**, apply relevant design patterns 
  (Factory, Strategy, Builder, Dependency Injection, etc.).
- Code must be **readable, maintainable, and scalable**.

## Folder & File Placement (MANDATORY)
- UI page or route classes → 'src/pages/...'
- Automated test specs → 'src/tests/...'
  • Use each tool’s conventions (see below)  
- Support code (page objects, fixtures, utilities) → 'src/helpers', 'src/utils', or 'src/lib'
- Tool configs → project root (e.g., 'playwright.config.ts', 'pytest.ini', 'jest.config.js')
- Dependency/build manifests at root (MANDATORY):
  • Node.js → 'package.json' + 'package-lock.json' (or 'yarn.lock')  
  • Python → 'requirements.txt' (with exact working versions) or 'pyproject.toml' + 'poetry.lock'  
  • Java → 'pom.xml' or 'build.gradle'  
  • C# / .NET → '.csproj' + NuGet references  
  • Ruby → 'Gemfile' + 'Gemfile.lock'  
  • Go → 'go.mod' + 'go.sum'  
  • PHP → 'composer.json' + 'composer.lock'  

## File & Config Conventions
### Test File Naming
- Java / JUnit, TestNG → '*Test.java' or '*Tests.java'  
- Java / Cucumber-JVM, JBehave, Karate → Feature files in 'src/tests/features/*.feature' + step defs in 'src/tests/steps/'  
- JavaScript / Jest → '*.test.js' or '*.spec.js'  
- TypeScript / Jest → '*.test.ts' or '*.spec.ts'  
- Mocha + Chai → '*.spec.js' / '*.spec.ts'  
- Vitest → '*.test.ts' / '*.spec.ts'  
- Cypress → 'cypress/e2e/*.cy.{js,ts}'  
- Playwright → '*.spec.ts' (or '*.spec.js')  
- WebdriverIO → '*.e2e.js' / '*.e2e.ts'  
- TestCafe → '*.spec.js' or '*.test.js' (config handled via .testcaferc.json)  
- Python / pytest → 'test_*.py' or '*_test.py'  
- Python / unittest → 'test_*.py'  
- Python / Behave → 'features/*.feature' + 'features/steps/*.py'  
- Python / Robot Framework → '*.robot' under 'tests/'  
- C# / NUnit, xUnit, MSTest → test classes in 'Tests/*.cs'  
- C# / SpecFlow → 'Features/*.feature' + step defs in 'Steps/*.cs'  
- Ruby / RSpec → '*_spec.rb'  
- Ruby / Cucumber → 'features/*.feature' + 'features/step_definitions/*.rb'  
- Go / go test → '*_test.go'  
- Go / Ginkgo → '*_test.go' with Describe/It blocks  
- PHP / PHPUnit → 'tests/*Test.php'  
- PHP / Behat → 'features/*.feature' + 'features/bootstrap/*.php'  

### Config Files
- Playwright → 'playwright.config.ts'  
- Cypress → 'cypress.config.{js,ts}'  
- Jest → 'jest.config.{js,ts}'  
- Mocha → 'mocharc.json' or 'mocha.opts'  
- Vitest → 'vitest.config.ts'  
- WebdriverIO → 'wdio.conf.{js,ts}'  
- TestCafe → '.testcaferc.json' (root)  
- JUnit/TestNG → handled via pom.xml / build.gradle  
- Karate → 'karate-config.js'  
- Python / pytest → 'pytest.ini' or 'pyproject.toml'  
- Python / unittest → no config needed  
- Python / Behave → 'behave.ini' optional  
- Robot Framework → no config needed  
- C# / NUnit, xUnit, MSTest → handled via .csproj  
- C# / SpecFlow → 'specflow.json'  
- Ruby / RSpec → '.rspec' + 'spec_helper.rb'  
- Ruby / Cucumber → 'cucumber.yml' optional  
- Go → no config needed (go.mod handles deps)  
- PHP / PHPUnit → 'phpunit.xml' or 'phpunit.xml.dist'  
- PHP / Behat → 'behat.yml'  

## Output Rules
- Return only a **single JSON array** of objects:
  [
    { "path": "relative/path/to/file.ext", "content": "<file contents>" }
  ]
- Escape newlines properly in JSON strings.
- **ALWAYS include every config/dependency file needed** to make the project compile and run.  
- Add a **README.md** with step-by-step setup and execution instructions.

## Expectations
- Code must **compile and run without errors** immediately after installing dependencies.  
- Tests must be **directly executable** via standard commands (npm test, pytest, mvn test, dotnet test, etc.).  
- Follow naming conventions & standard patterns for the chosen tool.
`;


    const userPrompt = `
Project: ${projectId}
Language: ${language}
Tool: ${tool}
Scenario: ${prompt ?? ''}

Requirements:
- Generate a complete runnable project following SOLID principles.
- For UI automation → use Page Object Model (POM).
- Follow the folder structure and conventions from the system message.
- Use only the allowed combination of Language + Tool (from the mapping).
- Include ALL required files (code, configs, manifests, lockfiles).
- Output MUST be a single JSON array of objects:
  [
    { "path": "relative/path/to/file.ext", "content": "<file contents>" }
  ]
- Escape newlines properly in JSON.
- IMPORTANT: Do not include explanations, markdown fences, or extra text. 
Return only the raw JSON array.
`;


    // Support both OpenAIApi (createChatCompletion) and the newer OpenAI client (chat.completions.create)
    let content = '';
    if (typeof openaiClient.createChatCompletion === 'function') {
      const response = await openaiClient.createChatCompletion({
        model: process.env.OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      });
      content = (response as any)?.data?.choices?.[0]?.message?.content ?? '';
    } else if (openaiClient?.chat && typeof openaiClient.chat.completions.create === 'function') {
      const response = await openaiClient.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      });
      content = (response as any)?.choices?.[0]?.message?.content ?? '';
    } else {
      throw new Error('Unsupported OpenAI client');
    }

    generatedCode = (content || `[]`).trim();
  } catch (err) {
    const message = (err as Error).message;
    console.error('AI generation error', err);
    generatedCode = `// AI generation error: ${message}`;
    res.status(500).json({ projectId, tool, language, generatedCode, promptUsed: prompt, error: message });
    return;
  }

  res.json({ projectId, tool, language, generatedCode, promptUsed: prompt });
});


// Apply generated code to project (Agent action). This will snapshot existing files and
// write new/updated files into the project. Returns a revertId that can be used to undo.
app.post('/api/ai/apply-code', (req: Request, res: Response) => {
  const { projectId, files, message } = req.body as any;
  if (!projectId || !Array.isArray(files)) return res.status(400).json({ error: 'projectId and files[] required' });
  const proj = projectData.projects.find(p => p.id === projectId);
  if (!proj) return res.status(404).json({ error: 'Project not found' });

  const existingFiles = proj.files ?? [];
  const filesBefore: FileEntry[] = [];
  const filesAfter: FileEntry[] = [];

  // Apply each file individually, but only snapshot affected files
  const filesMap = new Map<string, string>();
  existingFiles.forEach(f => filesMap.set(f.path, f.content));
  files.forEach((f: FileEntry) => {
    const prior = filesMap.get(f.path);
    if (prior !== undefined) {
      filesBefore.push({ path: f.path, content: prior });
    } else {
      // represent new file with empty before snapshot (no entry)
      filesBefore.push({ path: f.path, content: '' });
    }
    filesMap.set(f.path, f.content);
    filesAfter.push({ path: f.path, content: f.content });
  });

  proj.files = Array.from(filesMap.entries()).map(([path, content]) => ({ path, content }));
  proj.updatedAt = new Date().toISOString();
  writeJson<{ projects: Project[] }>(projectsPath, projectData);

  const revertId = 'revert-' + Date.now();
  const record: RevertRecord = { id: revertId, projectId, createdAt: new Date().toISOString(), filesBefore, filesAfter, message };
  revertsData.reverts.push(record);
  writeJson<RevertsWrapper>(revertsPath, revertsData);

  res.json({ revertId, record });
});

// Revert an apply by revertId
app.post('/api/ai/revert', (req: Request, res: Response) => {
  const { revertId } = req.body as any;
  if (!revertId) return res.status(400).json({ error: 'revertId required' });
  const record = revertsData.reverts.find(r => r.id === revertId);
  if (!record) return res.status(404).json({ error: 'Revert record not found' });
  const proj = projectData.projects.find(p => p.id === record.projectId);
  if (!proj) return res.status(404).json({ error: 'Project not found' });
  // Restore snapshot for affected files only
  const currentMap = new Map<string, string>();
  (proj.files ?? []).forEach(f => currentMap.set(f.path, f.content));
  record.filesBefore.forEach(f => {
    if (f.content === '') {
      // file was new, remove it
      currentMap.delete(f.path);
    } else {
      currentMap.set(f.path, f.content);
    }
  });
  proj.files = Array.from(currentMap.entries()).map(([path, content]) => ({ path, content }));
  proj.updatedAt = new Date().toISOString();
  writeJson<{ projects: Project[] }>(projectsPath, projectData);

  // Optionally remove revert record or mark as applied
  revertsData.reverts = revertsData.reverts.filter(r => r.id !== revertId);
  writeJson<RevertsWrapper>(revertsPath, revertsData);

  res.json({ reverted: revertId, projectId: record.projectId });
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

// Endpoint to fetch test run details
app.get('/api/runs/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const run = runsData.runs.find(r => r.id === id);
  if (!run) {
    return res.status(404).json({ error: 'Test run not found' });
  }

  res.json({
    id: run.id,
    projectId: run.projectId,
    tool: run.tool,
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    status: run.status,
    results: run.results,
  });
});

// Endpoint to trigger test runs
app.post('/api/runs/start', async (req: Request, res: Response) => {
  const { projectId } = req.body;
  if (!projectId) return res.status(400).json({ error: 'Project ID is required' });

  const project = projectData.projects.find(p => p.id === projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  // Create a human-friendly run id: ProjectName-TR-<n>
  const projectName = (project.name || 'Project').replace(/[^A-Za-z0-9_-]+/g, '-');
  const existingForProject = runsData.runs.filter(r => r.projectId === projectId && /^.+-TR-\d+$/.test(r.id));
  const nextNum = existingForProject.length > 0
    ? (Math.max(...existingForProject.map(r => Number((r.id.split('-TR-')[1] || '0')))) + 1)
    : 1;
  const runId = `${projectName}-TR-${nextNum}`;

  const startedAtIso = new Date().toISOString();
  const running: Run = {
    id: runId,
    projectId,
    tool: 'Docker',
    startedAt: startedAtIso,
    endedAt: '',
    status: 'running',
    results: ''
  };
  runsData.runs.push(running);
  writeJson<{ runs: Run[] }>(runsPath, runsData);

  // Prepare workspace and logs on host
  const pathSep = path.sep;
  const workspacesDir = path.join(dataDir, 'run_workspaces');
  const logsDir = path.join(dataDir, 'run_logs');
  ensureDirExists(path.join(workspacesDir, 'placeholder')); // ensure dirs
  ensureDirExists(path.join(logsDir, 'placeholder'));
  const runWorkspace = path.join(workspacesDir, runId);
  if (!fs.existsSync(runWorkspace)) fs.mkdirSync(runWorkspace, { recursive: true });
  const logFile = path.join(logsDir, `${runId}.log`);

  // Materialize project files (if any)
  try {
    const files = project.files ?? [];
    for (const f of files) {
      const abs = path.join(runWorkspace, f.path.replace(/^\/+/, ''));
      ensureDirExists(abs);
      fs.writeFileSync(abs, f.content ?? '', 'utf8');
    }
  } catch (e) {
    console.error('Failed to materialize project files for run', runId, e);
  }

  // Detect test command
  function detectTestCommand(ws: string): string {
    const exists = (rel: string) => fs.existsSync(path.join(ws, rel));
    if (exists('package.json')) {
      return 'npm ci || npm install && npm test || npx playwright test || npx mocha || npx jest';
    }
    if (exists('pyproject.toml') || exists('requirements.txt')) {
      return 'python3 -m pip install -U pip && (test -f requirements.txt && pip install -r requirements.txt || true) && pytest -q || python3 -m pytest -q';
    }
    if (exists('pom.xml')) {
      return 'mvn -q -DskipTests=false test';
    }
    if (exists('go.mod')) {
      return 'go test ./...';
    }
    if (exists('composer.json')) {
      return 'composer install --no-interaction --prefer-dist && ./vendor/bin/phpunit';
    }
    if (exists('*.csproj')) {
      return 'dotnet test';
    }
    // Fallback: try common commands
    return 'npm test || pytest -q || mvn -q test || go test ./... || dotnet test || true';
  }

  const testCmd = detectTestCommand(runWorkspace);

  // Build docker run command using configured image
  const runnerImage = process.env.RUNNER_IMAGE || 'qa-dashboard-runner:latest';
  const wsMount = process.platform === 'win32' ? runWorkspace.replace(/\\/g, '/') : runWorkspace;
  const dockerCmd = `docker run --rm -v "${wsMount}:/workspace" -w /workspace --name ${runId.toLowerCase()} ${runnerImage} /bin/bash -lc "${testCmd}"`;

  // Spawn and stream logs
  const { spawn } = require('child_process');
  const child = spawn(dockerCmd, { shell: true });
  runChildren.set(runId, child);
  const logStream = fs.createWriteStream(logFile, { flags: 'a' });
  child.stdout.on('data', (d: Buffer) => { logStream.write(d); broadcastLog(runId, d); });
  child.stderr.on('data', (d: Buffer) => { logStream.write(d); broadcastLog(runId, d); });
  child.on('close', (code: number) => {
    logStream.end();
    runChildren.delete(runId);
    // Update run status
    const idx = runsData.runs.findIndex(r => r.id === runId);
    if (idx >= 0) {
      // Do not override if canceled
      if (runsData.runs[idx].status !== 'canceled') {
        runsData.runs[idx].endedAt = new Date().toISOString();
        runsData.runs[idx].status = code === 0 ? 'passed' : 'failed';
        runsData.runs[idx].results = `Exit code: ${code}`;
      }
      writeJson<{ runs: Run[] }>(runsPath, runsData);
    }
  });

  // Respond immediately so UI can poll
  res.status(201).json({ message: 'Run started', run: running });
});

// Cancel a running test
app.post('/api/runs/:id/cancel', async (req: Request, res: Response) => {
  const { id } = req.params;
  const run = runsData.runs.find(r => r.id === id);
  if (!run) return res.status(404).json({ error: 'Run not found' });
  if (run.status !== 'running') return res.status(400).json({ error: 'Run is not running' });

  run.status = 'canceled';
  run.endedAt = new Date().toISOString();
  run.results = 'Canceled by user';
  writeJson<{ runs: Run[] }>(runsPath, runsData);

  canceledRuns.add(id);
  const child = runChildren.get(id);
  if (child) {
    try { child.kill('SIGTERM'); } catch {}
  }
  // Try to stop and remove the container (best-effort)
  const container = id.toLowerCase();
  try {
    const { exec } = require('child_process');
    exec(`docker rm -f ${container}`, () => {});
  } catch {}

  res.json({ canceled: id });
});

// Endpoint to fetch live logs
app.get('/api/runs/:id/logs', (req: Request, res: Response) => {
  const { id } = req.params;
  // Check if the run exists
  const run = runsData.runs.find(r => r.id === id);
  if (!run) return res.status(404).json({ error: 'Test run not found' });

  const logFile = path.join(dataDir, 'run_logs', `${id}.log`);
  try {
    const logs = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '';
    res.json({ logs, status: run.status });
  } catch (error) {
    console.error('Error reading logs for', id, error);
    res.status(500).json({ error: 'Error reading logs' });
  }
});

// Stream live logs via SSE
app.get('/api/runs/:id/logs/stream', (req: Request, res: Response) => {
  const { id } = req.params;
  const run = runsData.runs.find(r => r.id === id);
  if (!run) return res.status(404).json({ error: 'Run not found' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send current log snapshot
  try {
    const logFile = path.join(dataDir, 'run_logs', `${id}.log`);
    if (fs.existsSync(logFile)) {
      const current = fs.readFileSync(logFile, 'utf8');
      if (current) res.write(`data: ${JSON.stringify(current)}\n\n`);
    }
  } catch {}

  addClient(id, res);

  const heartbeat = setInterval(() => {
    try { res.write('event: ping\ndata: keep-alive\n\n'); } catch {}
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeClient(id, res);
  });

  function addClient(runId: string, r: Response) { if (!sseClients.has(runId)) sseClients.set(runId, new Set()); sseClients.get(runId)!.add(r); }
  function removeClient(runId: string, r: Response) { const set = sseClients.get(runId); if (set) { set.delete(r); if (set.size === 0) sseClients.delete(runId); } }
});

// Ask endpoint: returns an explanation (text) for a user's question. If the user explicitly
// asks for code (or the assistant detects a code request), return code or code snippets.
app.post('/api/ai/ask', async (req: Request, res: Response) => {
  const { projectId, prompt, preferCode } = req.body as any;
  if (!process.env.OPENAI_API_KEY) {
    return res.status(400).json({ error: 'OPENAI_API_KEY not configured in environment' });
  }

  try {
    if (!openaiClient) {
      initOpenAIClient();
      if (!openaiClient) throw new Error('OpenAI client not initialized');
    }

    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const systemPrompt = `You are a helpful software engineer and technical explainer. When asked a question, produce a clear, concise explanation. If the user requests code samples or the question implies code is required, return a small, focused code snippet and label it clearly. Keep answers readable and avoid extra prose.`;
    const userPrompt = `Question: ${prompt ?? ''}\nProject: ${projectId ?? 'none'}\nReturn code if the user requests it or if it is needed to answer. Otherwise, return a clear textual explanation.`;

    let answer = '';
    if (typeof openaiClient.createChatCompletion === 'function') {
      const response = await openaiClient.createChatCompletion({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      });
      answer = (response as any)?.data?.choices?.[0]?.message?.content ?? '';
    } else if (openaiClient?.chat && typeof openaiClient.chat.completions.create === 'function') {
      const response = await openaiClient.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      });
      answer = (response as any)?.choices?.[0]?.message?.content ?? '';
    } else {
      throw new Error('Unsupported OpenAI client');
    }

    // If preferCode flag is set and the assistant returned text that looks like JSON array
    // of files we might forward that verbatim; otherwise return the answer string.
    // For simplicity, we always return { answer } and the frontend can choose how to render it.
    res.json({ answer });
  } catch (err) {
    console.error('AI ask error', err);
    res.status(500).json({ error: (err as Error).message || String(err) });
  }
});

// 404 fallback
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

function findAvailablePort(startPort: number, callback: (port: number) => void) {
  const server = net.createServer();
  server.listen(startPort, () => {
    server.once('close', () => callback(startPort));
    server.close();
  });
  server.on('error', () => findAvailablePort(startPort + 1, callback));
}

findAvailablePort(3000, (availablePort) => {
  const port: number = Number(process.env.PORT) || availablePort;
  app.listen(port, host, () => {
    console.log(`Backend skeleton listening at http://${host}:${port}`);
    if (!process.env.PORT) {
      console.log(`Note: using port ${port} as 3000 was unavailable.`);
    }
  });
});
