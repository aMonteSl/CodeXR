import { ChartMetadata } from '../models/chartModels';
import {
    BOATS_BASE_COMPONENT_ATTRIBUTES,
    DEFAULT_BOATS_LEGEND_TEXT,
    XR_BOATS_TREE_FIELDS,
    getChartPresentationProfile,
    serializeComponentAttributes,
} from './chartPresentation';

/**
 * BabiaXR Chart Templates
 * Defines all available chart types with their metadata and simplified HTML templates.
 * Orientation and base component attributes come from the canonical
 * per-chart presentation profile (chartPresentation.ts) so the generated
 * scene and the in-scene chart switch can never drift apart.
 */
export {
    BOATS_BASE_COMPONENT_ATTRIBUTES,
    DEFAULT_BOATS_LEGEND_TEXT,
    XR_BOATS_TREE_FIELDS,
    serializeComponentAttributes,
};

export const XR_TABLE_BOOTSTRAP_PLANAR_MAX = 0.84;
export const XR_TABLE_STEADY_PLANAR_MIN = 0.78;
export const XR_TABLE_STEADY_PLANAR_MAX = 0.92;
export const XR_TABLE_HEIGHT_BAND_MIN = 0.38;
export const XR_TABLE_HEIGHT_BAND_MAX = 0.72;

export const UNIVERSAL_XR_TABLE_SETTINGS = `enabled: true;
                                           anchorX: 0;
                                           anchorY: 1;
                                           anchorZ: -18;
                                           tableTopPadding: 0.9;
                                           targetWidth: 5.614;
                                           targetHeight: 1.8;
                                           targetDepth: 3.218;
                                           bootstrapPlanarMaxRatio: ${XR_TABLE_BOOTSTRAP_PLANAR_MAX};
                                           minPlanarOccupancyRatio: ${XR_TABLE_STEADY_PLANAR_MIN};
                                           maxPlanarOccupancyRatio: ${XR_TABLE_STEADY_PLANAR_MAX};
                                           heightBandMinRatio: ${XR_TABLE_HEIGHT_BAND_MIN};
                                           heightBandMaxRatio: ${XR_TABLE_HEIGHT_BAND_MAX};
                                           tableEdgeMargin: 0.18;
                                           yScaleMin: 0.01;
                                           yScaleMax: 12;
                                           containmentToleranceRatio: 0.018;
                                           periodicContainmentEnabled: true;
                                           stabilizationCheckMs: 140;
                                           stabilizationMaxChecks: 14;
                                           stabilizationStablePasses: 3;
                                           transformTransitionMs: 650;
                                           hardHeightGuardEnabled: true`;

/**
 * Every chart shares the same table entity: containment settings, anchor
 * position and — from the presentation profile — rotation and base component
 * attributes. Only the babia component name, its mapping placeholders and the
 * initial scale differ per chart.
 */
function buildChartEntityHtml(options: {
    comment: string;
    chartId: string;
    componentName: string;
    componentBody: string;
}): string {
    const profile = getChartPresentationProfile(options.chartId);
    const baseAttributes = serializeComponentAttributes(profile.baseAttributes);
    const componentValue = baseAttributes
        ? `${options.componentBody};\n                                 ${baseAttributes}`
        : options.componentBody;
    const hierarchyLayerStability = profile.preserveRelativeHierarchyLayers
        ? '\n                    codexr-boats-layout-stability="enabled: true"'
        : '';
    return `<!-- ${options.comment} -->
                <a-entity id="chart"
                    data-codexr-active-chart-id="${options.chartId}"
                    ${options.componentName}="${componentValue}"${hierarchyLayerStability}
                    codexr-chart-containment="${UNIVERSAL_XR_TABLE_SETTINGS}"
                    position="0 1 -18"
                    rotation="${profile.rotation}"
                    scale="${profile.initialScale}">
                </a-entity>`;
}

