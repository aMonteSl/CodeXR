export type AnalysisTableMode =
    | 'selection'
    | 'single'
    | 'historical-compare'
    | 'project-evolution'
    | 'dependency-graph';

export type GitReferenceType = 'branch' | 'tag' | 'commit';
export type GitRevisionType = 'working-copy' | 'branch' | 'tag' | 'commit' | 'merge';

export type ComparisonSource =
    | {
        id: 'working-copy';
        kind: 'workingCopy';
        label: string;
        activeBranch: string | null;
        dirty: boolean;
        live: true;
        revisionType: GitRevisionType;
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
        revisionType: GitRevisionType;
        parentCount: number;
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
    revision?: number;
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
    revision: number;
}

export interface ProjectEvolutionRequest {
    mode: 'auto' | 'range' | 'manual';
    startSourceId: string;
    endSourceId: string;
    sourceIds: string[];
    maxFrames: number;
}

export interface ProjectEvolutionFrame {
    index: number;
    source: ComparisonSource;
    label: string;
    date: string;
    url: string;
    itemCount: number;
    missingTarget: boolean;
    warnings: string[];
}

export interface ProjectEvolutionResult {
    revision: number;
    mode: 'project-evolution';
    frames: ProjectEvolutionFrame[];
    generatedAt: string;
    manifestUrl: string;
    bridgeUrl: string;
}

export interface ProjectEvolutionReferences extends Omit<HistoricalComparisonReferences, 'activeRequest'> {
    activeRequest: ProjectEvolutionRequest | null;
    suggestedSourceIds: string[];
    maxFrames: number;
}

export interface ProjectEvolutionProgress {
    state: 'idle' | 'analyzing' | 'ready' | 'error';
    message: string;
    revision: number;
    frameIndex: number;
    frameCount: number;
}
