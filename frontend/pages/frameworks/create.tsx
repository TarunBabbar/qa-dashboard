import Head from 'next/head';
import Header from '../../components/Header';
import { useState } from 'react';
import { FrameworkCreatePayload } from '../../lib/types';
import { createFramework } from '../../lib/api';

const LANGUAGES = ['JavaScript','TypeScript','Python','Java','C#'];
const FRAMEWORK_TYPES = ['UI','API','Unit','E2E','Performance'];
const TOOL_OPTIONS = ['Playwright','Cypress','Selenium','PyTest','Jest','Mocha','k6','Locust'];

export default function CreateFramework(){
  const [name,setName] = useState('');
  const [language,setLanguage] = useState('');
  const [type,setType] = useState('');
  const [tools,setTools] = useState<string[]>([]);
  const [description,setDescription] = useState('');
  const [repoUrl,setRepoUrl] = useState('');
  const [tagInput,setTagInput] = useState('');
  const [tags,setTags] = useState<string[]>([]);
  const [creating,setCreating] = useState(false);
  const [message,setMessage] = useState<string|null>(null);
  const [errors,setErrors] = useState<Record<string,string>>({});

  const toggleTool = (tool:string)=> setTools(prev=> prev.includes(tool)? prev.filter(t=>t!==tool): [...prev,tool]);
  const validate = () => {
    const errs: Record<string,string> = {};
    if(!name.trim()) errs.name = 'Name is required';
    if(!language) errs.language = 'Language required';
    if(!type) errs.type = 'Type required';
    if(tools.length===0) errs.tools = 'At least one tool';
    if(repoUrl && !/^https?:\/\//i.test(repoUrl)) errs.repoUrl = 'Must start with http(s)://';
    setErrors(errs); return Object.keys(errs).length===0;
  };
  const canSubmit = !creating;

  const handleSubmit = async (e:React.FormEvent)=>{
    e.preventDefault();
    if(!validate()) return;
    setCreating(true); setMessage(null);
    const payload: FrameworkCreatePayload = { name: name.trim(), language, type, tools, description: description.trim() || undefined, repoUrl: repoUrl || undefined, tags: tags.length? tags: undefined };
    const res = await createFramework(payload);
    if(res.error) setMessage('Error: '+res.error); else {
      setMessage('Framework created successfully.');
      setName(''); setLanguage(''); setType(''); setTools([]); setDescription(''); setRepoUrl(''); setTags([]); setTagInput('');
    }
    setCreating(false);
  };

  const addTag = () => {
    const t = tagInput.trim(); if(!t) return; if(!tags.includes(t)) setTags([...tags,t]); setTagInput('');
  };
  const removeTag = (t:string)=> setTags(tags.filter(x=>x!==t));
  const onTagKey: React.KeyboardEventHandler<HTMLInputElement> = (e)=> { if(e.key==='Enter'||e.key===','){ e.preventDefault(); addTag(); }};

  return (
    <>
      <Head><title>Create New Framework</title></Head>
      <Header />
      <main className="py-16">
        <div className="max-w-3xl mx-auto px-4">
          <h1 className="text-3xl font-bold text-center mb-2">Create New Framework</h1>
          <p className="text-center text-slate-500 mb-8">Build your test automation framework by selecting your preferred tools and languages.</p>

          <div className="bg-white rounded-xl shadow-md border border-slate-100 p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Framework Name</label>
                <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g., My Awesome Project" className="w-full border rounded px-3 py-2 bg-white border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Programming Language</label>
                  <select value={language} onChange={e=>setLanguage(e.target.value)} className="w-full border rounded px-3 py-2 bg-white border-gray-200">
                    <option value="">Select Language</option>
                    {LANGUAGES.map(l=> <option key={l}>{l}</option>)}
                  </select>
                  {errors.language && <p className="text-xs text-red-600 mt-1">{errors.language}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Framework Type</label>
                  <select value={type} onChange={e=>setType(e.target.value)} className="w-full border rounded px-3 py-2 bg-white border-gray-200">
                    <option value="">Select Type</option>
                    {FRAMEWORK_TYPES.map(ft=> <option key={ft}>{ft}</option>)}
                  </select>
                  {errors.type && <p className="text-xs text-red-600 mt-1">{errors.type}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Testing Tools</label>
                <select value={tools.join(',')} onChange={e=>{ const v = e.target.value; setTools(v? v.split(',') : []); }} className="w-full border rounded px-3 py-2 bg-white border-gray-200">
                  <option value="">Select Tools</option>
                  {TOOL_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {errors.tools && <p className="text-xs text-red-600 mt-1">{errors.tools}</p>}
              </div>

              <div>
                {message && <div className={`text-sm ${message.startsWith('Error')? 'text-red-600':'text-green-600'}`}>{message}</div>}
                <button disabled={!canSubmit} className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-90"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Create Framework
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </>
  );
}
