"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.additionalChartTemplates = void 0;
/**
 * Additional BabiaXR Chart Templates
 */
exports.additionalChartTemplates = [
    // Bar Chart Template
    {
        id: 'bar',
        name: 'Bar Chart',
        description: '3D vertical bars representing data values',
        category: 'linear',
        dimensions: [
            {
                name: 'x_axis',
                label: 'Categories',
                dataType: 'any',
                required: true,
                description: 'Field containing category names for x-axis'
            },
            {
                name: 'height',
                label: 'Values',
                dataType: 'numeric',
                required: true,
                description: 'Field containing numeric values for bar heights'
            }
        ],
        htmlTemplate: `
            <!-- BabiaXR Bar Chart Template -->
            <a-scene embedded style="height: 600px; width: 100%;">
                <a-entity environment="preset: forest"></a-entity>
                
                <!-- Camera with movement controls -->
                <a-entity id="cameraRig" position="0 1.6 6">
                    <a-camera look-controls wasd-controls></a-camera>
                </a-entity>
                
                <!-- Lighting -->
                <a-light type="ambient" color="#404040"></a-light>
                <a-light type="directional" position="2 4 2" color="#ffffff"></a-light>
                
                <!-- Bar Chart -->
                <a-entity 
                    babia-bars="
                        data: {{DATA_SOURCE}};
                        key: {{KEY_FIELD}};
                        height: {{HEIGHT_FIELD}};
                        title: {{TITLE}};
                        titlePosition: 0 3 0;
                        titleColor: #ffffff;
                        legend: true;
                        legendPosition: -4 0 0;
                    "
                    position="0 0 0">
                </a-entity>
                
                <!-- Title Text -->
                <a-text 
                    value="{{TITLE}}"
                    position="0 4 0"
                    align="center"
                    color="#ffffff"
                    scale="2 2 2">
                </a-text>
            </a-scene>
        `
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
                label: 'X-Axis Categories',
                dataType: 'any',
                required: true,
                description: 'Field containing category names for x-axis'
            },
            {
                name: 'z_axis',
                label: 'Z-Axis Categories',
                dataType: 'any',
                required: true,
                description: 'Field containing category names for z-axis'
            },
            {
                name: 'height',
                label: 'Values',
                dataType: 'numeric',
                required: true,
                description: 'Field containing numeric values for bar heights'
            }
        ],
        htmlTemplate: `
            <!-- BabiaXR Barsmap Chart Template -->
            <a-scene embedded style="height: 600px; width: 100%;">
                <a-entity environment="preset: forest"></a-entity>
                
                <!-- Camera with movement controls -->
                <a-entity id="cameraRig" position="0 1.6 6">
                    <a-camera look-controls wasd-controls></a-camera>
                </a-entity>
                
                <!-- Lighting -->
                <a-light type="ambient" color="#404040"></a-light>
                <a-light type="directional" position="2 4 2" color="#ffffff"></a-light>
                
                <!-- Barsmap Chart -->
                <a-entity 
                    babia-barsmap="
                        data: {{DATA_SOURCE}};
                        x_axis: {{X_AXIS_FIELD}};
                        z_axis: {{Z_AXIS_FIELD}};
                        height: {{HEIGHT_FIELD}};
                        title: {{TITLE}};
                        titlePosition: 0 3 0;
                        titleColor: #ffffff;
                        legend: true;
                        legendPosition: -4 0 0;
                        axis_name: true;
                    "
                    position="0 0 0">
                </a-entity>
                
                <!-- Title Text -->
                <a-text 
                    value="{{TITLE}}"
                    position="0 4 0"
                    align="center"
                    color="#ffffff"
                    scale="2 2 2">
                </a-text>
            </a-scene>
        `
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
                label: 'Categories',
                dataType: 'any',
                required: true,
                description: 'Field containing category names'
            },
            {
                name: 'size',
                label: 'Values',
                dataType: 'numeric',
                required: true,
                description: 'Field containing numeric values for each sector'
            }
        ],
        htmlTemplate: `
            <!-- BabiaXR Pie Chart Template -->
            <a-scene embedded style="height: 600px; width: 100%;">
                <a-entity environment="preset: yavapai"></a-entity>
                
                <!-- Camera with movement controls -->
                <a-entity id="cameraRig" position="0 1.6 4">
                    <a-camera look-controls wasd-controls></a-camera>
                </a-entity>
                
                <!-- Lighting -->
                <a-light type="ambient" color="#404040"></a-light>
                <a-light type="directional" position="1 2 1" color="#ffffff"></a-light>
                
                <!-- Pie Chart -->
                <a-entity 
                    babia-pie="
                        data: {{DATA_SOURCE}};
                        key: {{KEY_FIELD}};
                        size: {{SIZE_FIELD}};
                        title: {{TITLE}};
                        titlePosition: 0 2 0;
                        titleColor: #ffffff;
                        legend: true;
                        legendPosition: -3 0 0;
                    "
                    position="0 1 -1"
                    rotation="90 0 0">
                </a-entity>
                
                <!-- Title Text -->
                <a-text 
                    value="{{TITLE}}"
                    position="0 3 -1"
                    align="center"
                    color="#ffffff"
                    scale="2 2 2">
                </a-text>
            </a-scene>
        `
    },
    // Bubble Chart Template
    {
        id: 'bubble',
        name: 'Bubble Chart',
        description: '3D spheres with varying sizes representing data relationships',
        category: '3d',
        dimensions: [
            {
                name: 'key',
                label: 'Categories',
                dataType: 'any',
                required: true,
                description: 'Field containing category names'
            },
            {
                name: 'size',
                label: 'Bubble Size',
                dataType: 'numeric',
                required: true,
                description: 'Field containing values for bubble sizes'
            },
            {
                name: 'color',
                label: 'Color Value',
                dataType: 'numeric',
                required: false,
                description: 'Optional field for color mapping'
            }
        ],
        htmlTemplate: `
            <!-- BabiaXR Bubble Chart Template -->
            <a-scene embedded style="height: 600px; width: 100%;">
                <a-entity environment="preset: egypt"></a-entity>
                
                <!-- Camera with movement controls -->
                <a-entity id="cameraRig" position="0 1.6 5">
                    <a-camera look-controls wasd-controls></a-camera>
                </a-entity>
                
                <!-- Lighting -->
                <a-light type="ambient" color="#404040"></a-light>
                <a-light type="directional" position="2 3 2" color="#ffffff"></a-light>
                
                <!-- Bubble Chart -->
                <a-entity 
                    babia-bubbles="
                        data: {{DATA_SOURCE}};
                        key: {{KEY_FIELD}};
                        size: {{SIZE_FIELD}};
                        title: {{TITLE}};
                        titlePosition: 0 3 0;
                        titleColor: #ffffff;
                        legend: true;
                        legendPosition: -4 0 0;
                    "
                    position="0 1 0">
                </a-entity>
                
                <!-- Title Text -->
                <a-text 
                    value="{{TITLE}}"
                    position="0 4 0"
                    align="center"
                    color="#ffffff"
                    scale="2 2 2">
                </a-text>
            </a-scene>
        `
    },
    // Cylinder Chart Template
    {
        id: 'cylinder',
        name: 'Cylinder Chart',
        description: '3D cylindrical bars for enhanced visual representation',
        category: '3d',
        dimensions: [
            {
                name: 'key',
                label: 'Categories',
                dataType: 'any',
                required: true,
                description: 'Field containing category names'
            },
            {
                name: 'height',
                label: 'Heights',
                dataType: 'numeric',
                required: true,
                description: 'Field containing values for cylinder heights'
            }
        ],
        htmlTemplate: `
            <!-- BabiaXR Cylinder Chart Template -->
            <a-scene embedded style="height: 600px; width: 100%;">
                <a-entity environment="preset: arches"></a-entity>
                
                <!-- Camera with movement controls -->
                <a-entity id="cameraRig" position="0 1.6 6">
                    <a-camera look-controls wasd-controls></a-camera>
                </a-entity>
                
                <!-- Lighting -->
                <a-light type="ambient" color="#404040"></a-light>
                <a-light type="directional" position="3 4 3" color="#ffffff"></a-light>
                
                <!-- Cylinder Chart -->
                <a-entity 
                    babia-cyls="
                        data: {{DATA_SOURCE}};
                        key: {{KEY_FIELD}};
                        height: {{HEIGHT_FIELD}};
                        title: {{TITLE}};
                        titlePosition: 0 3 0;
                        titleColor: #ffffff;
                        legend: true;
                        legendPosition: -4 0 0;
                    "
                    position="0 0 0">
                </a-entity>
                
                <!-- Title Text -->
                <a-text 
                    value="{{TITLE}}"
                    position="0 4 0"
                    align="center"
                    color="#ffffff"
                    scale="2 2 2">
                </a-text>
            </a-scene>
        `
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
                label: 'Categories',
                dataType: 'any',
                required: true,
                description: 'Field containing category names for x-axis'
            },
            {
                name: 'height',
                label: 'Height Values',
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
        htmlTemplate: `
            <!-- BabiaXR Cyls Chart Template -->
            <a-scene embedded style="height: 600px; width: 100%;">
                <a-entity environment="preset: forest"></a-entity>
                
                <!-- Camera with movement controls -->
                <a-entity id="cameraRig" position="0 1.6 6">
                    <a-camera look-controls wasd-controls></a-camera>
                </a-entity>
                
                <!-- Lighting -->
                <a-light type="ambient" color="#404040"></a-light>
                <a-light type="directional" position="2 4 2" color="#ffffff"></a-light>
                
                <!-- Cyls Chart -->
                <a-entity 
                    babia-cyls="
                        data: {{DATA_SOURCE}};
                        x_axis: {{X_AXIS_FIELD}};
                        height: {{HEIGHT_FIELD}};
                        radius: {{RADIUS_FIELD}};
                        title: {{TITLE}};
                        titlePosition: 0 3 0;
                        titleColor: #ffffff;
                        legend: true;
                        legendPosition: -4 0 0;
                        axis_name: true;
                    "
                    position="0 1 -10">
                </a-entity>
                
                <!-- Title Text -->
                <a-text 
                    value="{{TITLE}}"
                    position="0 4 0"
                    align="center"
                    color="#ffffff"
                    scale="2 2 2">
                </a-text>
            </a-scene>
        `
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
                label: 'X-Axis Categories',
                dataType: 'any',
                required: true,
                description: 'Field containing category names for x-axis'
            },
            {
                name: 'z_axis',
                label: 'Z-Axis Categories',
                dataType: 'any',
                required: true,
                description: 'Field containing category names for z-axis'
            },
            {
                name: 'height',
                label: 'Height Values',
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
        htmlTemplate: `
            <!-- BabiaXR Cylsmap Chart Template -->
            <a-scene embedded style="height: 600px; width: 100%;">
                <a-entity environment="preset: forest"></a-entity>
                
                <!-- Camera with movement controls -->
                <a-entity id="cameraRig" position="0 1.6 6">
                    <a-camera look-controls wasd-controls></a-camera>
                </a-entity>
                
                <!-- Lighting -->
                <a-light type="ambient" color="#404040"></a-light>
                <a-light type="directional" position="2 4 2" color="#ffffff"></a-light>
                
                <!-- Cylsmap Chart -->
                <a-entity 
                    babia-cylsmap="
                        data: {{DATA_SOURCE}};
                        x_axis: {{X_AXIS_FIELD}};
                        z_axis: {{Z_AXIS_FIELD}};
                        height: {{HEIGHT_FIELD}};
                        radius: {{RADIUS_FIELD}};
                        title: {{TITLE}};
                        titlePosition: 0 3 0;
                        titleColor: #ffffff;
                        legend: true;
                        legendPosition: -4 0 0;
                        axis_name: true;
                    "
                    position="0 1 -10">
                </a-entity>
                
                <!-- Title Text -->
                <a-text 
                    value="{{TITLE}}"
                    position="0 4 0"
                    align="center"
                    color="#ffffff"
                    scale="2 2 2">
                </a-text>
            </a-scene>
        `
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
                label: 'X-Axis Values',
                dataType: 'any',
                required: true,
                description: 'Field containing values for x-axis positioning'
            },
            {
                name: 'z_axis',
                label: 'Z-Axis Values',
                dataType: 'any',
                required: true,
                description: 'Field containing values for z-axis positioning'
            },
            {
                name: 'height',
                label: 'Height Values',
                dataType: 'numeric',
                required: true,
                description: 'Field containing numeric values for bubble height positioning'
            },
            {
                name: 'radius',
                label: 'Radius Values',
                dataType: 'numeric',
                required: true,
                description: 'Field containing numeric values for bubble radius/size'
            }
        ],
        htmlTemplate: `
            <!-- BabiaXR Bubbles Chart Template -->
            <a-scene embedded style="height: 600px; width: 100%;">
                <a-entity environment="preset: {{ENVIRONMENT}}"></a-entity>
                
                <!-- Camera with movement controls -->
                <a-entity id="cameraRig" position="0 1.6 6">
                    <a-camera look-controls wasd-controls></a-camera>
                </a-entity>
                
                <!-- Lighting -->
                <a-light type="ambient" color="#404040"></a-light>
                <a-light type="directional" position="2 4 2" color="#ffffff"></a-light>
                
                <!-- Bubbles Chart -->
                <a-entity id="chart"
                    babia-bubbles="from: data;
                                   title: {{TITLE}};
                                   legend: true;
                                   palette: {{PALETTE}};
                                   x_axis: {{X_AXIS_FIELD}};
                                   z_axis: {{Z_AXIS_FIELD}};
                                   height: {{HEIGHT_FIELD}};
                                   radius: {{RADIUS_FIELD}};
                                   heightMax: 5;
                                   radiusMax: 1;"
                    position="0 1 -10"
                    rotation="0 0 0"
                    scale="1.5 1.5 1.5"
                    class="babiaxraycasterclass">
                </a-entity>
                
                <!-- Title Text -->
                <a-text 
                    value="{{TITLE}}"
                    position="0 4 0"
                    align="center"
                    color="#ffffff"
                    scale="2 2 2">
                </a-text>
            </a-scene>
        `
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
                label: 'Area Values',
                dataType: 'any',
                required: true,
                description: 'Field containing values for boat area'
            },
            {
                name: 'height',
                label: 'Height Values',
                dataType: 'any',
                required: true,
                description: 'Field containing values for boat height'
            },
            {
                name: 'color',
                label: 'Color Values',
                dataType: 'any',
                required: true,
                description: 'Field containing values for boat color mapping'
            }
        ],
        htmlTemplate: `
            <!-- BabiaXR Boats Chart Template -->
            <a-scene embedded style="height: 600px; width: 100%;">
                <a-entity environment="preset: {{ENVIRONMENT}}"></a-entity>
                
                <!-- Camera with movement controls -->
                <a-entity id="cameraRig" position="0 1.6 6">
                    <a-camera look-controls wasd-controls></a-camera>
                </a-entity>
                
                <!-- Lighting -->
                <a-light type="ambient" color="#404040"></a-light>
                <a-light type="directional" position="2 4 2" color="#ffffff"></a-light>
                
                <!-- Boats Chart -->
                <a-entity id="chart"
                    babia-boats="from: data;
                                 legend: true;
                                 area: {{AREA_FIELD}};
                                 height: {{HEIGHT_FIELD}};
                                 color: {{COLOR_FIELD}};"
                    position="0 1 -10"
                    rotation="0 0 0"
                    scale="1.5 1.5 1.5"
                    class="babiaxraycasterclass">
                </a-entity>
                
                <!-- Title Text -->
                <a-text 
                    value="{{TITLE}}"
                    position="0 4 0"
                    align="center"
                    color="#ffffff"
                    scale="2 2 2">
                </a-text>
            </a-scene>
        `
    }
];
//# sourceMappingURL=additionalCharts.js.map