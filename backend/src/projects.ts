import { Router, Request, Response } from 'express';
import { Project, ProjectsWrapper, FileEntry, RevertRecord, RevertsWrapper } from './types';
import { readJson, writeJson, getDataPaths } from './utils';

const router = Router();
const { projectsPath, revertsPath } = getDataPaths();

// Load baseline data
let projectData = readJson<ProjectsWrapper>(projectsPath, { projects: [] });
if (!projectData || !Array.isArray(projectData.projects)) {
  projectData = { projects: [] };
}

let revertsData = readJson<RevertsWrapper>(revertsPath, { reverts: [] });
if (!revertsData || !Array.isArray(revertsData.reverts)) {
  revertsData = { reverts: [] };
}

// Project CRUD endpoints
router.get('/', (req: Request, res: Response) => {
  res.json(projectData);
});

router.post('/', (req: Request, res: Response) => {
  const payload: Partial<Project> = req.body;
  const newProject: Project = {
    id: 'proj-' + Date.now(),
    name: payload.name ?? 'Untitled Project',
    description: payload.description ?? '',
    // Map form fields to project data
    testSuite: payload.testSuite,
    language: payload.language,
    frameworkType: payload.frameworkType,
    tools: payload.tools ?? [],
    // Legacy fields for backward compatibility
    tooling: payload.tooling ?? payload.tools ?? ['Selenium', 'Playwright', 'Cypress'],
    languages: payload.languages ?? (payload.language ? [payload.language] : ['JavaScript', 'TypeScript']),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    files: Array.isArray(payload.files) ? (payload.files as FileEntry[]) : []
  };
  projectData.projects.push(newProject);
  writeJson<{ projects: Project[] }>(projectsPath, projectData);
  res.status(201).json(newProject);
});

router.get('/:id', (req: Request, res: Response) => {
  const id = req.params.id;
  const proj = projectData.projects.find(p => p.id === id);
  if (!proj) return res.status(404).json({ error: 'Project not found' });
  res.json(proj);
});

router.put('/:id', (req: Request, res: Response) => {
  const id = req.params.id;
  const payload: Partial<Project> = req.body;
  const index = projectData.projects.findIndex(p => p.id === id);
  if (index === -1) return res.status(404).json({ error: 'Project not found' });
  const existing = projectData.projects[index];
  const updated: Project = {
    ...existing,
    ...payload,
    id,
    updatedAt: new Date().toISOString(),
  } as Project;
  projectData.projects[index] = updated;
  writeJson<{ projects: Project[] }>(projectsPath, projectData);
  res.json(updated);
});

router.delete('/:id', async (req: Request, res: Response) => {
  const id = req.params.id;
  const idx = projectData.projects.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Project not found' });
  
  // Remove the project
  const removed = projectData.projects.splice(idx, 1)[0];
  writeJson<{ projects: Project[] }>(projectsPath, projectData);
  
  // Clean up associated test runs
  let deletedRuns = 0;
  try {
    const { cleanupRunsForProject } = await import('./testRuns');
    deletedRuns = cleanupRunsForProject(id);
  } catch (error) {
    console.error('Error cleaning up runs for project', id, error);
  }
  
  // Remove associated revert records
  const removedReverts = revertsData.reverts.filter(r => r.projectId === id);
  revertsData.reverts = revertsData.reverts.filter(r => r.projectId !== id);
  writeJson<RevertsWrapper>(revertsPath, revertsData);
  
  res.json({ 
    removed, 
    deletedRuns, 
    deletedReverts: removedReverts.length 
  });
});

// File management endpoints
router.get('/:id/files', (req: Request, res: Response) => {
  const id = req.params.id;
  const proj = projectData.projects.find(p => p.id === id);
  if (!proj) return res.status(404).json({ error: 'Project not found' });
  res.json({ files: proj.files ?? [] });
});

