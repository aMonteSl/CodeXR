import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
    ComparisonSource,
    HistoricalComparisonReferences,
    buildBabiaStyleFilePath,
} from '../historical/historicalComparisonModels';
import { sampleTimeline } from '../historical/gitTimelineSampler';
import {
    GitRevisionExportRequest,
    revisionLimitForScope,
} from './gitExportOptions';
import {
    GitBlobPipelineStatistics,
    PreparedGitRevisionStore,
} from './gitTimelineBlobAnalyzer';

/**
 * Export-time git pre-analysis: the whole timeline, once, shared.
 *
 * Historical comparison and project evolution analyze the same thing per
 * revision; they only disagree on the identity key each mode reads. The
 * export provider indexes Git blobs and analyzes each distinct content once,
 * then this module decorates every chronological payload with BOTH keys and
 * writes it under `git-revisions/`. The exported scene can compose any
 * comparison and any movie offline without repeating work.
 *
 * Deliberately vscode-free: git access, the analyzer and the working-copy
 * reader are injected, so tests drive the full pipeline against a real fixture
 * repository with a stubbed analyzer.
 */

export const GIT_REVISIONS_FOLDER = 'git-revisions';
export const WORKING_COPY_PAYLOAD_FILE = 'working-copy.json';

/**
 * Exports deliberately carry the complete timeline. Live Evolution keeps a
 * bounded scan for responsiveness; an explicit export is a long-running,
 * confirmed operation whose purpose is to remain useful without CodeXR.
 */
/** Mirrors the live evolution defaults so offline suggestions match online. */
export const EXPORT_DEFAULT_MAX_FRAMES = 24;

export interface CancelSignal { readonly isCancellationRequested: boolean }
export interface ProgressSink { report(value: { message?: string; increment?: number }): void }

export interface GitExportSourceEntry extends Record<string, unknown> {
    id: string;
    payloadUrl: string;
    itemCount: number;
}

export interface ExportGitData {
    references: {
        repositoryRoot?: string;
        targetRelativePath: string;
        workingTreeDirty: boolean;
        activeBranch: string | null;
        pageSize: number;
        sources: GitExportSourceEntry[];
    };
    timelineSourceIds: string[];
    suggestedSourceIds: string[];
    maxFrames: number;
    workingCopyPayloadUrl: string;
    timelineSelection?: {
        kind: 'all' | 'latest';
        requestedCommitCount: number | null;
        selectedCommitCount: number;
        exportedCommitCount: number;
        exportedSourceCount: number;
    };
    pipelineStatistics?: GitBlobPipelineStatistics;
    analyzedRevisionCount: number;
    skippedRevisions?: { id: string; reason: string }[];
    partial?: boolean;
}

export interface GitExportOutcome {
    gitData?: ExportGitData;
    failureReason?: string;
    cancelled: boolean;
}

export interface GitRevisionExportDeps {
    gitService: {
        listReferences(): Promise<HistoricalComparisonReferences>;
        listTimelineSources(maxCount: number | null): Promise<ComparisonSource[]>;
        dispose(): Promise<void> | void;
    };
    prepareRevisionStore: (sources: ComparisonSource[]) => Promise<PreparedGitRevisionStore>;
    readWorkingCopyPayload: () => Promise<Record<string, unknown>[] | undefined>;
}

export interface GitRevisionExportOptions {
    targetPath: string;
    targetType: string;
    destinationPath: string;
    request?: GitRevisionExportRequest;
    token?: CancelSignal;
    progress?: ProgressSink;
}

