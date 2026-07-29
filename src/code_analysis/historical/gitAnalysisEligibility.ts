import * as fs from 'fs';
import {
    ComparisonSource,
    GitAnalysisEligibility,
    GitAnalysisExclusion,
    GitAnalysisExclusionCode,
} from './historicalComparisonModels';
import {
    GitTimelineBlobIndex,
    IndexedGitRevision,
} from './gitTimelineBlobIndex';

export interface GitPayloadValidation {
    usable: boolean;
    entries: Record<string, unknown>[];
    code?: GitAnalysisExclusionCode;
    reason?: string;
}

export class GitAnalysisSourceError extends Error {
    public constructor(
        public readonly code: 'comparison-source-no-data' | 'project-evolution-insufficient-data',
        message: string,
        public readonly exclusions: GitAnalysisExclusion[],
    ) {
        super(message);
        this.name = 'GitAnalysisSourceError';
    }
}

interface CatalogFilterOptions {
    repositoryRoot: string;
    targetRelativePath: string;
    sources: ComparisonSource[];
}

interface CatalogFilterResult {
    sources: ComparisonSource[];
    eligibility: GitAnalysisEligibility;
}

interface CachedCommitEligibility {
    usable: boolean;
    code?: GitAnalysisExclusionCode;
    reason?: string;
}

const ELIGIBILITY_CACHE_VERSION = 'git-analysis-eligibility-v1';

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function validateGitAnalysisPayload(value: unknown): GitPayloadValidation {
    if (!Array.isArray(value)) {
        return {
            usable: false,
            entries: [],
            code: 'invalid-payload',
            reason: 'The analysis did not produce a JSON array.',
        };
    }
    const entries = value.filter(isRecord);
    if (entries.length < 1) {
        return {
            usable: false,
            entries: [],
            code: 'no-analyzable-content',
            reason: 'The analysis produced no data records.',
        };
    }
    return { usable: true, entries };
}

export function isDeterministicNoDataError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /JSON markers not found|unable to parse result|no (?:JSON|data|records)|empty (?:JSON|payload)/i
        .test(message);
}

export function createGitAnalysisExclusion(
    source: ComparisonSource,
    code: GitAnalysisExclusionCode,
    stage: GitAnalysisExclusion['stage'],
    reason: string,
): GitAnalysisExclusion {
    return {
        id: source.id,
        label: source.label,
        ...(source.kind === 'gitRef' ? { commitSha: source.commitSha } : {}),
        code,
        stage,
        reason,
    };
}

function classifyIndexedRevision(revision: IndexedGitRevision): CachedCommitEligibility {
    if (revision.missingTarget) {
        return {
            usable: false,
            code: 'target-missing',
            reason: 'The analyzed target does not exist in this revision.',
        };
    }
    if (revision.failureReason) {
        const limitExceeded = /(?:file|size)-limit/i.test(revision.failureReason);
        return {
            usable: false,
            code: limitExceeded ? 'limit-exceeded' : 'analysis-failed',
            reason: limitExceeded
                ? 'The revision exceeds the configured analysis limits.'
                : `The Git revision could not be inspected: ${revision.failureReason}`,
        };
    }
    if (revision.files.length < 1) {
        return {
            usable: false,
            code: 'no-analyzable-content',
            reason: 'The revision contains no analyzable data for this target.',
        };
    }
    return { usable: true };
}

/**
 * Session-scoped source catalogue shared by Historical comparison and Project
 * evolution. Git tree eligibility is cached by commit SHA; the working copy
 * is re-read on every request because its data.json is live.
 */
export class GitAnalysisSourceCatalog {
    private index: GitTimelineBlobIndex | null = null;
    private indexSignature = '';
    private readonly commitEligibility = new Map<string, CachedCommitEligibility>();
    private readonly deterministicExclusions = new Map<string, CachedCommitEligibility>();
    private filterQueue: Promise<void> = Promise.resolve();

    public constructor(
        private readonly targetType: 'file' | 'directory',
        private readonly recursive: boolean,
        private readonly workingCopyDataPath: string,
    ) {}

