import React, { useState } from 'react';
import DiffViewer from './DiffViewer';
import { Check, X, ChevronDown, ChevronUp, GitMerge, FileCode, AlertTriangle } from 'lucide-react';

interface MergeResult {
  path: string;
  hasConflicts: boolean;
  mergedContent: string;
  isNewFile: boolean;
  strategy: 'auto' | 'manual';
  conflicts?: any[];
}

interface MergeConflictDialogProps {
  mergeResults: MergeResult[];
  pendingFiles: { path: string; content: string }[];
  onResolve: (resolvedContent: Record<string, string>) => void;
  onCancel: () => void;
  lightMode: boolean;
}

export default function MergeConflictDialog({
  mergeResults,
  pendingFiles,
  onResolve,
  onCancel,
  lightMode
}: MergeConflictDialogProps) {
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [resolvedContents, setResolvedContents] = useState<Record<string, string>>({});

  const handleFileResolve = (filePath: string, content: string) => {
    setResolvedContents(prev => ({ ...prev, [filePath]: content }));
  };

  const handleAcceptAll = () => {
    const finalResolutions: Record<string, string> = {};
    
    mergeResults.forEach((result) => {
      if (result.hasConflicts && resolvedContents[result.path]) {
        finalResolutions[result.path] = resolvedContents[result.path];
      } else if (!result.hasConflicts) {
        finalResolutions[result.path] = result.mergedContent;
      } else {
        // Fallback to current content for unresolved conflicts
        const originalFile = pendingFiles.find(f => f.path === result.path);
        finalResolutions[result.path] = originalFile?.content || result.mergedContent;
      }
    });
    
    onResolve(finalResolutions);
  };

  const handleAutoMerge = () => {
    const finalResolutions: Record<string, string> = {};
    
    mergeResults.forEach((result) => {
      const originalFile = pendingFiles.find(f => f.path === result.path);
      const existingContent = originalFile?.content || '';
      
      if (result.isNewFile) {
        // New file - use the new content directly
        finalResolutions[result.path] = result.mergedContent;
      } else {
        // Existing file - perform intelligent auto-merge
        const autoMerged = performIntelligentAutoMerge(existingContent, result.mergedContent, result.path);
        finalResolutions[result.path] = autoMerged;
      }
    });
    
    onResolve(finalResolutions);
  };

  // Intelligent auto-merge that preserves existing code and adds new content
  const performIntelligentAutoMerge = (existing: string, incoming: string, filePath: string): string => {
    const fileExtension = filePath.split('.').pop()?.toLowerCase();
    
    if (fileExtension === 'py') {
      return autoMergePython(existing, incoming);
    } else if (fileExtension === 'js' || fileExtension === 'ts') {
      return autoMergeJavaScript(existing, incoming);
    } else if (fileExtension === 'java') {
      return autoMergeJava(existing, incoming);
    } else if (fileExtension === 'cs') {
      return autoMergeCSharp(existing, incoming);
    } else {
      // For other files, append new content with separator
      return existing + '\n\n// Auto-merged content\n' + incoming;
    }
  };

  const autoMergePython = (existing: string, incoming: string): string => {
    const existingLines = existing.split('\n');
    const incomingLines = incoming.split('\n');
    
    // Extract imports
    const existingImports = existingLines.filter(line => 
      line.trim().startsWith('import ') || line.trim().startsWith('from ')
    );
    const incomingImports = incomingLines.filter(line => 
      line.trim().startsWith('import ') || line.trim().startsWith('from ')
    );
    
    // Merge imports (avoid duplicates)
    const allImports = [...existingImports];
    incomingImports.forEach(imp => {
      if (!existingImports.some(existing => existing.trim() === imp.trim())) {
        allImports.push(imp);
      }
    });
    
    // Extract functions from incoming that don't exist in existing
    const existingFunctionNames = extractPythonFunctionNames(existing);
    const newFunctions = extractNewPythonFunctions(incoming, existingFunctionNames);
    
    // Build merged content
    let merged = existing;
    
    // Replace imports section if new imports were added
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
  };

  const autoMergeJavaScript = (existing: string, incoming: string): string => {
    // Extract imports/requires
    const existingImports = existing.match(/^(import .+|const .+ = require\(.+\));?$/gm) || [];
    const incomingImports = incoming.match(/^(import .+|const .+ = require\(.+\));?$/gm) || [];
    
    // Merge imports
    const allImports = [...existingImports];
    incomingImports.forEach(imp => {
      if (!existingImports.some(existing => existing.trim() === imp.trim())) {
        allImports.push(imp);
      }
    });
    
    // Extract new functions
    const existingFunctionNames = extractJavaScriptFunctionNames(existing);
    const newFunctions = extractNewJavaScriptFunctions(incoming, existingFunctionNames);
    
    let merged = existing;
    
    // Append new functions
    if (newFunctions.length > 0) {
      merged += '\n\n' + newFunctions.join('\n\n');
    }
    
    return merged;
  };

  const autoMergeJava = (existing: string, incoming: string): string => {
    // Simple approach: append new methods to existing class
    const newMethods = extractNewJavaMethods(existing, incoming);
    if (newMethods.length > 0) {
      // Insert before the last closing brace
      const lastBraceIndex = existing.lastIndexOf('}');
      if (lastBraceIndex > 0) {
        return existing.substring(0, lastBraceIndex) + '\n\n' + newMethods.join('\n\n') + '\n' + existing.substring(lastBraceIndex);
      }
    }
    return existing + '\n\n' + incoming;
  };

  const autoMergeCSharp = (existing: string, incoming: string): string => {
    // Similar to Java - append new methods
    const newMethods = extractNewCSharpMethods(existing, incoming);
    if (newMethods.length > 0) {
      const lastBraceIndex = existing.lastIndexOf('}');
      if (lastBraceIndex > 0) {
        return existing.substring(0, lastBraceIndex) + '\n\n' + newMethods.join('\n\n') + '\n' + existing.substring(lastBraceIndex);
      }
    }
    return existing + '\n\n' + incoming;
  };

  // Helper functions
  const extractPythonFunctionNames = (content: string): string[] => {
    const matches = content.match(/^def\s+(\w+)/gm) || [];
    return matches.map(match => match.replace('def ', '').trim());
  };

  const extractNewPythonFunctions = (content: string, existingNames: string[]): string[] => {
    const functions: string[] = [];
    const lines = content.split('\n');
    let currentFunction: string[] = [];
    let inFunction = false;
    let functionName = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.trim().startsWith('def ')) {
        if (inFunction && currentFunction.length > 0) {
          if (!existingNames.includes(functionName)) {
            functions.push(currentFunction.join('\n'));
          }
        }
        
        functionName = line.trim().match(/def\s+(\w+)/)?.[1] || '';
        currentFunction = [line];
        inFunction = true;
      } else if (inFunction) {
        if (line.trim() === '' || line.startsWith('    ') || line.startsWith('\t') || line.trim().startsWith('#')) {
          currentFunction.push(line);
        } else if (!line.trim().startsWith('def ')) {
          // End of function
          if (!existingNames.includes(functionName)) {
            functions.push(currentFunction.join('\n'));
          }
          currentFunction = [];
          inFunction = false;
        }
      }
    }
    
    if (inFunction && currentFunction.length > 0 && !existingNames.includes(functionName)) {
      functions.push(currentFunction.join('\n'));
    }
    
    return functions;
  };

  const extractJavaScriptFunctionNames = (content: string): string[] => {
    const functionMatches = content.match(/(function\s+(\w+)|const\s+(\w+)\s*=|function\s*\(|\w+\s*\()/g) || [];
    const names: string[] = [];
    functionMatches.forEach(match => {
      const nameMatch = match.match(/(function\s+(\w+)|const\s+(\w+)\s*=)/);
      if (nameMatch) {
        names.push(nameMatch[2] || nameMatch[3]);
      }
    });
    return names;
  };

  const extractNewJavaScriptFunctions = (content: string, existingNames: string[]): string[] => {
    const functionRegex = /(function\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?\}|const\s+\w+\s*=\s*\([^)]*\)\s*=>\s*\{[\s\S]*?\})/g;
    const functions: string[] = [];
    let match;
    
    while ((match = functionRegex.exec(content)) !== null) {
      const funcContent = match[0];
      const nameMatch = funcContent.match(/(function\s+(\w+)|const\s+(\w+)\s*=)/);
      const name = nameMatch ? (nameMatch[2] || nameMatch[3]) : null;
      
      if (name && !existingNames.includes(name)) {
        functions.push(funcContent);
      }
    }
    
    return functions;
  };

  const extractNewJavaMethods = (existing: string, incoming: string): string[] => {
    const existingMethods = existing.match(/(public|private|protected)\s+[\w<>\[\]]+\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?\}/g) || [];
    const incomingMethods = incoming.match(/(public|private|protected)\s+[\w<>\[\]]+\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?\}/g) || [];
    
    const existingNames = existingMethods.map(method => {
      const nameMatch = method.match(/\s+(\w+)\s*\(/);
      return nameMatch ? nameMatch[1] : '';
    });
    
    return incomingMethods.filter(method => {
      const nameMatch = method.match(/\s+(\w+)\s*\(/);
      const name = nameMatch ? nameMatch[1] : '';
      return name && !existingNames.includes(name);
    });
  };

  const extractNewCSharpMethods = (existing: string, incoming: string): string[] => {
    // Similar to Java but with C# syntax
    const existingMethods = existing.match(/(public|private|protected|internal)\s+[\w<>\[\]]+\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?\}/g) || [];
    const incomingMethods = incoming.match(/(public|private|protected|internal)\s+[\w<>\[\]]+\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?\}/g) || [];
    
    const existingNames = existingMethods.map(method => {
      const nameMatch = method.match(/\s+(\w+)\s*\(/);
      return nameMatch ? nameMatch[1] : '';
    });
    
    return incomingMethods.filter(method => {
      const nameMatch = method.match(/\s+(\w+)\s*\(/);
      const name = nameMatch ? nameMatch[1] : '';
      return name && !existingNames.includes(name);
    });
  };

  const canAcceptAll = mergeResults.every(result => 
    !result.hasConflicts || resolvedContents[result.path]
  );

  const conflictCount = mergeResults.filter(r => r.hasConflicts).length;
  const resolvedCount = Object.keys(resolvedContents).length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={`flex items-center justify-between p-4 border-b ${lightMode ? 'border-slate-200' : 'border-[var(--vscode-border)]'}`}>
        <div className="flex items-center gap-3">
          <GitMerge className={`w-5 h-5 ${lightMode ? 'text-blue-600' : 'text-blue-400'}`} />
          <div>
            <h3 className={`font-semibold ${lightMode ? 'text-slate-900' : 'text-[var(--vscode-text)]'}`}>
              Smart Code Merge
            </h3>
            <p className={`text-sm ${lightMode ? 'text-slate-600' : 'text-[var(--vscode-text-secondary)]'}`}>
              {conflictCount > 0 
                ? `${resolvedCount}/${conflictCount} conflicts resolved • Use Auto-Merge to preserve existing code`
                : 'All files can be merged automatically • Use Auto-Merge for additive-only changes'
              }
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleAutoMerge}
            className="px-4 py-2 rounded text-sm font-medium flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700"
            title="Automatically merge new content while preserving existing code"
          >
            <GitMerge className="w-4 h-4" />
            Auto-Merge
          </button>
          <button
            onClick={handleAcceptAll}
            disabled={!canAcceptAll}
            className={`px-4 py-2 rounded text-sm font-medium flex items-center gap-2 ${
              canAcceptAll
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Check className="w-4 h-4" />
            Apply Changes
          </button>
          <button
            onClick={onCancel}
            className={`px-4 py-2 rounded text-sm font-medium border ${
              lightMode 
                ? 'border-slate-300 text-slate-700 hover:bg-slate-50' 
                : 'border-[var(--vscode-border)] text-[var(--vscode-text)] hover:bg-[var(--vscode-bg)]'
            }`}
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
        </div>
      </div>

      {/* File tabs */}
      <div className={`flex border-b ${lightMode ? 'border-slate-200 bg-slate-50' : 'border-[var(--vscode-border)] bg-[var(--vscode-bg)]'}`}>
        {mergeResults.map((result, index) => (
          <button
            key={result.path}
            onClick={() => setActiveFileIndex(index)}
            className={`px-4 py-2 text-sm font-medium border-r ${
              lightMode ? 'border-slate-200' : 'border-[var(--vscode-border)]'
            } ${
              activeFileIndex === index
                ? lightMode
                  ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                  : 'bg-[var(--vscode-panel)] text-blue-400 border-b-2 border-blue-400'
                : lightMode
                  ? 'text-slate-700 hover:bg-slate-100'
                  : 'text-[var(--vscode-text)] hover:bg-[var(--vscode-bg)]'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4" />
              <span>{result.path.split('/').pop()}</span>
              {result.hasConflicts && !resolvedContents[result.path] && (
                <AlertTriangle className="w-3 h-3 text-yellow-500" />
              )}
              {result.hasConflicts && resolvedContents[result.path] && (
                <Check className="w-3 h-3 text-green-500" />
              )}
              {result.isNewFile && (
                <span className={`px-1 py-0.5 text-xs rounded ${
                  lightMode ? 'bg-green-100 text-green-700' : 'bg-green-900 text-green-300'
                }`}>
                  NEW
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {mergeResults[activeFileIndex] && (
          <MergeFileViewer
            result={mergeResults[activeFileIndex]}
            pendingFile={pendingFiles.find(f => f.path === mergeResults[activeFileIndex].path)}
            onResolve={(content) => handleFileResolve(mergeResults[activeFileIndex].path, content)}
            lightMode={lightMode}
          />
        )}
      </div>
    </div>
  );
}

interface MergeFileViewerProps {
  result: MergeResult;
  pendingFile?: { path: string; content: string };
  onResolve: (content: string) => void;
  lightMode: boolean;
}

function MergeFileViewer({ result, pendingFile, onResolve, lightMode }: MergeFileViewerProps) {
  if (!result.hasConflicts) {
    return (
      <div className="p-6">
        <div className={`flex items-center gap-3 p-4 rounded-lg ${
          lightMode ? 'bg-green-50 border border-green-200' : 'bg-green-900/20 border border-green-800'
        }`}>
          <Check className="w-5 h-5 text-green-600" />
          <div>
            <h4 className={`font-medium ${lightMode ? 'text-green-900' : 'text-green-100'}`}>
              Auto-merged successfully
            </h4>
            <p className={`text-sm ${lightMode ? 'text-green-700' : 'text-green-300'}`}>
              {result.isNewFile 
                ? 'New file will be created with the generated content'
                : 'New content will be intelligently merged with existing code'
              }
            </p>
          </div>
        </div>

        <div className="mt-4">
          <h5 className={`text-sm font-medium mb-2 ${lightMode ? 'text-slate-700' : 'text-[var(--vscode-text)]'}`}>
            Preview of merged content:
          </h5>
          <div className={`p-4 rounded border ${
            lightMode ? 'bg-slate-50 border-slate-200' : 'bg-[var(--vscode-bg)] border-[var(--vscode-border)]'
          }`}>
            <pre className={`text-sm overflow-auto max-h-64 ${
              lightMode ? 'text-slate-700' : 'text-[var(--vscode-text)]'
            }`}>
              {result.mergedContent.substring(0, 1000)}
              {result.mergedContent.length > 1000 && '...'}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  if (!pendingFile) return null;

  // Create a simplified merge result for the DiffViewer
  const diffViewerResult = {
    merged: result.mergedContent,
    hasConflicts: true,
    conflicts: result.conflicts || [],
    strategy: 'manual' as const
  };

  return (
    <div className="h-full">
      <DiffViewer
        existingContent={result.isNewFile ? '' : result.mergedContent}
        mergeResult={diffViewerResult}
        filePath={result.path}
        onAcceptMerge={onResolve}
        onRejectMerge={() => {}}
        onResolveConflict={(conflictIndex, resolution) => {
          // Handle individual conflict resolution
          // This would update the merged content with the resolution
          onResolve(resolution);
        }}
      />
    </div>
  );
}