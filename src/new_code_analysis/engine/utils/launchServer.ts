/**
 * Launch Server Utility
 * Intermediate utility for launching analysis with SSE server connections
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { MultiServerLauncher } from '../../../servers/runtime/multiServerLauncher';
import { EnhancedSSEManager } from '../../../servers/runtime/sse/enhancedSSEManager';
import { fileToServerMap } from '../../../utils/fileToServerMap';

export interface ServerLaunchOptions {
    filePath: string;
    analysisType: string;
    port?: number;
    enableSSE?: boolean;
    analysisDirectoryPath?: string;
    indexHtmlPath?: string;
}

export interface ServerLaunchResult {
    success: boolean;
    serverUrl?: string;
    port?: number;
    serverId?: string;
    error?: string;
    sseChannel?: string;
}

export class LaunchServer {

    /**
     * Launch analysis server with SSE support
     */
    static async launchAnalysisServer(
        context: vscode.ExtensionContext,
        options: ServerLaunchOptions
    ): Promise<ServerLaunchResult> {
        try {
            console.log(`LAUNCH_SERVER: Preparing to launch server for: ${options.filePath}`);
            console.log(`LAUNCH_SERVER: Analysis type: ${options.analysisType}`);
            console.log(`LAUNCH_SERVER: SSE enabled: ${options.enableSSE ?? true}`);

            // Use the existing MultiServerLauncher to launch the server
            const multiServerLauncher = new MultiServerLauncher(context);
            
            // Determine HTML file path - use analysis index.html if available
            let htmlFile: string | undefined;
            if (options.indexHtmlPath && await this.fileExists(options.indexHtmlPath)) {
                htmlFile = options.indexHtmlPath;
                console.log(`LAUNCH_SERVER: Using analysis index.html: ${htmlFile}`);
            } else if (options.analysisDirectoryPath) {
                const analysisIndex = path.join(options.analysisDirectoryPath, 'index.html');
                if (await this.fileExists(analysisIndex)) {
                    htmlFile = analysisIndex;
                    console.log(`LAUNCH_SERVER: Using analysis directory index.html: ${htmlFile}`);
                }
            }
            
            // Generate custom name for the server
            const fileName = path.basename(options.filePath);
            const customName = `LivePanel Analysis: ${fileName}`;
            
            console.log(`LAUNCH_SERVER: Launching server with custom name: ${customName}`);
            
            // Launch the server
            const launchResult = await multiServerLauncher.launchServer(htmlFile, customName);
            
            if (!launchResult.success) {
                return {
                    success: false,
                    error: launchResult.error || 'Failed to launch server'
                };
            }
            
            console.log(`LAUNCH_SERVER: Server launched successfully: ${launchResult.serverUrl}`);
            console.log(`LAUNCH_SERVER: Server ID: ${launchResult.serverId}`);
            
            // Register file-to-server mapping for SSE support
            try {
                console.log(`LAUNCH_SERVER: Registering file-to-server mapping...`);
                console.log(`LAUNCH_SERVER: File path: ${options.filePath}`);
                console.log(`LAUNCH_SERVER: Server port: ${launchResult.port}`);
                console.log(`LAUNCH_SERVER: Analysis directory: ${options.analysisDirectoryPath || 'N/A'}`);
                
                fileToServerMap.registerMapping(options.filePath, {
                    port: launchResult.port!,
                    tempDir: options.analysisDirectoryPath || '',
                    fileUri: options.filePath,
                    serverRef: null as any // We don't have direct access to server reference in MultiServerLauncher
                });
                
                console.log(`LAUNCH_SERVER: File-to-server mapping registered successfully`);
                console.log(`LAUNCH_SERVER: Total mappings: ${fileToServerMap.size()}`);
                
            } catch (mappingError) {
                console.warn(`LAUNCH_SERVER: Failed to register file-to-server mapping (non-critical):`, mappingError);
            }
            
            // Setup SSE channel for live updates if enabled
            let sseChannel: string | undefined;
            if (options.enableSSE !== false) {
                try {
                    sseChannel = this.setupSSEChannel(options.filePath, options.analysisType, launchResult.serverId!);
                    console.log(`LAUNCH_SERVER: SSE channel setup: ${sseChannel}`);
                } catch (sseError) {
                    console.warn(`LAUNCH_SERVER: SSE setup failed (non-critical):`, sseError);
                    // Don't fail the launch if SSE setup fails
                }
            }

            return {
                success: true,
                serverUrl: launchResult.serverUrl,
                port: launchResult.port,
                serverId: launchResult.serverId,
                sseChannel: sseChannel
            };

        } catch (error) {
            console.error(`LAUNCH_SERVER: Error launching analysis server:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Check if file exists
     * @private
     */
    private static async fileExists(filePath: string): Promise<boolean> {
        try {
            await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Setup SSE channel for live analysis updates
     * @private
     */
    private static setupSSEChannel(filePath: string, analysisType: string, serverId: string): string {
        console.log(`LAUNCH_SERVER: Creating SSE channel for file: ${filePath}`);
        console.log(`LAUNCH_SERVER: Analysis type: ${analysisType}`);
        console.log(`LAUNCH_SERVER: Server ID: ${serverId}`);
        
        // Setup SSE channel using EnhancedSSEManager
        try {
            const sseManager = EnhancedSSEManager.getInstance();
            
            // Create a channel for this analysis session
            const channelId = sseManager.createChannel(filePath, analysisType);
            
            console.log(`LAUNCH_SERVER: SSE channel created successfully: ${channelId}`);
            return channelId;
            
        } catch (error) {
            console.error(`LAUNCH_SERVER: Failed to setup SSE channel:`, error);
            throw error;
        }
    }

    /**
     * Stop analysis server
     */
    static async stopAnalysisServer(
        context: vscode.ExtensionContext,
        serverId: string,
        filePath?: string
    ): Promise<boolean> {
        try {
            console.log(`LAUNCH_SERVER: Stopping analysis server: ${serverId}`);
            
            // Clean up file-to-server mapping if filePath provided
            if (filePath) {
                try {
                    console.log(`LAUNCH_SERVER: Cleaning up file-to-server mapping for: ${filePath}`);
                    fileToServerMap.unregisterMapping(filePath);
                    console.log(`LAUNCH_SERVER: File-to-server mapping cleaned up successfully`);
                } catch (mappingError) {
                    console.warn(`LAUNCH_SERVER: Failed to clean up file-to-server mapping:`, mappingError);
                }
            }
            
            const multiServerLauncher = new MultiServerLauncher(context);
            const result = await multiServerLauncher.stopServer(serverId);
            
            if (result) {
                console.log(`LAUNCH_SERVER: Server ${serverId} stopped successfully`);
            } else {
                console.warn(`LAUNCH_SERVER: Failed to stop server ${serverId}`);
            }
            
            return result;

        } catch (error) {
            console.error(`LAUNCH_SERVER: Error stopping analysis server:`, error);
            return false;
        }
    }

    /**
     * Get active analysis servers
     */
    static getActiveServers(context: vscode.ExtensionContext): { serverId: string, port: number, serverUrl?: string, serverType?: string }[] {
        try {
            const multiServerLauncher = new MultiServerLauncher(context);
            const runningServers = multiServerLauncher.getRunningServers();
            
            return runningServers.map(server => ({
                serverId: server.id,
                port: server.port,
                serverUrl: `http://localhost:${server.port}`,
                serverType: server.serverType
            }));
            
        } catch (error) {
            console.error(`LAUNCH_SERVER: Error getting active servers:`, error);
            return [];
        }
    }
}
