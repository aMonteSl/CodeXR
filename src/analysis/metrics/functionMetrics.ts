import * as ts from 'typescript';

/**
 * Function metrics for a source file
 */
export interface FunctionMetrics {
  /** Number of function declarations */
  functionCount: number;
  /** Number of class declarations */
  classCount: number;
}

/**
 * Counts functions and classes in a TypeScript source file
 */
export function countFunctionsAndClasses(sourceFile: ts.SourceFile): FunctionMetrics {
  let functionCount = 0;
  let classCount = 0;
  
  // Visit nodes recursively to count functions and classes
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) || 
        ts.isMethodDeclaration(node) || 
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node)) {
      functionCount++;
    } else if (ts.isClassDeclaration(node)) {
      classCount++;
    }
    
    ts.forEachChild(node, visit);
  }
  
  visit(sourceFile);
  
  return {
    functionCount,
    classCount
  };
}