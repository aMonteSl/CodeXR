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
import { injectVirtualScreenViewerConfig } from './virtualScreenConfigInjector';

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

            const virtualScreenRuntimePath = path.join(
                this.context.extensionPath,
                'templates',
                'xr',
                'shared',
                'virtualScreenRuntime.js',
            );
            const virtualScreenOutputPath = path.join(session.outputPath, 'virtualScreenRuntime.js');
            if (!fs.existsSync(virtualScreenRuntimePath)) {
                throw new Error(`Virtual screen runtime not found at ${virtualScreenRuntimePath}`);
            }
            await fs.promises.copyFile(virtualScreenRuntimePath, virtualScreenOutputPath);

            const title = `XR Analysis: ${session.targetName || 'analysis'}`;
            const outputPath = path.join(session.outputPath, 'index.html');
            const templateResult = await TemplateProcessor.generateXRVisualization(
                chartType,
                babiaFormatMappings,
                title,
                'data.json',
                this.context,
                outputPath,
                analysisData,
            );

            if (!templateResult.success) {
                throw new Error(`Template generation failed: ${templateResult.error}`);
            }

            const generatedIndexHtml = await fs.promises.readFile(outputPath, 'utf8');
            const hydratedIndexHtml = injectVirtualScreenViewerConfig(generatedIndexHtml, {
                virtualScreenSessionId: session.id,
                virtualScreenSignalPath: '/codexr/virtual-screen/ws',
                virtualScreenSupportsHostBroadcast: true,
                virtualScreenSupportsLocalCapture: true,
            });
            await fs.promises.writeFile(outputPath, hydratedIndexHtml, 'utf8');

            const loadedFiles = await this.loadGeneratedFiles(session.outputPath);
            if (!loadedFiles.has('index.html') || !loadedFiles.has('data.json') || !loadedFiles.has('virtualScreenRuntime.js')) {
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

