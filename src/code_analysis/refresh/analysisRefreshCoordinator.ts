export type AnalysisRefreshMode = 'single' | 'historical-compare' | 'project-evolution' | 'dependency-graph';
export type AnalysisViewMode = AnalysisRefreshMode | 'selection';

export interface AnalysisSourceChangeBatch {
    sessionId: string;
    sourceRevision: number;
    changedFiles: string[];
    addedFiles: string[];
    removedFiles: string[];
    forceRefresh: boolean;
}

export interface AnalysisViewState {
    [key: string]: unknown;
    entityKind: 'analysis-view';
    entityId: 'main';
    mode: AnalysisViewMode;
    controllerView: string;
    status: 'selecting' | 'loading' | 'updating' | 'ready' | 'error';
    hasUsableSnapshot: boolean;
    sourceRevision: number;
    appliedRevision: Partial<Record<AnalysisRefreshMode, number>>;
    modeRevision: Record<AnalysisRefreshMode, number>;
}

type RefreshHandler = (batch: AnalysisSourceChangeBatch) => Promise<void>;
type PathChangeKind = 'changed' | 'added' | 'removed';

interface SessionRefreshState {
    activeMode: AnalysisViewMode;
    controllerView: string;
    sourceRevision: number;
    appliedRevision: Record<AnalysisRefreshMode, number>;
    modeRevision: Record<AnalysisRefreshMode, number>;
    snapshotAvailable: Record<AnalysisRefreshMode, boolean>;
    errors: Partial<Record<AnalysisRefreshMode, string>>;
    pending: Record<AnalysisRefreshMode, Map<string, PathChangeKind>>;
    handlers: Partial<Record<AnalysisRefreshMode, RefreshHandler>>;
    running: Partial<Record<AnalysisRefreshMode, Promise<void>>>;
    rerunRequested: Set<AnalysisRefreshMode>;
    stateListeners: Set<(state: AnalysisViewState) => void>;
    refreshEnabled: Record<AnalysisRefreshMode, boolean>;
    // Modes that refresh on every source change even while another mode is active
    // (e.g. LivePanel keeps its dependency graph in lockstep with the classic view).
    backgroundModes: Set<AnalysisRefreshMode>;
}

const MODES: AnalysisRefreshMode[] = ['single', 'historical-compare', 'project-evolution', 'dependency-graph'];

function defaultControllerView(mode: AnalysisViewMode): string {
    switch (mode) {
        case 'selection':
            return 'visualization-menu';
        case 'single':
            return 'single.mapping';
        case 'dependency-graph':
            return 'dependency.settings';
        case 'historical-compare':
            return 'historical.selection';
        case 'project-evolution':
            return 'project-evolution';
        default:
            return 'single.mapping';
    }
}

function emptyPending(): Record<AnalysisRefreshMode, Map<string, PathChangeKind>> {
        return {
            single: new Map(),
            'historical-compare': new Map(),
            'project-evolution': new Map(),
            'dependency-graph': new Map(),
        };
}

export class AnalysisRefreshCoordinator {
    private static readonly instance = new AnalysisRefreshCoordinator();
    private readonly sessions = new Map<string, SessionRefreshState>();

    public static getInstance(): AnalysisRefreshCoordinator {
        return AnalysisRefreshCoordinator.instance;
    }

    public registerHandler(
        sessionId: string,
        mode: AnalysisRefreshMode,
        handler: RefreshHandler,
    ): () => void {
        const state = this.getOrCreateState(sessionId);
        state.handlers[mode] = handler;
        void this.runIfNeeded(sessionId, mode);
        return () => {
            const current = this.sessions.get(sessionId);
            if (current?.handlers[mode] === handler) {
                delete current.handlers[mode];
            }
        };
    }

    public onStateChanged(
        sessionId: string,
        listener: (state: AnalysisViewState) => void,
    ): () => void {
        const state = this.getOrCreateState(sessionId);
        state.stateListeners.add(listener);
        return () => state.stateListeners.delete(listener);
    }

    public publishChanges(
        sessionId: string,
        changes: Omit<AnalysisSourceChangeBatch, 'sessionId' | 'sourceRevision' | 'forceRefresh'>,
    ): number {
        const state = this.getOrCreateState(sessionId);
        state.sourceRevision += 1;
        for (const mode of MODES) {
            this.mergeChanges(state.pending[mode], changes);
        }
        this.emitState(sessionId, state);
        if (state.activeMode !== 'selection') {
            void this.runIfNeeded(sessionId, state.activeMode);
        }
        // Background modes refresh on every change regardless of the active view.
        for (const backgroundMode of state.backgroundModes) {
            if (backgroundMode !== state.activeMode) {
                void this.runIfNeeded(sessionId, backgroundMode, false, true);
            }
        }
        return state.sourceRevision;
    }

