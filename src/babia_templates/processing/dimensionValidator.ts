import { ChartMetadata, DimensionMapping, ChartValidationResult } from '../models/chartModels';

/**
 * BabiaXR Dimension Validator
 * Validates dimension mappings against chart requirements
 */
export class DimensionValidator {
    
    /**
     * Validate dimension mappings for a given chart
     */
    public static validateMappings(
        chart: ChartMetadata, 
        mappings: DimensionMapping[]
    ): ChartValidationResult {
        const result: ChartValidationResult = {
            isValid: true,
            errors: [],
            warnings: []
        };

        // Check for required dimensions
        const requiredDimensions = chart.dimensions.filter(d => d.required);
        const mappedDimensions = new Set(mappings.map(m => m.dimension));

        for (const requiredDim of requiredDimensions) {
            if (!mappedDimensions.has(requiredDim.name)) {
                result.errors.push(`Required dimension '${requiredDim.name}' (${requiredDim.label}) is not mapped`);
                result.isValid = false;
            }
        }

        // Check for invalid dimension names
        const validDimensionNames = new Set(chart.dimensions.map(d => d.name));
        for (const mapping of mappings) {
            if (!validDimensionNames.has(mapping.dimension)) {
                result.errors.push(`Unknown dimension '${mapping.dimension}' for chart type '${chart.name}'`);
                result.isValid = false;
            }
        }

        // Check for duplicate mappings
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

        // Check for empty data fields
        for (const mapping of mappings) {
            if (!mapping.dataField || mapping.dataField.trim() === '') {
                result.errors.push(`Dimension '${mapping.dimension}' has no data field specified`);
                result.isValid = false;
            }
        }

        // Add warnings for optional dimensions that are not mapped
        const optionalDimensions = chart.dimensions.filter(d => !d.required);
        for (const optionalDim of optionalDimensions) {
            if (!mappedDimensions.has(optionalDim.name)) {
                result.warnings.push(`Optional dimension '${optionalDim.name}' (${optionalDim.label}) is not mapped`);
            }
        }

        return result;
    }

    /**
     * Validate a specific data field against dimension requirements
     */
    public static validateDataField(
        dimensionName: string, 
        dataField: string, 
        chart: ChartMetadata
    ): { isValid: boolean; error?: string } {
        const dimension = chart.dimensions.find(d => d.name === dimensionName);
        
        if (!dimension) {
            return {
                isValid: false,
                error: `Dimension '${dimensionName}' does not exist for chart type '${chart.name}'`
            };
        }

        if (!dataField || dataField.trim() === '') {
            return {
                isValid: false,
                error: `Data field for dimension '${dimensionName}' cannot be empty`
            };
        }

        // Additional validation can be added here for data type checking
        // when we have access to actual data structure

        return { isValid: true };
    }

    /**
     * Get missing required dimensions
     */
    public static getMissingRequiredDimensions(
        chart: ChartMetadata, 
        mappings: DimensionMapping[]
    ): string[] {
        const requiredDimensions = chart.dimensions.filter(d => d.required);
        const mappedDimensions = new Set(mappings.map(m => m.dimension));
        
        return requiredDimensions
            .filter(d => !mappedDimensions.has(d.name))
            .map(d => d.name);
    }

    /**
     * Check if all required dimensions are mapped
     */
    public static areAllRequiredDimensionsMapped(
        chart: ChartMetadata, 
        mappings: DimensionMapping[]
    ): boolean {
        return this.getMissingRequiredDimensions(chart, mappings).length === 0;
    }
}
