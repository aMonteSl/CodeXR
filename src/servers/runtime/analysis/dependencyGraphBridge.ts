import * as http from 'http';
import {
    CollaborationApplicationMessageContext,
    CollaborationMessage,
    CollaborationRoomServer,
} from '../collaboration/collaborationRoomServer';
import { AnalysisSourceChangeBatch, analysisRefreshCoordinator } from '../../../code_analysis/refresh';
import { readJsonBody, sendErrorResponse, sendJsonResponse } from '../http/httpRespond';
import { AnalysisFeatureHost } from './analysisFeatureHost';

/** Room access shared by every analysis bridge. */
export interface AnalysisBridgeRoomHooks {
    getRoom(): CollaborationRoomServer | null;
    getRoomId(): string;
}

/**
 * Dependency-graph feature bridge: the room messages that configure and start
 * the graph, the LivePanel REST summary, and the incremental refresh handler
 * the coordinator drives on every source change.
 */
export class DependencyGraphBridge {
    constructor(
        private readonly host: AnalysisFeatureHost,
        private readonly room: AnalysisBridgeRoomHooks,
    ) {
        this.host.setDependencyRefreshHandler((batch) => this.refreshDependencyGraph(batch));
    }

    /** The service lives on the host; null when the mode has no dependency graph. */
    private get dependencyGraphService() {
        return this.host.dependencyGraphService;
    }

    /**
     * LivePanel-only REST endpoint: generates/refreshes the dependency graph for the
     * active directory/project session and returns the raw dataset. Rankings, cycle
     * grouping, and breakdowns are derived client-side (see directoryAnalysismain.js).
     */
    public async handleDependencyGraphSummary(
        req: http.IncomingMessage,
        res: http.ServerResponse,
    ): Promise<void> {
        if (req.method !== 'POST') {
            sendErrorResponse(res, 405, 'Method not allowed');
            return;
        }
        if (!this.dependencyGraphService) {
            sendErrorResponse(res, 404, 'Dependency graph service is not available for this session.');
            return;
        }
        const availability = this.dependencyGraphService.getAvailability();
        if (!availability.enabled) {
            sendErrorResponse(res, 400, availability.reason || 'Dependency graph is not available.');
            return;
        }
        const scope = this.dependencyGraphService.getInitialScope();
        if (scope.kind !== 'directory') {
            sendErrorResponse(
                res,
                400,
                'Dependency graph summary is only available for directory or project LivePanel analyses.',
            );
            return;
        }
        if (this.dependencyGraphService.isBusy()) {
            sendErrorResponse(res, 409, 'A dependency analysis is already running.');
            return;
        }
        try {
            const dataset = await this.dependencyGraphService.analyze();
            sendJsonResponse(res, 200, dataset);
        } catch (error) {
            sendErrorResponse(
                res,
                500,
                error instanceof Error ? error.message : 'Dependency graph analysis failed.',
            );
        }
    }

    public handleDependencyGraphSettingsMessage(
        messageContext: CollaborationApplicationMessageContext,
        message: CollaborationMessage,
    ): boolean {
        const allowedLayouts = new Set(['force-3d', 'hierarchical', 'metric-space']);
        const allowedRelations = new Set([
            'import', 'include', 'require', 'inheritance', 'implementation', 'call', 'contains',
        ]);
        const allowedMetrics = new Set([
            'degree', 'fanIn', 'fanOut', 'totalLines', 'relationCount',
            'cycleSize', 'language',
        ]);
        const allowedEdgeEncodings = new Set([
            'relation-type', 'intensity-color', 'intensity-width', 'intensity-combined',
        ]);
        // Flow-particle preferences are room-shared; ids mirror the runtime's
        // FLOW_SIZE_OPTIONS / FLOW_SPEED_OPTIONS catalogues.
        const allowedFlowSizes = new Set(['s', 'm', 'l', 'xl']);
        const allowedFlowSpeeds = new Set(['x05', 'x1', 'x2', 'x3']);
        const payload = message.payload || {};
        const requestedScope = payload.scope && typeof payload.scope === 'object'
            ? payload.scope as Record<string, unknown>
            : null;
        const requestedRelativePath = typeof requestedScope?.relativePath === 'string'
            ? requestedScope.relativePath.replace(/\\/g, '/')
            : null;
        const scope = requestedScope
            && (requestedScope.kind === 'directory' || requestedScope.kind === 'file')
            && requestedRelativePath !== null
            && requestedRelativePath.length <= 1024
            && !requestedRelativePath.startsWith('/')
            && !requestedRelativePath.split('/').includes('..')
            ? {
                kind: requestedScope.kind,
                relativePath: requestedRelativePath,
            }
            : null;
        const relationFilters = Object.fromEntries(
            Object.entries(payload.relationFilters || {})
                .filter(([key, value]) => allowedRelations.has(key) && typeof value === 'boolean'),
        );
        const mapping = Object.fromEntries(
            Object.entries(payload.mapping || {})
                .filter(([, value]) => allowedMetrics.has(String(value))),
        );
        messageContext.upsertSharedEntity({
            entityKind: 'dependency-graph',
            entityId: 'main',
            ...(allowedLayouts.has(String(payload.layout)) ? { layout: payload.layout } : {}),
            ...(typeof payload.showExternal === 'boolean' ? { showExternal: payload.showExternal } : {}),
            ...(allowedEdgeEncodings.has(String(payload.edgeEncoding))
                ? { edgeEncoding: payload.edgeEncoding }
                : {}),
            ...(allowedFlowSizes.has(String(payload.flowSize)) ? { flowSize: payload.flowSize } : {}),
            ...(allowedFlowSpeeds.has(String(payload.flowSpeed)) ? { flowSpeed: payload.flowSpeed } : {}),
            ...(Object.keys(relationFilters).length ? { relationFilters } : {}),
            ...(Object.keys(mapping).length ? { mapping } : {}),
            ...(scope ? { scope } : {}),
        });
        return true;
    }

