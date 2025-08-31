import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { Project } from '../../../lib/types';

// See comment in index.ts: process.cwd() is <repo>/frontend, so use one '..' to reach repo root
const DATA_DIR = path.join(process.cwd(), '..', 'data');
const FILE = path.join(DATA_DIR, 'projects.json');

function readProjects(): Project[] {
  if (!fs.existsSync(FILE)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (Array.isArray(raw)) return raw as Project[];
    if (raw && Array.isArray(raw.projects)) return raw.projects as Project[];
    return [];
  } catch (e) {
    return [];
  }
}
function writeProjects(arr: Project[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify({ projects: arr }, null, 2));
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query as { id: string };
  const projects = readProjects();
  const idx = projects.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });

  if (req.method === 'GET') {
    return res.status(200).json({ data: projects[idx] });
  }

  if (req.method === 'PATCH') {
    const patch = req.body as Partial<Project>;
    const updated = { ...projects[idx], ...patch } as Project;
    projects[idx] = updated;
    writeProjects(projects);
    return res.status(200).json({ data: updated });
  }

  res.setHeader('Allow', ['GET','PATCH']);
  res.status(405).end();
}
