// Smart code merging utilities for IDE
export interface MergeResult {
  merged: string;
  hasConflicts: boolean;
  conflicts: MergeConflict[];
  strategy: 'auto' | 'manual';
}

export interface MergeConflict {
  type: 'duplicate' | 'insertion' | 'modification';
  lineStart: number;
  lineEnd: number;
  current: string;
  incoming: string;
  resolved?: string;
}

export interface DiffLine {
  type: 'unchanged' | 'added' | 'removed' | 'conflict';
  lineNumber: number;
  content: string;
  conflictId?: number;
}

// Main merge function that intelligently combines existing and new code
export function smartMergeCode(
  existingContent: string,
  newContent: string,
  filePath: string
): MergeResult {
  const fileExtension = filePath.split('.').pop()?.toLowerCase();
  
  // Different merge strategies based on file type
  switch (fileExtension) {
    case 'py':
      return mergePythonCode(existingContent, newContent);
    case 'js':
    case 'ts':
      return mergeJavaScriptCode(existingContent, newContent);
    case 'java':
      return mergeJavaCode(existingContent, newContent);
    case 'cs':
      return mergeCSharpCode(existingContent, newContent);
    case 'json':
      return mergeJsonContent(existingContent, newContent);
    default:
      return mergeGenericCode(existingContent, newContent);
  }
}

// Python-specific merge logic
function mergePythonCode(existing: string, incoming: string): MergeResult {
  const existingLines = existing.split('\n');
  const incomingLines = incoming.split('\n');
  
  // Extract sections
  const existingImports = extractPythonImports(existingLines);
  const incomingImports = extractPythonImports(incomingLines);
  const existingClasses = extractPythonClasses(existingLines);
  const incomingClasses = extractPythonClasses(incomingLines);
  const existingFunctions = extractPythonFunctions(existingLines);
  const incomingFunctions = extractPythonFunctions(incomingLines);
  
  // Merge imports (avoid duplicates)
  const mergedImports = mergeImports(existingImports, incomingImports);
  
  // Merge classes and functions
  const conflicts: MergeConflict[] = [];
  const mergedClasses = mergeCodeBlocks(existingClasses, incomingClasses, 'class', conflicts);
  const mergedFunctions = mergeCodeBlocks(existingFunctions, incomingFunctions, 'function', conflicts);
  
  // Build merged content
  const merged = [
    ...mergedImports,
    '',
    ...mergedClasses,
    '',
    ...mergedFunctions
  ].join('\n');
  
  return {
    merged,
    hasConflicts: conflicts.length > 0,
    conflicts,
    strategy: conflicts.length === 0 ? 'auto' : 'manual'
  };
}

// JavaScript/TypeScript merge logic
function mergeJavaScriptCode(existing: string, incoming: string): MergeResult {
  const existingLines = existing.split('\n');
  const incomingLines = incoming.split('\n');
  
  // Extract imports/requires
  const existingImports = extractJSImports(existingLines);
  const incomingImports = extractJSImports(incomingLines);
  
  // Extract functions and classes
  const existingFunctions = extractJSFunctions(existingLines);
  const incomingFunctions = extractJSFunctions(incomingLines);
  
  const mergedImports = mergeImports(existingImports, incomingImports);
  const conflicts: MergeConflict[] = [];
  const mergedFunctions = mergeCodeBlocks(existingFunctions, incomingFunctions, 'function', conflicts);
  
  // Get non-function/import content
  const otherContent = existingLines.filter(line => 
    !isImportLine(line) && !isFunctionStart(line)
  );
  
  const merged = [
    ...mergedImports,
    '',
    ...otherContent,
    '',
    ...mergedFunctions
  ].join('\n');
  
  return {
    merged,
    hasConflicts: conflicts.length > 0,
    conflicts,
    strategy: conflicts.length === 0 ? 'auto' : 'manual'
  };
}

// Generic merge for other file types
function mergeGenericCode(existing: string, incoming: string): MergeResult {
  // For generic files, append new content with clear separation
  const merged = existing + '\n\n// --- AI Generated Content ---\n' + incoming;
  
  return {
    merged,
    hasConflicts: false,
    conflicts: [],
    strategy: 'auto'
  };
}

// JSON merge logic
function mergeJsonContent(existing: string, incoming: string): MergeResult {
  try {
    const existingObj = JSON.parse(existing);
    const incomingObj = JSON.parse(incoming);
    
    // Deep merge objects
    const merged = deepMergeObjects(existingObj, incomingObj);
    
    return {
      merged: JSON.stringify(merged, null, 2),
      hasConflicts: false,
      conflicts: [],
      strategy: 'auto'
    };
  } catch {
    // If JSON is invalid, fall back to generic merge
    return mergeGenericCode(existing, incoming);
  }
}

// Helper functions for Python
function extractPythonImports(lines: string[]): string[] {
  return lines.filter(line => 
    line.trim().startsWith('import ') || 
    line.trim().startsWith('from ')
  );
}

