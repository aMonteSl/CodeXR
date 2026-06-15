/**
 * Re-Analysis Manager
 * Handles incremental refresh of analysis artifacts after watcher-triggered changes.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { UnifiedAnalysisSession } from '../core/analysisSession';
import { ExecutePython } from '../utils/executePython';
import { SSEManager } from '../../../servers/runtime/sse/SSEManager';
import { FileRequirementProcessor } from '../processors/FileRequirementProcessor';
import { SaveFiles } from '../utils/saveFiles';
import { analysisUpdateEvents } from '../../historical';

export class ReAnalysisManager {
    private executePython: ExecutePython;
    private sseManager: SSEManager;

    constructor(private context: vscode.ExtensionContext) {
        this.executePython = new ExecutePython(context);
        this.sseManager = SSEManager.getInstance();
    }

    async executeDataJsonRegeneration(
        session: UnifiedAnalysisSession,
        options: { notifyClients?: boolean } = {},
    ): Promise<boolean> {
        try {
            if (!session.savedFilesPath) {
                throw new Error(`Session ${session.id} does not have saved files path`);
            }

            if (!(await this.fileExists(session.targetPath))) {
                throw new Error(`Target file does not exist: ${session.targetPath}`);
            }

            const analysisData = await this.executePython.executeAnalysis(session);
            const newDataJsonContent = JSON.stringify(analysisData, null, 2);
            const dataJsonPath = path.join(session.savedFilesPath, 'data.json');

            await fs.writeFile(dataJsonPath, newDataJsonContent, 'utf-8');
            session.requiredFiles.set('data.json', newDataJsonContent);
            analysisUpdateEvents.emit({
                sessionId: session.id,
                targetPath: session.targetPath,
                updatedAt: new Date().toISOString(),
            });

            if (options.notifyClients !== false) {
                if (session.analysisMode === 'XR') {
                    this.sseManager.sendDataRefresh(session.targetPath);
                } else {
                    this.sseManager.sendUpdate(session.targetPath);
                }
            }

            return true;
        } catch (error) {
            console.error('RE_ANALYSIS_MANAGER: Error in data.json regeneration:', error);
            return false;
        }
    }

    async executeVisualizeDOMRegeneration(session: UnifiedAnalysisSession): Promise<boolean> {
        try {
            if (!(await this.fileExists(session.targetPath))) {
                throw new Error(`Target HTML file does not exist: ${session.targetPath}`);
            }

            const processor = new FileRequirementProcessor(this.context);
            const processedFiles = await processor.processRequirements(session);
            if (processedFiles.loadedFiles.size === 0) {
                throw new Error('No processed VisualizeDOM files were generated');
            }

            const saveFiles = new SaveFiles();
            const savedPath = await saveFiles.saveFilesToStorage(
                processedFiles.loadedFiles,
                'visualizeDOMAnalysis',
                session.outputDirectory,
                this.context,
            );

            session.savedFilesPath = savedPath;
            await this.removeLegacyDomDataJson(savedPath);

            session.requiredFiles.clear();
            for (const [fileName, content] of processedFiles.loadedFiles) {
                session.requiredFiles.set(fileName, content);
            }

            const htmlContent = this.extractVisualizeDOMHtmlContent(session, processedFiles.loadedFiles);
            this.sseManager.sendCustomMessage(session.targetPath, {
                type: 'htmlUpdated',
                htmlContent,
                action: 'reload-html',
                message: 'HTML DOM content has been updated',
            });

            return true;
        } catch (error) {
            console.error('RE_ANALYSIS_MANAGER: Error in VisualizeDOM regeneration:', error);
            return false;
        }
    }

    private extractVisualizeDOMHtmlContent(session: UnifiedAnalysisSession, loadedFiles: Map<string, string>): string {
        if (typeof session.metadata.domHtmlContent === 'string' && session.metadata.domHtmlContent.length > 0) {
            return session.metadata.domHtmlContent;
        }

        const indexHtml = loadedFiles.get('index.html');
        if (!indexHtml) {
            return '';
        }

        const payloadMatch = indexHtml.match(/window\.__CODEXR_DOM_HTML_PAYLOAD__\s*=\s*("(?:\\.|[^"\\])*");/);
        if (!payloadMatch) {
            return '';
        }

        try {
            return JSON.parse(payloadMatch[1]);
        } catch {
            return '';
        }
    }

    private async removeLegacyDomDataJson(savedPath: string): Promise<void> {
        const legacyDataJsonPath = path.join(savedPath, 'data.json');
        try {
            await fs.unlink(legacyDataJsonPath);
        } catch (error) {
            const code = (error as NodeJS.ErrnoException)?.code;
            if (code !== 'ENOENT') {
                console.warn('RE_ANALYSIS_MANAGER: Failed to remove legacy DOM data.json:', error);
            }
        }
    }

    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
}

