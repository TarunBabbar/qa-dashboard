import Head from 'next/head';
import Header from '../components/Header';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import React from "react";
const SplitPane = require('react-split-pane').default;
import { getProject } from '../lib/api';
import Highlight, { defaultProps, Language } from 'prism-react-renderer';
import vsDarkTheme from 'prism-react-renderer/themes/vsDark';
import githubTheme from 'prism-react-renderer/themes/github';
import vsDarkPlus from 'prism-react-renderer/themes/vsDark';
import { Sun, Moon } from "lucide-react";


// ---------- Small UI helpers ----------
function Chevron({ open, size = 12, lightMode }: { open: boolean, size?: number, lightMode: boolean }) {
  const style = { transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.12s ease-in-out', display: 'inline-block' } as React.CSSProperties;
  const fill = lightMode ? '#334155' : '#cbd5e1';
  return (
    <svg style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 6L15 12L9 18" stroke={fill} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type FileItem = { path: string; content?: string };

// ---------- Markdown / code block rendering ----------
function parseFencedCodeBlocks(text: string) {
  const parts: { type: 'text'|'code'; content: string; lang?: string }[] = [];
  if (!text) return parts;
  const regex = /```(\w+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    const idx = m.index;
    if (idx > lastIndex) {
      parts.push({ type: 'text', content: text.substring(lastIndex, idx) });
    }
    parts.push({ type: 'code', content: m[2], lang: (m[1] || undefined) });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push({ type: 'text', content: text.substring(lastIndex) });
  return parts;
}

function AIAnswerRenderer({ answer, lightMode }: { answer: string; lightMode: boolean }) {
  // Strip visible "You:" / "AI:" prefixes if they exist in raw text
  const cleaned = (answer || '')
    .replace(/^You:\s*/i, '')
    .replace(/\n?^AI:\s*/i, '');

  const parts = parseFencedCodeBlocks(cleaned);

  function detectLanguage(code: string): Language {
    const s = code.slice(0, 400).toLowerCase();
    if (/^\s*<!doctype|<html|<\w+/.test(code)) return 'markup';
    if (/\bdef\s+\w+\(|import\s+selenium|from\s+selenium/.test(s)) return 'python';
    if (/console\.log\(|\bfunction\s+\w+\(|=>|\bconst\s+\w+|document\.|window\./.test(s)) return 'javascript';
    if (/import\s+React|jsx|tsx|class\s+\w+\s+extends\s+React/.test(code)) return 'typescript';
    if (/package.json|npm install|require\(|module\.exports/.test(s)) return 'javascript';
    if (/public static void main|System\.out\.println|import java\./.test(s)) return 'markup';
    if (/using\s+System;|namespace\s+\w+;/.test(s)) return 'markup';
    if (/SELECT\s+\*|INSERT INTO|CREATE TABLE/.test(s)) return 'sql';
    return 'javascript';
  }

  function renderRichText(content: string, key: number) {
  const paragraphs = content.replace(/\r/g, '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  return paragraphs.map((p, idx) => {
    const lines = p.split(/\n/).map(l => l.trim()).filter(Boolean);

    // Ordered list: all lines start with "1. ", "2. " etc.
    if (lines.length > 1 && lines.every(l => /^\d+\.\s+/.test(l))) {
      const items = lines.map(l => l.replace(/^\d+\.\s*/, ''));
      return (
        <ol key={`ol-${key}-${idx}`} className={`list-decimal ml-5 text-sm leading-relaxed ${lightMode ? 'text-slate-700' : 'text-slate-200'}`}>
          {items.map((it, i2) => <li key={i2} className="mb-1">{it}</li>)}
        </ol>
      );
    }

    // Unordered list: all lines start with "-", "*", or "+"
    if (lines.length > 1 && lines.every(l => /^[-*+]\s+/.test(l))) {
      const items = lines.map(l => l.replace(/^[-*+]\s*/, ''));
      return (
        <ul key={`ul-${key}-${idx}`} className={`list-disc ml-5 text-sm leading-relaxed ${lightMode ? 'text-slate-700' : 'text-slate-200'}`}>
          {items.map((it, i2) => <li key={i2} className="mb-1">{it}</li>)}
        </ul>
      );
    }

    // Otherwise, just a normal paragraph
    return (
      <p key={`p-${key}-${idx}`} className={`text-sm leading-relaxed whitespace-pre-wrap ${lightMode ? 'text-slate-700' : 'text-slate-200'}`}>
        {p}
      </p>
    );
  });
}

  if (!parts || parts.length === 0)
    return <div className={`text-sm ${lightMode ? 'text-slate-800' : 'text-slate-200'}`}>{answer}</div>;

  return (
    <div className="space-y-3">
      {parts.map((p, i) => {
        if (p.type === 'text') {
          // Assistant plain text (no bubble)
          return (
            <div
              key={i}
              className={`text-sm ${lightMode ? 'text-slate-800' : 'text-slate-200'}`}
              style={{ lineHeight: 1.6, wordWrap: 'break-word', overflowWrap: 'break-word' }}
            >
              {renderRichText(p.content || '', i)}
            </div>
          );
        }
        const lang = (p.lang as Language) || detectLanguage(p.content || '');
        return (
          <div
            key={i}
            className={`rounded-lg overflow-hidden ${lightMode ? 'bg-slate-50 border border-slate-200' : 'bg-slate-800 border border-slate-700'}`}
            style={{ position: 'relative', maxWidth: '100%' }}
          >
            <button
              onClick={async () => { try { await navigator.clipboard.writeText(p.content || ''); } catch { const ta = document.createElement('textarea'); ta.value = p.content || ''; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); } }}
              className="code-copy-button"
              title="Copy code"
            >Copy</button>
            <Highlight {...defaultProps} code={p.content || ''} language={lang} theme={lightMode ? githubTheme : vsDarkTheme}>
              {(renderProps: any) => {
                const { className, style, tokens, getLineProps, getTokenProps } = renderProps;
                return (
                  <pre
                    className={className + ' text-sm p-3 overflow-auto'}
                    style={{ ...style, margin: 0, background: 'transparent', color: 'var(--vscode-text)', fontSize: 12, paddingTop: 16, maxWidth: '100%' }}
                  >
                    {tokens.map((line: any[], i2: number) => (
                      <div key={`c-${i}-${i2}`} {...getLineProps({ line, key: i2 })} style={{ display: 'table-row' }}>
                        <div style={{ display: 'table-cell', textAlign: 'right', paddingRight: 12, userSelect: 'none', opacity: 0.5, width: 40, fontFamily: 'monospace', fontSize: 11 }}>{i2 + 1}</div>
                        <div style={{ display: 'table-cell' }}>
                          {line.map((token: any, key: number) => (
                            <span key={`token-${i}-${i2}-${key}`} {...getTokenProps({ token, key })} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </pre>
                );
              }}
            </Highlight>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Page ----------
type ChatMsg = { role: 'user' | 'assistant'; content: string };

export default function IDEPage() {

  const [folderOpen, setFolderOpen] = useState<Record<string, boolean>>({});

// toggle helper
const toggleFolder = (name: string) => {
  setFolderOpen(prev => ({ ...prev, [name]: !prev[name] }));
};

  const INPUT_VERTICAL_OFFSET = 60;

  // Chat/agent UI state
  const [mode, setMode] = useState<'agent' | 'ask'>('agent');
  const [scenario, setScenario] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]); // <GÇö NEW: Chat array
  const [aiFiles, setAiFiles] = useState<{ path: string; content: string }[]>([]);
  const [appliedMap, setAppliedMap] = useState<Record<string, { applied: boolean; revertId?: string }>>({});
  const [countdown, setCountdown] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Chat scroll ref
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Composer auto-resize
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = '0px';
    const next = Math.min(el.scrollHeight, 200);
    el.style.height = next + 'px';
  }, [scenario]);

  // File explorer / editor state
  const { query } = useRouter();
  const projectId = query.projectId as string | undefined;
  const [projectName, setProjectName] = useState<string | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFile, setActiveFile] = useState<FileItem | null>(null);

  // Move UI
  const [moveTargetOpenFor, setMoveTargetOpenFor] = useState<string | null>(null);
  const [moveSourceType, setMoveSourceType] = useState<'file' | 'folder' | null>(null);
  const [draggedFilePath, setDraggedFilePath] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);

  // Theme
  const [lightMode, setLightMode] = useState(true);
  const [modeMenuOpen] = useState(false);

  // Load project
  useEffect(() => {
    if (!projectId) return;
    let mounted = true;
    setLoading(true);
    getProject(projectId)
      .then((res) => {
        if (!mounted) return;
        if (res?.data) {
          setProjectName(res.data.name || null);
          const fetchedFiles = (res.data as any).files ?? [];
          setFiles(fetchedFiles);
          setActiveFile(null);
        } else {
          setProjectName(null);
          setFiles([]);
          setActiveFile(null);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [projectId]);

  // Scroll chat when messages/files change
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, aiFiles]);

  function langFromPath(path: string): Language {
    if (!path) return 'javascript';
    const ext = path.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'js':
      case 'jsx':
        return 'javascript';
      case 'py':
        return 'python';
      case 'java':
        return 'markup';
      case 'css':
        return 'css';
      case 'html':
        return 'markup';
      case 'json':
        return 'json';
      case 'md':
        return 'markdown';
      default:
        return 'javascript';
    }
  }

  // Group files
  function groupFiles(items: FileItem[]) {
    const groups: Record<string, FileItem[]> = {};
    items.forEach((f) => {
      const seg = f.path.includes('/') ? f.path.split('/')[0] : '';
      const key = seg || '_root';
      if (!groups[key]) groups[key] = [];
      groups[key].push(f);
    });
    const keys = Object.keys(groups).sort((a, b) => (a === '_root' ? -1 : a.localeCompare(b)));
    return { groups, keys };
  }

  // Move file/folder
  function moveFileTo(fpath: string, targetFolder: string) {
    setFiles(prev => {
      const items = prev.map(i => ({ ...i }));
      const idx = items.findIndex(x => x.path === fpath);
      if (idx === -1) return prev;
      const file = items[idx];
      const name = file.path.replace(/^.*\//, '');
      const newPath = targetFolder === '_root' ? name : `${targetFolder}/${name}`;
      if (items.some(x => x.path === newPath)) return prev;
      items[idx].path = newPath;
      if (activeFile?.path === fpath) setActiveFile({ ...items[idx] });
      return items;
    });
    setMoveTargetOpenFor(null);
    setMoveSourceType(null);
  }
  function moveFolderTo(folderName: string, targetFolder: string) {
    if (folderName === targetFolder) return;
    setFiles(prev => {
      const items = prev.map(i => ({ ...i }));
      const prefix = `${folderName}/`;
      const folderItems = items.filter(x => x.path.startsWith(prefix));
      if (folderItems.length === 0) return prev;
      const newPrefix = targetFolder === '_root' ? '' : `${targetFolder}/${folderName}/`;
      const updated = items.map(it => {
        if (it.path.startsWith(prefix)) {
          const suffix = it.path.substring(prefix.length);
          const newPath = newPrefix ? `${newPrefix}${suffix}` : `${folderName}/${suffix}`.replace(/^\//, '') ;
          return { ...it, path: newPath };
        }
        return it;
      });
      const newPaths = updated.map(u => u.path);
      const collisions = newPaths.some((p, i) => newPaths.indexOf(p) !== i);
      if (collisions) return prev;
      if (activeFile && activeFile.path.startsWith(prefix)) {
        const suffix = activeFile.path.substring(prefix.length);
        const newActive = (newPrefix ? `${newPrefix}${suffix}` : `${folderName}/${suffix}`.replace(/^\//, ''));
        setActiveFile({ path: newActive, content: activeFile.content });
      }
      return updated;
    });
    setMoveTargetOpenFor(null);
    setMoveSourceType(null);
  }

  // Drag helpers
  function handleDragStart(e: React.DragEvent, fpath: string) {
    try { e.dataTransfer?.setData('text/plain', fpath); } catch {}
    setDraggedFilePath(fpath);
    setMoveTargetOpenFor(null);
    setMoveSourceType(null);
  }
  function handleDragEnd() {
    setDraggedFilePath(null);
    setDragOverTarget(null);
  }
  function handleDragOverTarget(e: React.DragEvent, targetKey: string) {
    e.preventDefault();
    if (dragOverTarget !== targetKey) setDragOverTarget(targetKey);
  }
  function handleDragLeaveTarget() { setDragOverTarget(null); }
  function handleDropOnTarget(e: React.DragEvent, targetKey: string) {
    e.preventDefault();
    const source = (e.dataTransfer && e.dataTransfer.getData('text/plain')) || draggedFilePath;
    if (source) moveFileTo(source, targetKey);
    setDraggedFilePath(null);
    setDragOverTarget(null);
  }

  // Cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  // Backend calls
  async function sendPrompt() {
    if (!projectId || !scenario.trim()) return;
    const promptText = scenario;
    setScenario('');
    setIsRunning(true);
    setAiFiles([]);
    setAppliedMap({});
    setCountdown(null);
    setMessages(prev => [...prev, { role: 'user', content: promptText }]); // push user message

    abortControllerRef.current = new AbortController();
    try {
      const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
      if (mode === 'ask') {
        const res = await fetch(`${backendBase}/api/ai/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, prompt: promptText }),
          signal: abortControllerRef.current.signal,
        });
        if (!res.ok) {
          const txt = await res.text();
          setMessages(prev => [...prev, { role: 'assistant', content: 'Error: ' + txt }]);
          setIsRunning(false);
          return;
        }
        const json = await res.json();
        const answer = (json && (json.answer ?? json.generated ?? json.generatedCode)) || JSON.stringify(json);
        setAiFiles([]);
        setMessages(prev => [...prev, { role: 'assistant', content: String(answer) }]);
      } else {
        const res = await fetch(`${backendBase}/api/ai/generate-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, tool: 'Playwright', language: 'TypeScript', prompt: promptText }),
          signal: abortControllerRef.current.signal,
        });
        if (!res.ok) {
          const txt = await res.text();
          setMessages(prev => [...prev, { role: 'assistant', content: 'Error: ' + txt }]);
          setIsRunning(false);
          return;
        }
        const json = await res.json();
        const content = json.generatedCode ?? json.generated ?? json;
        let parsed: { path: string; content: string }[] = [];
        try {
          parsed = typeof content === 'string' ? JSON.parse(content) : content;
        } catch {
          parsed = [];
        }
        setAiFiles(parsed || []);
        setMessages(prev => [...prev, { role: 'assistant', content: typeof content === 'string' ? content : JSON.stringify(content, null, 2) }]);

        if (parsed.length > 0) {
          setCountdown(30);
          timerRef.current = window.setInterval(() => {
            setCountdown(c => {
              if (c === null) return null;
              if (c <= 1) {
                if (timerRef.current) window.clearInterval(timerRef.current);
                timerRef.current = null;
                autoApplyAll(parsed);
                return null;
              }
              return c - 1;
            });
          }, 1000);
        }
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Generation canceled' }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Generation failed: ' + (e.message || String(e)) }]);
      }
    } finally {
      setIsRunning(false);
      abortControllerRef.current = null;
    }
  }

  function stopGeneration() {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setIsRunning(false);
  }

  async function autoApplyAll(parsedFiles: { path: string; content: string }[]) {
    if (!projectId) return;
    const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
    try {
      const res = await fetch(`${backendBase}/api/ai/apply-code`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, files: parsedFiles, message: scenario }) });
      const json = await res.json();
      if (res.ok) {
        const revertId = json.revertId as string | undefined;
        const m: Record<string, { applied: boolean; revertId?: string }> = {};
        parsedFiles.forEach(f => m[f.path] = { applied: true, revertId });
        setAppliedMap(m);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Auto-apply error: ' + JSON.stringify(json) }]);
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Auto-apply failed: ' + (err.message || String(err)) }]);
    }
  }

  async function applyFileNow(f: { path: string; content: string }) {
    if (!projectId) return;
    const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
    try {
      const res = await fetch(`${backendBase}/api/ai/apply-code`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, files: [f], message: 'Applied single file ' + f.path }) });
      const json = await res.json();
      if (res.ok) setAppliedMap(m => ({ ...m, [f.path]: { applied: true, revertId: json.revertId } }));
    } catch {}
  }

  async function revertFile(f: { path: string; content: string }) {
    const info = appliedMap[f.path];
    if (!info?.revertId) return;
    const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
    try {
      const res = await fetch(`${backendBase}/api/ai/revert`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revertId: info.revertId }) });
      if (res.ok) setAppliedMap(m => ({ ...m, [f.path]: { applied: false } }));
    } catch {}
  }

  return (
    <>
      <Head>
        <title>IDE & AI Assistance</title>
      </Head>
      <Header />
      <main className={`app-root ide-page w-full ${lightMode ? 'theme-light bg-slate-50' : 'var(--vscode-bg)'}`} >
        <div className={`${lightMode ? 'bg-white border-b border-slate-200' : 'bg-[var(--vscode-panel)] border-[var(--vscode-border)]'} flex-shrink-0 px-6 py-3`}>
          <div className="max-w-[1100px] mx-auto flex items-center justify-between">
            <h1 className={`text-2xl font-semibold ${lightMode ? 'text-slate-800' : 'text-[var(--vscode-text)]'}`}>IDE & AI Assistance</h1>
            <div className="flex items-center gap-2">
              {/* <button onClick={() => setLightMode(l => !l)} className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${lightMode ? 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600' : 'bg-slate-800/60 border-slate-600 hover:bg-slate-700 text-slate-200'}`}>{lightMode ? 'Dark' : 'Light'} Mode</button> */}
            <button onClick={() => setLightMode(l => !l)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" title={lightMode ? "Switch to Dark Mode" : "Switch to Light Mode"}> {lightMode ? (<Moon className="w-5 h-5 text-slate-600" />) : (<Sun className="w-5 h-5 text-yellow-400" />)}</button>
            </div>
          </div>
        </div>

        <div className="flex-1 relative min-h-0">
          <SplitPane split="vertical" minSize={200} defaultSize={280} className="absolute inset-0 h-full w-full" paneStyle={{ height: '100%' }}>
            {/* Explorer */}
            <div className={`h-full flex-shrink-0 overflow-hidden ${lightMode ? 'bg-white border-r border-slate-200' : 'border-r border-slate-700/40'}`} aria-label="file-explorer" style={{ background: lightMode ? undefined : 'var(--vscode-panel)' }}>
              <div className={`h-full overflow-y-auto custom-scroll p-3 min-h-0 pb-24`}>
                <div className={`flex items-center justify-between px-4 h-11 border-b ${lightMode ? 'border-slate-200' : 'border-slate-700/50'} bg-transparent rounded-t-md`}>
                  <div className="flex items-center gap-2 text-xs font-semibold tracking-wider">
                    <span className={`${lightMode ? 'text-slate-600' : 'text-sky-300'}`}>EXPLORER</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button title="New File" className={`p-2 rounded-md transition-colors ${lightMode ? 'hover:bg-slate-100 text-slate-500 hover:text-slate-700' : 'hover:bg-slate-800 text-sky-300 hover:text-[var(--vscode-text)]/90'}`} onClick={() => alert('New File - not implemented yet')}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                    </button>
                    <button title="New Folder" className={`p-2 rounded-md transition-colors ${lightMode ? 'hover:bg-slate-100 text-slate-500 hover:text-slate-700' : 'hover:bg-slate-800 text-sky-300 hover:text-[var(--vscode-text)]/90'}`} onClick={() => alert('New Folder - not implemented yet')}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
                    </button>
                    <button title="Refresh" className={`p-2 rounded-md transition-colors ${lightMode ? 'hover:bg-slate-100 text-slate-500 hover:text-slate-700' : 'hover:bg-slate-800 text-sky-300 hover:text-[var(--vscode-text)]/90'}`} onClick={() => window.location.reload()}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                    </button>
                  </div>
                </div>

                <div className="px-3 py-3 border-b border-transparent">
                  {(() => {
                    const [projectOpen, setProjectOpen] = React.useState(true);
                    const toggleProject = () => setProjectOpen((v) => !v);
                    const groups: Record<string, FileItem[]> = {};
                    files.forEach((f) => {
                      const seg = f.path.includes('/') ? f.path.split('/')[0] : '';
                      const key = seg || '_root';
                      if (!groups[key]) groups[key] = [];
                      groups[key].push(f);
                    });
                    return (
                      <div className={`font-medium text-sm flex flex-col gap-2 ${lightMode ? 'text-slate-700' : 'text-[var(--vscode-text)]'}`}>
                        <div
                          className="flex items-center gap-2 cursor-pointer select-none"
                          tabIndex={0}
                          role="button"
                          aria-expanded={projectOpen}
                          onClick={toggleProject}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') toggleProject(); }}
                          style={{ userSelect: 'none' }}
                        >
                          <Chevron open={projectOpen} size={14} lightMode={lightMode} />
                          {projectName ?? 'TestingTarun'}
                        </div>

                        {projectOpen && (
                          loading ? (
                            <div className="text-sm text-slate-400 flex items-center gap-2">
                              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                              Loading files...
                            </div>
                          ) : files.length === 0 ? (
                            <div className="text-sm text-slate-400 py-8 text-center">
                              <div className="mb-2">=ƒôü</div>
                              No files in this project.
                            </div>
                          ) : (
                            <div className="text-sm">
                              {Object.keys(groups).map((grp) => {
  const isFolder = grp !== '_root';
  const isOpen = folderOpen[grp] ?? true; // default open

  if (isFolder) {
    return (
      <div key={grp} className="mb-4">
        <div className={`flex items-center justify-between mb-2 ${lightMode ? 'text-slate-500' : 'text-blue-400'}`}>
          <div
            className="flex items-center gap-2 font-medium text-xs select-none cursor-pointer"
            onClick={() => setFolderOpen(prev => ({ ...prev, [grp]: !isOpen }))}
          >
            <Chevron open={isOpen} size={12} lightMode={lightMode} />
            {grp}
          </div>

          <div className="relative">
            <button
              title="Move folder"
              onClick={() => { setMoveTargetOpenFor(grp); setMoveSourceType('folder'); }}
              className={`px-2 py-1 rounded text-xs ${lightMode ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-blue-600/20 text-blue-300'}`}
            >
              Gï»
            </button>
            {moveTargetOpenFor === grp && moveSourceType === 'folder' && (
              <div className={`absolute right-0 mt-2 w-44 z-40 rounded-md border ${lightMode ? 'bg-white border-slate-200' : 'bg-slate-800 border-slate-600/40'} shadow-lg`}>
                <div className="px-2 py-2 text-xs">Move folder to:</div>
                <div className="max-h-40 overflow-auto">
                  {Object.keys(groups).map(target => (
                    <button
                      key={target}
                      onClick={() => moveFolderTo(grp, target)}
                      className={`w-full text-left px-3 py-1 text-xs ${lightMode ? 'hover:bg-slate-50' : 'hover:bg-slate-700/60'}`}
                    >
                      {target === '_root' ? '(root)' : target}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {isOpen && (
          <ul className="space-y-1">
            {groups[grp].map((f) => (
              <li
                key={f.path}
                className={`flex items-center gap-3 py-2 px-3 rounded-md cursor-pointer transition-colors duration-150 border ${
                  activeFile?.path === f.path
                    ? (lightMode
                        ? 'bg-blue-50 text-blue-700 border-blue-300'
                        : 'bg-blue-600/30 text-[var(--vscode-text)] border-blue-500/50')
                    : (lightMode
                        ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        : 'text-slate-300 border-transparent hover:bg-slate-700/50 hover:text-[var(--vscode-text)]')
                }`}
                onClick={() => setActiveFile(f)}
              >
                <span className="text-blue-400">
                  {f.path.endsWith('.tsx') || f.path.endsWith('.ts') ? 'GÜ¢n+Å'
                    : f.path.endsWith('.js') || f.path.endsWith('.jsx') ? '=ƒƒ¿'
                    : f.path.endsWith('.css') ? '=ƒÄ¿'
                    : f.path.endsWith('.json') ? '=ƒôä'
                    : '=ƒô¥'}
                </span>
                <span className="truncate font-medium">{f.path.replace(/^.*\//, '')}</span>
                <div className="ml-auto relative">
                  <button
                    title="Move file"
                    onClick={(e) => { e.stopPropagation(); setMoveTargetOpenFor(f.path); setMoveSourceType('file'); }}
                    className={`px-2 py-1 rounded text-xs ${lightMode ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-blue-600/20 text-blue-300'}`}
                  >
                    Gï»
                  </button>
                  {moveTargetOpenFor === f.path && moveSourceType === 'file' && (
                    <div className={`absolute right-0 mt-2 w-44 z-40 rounded-md border ${lightMode ? 'bg-white border-slate-200' : 'bg-slate-800 border-slate-600/40'} shadow-lg`}>
                      <div className="px-2 py-2 text-xs">Move file to:</div>
                      <div className="max-h-40 overflow-auto">
                        {Object.keys(groups).map(target => (
                          <button
                            key={target}
                            onClick={(ev) => { ev.preventDefault(); moveFileTo(f.path, target); }}
                            className={`w-full text-left px-3 py-1 text-xs ${lightMode ? 'hover:bg-slate-50' : 'hover:bg-slate-700/60'}`}
                          >
                            {target === '_root' ? '(root)' : target}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // Non-folder group (root files)
  return (
    <div key={grp} className="mb-4">
      <ul className="space-y-1">
        {groups[grp].map((f) => (
          <li
            key={f.path}
            className={`flex items-center gap-3 py-2 px-3 rounded-md cursor-pointer transition-colors duration-150 border ${
              activeFile?.path === f.path
                ? (lightMode ? 'bg-blue-50 text-blue-700 border-blue-300' : 'bg-blue-600/30 text-[var(--vscode-text)] border-blue-500/50')
                : (lightMode ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50' : 'text-slate-300 border-transparent hover:bg-slate-700/50 hover:text-[var(--vscode-text)]')
            }`}
            onClick={() => setActiveFile(f)}
          >
            <span className="text-blue-400">
              {f.path.endsWith('.tsx') || f.path.endsWith('.ts') ? 'GÜ¢n+Å'
                : f.path.endsWith('.js') || f.path.endsWith('.jsx') ? '=ƒƒ¿'
                : f.path.endsWith('.css') ? '=ƒÄ¿'
                : f.path.endsWith('.json') ? '=ƒôä'
                : '=ƒô¥'}
            </span>
            <span className="truncate font-medium">{f.path.replace(/^.*\//, '')}</span>
            <div className="ml-auto relative">
              <button
                title="Move file"
                onClick={(e) => { e.stopPropagation(); setMoveTargetOpenFor(f.path); setMoveSourceType('file'); }}
                className={`px-2 py-1 rounded text-xs ${lightMode ? 'hover:bg-slate-100 text-slate-500' : 'hover:bg-blue-600/20 text-blue-300'}`}
              >
                Gï»
              </button>
              {moveTargetOpenFor === f.path && moveSourceType === 'file' && (
                <div className={`absolute right-0 mt-2 w-44 z-40 rounded-md border ${lightMode ? 'bg-white border-slate-200' : 'bg-slate-800 border-slate-600/40'} shadow-lg`}>
                  <div className="px-2 py-2 text-xs">Move file to:</div>
                  <div className="max-h-40 overflow-auto">
                    {Object.keys(groups).map(target => (
                      <button
                        key={target}
                        onClick={(ev) => { ev.preventDefault(); moveFileTo(f.path, target); }}
                        className={`w-full text-left px-3 py-1 text-xs ${lightMode ? 'hover:bg-slate-50' : 'hover:bg-slate-700/60'}`}
                      >
                        {target === '_root' ? '(root)' : target}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
})}
                            </div>
                          )
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
              </div>

              {/* Code view + Assistant */}
              <SplitPane split="vertical" minSize={300} defaultSize="60%" pane1Style={{ paddingRight: '1px solid #347cdbff' }} paneStyle={{ height: '100%' }}>
                {/* Code panel */}
                <div className={`flex-1 h-full flex flex-col overflow-hidden ${lightMode ? 'bg-white border-r border-slate-200 shadow-sm' : 'border-r border-slate-700/40'}`} style={{ background: lightMode ? undefined : 'var(--vscode-panel)' }}>
                  <div className={`border-b mb-0 ${lightMode ? 'bg-white/90 backdrop-blur border-slate-200' : 'border-slate-700/50'}`} style={{ borderTopLeftRadius: 6, borderTopRightRadius: 6, background: lightMode ? undefined : 'var(--vscode-panel)' }}>
                    <div className="flex items-center justify-between px-4 h-11 gap-4">
                      <div className="flex overflow-x-auto flex-1">
                        {files.length === 0 ? (
                          <div className={`px-2 py-2 text-sm ${lightMode ? 'text-slate-500' : 'text-slate-400'}`}>No files open</div>
                        ) : files.map((f) => (
                          <button
                            key={`tab-${f.path}`}
                            onClick={() => setActiveFile(f)}
                            className={`px-5 py-2 text-sm font-medium transition-all duration-200 border-b-2 whitespace-nowrap flex items-center gap-2 ${activeFile?.path === f.path
                              ? (lightMode ? 'border-blue-500 text-blue-700 bg-blue-50' : 'border-blue-500 text-[var(--vscode-text)] bg-blue-600/10')
                              : (lightMode ? 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50' : 'border-transparent text-slate-400 hover:text-[var(--vscode-text)] hover:bg-slate-700/30')}`}
                          >
                            <span>
                              {f.path.endsWith('.tsx') || f.path.endsWith('.ts') ? 'GÜ¢n+Å' :
                               f.path.endsWith('.js') || f.path.endsWith('.jsx') ? '=ƒƒ¿' :
                               f.path.endsWith('.css') ? '=ƒÄ¿' :
                               f.path.endsWith('.json') ? '=ƒôä' : '=ƒô¥'}
                            </span>
                            {f.path}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${lightMode ? 'bg-[var(--vscode-accent)] hover:bg-[var(--vscode-accent-hover)] text-[var(--vscode-text)] shadow-sm' : 'bg-[var(--vscode-accent)] hover:bg-[var(--vscode-accent-hover)] text-[var(--vscode-text)]'}`}>Save</button>
                      </div>
                    </div>
                  </div>

                  <div className={`flex-1 overflow-y-auto custom-scroll p-4 ${lightMode ? 'bg-white' : ''}`} style={{ borderRadius: '0', margin: '0', borderTop: 'none', minHeight: 0, paddingBottom: 96, background: lightMode ? undefined : 'var(--vscode-bg)' }}>
                    {activeFile && typeof activeFile.path === 'string' ? (
                      <div className={`p-4 ${lightMode ? 'bg-transparent border-0' : 'bg-transparent' }`}>
                        <Highlight {...defaultProps} code={activeFile.content ?? ''} language={langFromPath(activeFile.path)} theme={lightMode ? githubTheme : vsDarkTheme}>
                          {(renderProps: any) => {
                            const { className, style, tokens, getLineProps, getTokenProps } = renderProps;
                            return (
                              <div className={className + ' text-sm'} style={{ ...style, background: 'transparent', color: 'var(--vscode-text)', fontSize: '13px' }}>
                                {tokens.map((line: any[], i: number) => (
                                  <div key={`line-${i}`} {...getLineProps({ line, key: i })} className={`flex transition-colors duration-150 ${lightMode ? 'hover:bg-blue-50' : 'hover:bg-[var(--vscode-panel)]/30'}`}>
                                    <div className={`pr-4 select-none text-right w-12 font-mono ${lightMode ? 'text-slate-400' : 'text-slate-500'}`} style={{ lineHeight: '1.5' }}>{i + 1}</div>
                                    <div className="flex-1" style={{ lineHeight: '1.5' }}>
                                      {line.map((token: any, key: number) => (
                                        <span key={`token-${i}-${key}`} {...getTokenProps({ token, key })} />
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          }}
                        </Highlight>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <div className="text-5xl mb-3">=ƒôü</div>
                        <div className={`${lightMode ? 'text-slate-500' : 'text-slate-400'} text-lg`}>Select a file to start coding</div>
                        <div className={`${lightMode ? 'text-slate-400' : 'text-slate-500'} text-sm mt-2`}>Choose a file from the explorer to view its contents</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Assistant panel */}
                <div
                  className={`h-full flex-shrink-0 flex flex-col transition-colors duration-300 ai-assistant-panel ${
                    lightMode
                      ? 'bg-white border-l border-slate-200 shadow-sm'
                      : 'bg-[var(--vscode-bg)] border-l border-[var(--vscode-border)]'
                  }`}

                  style={{ position: 'relative', minHeight: 0, overflow: 'hidden', width: '100%' }}
                >
                  <div className={`flex items-center justify-between px-4 py-3 border-b flex-shrink-0 ${lightMode ? 'bg-white border-slate-200' : 'bg-[var(--vscode-panel)] border-[var(--vscode-border)]'}`}>
                    <div className="flex items-center gap-2">
                      <svg className={`w-4 h-4 ${lightMode ? 'text-blue-500' : 'text-blue-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                      </svg>
                      <span className={`text-sm font-semibold tracking-wide ${lightMode ? 'text-slate-700' : 'text-[var(--vscode-text)]'}`}>AI ASSISTANT</span>
                        {/* NEW: Mode label */}
                      <span className={`ml-3 text-xs px-2 py-0.5 rounded-full border ${lightMode ? 'text-slate-600 border-slate-300 bg-slate-100' : 'text-slate-300 border-slate-600 bg-slate-800'}`}>
                        {mode === 'agent' ? 'Agent mode' : 'Ask mode'}
                      </span>
                    
                    </div>
                  </div>

                  <div
                    ref={chatScrollRef}
                    className={`flex-1 chat-scroll overflow-y-auto overflow-x-hidden ${lightMode ? 'bg-white' : 'bg-[var(--vscode-bg)]'}`}
                    style={{ minHeight: 0, maxWidth: '100%' }}
                  >
                    <div className="chat-scroll-content px-3 py-3 space-y-4" style={{ maxWidth: '100%', wordWrap: 'break-word' }}>
                      {/* Chat messages */}
                      {messages.length ? (
                        <div className="space-y-5">
                          {messages.map((m, idx) => {
                            if (m.role === 'user') {
                              // Right-aligned user bubble
                              return (
                                <div key={idx} className="flex justify-end">
                                  <div
                                    className={`max-w-[85%] rounded-2xl border px-3 py-2 text-sm leading-6
                                      ${lightMode
                                        ? 'bg-white border-slate-200 text-slate-900'
                                        : 'bg-slate-800/70 border-slate-700/60 text-slate-100'
                                      }`}
                                  >
                                    {m.content}
                                  </div>
                                </div>
                              );
                            }
                            // Assistant: plain text + code blocks
                            return (
                              <div key={idx} className="mt-1">
                                <AIAnswerRenderer answer={m.content} lightMode={lightMode} />
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        !isRunning && (
                          <div className={`text-sm px-1 ${lightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            Start a conversation...
                          </div>
                        )
                      )}

                      {mode === 'agent' && aiFiles.length > 0 && (
                        <div>
                          <h3 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${lightMode ? 'text-slate-700' : 'text-[var(--vscode-text)]'}`}>
                            Files Returned <span className={`text-xs font-normal ${lightMode ? 'text-slate-500' : 'text-slate-400'}`}>({aiFiles.length})</span>
                          </h3>
                          <div className="space-y-2">
                            {aiFiles.map(f => (
                              <details key={f.path} className={`rounded border p-2 ${lightMode ? 'bg-white border-slate-200' : 'bg-slate-800/60 border-slate-700/40'}`}>
                                <summary className="flex items-center justify-between gap-3 cursor-pointer">
                                  <span className={`font-mono text-xs truncate flex-1 ${lightMode ? 'text-slate-700' : 'text-slate-200'}`}>{f.path}</span>
                                  <span className="flex gap-2 flex-shrink-0">
                                    <button onClick={e => { e.preventDefault(); applyFileNow(f); }} disabled={!!appliedMap[f.path]?.applied} className={`px-2 py-1 text-xs rounded ${appliedMap[f.path]?.applied ? 'bg-green-200 text-green-700 cursor-not-allowed' : 'bg-green-600 text-[var(--vscode-text)] hover:bg-green-500'}`}>Apply</button>
                                    <button onClick={e => { e.preventDefault(); revertFile(f); }} disabled={!appliedMap[f.path]?.applied} className={`px-2 py-1 text-xs rounded ${appliedMap[f.path]?.applied ? 'bg-red-600 text-[var(--vscode-text)] hover:bg-red-500' : 'bg-red-200 text-red-500 cursor-not-allowed'}`}>Revert</button>
                                  </span>
                                </summary>
                                <pre className={`mt-2 max-h-64 overflow-auto text-xs whitespace-pre-wrap ${lightMode ? 'text-slate-600' : 'text-slate-300'}`}>{f.content}</pre>
                              </details>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ChatGPT-style input area */}
                  <div
                    className={`flex-shrink-0 border-t ${lightMode ? 'bg-gray-50 border-slate-200' : 'bg-[var(--vscode-panel)] border-[var(--vscode-border)]'} sticky bottom-3`}
                  >
                    <div className="mx-auto max-w-3xl w-full px-3 sm:px-4 py-3">
                      <div
                        className={`flex items-end gap-2 sm:gap-3 rounded-2xl border shadow-lg ring-1 p-2 sm:p-3
                          ${lightMode ? 'bg-white border-slate-200 ring-black/5' : 'bg-[var(--vscode-panel)] border-[var(--vscode-border)] ring-white/5'}
                          focus-within:ring-[var(--vscode-accent)]/30`}
                      >
                        {/* Mode toggle */}
                        <button
                          onClick={() => setMode(m => (m === 'agent' ? 'ask' : 'agent'))}
                          className={`shrink-0 h-8 px-3 text-xs font-medium rounded-full border transition-colors
                            ${mode === 'agent'
                              ? (lightMode
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-blue-900/40 text-blue-200 border-blue-700')
                              : (lightMode
                                  ? 'text-slate-600 border-slate-200 hover:bg-slate-50'
                                  : 'text-slate-300 border-slate-600 hover:bg-slate-700/40')
                            }`}
                          aria-pressed={mode === 'agent'}
                          title="Toggle Ask/Agent mode"
                        >
                          {mode === 'agent' ? 'Agent' : 'Ask'}
                        </button>

                        {/* Textarea */}
                        <div className="relative flex-1">
                          <textarea
                            ref={taRef}
                            className={`block w-full resize-none border-0 bg-transparent outline-none text-[15px] leading-6 pr-10
                              ${lightMode ? 'text-slate-900 placeholder-slate-500' : 'text-slate-100 placeholder-slate-300'}`}
                            rows={1}
                            placeholder="MessageGÇª (Shift+Enter for newline)"
                            value={scenario}
                            onChange={(e) => setScenario(e.target.value)}
                            onKeyDown={(e) => {
                              // Ctrl+Enter or Cmd+Enter sends
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                if (!isRunning && scenario.trim()) sendPrompt();
                              }
                              // plain Enter -> newline
                            }}
                          />

                          {/* Inline send / stop */}
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
                                title="Send"
                              >
                                {/* Gåùn+Å ChatGPT-style arrow */}
                                <svg
                                  viewBox="0 0 24 24"
                                  className="h-4 w-4"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth={2}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <line x1="5" y1="12" x2="19" y2="12" />
                                  <polyline points="12 5 19 12 12 19" />
                                </svg>
                              </button>
                            ) : (
                              <button
                                onClick={stopGeneration}
                                className={`inline-flex h-8 w-8 items-center justify-center rounded-md 
                                  ${lightMode 
                                    ? 'bg-gray-500 hover:bg-gray-600 text-[var(--vscode-text)]' 
                                    : 'bg-gray-500 hover:bg-gray-600 text-[var(--vscode-text)]'
                                  }`}
                                aria-label="Stop"
                                title="Stop"
                              >
                                {/* solid stop square inside filled button */}
                                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                                  <rect x="8" y="8" width="8" height="8" rx="1" ry="1" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              </SplitPane>
            </SplitPane>
          </div>
        </main>

        {/* Global styles for this page */}
        <style jsx global>{`
          html, body, #__next {
            margin: 0;
            padding: 0;
            height: 100vh;
            width: 100vw;
            overflow: hidden;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          }
          main.app-root, .SplitPane, .Pane { min-height: 0; }
          .SplitPane { position: absolute !important; top: 0; left: 0; height: 100% !important; width: 100% !important; }
          .Pane { height: 100% !important; }
          
          .Resizer { background: transparent !important; z-index: 1400; position: relative; pointer-events: auto;}
          .Resizer:hover { background: #94a3b8; }
          .Resizer.vertical { width: 2px; background: transparent !important; margin: 0 -1px; cursor: col-resize; }
          .Resizer.horizontal { height: 2px; background: transparent !important; margin: -1px 0; cursor: row-resize; }
          .Resizer:hover { background: rgba(255, 255, 255, 0.15) !important; }

          ::-webkit-scrollbar { width: 8px; height: 8px; }
          ::-webkit-scrollbar-track { background: ${'${lightMode ? "#f1f5f9" : "rgba(15,23,42,0.5)"}'}; }
          ::-webkit-scrollbar-thumb { background: ${'${lightMode ? "#cbd5e1" : "linear-gradient(135deg, #3b82f6, #8b5cf6)"}'}; border-radius: 4px; }
          ::-webkit-scrollbar-thumb:hover { background: ${'${lightMode ? "#94a3b8" : "linear-gradient(135deg, #2563eb, #7c3aed)"}'}; }

          .ai-assistant-panel { -ms-overflow-style: none; scrollbar-width: none; overflow: hidden; width: 100%; max-width: 100%; }
          .ai-assistant-panel .chat-scroll { box-sizing: border-box; width: 100%; max-width: 100%; }
          .ai-assistant-panel * { max-width: 100%; box-sizing: border-box; }

          .custom-scroll::-webkit-scrollbar { width: 4px; }
          .custom-scroll::-webkit-scrollbar-track { background: transparent; }
          .custom-scroll::-webkit-scrollbar-thumb { background: ${'${lightMode ? "#cbd5e1" : "rgba(255,255,255,0.12)"}'}; border-radius: 6px; }
          .custom-scroll::-webkit-scrollbar-thumb:hover { background: ${'${lightMode ? "#94a3b8" : "rgba(255,255,255,0.18)"}'}; }

          .ai-assistant-panel pre, .ai-assistant-panel code, .ai-assistant-panel .text-sm pre, .ai-assistant-panel .text-xs pre {
            box-sizing: border-box;
            padding-right: 48px;
            overflow-x: auto;
            max-width: 100%;
            word-wrap: break-word;
            overflow-wrap: break-word;
          }
          .ai-assistant-panel .whitespace-pre-wrap { white-space: pre-wrap; word-break: break-word; overflow-wrap: anywhere; }
          .ai-assistant-panel .answer-text-block { max-width: 100%; word-wrap: break-word; overflow-wrap: break-word; }

          .ai-assistant-panel .code-copy-button {
            position: absolute; right: 12px; top: 8px; z-index: 900;
            font-size: 12px; padding: 6px 8px; border-radius: 6px;
            background: rgba(0,0,0,0.5); color: #fff; border: none; cursor: pointer; opacity: 0.9;
          }
          .ai-assistant-panel .code-copy-button:hover { opacity: 1; transform: translateY(-1px); }
        `}</style>
      </>
  );
}

