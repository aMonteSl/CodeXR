"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonFieldAnalyzer = void 0;
const fs = __importStar(require("fs"));
/**
 * JSON Field Analyzer
 * Analyzes JSON files to extract available fields and their types
 */
class JsonFieldAnalyzer {
    /**
     * Analyze a JSON file and extract field information
     */
    static async analyzeJsonFile(filePath) {
        console.log(`DIMENSION-MAPPING: Analyzing JSON file: ${filePath}`);
        try {
            // Read and parse JSON file
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const jsonData = JSON.parse(fileContent);
            console.log(`DIMENSION-MAPPING: JSON parsed successfully`);
            // Analyze the data structure
            const analysisResult = this.analyzeDataStructure(jsonData, filePath);
            console.log(`DIMENSION-MAPPING: Found ${analysisResult.fields.length} fields in ${analysisResult.recordCount} records`);
            analysisResult.fields.forEach(field => {
                console.log(`DIMENSION-MAPPING: Field '${field.name}' - Type: ${field.type}, Numeric: ${field.isNumeric}, Values: ${field.valueCount}`);
            });
            return analysisResult;
        }
        catch (error) {
            console.error(`DIMENSION-MAPPING: Error analyzing JSON file:`, error);
            return {
                success: false,
                fields: [],
                error: `Failed to analyze JSON file: ${error instanceof Error ? error.message : 'Unknown error'}`,
                recordCount: 0,
                filePath
            };
        }
    }
    /**
     * Analyze data structure and extract field information
     */
    static analyzeDataStructure(data, filePath) {
        const fields = new Map();
        let recordCount = 0;
        // Handle different data structures
        if (Array.isArray(data)) {
            // Array of objects
            recordCount = data.length;
            data.forEach((record, index) => {
                if (typeof record === 'object' && record !== null) {
                    this.analyzeRecord(record, fields, index < 10); // Only collect samples from first 10 records
                }
            });
        }
        else if (typeof data === 'object' && data !== null) {
            // Single object
            recordCount = 1;
            this.analyzeRecord(data, fields, true);
        }
        else {
            throw new Error('JSON data must be an object or array of objects');
        }
        return {
            success: true,
            fields: Array.from(fields.values()),
            recordCount,
            filePath
        };
    }
    /**
     * Analyze a single record and update field information
     */
    static analyzeRecord(record, fields, collectSamples) {
        for (const [fieldName, value] of Object.entries(record)) {
            let fieldInfo = fields.get(fieldName);
            if (!fieldInfo) {
                fieldInfo = {
                    name: fieldName,
                    type: 'unknown',
                    isNumeric: false,
                    sampleValues: [],
                    valueCount: 0
                };
                fields.set(fieldName, fieldInfo);
            }
            // Skip null/undefined values
            if (value === null || value === undefined) {
                return;
            }
            fieldInfo.valueCount++;
            // Determine field type
            const valueType = this.getValueType(value);
            if (fieldInfo.type === 'unknown') {
                fieldInfo.type = valueType;
            }
            else if (fieldInfo.type !== valueType) {
                // Mixed types - mark as string by default
                fieldInfo.type = 'string';
            }
            // Check if numeric
            if (this.isNumericValue(value)) {
                fieldInfo.isNumeric = true;
            }
            // Collect sample values
            if (collectSamples && fieldInfo.sampleValues.length < 5) {
                fieldInfo.sampleValues.push(value);
            }
        }
    }
    /**
     * Get the type of a value
     */
    static getValueType(value) {
        if (typeof value === 'string') {
            return 'string';
        }
        if (typeof value === 'number') {
            return 'number';
        }
        if (typeof value === 'boolean') {
            return 'boolean';
        }
        if (Array.isArray(value)) {
            return 'array';
        }
        if (typeof value === 'object') {
            return 'object';
        }
        if (value === null) {
            return 'null';
        }
        return 'unknown';
    }
    /**
     * Check if a value is numeric
     */
    static isNumericValue(value) {
        if (typeof value === 'number') {
            return !isNaN(value) && isFinite(value);
        }
        if (typeof value === 'string') {
            const num = parseFloat(value);
            return !isNaN(num) && isFinite(num) && value.trim() !== '';
        }
        return false;
    }
    /**
     * Get fields suitable for a specific dimension type
     */
    static getFieldsForDimensionType(analysisResult, dimensionDataType) {
        if (!analysisResult.success) {
            return [];
        }
        if (dimensionDataType === 'numeric') {
            return analysisResult.fields.filter(field => field.isNumeric);
        }
        // For 'any' type, return all fields
        return analysisResult.fields;
    }
    /**
     * Format field for display in QuickPick
     */
    static formatFieldForDisplay(field) {
        const typeInfo = field.isNumeric ? `${field.type} (numeric)` : field.type;
        const sampleText = field.sampleValues.length > 0
            ? `Samples: ${field.sampleValues.slice(0, 3).map(v => JSON.stringify(v)).join(', ')}`
            : '';
        return {
            label: field.name,
            description: typeInfo,
            detail: `${field.valueCount} values${sampleText ? ' • ' + sampleText : ''}`
        };
    }
}
exports.JsonFieldAnalyzer = JsonFieldAnalyzer;
//# sourceMappingURL=jsonFieldAnalyzer.js.map