"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateChartHTML = generateChartHTML;
exports.validateChartDimensions = validateChartDimensions;
exports.getChartInfo = getChartInfo;
exports.getChartComponentHTML = getChartComponentHTML;
const dimensionMapping_1 = require("./dimensionMapping");
const chartTemplates_1 = require("./chartTemplates");
/**
 * Generates the complete HTML for a chart component with values already applied
 */
function generateChartHTML(chartType, context, title = 'Code Analysis') {
    // ✅ Use enhanced chart generation for pie and donut charts with proper title support
    const normalizedType = normalizeChartType(chartType);
    if (normalizedType === 'pie' || normalizedType === 'donut') {
        console.log(`🥧 Using enhanced chart generation for ${normalizedType} with title: ${title}`);
        const dimensionMapping = (0, dimensionMapping_1.getDimensionMapping)(chartType, context, 'File');
        return (0, chartTemplates_1.generateChartComponent)(normalizedType, dimensionMapping, title, 'file');
    }
    // ✅ ENHANCED DEBUG: Add extensive logging to trace the issue
    console.log('🎨 generateChartHTML called with:');
    console.log(`   📊 Original chartType: "${chartType}"`);
    console.log(`   🎯 Title: "${title}"`);
    // Get dimension mapping for this chart type
    const dimensionMapping = (0, dimensionMapping_1.getDimensionMapping)(chartType, context);
    console.log(`   🗂️ Dimension mapping:`, dimensionMapping);
    // Get environmental settings
    const chartPalette = context.globalState.get('babiaChartPalette') || 'foxy';
    console.log(`   🎨 Chart palette: ${chartPalette}`);
    // ✅ ENHANCED: Added functionName and cyclomaticDensity as valid fields for categorical and numeric dimensions
    const validFields = ['complexity', 'linesCount', 'parameters', 'functionName', 'cyclomaticDensity'];
    const validateField = (field, fallback) => {
        return validFields.includes(field) ? field : fallback;
    };
    // ✅ MAPEO DINÁMICO DE DIMENSIONES CON FALLBACKS
    const getFieldValue = (dimensionKey, defaultField) => {
        const mappedField = dimensionMapping[dimensionKey];
        const validatedField = validateField(mappedField || defaultField, defaultField);
        console.log(`   🔗 ${dimensionKey}: ${mappedField} → ${validatedField}`);
        return validatedField;
    };
    // ✅ CONFIGURACIONES ESPECÍFICAS POR TIPO DE CHART - FIXED BUBBLES CHART
    const chartConfigs = {
        boats: {
            component: 'babia-boats',
            properties: {
                area: getFieldValue('area', 'parameters'),
                height: getFieldValue('height', 'linesCount'),
                color: getFieldValue('color', 'complexity')
            },
            extraProps: 'heightMax: 20',
            rotation: '0 0 0',
            scale: '1.5 1.5 1.5',
            position: '0 1 -10'
        },
        bars: {
            component: 'babia-bars',
            properties: {
                x_axis: getFieldValue('x_axis', 'complexity'),
                height: getFieldValue('height', 'linesCount')
            },
            extraProps: '',
            rotation: '0 0 0',
            scale: '1.5 1.5 1.5',
            position: '0 1 -10'
        },
        cyls: {
            component: 'babia-cyls',
            properties: {
                x_axis: getFieldValue('x_axis', 'complexity'),
                height: getFieldValue('height', 'linesCount'),
                radius: getFieldValue('radius', 'parameters')
            },
            extraProps: 'chartHeight: 10; radiusMax: 2; axis: true; legend: true',
            rotation: '0 0 0',
            scale: '1.5 1.5 1.5',
            position: '0 1 -10'
        },
        // ✅ CRITICAL FIX: Ensure bubbles chart configuration is correct
        bubbles: {
            component: 'babia-bubbles',
            properties: {
                x_axis: getFieldValue('x_axis', 'complexity'),
                z_axis: getFieldValue('z_axis', 'parameters'),
                height: getFieldValue('height', 'linesCount'),
                radius: getFieldValue('radius', 'parameters')
            },
            extraProps: 'heightMax: 15; radiusMax: 1.5; axis: true; legend: true',
            rotation: '0 0 0',
            scale: '1.5 1.5 1.5',
            position: '0 1 -10'
        },
        barsmap: {
            component: 'babia-barsmap',
            properties: {
                x_axis: getFieldValue('x_axis', 'complexity'),
                height: getFieldValue('height', 'linesCount'),
                z_axis: getFieldValue('z_axis', 'parameters')
            },
            extraProps: 'heightMax: 20',
            rotation: '0 0 0',
            scale: '1.5 1.5 1.5',
            position: '0 1 -10'
        },
        pie: {
            component: 'babia-pie',
            properties: {
                key: getFieldValue('key', 'complexity'),
                size: getFieldValue('size', 'linesCount')
            },
            extraProps: 'depth: 0.2',
            rotation: '90 0 0',
            scale: '1.5 1.5 1.5',
            position: '0 3 -10'
        },
        donut: {
            component: 'babia-doughnut',
            properties: {
                key: getFieldValue('key', 'complexity'),
                size: getFieldValue('size', 'linesCount')
            },
            extraProps: 'donutRadius: 0.5; depth: 0.2',
            rotation: '90 0 0',
            scale: '1.5 1.5 1.5',
            position: '0 3 -10'
        }
    };
    // ✅ CRITICAL DEBUG: Check normalization and config selection
    const normalizedChartType = normalizeChartType(chartType);
    console.log('🎯 Chart type normalization:');
    console.log(`   📝 Original: "${chartType}"`);
    console.log(`   ✅ Normalized: "${normalizedChartType}"`);
    // ✅ CRITICAL DEBUG: Check if config exists for normalized type
    const configExists = chartConfigs.hasOwnProperty(normalizedChartType);
    console.log(`   📋 Config exists for "${normalizedChartType}": ${configExists}`);
    if (!configExists) {
        console.error(`❌ No config found for normalized chart type: "${normalizedChartType}"`);
        console.log(`   Available configs:`, Object.keys(chartConfigs));
    }
    // ✅ OBTENER CONFIGURACIÓN DEL CHART O USAR BOATS COMO FALLBACK
    const config = chartConfigs[normalizedChartType] || chartConfigs.boats;
    console.log('🎯 Final selected chart config:');
    console.log(`   🔧 Component: ${config.component}`);
    console.log(`   📊 Properties:`, config.properties);
    console.log(`   ➕ Extra props: ${config.extraProps}`);
    console.log(`   📍 Position: ${config.position}`);
    console.log(`   🔄 Rotation: ${config.rotation}`);
    console.log(`   📏 Scale: ${config.scale}`);
    // ✅ CRITICAL CHECK: Verify we're not using boats fallback when we shouldn't
    if (normalizedChartType === 'bubbles' && config.component !== 'babia-bubbles') {
        console.error(`🚨 CRITICAL ERROR: Expected babia-bubbles but got ${config.component}`);
        console.error(`   This indicates a problem with chart config selection`);
    }
    // ✅ CONSTRUIR PROPIEDADES DINÁMICAMENTE
    const properties = Object.entries(config.properties)
        .map(([key, value]) => `${key}: ${value}`)
        .join(';\n              ');
    console.log(`   🔗 Generated properties string:`, properties);
    // ✅ PROPIEDADES BASE CON TÍTULO
    const baseProperties = `from: data;
              legend: true;
              tooltip: true;
              palette: ${chartPalette};
              ${properties}`;
    // ✅ CONFIGURACIÓN DE TOOLTIP ÚNICAMENTE
    const tooltipProperties = `tooltip_position: top;
              tooltip_show_always: false;
              tooltip_height: 0.3`;
    // ✅ PROPIEDADES EXTRA ESPECÍFICAS DEL CHART
    const extraProps = config.extraProps ? `;\n              ${config.extraProps}` : '';
    // ✅ USAR VALORES DE LA CONFIGURACIÓN
    const position = config.position;
    const rotation = config.rotation;
    const scale = config.scale;
    // ✅ GENERAR HTML FINAL CON ID CORRECTO PARA EL SCRIPT DE AUTO-RELOAD
    const chartHTML = `<a-entity id="chart"
              ${config.component}="${baseProperties};
              ${tooltipProperties}${extraProps}"
              position="${position}"
              rotation="${rotation}"
              scale="${scale}">
    </a-entity>`;
    console.log('🎨 Generated chart HTML:');
    console.log(chartHTML);
    // ✅ FINAL VERIFICATION: Check the generated HTML contains the right component
    if (normalizedChartType === 'bubbles' && !chartHTML.includes('babia-bubbles')) {
        console.error(`🚨 FINAL ERROR: Generated HTML doesn't contain babia-bubbles!`);
        console.error(`   Generated HTML:`, chartHTML);
    }
    else if (normalizedChartType === 'bubbles') {
        console.log(`✅ SUCCESS: Generated HTML contains babia-bubbles component`);
    }
    return chartHTML;
}
/**
 * ✅ NEW: Normalizes chart type names to handle different naming conventions
 */
