"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateChartHTML = generateChartHTML;
exports.validateChartDimensions = validateChartDimensions;
exports.getChartInfo = getChartInfo;
exports.getChartComponentHTML = getChartComponentHTML;
const dimensionMapping_1 = require("./dimensionMapping");
/**
 * Generates the complete HTML for a chart component with values already applied
 */
function generateChartHTML(chartType, context, title = 'Code Analysis') {
    // Get dimension mapping for this chart type
    const dimensionMapping = (0, dimensionMapping_1.getDimensionMapping)(chartType, context);
    // Get environmental settings
    const chartPalette = context.globalState.get('babiaChartPalette') || 'foxy';
    // ✅ VALIDACIÓN DE CAMPOS NUMÉRICOS (solo estos están permitidos)
    const validFields = ['complexity', 'linesCount', 'parameters'];
    const validateField = (field, fallback) => {
        return validFields.includes(field) ? field : fallback;
    };
    // ✅ MAPEO DINÁMICO DE DIMENSIONES CON FALLBACKS
    const getFieldValue = (dimensionKey, defaultField) => {
        const mappedField = dimensionMapping[dimensionKey];
        return validateField(mappedField || defaultField, defaultField);
    };
    console.log('🎨 Chart generation details:');
    console.log('  - Chart type:', chartType);
    console.log('  - Dimension mapping:', dimensionMapping);
    console.log('  - Palette:', chartPalette);
    // ✅ CONFIGURACIONES ESPECÍFICAS POR TIPO DE CHART - MANTENER ROTACIONES ACTUALES
    const chartConfigs = {
        boats: {
            component: 'babia-boats',
            properties: {
                area: getFieldValue('area', 'parameters'),
                height: getFieldValue('height', 'linesCount'),
                color: getFieldValue('color', 'complexity')
            },
            extraProps: 'heightMax: 20',
            rotation: '0 0 0', // ✅ MANTENER ROTACIÓN ACTUAL
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
            rotation: '0 0 0', // ✅ MANTENER ROTACIÓN ACTUAL
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
            extraProps: 'heightMax: 20; radiusMax: 1',
            rotation: '0 0 0', // ✅ MANTENER ROTACIÓN ACTUAL
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
            rotation: '0 0 0', // ✅ MANTENER ROTACIÓN ACTUAL
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
            rotation: '90 0 0', // ✅ MANTENER ROTACIÓN ACTUAL (PERFECTA)
            scale: '1.5 1.5 1.5',
            position: '0 3 -10' // ✅ MANTENER POSICIÓN ELEVADA
        },
        donut: {
            component: 'babia-doughnut',
            properties: {
                key: getFieldValue('key', 'complexity'),
                size: getFieldValue('size', 'linesCount')
            },
            extraProps: 'donutRadius: 0.5; depth: 0.2',
            rotation: '90 0 0', // ✅ MANTENER ROTACIÓN ACTUAL (PERFECTA)
            scale: '1.5 1.5 1.5',
            position: '0 3 -10' // ✅ MANTENER POSICIÓN ELEVADA
        }
    };
    // ✅ OBTENER CONFIGURACIÓN DEL CHART O USAR BOATS COMO FALLBACK
    const config = chartConfigs[chartType] || chartConfigs.boats;
    // ✅ CONSTRUIR PROPIEDADES DINÁMICAMENTE
    const properties = Object.entries(config.properties)
        .map(([key, value]) => `${key}: ${value}`)
        .join(';\n              ');
    // ✅ PROPIEDADES BASE SIN TÍTULO
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
    console.log('🎨 Generated chart HTML with ID for auto-reload:', chartHTML);
    console.log('🎨 Applied values:', config.properties);
    return chartHTML;
}
/**
 * ✅ NUEVA FUNCIÓN PARA VALIDAR CONFIGURACIÓN DE DIMENSIONES
 */
function validateChartDimensions(chartType, context) {
    const dimensionMapping = (0, dimensionMapping_1.getDimensionMapping)(chartType, context);
    const warnings = [];
    // Verificar que todos los valores mapeados sean válidos
    const validFields = ['complexity', 'linesCount', 'parameters'];
    Object.entries(dimensionMapping).forEach(([dimension, field]) => {
        if (!validFields.includes(field)) {
            warnings.push(`Dimension "${dimension}" has invalid field "${field}". Using fallback.`);
        }
    });
    return {
        isValid: warnings.length === 0,
        warnings
    };
}
/**
 * ✅ FUNCIÓN PARA OBTENER INFORMACIÓN DEL CHART GENERADO
 */
function getChartInfo(chartType, context) {
    const dimensionMapping = (0, dimensionMapping_1.getDimensionMapping)(chartType, context);
    const palette = context.globalState.get('babiaChartPalette') || 'foxy';
    const componentNames = {
        boats: 'babia-boats',
        bars: 'babia-bars',
        cyls: 'babia-cyls',
        barsmap: 'babia-barsmap',
        pie: 'babia-pie',
        donut: 'babia-doughnut'
    };
    return {
        type: chartType,
        component: componentNames[chartType] || 'babia-boats',
        dimensions: dimensionMapping,
        palette
    };
}
/**
 * Legacy function for compatibility - now calls the new dynamic function
 */
function getChartComponentHTML(chartType) {
    // This is now just a placeholder - the real work is done in generateChartHTML
    return `<!-- Chart component will be generated dynamically -->`;
}
//# sourceMappingURL=chartComponents.js.map