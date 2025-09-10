import fs from 'fs';
import path from 'path';

// File system utility functions

export function ensureDirExists(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function readJson<T>(filePath: string, defaultValue: T): T {
  try {
    if (!fs.existsSync(filePath)) return defaultValue;
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

export function writeJson<T>(filePath: string, data: T): void {
  ensureDirExists(filePath);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// Data directory paths
export const getDataPaths = () => {
  const dataDir = path.resolve(__dirname, '../../data');
  return {
    dataDir,
    projectsPath: path.join(dataDir, 'projects.json'),
    runsPath: path.join(dataDir, 'runs.json'),
    usersPath: path.join(dataDir, 'users.json'),
    revertsPath: path.join(dataDir, 'reverts.json')
  };
};