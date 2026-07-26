import * as vscode from 'vscode';
import { sseManager } from '../sse/SSEManager';
import { fileToServerMap } from '../../../utils/fileToServerMap';
import { CollaborationRoomServer } from '../collaboration/collaborationRoomServer';
import {
    HistoricalComparisonProgress,
    HistoricalComparisonService,
    ProjectEvolutionService,
    analysisUpdateEvents,
} from '../../../code_analysis/historical';
import { DependencyGraphService } from '../../../code_analysis/dependencies';
import {
    AnalysisSourceChangeBatch,
    AnalysisViewMode,
    analysisRefreshCoordinator,
} from '../../../code_analysis/refresh';
import { SessionWatcherManager } from '../../../code_analysis/engine/watchers/sessionWatcherManager';
import { UnifiedSessionRegistry } from '../../../code_analysis/engine/core/sessionRegistry';
import { resolveAnalysisServerCapabilities } from '../analysisServerCapabilities';
import { AnalysisAvailabilitySnapshot } from '../collaboration/collaborationSessionApi';

/** The slice of the server configuration the analysis features run on. */
export interface AnalysisFeatureHostConfig {
    extensionContext?: vscode.ExtensionContext;
    analysisSessionId?: string;
    staticRoot?: string;
    port: number;
}

/** Late-bound collaboration-room access, provided by the owning server. */
export interface AnalysisRoomHooks {
    getRoom(): CollaborationRoomServer | null;
    getRoomId(): string;
}

/**
 * Owns the per-session analysis feature services (dependency graph, historical
 * comparison, project evolution), their refresh-coordinator wiring, and the
 * LivePanel SSE delivery. Message and REST handling live in the sibling
 * bridge modules; this host is their shared context.
 */
export class AnalysisFeatureHost {
    public analysisMode: string | undefined;
    public dependencyGraphService: DependencyGraphService | null = null;
    public historicalComparisonService: HistoricalComparisonService | null = null;
    public projectEvolutionService: ProjectEvolutionService | null = null;

    private analysisUpdateSubscription: (() => void) | null = null;
    private historicalRefreshTimer: NodeJS.Timeout | null = null;
    private historicalRefreshQueued = false;
    private refreshCoordinatorDisposables: Array<() => void> = [];
    private dependencyRefreshHandler: (batch: AnalysisSourceChangeBatch) => Promise<void> =
        async () => undefined;

    constructor(
        private readonly config: AnalysisFeatureHostConfig,
        private readonly hooks: AnalysisRoomHooks,
    ) {
        if (this.config.extensionContext && this.config.analysisSessionId && this.config.staticRoot) {
            // Every analysis mode shares this launch path; a mode's declared
            // capabilities decide which optional feature services get attached.
            // XR-only services throw for non-XR sessions, so gating construction
            // here is what lets LivePanel/DOM/future modes launch successfully.
            const session = UnifiedSessionRegistry
                .getInstance(this.config.extensionContext)
                .getSession(this.config.analysisSessionId);
            this.analysisMode = session?.analysisMode;
            const capabilities = resolveAnalysisServerCapabilities(session?.analysisMode);

            if (capabilities.dependencyGraph) {
                this.dependencyGraphService = new DependencyGraphService(
                    this.config.extensionContext,
                    this.config.analysisSessionId,
                    this.config.staticRoot,
                );
                this.refreshCoordinatorDisposables.push(
                    analysisRefreshCoordinator.registerHandler(
                        this.config.analysisSessionId,
                        'dependency-graph',
                        (batch) => this.dependencyRefreshHandler(batch),
                    ),
                );

                if (this.analysisMode === 'LivePanel') {
                    // The LivePanel dependency summary (file and directory sessions —
                    // the service resolves the project root for file targets) shows
                    // every metric at once, so it must stay in lockstep with the
                    // classic re-analysis: recompute on every source change (incrementally,
                    // changed files only) and seed the initial dataset now. The result is
                    // pushed to the panel over SSE by refreshDependencyGraph().
                    const livePanelSessionId = this.config.analysisSessionId;
                    analysisRefreshCoordinator.setBackgroundRefresh(livePanelSessionId, 'dependency-graph', true);
                    this.refreshCoordinatorDisposables.push(
                        () => analysisRefreshCoordinator.setBackgroundRefresh(livePanelSessionId, 'dependency-graph', false),
                    );
                    void analysisRefreshCoordinator.forceRefreshMode(livePanelSessionId, 'dependency-graph');
                }
            }

            if (capabilities.historicalComparison) {
                this.historicalComparisonService = new HistoricalComparisonService(
                    this.config.extensionContext,
                    this.config.analysisSessionId,
                    this.config.staticRoot,
                );
                this.analysisUpdateSubscription = analysisUpdateEvents.on((event) => {
                    if (event.sessionId !== this.config.analysisSessionId) {
                        return;
                    }
                    if (this.analysisMode === 'LivePanel') {
                        // LivePanel has no XR view modes: refresh whenever an open
                        // comparison has a working-copy side (the schedule itself
                        // no-ops otherwise) and push the result over SSE.
                        this.scheduleHistoricalComparisonRefresh();
                        return;
                    }
                    const view = analysisRefreshCoordinator.getViewState(event.sessionId);
                    if (view.mode === 'historical-compare') {
                        this.scheduleHistoricalComparisonRefresh();
                    }
                });
            }

            if (capabilities.projectEvolution) {
                this.projectEvolutionService = new ProjectEvolutionService(
                    this.config.extensionContext,
                    this.config.analysisSessionId,
                    this.config.staticRoot,
                );
            }

            // Shared by every session-bound mode: publish analysis view-state
            // changes over the collaboration channel (no-op without a room).
            this.refreshCoordinatorDisposables.push(
                analysisRefreshCoordinator.onStateChanged(
                    this.config.analysisSessionId,
                    () => this.publishAnalysisViewState(),
                ),
            );
        }
    }

