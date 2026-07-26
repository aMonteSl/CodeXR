import * as http from 'http';
import * as fs from 'fs';
import { fileToServerMap } from '../../../utils/fileToServerMap';
import {
    CollaborationConfiguration,
    CollaborationProfileManager,
    DEFAULT_COLLABORATION_PROFILE,
} from '../../../collaboration';
import { RemoteSessionAuthority } from '../../../remote_access';
import { sendErrorResponse, sendJsonResponse } from '../http/httpRespond';

/** Availability of one optional analysis feature, as reported to browsers. */
export interface FeatureAvailability {
    enabled: boolean;
    reason?: string | null;
}

export interface AnalysisAvailabilitySnapshot {
    historicalComparison: FeatureAvailability;
    projectEvolution: FeatureAvailability;
    dependencyGraph: FeatureAvailability;
}

/** What the collaboration session endpoints need from their host server. */
export interface CollaborationSessionApiDeps {
    port: number;
    authority: RemoteSessionAuthority;
    getAnalysisAvailability(): Promise<AnalysisAvailabilitySnapshot>;
}

/**
 * The `/api/collaboration/*` surface: the session descriptor a browser scene
 * bootstraps from, and the bundled avatar model stream. Also owns the room-id
 * derivation shared with the WebSocket wiring.
 */
export class CollaborationSessionApi {
    constructor(private readonly deps: CollaborationSessionApiDeps) {}

    public async handleSessionDescriptor(
        req: http.IncomingMessage,
        res: http.ServerResponse,
    ): Promise<void> {
        sendJsonResponse(res, 200, await this.buildCollaborationSessionDescriptor(req));
    }

    public async serveAvatarModel(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            sendErrorResponse(res, 405, 'Method not allowed');
            return;
        }

        const modelPath = CollaborationProfileManager.getInstance()?.getAvatarModelPath();
        if (!modelPath) {
            sendErrorResponse(res, 404, 'Avatar model is not installed');
            return;
        }
        const stats = await fs.promises.stat(modelPath);
        res.writeHead(200, {
            'Content-Type': 'model/gltf-binary',
            'Content-Length': stats.size,
            'Cache-Control': 'public, max-age=604800, immutable',
            'X-CodeXR-Asset-Source': 'RobotExpressive-by-Tomas-Laulhe-CC0',
        });
        if (req.method === 'HEAD') {
            res.end();
            return;
        }
        fs.createReadStream(modelPath)
            .on('error', () => sendErrorResponse(res, 500, 'Unable to read avatar model'))
            .pipe(res);
    }

    /** The room every scene served by this port collaborates in. */
    public getCollaborationRoomId(): string {
        const fileUri = fileToServerMap.findFileByPort(this.deps.port);
        const mapping = fileUri ? fileToServerMap.getServerInfo(fileUri) : null;
        const activeServerId = mapping?.activeServerId || `port-${this.deps.port}`;
        return `codexr-session:${activeServerId}`;
    }

    private async buildCollaborationSessionDescriptor(
        req: http.IncomingMessage,
    ): Promise<Record<string, unknown>> {
        const fileUri = fileToServerMap.findFileByPort(this.deps.port);
        const mapping = fileUri ? fileToServerMap.getServerInfo(fileUri) : null;
        const activeServerId = mapping?.activeServerId || `port-${this.deps.port}`;
        const collaborationConfiguration = CollaborationProfileManager.getInstance()?.getConfiguration()
            || this.getDefaultCollaborationConfiguration();
        const session = this.deps.authority.resolveCookie(req.headers.cookie);
        const profile = session?.profile || DEFAULT_COLLABORATION_PROFILE;
        const { historicalComparison, projectEvolution, dependencyGraph } =
            await this.deps.getAnalysisAvailability();

        return {
            roomId: `codexr-session:${activeServerId}`,
            activeServerId,
            fileUri: fileUri || null,
            capabilities: {
                collaboration: true,
                presence: true,
                media: true,
                historicalComparison: historicalComparison.enabled,
                historicalComparisonReason: historicalComparison.reason,
                projectEvolution: projectEvolution.enabled,
                projectEvolutionReason: projectEvolution.reason,
                dependencyGraph: dependencyGraph.enabled,
                dependencyGraphReason: dependencyGraph.reason,
            },
            roomSocketPath: '/codexr-room',
            broadcastSocketPath: '/codexr-broadcast',
            collaborationProfile: profile,
            avatarModelAvailable: collaborationConfiguration.avatarModelAvailable,
            profileRevision: collaborationConfiguration.revision,
        };
    }

    private getDefaultCollaborationConfiguration(): CollaborationConfiguration {
        return {
            profile: {
                identityMode: 'anonymous',
                customName: '',
                avatarId: 'avatar-1',
            },
            avatarModelAvailable: false,
            revision: 0,
        };
    }
}
