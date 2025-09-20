import Head from 'next/head';
import Header from '../components/Header';
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { backendBase } from '../lib/api';

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
  const [expandedFailures, setExpandedFailures] = useState<Set<number>>(new Set());
  const sseRef = useRef<EventSource | null>(null);

  // Helper function to get project name by ID
  const getProjectName = (projectId: string): string => {
    const project = projects.find(p => p.id === projectId);
    return project?.name || projectId;
  };

  // Helper function to format ISO timestamp to HH:MM:SS
  const formatTime = (isoTimestamp: string): string => {
    if (!isoTimestamp) return '—';
    try {
      const date = new Date(isoTimestamp);
      return date.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });
    } catch {
      return '—';
    }
  };

  // Helper function to format status with proper capitalization
  const formatStatus = (status: string): string => {
    if (!status) return 'Unknown';
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  };
  
  const toggleFailureExpansion = (index: number) => {
    const newExpanded = new Set(expandedFailures);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedFailures(newExpanded);
  };

  // Helper function to get project name by ID
  function calculateTimeTaken(startedAt: string | null, endedAt: string | null, status: string): string {
    if (!startedAt) return '—';
    if (status === 'running') {
      const start = new Date(startedAt);
      const now = new Date();
      const diffMs = now.getTime() - start.getTime();
      const seconds = Math.floor(diffMs / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s (running)`;
      if (minutes > 0) return `${minutes}m ${seconds % 60}s (running)`;
      return `${seconds}s (running)`;
    }
    if (!endedAt) return '—';
    const start = new Date(startedAt);
    const end = new Date(endedAt);
    const diffMs = end.getTime() - start.getTime();
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  // Extract failed test details from logs
  function parseFailedTestDetails(text: string): Array<{testName: string, primaryError: string, detailError: string}> {
    if (!text) return [];
    const failedTests: Array<{testName: string, primaryError: string, detailError: string}> = [];
    
    // First, try to parse ERROR lines from "short test summary info" section (pytest abbreviated format)
    const shortSummaryMatch = text.match(/=+ short test summary info =+([\s\S]*?)(?:=+.*?=+|$)/i);
    if (shortSummaryMatch) {
      const shortSummarySection = shortSummaryMatch[1];
      const errorLines = shortSummarySection.match(/ERROR\s+([^\n]+)/g);
      if (errorLines) {
        errorLines.forEach(errorLine => {
          const match = errorLine.match(/ERROR\s+(.+?)\s+-\s+(.+)/);
          if (match) {
            const testName = match[1].trim();
            const errorMsg = match[2].trim();
            failedTests.push({
              testName: testName,
              primaryError: errorMsg,
              detailError: ''
            });
          }
        });
      }
    }
    
    // If we found ERROR lines from short summary, return those
    if (failedTests.length > 0) {
      return failedTests.slice(0, 10); // Limit to 10 most recent failures
    }
    
    // Fallback: Find the detailed ERRORS section - more detailed format
    const failuresSectionMatch = text.match(/=+ ERRORS =+([\s\S]*?)(?:=+ warnings summary =+|=+ short test summary info =+|=+ \d+ failed.*? =+|$)/i);
    if (!failuresSectionMatch) {
      return [];
    }
    
    const failuresSection = failuresSectionMatch[1];
    
    // Split by test name headers and process each part
    const lines = failuresSection.split('\n');
    let currentTest: {testName: string, primaryError: string, detailError: string} | null = null;
    let inTestSection = false;
    let contextLine = '';
    let eLines: string[] = [];
    
    for (const line of lines) {
      // Check if this line is a test header (underscores with test name)
      const testHeaderMatch = line.match(/^_{7,}\s+(.+?)\s+_{7,}$/);
      if (testHeaderMatch) {
        // Save previous test if any
        if (currentTest) {
          if (contextLine && eLines.length > 0) {
            currentTest.primaryError = contextLine;
            currentTest.detailError = eLines.join(' ');
          }
          if (currentTest.primaryError) {
            failedTests.push(currentTest);
          }
        }
        
        // Start new test
        currentTest = {
          testName: testHeaderMatch[1].trim(),
          primaryError: '',
          detailError: ''
        };
        contextLine = '';
        eLines = [];
        inTestSection = true;
        continue;
      }
      
      if (inTestSection) {
        // Look for the context line (file:line: in test_name format)
        if (line.match(/^\s*\S+\.py:\d+: in \w+/)) {
          // Extract the assertion line that follows
          const nextLineIndex = lines.indexOf(line) + 1;
          if (nextLineIndex < lines.length) {
            const assertionLine = lines[nextLineIndex].trim();
            contextLine = assertionLine;
          }
        }
        
        // Collect E lines if we're in a test section
        if (line.match(/^E\s+/)) {
          eLines.push(line.replace(/^E\s+/, '').trim());
        }
      }
    }
    
    // Don't forget the last test
    if (currentTest) {
      if (contextLine && eLines.length > 0) {
        currentTest.primaryError = contextLine;
        currentTest.detailError = eLines.join(' ');
      }
      if (currentTest.primaryError) {
        failedTests.push(currentTest);
      }
    }
    
    return failedTests.slice(0, 10); // Limit to 10 most recent failures
  }

  // Extract pass/fail counts from logs with common test runner patterns
  function parseCountsFromLogs(text: string): { passed: number | null; failed: number | null; total: number | null } {
    if (!text) return { passed: null, failed: null, total: null };
    
    // Pytest: "========================= X passed, Y failed, Z skipped in ... =========================" 
    // or "========================= X passed in ... ========================="
    // Also handle "X passed, Y warnings, Z errors" format
    const summaryLineMatch = /=+ (\d+) passed(?:, (\d+) failed)?(?:, \d+ (?:warning|skipped))?(?:, (\d+) errors?)? in [\d.]+s =+/i.exec(text);
    if (summaryLineMatch) {
      const p = parseInt(summaryLineMatch[1], 10);
      const f = summaryLineMatch[2] ? parseInt(summaryLineMatch[2], 10) : 0;
      const e = summaryLineMatch[3] ? parseInt(summaryLineMatch[3], 10) : 0;
      const totalFailed = f + e; // errors count as failures
      return { passed: p, failed: totalFailed, total: p + totalFailed };
    }
    
    // Pytest alternative format: "== X passed, Y failed, Z skipped in ... =="
    const summaryAltMatch = /==+ (\d+) passed(?:, (\d+) failed)?(?:, \d+ (?:warning|skipped))?(?:, (\d+) errors?)? in [\d.]+s ==+/i.exec(text);
    if (summaryAltMatch) {
      const p = parseInt(summaryAltMatch[1], 10);
      const f = summaryAltMatch[2] ? parseInt(summaryAltMatch[2], 10) : 0;
      const e = summaryAltMatch[3] ? parseInt(summaryAltMatch[3], 10) : 0;
      const totalFailed = f + e; // errors count as failures
      return { passed: p, failed: totalFailed, total: p + totalFailed };
    }
    
    // Pytest simple format: look for "X PASSED" and "Y FAILED" lines
    const simplePassedMatch = /(\d+) PASSED/i.exec(text);
    const simpleFailedMatch = /(\d+) FAILED/i.exec(text);
    if (simplePassedMatch || simpleFailedMatch) {
      const p = simplePassedMatch ? parseInt(simplePassedMatch[1], 10) : 0;
      const f = simpleFailedMatch ? parseInt(simpleFailedMatch[1], 10) : 0;
      return { passed: p, failed: f, total: p + f };
    }
    
    // Jest/Vitest: "Tests: 4 passed, 1 failed, 10 total" (order can vary)
    const testsTotalsMatch = /Tests?:\s*(?:(\d+)\s*passed)?[, ]*\s*(?:(\d+)\s*failed)?[, ]*\s*(\d+)\s*total/i.exec(text);
    if (testsTotalsMatch) {
      const p = testsTotalsMatch[1] ? parseInt(testsTotalsMatch[1], 10) : null;
      const f = testsTotalsMatch[2] ? parseInt(testsTotalsMatch[2], 10) : null;
      const t = testsTotalsMatch[3] ? parseInt(testsTotalsMatch[3], 10) : null;
      return { passed: p, failed: f, total: t };
    }
    
    // Mocha: "x passing" / "y failing"
    const passingCountMatch = /([0-9]+)\s+passing/i.exec(text);
    const failingCountMatch = /([0-9]+)\s+failing/i.exec(text);
    if (passingCountMatch || failingCountMatch) {
      const p = passingCountMatch ? parseInt(passingCountMatch[1], 10) : null;
      const f = failingCountMatch ? parseInt(failingCountMatch[1], 10) : (text.match(/Error:|AssertionError|failing/i) ? 1 : null);
      return { passed: p, failed: f, total: p != null && f != null ? p + f : null };
    }
    
    // dotnet: "Total tests: X. Passed: Y. Failed: Z. Skipped: K." (avoid 's' flag; use [\s\S])
    const structuredTotalsMatch = /Total tests:\s*(\d+)[\s\S]*?Passed:\s*(\d+)[\s\S]*?Failed:\s*(\d+)/i.exec(text);
    if (structuredTotalsMatch) {
      const t = parseInt(structuredTotalsMatch[1], 10), p = parseInt(structuredTotalsMatch[2], 10), f = parseInt(structuredTotalsMatch[3], 10);
      return { passed: p, failed: f, total: t };
    }
    
    // Maven/Surefire often prints "Tests run: X, Failures: Y, Errors: Z, Skipped: K"
    const testsRunSummaryMatch = /Tests run:\s*(\d+),\s*Failures:\s*(\d+),\s*Errors:\s*(\d+),\s*Skipped:\s*(\d+)/i.exec(text);
    if (testsRunSummaryMatch) {
      const run = parseInt(testsRunSummaryMatch[1], 10), failures = parseInt(testsRunSummaryMatch[2], 10), errors = parseInt(testsRunSummaryMatch[3], 10);
      return { passed: run - failures - errors, failed: failures + errors, total: run };
    }
    
    // Fallback unknown
    return { passed: null, failed: null, total: null };
  }

  // Extract build/setup error messages from logs
  function extractBuildError(text: string): string | null {
    if (!text) return null;
    
    // Look for ERROR: and capture everything after it until newline
    const errorMatch = text.match(/ERROR:\s*(.+?)(?:\n|$)/);
    if (errorMatch) {
      return errorMatch[1].trim();
    }
    
    return null;
  }

  // Clear expanded failures when switching test runs
  useEffect(() => {
    setExpandedFailures(new Set());
  }, [selectedRunId]);

  // Fetch projects and test runs on component mount
  useEffect(() => {
    axios.get(`${backendBase}/api/projects`)
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

    axios.get(`${backendBase}/api/runs`)
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
    if (!selectedRunId) {
      setLogs(''); // Clear logs when no run is selected
      return;
    }
    
    // Force fresh start
    setLogs('');
    setExpandedFailures(new Set());
    
    const src = new EventSource(`${backendBase}/api/runs/${encodeURIComponent(selectedRunId)}/logs/stream`);
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
      axios.get(`${backendBase}/api/runs/${encodeURIComponent(selectedRunId)}/logs`).then((r: any) => setLogs(r.data?.logs || ''));
    };
    return () => { src.close(); sseRef.current = null; };
  }, [selectedRunId]);

  // Also refresh runs list every 5 seconds while autoRefresh is enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      axios.get(`${backendBase}/api/runs`)
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

    axios.post(`${backendBase}/api/runs/start`, { projectId: selectedProject })
      .then((response: any) => {
        const run = response?.data?.run;
        if (run?.id) {
          setSelectedRunId(run.id);
          setLogs(''); // Clear previous logs
        }
        // refresh runs immediately
        axios.get(`${backendBase}/api/runs`).then((r: { data: { runs: Run[] } }) => setTestRuns(r.data?.runs ?? []));
      })
      .catch((error: any) => {
        console.error('Error starting test run:', error);
        alert('Failed to start test run.');
      });
  };

  const handleFetchLogs = (runId: string) => {
    setLogs('');
    setExpandedFailures(new Set()); // Clear expanded failure details
    setSelectedRunId(runId);
  };

  const handleCancel = (runId: string) => {
    axios.post(`${backendBase}/api/runs/${encodeURIComponent(runId)}/cancel`).then(() => {
      // refresh list
      axios.get(`${backendBase}/api/runs`).then((r: { data: { runs: Run[] } }) => setTestRuns(r.data?.runs ?? []));
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
                    <button className="text-blue-700 hover:underline" onClick={() => handleFetchLogs(r.id)}>{r.id}</button>
                    <span className={r.status === 'passed' ? 'text-green-600' : (r.status === 'failed' ? 'text-red-600' : 'text-slate-600')}>{formatStatus(r.status)}</span>
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
                      <td><button className="text-blue-700 hover:underline" onClick={() => handleFetchLogs(run.id)}>{run.id}</button></td>
                      <td>{getProjectName(run.projectId)}</td>
                      <td className="text-amber-600">{formatStatus(run.status)}</td>
                      <td>{formatTime(run.startedAt)}</td>
                      <td>{formatTime(run.endedAt) !== '—' ? formatTime(run.endedAt) : '-'}</td>
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
              // Only parse counts if test is completed or has meaningful logs
              const counts = (selected.status === 'running' && !logs.includes('passed')) 
                ? { passed: null, failed: null, total: null } 
                : parseCountsFromLogs(logs);
              const failedDetails = parseFailedTestDetails(logs);
              const buildError = selected.status === 'failed' ? extractBuildError(logs) : null;
              const timeTaken = calculateTimeTaken(selected.startedAt, selected.endedAt, selected.status);
              
              return (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Run:</span>
                    <span>{selected.id}</span>
                    <span className="px-2 py-0.5 rounded text-white text-xs ml-2" style={{ backgroundColor: selected.status === 'passed' ? '#16a34a' : selected.status === 'failed' ? '#dc2626' : '#a3a3a3' }}>{formatStatus(selected.status)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-slate-500">Project</div>
                      <div>{getProjectName(selected.projectId)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Tool</div>
                      <div>{(selected as any).tool || 'Docker'}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Start</div>
                      <div>{formatTime(selected.startedAt)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">End</div>
                      <div>{formatTime(selected.endedAt)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Time Taken</div>
                      <div className="font-medium">{timeTaken}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Status</div>
                      <div className={`font-medium ${
                        selected.status === 'passed' ? 'text-green-600' : 
                        selected.status === 'failed' ? 'text-red-600' : 
                        selected.status === 'running' ? 'text-blue-600' : 'text-slate-600'
                      }`}>
                        {selected.status === 'running' ? 'Test in progress...' : formatStatus(selected.status)}
                      </div>
                      {buildError && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs">
                          <div className="font-medium text-red-700 mb-1">Error Message:</div>
                          <div className="text-red-600 font-mono text-xs break-words">{buildError}</div>
                        </div>
                      )}
                    </div>
                  </div>
                  {(() => {
                    const p = counts.passed;
                    const fParser = counts.failed;
                    const fDetails = failedDetails && failedDetails.length > 0 ? failedDetails.length : null;

                    // Prefer failure details when parser failed is null or zero but details exist
                    const failedNum = (fParser === null || fParser === 0) && fDetails ? fDetails : fParser;

                    // Compute total as Passed + Failed when either side is known
                    const totalFromParts = (p !== null || failedNum !== null) ? ((p ?? 0) + (failedNum ?? 0)) : null;
                    const totalNum = totalFromParts !== null ? totalFromParts : (counts.total ?? null);

                    const passedDisplay = (selected.status === 'running' && p === null) ? '...' : (p ?? '—');
                    const failedDisplay = (selected.status === 'running' && failedNum === null) ? '...' : (failedNum ?? '—');
                    const totalDisplay = (selected.status === 'running' && totalNum === null) ? '...' : (totalNum ?? '—');

                    return (
                      <div className="grid grid-cols-3 gap-3 mt-2">
                        <div className="p-3 rounded border bg-green-50">
                          <div className="text-slate-600 text-xs">Tests Passed</div>
                          <div className="text-2xl font-semibold text-green-700">{passedDisplay}</div>
                        </div>
                        <div className="p-3 rounded border bg-red-50">
                          <div className="text-slate-600 text-xs">Tests Failed</div>
                          <div className="text-2xl font-semibold text-red-700">{failedDisplay}</div>
                        </div>
                        <div className="p-3 rounded border bg-slate-50">
                          <div className="text-slate-600 text-xs">Total</div>
                          <div className="text-2xl font-semibold text-slate-800">{totalDisplay}</div>
                        </div>
                      </div>
                    );
                  })()}
                  {failedDetails.length > 0 && selected.status === 'failed' && (
                    <div key={selectedRunId} className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                      <div className="text-red-700 font-medium text-sm mb-3">Failed Test Details:</div>
                      <div className="space-y-3 text-sm">
                        {failedDetails.map((failure, idx) => (
                          <div key={idx} className="bg-white border border-red-200 p-3 rounded">
                            <div className="font-medium text-red-800 mb-2">
                              {failure.testName}
                            </div>
                            <div className="text-gray-700 mb-2 font-mono text-sm">
                              {failure.primaryError}
                            </div>
                            {failure.detailError && (
                              <div>
                                <button
                                  onClick={() => toggleFailureExpansion(idx)}
                                  className="text-blue-600 hover:text-blue-800 text-sm underline mb-2"
                                >
                                  {expandedFailures.has(idx) ? '▼ Hide error details' : '▶ Show error details'}
                                </button>
                                {expandedFailures.has(idx) && (
                                  <div className="font-mono text-sm text-red-600 bg-red-50 p-3 rounded mt-2 border-l-4 border-red-300">
                                    {failure.detailError}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {selected.results && !selected.results.startsWith('Exit code:') && (
                    <div>
                      <div className="text-slate-500">Result</div>
                      <div>{selected.results}</div>
                    </div>
                  )}
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