function normalizeChartType(chartType) {
    // Convert to lowercase for comparison
    const lower = chartType.toLowerCase();
    console.log(`🔍 Normalizing chart type: "${chartType}" → "${lower}"`);
    // Handle different cylinder chart naming
    if (lower.includes('cylinder') || lower.includes('cyls')) {
        console.log(`✅ Normalized to: cyls`);
        return 'cyls';
    }
    // ✅ FIXED: Handle bubbles chart naming (more specific patterns)
    if (lower.includes('bubble')) {
        console.log(`✅ Normalized to: bubbles`);
        return 'bubbles';
    }
    // Handle other chart types
    const typeMapping = {
        'boats': 'boats',
        'bars': 'bars',
        'barsmap': 'barsmap',
        'pie': 'pie',
        'donut': 'donut',
        'doughnut': 'donut',
        'cylinders': 'cyls',
        'cylinder': 'cyls',
        'cyls': 'cyls',
        'bubbles': 'bubbles',
        'bubble': 'bubbles'
    };
    // Try exact match first
    if (typeMapping[lower]) {
        console.log(`✅ Exact match normalized to: ${typeMapping[lower]}`);
        return typeMapping[lower];
    }
    // Try partial matches
    for (const [key, value] of Object.entries(typeMapping)) {
        if (lower.includes(key)) {
            console.log(`✅ Partial match "${key}" normalized to: ${value}`);
            return value;
        }
    }
    // Default fallback
    console.warn('⚠️ Unknown chart type:', chartType, 'using boats as fallback');
    return 'boats';
}
/**
 * ✅ NUEVA FUNCIÓN PARA VALIDAR CONFIGURACIÓN DE DIMENSIONES
 */
