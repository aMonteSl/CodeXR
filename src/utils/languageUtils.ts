import * as path from 'path';

/**
 * Gets the language name based on file extension
 * @param filePath Path to the file
 * @returns Language name or 'Unknown' if not supported
 */
export function getLanguageName(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  
  const languageMap: Record<string, string> = {
    '.js': 'JavaScript',
    '.jsx': 'JavaScript',
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript',
    '.py': 'Python',
    '.java': 'Java',
    '.c': 'C',
    '.h': 'C',
    '.cpp': 'C++',
    '.cc': 'C++',
    '.cxx': 'C++',
    '.hpp': 'C++',
    '.cs': 'C#',
    '.rb': 'Ruby',
    '.php': 'PHP',
    '.phtml': 'PHP',
    '.php3': 'PHP',
    '.php4': 'PHP',
    '.php5': 'PHP',
    '.phps': 'PHP',
    '.go': 'Go',
    '.rs': 'Rust',
    '.swift': 'Swift',
    '.kt': 'Kotlin',
    '.kts': 'Kotlin',
    '.html': 'HTML',
    '.htm': 'HTML',
    '.vue': 'Vue',
    '.scala': 'Scala',
    '.sc': 'Scala',
    '.lua': 'Lua',
    '.erl': 'Erlang',
    '.hrl': 'Erlang',
    '.zig': 'Zig',
    '.pl': 'Perl',
    '.pm': 'Perl',
    '.pod': 'Perl',
    '.t': 'Perl',
    '.sol': 'Solidity',
    '.ttcn3': 'TTCN-3',
    '.ttcn': 'TTCN-3',
    '.3mp': 'TTCN-3',
    '.m': 'Objective-C',
    '.mm': 'Objective-C++',
    '.f': 'Fortran',
    '.f77': 'Fortran',
    '.f90': 'Fortran',
    '.f95': 'Fortran',
    '.f03': 'Fortran',
    '.f08': 'Fortran',
    '.for': 'Fortran',
    '.ftn': 'Fortran',
    '.gd': 'GDScript'
  };
  
  return languageMap[ext] || 'Unknown';
}

/**
 * Gets the file extension without the dot
 * @param filePath Path to the file
 * @returns File extension without dot or empty string
 */
export function getFileExtension(filePath: string): string {
  const ext = path.extname(filePath);
  return ext.startsWith('.') ? ext.substring(1) : ext;
}

/**
 * Checks if a file extension is supported for analysis
 * @param filePath Path to the file
 * @returns Boolean indicating if the extension is supported
 */
export function isSupportedLanguage(filePath: string): boolean {
  const languageName = getLanguageName(filePath);
  return languageName !== 'Unknown';
}
