import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { ComparisonSource } from '../historical/historicalComparisonModels';
import {
    GitExportAnalysisJob,
    GitExportPythonWorkerPool,
    WorkerPoolCancelSignal,
} from './gitExportPythonWorkerPool';
import {
    GitTimelineBlobIndex,
    IndexedGitFile,
    IndexedGitRevision,
} from './gitTimelineBlobIndex';

export interface GitBlobAnalysisProgressSink {
    report(value: { message?: string; increment?: number }): void;
}

export interface PreparedGitRevisionPayload {
    entries: Record<string, unknown>[];
    analyzedTargetPath: string;
    warnings: string[];
}

export interface GitBlobPipelineStatistics {
    revisionCount: number;
    fileOccurrences: number;
    uniqueAnalysisCount: number;
    maxActiveWorkers: number;
}

export interface PreparedGitRevisionStore {
    get(source: ComparisonSource): Promise<PreparedGitRevisionPayload>;
    readonly statistics: GitBlobPipelineStatistics;
    dispose(): Promise<void>;
}

export interface GitTimelineBlobAnalyzerOptions {
    repositoryRoot: string;
    targetRelativePath: string;
    originalTargetPath: string;
    targetType: 'file' | 'directory';
    recursive: boolean;
    pythonExecutable: string;
    workerScriptPath: string;
    workerCount: number;
    temporaryRoot: string;
    token?: WorkerPoolCancelSignal;
    progress?: GitBlobAnalysisProgressSink;
}

interface UniqueBlobJob {
    key: string;
    file: IndexedGitFile;
    inputPath: string;
    outputPath: string;
}

function safeCacheName(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
}

function commitTimestamps(source: ComparisonSource): {
    timestamp?: string;
    modifiedAtMs?: number;
    modifiedAtIso?: string;
} {
    if (source.kind !== 'gitRef') {
        return {};
    }
    let date: Date | undefined;
    if (Number.isFinite(source.timestamp)) {
        date = new Date(Number(source.timestamp) * 1000);
    } else if (source.date) {
        date = new Date(`${source.date}T00:00:00.000Z`);
    }
    if (!date || !Number.isFinite(date.getTime())) {
        return {};
    }
    const iso = date.toISOString();
    return {
        timestamp: iso.slice(0, 19).replace('T', ' '),
        modifiedAtMs: date.getTime(),
        modifiedAtIso: iso,
    };
}

function safeTreeSegment(value: unknown): string {
    const normalized = String(value ?? '').trim() || 'unknown';
    return normalized.replace(/[\\/]/g, '_');
}

class FileBackedPreparedRevisionStore implements PreparedGitRevisionStore {
    private readonly resultCache = new Map<string, Promise<unknown>>();
    private static readonly RESULT_CACHE_LIMIT = 4096;

    public constructor(
        private readonly revisions: Map<string, IndexedGitRevision>,
        private readonly outputByJobKey: Map<string, string>,
        private readonly failedJobs: Map<string, string>,
        private readonly originalTargetPath: string,
        private readonly targetType: 'file' | 'directory',
        private readonly temporaryRoot: string,
        public readonly statistics: GitBlobPipelineStatistics,
    ) {}

