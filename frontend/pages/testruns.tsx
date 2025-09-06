import Head from 'next/head';
import Header from '../components/Header';
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

// Define the Project type
interface Project {
  id: string;
  name: string;
}

// Define the Run type
interface Run {
  id: string;
  projectId: string;
  status: string;
  startedAt: string;
  endedAt: string;
  results: string;
}


export default function TestRuns() {
  const [selectedProject, setSelectedProject] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [testRuns, setTestRuns] = useState<Run[]>([]);
  const [logs, setLogs] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  
  // Extract pass/fail counts from logs with common test runner patterns
  function parseCountsFromLogs(text: string): { passed: number | null; failed: number | null; total: number | null } {
    if (!text) return { passed: null, failed: null, total: null };
    // Jest/Vitest: "Tests: 4 passed, 1 failed, 10 total" (order can vary)
    const jest = /Tests?:\s*(?:(\d+)\s*passed)?[, ]*\s*(?:(\d+)\s*failed)?[, ]*\s*(\d+)\s*total/i.exec(text);
    if (jest) {
      const p = jest[1] ? parseInt(jest[1], 10) : null;
      const f = jest[2] ? parseInt(jest[2], 10) : null;
      const t = jest[3] ? parseInt(jest[3], 10) : null;
      return { passed: p, failed: f, total: t };
    }
    // Mocha: "x passing" / "y failing"
    const mochaPass = /([0-9]+)\s+passing/i.exec(text);
    const mochaFail = /([0-9]+)\s+failing/i.exec(text);
    if (mochaPass || mochaFail) {
      const p = mochaPass ? parseInt(mochaPass[1], 10) : null;
      const f = mochaFail ? parseInt(mochaFail[1], 10) : (text.match(/Error:|AssertionError|failing/i) ? 1 : null);
      return { passed: p, failed: f, total: p != null && f != null ? p + f : null };
    }
    // Pytest: "== X passed, Y failed, Z skipped in ... =="
    const pytest = /==+\s*(?:(\d+)\s+passed)?(?:,\s*)?(?:(\d+)\s+failed)?(?:,\s*)?(?:(\d+)\s+skipped)?[^=]*==/i.exec(text);
    if (pytest) {
      const p = pytest[1] ? parseInt(pytest[1], 10) : null;
      const f = pytest[2] ? parseInt(pytest[2], 10) : null;
      const s = pytest[3] ? parseInt(pytest[3], 10) : 0;
      return { passed: p, failed: f, total: (p ?? 0) + (f ?? 0) + s || null };
    }
    // dotnet: "Total tests: X. Passed: Y. Failed: Z. Skipped: K." (avoid 's' flag; use [\s\S])
    const dotnet = /Total tests:\s*(\d+)[\s\S]*?Passed:\s*(\d+)[\s\S]*?Failed:\s*(\d+)/i.exec(text);
    if (dotnet) {
      const t = parseInt(dotnet[1], 10), p = parseInt(dotnet[2], 10), f = parseInt(dotnet[3], 10);
      return { passed: p, failed: f, total: t };
    }
    // Maven/Surefire often prints "Tests run: X, Failures: Y, Errors: Z, Skipped: K"
    const surefire = /Tests run:\s*(\d+),\s*Failures:\s*(\d+),\s*Errors:\s*(\d+),\s*Skipped:\s*(\d+)/i.exec(text);
    if (surefire) {
      const run = parseInt(surefire[1], 10), failures = parseInt(surefire[2], 10), errors = parseInt(surefire[3], 10);
      return { passed: run - failures - errors, failed: failures + errors, total: run };
    }
    // Fallback unknown
    return { passed: null, failed: null, total: null };
  }
  const sseRef = useRef<EventSource | null>(null);

  // Fetch projects and test runs on component mount
  useEffect(() => {
    axios.get('/api/projects')
      .then((response: { data: { projects: Project[] } }) => {
        if (response.data && response.data.projects) {
          setProjects(response.data.projects);
        } else {
          console.error('Invalid response structure:', response);
          setProjects([]);
        }
      })
      .catch((error: any) => {
        console.error('Error fetching projects:', error);
        setProjects([]);
      });

    axios.get('/api/runs')
      .then((response: { data: { runs: Run[] } }) => {
        if (response.data && response.data.runs) {
          setTestRuns(response.data.runs);
        } else {
          console.error('Invalid response structure:', response);
          setTestRuns([]);
        }
      })
      .catch((error: any) => {
        console.error('Error fetching test runs:', error);
        setTestRuns([]);
      });
  }, []);

  // Logs streaming via SSE
  useEffect(() => {
    // Close previous stream
    if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
    if (!selectedRunId) return;
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
    const src = new EventSource(`${backendUrl}/api/runs/${encodeURIComponent(selectedRunId)}/logs/stream`);
    sseRef.current = src;
    src.onmessage = (ev) => {
      try {
        const chunk = JSON.parse(ev.data);
        setLogs((prev) => (prev ? prev + chunk : chunk));
      } catch {
        setLogs((prev) => (prev ? prev + ev.data : ev.data));
      }
    };
    src.onerror = () => {
      // Fallback: fetch once if stream errors
      axios.get(`/api/runs/${encodeURIComponent(selectedRunId)}/logs`).then((r: any) => setLogs(r.data?.logs || ''));
    };
    return () => { src.close(); sseRef.current = null; };
  }, [selectedRunId]);

  // Also refresh runs list every 5 seconds while autoRefresh is enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      axios.get('/api/runs')
        .then((response: { data: { runs: Run[] } }) => {
          setTestRuns(response.data?.runs ?? []);
        })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleStartTestRun = () => {
    if (!selectedProject) {
      alert('Please select a project to start the test run.');
      return;
    }

    axios.post('/api/runs/start', { projectId: selectedProject })
      .then((response: any) => {
        const run = response?.data?.run;
        if (run?.id) setSelectedRunId(run.id);
        // refresh runs immediately
        axios.get('/api/runs').then((r: { data: { runs: Run[] } }) => setTestRuns(r.data?.runs ?? []));
      })
      .catch((error: any) => {
        console.error('Error starting test run:', error);
        alert('Failed to start test run.');
      });
  };

  const handleFetchLogs = (runId: string) => {
    setLogs('');
    setSelectedRunId(runId);
  };

  const handleCancel = (runId: string) => {
    axios.post(`/api/runs/${encodeURIComponent(runId)}/cancel`).then(() => {
      // refresh list
      axios.get('/api/runs').then((r: { data: { runs: Run[] } }) => setTestRuns(r.data?.runs ?? []));
    }).catch((e:any) => {
      console.error('Cancel failed', e);
      alert('Failed to cancel run');
    });
  };

  return (
    <>
      <Head>
        <title>Test Runs & Scheduling</title>
      </Head>
      <Header />
      <main className="container py-8">
        <h1 className="text-2xl font-bold mb-4">Test Runs & Scheduling</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 card p-6">
            <h3 className="font-semibold mb-3">New Test Run</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select
                className="border px-3 py-2 rounded"
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
              >
                <option value="">Select a project</option>
                {projects && projects.length > 0 ? (
                  projects.map((project: Project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))
                ) : (
                  <option disabled>No projects available</option>
                )}
              </select>
              <select className="border px-3 py-2 rounded">
                <option>Select a test suite</option>
              </select>
            </div>

            <div className="mt-4">
              <div className="flex gap-2">
                <button className="px-3 py-2 bg-blue-600 text-white rounded" onClick={handleStartTestRun}>Run Now</button>
                <button className="px-3 py-2 border rounded">Schedule for Later</button>
                <button className="px-3 py-2 border rounded">Recurring</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <input className="border px-3 py-2 rounded" placeholder="mm/dd/yyyy" />
                <input className="border px-3 py-2 rounded" placeholder="--:-- --" />
              </div>

              <div className="mt-4 text-right">
                <button
                  className="px-4 py-2 bg-blue-600 text-white rounded"
                  onClick={handleStartTestRun}
                >
                  Start Test Run
                </button>
              </div>
            </div>
          </div>

          <aside className="card p-6">
            <h3 className="font-semibold mb-3">Past Test Runs</h3>
            <ul className="space-y-3 text-sm text-slate-700">
              {testRuns.length > 0 ? (
                [...testRuns].filter(r => r.status !== 'running').slice(-10).reverse().map(r => (
                  <li key={r.id} className="flex justify-between">
                    <button className="text-blue-700 hover:underline" onClick={() => setSelectedRunId(r.id)}>{r.id}</button>
                    <span className={r.status === 'passed' ? 'text-green-600' : (r.status === 'failed' ? 'text-red-600' : 'text-slate-600')}>{r.status}</span>
                  </li>
                ))
              ) : (
                <li className="text-slate-500">No past runs</li>
              )}
            </ul>
          </aside>
        </div>
        <section className="mt-6 card p-4">
          <div className="">
            <h3 className="font-semibold mb-3">Ongoing Tests</h3>
            <table className="w-full text-left text-sm">
              <thead className="text-slate-500 text-xs">
                <tr><th>Run ID</th><th>Project</th><th>Status</th><th>Start</th><th>End</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {testRuns.filter(r => r.status === 'running').length > 0 ? (
                  testRuns.filter(r => r.status === 'running').map(run => (
                    <tr key={run.id} className="border-t">
                      <td><button className="text-blue-700 hover:underline" onClick={() => setSelectedRunId(run.id)}>{run.id}</button></td>
                      <td>{run.projectId}</td>
                      <td className="text-amber-600">{run.status}</td>
                      <td>{run.startedAt}</td>
                      <td>{run.endedAt || '-'}</td>
                      <td>
                        <button className="px-2 py-1 text-xs bg-red-600 text-white rounded" onClick={() => handleCancel(run.id)}>Cancel</button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={6} className="text-center text-gray-500">No ongoing runs</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-4">
            <h3 className="font-semibold mb-3">Test Run Details</h3>
            {(() => {
              const selected = testRuns.find(r => r.id === selectedRunId) || null;
              if (!selected) return (
                <div className="text-sm text-slate-500">Select a run from Past Test Runs or Ongoing Tests to see details.</div>
              );
              const counts = parseCountsFromLogs(logs);
              return (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Run:</span>
                    <span>{selected.id}</span>
                    <span className="px-2 py-0.5 rounded text-white text-xs ml-2" style={{ backgroundColor: selected.status === 'passed' ? '#16a34a' : selected.status === 'failed' ? '#dc2626' : '#a3a3a3' }}>{selected.status}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-slate-500">Project</div>
                      <div>{selected.projectId}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Tool</div>
                      <div>{(selected as any).tool || '—'}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Start</div>
                      <div>{selected.startedAt || '—'}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">End</div>
                      <div>{selected.endedAt || '—'}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-2">
                    <div className="p-3 rounded border bg-green-50">
                      <div className="text-slate-600 text-xs">Tests Passed</div>
                      <div className="text-2xl font-semibold text-green-700">{counts.passed ?? '—'}</div>
                    </div>
                    <div className="p-3 rounded border bg-red-50">
                      <div className="text-slate-600 text-xs">Tests Failed</div>
                      <div className="text-2xl font-semibold text-red-700">{counts.failed ?? '—'}</div>
                    </div>
                    <div className="p-3 rounded border bg-slate-50">
                      <div className="text-slate-600 text-xs">Total</div>
                      <div className="text-2xl font-semibold text-slate-800">{counts.total ?? '—'}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Result</div>
                    <div>{selected.results || '—'}</div>
                  </div>
                </div>
              );
            })()}
          </div>
          <div className="card p-4">
            <h3 className="font-semibold mb-3">Live Logs {selectedRunId ? `(for ${selectedRunId})` : ''}</h3>
            <div className="flex items-center mb-3">
              <input type="checkbox" checked={autoRefresh} onChange={() => setAutoRefresh(!autoRefresh)} className="mr-2" />
              <label>Auto-refresh (3s)</label>
            </div>
            <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto h-96">{logs || 'No logs available'}</pre>
          </div>
        </section>
      </main>
    </>
  );
}
