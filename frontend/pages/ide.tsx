'use client'
import Head from 'next/head';
import Header from '../components/Header';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import React from "react";
const SplitPane = require('react-split-pane').default;
import { getProject, backendBase } from '../lib/api';
import Editor from "react-simple-code-editor";
import Highlight, { defaultProps, Language } from "prism-react-renderer";
import vsDarkTheme from "prism-react-renderer/themes/vsDark";
import githubTheme from "prism-react-renderer/themes/github";
import { Sun, Moon, Plus, FolderPlus, RefreshCw, X, MoreVertical, MoveRight, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import Prism from "prism-react-renderer/prism";
(globalThis as any).Prism = Prism;
require("prismjs/components/prism-csharp");
require("prismjs/components/prism-java");
require("prismjs/components/prism-markup");     // html/markup
require("prismjs/components/prism-javascript");
require("prismjs/components/prism-typescript");
require("prismjs/components/prism-jsx");
require("prismjs/components/prism-tsx");
require("prismjs/components/prism-python");
require("prismjs/components/prism-json");
require("prismjs/components/prism-markdown");
require("prismjs/components/prism-css");


// ADD these right after the imports:
const darkPrismNoBG = {
  ...vsDarkTheme,
  plain: { ...vsDarkTheme.plain, backgroundColor: 'transparent', background: 'transparent' }
};
const lightPrismNoBG = {
  ...githubTheme,
  plain: { ...githubTheme.plain, backgroundColor: 'transparent', background: 'transparent' }
};

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

function ActionIcon({
  title,
  onClick,
  lightMode,
  children,
}: {
  title: string;
  onClick: () => void;
  lightMode: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`action-icon ${lightMode ? "action-icon--light" : "action-icon--dark"}`}
    >
      {children}
    </button>
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

function normalizeLang(lang?: string): Language {
  if (!lang) return 'javascript' as Language;
  const L = lang.toLowerCase();
  if (L === 'cs' || L === 'c#') return 'csharp' as Language;
  if (L === 'ts' || L === 'tsx') return 'typescript' as Language;
  if (L === 'js' || L === 'jsx') return 'javascript' as Language;
  if (L === 'html') return 'markup' as Language;
  return (L as Language);
}

function CodeBlock({
  code,
  lang,
  lightMode,
}: {
  code: string;
  lang?: string;
  lightMode: boolean;
}) {
  const themed = lightMode ? lightPrismNoBG : darkPrismNoBG;
  const blockBg   = "transparent";
  const blockBrdr = lightMode ? "var(--code-border-light)": "var(--code-border-dark)";
  const language  = normalizeLang(lang);
  const [copied, setCopied] = React.useState(false);
  const doCopy = async () => {
    try { await navigator.clipboard.writeText(code); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = code; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); ta.remove();
    }
    setCopied(true); setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div
      style={{ position:'relative', background:blockBg, border:`1px solid ${blockBrdr}`, borderRadius:8, overflow:'hidden' }}
    >
      <button
        onClick={doCopy}
        className="code-copy-button"
        data-copied={copied ? 'true' : 'false'}
        title={copied ? 'Copied' : 'Copy code'}
      >
        {copied ? 'Copied ✓' : 'Copy'}
      </button>

      <Highlight {...defaultProps} code={code} language={language} theme={themed}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre className={className + " text-sm p-3 overflow-auto"} style={{ ...style, margin:0, background:'transparent' }}>
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })} style={{ display:'table-row' }}>
                <div style={{ display:'table-cell', textAlign:'right', paddingRight:12, userSelect:'none', opacity:.5, width:40, fontFamily:'monospace', fontSize:11 }}>
                  {i + 1}
                </div>
                <div style={{ display:'table-cell' }}>
                  {line.map((token, key) => <span key={key} {...getTokenProps({ token })} />)}
                </div>
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
}

 function pickLanguage(proj: any): string {
    if (!proj) return 'TypeScript';
    const langs: string[] = (proj.languages ?? (proj.language ? [proj.language] : [])) as string[];
    if (!langs || langs.length === 0) return (proj.language ? String(proj.language) : 'TypeScript');
    if (langs.some(l => /^(c#|csharp)$/i.test(l))) return 'C#';
    if (langs.some(l => /^java$/i.test(l))) return 'Java';
    if (langs.some(l => /^python$/i.test(l))) return 'Python';
    if (langs.some(l => /^typescript$/i.test(l))) return 'TypeScript';
    if (langs.some(l => /^javascript$/i.test(l))) return 'JavaScript';
    return langs[0];
  }

function defaultPrismLangFromMeta(meta: any): Language {
  const L = (pickLanguage(meta) || '').toLowerCase();
  if (/^c#|csharp|cs$/.test(L)) return 'csharp' as Language;
  if (L === 'typescript') return 'typescript' as Language;
  if (L === 'javascript') return 'javascript' as Language;
  if (L === 'python') return 'python' as Language;
  // map Java to Prism's "markup" if you want, or fall back
  if (L === 'java') return 'java' as Language;
  return 'javascript' as Language;
}


function AIAnswerRenderer({ answer, lightMode, defaultLang }: { answer: string; lightMode: boolean; defaultLang: Language; }) {
  const themed = lightMode ? githubTheme : vsDarkTheme;

  // 👇 Type the components so TS knows about `inline`
  const mdComponents: Components = {
    h1: ({node, ...props}) => <h1 className={`text-xl font-bold mt-2 mb-2 ${lightMode ? 'text-slate-900' : 'text-white'}`} {...props} />,
    h2: ({node, ...props}) => <h2 className={`text-lg font-semibold mt-2 mb-2 ${lightMode ? 'text-slate-900' : 'text-white'}`} {...props} />,
    p:  ({node, ...props}) => <p  className={`text-sm leading-relaxed mb-2 ${lightMode ? 'text-slate-800' : 'text-slate-200'}`} {...props} />,
    ul: ({node, ...props}) => <ul className={`list-disc ml-5 text-sm mb-2 ${lightMode ? 'text-slate-700' : 'text-slate-200'}`} {...props} />,
    ol: ({node, ...props}) => <ol className={`list-decimal ml-5 text-sm mb-2 ${lightMode ? 'text-slate-700' : 'text-slate-200'}`} {...props} />,
    li: ({node, ...props}) => <li className="mb-1" {...props} />,
    strong: ({node, ...props}) => <strong className={`${lightMode ? 'text-slate-900' : 'text-white'}`} {...props} />,

    // <-- THIS is the one that needs `inline`
    code({ inline, className, children } : any) {
  const match = /language-([\w#+-]+)/.exec(className || "");
  const lang = match?.[1];
  const codeStr = String(children ?? "");

  if (inline) {
    return (
      <code
        className={`${className ?? ""} px-1 py-0.5 rounded ${lightMode ? 'inlinecode--light' : 'inlinecode--dark'}`}
      >
        {children}
      </code>
    );
  }
  const finalLang = (lang as string) || defaultLang;
  return <CodeBlock code={codeStr} lang={finalLang} lightMode={lightMode} />;
},};

  return (
    <div className="assistant-msg mt-3">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
        {answer || ""}
      </ReactMarkdown>
    </div>
  );
}

type ChatMsg = { role: 'user' | 'assistant'; content: string };

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeAnswer(raw: string, lastUserPrompt: string) {
  if (!raw) return "";

  let s = raw.replace(/\r/g, "");

  // Remove any SSE "data:" prefixes just in case
  s = s.replace(/^data:\s?/gm, "");

  // Remove chat-style labels
  s = s.replace(/^(You|User|AI|Assistant)\s*:\s*/i, "");

  // Drop an echoed copy of the question (with or without "Question:" prefix)
  const variants = [
    lastUserPrompt.trim(),
    `Question: ${lastUserPrompt.trim()}`,
    `Q: ${lastUserPrompt.trim()}`
  ];
  for (const v of variants) {
    const rx = new RegExp(`^\\s*${escapeRegExp(v)}\\s*`, "i");
    if (rx.test(s)) {
      s = s.replace(rx, "");
      break;
    }
  }

  // Ensure we start on a new line for visible spacing under the user bubble
  if (!/^\n/.test(s)) s = "\n" + s;

  return s;
}

type TreeNode =
  | { type: 'folder'; name: string; path: string; children: TreeNode[] }
  | { type: 'file';   name: string; path: string };

function buildTree(items: FileItem[]): TreeNode {
  const root: TreeNode = { type: 'folder', name: '_root', path: '', children: [] };

  for (const f of items) {
    const parts = f.path.split('/').filter(Boolean);
    let cur = root;
    let acc = '';

    parts.forEach((part, i) => {
      acc = acc ? `${acc}/${part}` : part;
      const isFile = i === parts.length - 1;

      if (isFile) {
        // file
        cur.children.push({ type: 'file', name: part, path: acc });
      } else {
        // folder
        let next = cur.children.find(
          (n) => n.type === 'folder' && n.name === part
        ) as Extract<TreeNode, { type: 'folder' }> | undefined;

        if (!next) {
          next = { type: 'folder', name: part, path: acc, children: [] };
          cur.children.push(next);
        }
        cur = next;
      }
    });
  }

  // sort folders first, then files, alpha
  const sortNode = (node: TreeNode) => {
    if (node.type === 'folder') {
      node.children.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      node.children.forEach(sortNode);
    }
  };
  sortNode(root);
  return root;
}

function FolderView({
  node,
  lightMode,
  folderOpen,
  setFolderOpen,
  onSelectFile,
  activeFilePath,
  // context menu + rename come from IDEPage state
  setCtxMenu,
  renaming,
  setRenaming,
  onCommitRename,
  // drag/drop handlers are provided by IDEPage
  onFileDragStart,
  onFileDragEnd,
  onFolderDragOver,
  onFolderDragLeave,
  onFolderDrop,
}: {
  node: Extract<TreeNode, { type: 'folder' }>;
  lightMode: boolean;
  folderOpen: Record<string, boolean>;
  setFolderOpen: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onSelectFile: (path: string) => void;
  activeFilePath?: string;

  setCtxMenu: React.Dispatch<
    React.SetStateAction<null | { type: 'file' | 'folder'; path: string; x: number; y: number }>
  >;
  renaming: null | { path: string; value: string };
  setRenaming: React.Dispatch<React.SetStateAction<null | { path: string; value: string }>>;
  onCommitRename: () => void;

  onFileDragStart: (e: React.DragEvent, path: string) => void;
  onFileDragEnd: () => void;
  onFolderDragOver: (e: React.DragEvent, folderKey: string) => void;
  onFolderDragLeave: () => void;
  onFolderDrop: (e: React.DragEvent, folderKey: string) => void;
}) {
  const isRoot = node.path === '';
  const folderKey = node.path || '_root';
  const isOpen = folderOpen[folderKey] ?? true;

  return (
    <div className={isRoot ? '' : 'mb-2'}>
      {/* ===== FOLDER HEADER (click to toggle, right-click for menu, drop target) ===== */}
      {!isRoot && (
        <div
          className={`vscode-folder ${lightMode ? 'vscode-folder--light' : 'vscode-folder--dark'}`}
          onClick={() =>
            setFolderOpen(prev => ({ ...prev, [folderKey]: !isOpen }))
          }
          onContextMenu={(e) => {
            e.preventDefault();
            setCtxMenu({ type: 'folder', path: folderKey, x: e.clientX, y: e.clientY });
          }}
          onDragOver={(e) => onFolderDragOver(e, folderKey)}
          onDragLeave={onFolderDragLeave}
          onDrop={(e) => { e.stopPropagation(); onFolderDrop(e, folderKey); }}
          
          draggable
          onDragStart={(e) => {
            e.stopPropagation();
            try {
              if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/x-folder', folderKey);
              }
            } catch {}
            // visually you can also set a class here if you want
          }}
          onDragEnd={onFileDragEnd}

        >
          <Chevron open={isOpen} size={12} lightMode={lightMode} />
              {renaming?.path === folderKey ? (
                <input
                  autoFocus
                  value={renaming.value}
                  onChange={(e) => setRenaming({ path: folderKey, value: e.target.value })}
                  onBlur={onCommitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onCommitRename();
                    if (e.key === 'Escape') setRenaming(null);
                  }}
                  className={`vscode-rename ${lightMode ? 'text-slate-800' : 'text-slate-100'}`}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span>{node.name}</span>
              )}

        </div>
      )}

      {/* ===== CHILDREN ===== */}
      {isOpen && (
        <div className={isRoot ? '' : 'ml-4 mt-1'}>
          {node.children.map(child =>
            child.type === 'folder' ? (
              <FolderView
                key={child.path}
                node={child}
                lightMode={lightMode}
                folderOpen={folderOpen}
                setFolderOpen={setFolderOpen}
                onSelectFile={onSelectFile}
                activeFilePath={activeFilePath}
                setCtxMenu={setCtxMenu}
                renaming={renaming}
                setRenaming={setRenaming}
                onCommitRename={onCommitRename}
                onFileDragStart={onFileDragStart}
                onFileDragEnd={onFileDragEnd}
                onFolderDragOver={onFolderDragOver}
                onFolderDragLeave={onFolderDragLeave}
                onFolderDrop={onFolderDrop}
              />
            ) : (
              // ===== FILE ROW (compact, VS Code-like) =====
              <div
                key={child.path}
                className={`vscode-row ${
                  activeFilePath === child.path
                    ? (lightMode ? 'vscode-row--active-light' : 'vscode-row--active-dark')
                    : (lightMode ? 'vscode-row--light' : 'vscode-row--dark')
                }`}
                title={child.path}
                onClick={() => onSelectFile(child.path)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setCtxMenu({ type: 'file', path: child.path, x: e.clientX, y: e.clientY });
                }}
                draggable
                onDragStart={(e) => onFileDragStart(e, child.path)}
                onDragEnd={onFileDragEnd}
              >
                <span className="vscode-row__icon">📝</span>

                {/* Inline rename for file name */}
                {renaming?.path === child.path ? (
                  <input
                    autoFocus
                    value={renaming.value}
                    onChange={(e) => setRenaming({ path: child.path, value: e.target.value })}
                    onBlur={onCommitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onCommitRename();
                      if (e.key === 'Escape') setRenaming(null);
                    }}
                    className={`vscode-rename ${lightMode ? 'text-slate-800' : 'text-slate-100'}`}
                  />
                ) : (
                  <span className="vscode-row__label">{child.name}</span>
                )}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}


export default function IDEPage() {

// Store full project metadata so we can pick tooling & language for AI generation
const [projectMeta, setProjectMeta] = useState<any | null>(null);
const fallbackLang = defaultPrismLangFromMeta(projectMeta);


  // streaming brief + coordination
  const briefAbortRef = useRef<AbortController | null>(null);
  const [briefFinished, setBriefFinished] = useState(false);
  const [codeReady, setCodeReady] = useState(false);
  const streamMsgIndexRef = useRef<number | null>(null);
  const lastBriefRef = useRef<string>("");               // <-- add this
  const statusMsgIndexRef = useRef<number | null>(null);


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
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [aiFiles, setAiFiles] = useState<{ path: string; content: string }[]>([]);
  const [appliedMap, setAppliedMap] = useState<Record<string, { applied: boolean; revertId?: string }>>({});
  const [countdown, setCountdown] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Create dialog state
const [createOpen, setCreateOpen] = useState(false);
const [createKind, setCreateKind] = useState<'file'|'folder'>('file');
const [createPath, setCreatePath] = useState('');
const [createErr, setCreateErr] = useState<string | null>(null);
const createInputRef = useRef<HTMLInputElement | null>(null);
// VS Code–like context menu + inline rename
const [ctxMenu, setCtxMenu] = useState<null | {type:'file'|'folder', path:string, x:number, y:number}>(null);
const [renaming, setRenaming] = useState<null | {path:string, value:string}>(null);

// NEW: ref to the menu box so outside clicks don’t immediately close before button handlers run
const ctxMenuBoxRef = useRef<HTMLDivElement | null>(null);

// REPLACED: close-on-mousedown with a safer pointerdown that ignores presses inside the menu
useEffect(() => {
  function onPointerDown(e: MouseEvent) {
    const el = ctxMenuBoxRef.current;
    if (el && el.contains(e.target as Node)) return; // ignore clicks inside menu
    setCtxMenu(null);
  }
  function onEsc(e: KeyboardEvent) {
    if (e.key === 'Escape') { setCtxMenu(null); setRenaming(null); }
  }
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('keydown', onEsc);
  return () => {
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('keydown', onEsc);
  };
}, [setCtxMenu, setRenaming]);

// Is there anything under "folder/"?
const isFolderPath = (p: string) => files.some(f => f.path === `${p}/.gitkeep` || f.path.startsWith(`${p}/`));

// Given "a/b/c.txt" -> "a/b" ; given "a" -> "_root"
const parentOf = (p: string) => p.includes('/') ? p.split('/').slice(0,-1).join('/') : '_root';


const startRename = (path: string) => {
  setCtxMenu(null);
  setRenaming({ path, value: path.replace(/^.*\//, '') });
};

const commitRename = async () => {
  if (!renaming) return;

  const oldPath = renaming.path;                               // may be a FILE path or a FOLDER key
  const newName = renaming.value.trim();
  setRenaming(null);

  // no change?
  const oldLeaf = oldPath.replace(/^.*\//, '');
  if (!newName || newName === oldLeaf) return;

  // ---- CASE 1: file rename -------------------------------------------------
  const existingFile = files.find(f => f.path === oldPath);
  if (existingFile) {
    const parent = parentOf(oldPath);
    const toPath = parent === '_root' ? newName : `${parent}/${newName}`;

    // local update
    const content = existingFile.content ?? '';
    setFiles(prev => [...prev.filter(f => f.path !== oldPath), { path: toPath, content }]);
    if (activeFile?.path === oldPath) setActiveFile({ path: toPath, content });

    // persist to backend
    try {
      if (projectId) {
        const toUrl   = `${backendBase}/api/projects/${encodeURIComponent(String(projectId))}/files/${encodeURIComponent(toPath)}`;
        const fromUrl = `${backendBase}/api/projects/${encodeURIComponent(String(projectId))}/files/${encodeURIComponent(oldPath)}`;
        await fetch(toUrl, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ content }) });
        await fetch(fromUrl, { method:'DELETE' });
      }
    } catch {}
    return;
  }

  // ---- CASE 2: folder rename ----------------------------------------------
  // `oldPath` here is the folder key used in FolderView (e.g., "src/pages")
  if (!isFolderPath(oldPath)) return;

  const parent = parentOf(oldPath);
  const newFolderKey = parent === '_root' ? newName : `${parent}/${newName}`;

  // Update every file under old folder -> new folder
  const prefix = `${oldPath}/`;
  const keepOld = `${oldPath}/.gitkeep`;
  const keepNew = `${newFolderKey}/.gitkeep`;

  const updates: { from: string; to: string; content: string }[] = [];
  setFiles(prev => {
    const next: FileItem[] = [];
    for (const f of prev) {
      if (f.path === keepOld) {
        // move the keep file as well
        updates.push({ from: keepOld, to: keepNew, content: f.content ?? '' });
        next.push({ path: keepNew, content: f.content ?? '' });
        continue;
      }
      if (f.path.startsWith(prefix)) {
        const suffix = f.path.substring(prefix.length); // "x/y.ts"
        const to = `${newFolderKey}/${suffix}`;
        updates.push({ from: f.path, to, content: f.content ?? '' });
        next.push({ path: to, content: f.content ?? '' });
        // update active tab if needed
        if (activeFile?.path === f.path) setActiveFile({ path: to, content: f.content ?? '' });
      } else {
        next.push(f);
      }
    }
    return next;
  });

  // persist: PUT each new file then DELETE each old
  try {
    if (projectId) {
      for (const u of updates) {
        const putUrl = `${backendBase}/api/projects/${encodeURIComponent(String(projectId))}/files/${encodeURIComponent(u.to)}`;
        const delUrl = `${backendBase}/api/projects/${encodeURIComponent(String(projectId))}/files/${encodeURIComponent(u.from)}`;
        await fetch(putUrl, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ content: u.content }) });
        await fetch(delUrl, { method:'DELETE' });
      }
    }
  } catch {}
};

const deletePath = (path: string) => {
  setCtxMenu(null);
  setDeleteTarget(path);
  setDeleteOpen(true);
};


useEffect(() => {
  if (createOpen) setTimeout(() => createInputRef.current?.focus(), 0);
}, [createOpen]);

const suggestedFolder = () => {
  const base = activeFile?.path?.includes('/')
    ? activeFile.path.split('/').slice(0, -1).join('/') + '/'
    : '';
  return base;
};

// Simple validators
const validateFile = (value: string) => {
  const v = value.trim();
  if (!v) return 'Enter a file path.';
  if (v.endsWith('/')) return 'This looks like a folder; remove the trailing slash.';
  if (files.some(f => f.path === v)) return 'A file with that path already exists.';
  return null;
};
const validateFolder = (value: string) => {
  const v = value.trim().replace(/^\/+|\/+$/g, '');
  if (!v) return 'Enter a folder path.';
  const alreadyHasItems = files.some(f => f.path.startsWith(v + '/'));
  if (alreadyHasItems) return 'That folder already exists.';
  return null;
};

const openCreate = (kind: 'file'|'folder') => {
  setCreateKind(kind);
  setCreateErr(null);
  setCreatePath(kind === 'file' ? suggestedFolder() : '');
  setCreateOpen(true);
};

// Confirm action
const confirmCreate = async () => {
  setCreateErr(null);
  if (createKind === 'file') {
    const err = validateFile(createPath);
    if (err) return setCreateErr(err);
    const path = createPath.trim().replace(/^\/+/, '');
    const newItem: FileItem = { path, content: '' };
    setFiles(prev => [...prev, newItem]);
    setActiveFile(newItem);
    setDirtyPaths(prev => new Set(prev).add(path));
    try {
      if (projectId) {
        const url = `${backendBase}/api/projects/${encodeURIComponent(String(projectId))}/files/${encodeURIComponent(path)}`;
        await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: '' }) });
      }
    } catch {}
  } else {
    const err = validateFolder(createPath);
    if (err) return setCreateErr(err);
    const folder = createPath.trim().replace(/^\/+|\/+$/g, '');
    const keepPath = `${folder}/.gitkeep`;
    setFiles(prev => [...prev, { path: keepPath, content: '' }]);
    try {
      if (projectId) {
        const url = `${backendBase}/api/projects/${encodeURIComponent(String(projectId))}/files/${encodeURIComponent(keepPath)}`;
        await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: '' }) });
      }
    } catch {}
  }
  setCreateOpen(false);
};

