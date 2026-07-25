import { ChartMetadata, DimensionMapping, ChartValidationResult } from '../models/chartModels';
import { XRFieldTypeMap } from '../../code_analysis/services/xrFieldSchemaService';

/**
 * BabiaXR Dimension Validator
 * Validates dimension mappings against chart requirements.
 */
export class DimensionValidator {
    public static validateMappings(
        chart: ChartMetadata,
        mappings: DimensionMapping[],
        fieldTypes?: XRFieldTypeMap,
    ): ChartValidationResult {
        const result: ChartValidationResult = {
            isValid: true,
            errors: [],
            warnings: [],
        };

        const requiredDimensions = chart.dimensions.filter((dimension) => dimension.required);
        const mappedDimensions = new Set(mappings.map((mapping) => mapping.dimension));

        for (const requiredDim of requiredDimensions) {
            if (!mappedDimensions.has(requiredDim.name)) {
                result.errors.push(`Required dimension '${requiredDim.name}' (${requiredDim.label}) is not mapped`);
                result.isValid = false;
            }
        }

        const validDimensionNames = new Set(chart.dimensions.map((dimension) => dimension.name));
        for (const mapping of mappings) {
            if (!validDimensionNames.has(mapping.dimension)) {
                result.errors.push(`Unknown dimension '${mapping.dimension}' for chart type '${chart.name}'`);
                result.isValid = false;
            }
        }

        const dimensionCounts = new Map<string, number>();
        for (const mapping of mappings) {
            const count = dimensionCounts.get(mapping.dimension) || 0;
            dimensionCounts.set(mapping.dimension, count + 1);
        }

        for (const [dimension, count] of dimensionCounts) {
            if (count > 1) {
                result.errors.push(`Dimension '${dimension}' is mapped multiple times`);
                result.isValid = false;
            }
        }

        for (const mapping of mappings) {
            if (!mapping.dataField || mapping.dataField.trim() === '') {
                result.errors.push(`Dimension '${mapping.dimension}' has no data field specified`);
                result.isValid = false;
                continue;
            }

            const dimension = chart.dimensions.find((candidate) => candidate.name === mapping.dimension);
            if (!dimension || !fieldTypes) {
                continue;
            }

            // 'any' skips the TYPE check but the field must still exist in the
            // schema — a typo used to sail through untouched.
            const actualType = fieldTypes[mapping.dataField];
            if (actualType === undefined) {
                result.errors.push(`Data field '${mapping.dataField}' is not available for chart type '${chart.name}'`);
                result.isValid = false;
                continue;
            }

            if (dimension.dataType !== 'any' && actualType !== dimension.dataType) {
                result.errors.push(
                    `Dimension '${mapping.dimension}' (${dimension.label}) requires ${dimension.dataType} data, but '${mapping.dataField}' is ${actualType}`,
                );
                result.isValid = false;
            }
        }

        const optionalDimensions = chart.dimensions.filter((dimension) => !dimension.required);
        for (const optionalDim of optionalDimensions) {
            if (!mappedDimensions.has(optionalDim.name)) {
                result.warnings.push(`Optional dimension '${optionalDim.name}' (${optionalDim.label}) is not mapped`);
            }
        }

        return result;
    }

    public static validateDataField(
        dimensionName: string,
        dataField: string,
        chart: ChartMetadata,
        fieldTypes?: XRFieldTypeMap,
    ): { isValid: boolean; error?: string } {
        const dimension = chart.dimensions.find((candidate) => candidate.name === dimensionName);

        if (!dimension) {
            return {
                isValid: false,
                error: `Dimension '${dimensionName}' does not exist for chart type '${chart.name}'`,
            };
        }

        if (!dataField || dataField.trim() === '') {
            return {
                isValid: false,
                error: `Data field for dimension '${dimensionName}' cannot be empty`,
            };
        }

        if (fieldTypes) {
            const actualType = fieldTypes[dataField];
            if (actualType === undefined) {
                return {
                    isValid: false,
                    error: `Data field '${dataField}' is not available for chart type '${chart.name}'`,
                };
            }

            if (dimension.dataType !== 'any' && actualType !== dimension.dataType) {
                return {
                    isValid: false,
                    error: `Dimension '${dimensionName}' requires ${dimension.dataType} data, but '${dataField}' is ${actualType}`,
                };
            }
        }

        return { isValid: true };
    }

    public static getMissingRequiredDimensions(
        chart: ChartMetadata,
        mappings: DimensionMapping[],
    ): string[] {
        const requiredDimensions = chart.dimensions.filter((dimension) => dimension.required);
        const mappedDimensions = new Set(mappings.map((mapping) => mapping.dimension));

        return requiredDimensions
            .filter((dimension) => !mappedDimensions.has(dimension.name))
            .map((dimension) => dimension.name);
    }

    public static areAllRequiredDimensionsMapped(
        chart: ChartMetadata,
        mappings: DimensionMapping[],
    ): boolean {
        return this.getMissingRequiredDimensions(chart, mappings).length === 0;
    }
}