    /**
     * Mark a mode as a background refresh: it recomputes on every source change
     * even when it is not the active view. Used by LivePanel so its dependency
     * summary stays in lockstep with the classic (incremental) re-analysis.
     */
    public setBackgroundRefresh(
        sessionId: string,
        mode: AnalysisRefreshMode,
        enabled: boolean,
    ): void {
        const state = this.getOrCreateState(sessionId);
        if (enabled) {
            state.backgroundModes.add(mode);
        } else {
            state.backgroundModes.delete(mode);
        }
    }

    public setActiveMode(
        sessionId: string,
        mode: AnalysisViewMode,
        controllerView: string,
    ): AnalysisViewState {
        const state = this.getOrCreateState(sessionId);
        state.activeMode = mode;
        state.controllerView = controllerView || defaultControllerView(mode);
        this.emitState(sessionId, state);
        if (mode !== 'selection') {
            void this.runIfNeeded(sessionId, mode);
        }
        return this.getViewState(sessionId);
    }

    public activateMode(
        sessionId: string,
        mode: AnalysisRefreshMode,
        controllerView: string,
    ): AnalysisViewState {
        return this.setActiveMode(sessionId, mode, controllerView);
    }

    public requestRefresh(sessionId: string, mode?: AnalysisRefreshMode): void {
        const state = this.getOrCreateState(sessionId);
        const requestedMode = mode || (state.activeMode === 'selection' ? null : state.activeMode);
        if (!requestedMode) {
            return;
        }
        if (state.running[requestedMode]) {
            return;
        }
        state.appliedRevision[requestedMode] = Math.min(
            state.appliedRevision[requestedMode],
            state.sourceRevision - 1,
        );
        void this.runIfNeeded(sessionId, requestedMode, true);
    }

    public async refreshMode(sessionId: string, mode: AnalysisRefreshMode): Promise<void> {
        await this.runIfNeeded(sessionId, mode, false, true);
    }

    public async forceRefreshMode(sessionId: string, mode: AnalysisRefreshMode): Promise<void> {
        await this.runIfNeeded(sessionId, mode, true);
    }

    public setSnapshotAvailable(
        sessionId: string,
        mode: AnalysisRefreshMode,
        available: boolean,
    ): void {
        const state = this.getOrCreateState(sessionId);
        state.snapshotAvailable[mode] = available;
        if (available) {
            delete state.errors[mode];
        }
        this.emitState(sessionId, state);
    }

    public setRefreshEnabled(
        sessionId: string,
        mode: AnalysisRefreshMode,
        enabled: boolean,
    ): void {
        const state = this.getOrCreateState(sessionId);
        state.refreshEnabled[mode] = enabled;
        if (enabled && state.activeMode === mode) {
            void this.runIfNeeded(sessionId, mode);
        }
    }

    public getViewState(sessionId: string): AnalysisViewState {
        const state = this.getOrCreateState(sessionId);
        const refreshMode = state.activeMode === 'selection' ? null : state.activeMode;
        const hasUsableSnapshot = refreshMode
            ? state.snapshotAvailable[refreshMode]
            : false;
        let status: AnalysisViewState['status'];
        if (!refreshMode) {
            status = 'selecting';
        } else if (state.errors[refreshMode]) {
            status = 'error';
        } else if (state.running[refreshMode] || this.needsRefresh(state, refreshMode)) {
            status = hasUsableSnapshot ? 'updating' : 'loading';
        } else {
            status = hasUsableSnapshot ? 'ready' : 'loading';
        }
        return {
            entityKind: 'analysis-view',
            entityId: 'main',
            mode: state.activeMode,
            controllerView: state.controllerView || defaultControllerView(state.activeMode),
            status,
            hasUsableSnapshot,
            sourceRevision: state.sourceRevision,
            appliedRevision: { ...state.appliedRevision },
            modeRevision: { ...state.modeRevision },
        };
    }

    public disposeSession(sessionId: string): void {
        this.sessions.delete(sessionId);
    }

