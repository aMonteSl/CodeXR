/**
 * Dimension Mapping Validator
 * Validates dimension mappings for conflicts, completeness, and data-type compatibility.
 */

import { ChartMetadata } from '../../../../../babia_templates/models/chartModels';
import { chartTemplates } from '../../../../../babia_templates/charts/templateCharts';
import { DimensionMapping } from '../../../../configuration/models/analysisConfiguration';
import { XRFieldTypeMap } from '../../../../services/xrFieldSchemaService';

export interface DimensionValidationResult {
    isValid: boolean;
    hasConflicts: boolean;
    hasMissingRequired: boolean;
    hasInvalidTypes: boolean;
    conflicts: DimensionConflict[];
    missingRequired: string[];
    invalidTypeMappings: InvalidTypeMapping[];
    warnings: string[];
    errors: string[];
}

export interface DimensionConflict {
    dataField: string;
    conflictingDimensions: string[];
}

export interface InvalidTypeMapping {
    dimension: string;
    dataField: string;
    expectedType: 'numeric';
    actualType: 'numeric' | 'text' | 'unknown';
}

export class DimensionMappingValidator {
    /**
     * Validate dimension mappings for a specific chart.
     */
    static validateMappingsForChart(
        chartType: string,
        currentMappings: DimensionMapping,
        fieldTypes?: XRFieldTypeMap,
    ): DimensionValidationResult {
        console.log(`[DIMENSION_VALIDATOR] Validating mappings for chart: ${chartType}`);
        console.log(`[DIMENSION_VALIDATOR] Current mappings:`, currentMappings);

        const chart = chartTemplates.find((candidate) => candidate.id === chartType);
        if (!chart) {
            return {
                isValid: false,
                hasConflicts: false,
                hasMissingRequired: false,
                hasInvalidTypes: false,
                conflicts: [],
                missingRequired: [],
                invalidTypeMappings: [],
                warnings: [],
                errors: [`Chart type "${chartType}" not found`],
            };
        }

        const conflicts = this.findDimensionConflicts(currentMappings);
        const missingRequired = this.findMissingRequiredDimensions(chart, currentMappings);
        const invalidTypeMappings = this.findInvalidTypeMappings(chart, currentMappings, fieldTypes);

        const warnings: string[] = [];
        const errors: string[] = [];

        if (conflicts.length > 0) {
            for (const conflict of conflicts) {
                warnings.push(
                    `Data field "${conflict.dataField}" is mapped to multiple dimensions: ${conflict.conflictingDimensions.join(', ')}`,
                );
            }
        }

        if (missingRequired.length > 0) {
            errors.push(`Missing required dimension mappings: ${missingRequired.join(', ')}`);
        }

        if (invalidTypeMappings.length > 0) {
            for (const invalidMapping of invalidTypeMappings) {
                errors.push(
                    `Dimension "${invalidMapping.dimension}" requires numeric data, but "${invalidMapping.dataField}" is ${invalidMapping.actualType}.`,
                );
            }
        }

        const result: DimensionValidationResult = {
            isValid: conflicts.length === 0 && missingRequired.length === 0 && invalidTypeMappings.length === 0,
            hasConflicts: conflicts.length > 0,
            hasMissingRequired: missingRequired.length > 0,
            hasInvalidTypes: invalidTypeMappings.length > 0,
            conflicts,
            missingRequired,
            invalidTypeMappings,
            warnings,
            errors,
        };

        console.log('[DIMENSION_VALIDATOR] Validation result:', result);
        return result;
    }

    private static findDimensionConflicts(mappings: DimensionMapping): DimensionConflict[] {
        const dataFieldUsage: Record<string, string[]> = {};

        for (const [dimension, dataField] of Object.entries(mappings)) {
            if (!dataField) {
                continue;
            }

            if (!dataFieldUsage[dataField]) {
                dataFieldUsage[dataField] = [];
            }

            dataFieldUsage[dataField].push(dimension);
        }

        const conflicts: DimensionConflict[] = [];
        for (const [dataField, dimensions] of Object.entries(dataFieldUsage)) {
            if (dimensions.length > 1) {
                conflicts.push({
                    dataField,
                    conflictingDimensions: dimensions,
                });
            }
        }

        return conflicts;
    }

    private static findMissingRequiredDimensions(
        chart: ChartMetadata,
        mappings: DimensionMapping,
    ): string[] {
        return chart.dimensions
            .filter((dimension) => dimension.required && !mappings[dimension.name])
            .map((dimension) => dimension.name);
    }

    private static findInvalidTypeMappings(
        chart: ChartMetadata,
        mappings: DimensionMapping,
        fieldTypes?: XRFieldTypeMap,
    ): InvalidTypeMapping[] {
        if (!fieldTypes) {
            return [];
        }

        const invalidMappings: InvalidTypeMapping[] = [];
        for (const dimension of chart.dimensions) {
            const mappedField = mappings[dimension.name];
            if (!mappedField || dimension.dataType !== 'numeric') {
                continue;
            }

            const actualType = fieldTypes[mappedField] ?? 'unknown';
            if (actualType !== 'numeric') {
                invalidMappings.push({
                    dimension: dimension.name,
                    dataField: mappedField,
                    expectedType: 'numeric',
                    actualType,
                });
            }
        }

        return invalidMappings;
    }

    static canExecuteXRAnalysis(
        chartType: string,
        currentMappings: DimensionMapping,
        fieldTypes?: XRFieldTypeMap,
    ): { canExecute: boolean; reason?: string } {
        const validation = this.validateMappingsForChart(chartType, currentMappings, fieldTypes);

        if (validation.hasMissingRequired) {
            return {
                canExecute: false,
                reason: `Missing required dimensions: ${validation.missingRequired.join(', ')}`,
            };
        }

        if (validation.hasInvalidTypes) {
            return {
                canExecute: false,
                reason: validation.errors.join(' '),
            };
        }

        return { canExecute: true };
    }

    static getDimensionStatus(
        dimensionName: string,
        chartType: string,
        currentMappings: DimensionMapping,
        fieldTypes?: XRFieldTypeMap,
    ): 'valid' | 'conflict' | 'missing' | 'optional' {
        const validation = this.validateMappingsForChart(chartType, currentMappings, fieldTypes);

        if (validation.conflicts.some((conflict) => conflict.conflictingDimensions.includes(dimensionName))) {
            return 'conflict';
        }

        if (validation.invalidTypeMappings.some((mapping) => mapping.dimension === dimensionName)) {
            return 'conflict';
        }

        if (validation.missingRequired.includes(dimensionName)) {
            return 'missing';
        }

        if (currentMappings[dimensionName]) {
            return 'valid';
        }

        return 'optional';
    }
}
