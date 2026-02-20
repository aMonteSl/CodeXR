/**
 * Change Accumulator
 * Collects changed / added / deleted file paths from filesystem events
 * and provides bulk retrieval + clear.
 */

export interface AccumulatedChanges {
    changed: string[];
    added: string[];
    deleted: string[];
}

export class ChangeAccumulator {
    private changedFiles: Set<string> = new Set();
    private addedFiles: Set<string> = new Set();
    private deletedFiles: Set<string> = new Set();

    addChanged(filePath: string): void {
        this.changedFiles.add(filePath);
    }

    addAdded(filePath: string): void {
        this.addedFiles.add(filePath);
    }

    addDeleted(filePath: string): void {
        this.deletedFiles.add(filePath);
        // If we previously recorded it as added or changed, remove it
        this.addedFiles.delete(filePath);
        this.changedFiles.delete(filePath);
    }

    /** Total number of pending changes. */
    totalCount(): number {
        return this.changedFiles.size + this.addedFiles.size + this.deletedFiles.size;
    }

    hasChanges(): boolean {
        return this.totalCount() > 0;
    }

    /** Return all pending changes and reset the accumulators. */
    consumeAll(): AccumulatedChanges {
        const result: AccumulatedChanges = {
            changed: [...this.changedFiles],
            added: [...this.addedFiles],
            deleted: [...this.deletedFiles],
        };
        this.changedFiles.clear();
        this.addedFiles.clear();
        this.deletedFiles.clear();
        return result;
    }

    /** Clear without returning. */
    clear(): void {
        this.changedFiles.clear();
        this.addedFiles.clear();
        this.deletedFiles.clear();
    }

    get changedCount(): number { return this.changedFiles.size; }
    get addedCount(): number { return this.addedFiles.size; }
    get deletedCount(): number { return this.deletedFiles.size; }
}
