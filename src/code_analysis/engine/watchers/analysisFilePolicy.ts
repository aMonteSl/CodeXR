import * as path from 'path';
import { isSupportedExtension } from '../../../utils/supportedLanguages';

const DIRECTORY_IGNORES = new Set([
    '.git',
    '.svn',
    '.hg',
    '.bzr',
    'node_modules',
    'dist',
    'build',
    'out',
    'target',
    'bin',
    'obj',
    '.vscode',
    '.idea',
    '__pycache__',
    '.pytest_cache',
    '.mypy_cache',
    'coverage',
    '.nyc_output',
    'venv',
    '.venv',
    'env',
    '.env',
    'tmp',
    '.tmp',
    'temp',
    'logs',
]);

const FILE_SKIP_PATTERNS: RegExp[] = [
    /^\..*$/,
    /.*~$/,
    /.*\.tmp$/,
    /.*\.log$/,
    /.*\.swp$/,
    /.*\.swo$/,
    /.*\.bak$/,
    /.*\.orig$/,
    /^#.*#$/,
    /.*\.lock$/,
    /.*\.pid$/,
    /.*\.cache$/,
    /.*\.DS_Store$/,
    /^Thumbs\.db$/,
    /.*\.pyc$/,
    /.*\.pyo$/,
    /.*\.class$/,
    /.*\.o$/,
    /.*\.obj$/,
    /.*\.exe$/,
    /.*\.dll$/,
    /.*\.so$/,
    /.*\.a$/,
    /.*\.lib$/,
];

const DIRECTORY_ANALYSIS_EXTENSIONS = new Set([
    '.py', '.pyw', '.pyi', '.rb', '.rbw', '.java', '.c', '.h', '.cpp', '.cxx', '.cc', '.hpp', '.hxx',
    '.cs', '.erl', '.hrl', '.f90', '.f95', '.f03', '.f08', '.f', '.gd', '.go', '.js', '.mjs', '.cjs',
    '.kt', '.kts', '.lua', '.m', '.mm', '.php', '.phtml', '.php3', '.php4', '.php5', '.pl', '.pm',
    '.scala', '.sc', '.sol', '.swift', '.ts', '.tsx', '.ttcn', '.ttcn3', '.vue', '.zig', '.rs',
    '.dart', '.r', '.sh', '.bash', '.ps1', '.jsx', '.css', '.scss', '.less', '.clj', '.cljs',
    '.hs', '.ml', '.mli', '.pas',
]);

const HTML_EXTENSIONS = new Set(['.html', '.htm', '.xhtml']);

export function shouldIgnoreDirectoryName(name: string): boolean {
    return DIRECTORY_IGNORES.has(name) || FILE_SKIP_PATTERNS.some((pattern) => pattern.test(name));
}

export function shouldIgnoreFileName(name: string): boolean {
    return FILE_SKIP_PATTERNS.some((pattern) => pattern.test(name));
}

export function isHtmlLikeFile(filePath: string): boolean {
    return HTML_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

export function isDirectoryAnalysisFile(filePath: string): boolean {
    if (shouldIgnoreFileName(path.basename(filePath))) {
        return false;
    }

    return DIRECTORY_ANALYSIS_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

export function isCodeAnalysisFile(filePath: string): boolean {
    if (shouldIgnoreFileName(path.basename(filePath))) {
        return false;
    }

    return isSupportedExtension(path.extname(filePath).toLowerCase());
}

export function isRelevantDirectoryEvent(fullPath: string, trackedPaths: Set<string>): boolean {
    const name = path.basename(fullPath);
    if (shouldIgnoreFileName(name) || shouldIgnoreDirectoryName(name)) {
        return false;
    }

    if (trackedPaths.has(fullPath)) {
        return true;
    }

    return isDirectoryAnalysisFile(fullPath);
}