const cancelCreate = () => {
  setCreateOpen(false);
};


  // Chat scroll ref
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Composer auto-resize
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  // --- NEW: track unsaved files (MOVED inside component) ---
  const [dirtyPaths, setDirtyPaths] = useState<Set<string>>(new Set());

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = '0px';
    const next = Math.min(el.scrollHeight, 200);
    el.style.height = next + 'px';
  }, [scenario]);

  useEffect(() => {
  if (chatScrollRef.current) {
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }
  }, [messages, aiFiles]);


  // File explorer / editor state
  const { query } = useRouter();
  const projectId = query.projectId as string | undefined;
  const [projectName, setProjectName] = useState<string | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFile, setActiveFile] = useState<FileItem | null>(null);
  // Store full project metadata so we can pick tooling & language for AI generation
 

  // Move UI
  const [moveTargetOpenFor, setMoveTargetOpenFor] = useState<string | null>(null);
  const [moveSourceType, setMoveSourceType] = useState<'file' | 'folder' | null>(null);
  const [draggedFilePath, setDraggedFilePath] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);

  // Theme
  const [lightMode, setLightMode] = useState(true);
  const [modeMenuOpen] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // --- Save handler (clears dirty for the file) ---
  const handleSave = React.useCallback(async () => {
    if (!activeFile || !projectId) return;
    try {
  // use shared backendBase from lib/api
      const url = `${backendBase}/api/projects/${encodeURIComponent(String(projectId))}/files/${encodeURIComponent(activeFile.path)}`;

      await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: activeFile.content ?? "" }),
      });

      // keep tabs/explorer in sync with the saved content
      setFiles(prev => prev.map(f => f.path === activeFile.path ? { ...f, content: activeFile.content ?? "" } : f));

      // clear dirty flag for this file
      setDirtyPaths(prev => {
        const next = new Set(prev);
        next.delete(activeFile.path);
        return next;
      });

      setSaveMessage("✨ Code saved successfully!");
      setTimeout(() => setSaveMessage(null), 2500);
    } catch {
      setSaveMessage("❌ Failed to save file");
      setTimeout(() => setSaveMessage(null), 2500);
    }
  }, [activeFile, projectId, setFiles]);


