import * as path from 'path';
import {
    isDirectoryAnalysisFile,
    isMetricAnalysisFile,
    shouldIgnoreDirectoryName,
} from '../engine/watchers/analysisFilePolicy';
import { ComparisonSource } from '../historical/historicalComparisonModels';
import {
    GitBatchObject,
    GitBatchObjectReader,
    GitBatchMetadataReader,
} from './gitBatchObjectReader';

const MAX_SNAPSHOT_FILES = 5000;
const MAX_SNAPSHOT_BYTES = 100 * 1024 * 1024;
const MAX_SINGLE_FILE_BYTES = 8 * 1024 * 1024;
const INDEX_CONCURRENCY = 16;

export interface GitIndexCancelSignal {
    readonly isCancellationRequested: boolean;
}

export interface IndexedGitFile {
    relativePath: string;
    blobSha: string;
    extension: string;
    size: number;
}

export interface IndexedGitRevision {
    source: ComparisonSource;
    files: IndexedGitFile[];
    missingTarget: boolean;
    warnings: string[];
    failureReason?: string;
}

interface RawIndexedFile {
    relativePath: string;
    blobSha: string;
    extension: string;
    metricAnalyzable: boolean;
}

interface TreeEntry {
    mode: string;
    name: string;
    objectName: string;
    kind: 'tree' | 'blob' | 'commit';
}

function parseTreeObject(object: GitBatchObject): TreeEntry[] {
    if (object.objectType !== 'tree') {
        throw new Error(`git-object-is-not-tree: ${object.objectName}`);
    }
    const result: TreeEntry[] = [];
    const hashBytes = object.objectName.length / 2;
    if (!Number.isInteger(hashBytes) || hashBytes < 20) {
        throw new Error(`git-object-id-invalid: ${object.objectName}`);
    }
    let offset = 0;
    while (offset < object.content.length) {
        const space = object.content.indexOf(0x20, offset);
        const nul = space >= 0 ? object.content.indexOf(0x00, space + 1) : -1;
        if (space < 0 || nul < 0 || nul + 1 + hashBytes > object.content.length) {
            throw new Error(`git-tree-object-invalid: ${object.objectName}`);
        }
        const mode = object.content.subarray(offset, space).toString('ascii');
        const name = object.content.subarray(space + 1, nul).toString('utf8');
        const objectName = object.content.subarray(nul + 1, nul + 1 + hashBytes).toString('hex');
        const kind: TreeEntry['kind'] = mode === '40000' || mode === '040000'
            ? 'tree'
            : mode === '160000'
                ? 'commit'
                : 'blob';
        result.push({ mode, name, objectName, kind });
        offset = nul + 1 + hashBytes;
    }
    return result;
}

function portableJoin(prefix: string, name: string): string {
    return prefix ? `${prefix}/${name}` : name;
}

/**
 * Export-only Git index. It reads commit trees through persistent cat-file
 * transports and records references to blobs instead of materializing a full
 * working tree for every revision.
 */
export class GitTimelineBlobIndex {
    private readonly objects: GitBatchObjectReader;
    private readonly metadata: GitBatchMetadataReader;
    private readonly treeCache = new Map<string, Promise<TreeEntry[]>>();
    private readonly metadataCache = new Map<string, Promise<{ size: number; objectType: string }>>();
    private disposed = false;

    public constructor(
        private readonly repositoryRoot: string,
        private readonly targetRelativePath: string,
        private readonly targetType: string,
        private readonly recursive: boolean,
        private readonly token?: GitIndexCancelSignal,
    ) {
        this.objects = new GitBatchObjectReader(repositoryRoot);
        this.metadata = new GitBatchMetadataReader(repositoryRoot);
    }

    public async build(
        sources: ComparisonSource[],
        onProgress?: (completed: number, total: number) => void,
    ): Promise<IndexedGitRevision[]> {
        const indexed = new Array<IndexedGitRevision>(sources.length);
        let next = 0;
        let completed = 0;
        const workers = Array.from(
            { length: Math.min(INDEX_CONCURRENCY, Math.max(1, sources.length)) },
            async () => {
                while (true) {
                    this.throwIfCancelled();
                    const index = next;
                    next += 1;
                    if (index >= sources.length) {
                        return;
                    }
                    const source = sources[index];
                    try {
                        const rawFiles = await this.indexSource(source);
                        indexed[index] = await this.applyLimits(source, rawFiles);
                    } catch (error) {
                        const reason = error instanceof Error ? error.message : String(error);
                        indexed[index] = {
                            source,
                            files: [],
                            missingTarget: reason === 'git-target-missing',
                            warnings: [],
                            ...(reason === 'git-target-missing' ? {} : { failureReason: reason }),
                        };
                    }
                    completed += 1;
                    onProgress?.(completed, sources.length);
                }
            },
        );
        await Promise.all(workers);
        this.throwIfCancelled();
        return indexed;
    }

    public async readBlob(blobSha: string): Promise<Buffer> {
        this.throwIfCancelled();
        const object = await this.objects.readObject(blobSha);
        if (object.objectType !== 'blob') {
            throw new Error(`git-object-is-not-blob: ${blobSha}`);
        }
        return object.content;
    }

    public async dispose(force = false): Promise<void> {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        await Promise.all([
            this.objects.dispose(force),
            this.metadata.dispose(force),
        ]);
    }