    public async handleDependencyFileScopeRequestMessage(
        messageContext: CollaborationApplicationMessageContext,
        message: CollaborationMessage,
    ): Promise<boolean> {
        if (!this.dependencyGraphService) {
            return false;
        }
        try {
            const relativePath = String(message.payload?.relativePath || '');
            const dataset = await this.dependencyGraphService.analyzeFileScope(
                relativePath,
                (progressMessage) => messageContext.send({
                    type: 'dependency-graph-progress',
                    payload: { message: progressMessage },
                }),
            );
            messageContext.upsertSharedEntity({
                entityKind: 'dependency-graph',
                entityId: 'main',
                mode: 'dependency-graph',
                status: 'ready',
                message: 'File dependency scope ready.',
                datasetUrl: `/dependencies/dependency-scope-${dataset.revision}.json`,
                revision: dataset.revision,
                scope: {
                    kind: 'file',
                    relativePath: dataset.targetRelativePath || relativePath,
                },
            });
        } catch (error) {
            messageContext.send({
                type: 'dependency-graph-error',
                payload: { message: error instanceof Error ? error.message : String(error) },
            });
        }
        return true;
    }

    public async handleDependencyGraphStartMessage(
        messageContext: CollaborationApplicationMessageContext,
        message: CollaborationMessage,
    ): Promise<boolean> {
        if (!this.dependencyGraphService) {
            // Answer instead of silently dropping: the scene shows the reason
            // and the extension host log names the misconfiguration.
            console.warn('[Code-XR Fix][Server] dependency-graph-start received but no dependency service is attached (mode:', this.host.analysisMode, ')');
            messageContext.send({
                type: 'dependency-graph-error',
                payload: { message: 'Dependency analysis is not attached to this analysis server.' },
            });
            return true;
        }
        const availability = this.dependencyGraphService.getAvailability();
        if (!availability.enabled) {
            messageContext.send({
                type: 'dependency-graph-error',
                payload: { message: availability.reason },
            });
            return true;
        }
        if (this.dependencyGraphService.isBusy()) {
            messageContext.send({
                type: 'dependency-graph-error',
                payload: { message: 'A dependency analysis is already running.' },
            });
            return true;
        }
        const existingDependencyState = this.room.getRoom()?.getServerEntity(
            this.room.getRoomId(),
            'dependency-graph',
            'main',
        );
        const hasCachedDataset = typeof existingDependencyState?.datasetUrl === 'string'
            && existingDependencyState.datasetUrl.length > 0;
        const forceFullRefresh = message.payload?.forceFull === true;
        console.log('[Code-XR Fix][Server] dependency-graph-start accepted (cached:', hasCachedDataset, ', forceFull:', forceFullRefresh, ')');
        analysisRefreshCoordinator.setSnapshotAvailable(
            this.host.sessionId,
            'dependency-graph',
            hasCachedDataset,
        );
        await this.host.activateAnalysisViewMode('dependency-graph', 'dependency.settings');
        messageContext.upsertSharedEntity({
            entityKind: 'dependency-graph',
            entityId: 'main',
            mode: 'dependency-graph',
            status: hasCachedDataset && !forceFullRefresh ? 'ready' : 'analyzing',
            message: hasCachedDataset && !forceFullRefresh
                ? 'Restoring dependency graph...'
                : 'Scanning project dependencies...',
            layout: existingDependencyState?.layout || 'force-3d',
            showExternal: typeof existingDependencyState?.showExternal === 'boolean'
                ? existingDependencyState.showExternal
                : false,
            edgeEncoding: existingDependencyState?.edgeEncoding || 'relation-type',
            flowSize: existingDependencyState?.flowSize || 'm',
            flowSpeed: existingDependencyState?.flowSpeed || 'x1',
            relationFilters: existingDependencyState?.relationFilters || {
                import: true,
                include: true,
                require: true,
                inheritance: true,
                implementation: true,
                call: false,
                contains: true,
            },
            mapping: existingDependencyState?.mapping || {
                size: 'degree',
                height: 'fanIn',
                color: 'language',
                x: 'fanOut',
                z: 'fanIn',
            },
            scope: existingDependencyState?.scope || {
                ...this.dependencyGraphService.getInitialScope(),
            },
        });
        if (!hasCachedDataset || forceFullRefresh) {
            console.log('[Code-XR Fix][Server] dependency-graph refresh requested for session', this.host.sessionId);
            analysisRefreshCoordinator.requestRefresh(
                this.host.sessionId,
                'dependency-graph',
            );
        }
        return true;
    }