function validateChartDimensions(chartType, context) {
    const dimensionMapping = (0, dimensionMapping_1.getDimensionMapping)(chartType, context);
    const warnings = [];
    let isValid = true;
    // Validate required dimensions for each chart type
    const requiredDimensions = {
        boats: ['area', 'height', 'color'],
        bars: ['x_axis', 'height'],
        cyls: ['x_axis', 'height', 'radius'],
        bubbles: ['x_axis', 'z_axis', 'height', 'radius'], // ✅ NEW: Bubbles validation
        barsmap: ['x_axis', 'height', 'z_axis'],
        pie: ['key', 'size'],
        donut: ['key', 'size']
    };
    const required = requiredDimensions[chartType] || [];
    for (const dimension of required) {
        if (!dimensionMapping[dimension]) {
            warnings.push(`Missing mapping for ${dimension} dimension`);
            isValid = false;
        }
    }
    return { isValid, warnings };
}
/**
 * ✅ FUNCIÓN PARA OBTENER INFORMACIÓN DEL CHART GENERADO
 */
function getChartInfo(chartType, context) {
    const dimensionMapping = (0, dimensionMapping_1.getDimensionMapping)(chartType, context);
    const chartPalette = context.globalState.get('babiaChartPalette') || 'foxy';
    const componentMap = {
        boats: 'babia-boats',
        bars: 'babia-bars',
        cyls: 'babia-cyls',
        cylinders: 'babia-cyls',
        bubbles: 'babia-bubbles', // ✅ NEW: Added bubbles mapping
        barsmap: 'babia-barsmap',
        pie: 'babia-pie',
        donut: 'babia-doughnut'
    };
    // ✅ TECHNICAL FIX: Use normalization
    const normalizedType = normalizeChartType(chartType);
    return {
        type: normalizedType,
        component: componentMap[normalizedType] || 'babia-boats',
        dimensions: dimensionMapping,
        palette: chartPalette
    };
}
/**
 * ✅ FIXED: Legacy function for compatibility - now generates actual chart HTML
 */