    public async get(source: ComparisonSource): Promise<PreparedGitRevisionPayload> {
        if (source.kind !== 'gitRef') {
            throw new Error('working-copy-is-not-a-prepared-git-revision');
        }
        const revision = this.revisions.get(source.commitSha);
        if (!revision) {
            throw new Error(`git-revision-not-indexed: ${source.commitSha}`);
        }
        if (revision.failureReason) {
            throw new Error(revision.failureReason);
        }
        if (revision.missingTarget) {
            throw new Error('The analyzed target does not exist in this revision.');
        }

        const timestamps = commitTimestamps(source);
        if (this.targetType === 'file') {
            const file = revision.files[0];
            if (!file) {
                return {
                    entries: [],
                    analyzedTargetPath: this.originalTargetPath,
                    warnings: revision.warnings,
                };
            }
            const key = this.jobKey(file);
            this.throwJobFailure(key, file.relativePath);
            const raw = await this.readResult(key);
            const targetFileName = path.basename(this.originalTargetPath);
            const entries = (Array.isArray(raw) ? raw : []).map((entry) => {
                const record = entry as Record<string, unknown>;
                const functionName = record.functionName || 'unknown';
                return {
                    ...record,
                    ...timestamps,
                    fileName: targetFileName,
                    filePath: targetFileName,
                    treePath: `${safeTreeSegment(targetFileName)}/${safeTreeSegment(functionName)}`,
                };
            });
            return {
                entries,
                analyzedTargetPath: this.originalTargetPath,
                warnings: revision.warnings,
            };
        }

        const entries: Record<string, unknown>[] = [];
        for (const file of revision.files) {
            const key = this.jobKey(file);
            this.throwJobFailure(key, file.relativePath);
            const raw = await this.readResult(key);
            const record = raw && !Array.isArray(raw)
                ? raw as Record<string, unknown>
                : {};
            entries.push({
                ...record,
                ...timestamps,
                fileName: path.posix.basename(file.relativePath),
                filePath: file.relativePath,
                relativePath: file.relativePath,
                fileSizeBytes: file.size,
            });
        }
        return {
            entries,
            analyzedTargetPath: this.originalTargetPath,
            warnings: revision.warnings,
        };
    }

    public async dispose(): Promise<void> {
        this.resultCache.clear();
        await fs.promises.rm(this.temporaryRoot, { recursive: true, force: true });
    }

    private jobKey(file: IndexedGitFile): string {
        return `${this.targetType}:${file.blobSha}:${file.extension}`;
    }

    private throwJobFailure(key: string, relativePath: string): void {
        const reason = this.failedJobs.get(key);
        if (reason) {
            throw new Error(`Analysis failed for ${relativePath}: ${reason}`);
        }
    }

    private async readResult(key: string): Promise<unknown> {
        const cached = this.resultCache.get(key);
        if (cached) {
            this.resultCache.delete(key);
            this.resultCache.set(key, cached);
            return cached;
        }
        const resultPath = this.outputByJobKey.get(key);
        if (!resultPath) {
            throw new Error(`git-blob-result-missing: ${key}`);
        }
        const pending = fs.promises.readFile(resultPath, 'utf8').then(
            (raw) => JSON.parse(raw) as unknown,
        );
        this.resultCache.set(key, pending);
        while (this.resultCache.size > FileBackedPreparedRevisionStore.RESULT_CACHE_LIMIT) {
            const oldestKey = this.resultCache.keys().next().value as string | undefined;
            if (!oldestKey) {
                break;
            }
            this.resultCache.delete(oldestKey);
        }
        return pending;
    }
}

/**
 * Coordinates the content-addressed export pipeline: index revisions, analyze
 * each distinct blob/extension once, then expose a file-backed revision store
 * that the export core consumes in chronological order.
 */
export class GitTimelineBlobAnalyzer {
    public constructor(private readonly options: GitTimelineBlobAnalyzerOptions) {}

