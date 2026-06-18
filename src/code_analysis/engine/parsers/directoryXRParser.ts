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
import { XRFieldSchemaService } from '../../services/xrFieldSchemaService';
import { SHA256Generator } from '../../../utils/sha256Generator';
import { buildTrackedFileSnapshot } from '../watchers/directorySnapshot';
import { resolveTrackedSystemPath } from '../watchers/directoryReanalysisData';
import {
    ANALYSIS_TABLE_RUNTIME_OUTPUT_NAME,
    ANALYSIS_MODE_RUNTIME_OUTPUT_NAME,
    HISTORICAL_COMPARISON_RUNTIME_OUTPUT_NAME,
    DEPENDENCY_GRAPH_RUNTIME_OUTPUT_NAME,
    RENDER_BUDGET_RUNTIME_OUTPUT_NAME,
    DEPENDENCY_VISUAL_BUDGET_RUNTIME_OUTPUT_NAME,
    CODEXR_DEBUG_RUNTIME_OUTPUT_NAME,
    CODEXR_AVATAR_RUNTIME_OUTPUT_NAME,
    CODEXR_COLLABORATION_RUNTIME_OUTPUT_NAME,
    CODEXR_ROOM_RUNTIME_OUTPUT_NAME,
    readAnalysisTableRuntimeContent,
    readAnalysisModeRuntimeContent,
    readHistoricalComparisonRuntimeContent,
    readDependencyGraphRuntimeContent,
    readRenderBudgetRuntimeContent,
    readDependencyVisualBudgetRuntimeContent,
    readCodeXrDebugRuntimeContent,
    readCodeXrAvatarRuntimeContent,
    readCodeXrCollaborationRuntimeContent,
    readCodeXrRoomRuntimeContent,
    readCodeXrRoomTextureContents,
    readVirtualScreenManagerRuntimeContent,
    VIRTUAL_SCREEN_MANAGER_RUNTIME_OUTPUT_NAME,
    readVirtualScreenRuntimeContent,
    VIRTUAL_SCREEN_RUNTIME_OUTPUT_NAME,
    readXrChartDebugRuntimeContent,
    XR_CHART_DEBUG_RUNTIME_OUTPUT_NAME,
    readXrChartMappingUiRuntimeContent,
    XR_CHART_MAPPING_UI_RUNTIME_OUTPUT_NAME,
} from '../components/customComponents';

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
            const babiaUiConfig = await storage.getXRBabiaUiConfig();
            const fieldTypeMap = babiaUiConfig.enabled
                ? await XRFieldSchemaService.getInstance(context).getFieldTypeMap('directory')
                : undefined;

            const htmlGenerationResult = await TemplateProcessor.generateXRVisualization(
                chartType,
                mappings,
                `Directory Analysis: ${session.targetName}`,
                'data.json',
                context,
                tempHtmlPath,
                payload,
                {
                    babiaUiEnabled: babiaUiConfig.enabled,
                    babiaUiVisibleByDefault: babiaUiConfig.visibleByDefault,
                    xrTargetType: 'directory',
                    fieldTypeMap,
                },
            );

            if (!htmlGenerationResult.success) {
                return {
                    success: false,
                    error: `HTML generation failed: ${htmlGenerationResult.error}`,
                };
            }

            const htmlContent = await fs.promises.readFile(tempHtmlPath, 'utf8');
            await fs.promises.rm(tempOutputPath, { recursive: true, force: true });

            const jsFilePath = path.join(context.extensionPath, 'templates', 'xr', 'sse', 'live_sse_fileXR.js');
            if (!fs.existsSync(jsFilePath)) {
                return {
                    success: false,
                    error: `live_sse_fileXR.js not found at: ${jsFilePath}`,
                };
            }

            const jsContent = await fs.promises.readFile(jsFilePath, 'utf8');
            const virtualScreenRuntimeContent = await readVirtualScreenRuntimeContent(context.extensionPath);
            const virtualScreenManagerRuntimeContent = await readVirtualScreenManagerRuntimeContent(context.extensionPath);
            const avatarRuntimeContent = await readCodeXrAvatarRuntimeContent(context.extensionPath);
            const collaborationRuntimeContent = await readCodeXrCollaborationRuntimeContent(context.extensionPath);
            const codexrRoomRuntimeContent = await readCodeXrRoomRuntimeContent(context.extensionPath);
            const xrChartMappingUiRuntimeContent = await readXrChartMappingUiRuntimeContent(context.extensionPath);
            const xrChartDebugRuntimeContent = await readXrChartDebugRuntimeContent(context.extensionPath);
            const analysisTableRuntimeContent = await readAnalysisTableRuntimeContent(context.extensionPath);
            const analysisModeRuntimeContent = await readAnalysisModeRuntimeContent(context.extensionPath);
            const historicalComparisonRuntimeContent = await readHistoricalComparisonRuntimeContent(context.extensionPath);
            const dependencyGraphRuntimeContent = await readDependencyGraphRuntimeContent(context.extensionPath);
            const renderBudgetRuntimeContent = await readRenderBudgetRuntimeContent(context.extensionPath);
            const dependencyVisualBudgetRuntimeContent = await readDependencyVisualBudgetRuntimeContent(context.extensionPath);
            const codexrDebugRuntimeContent = await readCodeXrDebugRuntimeContent(context.extensionPath);
            const codexrRoomTextures = await readCodeXrRoomTextureContents(context.extensionPath);
            const dataJsonContent = JSON.stringify(payload, null, 2);

            const generatedFiles = new Map<string, string>();
            generatedFiles.set('index.html', htmlContent);
            generatedFiles.set('main.js', jsContent);
            generatedFiles.set(CODEXR_AVATAR_RUNTIME_OUTPUT_NAME, avatarRuntimeContent);
            generatedFiles.set(CODEXR_COLLABORATION_RUNTIME_OUTPUT_NAME, collaborationRuntimeContent);
            generatedFiles.set(VIRTUAL_SCREEN_RUNTIME_OUTPUT_NAME, virtualScreenRuntimeContent);
            generatedFiles.set(VIRTUAL_SCREEN_MANAGER_RUNTIME_OUTPUT_NAME, virtualScreenManagerRuntimeContent);
            generatedFiles.set(CODEXR_ROOM_RUNTIME_OUTPUT_NAME, codexrRoomRuntimeContent);
            generatedFiles.set(XR_CHART_MAPPING_UI_RUNTIME_OUTPUT_NAME, xrChartMappingUiRuntimeContent);
            generatedFiles.set(XR_CHART_DEBUG_RUNTIME_OUTPUT_NAME, xrChartDebugRuntimeContent);
            generatedFiles.set(ANALYSIS_TABLE_RUNTIME_OUTPUT_NAME, analysisTableRuntimeContent);
            generatedFiles.set(ANALYSIS_MODE_RUNTIME_OUTPUT_NAME, analysisModeRuntimeContent);
            generatedFiles.set(HISTORICAL_COMPARISON_RUNTIME_OUTPUT_NAME, historicalComparisonRuntimeContent);
            generatedFiles.set(RENDER_BUDGET_RUNTIME_OUTPUT_NAME, renderBudgetRuntimeContent);
            generatedFiles.set(DEPENDENCY_VISUAL_BUDGET_RUNTIME_OUTPUT_NAME, dependencyVisualBudgetRuntimeContent);
            generatedFiles.set(DEPENDENCY_GRAPH_RUNTIME_OUTPUT_NAME, dependencyGraphRuntimeContent);
            generatedFiles.set(CODEXR_DEBUG_RUNTIME_OUTPUT_NAME, codexrDebugRuntimeContent);
            generatedFiles.set('data.json', dataJsonContent);
            codexrRoomTextures.forEach((asset) => {
                generatedFiles.set(asset.relativeOutputPath, asset.content);
            });

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