    /**
     * Coordinator handler: incremental re-analysis from a source change batch,
     * republishing the room entity (re-deriving a file scope when the room is
     * scoped to one file) and pushing the LivePanel SSE update.
     */
    private async refreshDependencyGraph(batch: AnalysisSourceChangeBatch): Promise<void> {
        if (!this.dependencyGraphService) {
            return;
        }
        console.log('[Code-XR Fix][Server] dependency analysis starting (revision', batch.sourceRevision, ')');
        try {
            this.room.getRoom()?.upsertServerEntity(this.room.getRoomId(), {
                entityKind: 'dependency-graph',
                entityId: 'main',
                status: 'analyzing',
                message: 'Refreshing changed project dependencies...',
            });
            const dataset = await this.dependencyGraphService.analyze({
                sourceRevision: batch.sourceRevision,
                changedFiles: batch.changedFiles,
                addedFiles: batch.addedFiles,
                removedFiles: batch.removedFiles,
                forceFullScan: batch.forceRefresh || !this.dependencyGraphService.hasGeneratedDataset(),
            }, (message) => {
                this.room.getRoom()?.broadcastServerMessage(this.room.getRoomId(), {
                    type: 'dependency-graph-progress',
                    payload: { message },
                });
            });
            const currentEntity = this.room.getRoom()?.getServerEntity(
                this.room.getRoomId(),
                'dependency-graph',
                'main',
            );
            const currentScope = currentEntity?.scope && typeof currentEntity.scope === 'object'
                ? currentEntity.scope as Record<string, unknown>
                : null;
            if (
                dataset.targetType === 'directory'
                && currentScope?.kind === 'file'
                && typeof currentScope.relativePath === 'string'
            ) {
                const fileDataset = await this.dependencyGraphService.analyzeFileScope(
                    currentScope.relativePath,
                );
                this.room.getRoom()?.upsertServerEntity(this.room.getRoomId(), {
                    entityKind: 'dependency-graph',
                    entityId: 'main',
                    mode: 'dependency-graph',
                    status: 'ready',
                    message: 'File dependencies refreshed.',
                    datasetUrl: `/dependencies/dependency-scope-${fileDataset.revision}.json`,
                    projectDatasetUrl: `/dependencies/dependency-graph-${dataset.revision}.json`,
                    revision: fileDataset.revision,
                    sourceRevision: dataset.sourceRevision,
                    scope: {
                        kind: 'file',
                        relativePath: fileDataset.targetRelativePath || currentScope.relativePath,
                    },
                });
                return;
            }
            this.room.getRoom()?.upsertServerEntity(this.room.getRoomId(), {
                entityKind: 'dependency-graph',
                entityId: 'main',
                mode: 'dependency-graph',
                status: 'ready',
                message: 'Dependency graph refreshed.',
                datasetUrl: `/dependencies/dependency-graph-${dataset.revision}.json`,
                revision: dataset.revision,
                sourceRevision: dataset.sourceRevision,
            });
            this.host.notifyLivePanelDependencyUpdated(dataset.revision);
        } catch (error) {
            console.error('[Code-XR Fix][Server] dependency analysis failed:', error);
            this.room.getRoom()?.upsertServerEntity(this.room.getRoomId(), {
                entityKind: 'dependency-graph',
                entityId: 'main',
                status: 'error',
                message: error instanceof Error ? error.message : String(error),
            });
            this.room.getRoom()?.broadcastServerMessage(this.room.getRoomId(), {
                type: 'dependency-graph-error',
                payload: { message: error instanceof Error ? error.message : String(error) },
            });
            throw error;
        }
    }
}
