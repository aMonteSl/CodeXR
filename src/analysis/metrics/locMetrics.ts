/**
 * Line metrics for a source file
 */
export interface LineMetrics {
  /** Total number of lines */
  total: number;
  /** Number of blank lines */
  blank: number;
}

/**
 * Counts blank lines and total lines in source code
 */
export function countLines(sourceText: string): LineMetrics {
  // Split the text into lines
  const lines = sourceText.split(/\r?\n/);
  
  // Total lines is straightforward
  const total = lines.length;
  
  // Count blank lines - lines with only whitespace
  const blank = lines.filter(line => line.trim().length === 0).length;
  
  return {
    total,
    blank
  };
}