function extractPythonClasses(lines: string[]): string[] {
  const classes: string[] = [];
  let currentClass: string[] = [];
  let inClass = false;
  let indentLevel = 0;
  
  for (const line of lines) {
    if (line.trim().startsWith('class ')) {
      if (inClass && currentClass.length > 0) {
        classes.push(currentClass.join('\n'));
      }
      currentClass = [line];
      inClass = true;
      indentLevel = line.length - line.trimStart().length;
    } else if (inClass) {
      const lineIndent = line.length - line.trimStart().length;
      if (line.trim() && lineIndent <= indentLevel && !line.trim().startsWith('#')) {
        // End of class
        classes.push(currentClass.join('\n'));
        currentClass = [];
        inClass = false;
      } else {
        currentClass.push(line);
      }
    }
  }
  
  if (inClass && currentClass.length > 0) {
    classes.push(currentClass.join('\n'));
  }
  
  return classes;
}

function extractPythonFunctions(lines: string[]): string[] {
  const functions: string[] = [];
  let currentFunction: string[] = [];
  let inFunction = false;
  let indentLevel = 0;
  
  for (const line of lines) {
    if (line.trim().startsWith('def ') || line.trim().startsWith('async def ')) {
      if (inFunction && currentFunction.length > 0) {
        functions.push(currentFunction.join('\n'));
      }
      currentFunction = [line];
      inFunction = true;
      indentLevel = line.length - line.trimStart().length;
    } else if (inFunction) {
      const lineIndent = line.length - line.trimStart().length;
      if (line.trim() && lineIndent <= indentLevel && !line.trim().startsWith('#')) {
        // End of function
        functions.push(currentFunction.join('\n'));
        currentFunction = [];
        inFunction = false;
      } else {
        currentFunction.push(line);
      }
    }
  }
  
  if (inFunction && currentFunction.length > 0) {
    functions.push(currentFunction.join('\n'));
  }
  
  return functions;
}

// Helper functions for JavaScript/TypeScript
function extractJSImports(lines: string[]): string[] {
  return lines.filter(line => 
    line.trim().startsWith('import ') || 
    line.trim().startsWith('const ') && line.includes('require(') ||
    line.trim().startsWith('let ') && line.includes('require(') ||
    line.trim().startsWith('var ') && line.includes('require(')
  );
}

function extractJSFunctions(lines: string[]): string[] {
  const functions: string[] = [];
  let currentFunction: string[] = [];
  let inFunction = false;
  let braceCount = 0;
  
  for (const line of lines) {
    if (isFunctionStart(line)) {
      if (inFunction && currentFunction.length > 0) {
        functions.push(currentFunction.join('\n'));
      }
      currentFunction = [line];
      inFunction = true;
      braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
    } else if (inFunction) {
      currentFunction.push(line);
      braceCount += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
      
      if (braceCount === 0) {
        functions.push(currentFunction.join('\n'));
        currentFunction = [];
        inFunction = false;
      }
    }
  }
  
  if (inFunction && currentFunction.length > 0) {
    functions.push(currentFunction.join('\n'));
  }
  
  return functions;
}

// Generic helpers
function mergeImports(existing: string[], incoming: string[]): string[] {
  const uniqueImports = new Set([...existing]);
  incoming.forEach(imp => uniqueImports.add(imp));
  return Array.from(uniqueImports).sort();
}

function mergeCodeBlocks(
  existing: string[], 
  incoming: string[], 
  blockType: string,
  conflicts: MergeConflict[]
): string[] {
  const merged = [...existing];
  
  for (const incomingBlock of incoming) {
    const blockName = extractBlockName(incomingBlock, blockType);
    const existingIndex = existing.findIndex(block => 
      extractBlockName(block, blockType) === blockName
    );
    
    if (existingIndex === -1) {
      // New block, safe to add
      merged.push(incomingBlock);
    } else {
      // Conflict: block with same name exists
      conflicts.push({
        type: 'duplicate',
        lineStart: existingIndex + 1,
        lineEnd: existingIndex + existing[existingIndex].split('\n').length,
        current: existing[existingIndex],
        incoming: incomingBlock
      });
    }
  }
  
  return merged;
}

function extractBlockName(block: string, blockType: string): string {
  const firstLine = block.split('\n')[0];
  
  if (blockType === 'class') {
    const match = firstLine.match(/class\s+(\w+)/);
    return match ? match[1] : '';
  } else if (blockType === 'function') {
    const match = firstLine.match(/(?:def|function|async\s+def|async\s+function)\s+(\w+)/);
    return match ? match[1] : '';
  }
  
  return '';
}

function isImportLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('import ') || 
         trimmed.startsWith('from ') ||
         (trimmed.startsWith('const ') && trimmed.includes('require(')) ||
         (trimmed.startsWith('let ') && trimmed.includes('require(')) ||
         (trimmed.startsWith('var ') && trimmed.includes('require('));
}

function isFunctionStart(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('function ') ||
         trimmed.startsWith('async function ') ||
         trimmed.startsWith('def ') ||
         trimmed.startsWith('async def ') ||
         /^[a-zA-Z_]\w*\s*\([^)]*\)\s*{/.test(trimmed) || // Arrow functions
         /^[a-zA-Z_]\w*\s*[:=]\s*\([^)]*\)\s*=>/.test(trimmed);
}

