"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENHANCED_CHART_TEMPLATES = exports.CHART_TEMPLATES = exports.FieldType = void 0;
exports.getChartTemplateDefaultDimensions = getChartTemplateDefaultDimensions;
exports.getFileAnalysisChartTemplates = getFileAnalysisChartTemplates;
exports.getDirectoryAnalysisChartTemplates = getDirectoryAnalysisChartTemplates;
exports.getAllChartTemplates = getAllChartTemplates;
exports.getChartTemplate = getChartTemplate;
exports.getChartTemplatePickOptions = getChartTemplatePickOptions;
exports.normalizeChartTypeId = normalizeChartTypeId;
exports.getEnhancedChartTemplate = getEnhancedChartTemplate;
exports.generateChartComponent = generateChartComponent;
/**
 * Available field types for chart attributes
 */
var FieldType;
(function (FieldType) {
    FieldType["NUMERIC"] = "numeric";
    FieldType["CATEGORICAL"] = "categorical";
    FieldType["ANY"] = "any";
})(FieldType || (exports.FieldType = FieldType = {}));
/**
 * Available chart templates registry
 */
exports.CHART_TEMPLATES = {
    boats: {
        id: 'boats',
        displayName: 'Boats Chart',
        description: 'Area-based 3D boat-like visualization with customizable height, area, and color',
        supportsFileAnalysis: true,
        supportsDirectoryAnalysis: true,
        babiaComponent: 'babia-boats',
        defaultDimensions: {
            area: 'parameters',
            height: 'linesCount',
            color: 'complexity'
        },
        directoryDefaultDimensions: {
            area: 'functionCount',
            height: 'totalLines',
            color: 'meanComplexity'
        }
    },
    bars: {
        id: 'bars',
        displayName: 'Bars Chart',
        description: '2D bar chart with X-axis categories and height values',
        supportsFileAnalysis: true,
        supportsDirectoryAnalysis: true,
        babiaComponent: 'babia-bars',
        defaultDimensions: {
            x_axis: 'functionName',
            height: 'linesCount'
        },
        directoryDefaultDimensions: {
            x_axis: 'fileName',
            height: 'totalLines'
        }
    },
    cyls: {
        id: 'cyls',
        displayName: 'Cyls Chart',
        description: '2D cylindrical bars with X-axis categories, height, and radius',
        supportsFileAnalysis: true,
        supportsDirectoryAnalysis: true,
        babiaComponent: 'babia-cyls',
        defaultDimensions: {
            x_axis: 'functionName',
            height: 'linesCount',
            radius: 'complexity'
        },
        directoryDefaultDimensions: {
            x_axis: 'fileName',
            height: 'totalLines',
            radius: 'meanComplexity'
        }
    },
    cylsmap: {
        id: 'cylsmap',
        displayName: 'Cylsmap Chart',
        description: '3D cylindrical bars with X-axis, Z-axis, height, and radius dimensions',
        supportsFileAnalysis: true,
        supportsDirectoryAnalysis: true,
        babiaComponent: 'babia-cylsmap',
        defaultDimensions: {
            x_axis: 'functionName',
            z_axis: 'parameters',
            height: 'linesCount',
            radius: 'complexity'
        },
        directoryDefaultDimensions: {
            x_axis: 'fileName',
            z_axis: 'functionCount',
            height: 'totalLines',
            radius: 'meanComplexity'
        }
    },
    bubbles: {
        id: 'bubbles',
        displayName: 'Bubbles Chart',
        description: '3D bubbles with X/Z positioning, customizable height and radius',
        supportsFileAnalysis: true,
        supportsDirectoryAnalysis: true,
        babiaComponent: 'babia-bubbles',
        defaultDimensions: {
            x_axis: 'functionName',
            z_axis: 'parameters',
            height: 'linesCount',
            radius: 'complexity'
        },
        directoryDefaultDimensions: {
            x_axis: 'fileName',
            z_axis: 'language',
            height: 'meanComplexity',
            radius: 'functionCount'
        }
    },
    barsmap: {
        id: 'barsmap',
        displayName: 'Barsmap Chart',
        description: '3D bar chart with X-axis categories, Z-axis grouping, and height values',
        supportsFileAnalysis: true,
        supportsDirectoryAnalysis: true,
        babiaComponent: 'babia-barsmap',
        defaultDimensions: {
            x_axis: 'functionName',
            height: 'linesCount',
            z_axis: 'parameters'
        },
        directoryDefaultDimensions: {
            x_axis: 'fileName',
            height: 'totalLines',
            z_axis: 'functionCount'
        }
    },
    pie: {
        id: 'pie',
        displayName: 'Pie Chart',
        description: 'Circular sectors showing proportional data',
        supportsFileAnalysis: true,
        supportsDirectoryAnalysis: true,
        babiaComponent: 'babia-pie',
        defaultDimensions: {
            key: 'functionName',
            size: 'linesCount'
        },
        directoryDefaultDimensions: {
            key: 'fileName',
            size: 'totalLines'
        }
    },
    donut: {
        id: 'donut',
        displayName: 'Donut Chart',
        description: 'Circular chart with center hole showing proportional data',
        supportsFileAnalysis: true,
        supportsDirectoryAnalysis: true,
        babiaComponent: 'babia-doughnut',
        defaultDimensions: {
            key: 'functionName',
            size: 'linesCount'
        },
        directoryDefaultDimensions: {
            key: 'fileName',
            size: 'totalLines'
        }
    }
};
/**
 * Enhanced chart templates with proper attribute validation (ordered as requested)
 */
