/**
 * File Hash Tracker
 * Maintains the live directory snapshot used by incremental re-analysis.
 */

import { FileHash } from '../utils/fileHashCalculator';
import { SHA256Generator } from '../../../utils/sha256Generator';
import { buildTrackedFileSnapshot, FileStatSnapshot } from './directorySnapshot';
import { isDirectoryAnalysisFile, shouldIgnoreFileName } from './analysisFilePolicy';

export interface SnapshotDiff {
    added: string[];
    removed: string[];
    suspectedChanged: string[];
}

export class FileHashTracker {
    private trackedFiles: Map<string, FileHash> = new Map();

    constructor(filesToHash?: FileHash[]) {
        if (!filesToHash) {
            return;
        }

        for (const entry of filesToHash) {
            this.trackedFiles.set(entry.filePath, { ...entry });
        }
    }

    getTrackedFiles(): FileHash[] {
        return Array.from(this.trackedFiles.values()).sort((left, right) => left.filePath.localeCompare(right.filePath));
    }

    getTrackedPaths(): Set<string> {
        return new Set(this.trackedFiles.keys());
    }

    hasTrackedFile(filePath: string): boolean {
        return this.trackedFiles.has(filePath);
    }

    isAnalyzableExtension(filePath: string): boolean {
        return isDirectoryAnalysisFile(filePath);
    }

    shouldSkipEvent(filename: string): boolean {
        return shouldIgnoreFileName(filename);
    }

    diffAgainst(currentFiles: FileStatSnapshot[]): SnapshotDiff {
        const currentByPath = new Map(currentFiles.map((entry) => [entry.filePath, entry]));
        const added: string[] = [];
        const suspectedChanged: string[] = [];

        for (const [filePath, currentEntry] of currentByPath) {
            const previousEntry = this.trackedFiles.get(filePath);
            if (!previousEntry) {
                added.push(filePath);
                continue;
            }

            if (previousEntry.size !== currentEntry.size || previousEntry.mtimeMs !== currentEntry.mtimeMs) {
                suspectedChanged.push(filePath);
            }
        }

        const removed = Array.from(this.trackedFiles.keys()).filter((filePath) => !currentByPath.has(filePath));

        return { added, removed, suspectedChanged };
    }

    async resolveActuallyChanged(
        candidatePaths: string[],
        currentFilesByPath: Map<string, FileStatSnapshot>,
    ): Promise<string[]> {
        const changed: string[] = [];

        for (const filePath of candidatePaths) {
            const previousEntry = this.trackedFiles.get(filePath);
            const currentEntry = currentFilesByPath.get(filePath);
            if (!currentEntry) {
                continue;
            }

            try {
                const currentHash = await SHA256Generator.generateFileHash(filePath);
                if (!previousEntry || previousEntry.hash !== currentHash) {
                    changed.push(filePath);
                }

                this.trackedFiles.set(filePath, {
                    filePath,
                    hash: currentHash,
                    size: currentEntry.size,
                    mtimeMs: currentEntry.mtimeMs,
                });
            } catch {
                changed.push(filePath);
            }
        }

        return changed;
    }

    async trackNewFile(filePath: string, hash: string): Promise<void> {
        const snapshot = await buildTrackedFileSnapshot(filePath, hash);
        if (snapshot) {
            this.trackedFiles.set(filePath, snapshot);
            return;
        }

        this.trackedFiles.set(filePath, { filePath, hash });
    }

    async updateTrackedHash(filePath: string, hash: string): Promise<void> {
        await this.trackNewFile(filePath, hash);
    }

    syncUnchangedFile(filePath: string, currentEntry: FileStatSnapshot): void {
        const previousEntry = this.trackedFiles.get(filePath);
        if (!previousEntry) {
            return;
        }

        this.trackedFiles.set(filePath, {
            ...previousEntry,
            size: currentEntry.size,
            mtimeMs: currentEntry.mtimeMs,
        });
    }

    untrackFile(filePath: string): void {
        this.trackedFiles.delete(filePath);
    }

    replaceAll(snapshot: FileHash[]): void {
        this.trackedFiles.clear();
        for (const entry of snapshot) {
            this.trackedFiles.set(entry.filePath, { ...entry });
        }
    }
}