function getChartComponentHTML(chartType) {
    // ✅ TECHNICAL FIX: We need context to generate proper chart HTML
    // Since this is a legacy function, we'll try to get context from the current execution
    // Try to get context from VS Code extension API
    const activeExtension = require('vscode').extensions.getExtension('your-extension-id');
    let context = null;
    // ✅ FALLBACK: If we can't get context, create a minimal chart template
    if (!context) {
        console.warn('⚠️ No context available in getChartComponentHTML, using fallback template');
        return createFallbackChartHTML(chartType);
    }
    // Use the full generation function if context is available
    return generateChartHTML(chartType, context);
}
/**
 * ✅ TECHNICAL HELPER: Creates fallback chart HTML when context is not available
 */
function createFallbackChartHTML(chartType) {
    const chartConfigs = {
        boats: {
            component: 'babia-boats',
            properties: 'area: parameters; height: linesCount; color: complexity; heightMax: 20',
            position: '0 1 -10',
            rotation: '0 0 0',
            scale: '1.5 1.5 1.5'
        },
        bars: {
            component: 'babia-bars',
            properties: 'x_axis: complexity; height: linesCount',
            position: '0 1 -10',
            rotation: '0 0 0',
            scale: '1.5 1.5 1.5'
        },
        // ✅ FIXED: Proper cylinder chart fallback
        cyls: {
            component: 'babia-cyls',
            properties: 'x_axis: complexity; height: linesCount; radius: parameters; chartHeight: 10; radiusMax: 2; axis: true; legend: true',
            position: '0 1 -10',
            rotation: '0 0 0',
            scale: '1.5 1.5 1.5'
        },
        cylinders: {
            component: 'babia-cyls',
            properties: 'x_axis: complexity; height: linesCount; radius: parameters; chartHeight: 10; radiusMax: 2; axis: true; legend: true',
            position: '0 1 -10',
            rotation: '0 0 0',
            scale: '1.5 1.5 1.5'
        },
        // ✅ NEW: Bubbles chart fallback
        bubbles: {
            component: 'babia-bubbles',
            properties: 'x_axis: complexity; z_axis: parameters; height: linesCount; radius: parameters; heightMax: 15; radiusMax: 1.5; axis: true; legend: true',
            position: '0 1 -10',
            rotation: '0 0 0',
            scale: '1.5 1.5 1.5'
        },
        barsmap: {
            component: 'babia-barsmap',
            properties: 'x_axis: complexity; height: linesCount; z_axis: parameters; heightMax: 20',
            position: '0 1 -10',
            rotation: '0 0 0',
            scale: '1.5 1.5 1.5'
        },
        pie: {
            component: 'babia-pie',
            properties: 'key: complexity; size: linesCount; depth: 0.2',
            position: '0 3 -10',
            rotation: '90 0 0',
            scale: '1.5 1.5 1.5'
        },
        donut: {
            component: 'babia-doughnut',
            properties: 'key: complexity; size: linesCount; donutRadius: 0.5; depth: 0.2',
            position: '0 3 -10',
            rotation: '90 0 0',
            scale: '1.5 1.5 1.5'
        }
    };
    // ✅ TECHNICAL FIX: Use normalization function here too
    const normalizedType = normalizeChartType(chartType);
    const config = chartConfigs[normalizedType] || chartConfigs.boats;
    console.log('🎯 Fallback chart config for', chartType, '→', normalizedType, ':', config.component);
    return `<a-entity id="chart"
              ${config.component}="from: data;
              legend: true;
              tooltip: true;
              palette: foxy;
              ${config.properties};
              tooltip_position: top;
              tooltip_show_always: false;
              tooltip_height: 0.3"
              position="${config.position}"
              rotation="${config.rotation}"
              scale="${config.scale}">
    </a-entity>`;
}
//# sourceMappingURL=chartComponents.js.map