import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { AnalysisConfigurationStorage } from '../configuration/analysisConfigurationStorage';
import { UnifiedAnalysisSession } from '../engine/core/analysisSession';
import { UnifiedSessionRegistry } from '../engine/core/sessionRegistry';
import { ExecutePython } from '../engine/utils/executePython';
import { GitRepositoryService } from './gitRepositoryService';
import {
    GitAnalysisSourceCatalog,
    GitAnalysisSourceError,
    isDeterministicNoDataError,
    validateGitAnalysisPayload,
} from './gitAnalysisEligibility';
import {
    ComparisonDataset,
    ComparisonDeltaSummary,
    ComparisonSource,
    GitAnalysisExclusionCode,
    HistoricalComparisonProgress,
    HistoricalComparisonReferences,
    HistoricalComparisonRequest,
    HistoricalComparisonResult,
    buildBabiaStyleFilePath,
} from './historicalComparisonModels';

const ANALYZER_CACHE_VERSION = 'historical-v1';

interface CachedPayload {
    payload: Record<string, unknown>[];
    missingTarget: boolean;
    warnings: string[];
}

export class HistoricalComparisonService {
    private readonly gitService: GitRepositoryService;
    private readonly sourceCatalog: GitAnalysisSourceCatalog;
    private readonly ownsSourceCatalog: boolean;
    private readonly cache = new Map<string, CachedPayload>();
    private references: HistoricalComparisonReferences | null = null;
    private activeJob: Promise<HistoricalComparisonResult> | null = null;
    private activeRequest: HistoricalComparisonRequest | null = null;
    private revision = 0;

