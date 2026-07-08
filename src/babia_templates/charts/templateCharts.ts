import { ChartMetadata } from '../models/chartModels';

/**
 * BabiaXR Chart Templates
 * Defines all available chart types with their metadata and simplified HTML templates
 */
export const DEFAULT_BOATS_LEGEND_TEXT = `{name}
{fheight} (height): {height}
{farea} (area): {area}
{fcolor} (color): {color}`;

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
                                           minHeightOccupancyRatio: 0.45;
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
                dataType: 'text',
                valueRule: 'text-non-empty',
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
        htmlTemplate: `<!-- Bar Chart -->
                <a-entity id="chart"
                    babia-bars="from: data;
                                title: {{TITLE}};
                                legend: true;
                                palette: {{PALETTE}};
                                x_axis: {{X_AXIS_FIELD}};
                                height: {{HEIGHT_FIELD}};
                                axis_name: true"
                    codexr-chart-containment="${UNIVERSAL_XR_TABLE_SETTINGS}"
                    position="0 1 -18"
                    rotation="0 0 0"
                    scale="1.5 1.5 1.5"
                    class="babiaxraycasterclass">
                </a-entity>`
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
                dataType: 'text',
                valueRule: 'text-non-empty',
                required: true,
                description: 'Field containing category names for x-axis'
            },
            {
                name: 'z_axis',
                label: 'Z-Axis',
                dataType: 'text',
                valueRule: 'text-non-empty',
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
        htmlTemplate: `<!-- Barsmap Chart -->
                <a-entity id="chart"
                    babia-barsmap="from: data;
                                   title: {{TITLE}};
                                   legend: true;
                                   palette: {{PALETTE}};
                                   x_axis: {{X_AXIS_FIELD}};
                                   z_axis: {{Z_AXIS_FIELD}};
                                   height: {{HEIGHT_FIELD}};
                                   axis_name: true"
                    codexr-chart-containment="${UNIVERSAL_XR_TABLE_SETTINGS}"
                    position="0 1 -18"
                    rotation="0 0 0"
                    scale="1.5 1.5 1.5"
                    class="babiaxraycasterclass">
                </a-entity>`
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
                dataType: 'text',
                valueRule: 'text-non-empty',
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
        htmlTemplate: `<!-- Cyls Chart -->
                <a-entity id="chart"
                    babia-cyls="from: data;
                                title: {{TITLE}};
                                legend: true;
                                palette: {{PALETTE}};
                                x_axis: {{X_AXIS_FIELD}};
                                height: {{HEIGHT_FIELD}};
                                radius: {{RADIUS_FIELD}};
                                axis_name: true;
                                radiusMax: 1;"
                    codexr-chart-containment="${UNIVERSAL_XR_TABLE_SETTINGS}"
                    position="0 1 -18"
                    rotation="0 0 0"
                    scale="1.5 1.5 1.5"
                    class="babiaxraycasterclass">
                </a-entity>`
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
                dataType: 'text',
                valueRule: 'text-non-empty',
                required: true,
                description: 'Field containing category names for x-axis'
            },
            {
                name: 'z_axis',
                label: 'Z-Axis',
                dataType: 'text',
                valueRule: 'text-non-empty',
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
        htmlTemplate: `<!-- Cylsmap Chart -->
                <a-entity id="chart"
                    babia-cylsmap="from: data;
                                   title: {{TITLE}};
                                   legend: true;
                                   palette: {{PALETTE}};
                                   x_axis: {{X_AXIS_FIELD}};
                                   z_axis: {{Z_AXIS_FIELD}};
                                   height: {{HEIGHT_FIELD}};
                                   radius: {{RADIUS_FIELD}};
                                   axis_name: true;
                                   radiusMax: 1;"
                    codexr-chart-containment="${UNIVERSAL_XR_TABLE_SETTINGS}"
                    position="0 1 -18"
                    rotation="0 0 0"
                    scale="1.5 1.5 1.5"
                    class="babiaxraycasterclass">
                </a-entity>`
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
                dataType: 'text',
                valueRule: 'text-non-empty',
                required: true,
                description: 'Field containing category names'
            },
            {
                name: 'size',
                label: 'Size', 
                dataType: 'numeric',
                valueRule: 'numeric-finite',
                required: true,
                description: 'Field containing numeric values for each category'
            }
        ],
        htmlTemplate: `<!-- Donut Chart -->
                <a-entity id="chart"
                    babia-doughnut="from: data;
                                 title: {{TITLE}};
                                titlePosition: 2.5 0 -3;
                                 legend: true;
                                 palette: {{PALETTE}};
                                 key: {{KEY_FIELD}};
                                 size: {{SIZE_FIELD}};
                                 axis_name: true"
                    codexr-chart-containment="${UNIVERSAL_XR_TABLE_SETTINGS}"
                    position="0 1 -18"
                    rotation="0 0 0"
                    scale="1.5 1.5 1.5"
                    class="babiaxraycasterclass">
                </a-entity>`
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
                dataType: 'text',
                valueRule: 'text-non-empty',
                required: true,
                description: 'Field containing category names'
            },
            {
                name: 'size',
                label: 'Size',
                dataType: 'numeric',
                valueRule: 'numeric-finite',
                required: true,
                description: 'Field containing numeric values for each sector'
            }
        ],
        htmlTemplate: `<!-- Pie Chart -->
                <a-entity id="chart"
                    babia-pie="from: data;
                               title: {{TITLE}};
                                titlePosition: 2.5 0 -3;
                               legend: true;
                               palette: {{PALETTE}};
                               key: {{KEY_FIELD}};
                               size: {{SIZE_FIELD}};
                               axis_name: true"
                    codexr-chart-containment="${UNIVERSAL_XR_TABLE_SETTINGS}"
                    position="0 1 -18"
                    rotation="0 0 0"
                    scale="1.5 1.5 1.5"
                    class="babiaxraycasterclass">
                </a-entity>`
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
        htmlTemplate: `<!-- Bubbles Chart -->
                <a-entity id="chart"
                    babia-bubbles="from: data;
                                   title: {{TITLE}};
                                   legend: true;
                                   palette: {{PALETTE}};
                                   x_axis: {{X_AXIS_FIELD}};
                                   z_axis: {{Z_AXIS_FIELD}};
                                   height: {{HEIGHT_FIELD}};
                                   radius: {{RADIUS_FIELD}};
                                   axis_name: true;
                                   heightMax: 5;
                                   radiusMax: 1;"

                    codexr-chart-containment="${UNIVERSAL_XR_TABLE_SETTINGS}"
                    position="0 1 -18"
                    rotation="0 0 0"
                    scale="1.5 1.5 1.5"
                    class="babiaxraycasterclass">
                </a-entity>`
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
                valueRule: 'numeric-finite',
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
        htmlTemplate: `<!-- Boats Chart -->
                <a-entity id="chart"
                    babia-boats="from: tree;
                                 title: {{TITLE}};
                                 legend: true;
                                 legend_text: ${DEFAULT_BOATS_LEGEND_TEXT};
                                 height_building_legend: -0.5;
                                 legend_scale: 0.25;
                                 legend_lookat: [laser-controls];
                                 palette: {{PALETTE}};
                                 area: {{AREA_FIELD}};
                                 height: {{HEIGHT_FIELD}};
                                 color: {{COLOR_FIELD}};
                                 axis_name: true;
                                 extra: 1;
                                 separation: 0.5;
                                 zone_elevation: 0.01;
                                 height_quarter_legend_box: 0.01;
                                 height_quarter_legend_title: 2.5"
                    codexr-chart-containment="${UNIVERSAL_XR_TABLE_SETTINGS}"
                    position="0 1 -18"
                    rotation="0 0 0"
                    scale="0.01 0.05 0.01"
                    class="babiaxraycasterclass">
                </a-entity>`
    }
];


