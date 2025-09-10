import React, { useState } from 'react';
import { DiffLine, MergeResult, MergeConflict } from '../lib/codeMerger';
import { Check, X, GitMerge, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';

interface DiffViewerProps {
  existingContent: string;
  mergeResult: MergeResult;
  filePath: string;
  onAcceptMerge: (mergedContent: string) => void;
  onRejectMerge: () => void;
  onResolveConflict: (conflictIndex: number, resolution: string) => void;
}

export default function DiffViewer({
  existingContent,
  mergeResult,
  filePath,
  onAcceptMerge,
  onRejectMerge,
  onResolveConflict
}: DiffViewerProps) {
  const [expandedConflicts, setExpandedConflicts] = useState<Set<number>>(new Set());
  const [conflictResolutions, setConflictResolutions] = useState<Map<number, string>>(new Map());
  
  const toggleConflictExpansion = (index: number) => {
    const newExpanded = new Set(expandedConflicts);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedConflicts(newExpanded);
  };

  const handleConflictResolution = (conflictIndex: number, resolution: 'current' | 'incoming' | 'both') => {
    const conflict = mergeResult.conflicts[conflictIndex];
    let resolvedContent = '';
    
    switch (resolution) {
      case 'current':
        resolvedContent = conflict.current;
        break;
      case 'incoming':
        resolvedContent = conflict.incoming;
        break;
      case 'both':
        resolvedContent = conflict.current + '\n' + conflict.incoming;
        break;
    }
    
    setConflictResolutions(prev => new Map(prev).set(conflictIndex, resolvedContent));
    onResolveConflict(conflictIndex, resolvedContent);
  };

  const getFinalMergedContent = (): string => {
    if (!mergeResult.hasConflicts) {
      return mergeResult.merged;
    }
    
    let content = mergeResult.merged;
    
    // Apply conflict resolutions
    mergeResult.conflicts.forEach((conflict, index) => {
      const resolution = conflictResolutions.get(index);
      if (resolution) {
        // Replace conflict markers with resolution
        content = content.replace(
          `<<<<<<< CURRENT\n${conflict.current}\n=======\n${conflict.incoming}\n>>>>>>> INCOMING`,
          resolution
        );
      }
    });
    
    return content;
  };

  const canAcceptMerge = !mergeResult.hasConflicts || 
    mergeResult.conflicts.every((_, index) => conflictResolutions.has(index));

  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 px-4 py-3 border-b flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <GitMerge className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="font-medium text-gray-900">{filePath}</h3>
            <p className="text-sm text-gray-500">
              {mergeResult.hasConflicts ? (
                <span className="flex items-center text-orange-600">
                  <AlertTriangle className="w-4 h-4 mr-1" />
                  {mergeResult.conflicts.length} conflict{mergeResult.conflicts.length !== 1 ? 's' : ''} to resolve
                </span>
              ) : (
                <span className="text-green-600">Auto-merge successful</span>
              )}
            </p>
          </div>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={onRejectMerge}
            className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center space-x-1"
          >
            <X className="w-4 h-4" />
            <span>Cancel</span>
          </button>
          <button
            onClick={() => onAcceptMerge(getFinalMergedContent())}
            disabled={!canAcceptMerge}
            className={`px-3 py-1.5 text-sm rounded flex items-center space-x-1 ${
              canAcceptMerge
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>Accept Merge</span>
          </button>
        </div>
      </div>

      {/* Conflicts Section */}
      {mergeResult.hasConflicts && (
        <div className="bg-orange-50 border-b">
          <div className="px-4 py-3">
            <h4 className="font-medium text-orange-900 mb-3">Resolve Conflicts</h4>
            <div className="space-y-3">
              {mergeResult.conflicts.map((conflict, index) => (
                <div key={index} className="bg-white border border-orange-200 rounded">
                  <button
                    onClick={() => toggleConflictExpansion(index)}
                    className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-gray-50"
                  >
                    <div className="flex items-center space-x-2">
                      {expandedConflicts.has(index) ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      <span className="font-medium text-sm">
                        Conflict {index + 1}: {conflict.type}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      Lines {conflict.lineStart}-{conflict.lineEnd}
                    </span>
                  </button>
                  
                  {expandedConflicts.has(index) && (
                    <div className="border-t p-3 space-y-3">
                      {/* Current Version */}
                      <div className="bg-red-50 border border-red-200 rounded">
                        <div className="px-3 py-2 bg-red-100 border-b border-red-200">
                          <span className="text-sm font-medium text-red-800">Current (Your Code)</span>
                        </div>
                        <pre className="px-3 py-2 text-sm font-mono text-red-900 whitespace-pre-wrap">
                          {conflict.current}
                        </pre>
                      </div>
                      
                      {/* Incoming Version */}
                      <div className="bg-green-50 border border-green-200 rounded">
                        <div className="px-3 py-2 bg-green-100 border-b border-green-200">
                          <span className="text-sm font-medium text-green-800">Incoming (AI Generated)</span>
                        </div>
                        <pre className="px-3 py-2 text-sm font-mono text-green-900 whitespace-pre-wrap">
                          {conflict.incoming}
                        </pre>
                      </div>
                      
                      {/* Resolution Options */}
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleConflictResolution(index, 'current')}
                          className="px-3 py-1.5 text-sm bg-red-100 text-red-800 rounded hover:bg-red-200 border border-red-300"
                        >
                          Keep Current
                        </button>
                        <button
                          onClick={() => handleConflictResolution(index, 'incoming')}
                          className="px-3 py-1.5 text-sm bg-green-100 text-green-800 rounded hover:bg-green-200 border border-green-300"
                        >
                          Use Incoming
                        </button>
                        <button
                          onClick={() => handleConflictResolution(index, 'both')}
                          className="px-3 py-1.5 text-sm bg-blue-100 text-blue-800 rounded hover:bg-blue-200 border border-blue-300"
                        >
                          Keep Both
                        </button>
                      </div>
                      
                      {conflictResolutions.has(index) && (
                        <div className="bg-blue-50 border border-blue-200 rounded">
                          <div className="px-3 py-2 bg-blue-100 border-b border-blue-200">
                            <span className="text-sm font-medium text-blue-800">Resolution</span>
                          </div>
                          <pre className="px-3 py-2 text-sm font-mono text-blue-900 whitespace-pre-wrap">
                            {conflictResolutions.get(index)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Diff View */}
      <div className="max-h-96 overflow-y-auto">
        <DiffDisplay 
          existingContent={existingContent} 
          mergedContent={getFinalMergedContent()} 
        />
      </div>
    </div>
  );
}

// Component to display line-by-line diff
function DiffDisplay({ existingContent, mergedContent }: { existingContent: string; mergedContent: string }) {
  const existingLines = existingContent.split('\n');
  const mergedLines = mergedContent.split('\n');
  
  // Simple diff algorithm
  const maxLines = Math.max(existingLines.length, mergedLines.length);
  const diffLines: Array<{type: 'unchanged' | 'removed' | 'added', content: string, lineNum?: number}> = [];
  
  for (let i = 0; i < maxLines; i++) {
    const existingLine = existingLines[i];
    const mergedLine = mergedLines[i];
    
    if (existingLine === mergedLine) {
      diffLines.push({ type: 'unchanged', content: existingLine || '', lineNum: i + 1 });
    } else {
      if (existingLine !== undefined) {
        diffLines.push({ type: 'removed', content: existingLine, lineNum: i + 1 });
      }
      if (mergedLine !== undefined) {
        diffLines.push({ type: 'added', content: mergedLine });
      }
    }
  }
  
  return (
    <div className="font-mono text-sm">
      {diffLines.map((line, index) => (
        <div
          key={index}
          className={`flex items-start space-x-3 px-4 py-1 ${
            line.type === 'removed' ? 'bg-red-50 text-red-900' :
            line.type === 'added' ? 'bg-green-50 text-green-900' :
            'bg-white'
          }`}
        >
          <span className="w-8 text-right text-gray-400 select-none flex-shrink-0">
            {line.lineNum || ''}
          </span>
          <span className="w-4 flex-shrink-0 select-none">
            {line.type === 'removed' ? '-' : line.type === 'added' ? '+' : ''}
          </span>
          <span className="flex-1 whitespace-pre-wrap">{line.content}</span>
        </div>
      ))}
    </div>
  );
}