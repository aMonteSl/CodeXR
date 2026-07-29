export type DependencyRelationKind =
    | 'import'
    | 'include'
    | 'require'
    | 'inheritance'
    | 'implementation'
    | 'call'
    | 'contains';

export type DependencyConfidence = 'exact' | 'probable' | 'ambiguous';
export type DependencyCapability = 'exact' | 'best-effort' | 'unsupported';
export type DependencyGraphLayout = 'force-3d' | 'hierarchical' | 'metric-space';
export type DependencySymbolKind =
    | 'module'
    | 'function'
    | 'method'
    | 'class'
    | 'interface'
    | 'trait'
    | 'struct'
    | 'record'
    | 'enum';

export type DependencyGraphScope =
    | { kind: 'directory'; relativePath: string }
    | { kind: 'file'; relativePath: string };
export type DependencyEdgeEncoding =
    | 'relation-type'
    | 'intensity-color'
    | 'intensity-width'
    | 'intensity-combined';

export interface DependencyNode {
    id: string;
    kind: 'file' | 'group' | 'external' | 'symbol';
    label: string;
    relativePath?: string;
    language?: string;
    symbolKind?: DependencySymbolKind;
    ownerId?: string;
    lineStart?: number;
    lineEnd?: number;
    external: boolean;
    metrics: Record<string, number | string>;
}

export interface DependencyEdge {
    id: string;
    source: string;
    target: string;
    kind: DependencyRelationKind;
    confidence: DependencyConfidence;
    occurrences: number;
}

export interface DependencyGraphDataset {
    schemaVersion: 1 | 2;
    revision: number;
    targetType?: 'file' | 'directory';
    targetRelativePath?: string;
    sourceRevision: number;
    nodes: DependencyNode[];
    edges: DependencyEdge[];
    warnings: string[];
    capabilities: Record<string, Record<DependencyRelationKind, DependencyCapability>>;
    generatedAt: string;
}

export interface DependencyRefreshRequest {
    sourceRevision: number;
    changedFiles: string[];
    addedFiles: string[];
    removedFiles: string[];
    forceFullScan?: boolean;
}

export interface DependencyGraphViewState {
    entityKind: 'dependency-graph';
    entityId: 'main';
    mode: 'dependency-graph' | 'single';
    status: 'idle' | 'analyzing' | 'ready' | 'error';
    message: string;
    datasetUrl: string | null;
    revision: number;
    layout: DependencyGraphLayout;
    showExternal: boolean;
    edgeEncoding: DependencyEdgeEncoding;
    relationFilters: Record<DependencyRelationKind, boolean>;
    mapping: Record<string, string>;
    scope: DependencyGraphScope;
}
