import * as http from 'http';
import {
    CollaborationApplicationMessageContext,
    CollaborationMessage,
} from '../collaboration/collaborationRoomServer';
import {
    GitAnalysisSourceError,
    HistoricalComparisonRequest,
} from '../../../code_analysis/historical';
import { analysisRefreshCoordinator } from '../../../code_analysis/refresh';
import { SessionWatcherManager } from '../../../code_analysis/engine/watchers/sessionWatcherManager';
import { readJsonBody, sendErrorResponse, sendJsonResponse } from '../http/httpRespond';
import { AnalysisFeatureHost } from './analysisFeatureHost';

/**
 * Historical-comparison feature bridge: the LivePanel REST endpoints and the
 * collaboration-room messages that start comparisons. The service, the live
 * refresh debounce and the SSE notifiers live on the host.
 */
export class HistoricalComparisonBridge {
    constructor(private readonly host: AnalysisFeatureHost) {}

    /** The service lives on the host; null when the mode has no comparison. */
    private get historicalComparisonService() {
        return this.host.historicalComparisonService;
    }

    /**
     * LivePanel REST endpoint: availability + Git references (working copy,
     * branches, tags, commits) for the historical comparison panel. Reuses the
     * same session-bound HistoricalComparisonService the XR mode uses.
     */
    public async handleHistoricalReferences(
        req: http.IncomingMessage,
        res: http.ServerResponse,
    ): Promise<void> {
        if (req.method !== 'GET') {
            sendErrorResponse(res, 405, 'Method not allowed');
            return;
        }
        if (!this.historicalComparisonService) {
            sendErrorResponse(res, 404, 'Historical comparison is not available for this session.');
            return;
        }
        const availability = await this.historicalComparisonService.getAvailability();
        if (!availability.enabled) {
            sendJsonResponse(res, 200, { enabled: false, reason: availability.reason });
            return;
        }
        try {
            const references = await this.historicalComparisonService.getReferences();
            sendJsonResponse(res, 200, { enabled: true, reason: null, references });
        } catch (error) {
            sendErrorResponse(
                res,
                500,
                error instanceof Error ? error.message : 'Failed to list Git references.',
            );
        }
    }

    /**
     * LivePanel REST endpoint: start a historical comparison between two
     * sources. Responds 202 immediately; progress and the finished revision
     * are pushed over SSE (`historical-progress` / `historical-updated`), and
     * the client then fetches the /comparison/revision-N.json artifact.
     * A comparison with a working-copy side stays live: every incremental
     * re-analysis triggers a refresh (see the analysisUpdateEvents wiring).
     */
    public async handleHistoricalCompare(
        req: http.IncomingMessage,
        res: http.ServerResponse,
    ): Promise<void> {
        if (req.method !== 'POST') {
            sendErrorResponse(res, 405, 'Method not allowed');
            return;
        }
        if (!this.historicalComparisonService) {
            sendErrorResponse(res, 404, 'Historical comparison is not available for this session.');
            return;
        }
        if (this.historicalComparisonService.isBusy()) {
            sendErrorResponse(res, 409, 'A historical comparison is already running.');
            return;
        }
        let request: HistoricalComparisonRequest;
        try {
            const payload = await readJsonBody(req);
            request = {
                leftSourceId: String(payload.leftSourceId || ''),
                rightSourceId: String(payload.rightSourceId || ''),
            };
        } catch {
            sendErrorResponse(res, 400, 'Invalid request body');
            return;
        }
        sendJsonResponse(res, 202, { accepted: true });
        void (async () => {
            try {
                await SessionWatcherManager.reconcileSession(this.host.sessionId);
                const result = await this.historicalComparisonService!.compare(request, (progress) => {
                    this.host.notifyLivePanelHistoricalProgress(progress);
                });
                this.host.notifyLivePanelHistoricalUpdated(result.revision);
            } catch (error) {
                this.host.notifyLivePanelHistoricalProgress({
                    state: 'error',
                    message: error instanceof Error ? error.message : String(error),
                });
            }
        })();
    }