    private async indexSource(source: ComparisonSource): Promise<RawIndexedFile[]> {
        if (source.kind !== 'gitRef') {
            return [];
        }
        const rootObject = await this.objects.readObject(`${source.commitSha}^{tree}`);
        if (rootObject.objectType !== 'tree') {
            throw new Error(`git-commit-tree-unavailable: ${source.commitSha}`);
        }
        this.treeCache.set(rootObject.objectName, Promise.resolve(parseTreeObject(rootObject)));

        const components = this.targetRelativePath === '.'
            ? []
            : this.targetRelativePath.split('/').filter(Boolean);
        let currentTreeSha = rootObject.objectName;

        if (this.targetType === 'file') {
            if (components.length === 0) {
                return [];
            }
            for (let index = 0; index < components.length - 1; index += 1) {
                const entries = await this.readTree(currentTreeSha);
                const entry = entries.find((candidate) => candidate.name === components[index]);
                if (!entry || entry.kind !== 'tree') {
                    throw new Error('git-target-missing');
                }
                currentTreeSha = entry.objectName;
            }
            const entries = await this.readTree(currentTreeSha);
            const fileName = components[components.length - 1];
            const entry = entries.find((candidate) => candidate.name === fileName);
            if (!entry || entry.kind !== 'blob') {
                throw new Error('git-target-missing');
            }
            return [{
                relativePath: fileName,
                blobSha: entry.objectName,
                extension: path.extname(fileName).toLowerCase(),
                metricAnalyzable: true,
            }];
        }

        for (const component of components) {
            const entries = await this.readTree(currentTreeSha);
            const entry = entries.find((candidate) => candidate.name === component);
            if (!entry || entry.kind !== 'tree') {
                throw new Error('git-target-missing');
            }
            currentTreeSha = entry.objectName;
        }
        return this.flattenDirectory(currentTreeSha, '');
    }

    private async flattenDirectory(treeSha: string, prefix: string): Promise<RawIndexedFile[]> {
        const result: RawIndexedFile[] = [];
        const entries = await this.readTree(treeSha);
        for (const entry of entries) {
            this.throwIfCancelled();
            const relativePath = portableJoin(prefix, entry.name);
            if (entry.kind === 'tree') {
                if (!shouldIgnoreDirectoryName(entry.name)) {
                    result.push(...await this.flattenDirectory(entry.objectName, relativePath));
                    if (result.length > MAX_SNAPSHOT_FILES) {
                        throw new Error('comparison-snapshot-file-limit');
                    }
                }
                continue;
            }
            if (entry.kind === 'commit' || !isDirectoryAnalysisFile(relativePath)) {
                continue;
            }
            result.push({
                relativePath,
                blobSha: entry.objectName,
                extension: path.extname(relativePath).toLowerCase(),
                metricAnalyzable: isMetricAnalysisFile(relativePath)
                    && (this.recursive || !relativePath.includes('/')),
            });
            if (result.length > MAX_SNAPSHOT_FILES) {
                throw new Error('comparison-snapshot-file-limit');
            }
        }
        return result;
    }

    private async applyLimits(
        source: ComparisonSource,
        rawFiles: RawIndexedFile[],
    ): Promise<IndexedGitRevision> {
        if (rawFiles.length === 0) {
            return {
                source,
                files: [],
                missingTarget: false,
                warnings: [],
            };
        }
        const warnings: string[] = [];
        const files: IndexedGitFile[] = [];
        let totalBytes = 0;
        for (const file of rawFiles) {
            this.throwIfCancelled();
            const metadata = await this.readMetadata(file.blobSha);
            if (metadata.objectType !== 'blob') {
                warnings.push(`Skipped unsupported Git entry: ${file.relativePath}`);
                continue;
            }
            if (!Number.isFinite(metadata.size) || metadata.size > MAX_SINGLE_FILE_BYTES) {
                warnings.push(`Skipped oversized file: ${file.relativePath}`);
                continue;
            }
            totalBytes += metadata.size;
            if (totalBytes > MAX_SNAPSHOT_BYTES) {
                throw new Error('comparison-snapshot-size-limit');
            }
            if (file.metricAnalyzable) {
                files.push({
                    relativePath: file.relativePath,
                    blobSha: file.blobSha,
                    extension: file.extension,
                    size: metadata.size,
                });
            }
        }
        return {
            source,
            files: files.sort((left, right) => (
                left.relativePath < right.relativePath
                    ? -1
                    : left.relativePath > right.relativePath
                        ? 1
                        : 0
            )),
            missingTarget: false,
            warnings,
        };
    }

    private readTree(treeSha: string): Promise<TreeEntry[]> {
        const existing = this.treeCache.get(treeSha);
        if (existing) {
            return existing;
        }
        const pending = this.objects.readObject(treeSha).then(parseTreeObject);
        this.treeCache.set(treeSha, pending);
        return pending;
    }

    private readMetadata(blobSha: string): Promise<{ size: number; objectType: string }> {
        const existing = this.metadataCache.get(blobSha);
        if (existing) {
            return existing;
        }
        const pending = this.metadata.readMetadata(blobSha).then((value) => ({
            size: value.size,
            objectType: value.objectType,
        }));
        this.metadataCache.set(blobSha, pending);
        return pending;
    }

    private throwIfCancelled(): void {
        if (this.token?.isCancellationRequested) {
            throw new Error('git-export-cancelled');
        }
    }
}
