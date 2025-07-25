import { DimensionMapping } from '../models/chartModels';
import { getVisualizationConfiguration, VisualizationSettings } from '../../utils/getVisualizationConfiguration';
import { CreateChart } from './placeholders/createChart';
import { CreateStructure } from './placeholders/createStructure';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * BabiaXR Template Processor - Modular Architecture
 * Streamlined processor using CreateChart and CreateStructure modules
 * Combines chart entities with structural elements for complete XR visualization
 */
export class TemplateProcessor {

    /**
     * Main method to generate complete XR visualization index.html
     * Uses both CreateChart and CreateStructure modules for modular processing
     */
    public static async generateXRVisualization(
        chartId: string,
        mappings: DimensionMapping[],
        title: string,
        dataSource: string,
        context: vscode.ExtensionContext,
        outputPath: string,
        analysisData?: any[] // Add optional analysis data to detect type
    ): Promise<{ success: boolean; error?: string }> {
        try {
            console.log('TEMPLATE_PROCESSOR: Starting modular XR visualization generation');
            console.log('TEMPLATE_PROCESSOR: Chart ID:', chartId);
            console.log('TEMPLATE_PROCESSOR: Mappings:', mappings);
            console.log('TEMPLATE_PROCESSOR: Title:', title);
            console.log('TEMPLATE_PROCESSOR: Data source:', dataSource);

            // Get visualization settings
            const visualizationSettings = await this.getVisualizationSettings();
            console.log('TEMPLATE_PROCESSOR: Using visualization settings:', visualizationSettings);

            // Detect if this is directory analysis by checking the data structure
            const isDirectoryAnalysis = this.detectDirectoryAnalysis(analysisData);
            console.log('TEMPLATE_PROCESSOR: Detected directory analysis:', isDirectoryAnalysis);

            // Create chart entity using CreateChart module
            const chartResult = CreateChart.createChartEntity(
                chartId,
                mappings,
                title,
                visualizationSettings.palette
            );

            if (!chartResult.success) {
                return { 
                    success: false, 
                    error: `Chart creation failed: ${chartResult.error}` 
                };
            }

            // Create structural placeholders using CreateStructure module
            const structureResult = CreateStructure.createStructuralPlaceholders(
                title,
                dataSource,
                visualizationSettings,
                'xr', // Analysis type for XR visualization
                context,
                chartId, // Pass chart type for tree builder decision
                isDirectoryAnalysis // Pass directory analysis flag
            );

            if (!structureResult.success) {
                return { 
                    success: false, 
                    error: `Structure creation failed: ${structureResult.error}` 
                };
            }

            // Load XR base template
            const xrTemplate = await this.loadXRTemplate(context);
            if (!xrTemplate) {
                return { success: false, error: 'Failed to load XR template' };
            }

            // First, replace chart component placeholder
            let templateWithChart = xrTemplate.replace(
                /\$\{CHART_COMPONENT\}|\{\{\s*CHART_COMPONENT\s*\}\}/g,
                chartResult.chartHtml || ''
            );

            // Then replace all structural placeholders
            let finalHtml = CreateStructure.replaceStructuralPlaceholders(
                templateWithChart, 
                structureResult.placeholders!
            );

            // Special replacement for the SSE script tag in case it wasn't replaced
            const nonce = structureResult.placeholders!.get('nonce') || structureResult.placeholders!.get('NONCE');
            if (nonce) {
                finalHtml = finalHtml.replace(
                    /<script nonce="\$\{nonce\}" src="\$\{scriptUri\}"><\/script>/g,
                    `<script nonce="${nonce}" src="./main.js"></script>`
                );
            }

            // Write the final HTML file
            fs.writeFileSync(outputPath, finalHtml, 'utf8');
            console.log('TEMPLATE_PROCESSOR: Generated modular XR visualization HTML at:', outputPath);

            return { success: true };

        } catch (error) {
            console.error('TEMPLATE_PROCESSOR: Error generating XR visualization:', error);
            return { 
                success: false, 
                error: error instanceof Error ? error.message : String(error) 
            };
        }
    }

    /**
     * Get visualization settings (palette, environment, colors)
     */
    private static async getVisualizationSettings(): Promise<VisualizationSettings> {
        return await getVisualizationConfiguration();
    }

    /**
     * Load XR base template from templates/xr/file/xr-visualization.html
     */
    private static async loadXRTemplate(context: vscode.ExtensionContext): Promise<string | null> {
        try {
            const templatePath = path.join(context.extensionPath, 'templates', 'xr', 'file', 'xr-visualization.html');

            if (!fs.existsSync(templatePath)) {
                console.error('TEMPLATE_PROCESSOR: XR template not found at:', templatePath);
                return null;
            }

            const template = fs.readFileSync(templatePath, 'utf8');
            console.log('TEMPLATE_PROCESSOR: Loaded XR template from:', templatePath);
            return template;

        } catch (error) {
            console.error('TEMPLATE_PROCESSOR: Error loading XR template:', error);
            return null;
        }
    }

    /**
     * Get available charts (delegated to CreateChart)
     */
    public static getAvailableCharts() {
        return CreateChart.getAvailableCharts();
    }

    /**
     * Create default XR analysis mappings (delegated to CreateChart)
     */
    public static createDefaultXRMappings(): DimensionMapping[] {
        return CreateChart.createDefaultXRMappings();
    }

    /**
     * Create structural placeholders for any analysis type (delegated to CreateStructure)
     */
    public static async createStructuralPlaceholders(
        title: string,
        dataSource: string,
        analysisType: 'xr' | 'dom' | 'none',
        context: vscode.ExtensionContext,
        chartType?: string,
        isDirectoryAnalysis?: boolean
    ) {
        const visualizationSettings = await this.getVisualizationSettings();
        return CreateStructure.createStructuralPlaceholders(
            title,
            dataSource,
            visualizationSettings,
            analysisType,
            context,
            chartType,
            isDirectoryAnalysis
        );
    }

    /**
     * Detect if this is a directory analysis by examining the data structure
     * Directory analysis has 'fileName' field, file analysis has 'functionName' field
     */
    private static detectDirectoryAnalysis(analysisData?: any[]): boolean {
        if (!analysisData || !Array.isArray(analysisData) || analysisData.length === 0) {
            return false;
        }

        // Check the first item in the data to determine the type
        const firstItem = analysisData[0];
        if (firstItem && typeof firstItem === 'object') {
            // Directory analysis has 'fileName' field, file analysis has 'functionName' field
            const hasFileName = 'fileName' in firstItem;
            const hasFunctionName = 'functionName' in firstItem;
            
            console.log('TEMPLATE_PROCESSOR: Data structure detection:', {
                hasFileName,
                hasFunctionName,
                keys: Object.keys(firstItem)
            });
            
            return hasFileName && !hasFunctionName;
        }

        return false;
    }
}
