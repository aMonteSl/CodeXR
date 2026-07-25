import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { UnifiedAnalysisSession } from '../engine/core/analysisSession';
import { UnifiedSessionRegistry } from '../engine/core/sessionRegistry';
import { ExecutePython } from '../engine/utils/executePython';
import { GitRepositoryService } from './gitRepositoryService';
import { sampleTimeline } from './gitTimelineSampler';
import {
    ComparisonSource,
    ProjectEvolutionProgress,
    ProjectEvolutionReferences,
    ProjectEvolutionRequest,
    ProjectEvolutionResult,
    buildBabiaStyleFilePath,
} from './historicalComparisonModels';

const ANALYZER_CACHE_VERSION = 'project-evolution-v1';
const DEFAULT_MAX_FRAMES = 24;
const DEFAULT_ANALYSIS_CONCURRENCY = 4;
const TIMELINE_SCAN_LIMIT = 240;

interface CachedPayload {
    payload: Record<string, unknown>[];
    missingTarget: boolean;
    warnings: string[];
}

export class ProjectEvolutionService {
    private readonly gitService: GitRepositoryService;
    private readonly cache = new Map<string, CachedPayload>();
    private activeJob: Promise<ProjectEvolutionResult> | null = null;
    private activeRequest: ProjectEvolutionRequest | null = null;
    private revision = 0;
    private cancellationRevision = 0;

