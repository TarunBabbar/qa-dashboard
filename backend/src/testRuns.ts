import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { Run, RunsWrapper, Child } from './types';
import { readJson, writeJson, getDataPaths, ensureDirExists } from './utils';
import { prepareRunWorkspace } from './testPrep';

const router = Router();
const { runsPath } = getDataPaths();

// Load runs data
let runsData = readJson<RunsWrapper>(runsPath, { runs: [] });
if (!runsData || !Array.isArray(runsData.runs)) {
  runsData = { runs: [] };
}

// Test Run Orchestration: in-memory process tracking and SSE clients
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

function addClient(runId: string, r: Response) { 
  if (!sseClients.has(runId)) sseClients.set(runId, new Set()); 
  sseClients.get(runId)!.add(r); 
}

function removeClient(runId: string, r: Response) { 
  const set = sseClients.get(runId); 
  if (set) { 
    set.delete(r); 
    if (set.size === 0) sseClients.delete(runId); 
  } 
}

function detectTestCommand(workspacePath: string): string {
  // Check for common test frameworks and their configuration files
  if (fs.existsSync(path.join(workspacePath, 'package.json'))) {
    const packageJson = JSON.parse(fs.readFileSync(path.join(workspacePath, 'package.json'), 'utf8'));
    if (packageJson.scripts && packageJson.scripts.test) {
      return 'npm test';
    }
  }

  if (fs.existsSync(path.join(workspacePath, 'pytest.ini')) ||
      fs.existsSync(path.join(workspacePath, 'requirements.txt'))) {
    // Install deps if present, then start Xvfb for any UI/browser tests, then run pytest
    return 'python3 -m pip install -U pip && (test -f requirements.txt && pip install -r requirements.txt || true) && (Xvfb :99 -screen 0 1920x1080x24 & export DISPLAY=:99 && sleep 2; true) && (pytest -v || python3 -m pytest -v)';
  }

  if (fs.existsSync(path.join(workspacePath, 'pom.xml'))) {
    return 'mvn test';
  }

  if (fs.existsSync(path.join(workspacePath, 'build.gradle'))) {
    return 'gradle test';
  }

  if (fs.existsSync(path.join(workspacePath, 'Gemfile'))) {
    return 'bundle exec rspec';
  }

  if (fs.existsSync(path.join(workspacePath, 'go.mod'))) {
    return 'go test ./...';
  }

  if (fs.existsSync(path.join(workspacePath, 'Makefile'))) {
    return 'make test';
  }

  // Default to a no-op if no test command can be detected
  console.warn('No test command detected for workspace:', workspacePath);
  return 'echo "No test command detected"';
}

// Runs endpoints
router.get('/', (req: Request, res: Response) => {
  res.json({ runs: runsData.runs });
});