router.get('/:id/files/*', (req: Request, res: Response) => {
  const id = req.params.id;
  const filePath = req.params[0];
  const proj = projectData.projects.find(p => p.id === id);
  if (!proj) return res.status(404).json({ error: 'Project not found' });
  const file = (proj.files ?? []).find(f => f.path === filePath);
  if (!file) return res.status(404).json({ error: 'File not found' });
  res.json({ path: file.path, content: file.content });
});

router.put('/:id/files/*', (req: Request, res: Response) => {
  const id = req.params.id;
  const filePath = req.params[0];
  const content = req.body?.content ?? '';
  const proj = projectData.projects.find(p => p.id === id);
  if (!proj) return res.status(404).json({ error: 'Project not found' });

  const files = proj.files ?? [];
  const idx = files.findIndex(f => f.path === filePath);
  if (idx >= 0) {
    files[idx].content = content;
  } else {
    files.push({ path: filePath, content });
  }
  proj.files = files;
  proj.updatedAt = new Date().toISOString();
  writeJson<{ projects: Project[] }>(projectsPath, projectData);
  res.json({ id, path: filePath, content });
});

router.delete('/:id/files/*', (req: Request, res: Response) => {
  const id = req.params.id;
  const filePath = req.params[0];
  const proj = projectData.projects.find(p => p.id === id);
  if (!proj) return res.status(404).json({ error: 'Project not found' });
  const files = (proj.files ?? []).filter(f => f.path !== filePath);
  proj.files = files;
  proj.updatedAt = new Date().toISOString();
  writeJson<{ projects: Project[] }>(projectsPath, projectData);
  res.json({ id, deleted: filePath });
});

// Smart merge endpoints
router.post('/:id/preview-merge', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { files } = req.body;
    
    console.log('Preview merge request:', { id, files: files?.length, body: req.body });
    
    if (!Array.isArray(files)) {
      return res.status(400).json({ error: 'Files array required' });
    }
    
    const mergeResults = await previewCodeMerge(id, files);
    res.json({ mergeResults });
  } catch (error: any) {
    console.error('Preview merge error:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/apply-merge', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { files, resolvedConflicts, message } = req.body;
    
    console.log('Apply merge request:', { id, files: files?.length, resolvedConflicts, message });
    
    if (!Array.isArray(files)) {
      return res.status(400).json({ error: 'Files array required' });
    }
    
    // First preview the merge to get smart merge results
    const mergeResults = await previewCodeMerge(id, files);
    
    // Apply resolved conflicts if provided
    const finalFiles = files.map((file: FileEntry) => {
      const mergeResult = mergeResults.find(r => r.path === file.path);
      
      if (mergeResult && !mergeResult.hasConflicts) {
        // Auto-merged successfully
        return { path: file.path, content: mergeResult.mergedContent };
      } else if (resolvedConflicts && resolvedConflicts[file.path]) {
        // Use manually resolved content
        return { path: file.path, content: resolvedConflicts[file.path] };
      } else if (mergeResult && mergeResult.hasConflicts) {
        // Conflicts not resolved, use existing content
        return { path: file.path, content: mergeResult.mergedContent };
      } else {
        // New file or fallback
        return file;
      }
    });
    
    const result = await applyCodeToProject(id, finalFiles, message);
    res.json({ 
      ...result, 
      mergeResults,
      appliedFiles: finalFiles.length 
    });
  } catch (error: any) {
    console.error('Apply merge error:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ error: error.message });
  }
});

