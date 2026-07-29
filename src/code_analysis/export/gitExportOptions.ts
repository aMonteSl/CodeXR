import * as os from 'os';

export type GitRevisionScope =
    | { kind: 'all' }
    | { kind: 'latest'; count: number };

export type GitExportPerformanceProfile = 'balanced' | 'maximum';

export interface GitRevisionExportRequest {
    scope: GitRevisionScope;
    performanceProfile: GitExportPerformanceProfile;
}

export interface GitExportWorkerPlan {
    profile: GitExportPerformanceProfile;
    workerCount: number;
    availableParallelism: number;
    freeMemoryBytes: number;
}

export interface GitExportSystemResources {
    availableParallelism: number;
    freeMemoryBytes: number;
}

const WORKER_MEMORY_BYTES = 128 * 1024 * 1024;
const MAXIMUM_WORKERS = 32;

export function readGitExportSystemResources(): GitExportSystemResources {
    const parallelism = typeof os.availableParallelism === 'function'
        ? os.availableParallelism()
        : os.cpus().length;
    return {
        availableParallelism: Math.max(1, Math.floor(parallelism || 1)),
        freeMemoryBytes: Math.max(WORKER_MEMORY_BYTES, os.freemem()),
    };
}

export function calculateGitExportWorkerPlan(
    profile: GitExportPerformanceProfile,
    resources: GitExportSystemResources = readGitExportSystemResources(),
): GitExportWorkerPlan {
    const availableParallelism = Math.max(1, Math.floor(resources.availableParallelism || 1));
    const freeMemoryBytes = Math.max(WORKER_MEMORY_BYTES, Math.floor(resources.freeMemoryBytes || 0));
    const memoryFraction = profile === 'maximum' ? 0.75 : 0.5;
    const memoryLimit = Math.max(
        1,
        Math.floor((freeMemoryBytes * memoryFraction) / WORKER_MEMORY_BYTES),
    );
    const cpuLimit = profile === 'maximum'
        ? Math.min(MAXIMUM_WORKERS, availableParallelism * 3)
        : Math.max(1, Math.floor(availableParallelism * 0.75));
    return {
        profile,
        workerCount: Math.max(1, Math.min(cpuLimit, memoryLimit)),
        availableParallelism,
        freeMemoryBytes,
    };
}

export function validateGitRevisionScope(
    scope: GitRevisionScope,
    availableCommitCount: number,
): GitRevisionScope {
    const total = Math.max(0, Math.floor(availableCommitCount));
    if (scope.kind === 'all') {
        return scope;
    }
    const count = Math.floor(scope.count);
    if (!Number.isFinite(count) || count < 1 || count > total) {
        throw new Error(`The revision count must be between 1 and ${total}.`);
    }
    return { kind: 'latest', count };
}

export function revisionLimitForScope(scope: GitRevisionScope): number | null {
    return scope.kind === 'latest' ? scope.count : null;
}
