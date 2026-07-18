import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { UnifiedAnalysisSession } from '../core/analysisSession';
import { AnalysisConfigurationStorage } from '../../configuration/analysisConfigurationStorage';
import { DimensionValidator } from '../../../babia_templates/processing/dimensionValidator';
import { chartTemplates } from '../../../babia_templates/charts/templateCharts';
import { ChartMetadata, DimensionMapping } from '../../../babia_templates/models/chartModels';
import { TemplateProcessor } from '../../../babia_templates/processing/templateProcessor';
import { ExecutePython } from '../utils/executePython';
import { XRFieldSchemaService } from '../../services/xrFieldSchemaService';
import {
    ANALYSIS_TABLE_RUNTIME_OUTPUT_NAME,
    ANALYSIS_MODE_RUNTIME_OUTPUT_NAME,
    HISTORICAL_COMPARISON_RUNTIME_OUTPUT_NAME,
    PROJECT_EVOLUTION_RUNTIME_OUTPUT_NAME,
    CODEXR_COMMON_RUNTIME_OUTPUT_NAME,
    CODEXR_AVATAR_RUNTIME_OUTPUT_NAME,
    copyAnalysisTableRuntimeToOutput,
    copyAnalysisModeRuntimeToOutput,
    copyHistoricalComparisonRuntimeToOutput,
    copyProjectEvolutionRuntimeToOutput,
    copyCodeXrCommonRuntimeToOutput,
    CODEXR_COLLABORATION_RUNTIME_OUTPUT_NAME,
    copyCodeXrRoomAssetsToOutput,
    copyCodeXrAvatarRuntimeToOutput,
    copyCodeXrCollaborationRuntimeToOutput,
    CODEXR_ROOM_RUNTIME_OUTPUT_NAME,
    copyVirtualScreenManagerRuntimeToOutput,
    copyVirtualScreenRuntimeToOutput,
    VIRTUAL_SCREEN_MANAGER_RUNTIME_OUTPUT_NAME,
    VIRTUAL_SCREEN_RUNTIME_OUTPUT_NAME,
    copyXrChartDebugRuntimeToOutput,
    XR_CHART_DEBUG_RUNTIME_OUTPUT_NAME,
    copyXrChartMappingUiRuntimeToOutput,
    XR_CHART_MAPPING_UI_RUNTIME_OUTPUT_NAME,
    copyCodeXrDebugRuntimeToOutput,
    CODEXR_DEBUG_RUNTIME_OUTPUT_NAME,
    copyRenderBudgetRuntimeToOutput,
    RENDER_BUDGET_RUNTIME_OUTPUT_NAME,
    copyDependencyVisualBudgetRuntimeToOutput,
    DEPENDENCY_VISUAL_BUDGET_RUNTIME_OUTPUT_NAME,
    copyDependencyGraphRuntimeToOutput,
    DEPENDENCY_GRAPH_RUNTIME_OUTPUT_NAME,
} from '../components/customComponents';

interface FileXRSharedBootstrap {
    payload: any[];
}

export interface ParsedXRFileAnalysis {
    sessionId: string;
    chartType: string;
    chartMetadata: ChartMetadata;
    dimensionMappings: DimensionMapping[];
    validationResult: any;
    loadedFiles: Map<string, string>;
}