/** Mirror of the services' private helper (kept local to stay vscode-free). */
function toPortableRelativePath(root: string, candidate: string): string {
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

/**
 * The unified decorator: one payload serves both git modes.
 *
 * Directory targets: the two live decorations coincide except for the field
 * name, so both keys carry the same `file:<relativePath>` value, and filePath
 * is rebuilt against the ORIGINAL target (normal-analysis shape) exactly like
 * both services do.
 *
 * File targets: the live decorations genuinely differ, so both are computed —
 * historical's ordinal-disambiguated key (the stricter one) and evolution's
 * plain function key — in a single pass.
 */
export function decorateRevisionPayload(
    entries: Record<string, unknown>[],
    targetType: string,
    originalTargetPath: string,
    analyzedTargetPath: string,
): Record<string, unknown>[] {
    if (targetType === 'directory') {
        return entries.map((entry) => {
            const sourcePath = String(entry.filePath || entry.relativePath || entry.fileName || '');
            const relativePath = toPortableRelativePath(analyzedTargetPath, sourcePath);
            const key = `file:${relativePath.toLocaleLowerCase()}`;
            return {
                ...entry,
                filePath: buildBabiaStyleFilePath(originalTargetPath, relativePath),
                relativePath,
                comparisonKey: key,
                evolutionKey: key,
            };
        });
    }

    const occurrences = new Map<string, number>();
    const targetKey = path.basename(originalTargetPath).toLocaleLowerCase();
    return entries.map((entry) => {
        const functionName = String(entry.functionName || 'unknown').trim() || 'unknown';
        const parameters = Number(entry.parameters || 0);
        const signature = `${functionName}#${parameters}`;
        const ordinal = (occurrences.get(signature) || 0) + 1;
        occurrences.set(signature, ordinal);
        return {
            ...entry,
            filePath: targetKey,
            comparisonKey: `function:${targetKey}:${signature.toLocaleLowerCase()}:${ordinal}`,
            evolutionKey: `function:${functionName.toLocaleLowerCase()}`,
        };
    });
}

function payloadFileNameForSha(commitSha: string): string {
    return `${commitSha.slice(0, 12)}.json`;
}

/**
 * Analyze the timeline once and write the shared payloads into the copy.
 * Failures and cancellation degrade, never abort: whatever completed ships,
 * and the outcome says exactly what happened.
 */
export async function runGitRevisionExport(
    deps: GitRevisionExportDeps,
    options: GitRevisionExportOptions,
): Promise<GitExportOutcome> {
    const { gitService } = deps;
    const request: GitRevisionExportRequest = options.request || {
        scope: { kind: 'all' },
        performanceProfile: 'balanced',
    };
    const revisionsDir = path.join(options.destinationPath, GIT_REVISIONS_FOLDER);
    const skippedRevisions: { id: string; reason: string }[] = [];
    let preparedStore: PreparedGitRevisionStore | undefined;

    let references: HistoricalComparisonReferences;
    let timeline: ComparisonSource[];
    try {
        references = await gitService.listReferences();
        timeline = await gitService.listTimelineSources(revisionLimitForScope(request.scope));
    } catch (error) {
        await gitService.dispose();
        return {
            cancelled: false,
            failureReason: 'The git timeline could not be listed for the export: '
                + `${error instanceof Error ? error.message : String(error)}`,
        };
    }

    try {
        await fs.promises.mkdir(revisionsDir, { recursive: true });

        // One set of selected commits. Refs only share a payload when their
        // target SHA is inside the requested timeline scope; an old branch or
        // tag must never silently expand a "latest N" export.
        const bySha = new Map<string, ComparisonSource[]>();
        const registerSource = (source: ComparisonSource) => {
            if (source.kind !== 'gitRef' || !source.commitSha) {
                return;
            }
            const group = bySha.get(source.commitSha) || [];
            if (!group.some((existing) => existing.id === source.id)) {
                group.push(source);
            }
            bySha.set(source.commitSha, group);
        };
        timeline.forEach(registerSource);
        references.sources.forEach((source) => {
            if (source.kind === 'gitRef' && bySha.has(source.commitSha)) {
                registerSource(source);
            }
        });

        // The working copy is free: decorate the copy's own data.json.
        const payloadUrlBySourceId = new Map<string, string>();
        const itemCountBySourceId = new Map<string, number>();
        const workingCopySource = references.sources.find((source) => source.kind === 'workingCopy');
        const workingCopyEntries = await deps.readWorkingCopyPayload();
        if (workingCopySource && Array.isArray(workingCopyEntries)) {
            const decorated = decorateRevisionPayload(
                workingCopyEntries, options.targetType, options.targetPath, options.targetPath,
            );
            await fs.promises.writeFile(
                path.join(revisionsDir, WORKING_COPY_PAYLOAD_FILE),
                JSON.stringify(decorated, null, 2),
                'utf8',
            );
            payloadUrlBySourceId.set(workingCopySource.id, `./${GIT_REVISIONS_FOLDER}/${WORKING_COPY_PAYLOAD_FILE}`);
            itemCountBySourceId.set(workingCopySource.id, decorated.length);
        } else if (workingCopySource) {
            skippedRevisions.push({ id: workingCopySource.id, reason: 'The working copy data.json could not be read.' });
        }

        // The prepared store indexes all selected revisions and analyzes every
        // distinct Git blob/extension once. Assembly below remains
        // chronological so output naming and content-hash sharing never depend
        // on worker completion order.
        const fileByContentHash = new Map<string, string>();
        const uniqueShas = Array.from(bySha.keys());
        const total = uniqueShas.length;
        let completed = 0;
        let cancelled = false;
        if (total > 0) {
            try {
                const primarySources = uniqueShas.map((sha) => (bySha.get(sha) || [])[0]);
                preparedStore = await deps.prepareRevisionStore(primarySources);
            } catch (error) {
                if (options.token?.isCancellationRequested || String(error).includes('git-export-cancelled')) {
                    return {
                        cancelled: true,
                        failureReason: 'The git analysis was cancelled before enough revisions completed.',
                    };
                }
                throw error;
            }
        }

        for (const sha of uniqueShas) {
            if (options.token?.isCancellationRequested) {
                cancelled = true;
                break;
            }
            const group = bySha.get(sha) || [];
            const source = group[0];
            try {
                if (!preparedStore) {
                    throw new Error('git-revision-store-unavailable');
                }
                const prepared = await preparedStore.get(source);
                const decorated = decorateRevisionPayload(
                    Array.isArray(prepared.entries) ? prepared.entries : [],
                    options.targetType,
                    options.targetPath,
                    prepared.analyzedTargetPath,
                );
                const serialized = JSON.stringify(decorated, null, 2);
                const contentHash = crypto.createHash('sha1').update(serialized).digest('hex');
                let fileName = fileByContentHash.get(contentHash);
                if (!fileName) {
                    fileName = payloadFileNameForSha(sha);
                    await fs.promises.writeFile(path.join(revisionsDir, fileName), serialized, 'utf8');
                    fileByContentHash.set(contentHash, fileName);
                }
                for (const member of group) {
                    payloadUrlBySourceId.set(member.id, `./${GIT_REVISIONS_FOLDER}/${fileName}`);
                    itemCountBySourceId.set(member.id, decorated.length);
                }
            } catch (error) {
                for (const member of group) {
                    skippedRevisions.push({
                        id: member.id,
                        reason: error instanceof Error ? error.message : String(error),
                    });
                }
            }
            completed += 1;
            options.progress?.report({
                increment: 10 / Math.max(total, 1),
                message: `Building offline revision: ${completed}/${total}`
                    + ` · ${source?.label || sha.slice(0, 12)}`,
            });
        }

        const usableSources = references.sources
            .concat(timeline.filter((source) => !references.sources.some((ref) => ref.id === source.id)))
            .filter((source) => payloadUrlBySourceId.has(source.id));

        if (usableSources.length < 2) {
            return {
                cancelled,
                failureReason: cancelled
                    ? 'The git analysis was cancelled before enough revisions completed.'
                    : 'Fewer than two revisions could be analyzed, so offline comparisons are not possible.',
            };
        }

        const exportedTimeline = timeline.filter((source) => payloadUrlBySourceId.has(source.id));
        const endAnchor = workingCopySource && payloadUrlBySourceId.has(workingCopySource.id)
            ? workingCopySource
            : exportedTimeline[exportedTimeline.length - 1];
        // Mirror of the live suggestion: buildAutomaticTimeline + default sample.
        const suggested = sampleTimeline(exportedTimeline, EXPORT_DEFAULT_MAX_FRAMES, endAnchor);

        const gitData: ExportGitData = {
            references: {
                repositoryRoot: references.repositoryRoot,
                targetRelativePath: references.targetRelativePath,
                workingTreeDirty: references.workingTreeDirty,
                activeBranch: references.activeBranch,
                pageSize: references.pageSize,
                sources: usableSources.map((source) => ({
                    ...(source as unknown as Record<string, unknown>),
                    id: source.id,
                    payloadUrl: payloadUrlBySourceId.get(source.id) as string,
                    itemCount: itemCountBySourceId.get(source.id) || 0,
                })),
            },
            timelineSourceIds: exportedTimeline.map((source) => source.id)
                .concat(endAnchor && endAnchor.kind === 'workingCopy' ? [endAnchor.id] : []),
            suggestedSourceIds: suggested.map((source) => source.id),
            maxFrames: EXPORT_DEFAULT_MAX_FRAMES,
            workingCopyPayloadUrl: `./${GIT_REVISIONS_FOLDER}/${WORKING_COPY_PAYLOAD_FILE}`,
            timelineSelection: {
                kind: request.scope.kind,
                requestedCommitCount: request.scope.kind === 'latest'
                    ? request.scope.count
                    : null,
                selectedCommitCount: total,
                exportedCommitCount: exportedTimeline.length,
                exportedSourceCount: usableSources.length,
            },
            ...(preparedStore ? { pipelineStatistics: preparedStore.statistics } : {}),
            analyzedRevisionCount: exportedTimeline.length,
            ...(skippedRevisions.length ? { skippedRevisions } : {}),
            ...(cancelled || skippedRevisions.length ? { partial: true } : {}),
        };
        return { gitData, cancelled };
    } catch (error) {
        return {
            cancelled: false,
            failureReason: `The git revision export failed: ${error instanceof Error ? error.message : String(error)}`,
        };
    } finally {
        await preparedStore?.dispose().catch(() => undefined);
        await gitService.dispose();
    }
}
