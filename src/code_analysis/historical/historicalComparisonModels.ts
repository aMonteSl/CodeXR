export type AnalysisTableMode =
    | 'selection'
    | 'single'
    | 'historical-compare'
    | 'dependency-graph';

export type GitReferenceType = 'branch' | 'tag' | 'commit';

export type ComparisonSource =
    | {
        id: 'working-copy';
        kind: 'workingCopy';
        label: string;
        activeBranch: string | null;
        dirty: boolean;
        live: true;
    }
    | {
        id: string;
        kind: 'gitRef';
        refType: GitReferenceType;
        refName: string;
        commitSha: string;
        label: string;
        description?: string;
        live: false;
    };

export interface HistoricalComparisonRequest {
    leftSourceId: string;
    rightSourceId: string;
}

export interface ComparisonDataset {
    source: ComparisonSource;
    url: string;
    itemCount: number;
    missingTarget: boolean;
    warnings: string[];
}

export interface ComparisonMetricDelta {
    metric: string;
    left: number;
    right: number;
    delta: number;
}

export interface ComparisonDeltaSummary {
    added: number;
    removed: number;
    modified: number;
    unchanged: number;
    metrics: ComparisonMetricDelta[];
}

export interface HistoricalComparisonResult {
    revision: number;
    mode: 'historical-compare';
    left: ComparisonDataset;
    right: ComparisonDataset;
    delta: ComparisonDeltaSummary;
    generatedAt: string;
}

export interface HistoricalComparisonReferences {
    repositoryRoot: string;
    targetRelativePath: string;
    workingTreeDirty: boolean;
    activeBranch: string | null;
    sources: ComparisonSource[];
    pageSize: number;
    activeRequest?: HistoricalComparisonRequest | null;
}

export interface HistoricalComparisonProgress {
    state: 'idle' | 'analyzing' | 'ready' | 'error';
    message: string;
    revision?: number;
}