    public filterSources(options: CatalogFilterOptions): Promise<CatalogFilterResult> {
        const result = this.filterQueue.then(() => this.filterSourcesNow(options));
        this.filterQueue = result.then(() => undefined, () => undefined);
        return result;
    }

    private async filterSourcesNow(options: CatalogFilterOptions): Promise<CatalogFilterResult> {
        await this.ensureIndex(options.repositoryRoot, options.targetRelativePath);
        const gitSourcesBySha = new Map<string, ComparisonSource[]>();
        for (const source of options.sources) {
            if (source.kind !== 'gitRef') {
                continue;
            }
            const group = gitSourcesBySha.get(source.commitSha) || [];
            group.push(source);
            gitSourcesBySha.set(source.commitSha, group);
        }

        const pendingSources = Array.from(gitSourcesBySha.entries())
            .filter(([sha]) => !this.commitEligibility.has(sha))
            .map(([, sources]) => sources[0]);
        if (pendingSources.length) {
            const indexed = await this.index!.build(pendingSources);
            indexed.forEach((revision) => {
                this.commitEligibility.set(
                    revision.source.kind === 'gitRef' ? revision.source.commitSha : revision.source.id,
                    classifyIndexedRevision(revision),
                );
            });
        }

        const workingCopyEligibility = await this.readWorkingCopyEligibility();
        const usable: ComparisonSource[] = [];
        const excludedSources: GitAnalysisExclusion[] = [];
        for (const source of options.sources) {
            const cached = source.kind === 'workingCopy'
                ? workingCopyEligibility
                : this.deterministicExclusions.get(source.commitSha)
                    || this.commitEligibility.get(source.commitSha);
            if (!cached || cached.usable) {
                usable.push(source);
                continue;
            }
            excludedSources.push(createGitAnalysisExclusion(
                source,
                cached.code || 'analysis-failed',
                cached === this.deterministicExclusions.get(
                    source.kind === 'gitRef' ? source.commitSha : source.id,
                ) ? 'analysis' : 'index',
                cached.reason || 'The revision is not analyzable.',
            ));
        }

        return {
            sources: usable,
            eligibility: {
                scannedSourceCount: options.sources.length,
                usableSourceCount: usable.length,
                excludedSources,
            },
        };
    }

    public recordDeterministicExclusion(
        source: ComparisonSource,
        code: GitAnalysisExclusionCode,
        reason: string,
    ): GitAnalysisExclusion {
        const key = source.kind === 'gitRef' ? source.commitSha : source.id;
        this.deterministicExclusions.set(key, { usable: false, code, reason });
        return createGitAnalysisExclusion(source, code, 'analysis', reason);
    }

    public async dispose(): Promise<void> {
        await this.index?.dispose();
        this.index = null;
        this.commitEligibility.clear();
        this.deterministicExclusions.clear();
    }

    private async ensureIndex(repositoryRoot: string, targetRelativePath: string): Promise<void> {
        const signature = [
            ELIGIBILITY_CACHE_VERSION,
            repositoryRoot,
            targetRelativePath,
            this.targetType,
            this.recursive ? 'deep' : 'shallow',
        ].join('\0');
        if (this.index && signature === this.indexSignature) {
            return;
        }
        await this.index?.dispose();
        this.index = new GitTimelineBlobIndex(
            repositoryRoot,
            targetRelativePath,
            this.targetType,
            this.recursive,
        );
        this.indexSignature = signature;
        this.commitEligibility.clear();
    }

    private async readWorkingCopyEligibility(): Promise<CachedCommitEligibility> {
        try {
            const raw = JSON.parse(await fs.promises.readFile(this.workingCopyDataPath, 'utf8'));
            const validation = validateGitAnalysisPayload(raw);
            return validation.usable
                ? { usable: true }
                : {
                    usable: false,
                    code: validation.code,
                    reason: validation.reason,
                };
        } catch {
            return {
                usable: false,
                code: 'invalid-payload',
                reason: 'The working copy data.json is missing or unreadable.',
            };
        }
    }
}