export class FileXRParser {
    private context: vscode.ExtensionContext;
    private configStorage: AnalysisConfigurationStorage;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.configStorage = AnalysisConfigurationStorage.getInstance(context);
    }

    public async parseFileAnalysis(
        session: UnifiedAnalysisSession,
        _theme?: string,
        bootstrap?: FileXRSharedBootstrap,
    ): Promise<ParsedXRFileAnalysis> {
        try {
            const chartType = await this.configStorage.getChartTypeFile();
            if (!chartType) {
                throw new Error('No chart type configured. Please select a chart type in the Analysis Settings.');
            }

            const chartMetadata = chartTemplates.find((chart) => chart.id === chartType);
            if (!chartMetadata) {
                throw new Error(`Chart type "${chartType}" not found in available charts.`);
            }

            const dimensionMappings = await this.configStorage.getDimensionMappingFile();
            const babiaFormatMappings: DimensionMapping[] = Object.entries(dimensionMappings).map(([dimension, dataField]) => ({
                dimension,
                dataField,
            }));

            const validationResult = DimensionValidator.validateMappings(chartMetadata, babiaFormatMappings);
            this.displayConfigurationInfo(chartType, chartMetadata, babiaFormatMappings, validationResult);

            const analysisData = bootstrap?.payload ?? await new ExecutePython(this.context).executeAnalysis(session);
            if (!Array.isArray(analysisData) || analysisData.length === 0) {
                throw new Error('Python analysis returned no data. Cannot generate XR visualization.');
            }

            await fs.promises.mkdir(session.outputPath, { recursive: true });

            const dataJsonPath = path.join(session.outputPath, 'data.json');
            await fs.promises.writeFile(dataJsonPath, JSON.stringify(analysisData, null, 2), 'utf8');

            const liveSSEPath = path.join(this.context.extensionPath, 'templates', 'xr', 'sse', 'live_sse_fileXR.js');
            const mainJSPath = path.join(session.outputPath, 'main.js');
            if (fs.existsSync(liveSSEPath)) {
                await fs.promises.copyFile(liveSSEPath, mainJSPath);
            }

            await copyVirtualScreenRuntimeToOutput(this.context.extensionPath, session.outputPath);
            await copyVirtualScreenManagerRuntimeToOutput(this.context.extensionPath, session.outputPath);
            await copyCodeXrCommonRuntimeToOutput(this.context.extensionPath, session.outputPath);
            await copyCodeXrAvatarRuntimeToOutput(this.context.extensionPath, session.outputPath);
            await copyCodeXrCollaborationRuntimeToOutput(this.context.extensionPath, session.outputPath);
            await copyCodeXrRoomAssetsToOutput(this.context.extensionPath, session.outputPath);
            await copyXrChartMappingUiRuntimeToOutput(this.context.extensionPath, session.outputPath);
            await copyXrChartDebugRuntimeToOutput(this.context.extensionPath, session.outputPath);
            await copyRenderBudgetRuntimeToOutput(this.context.extensionPath, session.outputPath);
            await copyDependencyVisualBudgetRuntimeToOutput(this.context.extensionPath, session.outputPath);
            await copyDependencyGraphRuntimeToOutput(this.context.extensionPath, session.outputPath);
            await copyCodeXrDebugRuntimeToOutput(this.context.extensionPath, session.outputPath);
            await copyAnalysisTableRuntimeToOutput(this.context.extensionPath, session.outputPath);
            await copyAnalysisModeRuntimeToOutput(this.context.extensionPath, session.outputPath);
            await copyHistoricalComparisonRuntimeToOutput(this.context.extensionPath, session.outputPath);
            await copyProjectEvolutionRuntimeToOutput(this.context.extensionPath, session.outputPath);

            const title = `XR Analysis: ${session.targetName || 'analysis'}`;
            const outputPath = path.join(session.outputPath, 'index.html');
            const babiaUiConfig = await this.configStorage.getXRBabiaUiConfig();
            const fieldTypeMap = await XRFieldSchemaService.getInstance(this.context).getFieldTypeMap('file');
            const templateResult = await TemplateProcessor.generateXRVisualization(
                chartType,
                babiaFormatMappings,
                title,
                'data.json',
                this.context,
                outputPath,
                analysisData,
                {
                    babiaUiVisibleByDefault: babiaUiConfig.visibleByDefault,
                    xrTargetType: 'file',
                    fieldTypeMap,
                },
            );

            if (!templateResult.success) {
                throw new Error(`Template generation failed: ${templateResult.error}`);
            }

            const loadedFiles = await this.loadGeneratedFiles(session.outputPath);
            if (
                !loadedFiles.has('index.html')
                || !loadedFiles.has('data.json')
                || !loadedFiles.has(CODEXR_COMMON_RUNTIME_OUTPUT_NAME)
                || !loadedFiles.has(CODEXR_AVATAR_RUNTIME_OUTPUT_NAME)
                || !loadedFiles.has(CODEXR_COLLABORATION_RUNTIME_OUTPUT_NAME)
                || !loadedFiles.has(VIRTUAL_SCREEN_RUNTIME_OUTPUT_NAME)
                || !loadedFiles.has(VIRTUAL_SCREEN_MANAGER_RUNTIME_OUTPUT_NAME)
                || !loadedFiles.has(CODEXR_ROOM_RUNTIME_OUTPUT_NAME)
                || !loadedFiles.has(XR_CHART_MAPPING_UI_RUNTIME_OUTPUT_NAME)
                || !loadedFiles.has(XR_CHART_DEBUG_RUNTIME_OUTPUT_NAME)
                || !loadedFiles.has(CODEXR_DEBUG_RUNTIME_OUTPUT_NAME)
                || !loadedFiles.has(RENDER_BUDGET_RUNTIME_OUTPUT_NAME)
                || !loadedFiles.has(DEPENDENCY_VISUAL_BUDGET_RUNTIME_OUTPUT_NAME)
                || !loadedFiles.has(DEPENDENCY_GRAPH_RUNTIME_OUTPUT_NAME)
                || !loadedFiles.has(ANALYSIS_TABLE_RUNTIME_OUTPUT_NAME)
                || !loadedFiles.has(ANALYSIS_MODE_RUNTIME_OUTPUT_NAME)
                || !loadedFiles.has(HISTORICAL_COMPARISON_RUNTIME_OUTPUT_NAME)
                || !loadedFiles.has(PROJECT_EVOLUTION_RUNTIME_OUTPUT_NAME)
            ) {
                throw new Error('XR file bootstrap did not generate the required files.');
            }

            session.metadata.mainHtmlFileName = 'index.html';

            return {
                sessionId: session.id,
                chartType,
                chartMetadata,
                dimensionMappings: babiaFormatMappings,
                validationResult,
                loadedFiles,
            };
        } catch (error) {
            vscode.window.showErrorMessage(
                `XR Analysis Configuration Error: ${error instanceof Error ? error.message : String(error)}`,
            );
            throw error;
        }
    }

    private displayConfigurationInfo(
        chartType: string,
        chartMetadata: ChartMetadata,
        dimensionMappings: DimensionMapping[],
        validationResult: any,
    ): void {
        const mappingsCount = dimensionMappings.length;
        const dimensionsCount = chartMetadata.dimensions.length;
        const requiredDimensionsCount = chartMetadata.dimensions.filter((dimension) => dimension.required).length;
        const statusIcon = validationResult.isValid ? 'check' : 'warning';
        const summaryMessage = `${chartType} chart with ${mappingsCount}/${dimensionsCount} dimensions mapped (${requiredDimensionsCount} required)`;

        if (validationResult.isValid) {
            vscode.window.showInformationMessage(`XR config ready: ${summaryMessage}`);
        } else {
            vscode.window.showWarningMessage(`XR config needs attention: ${summaryMessage}`);
        }

        console.log('FILE_XR_PARSER: Current XR file configuration', {
            chartType,
            dimensionMappings,
            validationResult,
        });
    }

    private async loadGeneratedFiles(outputPath: string): Promise<Map<string, string>> {
        const loadedFiles = new Map<string, string>();

        if (!fs.existsSync(outputPath)) {
            return loadedFiles;
        }

        const files = await fs.promises.readdir(outputPath, { withFileTypes: true });
        for (const file of files) {
            if (!file.isFile()) {
                continue;
            }

            const filePath = path.join(outputPath, file.name);
            loadedFiles.set(file.name, await fs.promises.readFile(filePath, 'utf8'));
        }

        return loadedFiles;
    }
}