function safeIdent(name?: string) {
  const base = (name || 'MyProject').trim();
  return base
    .replace(/[^A-Za-z0-9_]+/g, "_") // no 'u' flag, no \p{…}
    .replace(/^(\d)/, "_$1");        // no leading digit
}

  function slowTypeIntoNewAssistantMessage(text: string, durationMs = 30000) {
  let idx = -1;
  setMessages(prev => {
    idx = prev.length;
    return [...prev, { role: 'assistant', content: '' }];
  });

  const start = performance.now();
  const total = text.length || 1;

  function step(now: number) {
    const elapsed = now - start;
    const progress = Math.min(1, elapsed / durationMs);
    const chars = Math.max(1, Math.floor(total * progress));
    const slice = text.slice(0, chars);

    setMessages(prev => {
      if (!prev[idx]) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], content: slice };
      return next;
    });

    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}


  async function streamAgentBrief(projectId: string, promptText: string) {
  setBriefFinished(false);

  // Insert a blank assistant message and capture its index synchronously
  let insertIndex = -1;
  setMessages(prev => {
    insertIndex = prev.length;
    streamMsgIndexRef.current = insertIndex;
    return [...prev, { role: "assistant", content: "\n" }];
  });

  const bac = new AbortController();
  briefAbortRef.current = bac;

  const res = await fetch(`${backendBase}/api/ai/agent-brief`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, prompt: promptText }),
    signal: bac.signal,
  });

  const reader = res.body?.getReader();
  if (!reader) { setBriefFinished(true); return; }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";

    for (const p of parts) {
      const t = p.replace(/^data:/, "");
      if (t === "[DONE]") continue;

      const i = streamMsgIndexRef.current ?? insertIndex;
      setMessages(prev => {
        if (!prev[i]) return prev;
        const next = [...prev];
        next[i] = { ...next[i], content: next[i].content + t };
        return next;
      });
    }
  }

  // Final sanitize and store the brief into a ref for the next step
  {
    const i = streamMsgIndexRef.current ?? insertIndex;
    let finalBriefLocal = "";
    setMessages(prev => {
      if (!prev[i]) return prev;
      const next = [...prev];
      const sanitized = sanitizeAnswer(next[i].content, promptText);
      finalBriefLocal = sanitized;
      next[i] = { ...next[i], content: sanitized };
      return next;
    });
    lastBriefRef.current = (finalBriefLocal || "").trim();
  }

  setBriefFinished(true);
}


  // Ctrl/Cmd+S to save

  useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    // Save
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      handleSave();
      return;
    }
    // Rename (F2) the active file in tabs (simple version)
    if (e.key === 'F2' && activeFile) {
      e.preventDefault();
      startRename(activeFile.path);
      return;
    }
    // Delete (Del) active file
    if (e.key === 'Delete' && activeFile) {
      e.preventDefault();
      openDelete(activeFile.path);
      return;
    }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [handleSave, activeFile]);

  // useEffect(() => {
  //   const onKey = (e: KeyboardEvent) => {
  //     if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
  //       e.preventDefault();
  //       handleSave();
  //     }
  //   };
  //   window.addEventListener('keydown', onKey);
  //   return () => window.removeEventListener('keydown', onKey);
  // }, [handleSave]);

  // Warn on page close/refresh if any unsaved edits
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtyPaths.size > 0) {
        e.preventDefault();
        e.returnValue = ""; // required for Chrome
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirtyPaths]);

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
          // Save the loaded project metadata for later use (tooling/language)
          setProjectMeta(res.data);
        } else {
          setProjectName(null);
          setFiles([]);
          setActiveFile(null);
          setProjectMeta(null);
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
  }, [messages, aiFiles, isRunning]);


  // File actions popover / modals
