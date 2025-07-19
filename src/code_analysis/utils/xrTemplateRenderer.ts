import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { AnalysisSettingsStorage } from '../../utils/analysisSettingsStorage';
import { BabiaChartRegistry } from '../../babia_templates/registry/chartRegistry';
import { TemplateProcessor } from '../../babia_templates/processing/templateProcessor';
import { DimensionMapping } from '../../babia_templates/models/chartModels';

/**
 * XR Template Renderer for File Analysis
 * Delegates to centralized TemplateProcessor for HTML generation
 */
export class XRTemplateRenderer {

    /**
     * Generate and save index.html for XR file analysis using centralized TemplateProcessor
     * 
     * @param context - VS Code extension context
     * @param analysisFolder - URI of the analysis folder (contains data.json)
     * @param filePath - Original file path being analyzed
     * @param analysisData - Analysis data object
     */
    public static async generateXRVisualization(
        context: vscode.ExtensionContext,
        analysisFolder: vscode.Uri,
        filePath: string,
        analysisData: any
    ): Promise<void> {
        console.log(`[XR_TEMPLATE_RENDERER] Generating XR visualization for ${path.basename(filePath)} using centralized TemplateProcessor`);
        
        try {
            // Get current chart configuration
            const chartType = await AnalysisSettingsStorage.getChartTypeFile(context);
            const dimensionMappings = await AnalysisSettingsStorage.getDimensionMappingFile(context);
            
            console.log(`[XR_TEMPLATE_RENDERER] Using chart type: ${chartType}`);
            console.log(`[XR_TEMPLATE_RENDERER] Dimension mappings:`, dimensionMappings);
            
            // Convert field names to XR format if needed
            const mappings: DimensionMapping[] = dimensionMappings.map(mapping => ({
                dimension: mapping.dimension,
                dataField: this.convertToXRFieldName(mapping.dataField),
                label: mapping.label
            }));
            
            // Prepare output path for index.html
            const indexHtmlPath = path.join(analysisFolder.fsPath, 'index.html');
            
            // Use centralized TemplateProcessor to generate the complete XR visualization
            const result = await TemplateProcessor.generateXRVisualization(
                chartType,
                mappings,
                `File Analysis: ${path.basename(filePath)}`,
                './data.json',
                context,
                indexHtmlPath
            );
            
            if (!result.success) {
                console.error(`[XR_TEMPLATE_RENDERER] TemplateProcessor failed:`, result.error);
                throw new Error(`Template processing failed: ${result.error}`);
            }
            
            console.log(`[XR_TEMPLATE_RENDERER] Successfully generated index.html using TemplateProcessor at: ${indexHtmlPath}`);
            
        } catch (error) {
            console.error(`[XR_TEMPLATE_RENDERER] Failed to generate XR visualization:`, error);
            throw error;
        }
    }

    /**
     * Convert field names from static analysis format to XR format
     * Maps legacy field names to standardized XR field names
     */
    private static convertToXRFieldName(fieldName: string): string {
        const fieldMappings: { [key: string]: string } = {
            'ccn': 'complexity',
            'lines_count': 'lineCount',
            'line_start': 'lineStart',
            'line_end': 'lineEnd',
            'function_name': 'fileName',
            'nloc': 'lineCount',
            'parameters': 'parameters',
            'max_nesting_depth': 'maxNestingDepth',
            'cyclomatic_density': 'cyclomaticDensity'
        };
        
        return fieldMappings[fieldName] || fieldName;
    }
}