    public constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly sessionId: string,
        private readonly staticRoot: string,
    ) {
        const privateStorageRoot = context.storageUri?.fsPath || context.globalStorageUri.fsPath;
        this.gitService = new GitRepositoryService(
            this.getSession().targetPath,
            path.join(privateStorageRoot, 'project-evolution', sessionId, 'snapshots'),
        );
    }

    public getAvailability(): Promise<{ enabled: boolean; reason: string | null }> {
        return this.gitService.getAvailability(
            'Project evolution requires a local Git repository.',
        );
    }

    public async getReferences(): Promise<ProjectEvolutionReferences> {
        const references = await this.gitService.listReferences();
        const timeline = await this.buildAutomaticTimeline(references);
        const suggested = this.sampleSources(timeline, DEFAULT_MAX_FRAMES).map((source) => source.id);
        return {
            ...references,
            sources: this.mergeSources(references.sources, timeline),
            activeRequest: this.activeRequest ? { ...this.activeRequest } : null,
            suggestedSourceIds: suggested,
            maxFrames: DEFAULT_MAX_FRAMES,
        };
    }

    public isBusy(): boolean {
        return this.activeJob !== null;
    }

    public async generate(
        request: ProjectEvolutionRequest,
        onProgress: (progress: ProjectEvolutionProgress) => void,
    ): Promise<ProjectEvolutionResult> {
        if (this.activeJob) {
            throw new Error('project-evolution-busy');
        }
        const job = this.executeEvolution(request, onProgress);
        this.activeJob = job;
        try {
            const result = await job;
            this.activeRequest = { ...request };
            return result;
        } finally {
            this.activeJob = null;
        }
    }

    public async dispose(): Promise<void> {
        await this.gitService.dispose();
        this.cache.clear();
    }

    public async clearGeneratedMovie(): Promise<void> {
        this.cancellationRevision += 1;
        this.activeRequest = null;
        this.cache.clear();
        if (this.revision < 1) {
            return;
        }
        const evolutionDirectory = path.resolve(this.staticRoot, 'evolution');
        const revisionDirectory = path.resolve(evolutionDirectory, `revision-${this.revision}`);
        const staticRoot = path.resolve(this.staticRoot);
        if (!revisionDirectory.startsWith(staticRoot + path.sep) && revisionDirectory !== staticRoot) {
            throw new Error('project-evolution-clear-outside-static-root');
        }
        await fs.promises.rm(revisionDirectory, { recursive: true, force: true });
    }

    public async applyFrameToBridge(
        revision: number,
        frameIndex: number,
    ): Promise<{ revision: number; frameIndex: number; bridgeUrl: string }> {
        const safeRevision = Math.floor(Number(revision));
        const safeFrameIndex = Math.floor(Number(frameIndex));
        if (!Number.isFinite(safeRevision) || safeRevision < 1 || safeRevision !== this.revision) {
            throw new Error('project-evolution-invalid-revision');
        }
        if (!Number.isFinite(safeFrameIndex) || safeFrameIndex < 0) {
            throw new Error('project-evolution-invalid-frame');
        }
        const revisionDirectory = this.resolveRevisionDirectory(safeRevision);
        const sourcePath = path.join(revisionDirectory, `data${safeFrameIndex + 1}.json`);
        const bridgePath = path.join(revisionDirectory, 'data.json');
        await fs.promises.access(sourcePath, fs.constants.R_OK);
        await this.copyFileAtomically(sourcePath, bridgePath);
        return {
            revision: safeRevision,
            frameIndex: safeFrameIndex,
            bridgeUrl: `/evolution/revision-${safeRevision}/data.json`,
        };
    }

    private async executeEvolution(
        request: ProjectEvolutionRequest,
        onProgress: (progress: ProjectEvolutionProgress) => void,
    ): Promise<ProjectEvolutionResult> {
        onProgress?.({ state: 'analyzing', message: 'Resolving project timeline...' });
        const cancellationToken = this.cancellationRevision;
        const sources = await this.resolveTimelineSources(request);
        if (sources.length < 1) {
            throw new Error('project-evolution-empty-timeline');
        }
        const revision = ++this.revision;
        const evolutionDirectory = path.join(this.staticRoot, 'evolution');
        const revisionDirectory = path.join(evolutionDirectory, `revision-${revision}`);
        await fs.promises.rm(revisionDirectory, { recursive: true, force: true });
        await fs.promises.mkdir(revisionDirectory, { recursive: true });

        const frames: ProjectEvolutionResult['frames'] = new Array(sources.length);
        const concurrency = Math.min(DEFAULT_ANALYSIS_CONCURRENCY, sources.length);
        let nextIndex = 0;
        let completed = 0;

        onProgress?.({
            state: 'analyzing',
            message: `Analyzing ${sources.length} project revisions with ${concurrency} workers...`,
            frameIndex: 0,
            frameCount: sources.length,
        });

        const workers = Array.from({ length: concurrency }, async () => {
            while (nextIndex < sources.length && cancellationToken === this.cancellationRevision) {
                const index = nextIndex;
                nextIndex += 1;
                const source = sources[index];
                onProgress?.({
                    state: 'analyzing',
                    message: `Analyzing frame ${index + 1} / ${sources.length} (${this.describeRevisionType(source)}): ${source.label}`,
                    frameIndex: index,
                    frameCount: sources.length,
                });
                const payload = await this.analyzeSource(source);
                if (cancellationToken !== this.cancellationRevision) {
                    throw new Error('project-evolution-cleared');
                }
                const fileName = `data${index + 1}.json`;
                await fs.promises.writeFile(
                    path.join(revisionDirectory, fileName),
                    JSON.stringify(payload.payload, null, 2),
                    'utf8',
                );
                frames[index] = {
                    index,
                    source,
                    label: source.label,
                    date: this.extractDate(source) || '',
                    url: `/evolution/revision-${revision}/${fileName}`,
                    itemCount: payload.payload.length,
                    missingTarget: payload.missingTarget,
                    warnings: payload.warnings,
                };
                completed += 1;
                onProgress?.({
                    state: 'analyzing',
                    message: `Analyzed ${completed} / ${sources.length} project revisions. Last completed: ${this.describeRevisionType(source)} ${source.label}`,
                    frameIndex: index,
                    frameCount: sources.length,
                });
            }
        });
        await Promise.all(workers);
        if (cancellationToken !== this.cancellationRevision) {
            throw new Error('project-evolution-cleared');
        }

        const result: ProjectEvolutionResult = {
            revision,
            mode: 'project-evolution',
            frames,
            generatedAt: new Date().toISOString(),
            manifestUrl: `/evolution/revision-${revision}/manifest.json`,
            bridgeUrl: `/evolution/revision-${revision}/data.json`,
        };
        await this.copyFileAtomically(
            path.join(revisionDirectory, 'data1.json'),
            path.join(revisionDirectory, 'data.json'),
        );
        await fs.promises.writeFile(
            path.join(revisionDirectory, 'manifest.json'),
            JSON.stringify(result, null, 2),
            'utf8',
        );
        onProgress?.({
            state: 'ready',
            message: 'Project evolution ready.',
            revision,
            frameCount: frames.length,
        });
        return result;
    }

    private async resolveTimelineSources(request: ProjectEvolutionRequest): Promise<ComparisonSource[]> {
        const mode = request.mode || 'auto';
        const maxFrames = Math.max(1, Math.min(96, Math.floor(Number(request.maxFrames || DEFAULT_MAX_FRAMES))));
        if (mode === 'manual' && Array.isArray(request.sourceIds) && request.sourceIds.length) {
            return this.gitService.resolveSourcesInChronologicalOrder(request.sourceIds.slice(0, maxFrames));
        }
        const timeline = await this.buildAutomaticTimeline();
        if (mode === 'range' && request.startSourceId && request.endSourceId) {
            const startIndex = await this.resolveTimelineIndex(timeline, request.startSourceId);
            const endIndex = await this.resolveTimelineIndex(timeline, request.endSourceId);
            // A range the user asked for must never silently degrade into the
            // full automatic movie — that is how "my range was not analyzed"
            // presented. Unresolvable endpoints are a loud error instead.
            if (startIndex < 0 || endIndex < 0) {
                throw new Error('project-evolution-range-not-found');
            }
            const from = Math.min(startIndex, endIndex);
            const to = Math.max(startIndex, endIndex);
            return this.sampleSources(timeline.slice(from, to + 1), maxFrames);
        }
        return this.sampleSources(timeline, maxFrames);
    }

    /**
     * Position of a picked source inside the commit timeline.
     *
     * The picker offers branches, tags and the working copy, whose ids do not
     * exist in the commit-only timeline — so a direct id match is only the fast
     * path. Otherwise the source is resolved to its commit sha (branches/tags
     * point at one) and located by sha; the working copy means "the end".
     */
    private async resolveTimelineIndex(
        timeline: ComparisonSource[],
        sourceId: string,
    ): Promise<number> {
        const byId = timeline.findIndex((source) => source.id === sourceId);
        if (byId >= 0) {
            return byId;
        }
        if (sourceId === 'working-copy') {
            return timeline.length - 1;
        }
        try {
            const picked = await this.gitService.resolveSource(sourceId);
            if (picked.kind !== 'gitRef' || !picked.commitSha) {
                return -1;
            }
            return timeline.findIndex(
                (source) => source.kind === 'gitRef' && source.commitSha === picked.commitSha,
            );
        } catch {
            return -1;
        }
    }

    private async buildAutomaticTimeline(existingReferences?: { sources: ComparisonSource[]; workingTreeDirty: boolean }): Promise<ComparisonSource[]> {
        const references = existingReferences || await this.gitService.listReferences();
        const timeline = await this.gitService.listTimelineSources(TIMELINE_SCAN_LIMIT);
        const gitTimeline = timeline.length
            ? timeline
            : references.sources.filter((source) => source.kind === 'gitRef');
        const endAnchor = this.resolveCurrentStateSource(references);
        if (endAnchor && !gitTimeline.some((source) => source.id === endAnchor.id)) {
            return [...gitTimeline, endAnchor];
        }
        return gitTimeline;
    }

    /**
     * The revision a movie must finish on: the branch as it stands right now.
     *
     * That is the working copy — it is the checked-out branch whether or not the
     * tree is dirty, and it is what the user is looking at. The timeline itself
     * is `--all`, so its last entry may well belong to a different branch and
     * cannot be trusted as the ending.
     */
    private resolveCurrentStateSource(
        references: { sources: ComparisonSource[]; workingTreeDirty: boolean },
    ): ComparisonSource | null {
        return references.sources.find((source) => source.kind === 'workingCopy') || null;
    }

    private sampleSources(sources: ComparisonSource[], maxFrames: number): ComparisonSource[] {
        // Shared sampler: even spacing in time, milestones preferred, and the
        // current state of the branch always last (see gitTimelineSampler).
        return sampleTimeline(sources, maxFrames, sources[sources.length - 1] || null);
    }

    private mergeSources(primary: ComparisonSource[], timeline: ComparisonSource[]): ComparisonSource[] {
        const merged = new Map<string, ComparisonSource>();
        for (const source of primary) {
            merged.set(source.id, source);
        }
        for (const source of timeline) {
            merged.set(source.id, source);
        }
        return Array.from(merged.values());
    }

    private async analyzeSource(source: ComparisonSource): Promise<CachedPayload> {
        const session = this.getSession();
        if (source.kind === 'workingCopy') {
            const dataPath = path.join(session.savedFilesPath || this.staticRoot, 'data.json');
            const payload = JSON.parse(await fs.promises.readFile(dataPath, 'utf8'));
            return {
                payload: this.decoratePayload(Array.isArray(payload) ? payload : [], session, session.targetPath),
                missingTarget: false,
                warnings: [],
            };
        }

        const cacheKey = crypto.createHash('sha256')
            .update([
                ANALYZER_CACHE_VERSION,
                source.commitSha,
                session.targetPath,
                session.targetType,
                session.isDeep ? 'deep' : 'shallow',
            ].join('\0'))
            .digest('hex');
        const cached = this.cache.get(cacheKey);
        if (cached) {
            return cached;
        }

        const materialized = await this.gitService.materialize(source);
        if (!materialized.targetPath) {
            const missing = {
                payload: [],
                missingTarget: true,
                warnings: materialized.warnings,
            };
            this.cache.set(cacheKey, missing);
            return missing;
        }

        const evolutionSession: UnifiedAnalysisSession = {
            ...session,
            id: `${session.id}-evolution-${source.commitSha.slice(0, 8)}`,
            targetPath: materialized.targetPath,
            targetName: path.basename(materialized.targetPath),
            status: 'analyzing',
            startTime: new Date(),
            requiredFiles: new Map(),
            templatePaths: new Map(),
            metadata: { projectEvolutionSource: source },
        };
        const analysisResult = await new ExecutePython(this.context).executeAnalysis(evolutionSession);
        const result = {
            payload: this.decoratePayload(
                Array.isArray(analysisResult) ? analysisResult : [],
                session,
                materialized.targetPath,
            ),
            missingTarget: false,
            warnings: materialized.warnings,
        };
        this.cache.set(cacheKey, result);
        return result;
    }

    private decoratePayload(
        payload: Record<string, unknown>[],
        session: UnifiedAnalysisSession,
        analyzedTargetPath: string,
    ): Record<string, unknown>[] {
        if (session.targetType === 'directory') {
            return payload.map((entry) => {
                const sourcePath = String(entry.filePath || entry.relativePath || entry.fileName || '');
                const relativePath = this.toPortableRelativePath(analyzedTargetPath, sourcePath);
                return {
                    ...entry,
                    // The boats tree splits filePath — the same field, with
                    // the same shape, the normal analysis publishes. Rebuild
                    // it against the ORIGINAL target so the materialized
                    // copy's temp location never shapes the quarters and the
                    // movie's tree matches the normal analysis exactly.
                    filePath: buildBabiaStyleFilePath(session.targetPath, relativePath),
                    relativePath,
                    // Cross-commit identity stays RELATIVE: it must match the
                    // same file across frames regardless of where each
                    // revision was materialized.
                    evolutionKey: `file:${relativePath.toLocaleLowerCase()}`,
                };
            });
        }
        return payload.map((entry) => ({
            ...entry,
            evolutionKey: `function:${String(entry.functionName || entry.name || 'unknown').toLocaleLowerCase()}`,
        }));
    }

    private extractDate(source: ComparisonSource): string | undefined {
        const description = source.kind === 'gitRef' ? source.description : '';
        const match = String(description || '').match(/^(\d{4}-\d{2}-\d{2})/);
        return match ? match[1] : undefined;
    }

    private describeRevisionType(source: ComparisonSource): string {
        if (source.kind === 'workingCopy') {
            return 'working copy';
        }
        if (source.revisionType === 'merge') {
            return 'merge';
        }
        return source.revisionType || source.refType || 'commit';
    }

    private resolveRevisionDirectory(revision: number): string {
        const evolutionDirectory = path.resolve(this.staticRoot, 'evolution');
        const revisionDirectory = path.resolve(evolutionDirectory, `revision-${revision}`);
        const staticRoot = path.resolve(this.staticRoot);
        if (!revisionDirectory.startsWith(staticRoot + path.sep) && revisionDirectory !== staticRoot) {
            throw new Error('project-evolution-revision-outside-static-root');
        }
        return revisionDirectory;
    }

    private async copyFileAtomically(sourcePath: string, destinationPath: string): Promise<void> {
        const tempPath = `${destinationPath}.${process.pid}.${Date.now()}.tmp`;
        await fs.promises.copyFile(sourcePath, tempPath);
        await fs.promises.rename(tempPath, destinationPath);
    }

    private toPortableRelativePath(root: string, candidate: string): string {
        if (!candidate) {
            return 'unknown';
        }
        if (!path.isAbsolute(candidate)) {
            return candidate
                .replace(/\\/g, '/')
                .replace(/^\.\/+/, '')
                .replace(/\/+/g, '/')
                .replace(/^\/|\/$/g, '') || 'unknown';
        }
        const normalizedCandidate = path.resolve(candidate);
        const normalizedRoot = path.resolve(root);
        const relativePath = path.relative(normalizedRoot, normalizedCandidate);
        if (!relativePath.startsWith('..') && !path.isAbsolute(relativePath)) {
            return relativePath.split(path.sep).join('/');
        }
        return path.basename(candidate);
    }

    private getSession(): UnifiedAnalysisSession {
        const session = UnifiedSessionRegistry.getInstance(this.context).getSession(this.sessionId);
        if (!session || session.analysisMode !== 'XR') {
            throw new Error('project-evolution-session-unavailable');
        }
        return session;
    }
}