    public async handleHistoricalComparisonReferencesMessage(
        messageContext: CollaborationApplicationMessageContext,
    ): Promise<boolean> {
        if (!this.historicalComparisonService) {
            return false;
        }
        try {
            const references = await this.historicalComparisonService.getReferences();
            messageContext.send({
                type: 'historical-comparison-references',
                payload: references,
            });
        } catch (error) {
            messageContext.send({
                type: 'historical-comparison-error',
                payload: {
                    code: 'references-unavailable',
                    message: error instanceof Error ? error.message : String(error),
                },
            });
        }
        return true;
    }

    public handleHistoricalComparisonStartMessage(
        messageContext: CollaborationApplicationMessageContext,
        message: CollaborationMessage,
    ): boolean {
        if (!this.historicalComparisonService) {
            return false;
        }
        if (this.historicalComparisonService.isBusy()) {
            messageContext.send({
                type: 'historical-comparison-error',
                payload: {
                    code: 'comparison-busy',
                    message: 'Another historical comparison is already running.',
                },
            });
            return true;
        }
        const request: HistoricalComparisonRequest = {
            leftSourceId: String(message.payload?.leftSourceId || ''),
            rightSourceId: String(message.payload?.rightSourceId || ''),
        };
        analysisRefreshCoordinator.setRefreshEnabled(
            this.host.sessionId,
            'historical-compare',
            request.leftSourceId === 'working-copy' || request.rightSourceId === 'working-copy',
        );
        const currentView = this.host.getAnalysisViewState();
        if (currentView?.mode !== 'historical-compare') {
            this.host.changeAnalysisViewMode('historical-compare', 'historical.selection');
        }
        const operationView = currentView?.mode === 'historical-compare'
            ? currentView
            : this.host.getAnalysisViewState();
        const operationViewRevision = operationView?.viewRevision;
        void (async () => {
            try {
                await SessionWatcherManager.reconcileSession(
                    this.host.sessionId,
                );
                await analysisRefreshCoordinator.refreshMode(
                    this.host.sessionId,
                    'historical-compare',
                );
                const result = await this.historicalComparisonService!.compare(request, (progress) => {
                    messageContext.broadcast({
                        type: 'historical-comparison-progress',
                        payload: progress,
                    });
                });
                messageContext.upsertSharedEntity({
                    entityKind: 'historical-comparison',
                    entityId: 'main',
                    mode: 'historical-compare',
                    result,
                });
                analysisRefreshCoordinator.setSnapshotAvailable(
                    this.host.sessionId,
                    'historical-compare',
                    true,
                );
                if (operationViewRevision !== undefined) {
                    this.host.updateAnalysisViewIfCurrent(
                        'historical-compare',
                        operationViewRevision,
                        'historical.mapping',
                    );
                }
            } catch (error) {
                if (error instanceof GitAnalysisSourceError) {
                    await this.broadcastFilteredGitReferences(messageContext);
                }
                messageContext.broadcast({
                    type: 'historical-comparison-error',
                    payload: {
                        code: error instanceof GitAnalysisSourceError
                            ? error.code
                            : error instanceof Error
                                ? error.message
                                : 'comparison-failed',
                        message: error instanceof Error ? error.message : String(error),
                    },
                });
            }
        })();
        return true;
    }

    private async broadcastFilteredGitReferences(
        messageContext: CollaborationApplicationMessageContext,
    ): Promise<void> {
        const [historical, evolution] = await Promise.all([
            this.host.historicalComparisonService?.getReferences(),
            this.host.projectEvolutionService?.getReferences(),
        ]);
        if (historical) {
            messageContext.broadcast({
                type: 'historical-comparison-references',
                payload: historical,
            });
        }
        if (evolution) {
            messageContext.broadcast({
                type: 'project-evolution-references',
                payload: evolution,
            });
        }
    }
}