exports.ENHANCED_CHART_TEMPLATES = {
    boats: {
        ...exports.CHART_TEMPLATES.boats,
        attributes: [
            { name: 'area', type: FieldType.ANY, description: 'Area size (any field type)' },
            { name: 'height', type: FieldType.ANY, description: 'Height dimension (any field type)' },
            { name: 'color', type: FieldType.ANY, description: 'Color mapping (any field type)' }
        ],
        position: '0 1 -10',
        rotation: '0 0 0',
        scale: '1.5 1.5 1.5'
    },
    bars: {
        ...exports.CHART_TEMPLATES.bars,
        attributes: [
            { name: 'x_axis', type: FieldType.ANY, description: 'X-axis categories (any field)' },
            { name: 'height', type: FieldType.NUMERIC, description: 'Bar height (numeric field only)' }
        ],
        position: '0 2 -10',
        rotation: '0 0 0',
        scale: '1.5 1.5 1.5'
    },
    barsmap: {
        ...exports.CHART_TEMPLATES.barsmap,
        attributes: [
            { name: 'x_axis', type: FieldType.ANY, description: 'X-axis categories (any field)' },
            { name: 'height', type: FieldType.NUMERIC, description: 'Bar height (numeric field only)' },
            { name: 'z_axis', type: FieldType.ANY, description: 'Z-axis grouping (any field)' }
        ],
        position: '0 2 -10',
        rotation: '0 0 0',
        scale: '1.5 1.5 1.5'
    },
    cyls: {
        ...exports.CHART_TEMPLATES.cyls,
        attributes: [
            { name: 'x_axis', type: FieldType.ANY, description: 'X-axis categories (any field)' },
            { name: 'height', type: FieldType.NUMERIC, description: 'Cylinder height (numeric field only)' },
            { name: 'radius', type: FieldType.NUMERIC, description: 'Cylinder radius (numeric field only)' }
        ],
        position: '0 1 -10',
        rotation: '0 0 0',
        scale: '1.5 1.5 1.5'
    },
    cylsmap: {
        ...exports.CHART_TEMPLATES.cylsmap,
        attributes: [
            { name: 'x_axis', type: FieldType.ANY, description: 'X-axis categories (any field)' },
            { name: 'z_axis', type: FieldType.ANY, description: 'Z-axis grouping (any field)' },
            { name: 'height', type: FieldType.NUMERIC, description: 'Cylinder height (numeric field only)' },
            { name: 'radius', type: FieldType.NUMERIC, description: 'Cylinder radius (numeric field only)' }
        ],
        position: '0 1 -10',
        rotation: '0 0 0',
        scale: '1.5 1.5 1.5'
    },
    pie: {
        ...exports.CHART_TEMPLATES.pie,
        attributes: [
            { name: 'key', type: FieldType.ANY, description: 'Data categories (any field)' },
            { name: 'size', type: FieldType.NUMERIC, description: 'Sector size (numeric field only)' }
        ],
        position: '0 3 -10',
        rotation: '90 0 0',
        scale: '1.5 1.5 1.5'
    },
    donut: {
        ...exports.CHART_TEMPLATES.donut,
        attributes: [
            { name: 'key', type: FieldType.ANY, description: 'Data categories (any field)' },
            { name: 'size', type: FieldType.NUMERIC, description: 'Ring size (numeric field only)' }
        ],
        position: '0 3 -10',
        rotation: '90 0 0',
        scale: '1.5 1.5 1.5'
    },
    bubbles: {
        ...exports.CHART_TEMPLATES.bubbles,
        attributes: [
            { name: 'x_axis', type: FieldType.ANY, description: 'X-axis categories (any field type)' },
            { name: 'z_axis', type: FieldType.ANY, description: 'Z-axis grouping (any field type)' },
            { name: 'height', type: FieldType.NUMERIC, description: 'Bubble height (numeric field only)' },
            { name: 'radius', type: FieldType.NUMERIC, description: 'Bubble radius (numeric field only)' }
        ],
        position: '0 1 -10',
        rotation: '0 0 0',
        scale: '1.5 1.5 1.5'
    }
};
/**
 * Get the default dimensions for a chart template based on analysis type
 */
