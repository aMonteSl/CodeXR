import { ChartMetadata } from '../models/chartModels';

/**
 * BabiaXR Chart Templates
 * Defines all available chart types with their metadata and simplified HTML templates
 */
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
                    position="0 2 -10"
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
                    position="0 2 -10"
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
                dataType: 'any',
                required: true,
                description: 'Field containing category names for x-axis'
            },
            {
                name: 'height',
                label: 'Height',
                dataType: 'numeric',
                required: true,
                description: 'Field containing numeric values for cylinder heights'
            },
            {
                name: 'radius',
                label: 'Radius',
                dataType: 'numeric',
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
                    position="0 2 -10"
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
                required: true,
                description: 'Field containing numeric values for cylinder heights'
            },
            {
                name: 'radius',
                label: 'Radius Values',
                dataType: 'numeric',
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
                    position="0 2 -10"
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
                dataType: 'any',
                required: true,
                description: 'Field containing category names'
            },
            {
                name: 'size',
                label: 'Size', 
                dataType: 'numeric',
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
                    position="0 4 0"
                    rotation="90 0 0"
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
                dataType: 'any',
                required: true,
                description: 'Field containing category names'
            },
            {
                name: 'size',
                label: 'Size',
                dataType: 'numeric',
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
                    position="0 4 0"
                    rotation="90 0 0"
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
                required: true,
                description: 'Field containing numeric values for bubble height positioning'
            },
            {
                name: 'radius',
                label: 'Radius',
                dataType: 'numeric',
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

                    position="0 2 -10"
                    rotation="0 0 0"
                    scale="1.5 1.5 1.5"
                    class="babiaxraycasterclass">
                </a-entity>`
    },

    // Boats Chart Template
    {
        id: 'boats',
        name: 'Boats Chart',
        description: '3D boat-shaped visualizations representing data with area, height, and color mapping',
        category: 'geometric',
        dimensions: [
            {
                name: 'area',
                label: 'Area',
                dataType: 'any',
                required: true,
                description: 'Field containing any values for boat area size (e.g., parameters, function count)'
            },
            {
                name: 'height',
                label: 'Height',
                dataType: 'any',
                required: true,
                description: 'Field containing any values for boat height (e.g., lines count, complexity)'
            },
            {
                name: 'color',
                label: 'Color',
                dataType: 'any',
                required: true,
                description: 'Field containing any values for color mapping (e.g., complexity, density)'
            }
        ],
        htmlTemplate: `<!-- Boats Chart -->
                <a-entity id="chart"
                    babia-boats="from: data;
                                 title: {{TITLE}};
                                 legend: true;
                                 palette: {{PALETTE}};
                                 area: {{AREA_FIELD}};
                                 height: {{HEIGHT_FIELD}};
                                 color: {{COLOR_FIELD}};
                                 axis_name: true"
                    position="0 2 -10"
                    rotation="0 0 0"
                    scale="1.5 1.5 1.5"
                    class="babiaxraycasterclass">
                </a-entity>`
    }
];