export const chartTemplates: ChartMetadata[] = [
    // Bar Chart Template
    {
        id: 'bars',
        name: 'Bar Chart',
        description: '3D vertical bars representing data values',
        category: 'linear',
        dimensions: [
            {
                name: 'x_axis',
                label: 'X-Axis',
                dataType: 'any',
                required: true,
                description: 'Field containing category names for x-axis'
            },
            {
                name: 'height',
                label: 'Height',
                dataType: 'numeric',
                valueRule: 'numeric-finite',
                required: true,
                description: 'Field containing numeric values for bar heights'
            }
        ],
        htmlTemplate: buildChartEntityHtml({
            comment: 'Bar Chart',
            chartId: 'bars',
            componentName: 'babia-bars',
            componentBody: `from: data;
                                title: {{TITLE}};
                                legend: true;
                                palette: {{PALETTE}};
                                x_axis: {{X_AXIS_FIELD}};
                                height: {{HEIGHT_FIELD}};
                                axis_name: true`,
        })
    },

    // Barsmap Chart Template
    {
        id: 'barsmap',
        name: 'Barsmap Chart',
        description: '3D bar map with multiple axes representing data relationships',
        category: 'linear',
        dimensions: [
            {
                name: 'x_axis',
                label: 'X-Axis',
                dataType: 'any',
                required: true,
                description: 'Field containing category names for x-axis'
            },
            {
                name: 'z_axis',
                label: 'Z-Axis',
                dataType: 'any',
                required: true,
                description: 'Field containing category names for z-axis'
            },
            {
                name: 'height',
                label: 'Height',
                dataType: 'numeric',
                valueRule: 'numeric-finite',
                required: true,
                description: 'Field containing numeric values for bar heights'
            }
        ],
        htmlTemplate: buildChartEntityHtml({
            comment: 'Barsmap Chart',
            chartId: 'barsmap',
            componentName: 'babia-barsmap',
            componentBody: `from: data;
                                   title: {{TITLE}};
                                   legend: true;
                                   palette: {{PALETTE}};
                                   x_axis: {{X_AXIS_FIELD}};
                                   z_axis: {{Z_AXIS_FIELD}};
                                   height: {{HEIGHT_FIELD}};
                                   axis_name: true`,
        })
    },

    // Cyls Chart Template
    {
        id: 'cyls',
        name: 'Cyls Chart',
        description: '3D cylinders representing data values with configurable radius',
        category: 'cylindrical',
        dimensions: [
            {
                name: 'x_axis',
                label: 'X-Axis',
                dataType: 'any',
                required: true,
                description: 'Field containing category names for x-axis'
            },
            {
                name: 'height',
                label: 'Height',
                dataType: 'numeric',
                valueRule: 'numeric-finite',
                required: true,
                description: 'Field containing numeric values for cylinder heights'
            },
            {
                name: 'radius',
                label: 'Radius',
                dataType: 'numeric',
                valueRule: 'numeric-positive',
                required: true,
                description: 'Field containing numeric values for cylinder radius'
            }
        ],
        htmlTemplate: buildChartEntityHtml({
            comment: 'Cyls Chart',
            chartId: 'cyls',
            componentName: 'babia-cyls',
            componentBody: `from: data;
                                title: {{TITLE}};
                                legend: true;
                                palette: {{PALETTE}};
                                x_axis: {{X_AXIS_FIELD}};
                                height: {{HEIGHT_FIELD}};
                                radius: {{RADIUS_FIELD}};
                                axis_name: true`,
        })
    },

    // Cylsmap Chart Template
    {
        id: 'cylsmap',
        name: 'Cylsmap Chart',
        description: '3D cylinder map with multiple axes representing data relationships',
        category: 'cylindrical',
        dimensions: [
            {
                name: 'x_axis',
                label: 'X-Axis',
                dataType: 'any',
                required: true,
                description: 'Field containing category names for x-axis'
            },
            {
                name: 'z_axis',
                label: 'Z-Axis',
                dataType: 'any',
                required: true,
                description: 'Field containing category names for z-axis'
            },
            {
                name: 'height',
                label: 'Height',
                dataType: 'numeric',
                valueRule: 'numeric-finite',
                required: true,
                description: 'Field containing numeric values for cylinder heights'
            },
            {
                name: 'radius',
                label: 'Radius Values',
                dataType: 'numeric',
                valueRule: 'numeric-positive',
                required: true,
                description: 'Field containing numeric values for cylinder radius'
            }
        ],
        htmlTemplate: buildChartEntityHtml({
            comment: 'Cylsmap Chart',
            chartId: 'cylsmap',
            componentName: 'babia-cylsmap',
            componentBody: `from: data;
                                   title: {{TITLE}};
                                   legend: true;
                                   palette: {{PALETTE}};
                                   x_axis: {{X_AXIS_FIELD}};
                                   z_axis: {{Z_AXIS_FIELD}};
                                   height: {{HEIGHT_FIELD}};
                                   radius: {{RADIUS_FIELD}};
                                   axis_name: true`,
        })
    },

    // Donut Chart Template
    {
        id: 'donut',
        name: 'Donut Chart',
        description: 'A circular chart with a hole in the center, ideal for showing proportional data',
        category: 'circular',
        dimensions: [
            {
                name: 'key',
                label: 'Key',
                dataType: 'any',
                required: true,
                description: 'Field containing category names'
            },
            {
                name: 'size',
                label: 'Size',
                dataType: 'numeric',
                valueRule: 'numeric-positive',
                required: true,
                description: 'Field containing numeric values for each category'
            }
        ],
        htmlTemplate: buildChartEntityHtml({
            comment: 'Donut Chart',
            chartId: 'donut',
            componentName: 'babia-doughnut',
            componentBody: `from: data;
                                 title: {{TITLE}};
                                 legend: true;
                                 palette: {{PALETTE}};
                                 key: {{KEY_FIELD}};
                                 size: {{SIZE_FIELD}};
                                 axis_name: true`,
        })
    },

    // Pie Chart Template
    {
        id: 'pie',
        name: 'Pie Chart',
        description: 'Circular chart divided into sectors representing proportional data',
        category: 'circular',
        dimensions: [
            {
                name: 'key',
                label: 'Key',
                dataType: 'any',
                required: true,
                description: 'Field containing category names'
            },
            {
                name: 'size',
                label: 'Size',
                dataType: 'numeric',
                valueRule: 'numeric-positive',
                required: true,
                description: 'Field containing numeric values for each sector'
            }
        ],
        htmlTemplate: buildChartEntityHtml({
            comment: 'Pie Chart',
            chartId: 'pie',
            componentName: 'babia-pie',
            componentBody: `from: data;
                               title: {{TITLE}};
                               legend: true;
                               palette: {{PALETTE}};
                               key: {{KEY_FIELD}};
                               size: {{SIZE_FIELD}};
                               axis_name: true`,
        })
    },

    // Bubbles Chart Template
    {
        id: 'bubbles',
        name: 'Bubbles Chart',
        description: '3D bubbles representing data values with variable size and position',
        category: 'scatter',
        dimensions: [
            {
                name: 'x_axis',
                label: 'X-Axis',
                dataType: 'any',
                required: true,
                description: 'Field containing values for x-axis positioning'
            },
            {
                name: 'z_axis',
                label: 'Z-Axis',
                dataType: 'any',
                required: true,
                description: 'Field containing values for z-axis positioning'
            },
            {
                name: 'height',
                label: 'Height',
                dataType: 'numeric',
                valueRule: 'numeric-finite',
                required: true,
                description: 'Field containing numeric values for bubble height positioning'
            },
            {
                name: 'radius',
                label: 'Radius',
                dataType: 'numeric',
                valueRule: 'numeric-positive',
                required: true,
                description: 'Field containing numeric values for bubble radius/size'
            }
        ],
        htmlTemplate: buildChartEntityHtml({
            comment: 'Bubbles Chart',
            chartId: 'bubbles',
            componentName: 'babia-bubbles',
            componentBody: `from: data;
                                   title: {{TITLE}};
                                   legend: true;
                                   palette: {{PALETTE}};
                                   x_axis: {{X_AXIS_FIELD}};
                                   z_axis: {{Z_AXIS_FIELD}};
                                   height: {{HEIGHT_FIELD}};
                                   radius: {{RADIUS_FIELD}};
                                   axis_name: true`,
        })
    },

    // Babia Boats Chart Template
    {
        id: 'boats',
        name: 'Babia Boats',
        description: 'BabiaXR boat-shaped hierarchical visualization for area, height, color, and path zones',
        category: 'geometric',
        dimensions: [
            {
                name: 'area',
                label: 'Area',
                dataType: 'numeric',
                valueRule: 'numeric-positive',
                required: true,
                description: 'Numeric field used to size the boat area (e.g., parameters, function count)'
            },
            {
                name: 'height',
                label: 'Height',
                dataType: 'numeric',
                valueRule: 'numeric-finite',
                required: true,
                description: 'Numeric field used to control boat height (e.g., lines count, complexity)'
            },
            {
                name: 'color',
                label: 'Color',
                dataType: 'any',
                required: true,
                description: 'Field used for boat color grouping (supports numeric or text values)'
            }
        ],
        htmlTemplate: buildChartEntityHtml({
            comment: 'Boats Chart',
            chartId: 'boats',
            componentName: 'babia-boats',
            componentBody: `from: tree;
                                 title: {{TITLE}};
                                 palette: {{PALETTE}};
                                 area: {{AREA_FIELD}};
                                 height: {{HEIGHT_FIELD}};
                                 color: {{COLOR_FIELD}}`,
        })
    }
];
