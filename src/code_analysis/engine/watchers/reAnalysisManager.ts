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
import { VisualizeDOMRequirements } from '../processors/requirementRules/VisualizeDOMRequirements';
import { SaveFiles } from '../utils/saveFiles';

export class ReAnalysisManager {
    private executePython: ExecutePython;
    private sseManager: SSEManager;

    constructor(private context: vscode.ExtensionContext) {
        this.executePython = new ExecutePython(context);
        this.sseManager = SSEManager.getInstance();
    }

    async executeDataJsonRegeneration(session: UnifiedAnalysisSession): Promise<boolean> {
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

            if (session.analysisMode === 'XR') {
                this.sseManager.sendDataRefresh(session.targetPath);
            } else {
                this.sseManager.sendUpdate(session.targetPath);
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

            const visualizeDOMRequirements = new VisualizeDOMRequirements(this.context);
            const processedFiles = await visualizeDOMRequirements.getRequiredFiles(session);
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
            session.requiredFiles.clear();
            for (const [fileName, content] of processedFiles.loadedFiles) {
                session.requiredFiles.set(fileName, content);
            }

            const htmlContent = await fs.readFile(session.targetPath, 'utf-8');
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

    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
}
