import * as fs from 'fs';
import * as path from 'path';
import { FileHash } from '../utils/fileHashCalculator';
import { shouldIgnoreDirectoryName, isDirectoryAnalysisFile } from './analysisFilePolicy';

export interface FileStatSnapshot {
    filePath: string;
    size: number;
    mtimeMs: number;
}

export interface DirectoryScopeSnapshot {
    files: FileStatSnapshot[];
    watchedDirectories: string[];
}

export async function getFileStatSnapshot(filePath: string): Promise<FileStatSnapshot | null> {
    try {
        const stats = await fs.promises.stat(filePath);
        if (!stats.isFile()) {
            return null;
        }

        return {
            filePath,
            size: stats.size,
            mtimeMs: stats.mtimeMs,
        };
    } catch {
        return null;
    }
}

export async function buildTrackedFileSnapshot(filePath: string, hash: string): Promise<FileHash | null> {
    const statSnapshot = await getFileStatSnapshot(filePath);
    if (!statSnapshot) {
        return null;
    }

    return {
        filePath,
        hash,
        size: statSnapshot.size,
        mtimeMs: statSnapshot.mtimeMs,
    };
}

export async function scanDirectoryScope(rootPath: string, isDeep: boolean): Promise<DirectoryScopeSnapshot> {
    const files: FileStatSnapshot[] = [];
    const watchedDirectories: string[] = [];

    async function visitDirectory(directoryPath: string, allowRecursion: boolean): Promise<void> {
        watchedDirectories.push(directoryPath);

        let entries: fs.Dirent[];
        try {
            entries = await fs.promises.readdir(directoryPath, { withFileTypes: true });
        } catch {
            return;
        }

        for (const entry of entries) {
            const fullPath = path.join(directoryPath, entry.name);

            if (entry.isDirectory()) {
                if (!allowRecursion || shouldIgnoreDirectoryName(entry.name)) {
                    continue;
                }

                await visitDirectory(fullPath, true);
                continue;
            }

            if (!entry.isFile() || !isDirectoryAnalysisFile(fullPath)) {
                continue;
            }

            const statSnapshot = await getFileStatSnapshot(fullPath);
            if (statSnapshot) {
                files.push(statSnapshot);
            }
        }
    }

    await visitDirectory(rootPath, isDeep);

    return {
        files,
        watchedDirectories,
    };
}
