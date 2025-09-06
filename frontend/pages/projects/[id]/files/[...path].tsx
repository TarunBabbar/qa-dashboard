// File: [`frontend/pages/projects/[id]/files/[...path].tsx`](frontend/pages/projects/[id]/files/[...path].tsx:1)
import type { GetServerSideProps, NextPage } from 'next';
import Link from 'next/link';
import React from 'react';
import { backendBase } from '../../../../lib/api';

type FileEditorProps = { projectId: string; path: string; content: string };

export const getServerSideProps: GetServerSideProps<{ projectId: string; path: string; content: string }> = async (ctx) => {
  const { id, path: pathParts } = ctx.params as { id: string; path: string[] | undefined };
  const filePath = Array.isArray(pathParts) ? pathParts.join('/') : (pathParts ?? '');
  let content = '';
  if (id && filePath) {
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || backendBase;
      const res = await fetch(`${base}/api/projects/${id}/files/${encodeURIComponent(filePath)}`);
      if (res.ok) {
        const data = await res.json();
        content = data.content ?? '';
      }
    } catch {
      content = '';
    }
  }
  return { props: { projectId: id ?? '', path: filePath, content } };
};

const FileEditorPage: NextPage<{ projectId: string; path: string; content: string }> = ({ projectId, path, content }) => {
  const [text, setText] = React.useState<string>(content);

  const handleSave = async () => {
    await fetch(`/api/projects/${projectId}/files/${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text })
    });
  };

  // Simple UI: file path, text area, Save button
  return (
    <div style={{ padding: '1rem' }}>
      <h2>Editing {path}</h2>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{ width: '100%', height: '60vh', fontFamily: 'monospace' }}
      />
      <div style={{ marginTop: '8px' }}>
        <button onClick={handleSave}>Save</button>
      </div>
    </div>
  );
};

export default FileEditorPage;