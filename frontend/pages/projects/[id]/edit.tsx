import type { GetServerSideProps, NextPage } from 'next';
import Head from 'next/head';
import { useState, useEffect } from 'react';
import Header from '../../../components/Header';
import { getProject, updateProject } from '../../../lib/api';

type Props = {
  id: string;
};

const EditProject: NextPage<Props> = ({ id }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState('');
  const [testSuite, setTestSuite] = useState('');

  useEffect(() => {
    let mounted = true;
    getProject(id).then(res => {
      if (!mounted) return;
      if (res?.data) {
  setName(res.data.name || '');
  setDescription((res.data as any).description || '');
  // handle older shape where languages may be an array under a different key
  const lang = (res.data as any).language || ((res.data as any).languages ? (res.data as any).languages[0] : '');
  setLanguage(lang);
  setTestSuite(res.data.testSuite || '');
      }
      setLoading(false);
    });
    return () => { mounted = false; };
  }, [id]);

  const onSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setMessage(null);
    setSaving(true);
    const patch = { name, description, language, testSuite } as any;
    const res = await updateProject(id, patch);
    if (res?.data) {
      setMessage('Project updated');
    } else {
      setMessage('Failed to update');
    }
    setSaving(false);
  };

  if (loading) return (<div><Header /><main className="p-8">Loading...</main></div>);

  return (
    <>
      <Head><title>Edit Project</title></Head>
      <Header />
      <main className="container py-12">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">Edit Project</h1>
          <form className="bg-white border rounded-lg shadow-sm p-6" onSubmit={onSave}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Project Name</label>
              <input value={name} onChange={e => setName(e.target.value)} className="w-full border rounded px-3 py-2" />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} className="w-full border rounded px-3 py-2" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Programming Language</label>
                <input value={language} onChange={e => setLanguage(e.target.value)} className="w-full border rounded px-3 py-2" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Test Suite</label>
                <input value={testSuite} onChange={e => setTestSuite(e.target.value)} className="w-full border rounded px-3 py-2" />
              </div>
            </div>

            {message && <div className="mb-4 p-3 rounded bg-green-50 text-green-700">{message}</div>}

            <div>
              <button type="submit" disabled={saving} className="w-full bg-blue-600 text-white py-2 rounded">{saving ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </form>
        </div>
      </main>
    </>
  );
};

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const { id } = ctx.params as { id: string };
  return { props: { id } };
};

export default EditProject;