function deepMergeObjects(target: any, source: any): any {
  const output = { ...target };
  
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    Object.keys(source).forEach(key => {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!(key in target)) {
          output[key] = source[key];
        } else {
          output[key] = deepMergeObjects(target[key], source[key]);
        }
      } else if (Array.isArray(source[key])) {
        // For arrays, merge unique items
        const existingArray = Array.isArray(target[key]) ? target[key] : [];
        const combined = existingArray.concat(source[key]);
        output[key] = combined.filter((item, index) => combined.indexOf(item) === index);
      } else {
        output[key] = source[key];
      }
    });
  }
  
  return output;
}

// Generate diff visualization
export function generateDiff(existing: string, merged: string): DiffLine[] {
  const existingLines = existing.split('\n');
  const mergedLines = merged.split('\n');
  const diff: DiffLine[] = [];
  
  let existingIndex = 0;
  let mergedIndex = 0;
  
  while (existingIndex < existingLines.length || mergedIndex < mergedLines.length) {
    const existingLine = existingLines[existingIndex];
    const mergedLine = mergedLines[mergedIndex];
    
    if (existingLine === mergedLine) {
      // Unchanged line
      diff.push({
        type: 'unchanged',
        lineNumber: existingIndex + 1,
        content: existingLine || ''
      });
      existingIndex++;
      mergedIndex++;
    } else if (mergedIndex >= mergedLines.length) {
      // Line was removed
      diff.push({
        type: 'removed',
        lineNumber: existingIndex + 1,
        content: existingLine || ''
      });
      existingIndex++;
    } else if (existingIndex >= existingLines.length) {
      // Line was added
      diff.push({
        type: 'added',
        lineNumber: mergedIndex + 1,
        content: mergedLine || ''
      });
      mergedIndex++;
    } else {
      // Line was modified
      diff.push({
        type: 'removed',
        lineNumber: existingIndex + 1,
        content: existingLine || ''
      });
      diff.push({
        type: 'added',
        lineNumber: mergedIndex + 1,
        content: mergedLine || ''
      });
      existingIndex++;
      mergedIndex++;
    }
  }
  
  return diff;
}

// Java-specific merge logic
function mergeJavaCode(existing: string, incoming: string): MergeResult {
  const existingLines = existing.split('\n');
  const incomingLines = incoming.split('\n');
  
  // Extract sections
  const existingImports = extractJavaImports(existingLines);
  const incomingImports = extractJavaImports(incomingLines);
  const existingMethods = extractJavaMethods(existingLines);
  const incomingMethods = extractJavaMethods(incomingLines);
  
  // Merge imports
  const mergedImports = mergeImports(existingImports, incomingImports);
  
  // Merge methods
  const conflicts: MergeConflict[] = [];
  const mergedMethods = mergeCodeBlocks(existingMethods, incomingMethods, 'method', conflicts);
  
  // Build merged content (simplified)
  const merged = [
    ...mergedImports,
    '',
    ...mergedMethods
  ].join('\n');
  
  return {
    merged,
    hasConflicts: conflicts.length > 0,
    conflicts,
    strategy: conflicts.length === 0 ? 'auto' : 'manual'
  };
}

// C#-specific merge logic
function mergeCSharpCode(existing: string, incoming: string): MergeResult {
  // Similar to Java but with C# syntax
  const existingLines = existing.split('\n');
  const incomingLines = incoming.split('\n');
  
  // Extract usings and methods
  const existingUsings = existingLines.filter(line => line.trim().startsWith('using '));
  const incomingUsings = incomingLines.filter(line => line.trim().startsWith('using '));
  
  // Merge usings (avoid duplicates)
  const allUsings = [...existingUsings];
  incomingUsings.forEach(u => {
    if (!existingUsings.some(eu => eu.trim() === u.trim())) {
      allUsings.push(u);
    }
  });
  
  // For simplicity, append new methods if no conflicts
  const conflicts: MergeConflict[] = [];
  const merged = existing + '\n\n' + incoming.split('\n').filter(line => 
    !line.trim().startsWith('using ') && line.trim() !== ''
  ).join('\n');
  
  return {
    merged,
    hasConflicts: false,
    conflicts,
    strategy: 'auto'
  };
}

// Helper functions for Java
function extractJavaImports(lines: string[]): string[] {
  return lines.filter(line => line.trim().startsWith('import '));
}

function extractJavaMethods(lines: string[]): string[] {
  const methods: string[] = [];
  let currentMethod: string[] = [];
  let inMethod = false;
  let braceCount = 0;
  
  for (const line of lines) {
    if (line.trim().includes('public ') || line.trim().includes('private ') || line.trim().includes('protected ')) {
      if (line.includes('(') && line.includes(')')) {
        inMethod = true;
        currentMethod = [line];
        braceCount = (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
      }
    } else if (inMethod) {
      currentMethod.push(line);
      braceCount += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
      
      if (braceCount === 0) {
        methods.push(currentMethod.join('\n'));
        currentMethod = [];
        inMethod = false;
      }
    }
  }
  
  return methods;
}