const [fileMenuFor, setFileMenuFor] = useState<string|null>(null);

const [moveOpen, setMoveOpen] = useState(false);
const [movingFrom, setMovingFrom] = useState<string|null>(null);
const [moveTargetFolder, setMoveTargetFolder] = useState<string>('_root');
const [moveNewName, setMoveNewName] = useState<string>('');

const [deleteOpen, setDeleteOpen] = useState(false);
const [deleteTarget, setDeleteTarget] = useState<string|null>(null);

// Build a list of existing folders (plus root)
const allFolders = React.useMemo(() => {
  const s = new Set<string>(['_root']);
  files.forEach(f => {
    const parts = f.path.split('/'); parts.pop();
    let acc = '';
    parts.forEach(p => { acc = acc ? `${acc}/${p}` : p; s.add(acc); });
  });
  return Array.from(s).sort((a,b)=>a.localeCompare(b));
}, [files]);

const openMove = (path: string) => {
  setFileMenuFor(null);
  setMovingFrom(path);
  setMoveTargetFolder(path.includes('/') ? path.split('/').slice(0,-1).join('/') : '_root');
  setMoveNewName(path.replace(/^.*\//,''));
  setMoveOpen(true);
};

const confirmMove = async () => {
  if (!movingFrom) return;
  const name = (moveNewName || movingFrom.replace(/^.*\//,'')).trim();
  const toPath = (moveTargetFolder === '_root' ? name : `${moveTargetFolder}/${name}`).replace(/^\/+/, '');
  if (!name || toPath === movingFrom) { setMoveOpen(false); return; }

  // Local update
  const old = files.find(f => f.path === movingFrom);
  const content = old?.content ?? '';
  setFiles(prev => [...prev.filter(f => f.path !== movingFrom), { path: toPath, content }]);
  if (activeFile?.path === movingFrom) setActiveFile({ path: toPath, content });
  setDirtyPaths(prev => {
    const next = new Set(prev);
    if (next.has(movingFrom)) { next.delete(movingFrom); next.add(toPath); }
    return next;
  });

  // Persist (PUT new + DELETE old)
  try {
    if (projectId) {
      const toUrl = `${backendBase}/api/projects/${encodeURIComponent(String(projectId))}/files/${encodeURIComponent(toPath)}`;
      const fromUrl = `${backendBase}/api/projects/${encodeURIComponent(String(projectId))}/files/${encodeURIComponent(movingFrom)}`;
      await fetch(toUrl, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ content }) });
      await fetch(fromUrl, { method: 'DELETE' });
    }
  } catch {}
  setMoveOpen(false);
};

const openDelete = (path: string) => {
  setFileMenuFor(null);
  setDeleteTarget(path);
  setDeleteOpen(true);
};

const confirmDelete = async () => {
  if (!deleteTarget) return;

  // File?
  const file = files.find(f => f.path === deleteTarget);

  if (file) {
    // local
    setFiles(prev => prev.filter(f => f.path !== deleteTarget));
    if (activeFile?.path === deleteTarget) setActiveFile(null);
    setDirtyPaths(prev => { const n = new Set(prev); n.delete(deleteTarget); return n; });

    // persist
    try {
      if (projectId) {
        const url = `${backendBase}/api/projects/${encodeURIComponent(String(projectId))}/files/${encodeURIComponent(deleteTarget)}`;
        await fetch(url, { method: 'DELETE' });
      }
    } catch {}
  } else {
    // Folder delete: remove everything under "folder/"
    const prefix = `${deleteTarget}/`;
    const toRemove = files.filter(f => f.path === `${deleteTarget}/.gitkeep` || f.path.startsWith(prefix));
    if (toRemove.length) {
      // local
      setFiles(prev => prev.filter(f => !(f.path === `${deleteTarget}/.gitkeep` || f.path.startsWith(prefix))));
      if (activeFile && (activeFile.path === `${deleteTarget}/.gitkeep` || activeFile.path.startsWith(prefix))) {
        setActiveFile(null);
      }
      setDirtyPaths(prev => {
        const n = new Set(prev);
        toRemove.forEach(f => n.delete(f.path));
        return n;
      });

      // persist each file delete
      try {
        if (projectId) {
          for (const f of toRemove) {
            const url = `${backendBase}/api/projects/${encodeURIComponent(String(projectId))}/files/${encodeURIComponent(f.path)}`;
            await fetch(url, { method: 'DELETE' });
          }
        }
      } catch {}
    }
  }

  setDeleteOpen(false);
};


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
        return 'java' as unknown as Language;
      case 'css':
        return 'css';
      case 'html':
        return 'markup';
      case 'json':
        return 'json';
      case 'md':
        return 'markdown';
        case 'cs':
        return 'csharp' as unknown as Language;
      case 'yml':
      case 'yaml':
        return 'yaml' as unknown as Language;
      default:
        return 'javascript';
    }
  }

  // Helpers to pick the preferred tool and language from project metadata
  function pickTool(proj: any): string {
    if (!proj) return 'Playwright';
    const tools: string[] = (proj.tooling ?? proj.tools ?? []) as string[];
    if (!tools || tools.length === 0) return 'Playwright';
    if (tools.some(t => /^selenium$/i.test(t))) return 'Selenium';
    if (tools.some(t => /^playwright$/i.test(t))) return 'Playwright';
    if (tools.some(t => /^cypress$/i.test(t))) return 'Cypress';
    return tools[0];
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

// 🔧 CHANGE: persist folder moves just like rename does
function moveFolderTo(folderName: string, targetFolder: string) {
  if (folderName === targetFolder) return;

  const prefix = `${folderName}/`;
  const newPrefix = targetFolder === '_root'
    ? `${folderName}/` // moving under root keeps the same leaf (we'll rebuild below)
    : `${targetFolder}/${folderName.split('/').pop()}/`;

  // Build "updates" first so we can persist after setState
  const updates: { from: string; to: string; content: string }[] = [];

  setFiles(prev => {
    const items = prev.map(i => ({ ...i }));
    // all files inside source folder:
    const moved = items.filter(x => x.path.startsWith(prefix));
    if (moved.length === 0) return prev;

    const next: FileItem[] = [];
    for (const f of items) {
      if (f.path.startsWith(prefix)) {
        const suffix = f.path.substring(prefix.length);
        const to = `${newPrefix}${suffix}`.replace(/\/+/g, '/');
        updates.push({ from: f.path, to, content: f.content ?? '' });
        next.push({ path: to, content: f.content ?? '' });

        if (activeFile?.path === f.path) {
          // keep active file in sync
          setActiveFile({ path: to, content: f.content ?? '' });
        }
      } else {
        next.push(f);
      }
    }
    return next;
  });

  // Remap folder open state (so same “open/closed” visual continues)
  setFolderOpen(prev => {
    const m = { ...prev };
    // carry over state for leaf key if present
    const oldKey = folderName;
    const newKey = targetFolder === '_root'
      ? folderName.split('/').pop()!
      : `${targetFolder}/${folderName.split('/').pop()!}`;
    if (m[oldKey] !== undefined) {
      m[newKey] = m[oldKey];
      delete m[oldKey];
    }
    return m;
  });

  // 🔧 Persist the move on the backend by PUTting new paths then DELETEting old ones
  (async () => {
    try {
      if (projectId) {
        for (const u of updates) {
          const putUrl = `${backendBase}/api/projects/${encodeURIComponent(String(projectId))}/files/${encodeURIComponent(u.to)}`;
          const delUrl = `${backendBase}/api/projects/${encodeURIComponent(String(projectId))}/files/${encodeURIComponent(u.from)}`;
          await fetch(putUrl, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ content: u.content }) });
          await fetch(delUrl, { method: 'DELETE' });
        }
      }
    } catch {}
  })();

  setMoveTargetOpenFor(null);
  setMoveSourceType(null);
}


  // --- Create a new file (UI-first, optional persist) ---