// Auto-merge endpoint that preserves existing code and adds new content
router.post('/:id/auto-merge', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { files, message } = req.body;
    
    if (!Array.isArray(files)) {
      return res.status(400).json({ error: 'Files array required' });
    }

    // Load existing project
    const project = projectData.projects.find(p => p.id === id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Perform auto-merge for each file
    const mergedFiles: any[] = [];
    const finalFiles: FileEntry[] = [];
    
    for (const file of files) {
      const existingFile = project.files?.find(f => f.path === file.path);
      
      if (!existingFile) {
        // New file - add directly
        finalFiles.push({
          path: file.path,
          content: file.content
        });
        mergedFiles.push({
          path: file.path,
          action: 'created',
          content: file.content
        });
      } else {
        // Existing file - perform intelligent auto-merge
        const mergedContent = performIntelligentAutoMergeBackend(
          existingFile.content, 
          file.content, 
          file.path
        );
        
        finalFiles.push({
          path: file.path,
          content: mergedContent
        });
        mergedFiles.push({
          path: file.path,
          action: 'merged',
          content: mergedContent,
          originalLength: existingFile.content.length,
          newLength: mergedContent.length
        });
      }
    }

    // Apply the auto-merged files
    const result = await applyCodeToProject(id, finalFiles, message || 'Auto-merge: preserve existing code, add new content');

    res.json({
      ...result,
      success: true,
      message: `Auto-merged ${mergedFiles.length} files`,
      mergedFiles,
      stats: {
        newFiles: mergedFiles.filter(f => f.action === 'created').length,
        mergedFiles: mergedFiles.filter(f => f.action === 'merged').length
      }
    });
  } catch (error: any) {
    console.error('Auto-merge error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Apply generated code to project - returns a revertId that can be used to undo
export async function applyCodeToProject(projectId: string, files: FileEntry[], message?: string) {
  console.log('Received projectId:', projectId);
  console.log('Available projects:', projectData.projects.map(p => p.id));
  
  const proj = projectData.projects.find(p => p.id === projectId);
  if (!proj) throw new Error('Project not found');

  const existingFiles = proj.files ?? [];
  const filesBefore: FileEntry[] = [];
  const filesAfter: FileEntry[] = [];

  // Apply each file individually, but only snapshot affected files
  const filesMap = new Map<string, string>();
  existingFiles.forEach(f => filesMap.set(f.path, f.content));
  files.forEach((f: FileEntry) => {
    const prior = filesMap.get(f.path);
    if (prior !== undefined) {
      filesBefore.push({ path: f.path, content: prior });
    } else {
      // represent new file with empty before snapshot (no entry)
      filesBefore.push({ path: f.path, content: '' });
    }
    filesMap.set(f.path, f.content);
    filesAfter.push({ path: f.path, content: f.content });
  });

  proj.files = Array.from(filesMap.entries()).map(([path, content]) => ({ path, content }));
  proj.updatedAt = new Date().toISOString();
  writeJson<{ projects: Project[] }>(projectsPath, projectData);

  const revertId = 'revert-' + Date.now();
  const record: RevertRecord = { 
    id: revertId, 
    projectId, 
    createdAt: new Date().toISOString(), 
    filesBefore, 
    filesAfter, 
    message 
  };
  revertsData.reverts.push(record);
  writeJson<RevertsWrapper>(revertsPath, revertsData);

  return { revertId, record };
}

// Smart merge functionality - checks for conflicts and provides merge preview
export async function previewCodeMerge(projectId: string, files: FileEntry[]) {
  console.log('previewCodeMerge called with:', { projectId, filesCount: files.length });
  
  try {
    const proj = projectData.projects.find(p => p.id === projectId);
    if (!proj) {
      console.log('Project not found:', projectId);
      throw new Error('Project not found');
    }

    const existingFiles = proj.files ?? [];
    const mergeResults: any[] = [];
    console.log('Existing files count:', existingFiles.length);

    for (const newFile of files) {
      console.log('Processing file:', newFile.path);
      
      // Validate newFile structure
      if (!newFile || typeof newFile.path !== 'string' || typeof newFile.content !== 'string') {
        console.error('Invalid file structure:', newFile);
        throw new Error(`Invalid file structure for file: ${JSON.stringify(newFile)}`);
      }
      
      const existingFile = existingFiles.find(f => f.path === newFile.path);
      
      if (!existingFile) {
        // New file - no conflicts
        console.log('New file detected:', newFile.path);
        mergeResults.push({
          path: newFile.path,
          hasConflicts: false,
          strategy: 'auto',
          mergedContent: newFile.content,
          isNewFile: true
        });
      } else {
        // File exists - for now, just do a simple merge without calling smartMergeForBackend
        console.log('Existing file found:', newFile.path);
        
        // Simple comparison for debugging
        const identical = existingFile.content.trim() === newFile.content.trim();
        
        mergeResults.push({
          path: newFile.path,
          hasConflicts: !identical,
          strategy: identical ? 'auto' : 'manual',
          mergedContent: identical ? existingFile.content : newFile.content,
          isNewFile: false
        });
        
        console.log('Simple merge result for', newFile.path, ':', identical ? 'identical' : 'different');
      }
    }

    console.log('Preview merge completed, results:', mergeResults.length);
    return mergeResults;
  } catch (error) {
    console.error('Error in previewCodeMerge:', error);
    throw error;
  }
}

// Backend version of smart merge (simplified for server-side use)
function smartMergeForBackend(existingContent: string, newContent: string, filePath: string) {
  console.log('smartMergeForBackend called for:', filePath);
  
  const fileExtension = filePath.split('.').pop()?.toLowerCase();
  console.log('File extension:', fileExtension);
  
  // For Python files, try to intelligently merge test functions
  if (fileExtension === 'py') {
    console.log('Using Python merge strategy');
    return mergePythonContent(existingContent, newContent);
  }
  
  // For JavaScript/TypeScript, merge functions and imports
  if (fileExtension === 'js' || fileExtension === 'ts') {
    console.log('Using JavaScript merge strategy');
    return mergeJavaScriptContent(existingContent, newContent);
  }
  
  // For other files, check if content is identical or completely different
  if (existingContent.trim() === newContent.trim()) {
    console.log('Content identical, no changes needed');
    return {
      hasConflicts: false,
      strategy: 'auto',
      mergedContent: existingContent
    };
  }
  
  // Default: mark as conflict for manual resolution
  return {
    hasConflicts: true,
    strategy: 'manual',
    mergedContent: existingContent,
    conflicts: [{
      type: 'modification',
      current: existingContent,
      incoming: newContent
    }]
  };
}

// Simplified Python merge for backend
function mergePythonContent(existing: string, incoming: string) {
  const existingLines = existing.split('\n');
  const incomingLines = incoming.split('\n');
  
  // Extract imports and functions from both
  const existingImports = existingLines.filter(line => line.trim().startsWith('import ') || line.trim().startsWith('from '));
  const incomingImports = incomingLines.filter(line => line.trim().startsWith('import ') || line.trim().startsWith('from '));
  
  // Check if incoming content has new test functions
  const incomingFunctions = extractPythonFunctions(incoming);
  const existingFunctions = extractPythonFunctions(existing);
  
  const newFunctions = incomingFunctions.filter(inFunc => 
    !existingFunctions.some(exFunc => exFunc.name === inFunc.name)
  );
  
  if (newFunctions.length > 0) {
    // Merge imports
    const allImports = [...new Set([...existingImports, ...incomingImports])];
    
    // Add new functions to existing content
    let merged = existing;
    for (const func of newFunctions) {
      merged += '\n\n' + func.content;
    }
    
    // Update imports if needed
    const mergedImports = allImports.join('\n');
    if (existingImports.join('\n') !== mergedImports) {
      // Replace imports section
      const firstNonImportIndex = existingLines.findIndex(line => 
        !line.trim().startsWith('import ') && 
        !line.trim().startsWith('from ') && 
        line.trim() !== ''
      );
      
      if (firstNonImportIndex >= 0) {
        const beforeImports = existingLines.slice(0, existingLines.findIndex(line => 
          line.trim().startsWith('import ') || line.trim().startsWith('from ')
        ));
        const afterImports = existingLines.slice(firstNonImportIndex);
        merged = [...beforeImports, ...allImports, '', ...afterImports].join('\n');
        
        // Add new functions
        for (const func of newFunctions) {
          merged += '\n\n' + func.content;
        }
      }
    }
    
    return {
      hasConflicts: false,
      strategy: 'auto',
      mergedContent: merged
    };
  }
  
  // No new functions found, mark as conflict
  return {
    hasConflicts: true,
    strategy: 'manual',
    mergedContent: existing,
    conflicts: [{
      type: 'modification',
      current: existing,
      incoming: incoming
    }]
  };
}

// Simplified JavaScript merge for backend
function mergeJavaScriptContent(existing: string, incoming: string) {
  // Similar logic for JavaScript/TypeScript files
  const existingFunctions = extractJavaScriptFunctions(existing);
  const incomingFunctions = extractJavaScriptFunctions(incoming);
  
  const newFunctions = incomingFunctions.filter(inFunc => 
    !existingFunctions.some(exFunc => exFunc.name === inFunc.name)
  );
  
  if (newFunctions.length > 0) {
    let merged = existing;
    for (const func of newFunctions) {
      merged += '\n\n' + func.content;
    }
    
    return {
      hasConflicts: false,
      strategy: 'auto',
      mergedContent: merged
    };
  }
  
  return {
    hasConflicts: true,
    strategy: 'manual',
    mergedContent: existing,
    conflicts: [{
      type: 'modification',
      current: existing,
      incoming: incoming
    }]
  };
}

// Helper function to extract Python functions
function extractPythonFunctions(content: string) {
  const lines = content.split('\n');
  const functions: { name: string; content: string }[] = [];
  let currentFunction: string[] = [];
  let inFunction = false;
  let functionName = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.trim().startsWith('def ')) {
      if (inFunction && currentFunction.length > 0) {
        functions.push({ name: functionName, content: currentFunction.join('\n') });
      }
      
      functionName = line.trim().match(/def\s+(\w+)/)?.[1] || '';
      currentFunction = [line];
      inFunction = true;
    } else if (inFunction) {
      if (line.trim() === '' || line.startsWith('    ') || line.startsWith('\t')) {
        currentFunction.push(line);
      } else if (!line.trim().startsWith('#')) {
        // End of function
        functions.push({ name: functionName, content: currentFunction.join('\n') });
        currentFunction = [];
        inFunction = false;
      } else {
        currentFunction.push(line);
      }
    }
  }
  
  if (inFunction && currentFunction.length > 0) {
    functions.push({ name: functionName, content: currentFunction.join('\n') });
  }
  
  return functions;
}

// Helper function to extract JavaScript functions
function extractJavaScriptFunctions(content: string) {
  const functionRegex = /(function\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?\}|const\s+\w+\s*=\s*\([^)]*\)\s*=>\s*\{[\s\S]*?\})/g;
  const functions: { name: string; content: string }[] = [];
  let match;
  
  while ((match = functionRegex.exec(content)) !== null) {
    const funcContent = match[0];
    const nameMatch = funcContent.match(/(function\s+(\w+)|const\s+(\w+)\s*=)/);
    const name = nameMatch ? (nameMatch[2] || nameMatch[3]) : 'anonymous';
    functions.push({ name, content: funcContent });
  }
  
  return functions;
}