function getChartTemplateDefaultDimensions(templateId, analysisType = 'File') {
    const template = exports.CHART_TEMPLATES[templateId];
    if (!template) {
        console.warn(`Unknown chart template: ${templateId}, defaulting to boats`);
        return getChartTemplateDefaultDimensions('boats', analysisType);
    }
    if (analysisType === 'Directory' && template.directoryDefaultDimensions) {
        return template.directoryDefaultDimensions;
    }
    return template.defaultDimensions;
}
/**
 * Get chart templates available for file analysis
 */
function getFileAnalysisChartTemplates() {
    return Object.values(exports.CHART_TEMPLATES).filter(template => template.supportsFileAnalysis);
}
/**
 * Get chart templates available for directory analysis
 */
function getDirectoryAnalysisChartTemplates() {
    return Object.values(exports.CHART_TEMPLATES).filter(template => template.supportsDirectoryAnalysis);
}
/**
 * Get all available chart templates
 */
function getAllChartTemplates() {
    return Object.values(exports.CHART_TEMPLATES);
}
/**
 * Get a specific chart template by ID
 */
function getChartTemplate(id) {
    return exports.CHART_TEMPLATES[id];
}
/**
 * Get chart template options for VS Code quick pick
 */
function getChartTemplatePickOptions(analysisType = 'all') {
    // Define the exact order we want
    const chartOrder = ['boats', 'bars', 'barsmap', 'cyls', 'cylsmap', 'pie', 'donut', 'bubbles'];
    let availableTemplates;
    switch (analysisType) {
        case 'file':
            availableTemplates = getFileAnalysisChartTemplates();
            break;
        case 'directory':
            availableTemplates = getDirectoryAnalysisChartTemplates();
            break;
        default:
            availableTemplates = getAllChartTemplates();
    }
    // Create a map for easy lookup
    const templateMap = new Map();
    availableTemplates.forEach(template => {
        templateMap.set(template.id, template);
    });
    // Return templates in the specified order
    return chartOrder
        .filter(id => templateMap.has(id))
        .map(id => {
        const template = templateMap.get(id);
        return {
            label: template.displayName,
            description: template.description,
            value: template.id
        };
    });
}
/**
 * Normalize chart type ID to handle different naming conventions
 */
function normalizeChartTypeId(chartType) {
    const lower = chartType.toLowerCase();
    // Handle cylsmap first (more specific)
    if (lower.includes('cylsmap')) {
        return 'cylsmap';
    }
    // Handle different naming conventions
    if (lower.includes('cylinder') || lower.includes('cyls')) {
        return 'cyls';
    }
    if (lower.includes('bubble')) {
        return 'bubbles';
    }
    if (lower.includes('doughnut')) {
        return 'donut';
    }
    // Direct matches
    const validIds = Object.keys(exports.CHART_TEMPLATES);
    if (validIds.includes(lower)) {
        return lower;
    }
    // Partial matches
    for (const id of validIds) {
        if (lower.includes(id)) {
            return id;
        }
    }
    console.warn(`Unknown chart type: ${chartType}, defaulting to boats`);
    return 'boats';
}
/**
 * Get enhanced chart template with validation
 */