    /** Session id, valid whenever any feature service exists. */
    public get sessionId(): string {
        return this.config.analysisSessionId!;
    }

    public get hasSession(): boolean {
        return !!this.config.analysisSessionId;
    }

    /**
     * The dependency refresh work is implemented by the dependency bridge; it
     * registers here once constructed. Coordinator events cannot fire before
     * the owning server finishes constructing, so the late binding is safe.
     */
    public setDependencyRefreshHandler(
        handler: (batch: AnalysisSourceChangeBatch) => Promise<void>,
    ): void {
        this.dependencyRefreshHandler = handler;
    }

    /** Feature availability, as reported in the collaboration descriptor. */
    public async getAnalysisAvailability(): Promise<AnalysisAvailabilitySnapshot> {
        return {
            historicalComparison: this.historicalComparisonService
                ? await this.historicalComparisonService.getAvailability()
                : {
                    enabled: false,
                    reason: 'Historical comparison is not available for this server.',
                },
            projectEvolution: this.projectEvolutionService
                ? await this.projectEvolutionService.getAvailability()
                : {
                    enabled: false,
                    reason: 'Project evolution is not available for this server.',
                },
            dependencyGraph: this.dependencyGraphService?.getAvailability() || {
                enabled: false,
                reason: 'Dependency analysis is not available for this server.',
            },
        };
    }

    public setAnalysisViewMode(mode: AnalysisViewMode, controllerView: string): void {
        if (!this.config.analysisSessionId) {
            return;
        }
        analysisRefreshCoordinator.setActiveMode(this.config.analysisSessionId, mode, controllerView);
    }

    public async activateAnalysisViewMode(
        mode: Exclude<AnalysisViewMode, 'selection'>,
        controllerView: string,
    ): Promise<void> {
        if (!this.config.analysisSessionId) {
            return;
        }
        analysisRefreshCoordinator.activateMode(this.config.analysisSessionId, mode, controllerView);
        // Watcher reconciliation must never gate the collaboration reply: a
        // slow or stuck reconcile left dependency-graph-start unanswered
        // (total silence in the scene) while historical — which does not
        // await it — kept working. Run it in the background and log failures.
        void SessionWatcherManager.reconcileSession(this.config.analysisSessionId).catch((error) => {
            console.warn('[Code-XR Fix][Server] Session watcher reconciliation failed:', error);
        });
    }