// Revert an apply by revertId
export async function revertCodeChanges(revertId: string) {
  const record = revertsData.reverts.find(r => r.id === revertId);
  if (!record) throw new Error('Revert record not found');
  
  const proj = projectData.projects.find(p => p.id === record.projectId);
  if (!proj) throw new Error('Project not found');
  
  // Restore snapshot for affected files only
  const currentMap = new Map<string, string>();
  (proj.files ?? []).forEach(f => currentMap.set(f.path, f.content));
  
  record.filesBefore.forEach(f => {
    if (f.content === '') {
      // file was new, remove it
      currentMap.delete(f.path);
    } else {
      currentMap.set(f.path, f.content);
    }
  });
  
  proj.files = Array.from(currentMap.entries()).map(([path, content]) => ({ path, content }));
  proj.updatedAt = new Date().toISOString();
  writeJson<{ projects: Project[] }>(projectsPath, projectData);

  // Optionally remove revert record or mark as applied
  revertsData.reverts = revertsData.reverts.filter(r => r.id !== revertId);
  writeJson<RevertsWrapper>(revertsPath, revertsData);

  return { reverted: revertId, projectId: record.projectId };
}

// Export both router and data for use by other modules
export default router;

// Intelligent auto-merge function for backend
function performIntelligentAutoMergeBackend(existing: string, incoming: string, filePath: string): string {
  const fileExtension = filePath.split('.').pop()?.toLowerCase();
  const fileName = filePath.split('/').pop()?.toLowerCase() || '';
  
  // Handle specific files by name
  if (fileName === 'requirements.txt') {
    return autoMergeRequirementsTxt(existing, incoming);
  }
  if (fileName === 'readme.md' || fileName.includes('readme')) {
    return autoMergeReadme(existing, incoming);
  }
  if (fileName === 'pytest.ini' || fileName.endsWith('.ini')) {
    return autoMergeConfigFile(existing, incoming);
  }
  
  // Handle by file extension
  switch (fileExtension) {
    case 'py':
      return autoMergePythonBackend(existing, incoming);
    case 'js':
    case 'ts':
      return autoMergeJavaScriptBackend(existing, incoming);
    case 'java':
      return autoMergeJavaBackend(existing, incoming);
    case 'cs':
      return autoMergeCSharpBackend(existing, incoming);
    default:
      // For other files, check if content is already merged to avoid duplication
      if (existing.includes(incoming.trim()) || incoming.includes(existing.trim())) {
        return existing; // Avoid duplication
      }
      // Only add separator if content is different
      return existing + '\n\n// Auto-merged content\n' + incoming;
  }
}

