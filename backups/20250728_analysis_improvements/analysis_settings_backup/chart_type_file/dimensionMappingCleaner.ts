/**
 * Dimension Mapping Cleaner
 * Utility for intelligently cleaning dimension mappings when chart type changes
 */

import { chartTemplates } from '../../../../../babia_templates/charts/templateCharts';
import { ChartMetadata } from '../../../../../babia_templates/models/chartModels';
import { DimensionMapping } from '../../../../configuration/models/analysisConfiguration';

export class DimensionMappingCleaner {
    
    /**
     * Clean dimension mappings when chart type changes
     * Keep dimensions that exist in both old and new chart, remove residual dimensions
     */
    static cleanDimensionMappingsForNewChart(
        currentMappings: DimensionMapping,
        newChartType: string
    ): DimensionMapping {
        console.log(`[DIMENSION_CLEANER] Cleaning mappings for new chart type: ${newChartType}`);
        console.log(`[DIMENSION_CLEANER] Current mappings:`, currentMappings);
        
        // Get new chart metadata
        const newChart = chartTemplates.find((chart: ChartMetadata) => chart.id === newChartType);
        
        if (!newChart) {
            console.warn(`[DIMENSION_CLEANER] Chart type "${newChartType}" not found, clearing all mappings`);
            return {};
        }
        
        // Get dimension names from new chart
        const newChartDimensionNames = newChart.dimensions.map((dim: any) => dim.name);
        console.log(`[DIMENSION_CLEANER] New chart dimensions:`, newChartDimensionNames);
        
        // Keep only dimensions that exist in the new chart
        const cleanedMappings: DimensionMapping = {};
        let keptCount = 0;
        let removedCount = 0;
        
        for (const [dimensionName, dataField] of Object.entries(currentMappings)) {
            if (newChartDimensionNames.includes(dimensionName)) {
                cleanedMappings[dimensionName] = dataField;
                keptCount++;
                console.log(`[DIMENSION_CLEANER] ✅ Kept mapping: ${dimensionName} → ${dataField}`);
            } else {
                removedCount++;
                console.log(`[DIMENSION_CLEANER] ❌ Removed mapping: ${dimensionName} → ${dataField} (not in new chart)`);
            }
        }
        
        console.log(`[DIMENSION_CLEANER] Cleanup complete: ${keptCount} kept, ${removedCount} removed`);
        console.log(`[DIMENSION_CLEANER] Cleaned mappings:`, cleanedMappings);
        
        return cleanedMappings;
    }
    
    /**
     * Get chart dimensions for validation
     */
    static getChartDimensions(chartType: string): string[] {
        const chart = chartTemplates.find((chart: ChartMetadata) => chart.id === chartType);
        return chart ? chart.dimensions.map((dim: any) => dim.name) : [];
    }
    
    /**
     * Validate if a dimension mapping is valid for a chart
     */
    static validateMappingForChart(
        mappings: DimensionMapping,
        chartType: string
    ): { isValid: boolean; invalidDimensions: string[] } {
        const validDimensions = this.getChartDimensions(chartType);
        const invalidDimensions = Object.keys(mappings).filter(
            dimension => !validDimensions.includes(dimension)
        );
        
        return {
            isValid: invalidDimensions.length === 0,
            invalidDimensions
        };
    }
}
