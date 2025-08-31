import type { NextPage } from 'next';
import Head from 'next/head';
import { useState } from 'react';
import Header from '../../components/Header';
import { createProject } from '../../lib/api';

const TEST_SUITES = ['Regression', 'Sanity', 'Smoke Test', 'Performance', 'Integration', 'Other'];
const LANGUAGES = ['JavaScript', 'TypeScript', 'Python', 'Java', 'C#', 'Go'];
const FRAMEWORK_TYPES = ['UI', 'API', 'Unit', 'E2E', 'Performance'];
const TOOL_OPTIONS = ['Playwright', 'Cypress', 'Selenium', 'Jest', 'Pytest', 'Mocha', 'JUnit'];

const CreateProject: NextPage = () => {
  const [projectName, setProjectName] = useState('');
  const [testSuite, setTestSuite] = useState(TEST_SUITES[0]);
  const [customTestSuite, setCustomTestSuite] = useState('');
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [frameworkType, setFrameworkType] = useState(FRAMEWORK_TYPES[0]);
  const [description, setDescription] = useState('');
  const [tools, setTools] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  function toggleTool(tool: string) {
    setTools(prev => prev.includes(tool) ? prev.filter(t => t !== tool) : [...prev, tool]);
  }

  const validate = () => {
    if (!projectName.trim()) { setMessage({ type: 'error', text: 'Project name is required.' }); return false; }
    if (testSuite === 'Other' && !customTestSuite.trim()) { setMessage({ type: 'error', text: 'Please provide a name for the test suite.' }); return false; }
    return true;
  };

  const onSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setMessage(null);
    if (!validate()) return;
    setLoading(true);
    const payload = {
      name: projectName.trim(),
      description: description.trim(),
      testSuite: testSuite === 'Other' ? customTestSuite.trim() : testSuite,
      language,
      frameworkType,
      tools,
      createdAt: new Date().toISOString()
    };
    try {
      const res = await createProject(payload);
      if (res?.data) {
  setMessage({ type: 'success', text: 'Project created successfully.' });
  setProjectName(''); setDescription(''); setTestSuite(TEST_SUITES[0]); setCustomTestSuite(''); setLanguage(LANGUAGES[0]); setFrameworkType(FRAMEWORK_TYPES[0]); setTools([]);
      } else {
        setMessage({ type: 'error', text: res.error || 'Unexpected response' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to create project.' });
    } finally { setLoading(false); }
  };

  return (
    <>
      <Head><title>Create Project</title></Head>
      <Header />
      <main className="container py-12">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold text-center mb-2">Create New Project</h1>
          <p className="text-center text-slate-500 mb-6">Create a project and associate it with a test suite and framework settings.</p>

          <form className="bg-white border rounded-lg shadow-sm p-6" onSubmit={onSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Project Name</label>
              <input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="e.g., My Awesome Project" className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Short description of the project" rows={3} className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Test Suite</label>
                <select value={testSuite} onChange={e => setTestSuite(e.target.value)} className="w-full border rounded px-3 py-2">
                  {TEST_SUITES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {testSuite === 'Other' && (
                  <input value={customTestSuite} onChange={e => setCustomTestSuite(e.target.value)} placeholder="Enter test suite name" className="mt-2 w-full border rounded px-3 py-2" />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Programming Language</label>
                <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full border rounded px-3 py-2">
                  {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Framework Type</label>
                <select value={frameworkType} onChange={e => setFrameworkType(e.target.value)} className="w-full border rounded px-3 py-2">
                  {FRAMEWORK_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Testing Tools</label>
                <select
                  value={tools[0] ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTools(val ? [val] : []);
                  }}
                  className="w-full border rounded px-3 py-2 h-10"
                >
                  <option value="">Select a testing tool</option>
                  {TOOL_OPTIONS.map(tool => (
                    <option key={tool} value={tool}>{tool}</option>
                  ))}
                </select>
              </div>
            </div>

            {message && (
              <div className={`mb-4 p-3 rounded ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{message.text}</div>
            )}

            <div>
              <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-60">{loading ? 'Creating...' : 'Create Project'}</button>
            </div>
          </form>
        </div>
      </main>
    </>
  );
};

export default CreateProject;