    public publishAnalysisViewState(): void {
        if (!this.config.analysisSessionId || !this.hooks.getRoom()) {
            return;
        }
        this.hooks.getRoom()!.upsertServerEntity(
            this.hooks.getRoomId(),
            analysisRefreshCoordinator.getViewState(this.config.analysisSessionId),
        );
    }

    public scheduleHistoricalComparisonRefresh(): void {
        if (!this.historicalComparisonService?.hasLiveSource()) {
            return;
        }
        this.historicalRefreshQueued = true;
        if (this.historicalRefreshTimer) {
            clearTimeout(this.historicalRefreshTimer);
        }
        this.historicalRefreshTimer = setTimeout(() => {
            this.historicalRefreshTimer = null;
            void this.refreshHistoricalComparison();
        }, 350);
    }

    private async refreshHistoricalComparison(): Promise<void> {
        if (!this.historicalComparisonService || !this.historicalRefreshQueued) {
            return;
        }
        this.historicalRefreshQueued = false;
        if (this.historicalComparisonService.isBusy()) {
            this.scheduleHistoricalComparisonRefresh();
            return;
        }
        try {
            const result = await this.historicalComparisonService.refreshActiveComparison((progress) => {
                this.hooks.getRoom()?.broadcastServerMessage(this.hooks.getRoomId(), {
                    type: 'historical-comparison-progress',
                    payload: progress,
                });
            });
            if (result) {
                this.hooks.getRoom()?.upsertServerEntity(this.hooks.getRoomId(), {
                    entityKind: 'historical-comparison',
                    entityId: 'main',
                    mode: 'historical-compare',
                    result,
                });
                this.notifyLivePanelHistoricalUpdated(result.revision);
            }
        } catch (error) {
            console.error('[CodeXR][HistoricalComparison] Live refresh failed:', error);
            this.scheduleHistoricalComparisonRefresh();
        }
    }

    public notifyLivePanelHistoricalProgress(progress: HistoricalComparisonProgress): void {
        const fileUri = this.getLivePanelSseTarget();
        if (!fileUri) {
            return;
        }
        sseManager.sendCustomMessage(fileUri, {
            type: 'historical-progress',
            sessionId: this.config.analysisSessionId,
            state: progress.state,
            message: progress.message,
            revision: progress.revision,
        });
    }

    public notifyLivePanelHistoricalUpdated(revision?: number): void {
        const fileUri = this.getLivePanelSseTarget();
        if (!fileUri) {
            return;
        }
        sseManager.sendCustomMessage(fileUri, {
            type: 'historical-updated',
            sessionId: this.config.analysisSessionId,
            revision,
        });
    }

    /**
     * LivePanel pages have no collaboration room; feature updates reach them
     * over SSE, keyed by the analysis file this server serves. Returns null
     * for every other mode so the notify helpers are safe to call anywhere.
     */
    private getLivePanelSseTarget(): string | null {
        if (this.analysisMode !== 'LivePanel') {
            return null;
        }
        return fileToServerMap.findFileByPort(this.config.port);
    }

    public notifyLivePanelDependencyUpdated(revision: number): void {
        // Delivered over SSE so the page reloads the freshly written
        // dependency-graph.json (see getLivePanelSseTarget).
        const fileUri = this.getLivePanelSseTarget();
        if (!fileUri) {
            return;
        }
        sseManager.sendCustomMessage(fileUri, {
            type: 'dependency-updated',
            sessionId: this.config.analysisSessionId,
            revision,
        });
    }

    /** Tear down subscriptions, timers and the feature services. */
    public dispose(): void {
        this.analysisUpdateSubscription?.();
        this.analysisUpdateSubscription = null;
        if (this.historicalRefreshTimer) {
            clearTimeout(this.historicalRefreshTimer);
            this.historicalRefreshTimer = null;
        }
        for (const dispose of this.refreshCoordinatorDisposables.splice(0)) {
            dispose();
        }
        if (this.config.analysisSessionId) {
            analysisRefreshCoordinator.disposeSession(this.config.analysisSessionId);
        }
        void this.historicalComparisonService?.dispose();
        this.historicalComparisonService = null;
        void this.projectEvolutionService?.dispose();
        this.projectEvolutionService = null;
        void this.dependencyGraphService?.dispose();
        this.dependencyGraphService = null;
    }
}