    public async prepare(sources: ComparisonSource[]): Promise<PreparedGitRevisionStore> {
        const { options } = this;
        const blobsDir = path.join(options.temporaryRoot, 'blobs');
        const resultsDir = path.join(options.temporaryRoot, 'results');
        await fs.promises.mkdir(blobsDir, { recursive: true });
        await fs.promises.mkdir(resultsDir, { recursive: true });

        const index = new GitTimelineBlobIndex(
            options.repositoryRoot,
            options.targetRelativePath,
            options.targetType,
            options.recursive,
            options.token,
        );
        let pool: GitExportPythonWorkerPool | undefined;
        try {
            const revisions = await index.build(sources, (completed, total) => {
                options.progress?.report({
                    increment: 10 / Math.max(total, 1),
                    message: `Indexing Git history: ${completed}/${total} revisions`,
                });
            });
            this.throwIfCancelled();

            const jobsByKey = new Map<string, UniqueBlobJob>();
            let fileOccurrences = 0;
            for (const revision of revisions) {
                if (revision.failureReason || revision.missingTarget) {
                    continue;
                }
                for (const file of revision.files) {
                    fileOccurrences += 1;
                    const key = `${options.targetType}:${file.blobSha}:${file.extension}`;
                    if (jobsByKey.has(key)) {
                        continue;
                    }
                    const cacheName = safeCacheName(key);
                    jobsByKey.set(key, {
                        key,
                        file,
                        inputPath: path.join(blobsDir, `${cacheName}${file.extension}`),
                        outputPath: path.join(resultsDir, `${cacheName}.json`),
                    });
                }
            }

            const uniqueJobs = Array.from(jobsByKey.values()).sort(
                (left, right) => left.key.localeCompare(right.key),
            );
            const analysisJobs: GitExportAnalysisJob[] = uniqueJobs.map((job) => ({
                id: safeCacheName(job.key).slice(0, 24),
                inputPath: job.inputPath,
                outputPath: job.outputPath,
                targetType: options.targetType,
                prepareInput: async () => {
                    this.throwIfCancelled();
                    if (fs.existsSync(job.inputPath)) {
                        return;
                    }
                    const content = await index.readBlob(job.file.blobSha);
                    await fs.promises.writeFile(job.inputPath, content);
                },
                cleanupInput: async () => {
                    await fs.promises.rm(job.inputPath, { force: true });
                },
            }));
            const jobKeyById = new Map(
                uniqueJobs.map((job) => [safeCacheName(job.key).slice(0, 24), job.key]),
            );

            pool = new GitExportPythonWorkerPool(
                options.pythonExecutable,
                options.workerScriptPath,
                options.workerCount,
                options.token,
            );
            const poolResult = await pool.run(analysisJobs, (progress) => {
                const rate = progress.filesPerSecond.toFixed(1);
                const eta = Number.isFinite(progress.etaSeconds)
                    ? `${Math.ceil(progress.etaSeconds)}s`
                    : 'calculating';
                options.progress?.report({
                    increment: 80 / Math.max(progress.total, 1),
                    message: `Analyzing unique files: ${progress.completed}/${progress.total}`
                        + ` · ${progress.workerCount} workers · ${rate} files/s · ETA ${eta}`,
                });
            });
            if (analysisJobs.length === 0) {
                options.progress?.report({
                    increment: 80,
                    message: 'No analyzable Git blobs were found in the selected revisions.',
                });
            }
            await pool.dispose();
            pool = undefined;
            await index.dispose();

            const revisionBySha = new Map<string, IndexedGitRevision>();
            for (const revision of revisions) {
                if (revision.source.kind === 'gitRef') {
                    revisionBySha.set(revision.source.commitSha, revision);
                }
            }
            const outputByJobKey = new Map(
                uniqueJobs.map((job) => [job.key, job.outputPath]),
            );
            return new FileBackedPreparedRevisionStore(
                revisionBySha,
                outputByJobKey,
                new Map(
                    Array.from(poolResult.failures.entries()).map(([jobId, reason]) => [
                        jobKeyById.get(jobId) || jobId,
                        reason,
                    ]),
                ),
                options.originalTargetPath,
                options.targetType,
                options.temporaryRoot,
                {
                    revisionCount: revisions.length,
                    fileOccurrences,
                    uniqueAnalysisCount: uniqueJobs.length,
                    maxActiveWorkers: poolResult.maxActiveWorkers,
                },
            );
        } catch (error) {
            await pool?.dispose(true).catch(() => undefined);
            await index.dispose(true).catch(() => undefined);
            await fs.promises.rm(options.temporaryRoot, { recursive: true, force: true });
            throw error;
        }
    }

    private throwIfCancelled(): void {
        if (this.options.token?.isCancellationRequested) {
            throw new Error('git-export-cancelled');
        }
    }
}