    public constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly sessionId: string,
        private readonly staticRoot: string,
        sourceCatalog?: GitAnalysisSourceCatalog,
    ) {
        const session = this.getSession();
        const privateStorageRoot = context.storageUri?.fsPath || context.globalStorageUri.fsPath;
        const snapshotRoot = path.join(
            privateStorageRoot,
            'historical-comparisons',
            sessionId,
            'snapshots',
        );
        this.gitService = new GitRepositoryService(session.targetPath, snapshotRoot);
        this.ownsSourceCatalog = !sourceCatalog;
        this.sourceCatalog = sourceCatalog || new GitAnalysisSourceCatalog(
            session.targetType,
            session.isDeep === true,
            path.join(session.savedFilesPath || staticRoot, 'data.json'),
        );
    }

    public async getReferences(): Promise<HistoricalComparisonReferences> {
        const references = await this.gitService.listReferences();
        const filtered = await this.sourceCatalog.filterSources({
            repositoryRoot: references.repositoryRoot,
            targetRelativePath: references.targetRelativePath,
            sources: references.sources,
        });
        this.references = {
            ...references,
            sources: filtered.sources,
            eligibility: filtered.eligibility,
            activeRequest: this.activeRequest ? { ...this.activeRequest } : null,
        };
        return this.references;
    }

    public getAvailability(): Promise<{ enabled: boolean; reason: string | null }> {
        return this.gitService.getAvailability(
            'The analyzed target is not inside a local Git repository.',
        );
    }

    public async compare(
        request: HistoricalComparisonRequest,
        onProgress?: (progress: HistoricalComparisonProgress) => void,
    ): Promise<HistoricalComparisonResult> {
        if (this.activeJob) {
            throw new Error('comparison-busy');
        }
        const job = this.executeComparison(request, onProgress);
        this.activeJob = job;
        try {
            const result = await job;
            this.activeRequest = { ...request };
            return result;
        } finally {
            this.activeJob = null;
        }
    }

    public isBusy(): boolean {
        return this.activeJob !== null;
    }

    public hasLiveSource(): boolean {
        return this.activeRequest?.leftSourceId === 'working-copy'
            || this.activeRequest?.rightSourceId === 'working-copy';
    }

    public async refreshActiveComparison(
        onProgress?: (progress: HistoricalComparisonProgress) => void,
    ): Promise<HistoricalComparisonResult | null> {
        if (!this.activeRequest || !this.hasLiveSource()) {
            return null;
        }
        return this.compare({ ...this.activeRequest }, onProgress);
    }

    public clearActiveComparison(): void {
        this.activeRequest = null;
    }

    public async dispose(): Promise<void> {
        await this.gitService.dispose();
        if (this.ownsSourceCatalog) {
            await this.sourceCatalog.dispose();
        }
        this.cache.clear();
    }

    private async executeComparison(
        request: HistoricalComparisonRequest,
        onProgress?: (progress: HistoricalComparisonProgress) => void,
    ): Promise<HistoricalComparisonResult> {
        if (!request.leftSourceId || !request.rightSourceId || request.leftSourceId === request.rightSourceId) {
            throw new Error('comparison-sources-must-differ');
        }
        onProgress?.({ state: 'analyzing', message: 'Resolving Git references...' });
        const [leftSource, rightSource] = await Promise.all([
            this.gitService.resolveSource(request.leftSourceId),
            this.gitService.resolveSource(request.rightSourceId),
        ]);

        onProgress?.({ state: 'analyzing', message: `Analyzing ${leftSource.label}...` });
        const leftPayload = await this.analyzeSource(leftSource);
        onProgress?.({ state: 'analyzing', message: `Analyzing ${rightSource.label}...` });
        const rightPayload = await this.analyzeSource(rightSource);

        const session = this.getSession();
        // Filtered references make this unreachable through the UI, but the
        // request API accepts raw source ids: a single-file comparison against
        // a version that lacks the file is meaningless, so refuse it.
        if (session.targetType === 'file' && (leftPayload.missingTarget || rightPayload.missingTarget)) {
            throw new Error('comparison-target-missing-in-version');
        }
        const mappings = await this.getSelectedMetricFields(session);
        const delta = this.buildDelta(
            leftPayload.payload,
            rightPayload.payload,
            session,
            mappings,
        );
        const revision = ++this.revision;
        const comparisonDirectory = path.join(this.staticRoot, 'comparison');
        await fs.promises.mkdir(comparisonDirectory, { recursive: true });

        const leftFileName = `revision-${revision}-left.json`;
        const rightFileName = `revision-${revision}-right.json`;
        await Promise.all([
            fs.promises.writeFile(
                path.join(comparisonDirectory, leftFileName),
                JSON.stringify(leftPayload.payload, null, 2),
                'utf8',
            ),
            fs.promises.writeFile(
                path.join(comparisonDirectory, rightFileName),
                JSON.stringify(rightPayload.payload, null, 2),
                'utf8',
            ),
        ]);

        const result: HistoricalComparisonResult = {
            revision,
            mode: 'historical-compare',
            left: this.toDataset(leftSource, leftPayload, `/comparison/${leftFileName}`),
            right: this.toDataset(rightSource, rightPayload, `/comparison/${rightFileName}`),
            delta,
            generatedAt: new Date().toISOString(),
        };
        await fs.promises.writeFile(
            path.join(comparisonDirectory, `revision-${revision}.json`),
            JSON.stringify(result, null, 2),
            'utf8',
        );
        onProgress?.({ state: 'ready', message: 'Historical comparison ready.', revision });
        return result;
    }

    private async analyzeSource(source: ComparisonSource): Promise<CachedPayload> {
        const session = this.getSession();
        if (source.kind === 'workingCopy') {
            const dataPath = path.join(session.savedFilesPath || this.staticRoot, 'data.json');
            let payload: unknown;
            try {
                payload = JSON.parse(await fs.promises.readFile(dataPath, 'utf8'));
            } catch {
                throw this.excludeSource(
                    source,
                    'invalid-payload',
                    'The working copy data.json is missing or unreadable.',
                );
            }
            const validation = this.requireUsablePayload(source, payload);
            return {
                payload: this.decoratePayload(
                    validation,
                    session,
                    session.targetPath,
                ),
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
            throw this.excludeSource(
                source,
                'target-missing',
                'The analyzed target does not exist in this revision.',
            );
        }

        const historicalSession: UnifiedAnalysisSession = {
            ...session,
            id: `${session.id}-comparison-${source.commitSha.slice(0, 8)}`,
            targetPath: materialized.targetPath,
            targetName: path.basename(materialized.targetPath),
            status: 'analyzing',
            startTime: new Date(),
            requiredFiles: new Map(),
            templatePaths: new Map(),
            metadata: { comparisonSource: source },
        };
        let analysisResult: unknown;
        try {
            analysisResult = await new ExecutePython(this.context).executeAnalysis(historicalSession);
        } catch (error) {
            if (isDeterministicNoDataError(error)) {
                throw this.excludeSource(
                    source,
                    'invalid-payload',
                    'The analyzer did not produce a readable JSON payload.',
                );
            }
            throw error;
        }
        const payload = this.decoratePayload(
            this.requireUsablePayload(source, analysisResult),
            session,
            materialized.targetPath,
        );
        const result = {
            payload,
            missingTarget: false,
            warnings: materialized.warnings,
        };
        this.cache.set(cacheKey, result);
        return result;
    }

    private requireUsablePayload(
        source: ComparisonSource,
        payload: unknown,
    ): Record<string, unknown>[] {
        const validation = validateGitAnalysisPayload(payload);
        if (!validation.usable) {
            throw this.excludeSource(
                source,
                validation.code || 'invalid-payload',
                validation.reason || 'The analysis produced no usable data.',
            );
        }
        return validation.entries;
    }

    private excludeSource(
        source: ComparisonSource,
        code: GitAnalysisExclusionCode,
        reason: string,
    ): GitAnalysisSourceError {
        const exclusion = this.sourceCatalog.recordDeterministicExclusion(
            source,
            code,
            reason,
        );
        return new GitAnalysisSourceError(
            'comparison-source-no-data',
            `"${source.label}" was removed from Git analyses: ${reason}`,
            [exclusion],
        );
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
                    // Both comparison sides rebuild filePath against the
                    // ORIGINAL target (normal-analysis shape): the working
                    // copy and the materialized commit then paint identical
                    // quarters for the same file.
                    filePath: buildBabiaStyleFilePath(session.targetPath, relativePath),
                    relativePath,
                    // Cross-side identity stays RELATIVE, independent of
                    // where each side was analyzed.
                    comparisonKey: `file:${relativePath.toLocaleLowerCase()}`,
                };
            });
        }

        const occurrences = new Map<string, number>();
        const targetKey = path.basename(session.targetPath).toLocaleLowerCase();
        return payload.map((entry) => {
            const functionName = String(entry.functionName || 'unknown').trim() || 'unknown';
            const parameters = Number(entry.parameters || 0);
            const signature = `${functionName}#${parameters}`;
            const ordinal = (occurrences.get(signature) || 0) + 1;
            occurrences.set(signature, ordinal);
            return {
                ...entry,
                filePath: targetKey,
                comparisonKey: `function:${targetKey}:${signature.toLocaleLowerCase()}:${ordinal}`,
            };
        });
    }

    private buildDelta(
        left: Record<string, unknown>[],
        right: Record<string, unknown>[],
        session: UnifiedAnalysisSession,
        selectedMetrics: string[],
    ): ComparisonDeltaSummary {
        const leftByKey = new Map(left.map((entry) => [String(entry.comparisonKey || ''), entry]));
        const rightByKey = new Map(right.map((entry) => [String(entry.comparisonKey || ''), entry]));
        let added = 0;
        let removed = 0;
        let modified = 0;
        let unchanged = 0;

        for (const [key, leftEntry] of leftByKey) {
            const rightEntry = rightByKey.get(key);
            if (!rightEntry) {
                removed += 1;
            } else if (this.entriesHaveMetricChanges(leftEntry, rightEntry, session)) {
                modified += 1;
            } else {
                unchanged += 1;
            }
        }
        for (const key of rightByKey.keys()) {
            if (!leftByKey.has(key)) {
                added += 1;
            }
        }

        const metrics = Array.from(new Set(selectedMetrics))
            .map((metric) => {
                const leftValue = this.sumMetric(left, metric);
                const rightValue = this.sumMetric(right, metric);
                return {
                    metric,
                    left: leftValue,
                    right: rightValue,
                    delta: rightValue - leftValue,
                };
            });
        return { added, removed, modified, unchanged, metrics };
    }

    private entriesHaveMetricChanges(
        left: Record<string, unknown>,
        right: Record<string, unknown>,
        session: UnifiedAnalysisSession,
    ): boolean {
        const ignored = new Set([
            'comparisonKey',
            'filePath',
            'treePath',
            'timestamp',
            'status',
            'lineStart',
            'lineEnd',
            'fileName',
            'functionName',
            'relativePath',
        ]);
        const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
        for (const key of keys) {
            if (ignored.has(key)) {
                continue;
            }
            const leftValue = left[key];
            const rightValue = right[key];
            if (
                (typeof leftValue === 'number' || typeof rightValue === 'number')
                && Number(leftValue || 0) !== Number(rightValue || 0)
            ) {
                return true;
            }
            if (
                session.targetType === 'file'
                && typeof leftValue === 'string'
                && typeof rightValue === 'string'
                && leftValue !== rightValue
            ) {
                return true;
            }
        }
        return false;
    }

    private sumMetric(payload: Record<string, unknown>[], metric: string): number {
        return payload.reduce((sum, entry) => {
            const value = Number(entry[metric]);
            return sum + (Number.isFinite(value) ? value : 0);
        }, 0);
    }

    private async getSelectedMetricFields(session: UnifiedAnalysisSession): Promise<string[]> {
        const storage = AnalysisConfigurationStorage.getInstance(this.context);
        const mappings = session.targetType === 'file'
            ? await storage.getDimensionMappingFile()
            : await storage.getDimensionMappingDirectory();
        return Object.values(mappings).filter((value) => typeof value === 'string' && value.length > 0);
    }

    private toDataset(
        source: ComparisonSource,
        payload: CachedPayload,
        url: string,
    ): ComparisonDataset {
        return {
            source,
            url,
            itemCount: payload.payload.length,
            missingTarget: payload.missingTarget,
            warnings: payload.warnings,
        };
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
        if (!session || (session.analysisMode !== 'XR' && session.analysisMode !== 'LivePanel')) {
            throw new Error('historical-comparison-session-unavailable');
        }
        return session;
    }
}