function autoMergePythonBackend(existing: string, incoming: string): string {
  const existingLines = existing.split('\n');
  const incomingLines = incoming.split('\n');
  
  // Extract and merge imports
  const existingImports = existingLines.filter(line => 
    line.trim().startsWith('import ') || line.trim().startsWith('from ')
  );
  const incomingImports = incomingLines.filter(line => 
    line.trim().startsWith('import ') || line.trim().startsWith('from ')
  );
  
  const allImports = [...existingImports];
  incomingImports.forEach(imp => {
    if (!existingImports.some(existing => existing.trim() === imp.trim())) {
      allImports.push(imp);
    }
  });
  
  // Extract function names from existing code
  const existingFunctionNames = (existing.match(/^def\s+(\w+)/gm) || [])
    .map(match => match.replace('def ', '').trim());
  
  // Extract new functions from incoming code
  const newFunctions: string[] = [];
  const lines = incoming.split('\n');
  let currentFunction: string[] = [];
  let inFunction = false;
  let functionName = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.trim().startsWith('def ')) {
      if (inFunction && currentFunction.length > 0) {
        if (!existingFunctionNames.includes(functionName)) {
          newFunctions.push(currentFunction.join('\n'));
        }
      }
      
      const match = line.trim().match(/def\s+(\w+)/);
      functionName = match ? match[1] : '';
      currentFunction = [line];
      inFunction = true;
    } else if (inFunction) {
      if (line.trim() === '' || line.startsWith('    ') || line.startsWith('\t') || line.trim().startsWith('#')) {
        currentFunction.push(line);
      } else if (!line.trim().startsWith('def ')) {
        if (!existingFunctionNames.includes(functionName)) {
          newFunctions.push(currentFunction.join('\n'));
        }
        currentFunction = [];
        inFunction = false;
      }
    }
  }
  
  if (inFunction && currentFunction.length > 0 && !existingFunctionNames.includes(functionName)) {
    newFunctions.push(currentFunction.join('\n'));
  }
  
  // Build merged content
  let merged = existing;
  
  // Replace imports if new ones were added
  if (allImports.length > existingImports.length) {
    const firstNonImportIndex = existingLines.findIndex(line => 
      !line.trim().startsWith('import ') && 
      !line.trim().startsWith('from ') && 
      line.trim() !== ''
    );
    
    if (firstNonImportIndex >= 0) {
      const beforeImports = existingLines.slice(0, existingLines.findIndex(line => 
        line.trim().startsWith('import ') || line.trim().startsWith('from ')
      ));
      const afterImports = existingLines.slice(firstNonImportIndex);
      merged = [...beforeImports, ...allImports, '', ...afterImports].join('\n');
    }
  }
  
  // Append new functions
  if (newFunctions.length > 0) {
    merged += '\n\n' + newFunctions.join('\n\n');
  }
  
  return merged;
}

