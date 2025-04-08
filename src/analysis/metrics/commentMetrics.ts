import * as ts from 'typescript';

/**
 * Comment metrics for a source file
 */
export interface CommentMetrics {
  /** Number of lines occupied by comments */
  commentLines: number;
}

/**
 * Gets all comments from a source file
 */
export function getAllComments(sourceFile: ts.SourceFile, fileContent: string): ts.CommentRange[] {
  const comments: ts.CommentRange[] = [];
  
  // Get leading and trailing comments throughout the file
  let pos = 0;
  while (pos < fileContent.length) {
    const leadingComments = ts.getLeadingCommentRanges(fileContent, pos);
    if (leadingComments) {
      comments.push(...leadingComments);
    }
    
    const trailingComments = ts.getTrailingCommentRanges(fileContent, pos);
    if (trailingComments) {
      comments.push(...trailingComments);
    }
    
    pos++;
  }
  
  return comments;
}

/**
 * Calculates the number of lines occupied by comments
 */
export function calculateCommentLines(comments: ts.CommentRange[], fileContent: string): number {
  let commentLines = 0;
  
  // Create a set to track which lines are comments to avoid counting twice
  const commentedLines = new Set<number>();
  
  for (const comment of comments) {
    const commentText = fileContent.substring(comment.pos, comment.end);
    
    // Find line number for start position
    let startLine = 0;
    let pos = 0;
    while (pos < comment.pos && pos < fileContent.length) {
      if (fileContent[pos] === '\n') {
        startLine++;
      }
      pos++;
    }
    
    if (comment.kind === ts.SyntaxKind.SingleLineCommentTrivia) {
      // For single-line comments, add the line if not already counted
      if (!commentedLines.has(startLine)) {
        commentedLines.add(startLine);
        commentLines++;
      }
    } else if (comment.kind === ts.SyntaxKind.MultiLineCommentTrivia) {
      // For multi-line comments, count each line if not already counted
      const lineBreaks = commentText.match(/\n/g) || [];
      
      for (let i = 0; i <= lineBreaks.length; i++) {
        if (!commentedLines.has(startLine + i)) {
          commentedLines.add(startLine + i);
          commentLines++;
        }
      }
    }
  }
  
  return commentLines;
}