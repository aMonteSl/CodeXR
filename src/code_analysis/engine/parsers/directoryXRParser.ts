/**
 * Directory XR Parser
 * Handles parsing of directory structure for XR visualization.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { UnifiedAnalysisSession } from '../core/analysisSession';
import { AnalysisConfigurationStorage } from '../../configuration/analysisConfigurationStorage';
import { TemplateProcessor } from '../../../babia_templates/processing/templateProcessor';
import { ExecutePython } from '../utils/executePython';
import { DimensionMapping } from '../../../babia_templates/models/chartModels';
import { SHA256Generator } from '../../../utils/sha256Generator';
import { buildTrackedFileSnapshot } from '../watchers/directorySnapshot';
import { resolveTrackedSystemPath } from '../watchers/directoryReanalysisData';
import { injectVirtualScreenViewerConfig } from './virtualScreenConfigInjector';

export interface DirectoryXRParsingResult {
    success: boolean;
    generatedFiles?: Map<string, string>;
    error?: string;
}

interface DirectoryXRSharedBootstrap {
    payload: any[];
    trackedFiles?: { filePath: string; hash: string; size?: number; mtimeMs?: number }[];
}

export class DirectoryXRParser {
    async parseDirectoryForXR(
        session: UnifiedAnalysisSession,
        context: vscode.ExtensionContext,
        bootstrap?: DirectoryXRSharedBootstrap,
    ): Promise<DirectoryXRParsingResult> {
        try {
            const storage = AnalysisConfigurationStorage.getInstance(context);
            const chartType = await storage.getDirectoryChartType();
            const dimensionMappings = await storage.getDimensionMappingDirectory();
            const mappings: DimensionMapping[] = Object.entries(dimensionMappings).map(([dimension, dataField]) => ({
                dimension,
                dataField,
            }));

            const analysisData = bootstrap?.payload ?? await new ExecutePython(context).executeAnalysis({
                ...session,
                analysisMode: 'XR',
                targetType: 'directory',
            });
            const payload = Array.isArray(analysisData) ? analysisData : [];

            if (bootstrap?.trackedFiles) {
                session.filesToHash = bootstrap.trackedFiles;
            } else {
                session.filesToHash = await this.buildTrackedFiles(session, payload);
            }

            const tempOutputPath = path.join(context.storageUri?.fsPath || '/tmp', 'temp_xr_generation');
            await fs.promises.mkdir(tempOutputPath, { recursive: true });
            const tempHtmlPath = path.join(tempOutputPath, 'index.html');

            const htmlGenerationResult = await TemplateProcessor.generateXRVisualization(
                chartType,
                mappings,
                `Directory Analysis: ${session.targetName}`,
                'data.json',
                context,
                tempHtmlPath,
                payload,
            );

            if (!htmlGenerationResult.success) {
                return {
                    success: false,
                    error: `HTML generation failed: ${htmlGenerationResult.error}`,
                };
            }

            const htmlContent = await fs.promises.readFile(tempHtmlPath, 'utf8');
            const hydratedHtmlContent = injectVirtualScreenViewerConfig(htmlContent, {
                virtualScreenSessionId: session.id,
                virtualScreenSignalPath: '/codexr/virtual-screen/ws',
                virtualScreenSupportsHostBroadcast: true,
                virtualScreenSupportsLocalCapture: true,
            });
            await fs.promises.rm(tempOutputPath, { recursive: true, force: true });

            const jsFilePath = path.join(context.extensionPath, 'templates', 'xr', 'sse', 'live_sse_fileXR.js');
            if (!fs.existsSync(jsFilePath)) {
                return {
                    success: false,
                    error: `live_sse_fileXR.js not found at: ${jsFilePath}`,
                };
            }

            const virtualScreenRuntimePath = path.join(context.extensionPath, 'templates', 'xr', 'shared', 'virtualScreenRuntime.js');
            if (!fs.existsSync(virtualScreenRuntimePath)) {
                return {
                    success: false,
                    error: `virtualScreenRuntime.js not found at: ${virtualScreenRuntimePath}`,
                };
            }

            const jsContent = await fs.promises.readFile(jsFilePath, 'utf8');
            const virtualScreenRuntimeContent = await fs.promises.readFile(virtualScreenRuntimePath, 'utf8');
            const dataJsonContent = JSON.stringify(payload, null, 2);

            const generatedFiles = new Map<string, string>();
            generatedFiles.set('index.html', hydratedHtmlContent);
            generatedFiles.set('main.js', jsContent);
            generatedFiles.set('virtualScreenRuntime.js', virtualScreenRuntimeContent);
            generatedFiles.set('data.json', dataJsonContent);

            session.metadata.mainHtmlFileName = 'index.html';

            return {
                success: true,
                generatedFiles,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    private async buildTrackedFiles(
        session: UnifiedAnalysisSession,
        analysisData: any[],
    ): Promise<{ filePath: string; hash: string; size?: number; mtimeMs?: number }[]> {
        const filesToHash: { filePath: string; hash: string; size?: number; mtimeMs?: number }[] = [];

        for (const fileData of analysisData) {
            const trackedPath = resolveTrackedSystemPath(session.targetPath, fileData);
            if (!trackedPath) {
                continue;
            }

            try {
                const fileHash = await SHA256Generator.generateFileHash(trackedPath);
                const trackedSnapshot = await buildTrackedFileSnapshot(trackedPath, fileHash);
                filesToHash.push(trackedSnapshot ?? {
                    filePath: trackedPath,
                    hash: fileHash,
                });
            } catch {
                filesToHash.push({
                    filePath: trackedPath,
                    hash: '',
                });
            }
        }

        return filesToHash;
    }
}

export const directoryXRParser = new DirectoryXRParser();

