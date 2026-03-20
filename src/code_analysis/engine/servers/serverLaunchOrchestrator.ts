/**
 * Server Launch Orchestrator
 * Coordina el lanzamiento de servidores usando el sistema existente de MultiServerLauncher.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MultiServerLauncher } from '../../../servers/runtime/multiServerLauncher';
import { ServerSettingsManager } from '../../../servers/storage/serverSettingsManager';
import { fileToServerMap } from '../../../utils/fileToServerMap';
import { UnifiedAnalysisSession } from '../core/analysisSession';
import {
    ServerLaunchRequest,
    ServerLaunchResult,
    SessionServerInfo,
} from './models/sessionServerModels';

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
            const launchResult = await this.multiServerLauncher!.launchServer(
                htmlFilePath,
                customName,
                { sessionId: request.sessionId },
            );

            if (launchResult.success && launchResult.port && launchResult.serverUrl && launchResult.serverId) {
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
                    activeServerId: launchResult.activeServerId,
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

}

export default ServerLaunchOrchestrator;