router.post('/', (req: Request, res: Response) => {
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
router.get('/:id', (req: Request, res: Response) => {
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
router.post('/start', async (req: Request, res: Response) => {
  const { projectId } = req.body;
  if (!projectId) return res.status(400).json({ error: 'Project ID is required' });

  // Note: This would need access to project data, we'll import it
  const { projectData } = await import('./projects');
  const project = projectData.projects.find(p => p.id === projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const { dataDir } = getDataPaths();
  
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
      const abs = path.join(runWorkspace, f.path.replace(/^\/+/g, ''));
      ensureDirExists(abs);
      fs.writeFileSync(abs, f.content ?? '', 'utf8');
    }
  } catch (e) {
    console.error('Failed to materialize project files for run', runId, e);
  }

  // Detect test command
  const testCmd = detectTestCommand(runWorkspace);

  // Prepare workspace (language-specific tweaks) and collect env to pass to runner
  const prep = await prepareRunWorkspace(runWorkspace);
  const envFlags = prep?.env
    ? Object.entries(prep.env)
        .map(([k, v]) => `-e ${k}="${String(v ?? '').replace(/"/g, '\\"')}"`)
        .join(' ')
    : '';

  // Spawn and stream logs
  const { spawn, exec } = require('child_process');
  const runnerMode = (process.env.RUNNER_MODE || 'docker').toLowerCase();
  const runnerContainer = process.env.RUNNER_CONTAINER; // e.g., qa-dashboard-tests
  let child: any;

  async function execPromise(cmd: string) {
    return new Promise<void>((resolve, reject) => {
      const p = exec(cmd, (err: any) => {
        if (err) reject(err); else resolve();
      });
      p.stdout?.on('data', (d: Buffer) => { try { fs.appendFileSync(logFile, d); } catch {} });
      p.stderr?.on('data', (d: Buffer) => { try { fs.appendFileSync(logFile, d); } catch {} });
    });
  }

  if (runnerContainer) {
    // Use existing long-lived container; copy workspace in, then exec tests via a script to avoid quoting issues
    const container = runnerContainer;
    const hostWs = process.platform === 'win32' ? runWorkspace.replace(/\\/g, '/') : runWorkspace;
    const srcWithDot = `${hostWs}${hostWs.endsWith('/') ? '' : '/'}.`;

    // Write a script into the workspace which exports env and runs the test command
    try {
      const envLines: string[] = [];
      const prepEnv = prep?.env || {};
      for (const [k, v] of Object.entries(prepEnv)) envLines.push(`export ${k}=${JSON.stringify(String(v ?? ''))}`);
      // Decide if pytest-bdd is needed (quick heuristic)
      const needsBdd = (() => {
        try {
          const req = path.join(runWorkspace, 'requirements.txt');
          if (fs.existsSync(req)) {
            const t = fs.readFileSync(req, 'utf8').toLowerCase();
            if (t.includes('pytest-bdd')) return true;
          }
        } catch {}
        try {
          const all = (function walk(dir: string, out: string[] = []): string[] {
            if (!fs.existsSync(dir)) return out;
            for (const e of fs.readdirSync(dir)) {
              const p = path.join(dir, e);
              const s = fs.statSync(p);
              if (s.isDirectory()) walk(p, out); else out.push(p);
            }
            return out;
          })(runWorkspace, []);
          const py = all.filter(p => p.endsWith('.py'));
          for (const f of py) {
            const txt = fs.readFileSync(f, 'utf8');
            if (/from\s+pytest_bdd\s+import|import\s+pytest_bdd|scenarios\s*\(/.test(txt)) return true;
          }
        } catch {}
        return false;
      })();
      const pytestCmd = needsBdd
        ? 'if [ -x /opt/venv/bin/python ]; then /opt/venv/bin/python -m pytest -p pytest_bdd -v; else pytest -p pytest_bdd -v; fi'
        : 'if [ -x /opt/venv/bin/python ]; then /opt/venv/bin/python -m pytest -v; else pytest -v; fi';
      const script = [
        '#!/usr/bin/env bash',
        'set -euo pipefail',
        'cd /workspace',
        ...envLines,
        'if [ -x /opt/venv/bin/python ]; then /opt/venv/bin/python -m pip install -U pip; else python3 -m pip install -U pip; fi',
        'if [ -f requirements.txt ]; then if [ -x /opt/venv/bin/python ]; then /opt/venv/bin/python -m pip install -r requirements.txt; else python3 -m pip install -r requirements.txt; fi; fi',
        '(Xvfb :99 -screen 0 1920x1080x24 & export DISPLAY=:99 && sleep 2) || true',
        pytestCmd
      ].join('\n');
      fs.writeFileSync(path.join(runWorkspace, '.qa-run.sh'), script.replace(/\r\n/g, '\n'), 'utf8');
    } catch {}

    const prepCmd = `docker exec ${container} /bin/bash -lc "mkdir -p /workspace && rm -rf /workspace/* || true"`;
    const cpCmd = `docker cp "${srcWithDot}" ${container}:/workspace`;
    const execCmd = `docker exec -w /workspace ${container} /bin/bash -lc "chmod +x /workspace/.qa-run.sh && /workspace/.qa-run.sh"`;
    try { fs.appendFileSync(logFile, `\n[runner] mode=container name=${container}\n[runner] prep=${prepCmd}\n[runner] copy=${cpCmd}\n[runner] exec=${execCmd}\n`); } catch {}
    try {
      await execPromise(prepCmd);
      await execPromise(cpCmd);
    } catch (e) {
      try { fs.appendFileSync(logFile, `\n[runner] prep/copy failed: ${String((e as any)?.message || e)}\n`); } catch {}
    }
    child = spawn(execCmd, { shell: true });
  } else if (runnerMode === 'local') {
    const cmd = `/bin/bash -lc "${testCmd}"`;
    try { fs.appendFileSync(logFile, `\n[runner] mode=local cwd=${runWorkspace}\n[runner] cmd=${cmd}\n`); } catch {}
    child = spawn(cmd, { shell: true, cwd: runWorkspace, env: { ...process.env, ...(prep?.env || {}) } });
  } else {
    const runnerImage = process.env.RUNNER_IMAGE || 'qa-dashboard:latest';
    const wsMount = process.platform === 'win32' ? runWorkspace.replace(/\\/g, '/') : runWorkspace;
    const dockerCmd = `docker run --rm -v "${wsMount}:/workspace" -w /workspace ${envFlags} --name ${runId.toLowerCase()} ${runnerImage} /bin/bash -lc "${testCmd}"`;
    try { fs.appendFileSync(logFile, `\n[runner] mode=docker image=${runnerImage}\n[runner] cmd=${dockerCmd}\n`); } catch {}
    child = spawn(dockerCmd, { shell: true });
  }
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
router.post('/:id/cancel', async (req: Request, res: Response) => {
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
router.get('/:id/logs', (req: Request, res: Response) => {
  const { id } = req.params;
  // Check if the run exists
  const run = runsData.runs.find(r => r.id === id);
  if (!run) return res.status(404).json({ error: 'Test run not found' });

  const { dataDir } = getDataPaths();
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
router.get('/:id/logs/stream', (req: Request, res: Response) => {
  const { id } = req.params;
  const run = runsData.runs.find(r => r.id === id);
  if (!run) return res.status(404).json({ error: 'Run not found' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send current log snapshot
  try {
    const { dataDir } = getDataPaths();
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
});

// Admin endpoint to clean up orphaned runs
router.post('/cleanup', async (req: Request, res: Response) => {
  try {
    const { projectData } = await import('./projects');
    const existingProjectIds = projectData.projects.map(p => p.id);
    const removedCount = cleanupOrphanedRuns(existingProjectIds);
    
    res.json({ 
      message: 'Cleanup completed', 
      orphanedRunsRemoved: removedCount 
    });
  } catch (error) {
    console.error('Error during manual cleanup:', error);
    res.status(500).json({ error: 'Cleanup failed' });
  }
});

// Function to clean up runs for deleted projects
export function cleanupRunsForProject(projectId: string): number {
  const removedRuns = runsData.runs.filter(r => r.projectId === projectId);
  runsData.runs = runsData.runs.filter(r => r.projectId !== projectId);
  writeJson<{ runs: Run[] }>(runsPath, runsData);
  return removedRuns.length;
}

// Function to clean up orphaned runs (runs that reference non-existent projects)
export function cleanupOrphanedRuns(existingProjectIds: string[]): number {
  const initialCount = runsData.runs.length;
  runsData.runs = runsData.runs.filter(r => existingProjectIds.includes(r.projectId));
  writeJson<{ runs: Run[] }>(runsPath, runsData);
  const removedCount = initialCount - runsData.runs.length;
  if (removedCount > 0) {
    console.log(`Cleaned up ${removedCount} orphaned test runs`);
  }
  return removedCount;
}

export default router;
export { runsData };