function getEnhancedChartTemplate(chartType) {
    return exports.ENHANCED_CHART_TEMPLATES[chartType] || null;
}
/**
 * Generate chart component with dynamic title and proper validation
 */
function generateChartComponent(chartType, dimensionMapping, title, analysisType = 'directory') {
    const template = getEnhancedChartTemplate(chartType);
    if (!template) {
        console.warn(`Unknown chart type: ${chartType}, falling back to boats`);
        return generateChartComponent('boats', dimensionMapping, title, analysisType);
    }
    // Validate dimension mapping against attribute types
    const validatedMapping = validateDimensionMapping(template, dimensionMapping, analysisType);
    // Build the dimension attributes string
    const dimensionAttrs = Object.entries(validatedMapping)
        .map(([dim, field]) => `${dim}: ${field}`)
        .join(';\n                              ');
    // Generate component based on chart type
    if (chartType === 'pie' || chartType === 'donut') {
        return generatePieDonutComponent(template, dimensionAttrs, title, analysisType);
    }
    else if (chartType === 'bars' || chartType === 'barsmap') {
        return generateBarsComponent(template, dimensionAttrs, title, analysisType);
    }
    else if (chartType === 'cyls' || chartType === 'cylsmap') {
        return generateCylindersComponent(template, dimensionAttrs, title, analysisType);
    }
    else if (chartType === 'boats') {
        return generateBoatsComponent(template, dimensionAttrs, title, analysisType);
    }
    else if (chartType === 'bubbles') {
        return generateBubblesComponent(template, dimensionAttrs, title, analysisType);
    }
    else {
        return generateStandardComponent(template, dimensionAttrs, title, analysisType);
    }
}
/**
 * Generate pie/donut chart component with proper title placeholder
 */
function generatePieDonutComponent(template, dimensionAttrs, title, analysisType = 'directory') {
    return `
        <!-- ${analysisType === 'file' ? 'File' : 'Directory'} XR ${template.displayName} Visualization -->
        <a-entity id="chart"
                  ${template.babiaComponent}="from: data;
                              title: '${title}';
                              legend: true;
                              palette: pearl;
                              ${dimensionAttrs};
                              animation: false;"
                  position="${template.position || '0 3 -10'}"
                  rotation="${template.rotation || '90 0 0'}"
                  scale="${template.scale || '1.5 1.5 1.5'}"
                  class="babiaxraycasterclass">
        </a-entity>
      `;
}
/**
 * Generate bars/barsmap chart component with proper title placeholder and axis_name
 */
function generateBarsComponent(template, dimensionAttrs, title, analysisType = 'directory') {
    return `
        <!-- ${analysisType === 'file' ? 'File' : 'Directory'} XR ${template.displayName} Visualization -->
        <a-entity id="chart"
                  ${template.babiaComponent}="from: data;
                              title: '${title}';
                              legend: true;
                              palette: pearl;
                              ${dimensionAttrs};
                              axis_name: true"
                  position="${template.position || '0 2 -10'}"
                  rotation="${template.rotation || '0 0 0'}"
                  scale="${template.scale || '1.5 1.5 1.5'}"
                  class="babiaxraycasterclass">
        </a-entity>
      `;
}
/**
 * Generate cylinders/cylsmap chart component with proper title placeholder and axis_name
 */
function generateCylindersComponent(template, dimensionAttrs, title, analysisType = 'directory') {
    return `
        <!-- ${analysisType === 'file' ? 'File' : 'Directory'} XR ${template.displayName} Visualization -->
        <a-entity id="chart"
                  ${template.babiaComponent}="from: data;
                              title: '${title}';
                              legend: true;
                              palette: pearl;
                              ${dimensionAttrs};
                              axis_name: true"
                  position="${template.position || '0 1 -10'}"
                  rotation="${template.rotation || '0 0 0'}"
                  scale="${template.scale || '1.5 1.5 1.5'}"
                  class="babiaxraycasterclass">
        </a-entity>
      `;
}
/**
 * Generate boats chart component with no title (boats charts are special)
 */
