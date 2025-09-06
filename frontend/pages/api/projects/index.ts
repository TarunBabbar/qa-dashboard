import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { Project } from '../../../lib/types';

// DATA_DIR should resolve to the repository root data/ folder
// When Next runs from the frontend folder, process.cwd() is <repo>/frontend
// so one '..' reaches the repo root: <repo>/frontend/.. -> <repo>
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
  // Persist as an object with a top-level `projects` array to match seeded file format
  fs.writeFileSync(FILE, JSON.stringify({ projects: arr }, null, 2));
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const projects = readProjects();
    return res.status(200).json({ projects: projects });
  }

  if (req.method === 'POST') {
    const projects = readProjects();
    const body = req.body as Partial<Project>;
    const id = body.id || `proj-${Date.now()}`;
    const newP: Project = {
      id,
      name: body.name || 'Untitled project',
      testSuite: body.testSuite || 'Regression',
      language: body.language,
      frameworkType: body.frameworkType,
      tools: body.tools || [],
      createdAt: body.createdAt || new Date().toISOString(),
      frameworkIds: body.frameworkIds || []
    };
    projects.push(newP);
    writeProjects(projects);
    return res.status(201).json({ project: newP });
  }

  res.setHeader('Allow', ['GET','POST']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
