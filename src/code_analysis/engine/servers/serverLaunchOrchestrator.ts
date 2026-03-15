/**
 * Server Launch Orchestrator
 * Coordina el lanzamiento de servidores usando el sistema existente de MultiServerLauncher.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { randomBytes } from 'crypto';
import { MultiServerLauncher, ServerRuntimeOptions } from '../../../servers/runtime/multiServerLauncher';
import { ServerSettingsManager } from '../../../servers/storage/serverSettingsManager';
import { fileToServerMap } from '../../../utils/fileToServerMap';
import { UnifiedAnalysisSession } from '../core/analysisSession';
import {
    ServerLaunchRequest,
    ServerLaunchResult,
    SessionServerInfo,
} from './models/sessionServerModels';

const VIRTUAL_SCREEN_SIGNAL_PATH = '/codexr/virtual-screen/ws';
const VIRTUAL_SCREEN_HOST_PATH = '/codexr/virtual-screen/host';

export class ServerLaunchOrchestrator {
    private multiServerLauncher: MultiServerLauncher | null = null;
    private serverSettingsManager: ServerSettingsManager;

    constructor(private context: vscode.ExtensionContext) {
        console.log('SERVER_LAUNCH_ORCHESTRATOR: Initializing orchestrator');
        this.serverSettingsManager = ServerSettingsManager.getInstance(context);
    }

    private async ensureMultiServerLauncher(): Promise<void> {
        if (!this.multiServerLauncher) {
            this.multiServerLauncher = new MultiServerLauncher(this.context);
        }
    }

    async launchServerForSession(request: ServerLaunchRequest, session?: UnifiedAnalysisSession): Promise<ServerLaunchResult> {
        try {
            await this.ensureMultiServerLauncher();

            const serverSettings = this.serverSettingsManager.getServerSettings();
            const serverType = this.getDefaultServerType(serverSettings);
            const tempDir = session?.savedFilesPath || this.getTempDirForSession(request.sessionId);

            if (!tempDir || !fs.existsSync(tempDir)) {
                return {
                    success: false,
                    error: `Saved analysis files were not found for session ${request.sessionId}`,
                };
            }

            const preferredMainFile = typeof session?.metadata?.mainHtmlFileName === 'string'
                ? session.metadata.mainHtmlFileName
                : undefined;
            const htmlFilePath = this.findMainHtmlFile(tempDir, preferredMainFile);
            if (!htmlFilePath) {
                return {
                    success: false,
                    error: `No generated HTML entry file was found for session ${request.sessionId} in ${tempDir}`,
                };
            }

            const customName = this.generateDescriptiveServerName(request, session);
            const runtimeOptions = session ? this.createServerRuntimeOptions(session, customName) : undefined;
            const launchResult = await this.multiServerLauncher!.launchServer(
                htmlFilePath,
                customName,
                { sessionId: request.sessionId },
                runtimeOptions,
            );

            if (launchResult.success && launchResult.port && launchResult.serverUrl && launchResult.serverId) {
                if (session) {
                    this.hydrateVirtualScreenSessionMetadata(session, launchResult.serverUrl, customName);
                }

                const sessionServerInfo: SessionServerInfo = {
                    sessionId: request.sessionId,
                    targetPath: request.targetPath,
                    port: launchResult.port,
                    serverUrl: launchResult.serverUrl,
                    serverType: launchResult.serverType || serverType,
                    serverId: launchResult.serverId,
                    tempDir,
                    isActive: true,
                    startedAt: new Date(),
                };

                fileToServerMap.registerMapping(request.targetPath, {
                    port: launchResult.port,
                    tempDir,
                    fileUri: request.targetPath,
                    serverRef: this.getServerRefById(launchResult.serverId),
                });

                return {
                    success: true,
                    sessionServerInfo,
                    portChanged: launchResult.portChanged,
                    originalPort: launchResult.originalPort,
                };
            }

            return {
                success: false,
                error: launchResult.error || 'Unknown server launch error',
            };
        } catch (error) {
            console.error('SERVER_LAUNCH_ORCHESTRATOR: Error launching server:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    async stopServerForSession(sessionId: string, targetPath: string): Promise<boolean> {
        try {
            fileToServerMap.unregisterMapping(targetPath);
            console.log(`SERVER_LAUNCH_ORCHESTRATOR: Stopped server for session ${sessionId}`);
            return true;
        } catch (error) {
            console.error('SERVER_LAUNCH_ORCHESTRATOR: Error stopping server:', error);
            return false;
        }
    }

    private getDefaultServerType(_serverSettings: any): 'http' | 'https-default' | 'https-custom' {
        return 'http';
    }

    private getTempDirForSession(sessionId: string): string {
        const workspaceStorage = this.context.storageUri?.fsPath || '';
        const analysisDir = path.join(workspaceStorage, 'analysis', sessionId);
        return analysisDir;
    }

    private findMainHtmlFile(baseDir: string, preferredFileName?: string): string | undefined {
        if (preferredFileName) {
            const preferredPath = path.join(baseDir, preferredFileName);
            if (fs.existsSync(preferredPath)) {
                return preferredPath;
            }
        }

        const htmlFiles = this.findHtmlFiles(baseDir);
        const preferredNames = ['fileAnalysis.html', 'directoryAnalysis.html', 'main.html', 'index.html'];

        for (const preferredName of preferredNames) {
            const found = htmlFiles.find((file) => path.basename(file) === preferredName);
            if (found) {
                return found;
            }
        }

        return htmlFiles[0];
    }

    private findHtmlFiles(dir: string): string[] {
        const htmlFiles: string[] = [];

        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    htmlFiles.push(...this.findHtmlFiles(fullPath));
                    continue;
                }

                if (entry.isFile() && entry.name.endsWith('.html')) {
                    htmlFiles.push(fullPath);
                }
            }
        } catch (error) {
            console.error(`SERVER_LAUNCH_ORCHESTRATOR: Error reading directory ${dir}:`, error);
        }

        return htmlFiles;
    }

    private getServerRefById(_serverId: string): any {
        return null;
    }

    private generateDescriptiveServerName(request: ServerLaunchRequest, session?: UnifiedAnalysisSession): string {
        const baseName = path.basename(request.targetPath);
        const analysisMode = session?.analysisMode || 'unknown';
        const targetType = session?.targetType || 'unknown';

        if (analysisMode.toLowerCase().includes('xr')) {
            return targetType === 'directory' ? `XR Directory: ${baseName}` : `XR File: ${baseName}`;
        }

        if (analysisMode.toLowerCase().includes('dom')) {
            return `DOM Visualization: ${baseName}`;
        }

        return targetType === 'directory' ? `LivePanel Directory: ${baseName}` : `LivePanel File: ${baseName}`;
    }

    private createServerRuntimeOptions(
        session: UnifiedAnalysisSession,
        customName: string,
    ): ServerRuntimeOptions | undefined {
        if (session.analysisMode !== 'XR' && session.analysisMode !== 'VisualizeDOM') {
            return undefined;
        }

        const metadata = this.ensureVirtualScreenMetadata(session, customName);
        return {
            virtualScreen: {
                sessionId: metadata.sessionId,
                signalPath: metadata.signalPath,
                hostPath: metadata.hostBroadcasterPath,
                hostBroadcasterToken: metadata.hostBroadcasterToken,
                displayName: customName,
                getHostBroadcasterUrl: () => session.metadata?.virtualScreen?.hostBroadcasterUrl,
                onHostBroadcastRequested: (event) => {
                    metadata.hostBroadcastRequested = true;
                    const hostBroadcasterUrl = event.hostBroadcasterUrl;
                    const detail = hostBroadcasterUrl
                        ? `A remote viewer requested the host computer source for "${customName}". Open the broadcaster page to share VS Code or another window from this computer.`
                        : `A remote viewer requested the host computer source for "${customName}".`;
                    void vscode.window.showInformationMessage(
                        detail,
                        'Open Host Broadcaster',
                    ).then((selection) => {
                        if (selection === 'Open Host Broadcaster' && hostBroadcasterUrl) {
                            void vscode.env.openExternal(vscode.Uri.parse(hostBroadcasterUrl));
                        }
                    });
                },
            },
        };
    }

    private hydrateVirtualScreenSessionMetadata(
        session: UnifiedAnalysisSession,
        serverUrl: string,
        customName: string,
    ): void {
        if (session.analysisMode !== 'XR' && session.analysisMode !== 'VisualizeDOM') {
            return;
        }

        const metadata = this.ensureVirtualScreenMetadata(session, customName);
        metadata.hostBroadcasterUrl = `${serverUrl}${metadata.hostBroadcasterPath}?token=${encodeURIComponent(metadata.hostBroadcasterToken)}`;
    }

    private ensureVirtualScreenMetadata(
        session: UnifiedAnalysisSession,
        customName: string,
    ): Record<string, any> {
        const existing: Record<string, any> = typeof session.metadata.virtualScreen === 'object' && session.metadata.virtualScreen
            ? session.metadata.virtualScreen
            : {};

        Object.assign(existing, {
            sessionId: session.id,
            signalPath: VIRTUAL_SCREEN_SIGNAL_PATH,
            hostBroadcasterPath: VIRTUAL_SCREEN_HOST_PATH,
            hostBroadcasterToken: existing.hostBroadcasterToken || randomBytes(18).toString('hex'),
            hostBroadcasterUrl: existing.hostBroadcasterUrl,
            hostBroadcastRequested: existing.hostBroadcastRequested === true,
            displayName: existing.displayName || customName,
        });

        session.metadata.virtualScreen = existing;
        return existing;
    }
}

export default ServerLaunchOrchestrator;