function generateBoatsComponent(template, dimensionAttrs, title, analysisType = 'directory') {
    return `
        <!-- ${analysisType === 'file' ? 'File' : 'Directory'} XR ${template.displayName} Visualization -->
        <a-entity id="chart"
                  ${template.babiaComponent}="from: data;
                              legend: true;
                              ${dimensionAttrs};"
                  position="${template.position || '0 1 -10'}"
                  rotation="${template.rotation || '0 0 0'}"
                  scale="${template.scale || '1.5 1.5 1.5'}"
                  class="babiaxraycasterclass">
        </a-entity>
      `;
}
/**
 * Generate bubbles chart component with title and scale
 */
function generateBubblesComponent(template, dimensionAttrs, title, analysisType = 'directory') {
    return `
        <!-- ${analysisType === 'file' ? 'File' : 'Directory'} XR ${template.displayName} Visualization -->
        <a-entity id="chart"
                  ${template.babiaComponent}="from: data;
                              title: '${title}';
                              legend: true;
                              palette: pearl;
                              ${dimensionAttrs};"
                  position="${template.position || '0 1 -10'}"
                  rotation="${template.rotation || '0 0 0'}"
                  scale="${template.scale || '1.5 1.5 1.5'}"
                  class="babiaxraycasterclass">
        </a-entity>
      `;
}
/**
 * Generate standard chart component with proper title placeholder
 */
function generateStandardComponent(template, dimensionAttrs, title, analysisType = 'directory') {
    return `
        <!-- ${analysisType === 'file' ? 'File' : 'Directory'} XR ${template.displayName} Visualization -->
        <a-entity id="chart"
                  ${template.babiaComponent}="from: data;
                              legend: true;
                              tooltip: true;
                              palette: pearl;
                              ${dimensionAttrs};
                              tooltip_position: top;
                              tooltip_show_always: false;
                              tooltip_height: 0.3;
                              heightMax: 20"
                  position="${template.position || '0 1 -10'}"
                  rotation="${template.rotation || '0 0 0'}"
                  scale="${template.scale || '1.5 1.5 1.5'}"
                  class="babiaxraycasterclass">
        </a-entity>
      `;
}
/**
 * Validate dimension mapping against chart attribute types
 */
function validateDimensionMapping(template, dimensionMapping, analysisType = 'directory') {
    const validatedMapping = {};
    // Define available fields by type
    const numericFields = ['linesCount', 'complexity', 'parameters', 'cyclomaticDensity', 'totalLines', 'meanComplexity', 'functionCount'];
    const categoricalFields = ['functionName', 'fileName', 'className'];
    const anyFields = [...numericFields, ...categoricalFields];
    for (const attr of template.attributes) {
        const mappedField = dimensionMapping[attr.name];
        // If no mapping exists for this attribute, use the default from template
        if (!mappedField) {
            // Use the correct default dimensions based on analysis type
            const defaults = analysisType === 'directory' && template.directoryDefaultDimensions
                ? template.directoryDefaultDimensions
                : template.defaultDimensions || {};
            const defaultField = defaults[attr.name];
            if (defaultField) {
                console.log(`📋 Using default mapping for ${attr.name}: ${defaultField} (${analysisType} analysis)`);
                validatedMapping[attr.name] = defaultField;
            }
            continue;
        }
        let validField = false;
        switch (attr.type) {
            case FieldType.NUMERIC:
                validField = numericFields.includes(mappedField);
                break;
            case FieldType.CATEGORICAL:
                validField = categoricalFields.includes(mappedField);
                break;
            case FieldType.ANY:
                validField = anyFields.includes(mappedField);
                break;
        }
        if (validField) {
            validatedMapping[attr.name] = mappedField;
        }
        else {
            console.warn(`⚠️ Invalid field "${mappedField}" for ${attr.name} (requires ${attr.type}), using default`);
            // Use default from template based on analysis type
            const defaults = analysisType === 'directory' && template.directoryDefaultDimensions
                ? template.directoryDefaultDimensions
                : template.defaultDimensions || {};
            validatedMapping[attr.name] = defaults[attr.name] || 'linesCount';
        }
    }
    return validatedMapping;
}
//# sourceMappingURL=chartTemplates.js.map