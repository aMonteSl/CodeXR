export interface WorkspaceEntryDescriptor {
    name: string;
    isDirectory: boolean;
}

const SKIPPED_EXACT_NAMES = new Set([
    'node_modules',
    '.git',
    '.vscode',
    'dist',
    'build',
    'out',
    'coverage',
    'target',
    'bin',
    'obj',
    '__pycache__',
    '.DS_Store',
    'Thumbs.db',
]);

export function shouldSkipWorkspaceEntry(name: string): boolean {
    if (!name) {
        return true;
    }

    if (name.startsWith('.')) {
        return true;
    }

    return SKIPPED_EXACT_NAMES.has(name);
}

export function sortWorkspaceEntries<T extends WorkspaceEntryDescriptor>(entries: readonly T[]): T[] {
    return [...entries].sort((left, right) => {
        if (left.isDirectory !== right.isDirectory) {
            return left.isDirectory ? -1 : 1;
        }

        return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
    });
}