    private getOrCreateState(sessionId: string): SessionRefreshState {
        let state = this.sessions.get(sessionId);
        if (!state) {
            state = {
                activeMode: 'single',
                controllerView: 'single.mapping',
                sourceRevision: 0,
                appliedRevision: {
                    single: 0,
                    'historical-compare': 0,
                    'project-evolution': 0,
                    'dependency-graph': 0,
                },
                modeRevision: {
                    single: 0,
                    'historical-compare': 0,
                    'project-evolution': 0,
                    'dependency-graph': 0,
                },
                snapshotAvailable: {
                    single: true,
                    'historical-compare': false,
                    'project-evolution': false,
                    'dependency-graph': false,
                },
                errors: {},
                pending: emptyPending(),
                handlers: {},
                running: {},
                rerunRequested: new Set(),
                stateListeners: new Set(),
                refreshEnabled: {
                    single: true,
                    'historical-compare': true,
                    'project-evolution': true,
                    'dependency-graph': true,
                },
                backgroundModes: new Set(),
            };
            this.sessions.set(sessionId, state);
        }
        return state;
    }

    private emitState(sessionId: string, state: SessionRefreshState): void {
        const snapshot = this.getViewState(sessionId);
        for (const listener of state.stateListeners) {
            listener(snapshot);
        }
    }

    private mergeChanges(
        target: Map<string, PathChangeKind>,
        changes: Pick<AnalysisSourceChangeBatch, 'changedFiles' | 'addedFiles' | 'removedFiles'>,
    ): void {
        for (const filePath of changes.changedFiles) {
            const previous = target.get(filePath);
            if (previous !== 'added' && previous !== 'removed') {
                target.set(filePath, 'changed');
            }
        }
        for (const filePath of changes.addedFiles) {
            const previous = target.get(filePath);
            target.set(filePath, previous === 'removed' ? 'changed' : 'added');
        }
        for (const filePath of changes.removedFiles) {
            const previous = target.get(filePath);
            if (previous === 'added') {
                target.delete(filePath);
            } else {
                target.set(filePath, 'removed');
            }
        }
    }

    private async runIfNeeded(
        sessionId: string,
        mode: AnalysisRefreshMode,
        force = false,
        allowInactive = false,
    ): Promise<void> {
        const state = this.sessions.get(sessionId);
        const handler = state?.handlers[mode];
        if (
            !state
            || !handler
            || !state.refreshEnabled[mode]
            || (!force && !allowInactive && state.activeMode !== mode)
        ) {
            return;
        }
        if (state.running[mode]) {
            state.rerunRequested.add(mode);
            return;
        }

        const pending = state.pending[mode];
        const hasPendingChanges = pending.size > 0;
        if (!force && !hasPendingChanges && state.appliedRevision[mode] >= state.sourceRevision) {
            return;
        }

        const consumed = new Map(pending);
        pending.clear();
        const targetRevision = state.sourceRevision;
        const batch = this.toBatch(sessionId, targetRevision, consumed, force);
        const job = handler(batch);
        state.running[mode] = job;
        delete state.errors[mode];
        this.emitState(sessionId, state);
        let succeeded = false;
        try {
            await job;
            state.appliedRevision[mode] = Math.max(state.appliedRevision[mode], targetRevision);
            state.modeRevision[mode] += 1;
            state.snapshotAvailable[mode] = true;
            succeeded = true;
        } catch (error) {
            this.mergeChanges(pending, batch);
            state.errors[mode] = error instanceof Error ? error.message : String(error);
            console.error(`[CodeXR][RefreshCoordinator] ${mode} refresh failed:`, error);
        } finally {
            delete state.running[mode];
            this.emitState(sessionId, state);
            const rerun = state.rerunRequested.delete(mode);
            if (succeeded && (rerun || pending.size > 0 || state.appliedRevision[mode] < state.sourceRevision)) {
                void this.runIfNeeded(sessionId, mode);
            }
        }
    }

    private needsRefresh(state: SessionRefreshState, mode: AnalysisRefreshMode): boolean {
        return state.pending[mode].size > 0 || state.appliedRevision[mode] < state.sourceRevision;
    }

    private toBatch(
        sessionId: string,
        sourceRevision: number,
        changes: Map<string, PathChangeKind>,
        forceRefresh: boolean,
    ): AnalysisSourceChangeBatch {
        const batch: AnalysisSourceChangeBatch = {
            sessionId,
            sourceRevision,
            changedFiles: [],
            addedFiles: [],
            removedFiles: [],
            forceRefresh,
        };
        for (const [filePath, kind] of changes) {
            if (kind === 'added') {
                batch.addedFiles.push(filePath);
            } else if (kind === 'removed') {
                batch.removedFiles.push(filePath);
            } else {
                batch.changedFiles.push(filePath);
            }
        }
        return batch;
    }
}

export const analysisRefreshCoordinator = AnalysisRefreshCoordinator.getInstance();