const createNewFile = async () => {
  // suggest the active file’s folder if any
  const suggestedFolder = activeFile?.path.includes("/")
    ? activeFile.path.split("/").slice(0, -1).join("/") + "/"
    : "";

  const input = window.prompt(
    "New file path (e.g., src/utils/helpers.ts):",
    suggestedFolder
  );
  if (!input) return;

  const path = input.trim().replace(/^\/+/, "");
  if (!path || /\/$/.test(path)) {
    alert("Please provide a valid file path (not a folder).");
    return;
  }
  if (files.some((f) => f.path === path)) {
    alert("A file with that path already exists.");
    return;
  }

  const newItem: FileItem = { path, content: "" };
  setFiles((prev) => [...prev, newItem]);
  setActiveFile(newItem);
  setDirtyPaths((prev) => {
    const next = new Set(prev);
    next.add(path);
    return next;
  });

  // Try to create it on the backend (safe to ignore failures)
  try {
    if (projectId) {
      const url = `${backendBase}/api/projects/${encodeURIComponent(
        String(projectId)
      )}/files/${encodeURIComponent(path)}`;
      await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "" }),
      });
    }
  } catch {
    // staying silent; file still exists in UI and marked dirty
  }
};

// --- Create a new folder (uses a hidden keep file so it shows up in explorer) ---
const createNewFolder = async () => {
  const input = window.prompt(
    "New folder (e.g., src/components or tests/e2e):",
    ""
  );
  if (!input) return;

  const folder = input.trim().replace(/^\/+|\/+$/g, "");
  if (!folder) return;

  // If something already exists with that prefix, we don't need a keep file
  const alreadyHasItems = files.some((f) => f.path.startsWith(folder + "/"));
  if (alreadyHasItems) {
    alert("Folder already exists (it contains files).");
    return;
  }

  const keepPath = `${folder}/.gitkeep`;
  // prevent duplicates
  if (files.some((f) => f.path === keepPath)) return;

  const placeholder: FileItem = { path: keepPath, content: "" };
  setFiles((prev) => [...prev, placeholder]);

  try {
    if (projectId) {
      const url = `${backendBase}/api/projects/${encodeURIComponent(
        String(projectId)
      )}/files/${encodeURIComponent(keepPath)}`;
      await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "" }),
      });
    }
  } catch {
    // ignore; folder still appears in UI via the placeholder
  }
};

