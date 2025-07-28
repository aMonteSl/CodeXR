/**
 * Dimension Mapping Validator
 * Validates dimension mappings for conflicts and completeness
 */

import { ChartDimension, ChartMetadata } from '../../../../../babia_templates/models/chartModels';
import { chartTemplates } from '../../../../../babia_templates/charts/templateCharts';
import { DimensionMapping } from '../../../../configuration/models/analysisConfiguration';

export interface DimensionValidationResult {
    isValid: boolean;
    hasConflicts: boolean;
    hasMissingRequired: boolean;
    conflicts: DimensionConflict[];
    missingRequired: string[];
    warnings: string[];
    errors: string[];
}

export interface DimensionConflict {
    dataField: string;
    conflictingDimensions: string[];
}

export class DimensionMappingValidator {
    
    /**
     * Validate dimension mappings for a specific chart
     */
    static validateMappingsForChart(
        chartType: string,
        currentMappings: DimensionMapping
    ): DimensionValidationResult {
        console.log(`[DIMENSION_VALIDATOR] Validating mappings for chart: ${chartType}`);
        console.log(`[DIMENSION_VALIDATOR] Current mappings:`, currentMappings);
        
        const chart = chartTemplates.find(c => c.id === chartType);
        if (!chart) {
            return {
                isValid: false,
                hasConflicts: false,
                hasMissingRequired: false,
                conflicts: [],
                missingRequired: [],
                warnings: [],
                errors: [`Chart type "${chartType}" not found`]
            };
        }
        
        // Check for conflicts (same data field mapped to multiple dimensions)
        const conflicts = this.findDimensionConflicts(currentMappings);
        
        // Check for missing required dimensions
        const missingRequired = this.findMissingRequiredDimensions(chart, currentMappings);
        
        // Generate warnings and errors
        const warnings: string[] = [];
        const errors: string[] = [];
        
        if (conflicts.length > 0) {
            for (const conflict of conflicts) {
                warnings.push(
                    `Data field "${conflict.dataField}" is mapped to multiple dimensions: ${conflict.conflictingDimensions.join(', ')}`
                );
            }
        }
        
        if (missingRequired.length > 0) {
            errors.push(`Missing required dimension mappings: ${missingRequired.join(', ')}`);
        }
        
        const result: DimensionValidationResult = {
            isValid: conflicts.length === 0 && missingRequired.length === 0,
            hasConflicts: conflicts.length > 0,
            hasMissingRequired: missingRequired.length > 0,
            conflicts,
            missingRequired,
            warnings,
            errors
        };
        
        console.log(`[DIMENSION_VALIDATOR] Validation result:`, result);
        return result;
    }
    
    /**
     * Find conflicts where the same data field is mapped to multiple dimensions
     */
    private static findDimensionConflicts(mappings: DimensionMapping): DimensionConflict[] {
        const dataFieldUsage: Record<string, string[]> = {};
        
        // Group dimensions by data field
        for (const [dimension, dataField] of Object.entries(mappings)) {
            if (!dataFieldUsage[dataField]) {
                dataFieldUsage[dataField] = [];
            }
            dataFieldUsage[dataField].push(dimension);
        }
        
        // Find conflicts (data fields used by multiple dimensions)
        const conflicts: DimensionConflict[] = [];
        for (const [dataField, dimensions] of Object.entries(dataFieldUsage)) {
            if (dimensions.length > 1) {
                conflicts.push({
                    dataField,
                    conflictingDimensions: dimensions
                });
            }
        }
        
        return conflicts;
    }
    
    /**
     * Find missing required dimensions
     */
    private static findMissingRequiredDimensions(
        chart: ChartMetadata,
        mappings: DimensionMapping
    ): string[] {
        const missing: string[] = [];
        
        for (const dimension of chart.dimensions) {
            if (dimension.required && !mappings[dimension.name]) {
                missing.push(dimension.name);
            }
        }
        
        return missing;
    }
    
    /**
     * Check if dimension mappings are ready for XR analysis
     */
    static canExecuteXRAnalysis(
        chartType: string,
        currentMappings: DimensionMapping
    ): { canExecute: boolean; reason?: string } {
        const validation = this.validateMappingsForChart(chartType, currentMappings);
        
        if (validation.hasMissingRequired) {
            return {
                canExecute: false,
                reason: `Missing required dimensions: ${validation.missingRequired.join(', ')}`
            };
        }
        
        // Allow execution even with conflicts (user can choose to do it)
        return { canExecute: true };
    }
    
    /**
     * Get dimension status for UI display
     */
    static getDimensionStatus(
        dimensionName: string,
        chartType: string,
        currentMappings: DimensionMapping
    ): 'valid' | 'conflict' | 'missing' | 'optional' {
        const validation = this.validateMappingsForChart(chartType, currentMappings);
        
        // Check if this dimension has conflicts
        for (const conflict of validation.conflicts) {
            if (conflict.conflictingDimensions.includes(dimensionName)) {
                return 'conflict';
            }
        }
        
        // Check if this dimension is missing and required
        if (validation.missingRequired.includes(dimensionName)) {
            return 'missing';
        }
        
        // Check if mapped
        if (currentMappings[dimensionName]) {
            return 'valid';
        }
        
        return 'optional';
    }
}
