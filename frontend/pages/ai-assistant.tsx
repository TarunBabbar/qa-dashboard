import React, { useEffect, useState, useRef } from 'react';
import Head from 'next/head';

type FileEntry = { path: string; content: string };

export default function AIAssistantPage() {
  const [projectId, setProjectId] = useState<string>('proj-1');
  const [tool, setTool] = useState<string>('Playwright');
  const [language, setLanguage] = useState<string>('TypeScript');
  const [scenario, setScenario] = useState<string>('');
  const [mode, setMode] = useState<'ask' | 'agent'>('agent');
  const [isRunning, setIsRunning] = useState(false);
  const [generated, setGenerated] = useState<string>('');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [appliedMap, setAppliedMap] = useState<Record<string, { applied: boolean; revertId?: string }>>({});
  const [countdown, setCountdown] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastPromptRef = useRef<string>('');

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  async function sendPrompt() {
    const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
    const promptText = scenario; // capture before clearing
    lastPromptRef.current = promptText;
    setScenario(''); // clear textbox immediately after sending
    setIsRunning(true);
    // Echo user prompt into the output area (chat style)
    setGenerated(`You: ${promptText}\n\n`);
    setFiles([]);
    setAppliedMap({});
    setCountdown(null);
    abortControllerRef.current = new AbortController();
    try {
      const res = await fetch(`${backendBase}/api/ai/generate-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, tool, language, prompt: promptText }),
        signal: abortControllerRef.current.signal,
      });
      if (!res.ok) {
        const txt = await res.text();
        setGenerated(prev => prev + `Error: ${txt}`);
        setIsRunning(false);
        return;
      }
      const json = await res.json();
      const content = json.generatedCode ?? json.generatedCode ?? json.generated ?? json;
      let parsed: FileEntry[] = [];
      if (mode === 'agent') { // Only parse into files in Agent mode
        try {
          parsed = typeof content === 'string' ? JSON.parse(content) : content;
        } catch (e) {
          parsed = [];
        }
        setFiles(parsed ?? []);
      } else {
        setFiles([]);
      }
      setGenerated(prev => prev + 'AI: ' + (typeof content === 'string' ? content : JSON.stringify(content, null, 2)));

      if (mode === 'agent' && Array.isArray(parsed) && parsed.length > 0) {
        // Start 30s countdown to auto-apply all files unless the user acts
        setCountdown(30);
        timerRef.current = window.setInterval(() => {
          setCountdown(c => {
            if (c === null) return null;
            if (c <= 1) {
              if (timerRef.current) window.clearInterval(timerRef.current);
              timerRef.current = null;
              autoApplyAll(parsed, lastPromptRef.current);
              return null;
            }
            return c - 1;
          });
        }, 1000);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') setGenerated(prev => prev + 'Generation canceled by user');
      else setGenerated(prev => prev + 'Generation failed: ' + (err.message || String(err)));
    } finally {
      setIsRunning(false);
      abortControllerRef.current = null;
    }
  }

  function stopGeneration() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsRunning(false);
  }

  async function autoApplyAll(parsedFiles: FileEntry[], message?: string) {
    // Apply all files at once
    const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
    try {
      const res = await fetch(`${backendBase}/api/ai/apply-code`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, files: parsedFiles, message: message ?? lastPromptRef.current }) });
      const json = await res.json();
      if (res.ok) {
        const revertId = json.revertId as string | undefined;
        const map: Record<string, { applied: boolean; revertId?: string }> = {};
        parsedFiles.forEach(f => map[f.path] = { applied: true, revertId });
        setAppliedMap(map);
        alert('Auto-applied AI changes');
      } else {
        setGenerated(prev => prev + '\n\nAuto-apply error: ' + JSON.stringify(json));
      }
    } catch (err: any) {
      setGenerated(prev => prev + '\n\nAuto-apply failed: ' + (err.message || String(err)));
    }
  }

  async function applyFileNow(f: FileEntry) {
    const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
    try {
      const res = await fetch(`${backendBase}/api/ai/apply-code`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, files: [f], message: `Applied single file ${f.path} (from prompt: ${lastPromptRef.current.slice(0,80)})` }) });
      const json = await res.json();
      if (res.ok) {
        setAppliedMap(m => ({ ...m, [f.path]: { applied: true, revertId: json.revertId } }));
      } else {
        alert('Apply failed: ' + JSON.stringify(json));
      }
    } catch (err: any) {
      alert('Apply failed: ' + (err.message || String(err)));
    }
  }

  async function revertFile(f: FileEntry) {
    const info = appliedMap[f.path];
    if (!info?.revertId) {
      alert('No revert available for this file');
      return;
    }
    const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
    try {
      const res = await fetch(`${backendBase}/api/ai/revert`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revertId: info.revertId }) });
      if (res.ok) {
        setAppliedMap(m => ({ ...m, [f.path]: { applied: false } }));
        alert(`Reverted ${f.path}`);
      } else {
        const txt = await res.text();
        alert('Revert failed: ' + txt);
      }
    } catch (err: any) {
      alert('Revert failed: ' + (err.message || String(err)));
    }
  }

  return (
    <div className="p-6 pt-3 pb-32">
      <Head>
        <title>AI Assistant - QA Dashboard</title>
      </Head>
      <h1 className="text-2xl font-semibold mb-4">AI Assistant</h1>

      {/* Scenario / Prompt moved ABOVE settings to push it higher on the page */}
      <div className="mb-4 -mt-2" id="scenario-section">
        <label className="block text-sm font-medium">Scenario / Prompt</label>
        <div className="mt-0.5 flex gap-2 -mt-1">
          <div className="relative flex-1">
            {/* Mode dropdown (custom) */}
            <ModeMenu mode={mode} onChange={setMode} />
            <textarea
              value={scenario}
              onChange={e => setScenario(e.target.value)}
              rows={6}
              placeholder="Enter your prompt here... (Shift+Enter for new line)"
              className="w-full rounded-md border p-2 pt-8 resize-vertical focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="flex flex-col gap-2 pt-0.5">
            <button onClick={sendPrompt} disabled={isRunning} className="px-3 py-1 bg-blue-600 text-white rounded-md shadow disabled:opacity-50">Send</button>
            <button onClick={stopGeneration} disabled={!isRunning} className="px-3 py-1 bg-gray-200 rounded-md shadow disabled:opacity-50">Stop</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4" id="settings-section">
        <div>
          <label className="block text-sm font-medium">Project</label>
          <input value={projectId} onChange={e => setProjectId(e.target.value)} className="mt-1 block w-full rounded-md border px-2 py-1" />
        </div>
        <div>
          <label className="block text-sm font-medium">Tool</label>
          <select value={tool} onChange={e => setTool(e.target.value)} className="mt-1 block w-full rounded-md border px-2 py-1">
            <option>Playwright</option>
            <option>Selenium</option>
            <option>Cypress</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Language</label>
          <select value={language} onChange={e => setLanguage(e.target.value)} className="mt-1 block w-full rounded-md border px-2 py-1">
            <option>TypeScript</option>
            <option>JavaScript</option>
            <option>Java</option>
          </select>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-medium">AI Assistant Output {mode === 'agent' && countdown ? `(auto-apply in ${countdown}s)` : ''}</h2>
        <div className="mt-2 border rounded-md p-3 bg-gray-50">
          <pre className="whitespace-pre-wrap text-sm">{generated || (isRunning ? 'Running...' : 'No output yet')}</pre>
        </div>
      </section>

      {mode === 'agent' && (
        <section className="mt-4">
          <h2 className="text-lg font-medium">Files</h2>
          <div className="mt-2 grid gap-2">
            {files.length === 0 && <div className="text-sm text-gray-500">No files returned</div>}
            {files.map(f => (
              <details key={f.path} className="border rounded-md p-2 bg-white">
                <summary className="flex items-center justify-between">
                  <span className="font-mono text-sm">{f.path}</span>
                  <span className="flex gap-2">
                    <button onClick={() => applyFileNow(f)} className="px-2 py-1 bg-green-600 text-white text-xs rounded" disabled={!!appliedMap[f.path]?.applied}>Apply</button>
                    <button onClick={() => revertFile(f)} className="px-2 py-1 bg-red-500 text-white text-xs rounded" disabled={!appliedMap[f.path]?.applied}>Revert</button>
                  </span>
                </summary>
                <pre className="mt-2 whitespace-pre-wrap text-xs">{f.content}</pre>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// Lightweight custom dropdown menu to mimic VS Code Copilot style
function ModeMenu({ mode, onChange }: { mode: 'ask' | 'agent'; onChange: (m: 'ask' | 'agent') => void }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const items: { key: 'agent' | 'ask'; label: string }[] = [
    { key: 'agent', label: 'Agent' },
    { key: 'ask', label: 'Ask' },
  ];

  function selectItem(k: string) {
    if (k === 'agent' || k === 'ask') onChange(k as 'agent' | 'ask');
    setOpen(false);
  }

  return (
    <div ref={ref} className="absolute left-2 z-20" style={{ top: '-10px' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-2 h-7 rounded-md border bg-white text-xs font-medium shadow-sm hover:bg-slate-50 focus:outline-none"
      >
        {mode === 'agent' ? 'Agent' : 'Ask'}
        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path d="M5.5 7.5l4.5 4.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
      </button>
      {open && (
        <div className="mt-1 w-40 rounded-md border bg-[#1e1f22] text-white text-xs shadow-lg overflow-hidden">
          {items.map((it, idx) => (
            <div key={it.key}>
              <button
                className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-blue-600/70 ${it.key === mode ? 'bg-blue-700 text-white' : 'text-slate-200'}`}
                onClick={() => selectItem(it.key)}
              >
                {it.key === mode && (
                  <svg className="w-3 h-3" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 10l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                )}
                <span>{it.label}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
