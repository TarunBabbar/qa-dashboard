import React, { useEffect, useState, useRef } from 'react';
import Head from 'next/head';
import { backendBase } from '../lib/api';

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

  // Theme (optional toggle here if you want)
  const [lightMode] = useState(true);

  // ChatGPT-like auto-resize textarea
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = '0px';
    const next = Math.min(el.scrollHeight, 200);
    el.style.height = next + 'px';
  }, [scenario]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  async function sendPrompt() {
  // use shared backendBase from lib/api
    const promptText = scenario;
    lastPromptRef.current = promptText;
    if (!promptText.trim()) return;
    setScenario('');
    setIsRunning(true);
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
      if (mode === 'agent') {
        try { parsed = typeof content === 'string' ? JSON.parse(content) : content; } catch { parsed = []; }
        setFiles(parsed ?? []);
      } else {
        setFiles([]);
      }
      setGenerated(prev => prev + 'AI: ' + (typeof content === 'string' ? content : JSON.stringify(content, null, 2)));

      if (mode === 'agent' && Array.isArray(parsed) && parsed.length > 0) {
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
  // use shared backendBase from lib/api
    try {
      const filesRes = await fetch(`${backendBase}/api/projects/${projectId}/files`);
      let existing: FileEntry[] = [];
      if (filesRes.ok) {
        const jf = await filesRes.json();
        existing = jf.files ?? [];
      }
      const existingPaths = new Set(existing.map(f => f.path));
      const summaryLines: string[] = [];
      parsedFiles.forEach(f => {
        if (existingPaths.has(f.path)) summaryLines.push(`UPDATE: ${f.path}`);
        else summaryLines.push(`CREATE: ${f.path}`);
      });
      setGenerated(prev => prev + '\n\nApply plan:\n' + summaryLines.join('\n'));

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
  // use shared backendBase from lib/api
    try {
      const checkRes = await fetch(`${backendBase}/api/projects/${projectId}/files`);
      let exists = false;
      if (checkRes.ok) {
        const jf = await checkRes.json();
        exists = Array.isArray(jf.files) && jf.files.some((x: FileEntry) => x.path === f.path);
      }
      setGenerated(prev => prev + `\n\nApplying file ${f.path} (${exists ? 'will UPDATE existing file' : 'will CREATE new file'})`);

      const res = await fetch(`${backendBase}/api/ai/apply-code`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, files: [f], message: `Applied single file ${f.path} (from prompt: ${lastPromptRef.current.slice(0,80)})` }) });
      const json = await res.json();
      if (res.ok) {
        setAppliedMap(m => ({ ...m, [f.path]: { applied: true, revertId: json.revertId } }));
        alert(`${exists ? 'Updated' : 'Created'} ${f.path}`);
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
  // use shared backendBase from lib/api
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
    <div className="app-root ide-page">
      <Head><title>AI Assistant - QA Dashboard</title></Head>
      <div className="main p-6 pt-3 pb-32 flex flex-col min-h-0">
        <h1 className="text-2xl font-semibold mb-4">AI Assistant</h1>

        {/* Scenario / Prompt */}
        <div className="mb-4 -mt-2" id="scenario-section">
          <label className="block text-sm font-medium">Scenario / Prompt</label>
          <div className="mt-0.5 flex gap-2 -mt-1">
            <div className="relative flex-1 flex flex-col min-h-0">
              {/* Simple mode toggle (dropdown preserved) */}
              <ModeMenu mode={mode} onChange={setMode} />

              {/* ChatGPT-style composer */}
              <div
                className={`mt-6 rounded-2xl border shadow-lg ring-1 p-2 sm:p-3
                  ${lightMode ? 'bg-white border-slate-200 ring-black/5' : 'bg-slate-800 border-slate-700 ring-white/5'}
                  focus-within:ring-blue-500/20`}
              >
                <div className="relative flex items-end gap-2">
                  <textarea
                    ref={taRef}
                    value={scenario}
                    onChange={e => setScenario(e.target.value)}
                    rows={1}
                    placeholder="Message… (Shift+Enter for newline)"
                    className={`block w-full resize-none border-0 bg-transparent outline-none text-[15px] leading-6 pr-10
                      ${lightMode ? 'text-slate-900 placeholder-slate-500' : 'text-slate-100 placeholder-slate-300'}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (!isRunning && scenario.trim()) sendPrompt();
                      }
                    }}
                  />
                  <div className="absolute right-1.5 bottom-1.5 sm:right-2 sm:bottom-2">
                    {!isRunning ? (
                      <button
                        onClick={sendPrompt}
                        disabled={!scenario.trim()}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition
                          ${scenario.trim()
                            ? (lightMode
                                ? 'text-blue-600 hover:bg-blue-50'
                                : 'text-blue-300 hover:bg-blue-900/40')
                            : (lightMode
                                ? 'text-slate-400 cursor-not-allowed'
                                : 'text-slate-500 cursor-not-allowed')
                          }`}
                        aria-label="Send"
                        title="Send (Enter)"
                      >
                        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                          <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                        </svg>
                      </button>
                    ) : (
                      <button
                        onClick={stopGeneration}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition
                          ${lightMode ? 'text-red-600 hover:bg-red-50' : 'text-red-300 hover:bg-red-900/40'}`}
                        aria-label="Stop"
                        title="Stop"
                      >
                        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* (kept) manual buttons, if you still want them beside the composer
                You can remove this column since Send/Stop are inline now. */}
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

        <section className="flex-1 min-h-0">
          <h2 className="text-lg font-medium">AI Assistant Output {mode === 'agent' && countdown ? `(auto-apply in ${countdown}s)` : ''}</h2>
          <div className="mt-2 border rounded-md p-3 bg-gray-50 flex flex-col min-h-0 ai-assistant-panel">
            <div className="chat-scroll-content flex-1 overflow-auto custom-scroll">
              <pre className="whitespace-pre-wrap text-sm">{generated || (isRunning ? 'Running...' : 'No output yet')}</pre>
            </div>
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
    </div>
  );
}

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
          {items.map((it) => (
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