function autoMergeJavaScriptBackend(existing: string, incoming: string): string {
  // Extract new functions that don't exist in existing code
  const existingFunctionNames = (existing.match(/(function\s+(\w+)|const\s+(\w+)\s*=)/g) || [])
    .map(match => {
      const nameMatch = match.match(/(function\s+(\w+)|const\s+(\w+)\s*=)/);
      return nameMatch ? (nameMatch[2] || nameMatch[3]) : '';
    })
    .filter(name => name);
  
  // Extract functions from incoming code
  const functionRegex = /(function\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?\}|const\s+\w+\s*=\s*\([^)]*\)\s*=>\s*\{[\s\S]*?\})/g;
  const newFunctions: string[] = [];
  let match;
  
  while ((match = functionRegex.exec(incoming)) !== null) {
    const funcContent = match[0];
    const nameMatch = funcContent.match(/(function\s+(\w+)|const\s+(\w+)\s*=)/);
    const name = nameMatch ? (nameMatch[2] || nameMatch[3]) : null;
    
    if (name && !existingFunctionNames.includes(name)) {
      newFunctions.push(funcContent);
    }
  }
  
  let merged = existing;
  if (newFunctions.length > 0) {
    merged += '\n\n' + newFunctions.join('\n\n');
  }
  
  return merged;
}

