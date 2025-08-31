import type { GetServerSideProps, NextPage } from 'next';
import Link from 'next/link';
import Header from '../../../components/Header';
import React, { useEffect, useState } from 'react';

type FileItem = { path: string; content?: string };
type Project = {
  id: string;
  name: string;
  description?: string;
  tooling?: string[];
  languages?: string[];
  createdAt?: string;
  updatedAt?: string;
  files?: FileItem[];
};

type Props = {
  project?: Project;
};

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const { id } = ctx.params as { id: string };
  try {
    const res = await fetch(`http://localhost:3000/api/projects/${id}`);
    if (!res.ok) {
      return { props: { project: null } };
    }
    const data = await res.json();
    return { props: { project: data } };
  } catch {
    return { props: { project: null } };
  }
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

const ProjectPage: NextPage<Props> = ({ project }) => {
  if (!project) return <div>Project not found</div>;

  // AI generation state
  const [aiTool, setAiTool] = useState<string>('Selenium');
  const [aiLanguage, setAiLanguage] = useState<string>('JavaScript');
  const [aiPrompt, setAiPrompt] = useState<string>('Write an AI-assisted UI automation code snippet using the selected tool and language for project ' + (project?.id ?? ''));
  const [aiGeneratedCode, setAiGeneratedCode] = useState<string>('');
  const [aiPath, setAiPath] = useState<string>('');

  // Runs for this project
  const [runs, setRuns] = useState<Run[]>([]);

  // Helper to compute extension
  const extForLanguage = (lang: string): string => {
    switch (lang) {
      case 'JavaScript': return 'js';
      case 'TypeScript': return 'ts';
      case 'Python': return 'py';
      case 'Java': return 'java';
      case 'C#': return 'cs';
      case 'Ruby': return 'rb';
      default: return 'txt';
    }
  };

  // Update default path when tool/language change
  React.useEffect(() => {
    const ext = extForLanguage(aiLanguage);
    const defaultPath = `src/ai/generated_${aiTool.toLowerCase()}_${aiLanguage.toLowerCase()}.${ext}`;
    setAiPath(defaultPath);
  }, [aiTool, aiLanguage]);

  const generateCode = async () => {
    const res = await fetch('/api/ai/generate-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: project!.id, tool: aiTool, language: aiLanguage, prompt: aiPrompt }),
    });
    const data = await res.json();
    setAiGeneratedCode(data.generatedCode ?? '');
  };

  const saveCode = async () => {
    const ext = extForLanguage(aiLanguage);
    const filePath = aiPath || `src/ai/generated_${aiTool.toLowerCase()}_${aiLanguage.toLowerCase()}.${ext}`;
    const res = await fetch(`/api/projects/${project!.id}/files/${encodeURIComponent(filePath)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: aiGeneratedCode }),
    });
    // Could show status
    if (res.ok) {
      // optionally refresh list or show a toast
    }
  };

  const runDocker = async () => {
    const res = await fetch('/api/runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: project!.id, tool: 'Docker', status: 'scheduled', results: 'Docker run scheduled' }),
    });
    const data = await res.json();
    setRuns((prev) => [data, ...(prev ?? [])]);
  };

  useEffect(() => {
    // load existing runs for this project
    fetch('/api/runs')
      .then((r) => r.json())
      .then((data) => {
        const list = (data?.runs ?? []) as Run[];
        setRuns(list.filter((r) => r.projectId === project!.id));
      });
  }, [project?.id]);

  return (
    <>
      <Header />
      <main className="container py-8">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">{project.name}</h1>
          {project.description && <p className="text-slate-300">{project.description}</p>}
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <div className="card">
              <h3 className="font-semibold mb-2">Files</h3>
              <ul className="space-y-2">
                {(project.files ?? []).map((f) => (
                  <li key={f.path}>
                    <Link href={`/projects/${project.id}/files/${encodeURIComponent(f.path)}`} className="text-indigo-300 hover:text-indigo-200">{f.path}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="md:col-span-2 space-y-6">
            <div className="card">
              <h3 className="font-semibold mb-2">AI Generate Code</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-300">Tool</label>
                  <select value={aiTool} onChange={(e) => setAiTool(e.target.value)} className="mt-1 w-full bg-slate-700 text-white p-2 rounded">
                    <option>Selenium</option>
                    <option>Playwright</option>
                    <option>Cypress</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-300">Language</label>
                  <select value={aiLanguage} onChange={(e) => setAiLanguage(e.target.value)} className="mt-1 w-full bg-slate-700 text-white p-2 rounded">
                    <option>JavaScript</option>
                    <option>TypeScript</option>
                    <option>Python</option>
                    <option>Java</option>
                    <option>C#</option>
                    <option>Ruby</option>
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm text-slate-300">Prompt</label>
                <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} rows={4} className="mt-1 w-full bg-slate-700 text-white p-2 rounded" />
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button onClick={generateCode} className="px-4 py-2 bg-indigo-600 text-white rounded">Generate Code</button>
                <input value={aiPath} onChange={(e) => setAiPath(e.target.value)} placeholder="File path" className="flex-1 bg-slate-700 text-white p-2 rounded" />
                <button onClick={saveCode} disabled={!aiGeneratedCode} className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50">Save</button>
              </div>

              {aiGeneratedCode && (
                <textarea value={aiGeneratedCode} onChange={(e) => setAiGeneratedCode(e.target.value)} rows={12} className="mt-4 w-full bg-slate-900 text-slate-100 p-3 rounded font-mono" />
              )}
            </div>

            <div className="card">
              <h3 className="font-semibold mb-2">Run Tests (Docker)</h3>
              <div className="flex items-center gap-3">
                <button onClick={runDocker} className="px-4 py-2 bg-amber-600 text-white rounded">Run Tests in Docker</button>
              </div>

              <div className="mt-4">
                <h4 className="font-medium">Recent Runs</h4>
                <ul className="mt-2 space-y-2 text-slate-300">
                  {runs.map((r) => (
                    <li key={r.id} className="text-sm">{r.startedAt} - {r.tool} - {r.status} - {r.results}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
};

export default ProjectPage;