// --- Optional: nicer refresh that re-fetches project (or keep your reload) ---
const refreshProject = async () => {
  if (!projectId) return;
  setLoading(true);
  try {
    const res = await getProject(projectId);
    if (res?.data) {
      setProjectName(res.data.name || null);
      const fetchedFiles = (res.data as any).files ?? [];
      setFiles(fetchedFiles);
      setActiveFile(null);
      setProjectMeta(res.data);
    }
  } finally {
    setLoading(false);
  }
};


  // Drag helpers (UPGRADED)
  function handleDragStart(e: React.DragEvent, fpath: string) {
    e.stopPropagation();
    try {
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', fpath);
      }
    } catch {}
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
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    if (dragOverTarget !== targetKey) setDragOverTarget(targetKey);
  }
  function handleDragLeaveTarget() { setDragOverTarget(null); }
  function handleDropOnTarget(e: React.DragEvent, targetKey: string) {
    e.preventDefault();
    e.stopPropagation();
    const filePath   = e.dataTransfer?.getData('text/plain')     || null;
    const folderPath = e.dataTransfer?.getData('text/x-folder')  || null;

    if (filePath) moveFileTo(filePath, targetKey);
    else if (folderPath && folderPath !== targetKey) {
      // Move folder (with persistence via moveFolderTo)
      const src = folderPath;
      if (src === targetKey || targetKey.startsWith(src + '/')) return; // prevent moving into itself
      moveFolderTo(src, targetKey);
    }
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
    setMessages([]);
    setAiFiles([]);
    setAppliedMap({});
    setCountdown(null);
    setMessages(prev => [...prev, { role: 'user', content: promptText }]); // push user message

  const toolToUse = pickTool(projectMeta);
const langToUse = pickLanguage(projectMeta);
const projName = projectName || 'MyProject';
const nsName = safeIdent(projectName ?? undefined);

const askPrompt = [
  `Context: Use ONLY ${toolToUse} with ${langToUse}.`,
  `Project name: "${projName}" (namespace-safe: ${nsName}). Use the *project name*, not the id, in any headers/namespaces.`,
  `Be concise. Answer crisply with tight bullets or a short code block.`,
  ``,
  promptText
].join("\n");

    
    try {
  // use shared backendBase from lib/api
      if (mode === 'ask') {

        const ac = new AbortController();
          abortControllerRef.current = ac;
          const res = await fetch(`${backendBase}/api/ai/ask`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    projectId,
    projectName: projName,
    prompt: askPrompt,
    context: { tool: toolToUse, language: langToUse, projectName: projName, namespace: nsName }
  }),
  signal: ac.signal,
});

        if (!res.ok) {
          const txt = await res.text();
          setMessages(prev => [...prev, { role: 'assistant', content: 'Error: ' + txt }]);
          setIsRunning(false);
          return;
        }

        const json = await res.json();
        const raw = (json && (json.answer ?? json.generated ?? json.generatedCode)) || JSON.stringify(json);
        const cleaned = sanitizeAnswer(String(raw), promptText); // <-- removes echoed question + adds leading newline
        setAiFiles([]);
        setMessages(prev => [...prev, { role: 'assistant', content: cleaned }]);

      } 
      
      else {
  const toolToUse = pickTool(projectMeta);
  const langToUse = pickLanguage(projectMeta);
  const projName = projectName || 'MyProject';
  const nsName = safeIdent(projectName ?? undefined);

  setBriefFinished(false);
  setCodeReady(false);

  // 1) Get the brief (await), with stack constraints
 const briefPrompt = [
  `Context: Use ONLY ${toolToUse} with ${langToUse}.`,
  `Project name: "${projName}" (namespace-safe: ${nsName}). Use the name, not the id.`,
  `Keep the plan crisp; bullets only; no filler.`,
  ``,
  promptText
].join("\n");

  await streamAgentBrief(projectId, briefPrompt);

  // 2) Insert a status message while we generate code
  let statusIndex = -1;
  setMessages(prev => {
    statusIndex = prev.length;
    statusMsgIndexRef.current = statusIndex;
    return [
      ...prev,
      {
        role: "assistant",
        content: "🔧 Generating code files based on the plan… this can take a moment."
      }
    ];
  });

  // 3) Build the code-gen prompt from the exact brief
  const plan = (lastBriefRef.current || "(no plan)").trim();
  const genPrompt = [
  `User request: ${promptText}`,
  `Project: "${projName}" (namespace-safe: ${nsName}).`,
  `Follow EXACTLY the plan below using ${toolToUse} + ${langToUse}. Do not introduce other tools/frameworks.`,
  `---BEGIN PLAN---`,
  plan,
  `---END PLAN---`,
  `Generate only the files implementing this plan.`,
  `Add this header to each file: // Project: ${projName}`,
  `When a namespace or package is needed, use: ${nsName}`
].join("\n");


  const ac2 = new AbortController();
  abortControllerRef.current = ac2;

  try {
    const res = await fetch(`${backendBase}/api/ai/generate-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        tool: toolToUse,
        language: langToUse,
        prompt: genPrompt
      }),
      signal: ac2.signal,
    });

    if (!res.ok) {
      const txt = await res.text();
      // replace the status with an error
      setMessages(prev => {
        const next = [...prev];
        const i = statusMsgIndexRef.current ?? -1;
        if (i >= 0 && next[i]) next[i] = { role: "assistant", content: `❌ Code generation failed: ${txt}` };
        else next.push({ role: "assistant", content: `❌ Code generation failed: ${txt}` });
        return next;
      });
      return;
    }

    const json = await res.json();
    const content = json.generatedCode ?? json.generated ?? json;
    let parsed: { path: string; content: string }[] = [];
    try { parsed = typeof content === "string" ? JSON.parse(content) : content; } catch {}

    setAiFiles(parsed || []);
    setCodeReady(true);

    // ✅ Replace the status message with the final banner
    setMessages(prev => {
      const next = [...prev];
      const i = statusMsgIndexRef.current ?? -1;
      const banner = "✅ All set! Here are your generated files. Use **Apply** to write them to the project or **Revert** to undo.";
      if (i >= 0 && next[i]) next[i] = { role: "assistant", content: banner };
      else next.push({ role: "assistant", content: banner });
      return next;
    });

  } catch (err: any) {
    if (err?.name === "AbortError") {
      setMessages(prev => [...prev, { role: "assistant", content: "Generation canceled" }]);
    } else {
      setMessages(prev => [...prev, { role: "assistant", content: "Generation failed: " + (err?.message || String(err)) }]);
    }
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
    if (briefAbortRef.current) briefAbortRef.current.abort();  
    setIsRunning(false);
  }

  async function autoApplyAll(parsedFiles: { path: string; content: string }[]) {
    if (!projectId) return;
  // use shared backendBase from lib/api
    try {
      const res = await fetch(`${backendBase}/api/ai/apply-code`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, files: parsedFiles, message: scenario }) });
      const json = await res.json();
      if (res.ok) {
        const revertId = json.revertId as string | undefined;
        const m: Record<string, { applied: boolean; revertId?: string }> = {};
        parsedFiles.forEach(f => m[f.path] = { applied: true, revertId });
        setAppliedMap(m);

        // Merge applied files into current file list so explorer reflects changes immediately
        setFiles(prev => {
          const map = new Map<string, FileItem>();
          prev.forEach(pf => map.set(pf.path, { ...pf }));
          parsedFiles.forEach(f => map.set(f.path, { path: f.path, content: f.content }));
          return Array.from(map.values());
        });

        // Optionally open the first applied file
        if (parsedFiles.length > 0) {
          const first = parsedFiles[0];
          setActiveFile({ path: first.path, content: first.content });
        }
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Auto-apply error: ' + JSON.stringify(json) }]);
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Auto-apply failed: ' + (err.message || String(err)) }]);
    }
  }

  async function applyFileNow(f: { path: string; content: string }) {
    if (!projectId) return;
  // use shared backendBase from lib/api
    try {
      const res = await fetch(`${backendBase}/api/ai/apply-code`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, files: [f], message: 'Applied single file ' + f.path }) });
      const json = await res.json();
      if (res.ok) {
        setAppliedMap(m => ({ ...m, [f.path]: { applied: true, revertId: json.revertId } }));

        // Merge/insert the applied file into the explorer list and keep content in sync
        setFiles(prev => {
          const found = prev.find(p => p.path === f.path);
          if (found) {
            return prev.map(p => p.path === f.path ? { path: f.path, content: f.content } : p);
          }
          return [...prev, { path: f.path, content: f.content }];
        });

        // If the active file is the same path, update its content
        setActiveFile(prev => prev && prev.path === f.path ? { path: f.path, content: f.content } : prev);
      }
    } catch {}
  }

  async function revertFile(f: { path: string; content: string }) {
    const info = appliedMap[f.path];
    if (!info?.revertId) return;
  // use shared backendBase from lib/api
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
      <main className={`app-root ide-page w-full ${lightMode ? 'theme-light bg-slate-50' : 'theme-dark'}`} style={{ background: lightMode ? undefined : 'var(--vscode-bg)' }}>
        <div className={`${lightMode ? 'bg-white border-b border-slate-200' : 'bg-[var(--vscode-panel)] border-[var(--vscode-border)]'} flex-shrink-0 px-6 py-3`}>
          <div className="max-w-[1100px] mx-auto flex items-center justify-between">
            <h1 className={`text-2xl font-semibold ${lightMode ? 'text-slate-800' : 'text-[var(--vscode-text)]'}`}>IDE & AI Assistance</h1>
            <div className="flex items-center gap-2">
              <button disabled 
              // onClick={() => setLightMode(l => !l)} 
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" title={lightMode ? "Switch to Dark Mode" : "Switch to Light Mode"}> {lightMode ? (<Moon className="w-5 h-5 text-slate-600" />) : (<Sun className="w-5 h-5 text-yellow-400" />)}</button>
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
                    <ActionIcon title="New file" onClick={() => openCreate('file')} lightMode={lightMode}>
                      <Plus className="w-4 h-4" />
                    </ActionIcon>
                    <ActionIcon title="New folder" onClick={() => openCreate('folder')} lightMode={lightMode}>
                      <FolderPlus className="w-4 h-4" />
                    </ActionIcon>
                    <ActionIcon title="Refresh" onClick={refreshProject} lightMode={lightMode}>
                      <RefreshCw className="w-4 h-4" />
                    </ActionIcon>
                  </div>
                </div>

                <div className="px-3 py-3 border-b border-transparent">
                  {(() => {
                        // Build a proper folder/file tree from the flat list
                        const tree = buildTree(files);
                        const root = tree as Extract<TreeNode, { type: 'folder' }>;

                        return (
                          <div
                            className={`font-medium text-sm flex flex-col gap-2 ${
                              lightMode ? 'text-slate-700' : 'text-[var(--vscode-text)]'
                            }`}
                          >
                            {/* Project header row (kept simple & always open) */}
                            <div
                              className="flex items-center gap-2 cursor-default select-none"
                              style={{ userSelect: 'none' }}
                            >
                              <Chevron open={true} size={14} lightMode={lightMode} />
                              {projectName ?? 'TestingTarun'}
                            </div>

                            {/* Recursive tree showing nested folders: src/pages, src/tests, etc. */}
                            <div className="text-sm mt-1">
                              <FolderView
                                  node={root}
                                  lightMode={lightMode}
                                  folderOpen={folderOpen}
                                  setFolderOpen={setFolderOpen}
                                  onSelectFile={(path) => {
                                    const f = files.find((x) => x.path === path);
                                    if (f) setActiveFile(f);
                                  }}
                                  activeFilePath={activeFile?.path}

                                  setCtxMenu={setCtxMenu}
                                  renaming={renaming}
                                  setRenaming={setRenaming}
                                  onCommitRename={commitRename}

                                  onFileDragStart={(e, path) => handleDragStart(e, path)}
                                  onFileDragEnd={handleDragEnd}
                                  onFolderDragOver={(e, key) => handleDragOverTarget(e, key)}
                                  onFolderDragLeave={handleDragLeaveTarget}
                                  onFolderDrop={(e, key) => handleDropOnTarget(e, key)}
                                />

                            </div>
                          </div>
                        );
                      })()}
                </div>
              </div>
              </div>

              {/* Code view + Assistant */}
              <SplitPane split="vertical" minSize={300} defaultSize="60%" pane1Style={{ borderRight: lightMode ? '1px solid #e5e7eb' : '1px solid var(--vscode-border)'}} paneStyle={{ height: '100%' }}>
                {/* Code panel */}
                <div className={`flex-1 h-full flex flex-col overflow-hidden ${lightMode ? 'bg-white border-r border-slate-200 shadow-sm' : 'border-r border-slate-700/40'}`} style={{ background: lightMode ? undefined : 'var(--vscode-panel)' }}>
                  <div className={`mb-0 ${lightMode ? 'bg-white/90 backdrop-blur border-slate-200 border-b' : 'bg-[var(--vscode-panel)] border-[var(--vscode-border)]'}`}>
                    <div className="flex items-center justify-between px-4 h-11 gap-4">
                      <div className="flex overflow-x-auto flex-1">
                        {files.length === 0 ? (
                          <div className={`px-2 py-2 text-sm ${lightMode ? 'text-slate-500' : 'text-slate-400'}`}>No files open</div>
                        ) : files.map((f) => (
                          <button
                            key={`tab-${f.path}`}
                            onClick={() => setActiveFile(f)}
                            className={`px-5 py-2 text-sm font-medium transition-all duration-200 whitespace-nowrap flex items-center gap-2 ${
                                activeFile?.path === f.path
                                  ? (lightMode
                                      ? 'border-b-2 border-blue-500 text-blue-700 bg-blue-50'
                                      : 'text-[var(--vscode-text)] border-0 bg-transparent')
                                  : (lightMode
                                      ? 'border-b-2 border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                      : 'text-slate-400 hover:text-[var(--vscode-text)] hover:bg-slate-700/30 border-0 bg-transparent')
                              }`}
                          >
                            <span>
                              {f.path.endsWith('.tsx') || f.path.endsWith('.ts') ? '⚛️' :
                               f.path.endsWith('.js') || f.path.endsWith('.jsx') ? '🟨' :
                               f.path.endsWith('.css') ? '🎨' :
                               f.path.endsWith('.json') ? '📄' : '📝'}
                            </span>
                            {/* Dirty dot + path */}
                            <span className="whitespace-nowrap">
                              {dirtyPaths.has(f.path) ? "• " : ""}
                              {f.path}
                            </span>
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {saveMessage && (
                          <span
                            className="px-3 py-1 rounded-md text-sm font-medium bg-green-600 text-white shadow-md animate-fade-in"
                            style={{ whiteSpace: "nowrap" }}
                          >
                            {saveMessage}
                          </span>
                        )}

                        {/* NEW: Unsaved changes badge */}
                        {activeFile && dirtyPaths.has(activeFile.path) && (
                          <span className="px-2 py-1 rounded-md text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                            Unsaved changes
                          </span>
                        )}

                        <button
                          onClick={handleSave}
                          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                            lightMode
                              ? "bg-blue-600 hover:bg-blue-700 text-white"
                              : "bg-blue-500 hover:bg-blue-400 text-[var(--vscode-text)]"
                          }`}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-hidden">
                    {activeFile ? (
                      <div className="h-full min-h-0 overflow-hidden code-panel">
                        <Editor
                          value={activeFile?.content ?? ""}
                          onValueChange={(code) => {
                            if (!activeFile) return;
                            setActiveFile({ ...activeFile, content: code });
                            setDirtyPaths(prev => {
                              const next = new Set(prev);
                              next.add(activeFile.path);
                              return next;
                            });
                          }}
                          highlight={(code) => (
                            <Highlight
                              {...defaultProps}
                              code={code}
                              language={langFromPath(activeFile?.path ?? "")}
                              theme={lightMode ? lightPrismNoBG : darkPrismNoBG}
                            >
                              {({ className, style, tokens, getLineProps, getTokenProps }) => (
                                <pre
                                  className={`${className} editor-pre`}
                                  style={{ ...style, margin: 0, background: 'transparent', backgroundColor: 'transparent', border: 'none',boxShadow: 'none',borderRadius: 0 }}
                                >
                                  {tokens.map((line, i) => (
                                    <div key={i} {...getLineProps({ line })}>
                                      {line.map((token, key) => (
                                        <span key={key} {...getTokenProps({ token })} />
                                      ))}
                                    </div>
                                  ))}
                                </pre>
                              )}
                            </Highlight>
                          )}
                          padding={12}
                          className="w-full h-full font-mono text-sm"
                          style={{
                            minHeight: "100%",
                            outline: "none",
                            overflow: "auto",
                            background: lightMode ? "#ffffff" : "var(--vscode-panel)",
                            caretColor: lightMode ? "#000" : "#fff", // white caret in dark
                            border: 'none',
                            boxShadow: 'none',
                            borderRadius: 0
                          }}
                        />
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <div className="text-5xl mb-3">📁</div>
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
                            return (
                              <div key={idx} className="mt-4">
                                <AIAnswerRenderer answer={m.content} lightMode={lightMode} defaultLang={fallbackLang}/>
                              </div>
                            );
                          })}
                          {isRunning && (
                                    <div className="flex mt-1">
                                      <div
                                        className={`typing-bubble border ${lightMode
                                          ? 'bg-slate-100 border-slate-200 text-slate-600'
                                          : 'bg-slate-800/70 border-slate-700/60 text-slate-300'
                                        }`}
                                      >
                                        <span className="typing-dot" />
                                        <span className="typing-dot" />
                                        <span className="typing-dot" />
                                      </div>
                                    </div>
                                  )}
                        </div>
                      ) : (
                        !isRunning && (
                          <div className={`text-sm px-1 ${lightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            Start a conversation...
                          </div>
                        )
                      )}

                      {mode === 'agent' && briefFinished && aiFiles.length > 0 && (
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
                                {/* <pre className={`mt-2 max-h-64 overflow-auto text-xs whitespace-pre-wrap ${lightMode ? 'text-slate-600' : 'text-slate-300'}`}>{f.content}</pre> */}
                                <div className="mt-2">
                                  <CodeBlock
                                    code={f.content}
                                    // try to infer a language from the filename extension
                                    lang={f.path.endsWith('.cs') ? 'csharp'
                                      : f.path.endsWith('.ts') || f.path.endsWith('.tsx') ? 'typescript'
                                      : f.path.endsWith('.js') || f.path.endsWith('.jsx') ? 'javascript'
                                      : f.path.endsWith('.html') ? 'markup'
                                      : f.path.endsWith('.css') ? 'css'
                                      : undefined}
                                    lightMode={lightMode}
                                  />
                                </div>

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
                            placeholder="Message… (Shift+Enter for newline)"
                            value={scenario}
                            onChange={(e) => setScenario(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                if (!isRunning && scenario.trim()) sendPrompt();
                              }
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
          {/* Context menu */}
          {ctxMenu && (
                <div
                  className="fixed inset-0 z-[1990]"
                  onClick={() => setCtxMenu(null)}
                  onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null); }}
                >
                  <div
                    ref={ctxMenuBoxRef}
                    className={`absolute z-[1995] rounded-md border shadow-lg text-sm
                      ${lightMode ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-800 border-slate-600 text-slate-100'}`}
                    style={{ left: ctxMenu.x, top: ctxMenu.y, minWidth: 180 }}
                    // prevent outside listener from closing before our button handler
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {ctxMenu.type === 'file' ? (
                      <>
                        <button
                          className="ctx-item"
                          onClick={() => {
                            const p = ctxMenu?.path;
                            setCtxMenu(null);
                            if (p) startRename(p);
                          }}
                        >
                          Rename
                        </button>
                        <button
                          className="ctx-item"
                          onClick={() => {
                            const p = ctxMenu?.path;
                            setCtxMenu(null);
                            if (p) openMove(p);
                          }}
                        >
                          Move…
                        </button>
                        <button
                          className="ctx-item danger"
                          onClick={() => {
                            const p = ctxMenu?.path;
                            setCtxMenu(null);
                            if (p) openDelete(p);
                          }}
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="ctx-item" onClick={() => { setCtxMenu(null); openCreate('file'); }}>New File</button>
                        <button className="ctx-item" onClick={() => { setCtxMenu(null); openCreate('folder'); }}>New Folder</button>
                        <button
                          className="ctx-item"
                          onClick={() => {
                            const p = ctxMenu?.path;
                            setCtxMenu(null);
                            if (p) startRename(p);
                          }}
                        >
                          Rename
                        </button>
                        <button
                          className="ctx-item danger"
                          onClick={() => {
                            const p = ctxMenu?.path;
                            setCtxMenu(null);
                            if (p) openDelete(p);
                          }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

          {createOpen && (
              <div
                className="fixed inset-0 z-[2000] bg-black/40 backdrop-blur-[2px] flex items-start justify-center p-4"
                onClick={cancelCreate}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') cancelCreate();
                  if (e.key === 'Enter') confirmCreate();
                }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="create-title"
              >
                <div
                  className={`
                    w-full max-w-lg rounded-2xl border shadow-xl animate-fade-in
                    ${lightMode ? 'bg-white border-slate-200' : 'bg-slate-800 border-slate-600'}
                  `}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className={`flex items-center justify-between px-5 py-4 border-b ${lightMode ? 'border-slate-200' : 'border-slate-700/60'}`}>
                    <h2 id="create-title" className={`text-sm font-semibold ${lightMode ? 'text-slate-800' : 'text-slate-100'}`}>
                      {createKind === 'file' ? 'Create new file' : 'Create new folder'}
                    </h2>
                    <button onClick={cancelCreate} className={`p-1 rounded-md ${lightMode ? 'hover:bg-slate-100' : 'hover:bg-slate-700/60'}`} aria-label="Close">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Body */}
                  <div className="px-5 pt-4 pb-2 space-y-3">
                    <label className={`block text-xs font-medium ${lightMode ? 'text-slate-600' : 'text-slate-300'}`}>
                      {createKind === 'file' ? 'File path' : 'Folder path'}
                    </label>
                    <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${lightMode ? 'bg-white border-slate-300' : 'bg-slate-900/40 border-slate-700'}`}>
                      <span className={`${lightMode ? 'text-slate-500' : 'text-slate-300'}`}>/</span>
                      <input
                        ref={createInputRef}
                        value={createPath}
                        onChange={(e) => setCreatePath(e.target.value)}
                        placeholder={createKind === 'file' ? 'src/utils/helpers.ts' : 'src/components'}
                        className={`flex-1 bg-transparent outline-none text-sm ${lightMode ? 'text-slate-900 placeholder-slate-400' : 'text-slate-100 placeholder-slate-400'}`}
                      />
                    </div>

                    <p className={`text-xs ${lightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      {createKind === 'file'
                        ? 'Tip: include folders in the path, e.g. src/pages/Home.tsx'
                        : 'Tip: nested paths allowed, e.g. src/pages/admin'}
                    </p>

                    {createErr && (
                      <div className="text-xs text-red-600">{createErr}</div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className={`px-5 py-4 flex items-center justify-end gap-2 border-t ${lightMode ? 'border-slate-200' : 'border-slate-700/60'}`}>
                    <button
                      onClick={cancelCreate}
                      className={`h-9 px-4 rounded-lg text-sm font-medium border ${lightMode ? 'text-slate-700 border-slate-300 hover:bg-slate-100' : 'text-slate-200 border-slate-600 hover:bg-slate-700/40'}`}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmCreate}
                      className={`h-9 px-4 rounded-lg text-sm font-semibold
                        ${lightMode
                          ? 'bg-blue-600 hover:bg-blue-700 text-white shadow'
                          : 'bg-blue-500 hover:bg-blue-400 text-[var(--vscode-text)] shadow'}`}
                    >
                      Create
                    </button>
                  </div>
                </div>
              </div>
            )}

            {moveOpen && (
              <div className="fixed inset-0 z-[2100] bg-black/40 backdrop-blur-[1px] flex items-start justify-center p-4"
                  onClick={() => setMoveOpen(false)} role="dialog" aria-modal="true">
                <div className={`${lightMode ? 'bg-white border-slate-200' : 'bg-slate-800 border-slate-600'}
                                w-full max-w-xl rounded-2xl border shadow-xl animate-fade-in`}
                    onClick={e => e.stopPropagation()}>
                  <div className={`flex items-center justify-between px-5 py-4 border-b ${lightMode ? 'border-slate-200' : 'border-slate-700/60'}`}>
                    <div className="flex items-center gap-2">
                      <MoveRight className="w-4 h-4" />
                      <h3 className={`text-sm font-semibold ${lightMode ? 'text-slate-800' : 'text-slate-100'}`}>Move / Rename</h3>
                    </div>
                    <button onClick={() => setMoveOpen(false)} className={`p-1 rounded-md ${lightMode ? 'hover:bg-slate-100' : 'hover:bg-slate-700/60'}`}><X className="w-4 h-4" /></button>
                  </div>

                  <div className="px-5 py-4 space-y-4">
                    <div>
                      <label className={`block text-xs mb-1 ${lightMode ? 'text-slate-600' : 'text-slate-300'}`}>Destination folder</label>
                      <select
                        value={moveTargetFolder}
                        onChange={e => setMoveTargetFolder(e.target.value)}
                        className={`${lightMode ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900/40 border-slate-700 text-slate-100'}
                                  w-full text-sm rounded-xl border px-3 py-2 outline-none`}
                      >
                        {allFolders.map(fld => (
                          <option key={fld} value={fld}>{fld === '_root' ? '(root)' : fld}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={`block text-xs mb-1 ${lightMode ? 'text-slate-600' : 'text-slate-300'}`}>File name</label>
                      <input
                        value={moveNewName}
                        onChange={e => setMoveNewName(e.target.value)}
                        className={`${lightMode ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900/40 border-slate-700 text-slate-100'}
                                  w-full text-sm rounded-xl border px-3 py-2 outline-none`}
                      />
                    </div>
                  </div>

                  <div className={`px-5 py-4 border-t flex items-center justify-end gap-2 ${lightMode ? 'border-slate-200' : 'border-slate-700/60'}`}>
                    <button onClick={() => setMoveOpen(false)}
                      className={`h-9 px-4 rounded-lg text-sm font-medium border ${lightMode ? 'text-slate-700 border-slate-300 hover:bg-slate-100' : 'text-slate-200 border-slate-600 hover:bg-slate-700/40'}`}>
                      Cancel
                    </button>
                    <button onClick={confirmMove}
                      className={`h-9 px-4 rounded-lg text-sm font-semibold ${lightMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-400 text-[var(--vscode-text)]'}`}>
                      Move
                    </button>
                  </div>
                </div>
              </div>
            )}

          {deleteOpen && (
              <div className="fixed inset-0 z-[2100] bg-black/40 backdrop-blur-[1px] flex items-start justify-center p-4"
                  onClick={() => setDeleteOpen(false)} role="dialog" aria-modal="true">
                <div className={`${lightMode ? 'bg-white border-slate-200' : 'bg-slate-800 border-slate-600'}
                                w-full max-w-md rounded-2xl border shadow-xl animate-fade-in`}
                    onClick={e => e.stopPropagation()}>
                  <div className={`px-5 py-4 border-b ${lightMode ? 'border-slate-200' : 'border-slate-700/60'}`}>
                    <h3 className={`text-sm font-semibold ${lightMode ? 'text-slate-800' : 'text-slate-100'}`}> {files.some(f => f.path === deleteTarget) ? 'Delete file' : 'Delete folder'} </h3>
                  </div>
                  <div className="px-5 py-4">
                    <p className={`${lightMode ? 'text-slate-700' : 'text-slate-200'} text-sm`}>
                      Are you sure you want to delete <span className="font-mono">{deleteTarget}</span>? This action can’t be undone.
                    </p>
                  </div>
                  <div className={`px-5 py-4 border-t flex items-center justify-end gap-2 ${lightMode ? 'border-slate-200' : 'border-slate-700/60'}`}>
                    <button onClick={() => setDeleteOpen(false)}
                      className={`h-9 px-4 rounded-lg text-sm font-medium border ${lightMode ? 'text-slate-700 border-slate-300 hover:bg-slate-100' : 'text-slate-200 border-slate-600 hover:bg-slate-700/40'}`}>
                      Cancel
                    </button>
                    <button onClick={confirmDelete}
                      className={`h-9 px-4 rounded-lg text-sm font-semibold ${lightMode ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-red-500 hover:bg-red-400 text-[var(--vscode-text)]'}`}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}

        </main>

        {/* Global styles for this page */}
        <style jsx global>{`
        /* Assistant rendering should look like plain content, not a chat bubble */
          .assistant-msg {
            background: transparent !important;
            border: 0 !important;
            padding: 0 !important;
          }
          .assistant-msg p { margin: 0 0 .5rem 0; }
          .assistant-msg h1, .assistant-msg h2, .assistant-msg h3 { margin: .6rem 0 .4rem; }


          @keyframes fade-in {
            from { opacity: 0; transform: translateY(-4px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in {
            animation: fade-in 0.3s ease-out;
          }
          
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

          /* Indeterminate progress bar */
            
            /* Assistant typing bubble (three bouncing dots) */
            .typing-bubble {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              padding: 8px 10px;
              border-radius: 14px;
            }
            .typing-dot {
              width: 6px;
              height: 6px;
              border-radius: 9999px;
              background: currentColor;
              opacity: 0.6;
              animation: typing 1s ease-in-out infinite;
            }
            .typing-dot:nth-child(2) { animation-delay: .15s; }
            .typing-dot:nth-child(3) { animation-delay: .30s; }

            @keyframes typing {
              0%, 60%, 100% { transform: translateY(0); opacity: .5; }
              30% { transform: translateY(-3px); opacity: 1; }
            }

            /* ---- Code block theme tokens ---- */
            :root {
              --code-bg-light: #f8fafc;         /* light theme background (unchanged) */
              --code-border-light: #e5e7eb;
              --inline-code-light: #f1f5f9;
            }
            .theme-dark, [data-theme="dark"] {
              --code-bg-dark: #2b2f36;          /* lighter gray for dark theme */
              --code-border-dark: #475569;      /* slate-500 */
              --inline-code-dark: #374151;      /* slate-700 for inline <code> */
            }

            /* Utility classes for code blocks */
            .codeblock--light { background: var(--code-bg-light);  border-color: var(--code-border-light); }
            .codeblock--dark  { background: var(--code-bg-dark);   border-color: var(--code-border-dark); }
            .inlinecode--light { background: var(--inline-code-light); }
            .inlinecode--dark  { background: var(--inline-code-dark); }

            /* Compact, VS Code-like explorer rows */
                .vscode-row {
                  display:flex; align-items:center; gap:8px;
                  height:24px; padding:0 6px; border-radius:4px;
                  user-select:none; cursor:pointer;
                }
                .vscode-row--light { color:#334155; }
                .vscode-row--dark  { color:#cbd5e1; }
                .vscode-row--light:hover { background:#f3f4f6; }
                .vscode-row--dark:hover  { background:rgba(148,163,184,.15); }
                .vscode-row--active-light { background:#e6f0ff; color:#1e3a8a; }
                .vscode-row--active-dark  { background:#1f2937; color:#e5e7eb; }
                .vscode-row__icon { width:16px; text-align:center; opacity:.8; }
                .vscode-row__label { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

                .vscode-folder {
                  display:flex; align-items:center; gap:6px;
                  height:22px; padding:0 4px; border-radius:4px;
                  font-size:12px; user-select:none; cursor:pointer;
                }
                .vscode-folder--light { color:#64748b; }
                .vscode-folder--dark  { color:#93c5fd; }
                .vscode-folder:hover { background: rgba(148,163,184,.12); }

                /* inline rename input */
                .vscode-rename {
                  width:100%; background:transparent; border:1px solid rgba(148,163,184,.5);
                  height:20px; border-radius:4px; padding:0 4px; outline:none;
                }
                .ctx-item {
                  display:block; width:100%; text-align:left; padding:6px 10px;
                }
                .ctx-item:hover {
                  background: rgba(148,163,184,.15);
                }
                .ctx-item.danger { color:#dc2626; }



        `}</style>
      </>
  );
}