function autoMergeJavaBackend(existing: string, incoming: string): string {
  // Extract new methods
  const existingMethods = existing.match(/(public|private|protected)\s+[\w<>\[\]]+\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?\}/g) || [];
  const incomingMethods = incoming.match(/(public|private|protected)\s+[\w<>\[\]]+\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?\}/g) || [];
  
  const existingNames = existingMethods.map(method => {
    const nameMatch = method.match(/\s+(\w+)\s*\(/);
    return nameMatch ? nameMatch[1] : '';
  });
  
  const newMethods = incomingMethods.filter(method => {
    const nameMatch = method.match(/\s+(\w+)\s*\(/);
    const name = nameMatch ? nameMatch[1] : '';
    return name && !existingNames.includes(name);
  });
  
  if (newMethods.length > 0) {
    const lastBraceIndex = existing.lastIndexOf('}');
    if (lastBraceIndex > 0) {
      return existing.substring(0, lastBraceIndex) + '\n\n' + newMethods.join('\n\n') + '\n' + existing.substring(lastBraceIndex);
    }
  }
  
  return existing;
}

function autoMergeCSharpBackend(existing: string, incoming: string): string {
  // Similar to Java but with C# syntax
  const existingMethods = existing.match(/(public|private|protected|internal)\s+[\w<>\[\]]+\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?\}/g) || [];
  const incomingMethods = incoming.match(/(public|private|protected|internal)\s+[\w<>\[\]]+\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?\}/g) || [];
  
  const existingNames = existingMethods.map(method => {
    const nameMatch = method.match(/\s+(\w+)\s*\(/);
    return nameMatch ? nameMatch[1] : '';
  });
  
  const newMethods = incomingMethods.filter(method => {
    const nameMatch = method.match(/\s+(\w+)\s*\(/);
    const name = nameMatch ? nameMatch[1] : '';
    return name && !existingNames.includes(name);
  });
  
  if (newMethods.length > 0) {
    const lastBraceIndex = existing.lastIndexOf('}');
    if (lastBraceIndex > 0) {
      return existing.substring(0, lastBraceIndex) + '\n\n' + newMethods.join('\n\n') + '\n' + existing.substring(lastBraceIndex);
    }
  }
  
  return existing;
}

// Auto-merge for requirements.txt files
function autoMergeRequirementsTxt(existing: string, incoming: string): string {
  const existingLines = existing.split('\n').map(line => line.trim()).filter(line => line);
  const incomingLines = incoming.split('\n').map(line => line.trim()).filter(line => line);
  
  // Create a map of package names to versions from existing
  const existingPackages = new Map<string, string>();
  existingLines.forEach(line => {
    if (line && !line.startsWith('#')) {
      const [packageName] = line.split('==');
      if (packageName) {
        existingPackages.set(packageName.trim(), line);
      }
    }
  });
  
  // Merge incoming packages, preferring newer versions
  incomingLines.forEach(line => {
    if (line && !line.startsWith('#')) {
      const [packageName, version] = line.split('==');
      if (packageName) {
        const existing = existingPackages.get(packageName.trim());
        if (!existing) {
          // New package, add it
          existingPackages.set(packageName.trim(), line);
        } else {
          // Package exists, prefer higher version
          const existingVersion = existing.split('==')[1];
          if (version && existingVersion && compareVersions(version, existingVersion) > 0) {
            existingPackages.set(packageName.trim(), line);
          }
        }
      }
    }
  });
  
  // Return merged requirements
  return Array.from(existingPackages.values()).sort().join('\n');
}

// Auto-merge for README.md files
function autoMergeReadme(existing: string, incoming: string): string {
  // For README files, avoid duplication and merge sections intelligently
  const existingLower = existing.toLowerCase();
  const incomingLines = incoming.split('\n');
  
  let result = existing;
  
  // Add new sections that don't exist
  const sections = incomingLines.join('\n').split(/\n#{1,6}\s/);
  sections.forEach(section => {
    const firstLine = section.split('\n')[0];
    if (firstLine && !existingLower.includes(firstLine.toLowerCase())) {
      result += '\n\n## ' + section;
    }
  });
  
  return result;
}

// Auto-merge for config files like pytest.ini
function autoMergeConfigFile(existing: string, incoming: string): string {
  const existingLines = existing.split('\n');
  const incomingLines = incoming.split('\n');
  
  // Parse sections and merge
  const sections = new Map<string, string[]>();
  let currentSection = '';
  
  // Parse existing file
  existingLines.forEach(line => {
    if (line.trim().startsWith('[') && line.trim().endsWith(']')) {
      currentSection = line.trim();
      if (!sections.has(currentSection)) {
        sections.set(currentSection, []);
      }
    } else if (currentSection) {
      sections.get(currentSection)?.push(line);
    }
  });
  
  // Parse and merge incoming file
  currentSection = '';
  incomingLines.forEach(line => {
    if (line.trim().startsWith('[') && line.trim().endsWith(']')) {
      currentSection = line.trim();
      if (!sections.has(currentSection)) {
        sections.set(currentSection, []);
      }
    } else if (currentSection && line.trim()) {
      const existingSection = sections.get(currentSection) || [];
      if (!existingSection.some(existing => existing.trim() === line.trim())) {
        sections.get(currentSection)?.push(line);
      }
    }
  });
  
  // Rebuild file
  let result = '';
  sections.forEach((lines, sectionName) => {
    result += sectionName + '\n';
    lines.forEach(line => {
      result += line + '\n';
    });
    result += '\n';
  });
  
  return result.trim();
}

// Simple version comparison function
function compareVersions(a: string, b: string): number {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);
  const maxLength = Math.max(aParts.length, bParts.length);
  
  for (let i = 0; i < maxLength; i++) {
    const aPart = aParts[i] || 0;
    const bPart = bParts[i] || 0;
    
    if (aPart > bPart) return 1;
    if (aPart < bPart) return -1;
  }
  
  return 0;
}

export { projectData, revertsData };