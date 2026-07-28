import {
    CollaborationApplicationMessageContext,
    CollaborationMessage,
    CollaborationRoomServer,
} from '../collaboration/collaborationRoomServer';
import { AnalysisViewMode, analysisRefreshCoordinator } from '../../../code_analysis/refresh';
import { AnalysisFeatureHost } from './analysisFeatureHost';
import { DependencyGraphBridge } from './dependencyGraphBridge';
import { HistoricalComparisonBridge } from './historicalComparisonBridge';
import { ProjectEvolutionBridge } from './projectEvolutionBridge';

/** Room access the mode-activation handler needs to probe cached snapshots. */
export interface AnalysisRouterRoomHooks {
    getRoom(): CollaborationRoomServer | null;
    getRoomId(): string;
}

/**
 * Dispatches collaboration room application messages to their feature
 * bridge. The guard order is part of the contract: analysis-mode and
 * dependency-graph messages are always considered, while historical and
 * project-evolution messages require the historical comparison service
 * to be attached to this server.
 */
export class AnalysisMessageRouter {
    constructor(
        private readonly host: AnalysisFeatureHost,
        private readonly dependencyGraph: DependencyGraphBridge,
        private readonly historicalComparison: HistoricalComparisonBridge,
        private readonly projectEvolution: ProjectEvolutionBridge,
        private readonly room: AnalysisRouterRoomHooks,
    ) {}

    private get historicalComparisonService() {
        return this.host.historicalComparisonService;
    }

    private get projectEvolutionService() {
        return this.host.projectEvolutionService;
    }

    public async handleCollaborationMessage(
        messageContext: CollaborationApplicationMessageContext,
        message: CollaborationMessage,
    ): Promise<boolean> {
        if (message.type === 'analysis-mode-selection') {
            this.host.setAnalysisViewMode('selection', 'visualization-menu');
            return true;
        }
        if (message.type === 'analysis-mode-activate') {
            return this.handleAnalysisModeActivateMessage(message);
        }
        if (message.type === 'dependency-graph-settings') {
            return this.dependencyGraph.handleDependencyGraphSettingsMessage(messageContext, message);
        }
        if (message.type === 'dependency-file-scope-request') {
            return this.dependencyGraph.handleDependencyFileScopeRequestMessage(messageContext, message);
        }
        if (message.type === 'dependency-graph-start') {
            console.log('[Code-XR Fix][Server] dependency-graph-start received (room:', messageContext.roomId, ')');
            return this.dependencyGraph.handleDependencyGraphStartMessage(messageContext, message);
        }
        if (!this.historicalComparisonService) {
            return false;
        }
        if (message.type === 'historical-comparison-references-request') {
            return this.historicalComparison.handleHistoricalComparisonReferencesMessage(messageContext);
        }
        if (message.type === 'historical-comparison-start') {
            return this.historicalComparison.handleHistoricalComparisonStartMessage(messageContext, message);
        }
        if (this.projectEvolutionService && message.type === 'project-evolution-references-request') {
            return this.projectEvolution.handleProjectEvolutionReferencesMessage(messageContext);
        }
        if (this.projectEvolutionService && message.type === 'project-evolution-clear') {
            return this.projectEvolution.handleProjectEvolutionClearMessage(messageContext);
        }
        if (this.projectEvolutionService && message.type === 'project-evolution-apply-frame') {
            return this.projectEvolution.handleProjectEvolutionApplyFrameMessage(messageContext, message);
        }
        if (this.projectEvolutionService && message.type === 'project-evolution-start') {
            return this.projectEvolution.handleProjectEvolutionStartMessage(messageContext, message);
        }
        return false;
    }

    private async handleAnalysisModeActivateMessage(message: CollaborationMessage): Promise<boolean> {
        const requestedMode = String(message.payload?.mode || '');
        if (
            requestedMode === 'single'
            || requestedMode === 'historical-compare'
            || requestedMode === 'project-evolution'
            || requestedMode === 'dependency-graph'
        ) {
            const mode = requestedMode as Exclude<AnalysisViewMode, 'selection'>;
            let controllerView: string | undefined;
            if (mode !== 'single') {
                const entityKind = mode === 'historical-compare'
                    ? 'historical-comparison'
                    : mode === 'project-evolution'
                        ? 'project-evolution'
                        : 'dependency-graph';
                const snapshot = this.room.getRoom()?.getServerEntity(
                    this.room.getRoomId(),
                    entityKind,
                    'main',
                );
                const available = mode === 'historical-compare' || mode === 'project-evolution'
                    ? !!snapshot?.result
                    : typeof snapshot?.datasetUrl === 'string';
                analysisRefreshCoordinator.setSnapshotAvailable(
                    this.host.sessionId,
                    mode,
                    available,
                );
                const allowsEmptyShell = mode === 'historical-compare'
                    || mode === 'project-evolution';
                if (!available && !allowsEmptyShell) {
                    this.host.setAnalysisViewMode('selection', 'visualization-menu');
                    return true;
                }
                controllerView = mode === 'historical-compare' && available
                    ? 'historical.mapping'
                    : mode === 'historical-compare'
                        ? 'historical.selection'
                        : mode === 'dependency-graph'
                            ? 'dependency.settings'
                            : 'project-evolution';
            } else {
                controllerView = 'single.mapping';
            }
            await this.host.activateAnalysisViewMode(mode, controllerView);
        }
        return true;
    }
}
