import Head from 'next/head';
import Header from '../components/Header';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import React from "react";
const SplitPane = require('react-split-pane').default;
import { getProject } from '../lib/api';
import Highlight, { defaultProps, Language } from 'prism-react-renderer';
import vsDarkTheme from 'prism-react-renderer/themes/vsDark';
// Light theme for code when in light mode
import githubTheme from 'prism-react-renderer/themes/github';

type FileItem = { path: string; content?: string };

export default function IDEPage() {
  // Helper to map file extension to Prism language
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
  const { query } = useRouter();
  const projectId = query.projectId as string | undefined;

  const [projectName, setProjectName] = useState<string | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFile, setActiveFile] = useState<FileItem | null>(null);
  // Global light mode (for now always true per request to match other screens)
  const [lightMode, setLightMode] = useState(true);
  // Remove manual drag logic, handled by SplitPane

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

  return (
    <>
      <Head>
        <title>IDE & AI Assistance</title>
      </Head>
      <Header />
      <main className="app-root w-full" style={{ padding: 0, margin: 0, height: '100vh', width: '100vw', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: lightMode ? '#f1f5f9' : 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
        <div style={{ flexShrink: 0, background: lightMode ? '#ffffff' : 'rgba(15, 23, 42, 0.95)', borderBottom: lightMode ? '1px solid #e2e8f0' : '1px solid rgba(59, 130, 246, 0.2)', padding: '12px 24px' }}>
          <div className="flex items-center justify-between">
            <h1 className={`text-2xl font-semibold mb-0 ${lightMode ? 'text-slate-800' : 'text-white'}`} style={{ fontWeight: 600, letterSpacing: '-0.025em' }}>
              <span className={lightMode ? '' : ''}>IDE & AI Assistance</span>
            </h1>
            <div className="flex items-center gap-2">
              <button onClick={() => setLightMode(l => !l)} className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${lightMode ? 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600' : 'bg-slate-800/60 border-slate-600 hover:bg-slate-700 text-slate-200'}`}>{lightMode ? 'Dark' : 'Light'} Mode</button>
            </div>
          </div>
        </div>
        <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
          <SplitPane
            split="vertical"
            minSize={200}
            defaultSize={280}
            style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0 }}
            paneStyle={{ height: '100%' }}
          >
          {/* File Explorer Panel */}
          <div className={`h-full flex-shrink-0 overflow-hidden ${lightMode ? 'bg-white border-r border-slate-200' : 'bg-slate-900'} `} aria-label="file-explorer" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="h-full overflow-auto">
              <div className={`flex items-center justify-between px-4 h-11 border-b ${lightMode ? 'border-slate-200' : 'border-slate-700/50'} bg-transparent`}>
                <div className="flex items-center gap-2 text-xs font-semibold tracking-wider">
                  <span className="text-yellow-500">📁</span>
                  <span className={`${lightMode ? 'text-slate-600' : 'text-blue-400'}`}>FILE BROWSER</span>
                </div>
                <div className="flex items-center gap-1">
                  <button title="New File" className={`p-2 rounded-md transition-colors ${lightMode ? 'hover:bg-slate-100 text-slate-500 hover:text-slate-700' : 'hover:bg-blue-600/20 text-blue-400 hover:text-blue-300'}`} onClick={() => alert('New File - not implemented yet')}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                  </button>
                  <button title="New Folder" className={`p-2 rounded-md transition-colors ${lightMode ? 'hover:bg-slate-100 text-slate-500 hover:text-slate-700' : 'hover:bg-blue-600/20 text-blue-400 hover:text-blue-300'}`} onClick={() => alert('New Folder - not implemented yet')}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
                  </button>
                  <button title="Refresh" className={`p-2 rounded-md transition-colors ${lightMode ? 'hover:bg-slate-100 text-slate-500 hover:text-slate-700' : 'hover:bg-blue-600/20 text-blue-400 hover:text-blue-300'}`} onClick={() => window.location.reload()}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                  </button>
                </div>
              </div>
              <div className="px-4 py-2 flex items-center justify-between border-b border-transparent">
                <div className={`font-medium text-sm flex items-center gap-2 ${lightMode ? 'text-slate-700' : 'text-white'}`}>
                  <span className={`w-2 h-2 rounded-full animate-pulse ${lightMode ? 'bg-green-500' : 'bg-green-400'}`}></span>
                  {projectName ?? 'TestingTarun'}
                </div>
                <div />
              </div>
              {loading ? (
                <div className="text-sm text-slate-400 px-4 flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                  Loading files...
                </div>
              ) : files.length === 0 ? (
                <div className="text-sm text-slate-400 px-4 py-8 text-center">
                  <div className="mb-2">📁</div>
                  No files in this project.
                </div>
              ) : (
                <div className="text-sm px-4">
                  {(() => {
                    const groups: Record<string, FileItem[]> = {};
                    files.forEach((f) => {
                      const seg = f.path.includes('/') ? f.path.split('/')[0] : '';
                      const key = seg || '_root';
                      if (!groups[key]) groups[key] = [];
                      groups[key].push(f);
                    });
                    return Object.keys(groups).map((grp) => (
                      <div key={grp} className="mb-4">
                        {grp !== '_root' && (
                          <div className={`text-xs flex items-center gap-2 mb-2 font-medium ${lightMode ? 'text-slate-500' : 'text-blue-400'}`}>
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/></svg>
                            {grp}
                          </div>
                        )}
                        <ul className="space-y-1">
                          {groups[grp].map((f) => (
                            <li
                              key={f.path}
                              className={`flex items-center gap-3 py-2 px-3 rounded-md cursor-pointer transition-colors duration-150 border ${activeFile?.path === f.path
                                  ? (lightMode ? 'bg-blue-50 text-blue-700 border-blue-300' : 'bg-blue-600/30 text-white border-blue-500/50')
                                  : (lightMode ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50' : 'text-slate-300 border-transparent hover:bg-slate-700/50 hover:text-white')}`}
                              onClick={() => setActiveFile(f)}
                            >
                              <span className="text-blue-400">
                                {f.path.endsWith('.tsx') || f.path.endsWith('.ts') ? '⚛️' :
                                  f.path.endsWith('.js') || f.path.endsWith('.jsx') ? '🟨' :
                                    f.path.endsWith('.css') ? '🎨' :
                                      f.path.endsWith('.json') ? '📄' : '📝'}
                              </span>
                              <span className="truncate font-medium">{f.path.replace(/^.*\//, '')}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>
          </div>
          {/* Combined Code View + AI Assistant Panel */}
          <SplitPane
            split="vertical"
            minSize={300}
            defaultSize="60%"
            paneStyle={{ height: '100%' }}
          >
            {/* Code View Panel */}
            <div className={`flex-1 h-full flex flex-col overflow-hidden ${lightMode ? 'bg-white border-r border-slate-200' : ''}`}> 
              <div className={`border-b mb-0 ${lightMode ? 'bg-white/90 backdrop-blur border-slate-200' : 'border-slate-700/50'}`}> 
                <div className="flex items-center justify-between px-4 h-11 gap-4">
                  <div className="flex overflow-x-auto flex-1">
                    {files.length === 0 ? (
                      <div className={`px-2 py-2 text-sm ${lightMode ? 'text-slate-500' : 'text-slate-400'}`}>No files open</div>
                    ) : files.map((f) => (
                      <button 
                        key={`tab-${f.path}`} 
                        onClick={() => setActiveFile(f)} 
                        className={`px-5 py-2 text-sm font-medium transition-all duration-200 border-b-2 whitespace-nowrap flex items-center gap-2 ${activeFile?.path === f.path 
                            ? (lightMode ? 'border-blue-500 text-blue-700 bg-blue-50' : 'border-blue-500 text-white bg-blue-600/10') 
                            : (lightMode ? 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50' : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-700/30')}`}
                      >
                        <span>
                          {f.path.endsWith('.tsx') || f.path.endsWith('.ts') ? '⚛️' :
                           f.path.endsWith('.js') || f.path.endsWith('.jsx') ? '🟨' :
                           f.path.endsWith('.css') ? '🎨' :
                           f.path.endsWith('.json') ? '📄' : '📝'}
                        </span>
                        {f.path}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${lightMode ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm' : 'bg-blue-600/80 hover:bg-blue-600 text-white'}`}>Save</button>
                  </div>
                </div>
              </div>
              <div className={`flex-1 overflow-auto p-4 ${lightMode ? 'bg-white' : ''}`} style={{ borderRadius: '0', margin: '0', borderTop: 'none' }}>
                {activeFile && typeof activeFile.path === 'string' ? (
                  <div className={`rounded-md border ${lightMode ? 'border-slate-200 bg-slate-50' : 'border-slate-700/60 bg-slate-900/40'} p-4`}>
                    <Highlight {...defaultProps} code={activeFile.content ?? ''} language={langFromPath(activeFile.path)} theme={lightMode ? githubTheme : vsDarkTheme}>
                      {(renderProps: any) => {
                        const { className, style, tokens, getLineProps, getTokenProps } = renderProps;
                        return (
                          <div className={className + ' text-sm'} style={{ ...style, background: 'transparent', fontSize: '13px' }}>
                            {tokens.map((line: any[], i: number) => (
                              <div key={`line-${i}`} {...getLineProps({ line, key: i })} className={`flex transition-colors duration-150 ${lightMode ? 'hover:bg-blue-50' : 'hover:bg-blue-600/5'}`}>
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
                    <div className="text-5xl mb-3">📁</div>
                    <div className={`${lightMode ? 'text-slate-500' : 'text-slate-400'} text-lg`}>Select a file to start coding</div>
                    <div className={`${lightMode ? 'text-slate-400' : 'text-slate-500'} text-sm mt-2`}>Choose a file from the explorer to view its contents</div>
                  </div>
                )}
              </div>
            </div>
            {/* AI Assistant Panel with theme toggle */}
            <div className={`h-full flex-shrink-0 flex flex-col transition-colors duration-300 ${lightMode ? 'bg-white border-l border-slate-200' : ''}`} style={{ background: lightMode ? undefined : 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)', position: 'relative', minWidth: '360px' }}>
              {/* Header */}
              <div className={`flex items-center justify-between px-4 py-2 border-b ${lightMode ? 'bg-white/90 backdrop-blur border-slate-200' : 'border-slate-700/50'} `}>
                <div className="flex items-center gap-2">
                  <svg className={`w-4 h-4 ${lightMode ? 'text-blue-500' : 'text-blue-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                  </svg>
                  <span className={`text-sm font-semibold tracking-wide ${lightMode ? 'text-slate-700' : 'text-white'}`}>AI ASSISTANT</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${lightMode ? 'border-slate-300 text-slate-500 bg-slate-50' : 'border-slate-600 text-slate-400 bg-slate-800/40'}`}>{lightMode ? 'Light' : 'Dark'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setLightMode(l => !l)} className={`p-1.5 rounded-md border transition-colors ${lightMode ? 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600' : 'border-slate-600/60 hover:bg-slate-600/30 text-slate-300'}`} title="Toggle theme">
                    {lightMode ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364 6.364l-1.414-1.414M7.05 7.05L5.636 5.636m0 12.728L7.05 16.95M16.95 7.05l1.414-1.414M12 8a4 4 0 100 8 4 4 0 000-8z"/></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Chat content */}
              <div className={`flex-1 overflow-auto px-5 py-6 pb-44 transition-colors ${lightMode ? 'bg-gradient-to-b from-white to-slate-50' : 'p-4 pb-40'}`}>
                <div className={`text-center ${lightMode ? 'text-slate-500' : 'text-slate-300'} text-sm py-6`}>
                  <div className="text-3xl mb-2">🤖</div>
                  <div className={`${lightMode ? 'text-slate-600' : 'text-slate-200'} font-medium`}>No assistant output yet.</div>
                  <div className={`${lightMode ? 'text-slate-400' : 'text-slate-500'} text-xs mt-1`}>Ask a question or request a change below</div>
                </div>
              </div>

              {/* Input */}
              <div style={{ position: 'sticky', bottom: lightMode ? '24px' : '28px', zIndex: 30 }} className={`mt-auto px-5 transition-all`}>
                {/* gradient fade */}
                <div className={`pointer-events-none absolute left-0 right-0 ${lightMode ? '-top-8 h-8' : '-top-6 h-6'}`} style={{ background: lightMode ? 'linear-gradient(to top, rgba(255,255,255,0.9), rgba(255,255,255,0))' : 'linear-gradient(to top, rgba(15,23,42,0.9), rgba(15,23,42,0))' }} />
                <div className={`relative rounded-xl border shadow-sm transition-all ${lightMode ? 'bg-white border-slate-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100' : 'border-slate-600/60 bg-slate-900/70 focus-within:border-blue-500 focus-within:shadow-blue-600/40'} backdrop-blur`}> 
                  <textarea
                    className={`w-full px-3 py-2.5 pr-12 text-sm leading-relaxed rounded-xl resize-none focus:outline-none placeholder:opacity-70 ${lightMode ? 'text-slate-700 placeholder-slate-400 bg-transparent' : 'text-slate-100 placeholder-slate-500 bg-transparent'}`}
                    style={{ minHeight: '60px', maxHeight: '200px', overflowY: 'auto', fontSize: '13px' }}
                    placeholder="Enter your prompt here... (Shift+Enter for new line)"
                    rows={3}
                  />
                  <div className="absolute right-2.5 bottom-2 flex items-center gap-1">
                    <button title="Send" className={`p-2 rounded-lg font-medium transition shadow ${lightMode ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-900/50'}`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12l14-8-6 8 6 8-14-8z"/></svg>
                    </button>
                  </div>
                </div>
                <div className={`px-1 pt-1 text-[10px] flex justify-between select-none tracking-wide ${lightMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  <span>Enter = Send</span>
                  <span>Shift+Enter = New line</span>
                </div>
              </div>
            </div>
          </SplitPane>
        </SplitPane>
        </div>
      </main>
      <style jsx global>{`
        html, body, #__next {
          margin: 0;
          padding: 0;
          height: 100vh;
          width: 100vw;
          overflow: hidden;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .SplitPane {
          position: absolute !important;
          top: 0;
          left: 0;
          height: 100% !important;
          width: 100% !important;
        }
        .Pane {
          height: 100% !important;
        }
        .Resizer {
          background: #e2e8f0;
          opacity: 1;
          z-index: 100;
          box-sizing: border-box;
          background-clip: padding-box;
          transition: background 0.2s ease;
          position: relative;
        }
        .Resizer:hover {
          background: #94a3b8;
        }
        .Resizer.vertical {
          width: 3px;
          margin: 0 -1px;
          cursor: col-resize;
        }
        .Resizer.horizontal {
          height: 8px;
          margin: -4px 0;
          cursor: row-resize;
        }
        /* Custom scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: ${'${lightMode ? "#f1f5f9" : "rgba(15,23,42,0.5)"}'};
        }
        ::-webkit-scrollbar-thumb {
          background: ${'${lightMode ? "#cbd5e1" : "linear-gradient(135deg, #3b82f6, #8b5cf6)"}'};
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: ${'${lightMode ? "#94a3b8" : "linear-gradient(135deg, #2563eb, #7c3aed)"}'};
        }
        /* Hide scrollbar for AI Assistant panel */
        .ai-assistant-panel::-webkit-scrollbar {
          display: none;
        }
        .ai-assistant-panel {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </>
  );
}
 
