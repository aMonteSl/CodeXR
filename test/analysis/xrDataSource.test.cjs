const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');

function readProjectFile(...segments) {
    return fs.readFileSync(path.join(projectRoot, ...segments), 'utf8');
}

test('file XR parser uses data.json for the XR template data entity', () => {
    const source = readProjectFile('src', 'code_analysis', 'engine', 'parsers', 'fileXRParser.ts');

    assert.match(source, /TemplateProcessor\.generateXRVisualization\([\s\S]*'data\.json'/);
    assert.equal(source.includes('./data.json'), false);
});

test('directory XR parser keeps using data.json for standard and deep XR analysis', () => {
    const source = readProjectFile('src', 'code_analysis', 'engine', 'parsers', 'directoryXRParser.ts');

    assert.match(source, /TemplateProcessor\.generateXRVisualization\([\s\S]*'data\.json'/);
});

test('XR boats tree builder uses treePath for file analysis and filePath for directory analysis', () => {
    const source = readProjectFile('src', 'babia_templates', 'processing', 'placeholders', 'createStructure.ts');

    assert.match(
        source,
        /Adding tree builder for XR boats chart \(directory analysis\)[\s\S]*babia-treebuilder="field: filePath; split_by: \/; from: data"/,
    );
    assert.match(
        source,
        /Adding tree builder for XR boats chart \(file analysis\)[\s\S]*babia-treebuilder="field: treePath; split_by: \/; from: data"/,
    );
});

test('boats chart legend text keeps multiline content without width/depth and does not leak into donut', () => {
    const templateCharts = readProjectFile('src', 'babia_templates', 'charts', 'templateCharts.ts');
    const createChart = readProjectFile('src', 'babia_templates', 'processing', 'placeholders', 'createChart.ts');

    assert.match(
        templateCharts,
        /export const DEFAULT_BOATS_LEGEND_TEXT = `\{name\}\r?\n\{fheight\} \(height\): \{height\}\r?\n\{farea\} \(area\): \{area\}\r?\n\{fcolor\} \(color\): \{color\}`;/,
    );
    assert.equal(templateCharts.includes("export const DEFAULT_BOATS_LEGEND_TEXT = '{name}\\\\n"), false);

    const boatsBlock = templateCharts.match(/babia-boats="from: tree;[\s\S]*?class="babiaxraycasterclass">/);
    assert.ok(boatsBlock);
    assert.match(boatsBlock[0], /legend_text: \$\{DEFAULT_BOATS_LEGEND_TEXT\};/);
    assert.match(boatsBlock[0], /height_building_legend: -0\.5;/);
    assert.match(boatsBlock[0], /legend_scale: 0\.25;/);
    assert.match(boatsBlock[0], /legend_lookat: \[laser-controls\];/);
    assert.match(boatsBlock[0], /extra: 1;/);
    assert.match(boatsBlock[0], /height_quarter_legend_box: 0\.01;/);
    assert.match(boatsBlock[0], /height_quarter_legend_title: 2\.5/);
    assert.match(templateCharts, /scale="0\.01 0\.05 0\.01"/);
    assert.doesNotMatch(boatsBlock[0], /\{fwidth\}|\{fdepth\}|\{width\}|\{depth\}/);

    const donutBlock = templateCharts.match(/babia-doughnut="from: data;[\s\S]*?axis_name: true"/);
    assert.ok(donutBlock);
    assert.equal(donutBlock[0].includes('legend_text'), false);

    assert.match(createChart, /legend_text: \$\{DEFAULT_BOATS_LEGEND_TEXT\};/);
    assert.doesNotMatch(createChart, /\{fwidth\}|\{fdepth\}|\{width\}|\{depth\}/);
});

test('XR template keeps babia-queryjson bound to the injected DATA_SOURCE placeholder', () => {
    const template = readProjectFile('templates', 'xr', 'file', 'xr-visualization.html');

    assert.match(
        template,
        /<a-entity id="data" babia-queryjson="url: \$\{DATA_SOURCE\}"><\/a-entity>/,
    );
});

test('XR template includes local CodeXR room component while preserving configurable environment', () => {
    const template = readProjectFile('templates', 'xr', 'file', 'xr-visualization.html');

    assert.doesNotMatch(template, /aframe-lounge-component\.min\.js/);
    assert.match(template, /src="\.\/codexrRoomRuntime\.js"/);
    assert.match(template, /src="\.\/codexrMultiScreenManagerRuntime\.js"/);
    assert.match(
        template,
        /<a-entity id="env" environment="preset: \$\{ENVIRONMENT_PRESET\}; groundColor: \$\{GROUND_COLOR\}" hide-on-enter-ar><\/a-entity>/,
    );
    assert.match(template, /id="codexrRoom"/);
    assert.match(template, /glassRailing: true;/);
    assert.match(template, /id="codexrScreenManager"/);
    assert.match(template, /codexr-multi-screen-manager="maxScreens: 5; wall: west"/);
    assert.match(template, /codexr-room="[\s\S]*openSide: south;/);
    assert.match(template, /\.\/assets\/codexr\/xr-room\/textures\/wall\.svg/);
    assert.match(template, /<a-entity id="rig" movement-controls="fly: false" position="0\.07 1\.75 -10\.75">/);
    assert.match(template, /src="\.\/chartPedestalRuntime\.js"/);
});

test('XR and DOM templates pin aframe-babia-components to the supported version', () => {
    const xrTemplate = readProjectFile('templates', 'xr', 'file', 'xr-visualization.html');
    const domTemplate = readProjectFile('templates', 'xr', 'html', 'dom-visualization-template.html');

    assert.match(xrTemplate, /aframe-babia-components@1\.3\.4\/dist\/aframe-babia-components\.min\.js/);
    assert.match(domTemplate, /aframe-babia-components@1\.3\.4\/dist\/aframe-babia-components\.min\.js/);
});

test('XR parsers include CodeXR room runtime in generated assets', () => {
    const fileParser = readProjectFile('src', 'code_analysis', 'engine', 'parsers', 'fileXRParser.ts');
    const directoryParser = readProjectFile('src', 'code_analysis', 'engine', 'parsers', 'directoryXRParser.ts');

    assert.match(fileParser, /copyCodeXrRoomAssetsToOutput/);
    assert.match(fileParser, /CODEXR_ROOM_RUNTIME_OUTPUT_NAME/);
    assert.match(fileParser, /copyVirtualScreenManagerRuntimeToOutput/);
    assert.match(fileParser, /VIRTUAL_SCREEN_MANAGER_RUNTIME_OUTPUT_NAME/);
    assert.match(fileParser, /copyChartPedestalRuntimeToOutput/);
    assert.match(fileParser, /CHART_PEDESTAL_RUNTIME_OUTPUT_NAME/);
    assert.match(directoryParser, /readCodeXrRoomRuntimeContent/);
    assert.match(directoryParser, /readCodeXrRoomTextureContents/);
    assert.match(directoryParser, /readVirtualScreenManagerRuntimeContent/);
    assert.match(directoryParser, /readChartPedestalRuntimeContent/);
    assert.match(directoryParser, /generatedFiles\.set\(VIRTUAL_SCREEN_MANAGER_RUNTIME_OUTPUT_NAME, virtualScreenManagerRuntimeContent\)/);
    assert.match(directoryParser, /generatedFiles\.set\(CODEXR_ROOM_RUNTIME_OUTPUT_NAME, codexrRoomRuntimeContent\)/);
    assert.match(directoryParser, /generatedFiles\.set\(CHART_PEDESTAL_RUNTIME_OUTPUT_NAME, chartPedestalRuntimeContent\)/);
    assert.match(directoryParser, /generatedFiles\.set\(asset\.relativeOutputPath, asset\.content\)/);
});

test('all XR charts share the same chart-pedestal preset and the programmatic boats fallback reuses it', () => {
    const templateCharts = readProjectFile('src', 'babia_templates', 'charts', 'templateCharts.ts');
    const createChart = readProjectFile('src', 'babia_templates', 'processing', 'placeholders', 'createChart.ts');

    assert.match(templateCharts, /export const UNIVERSAL_XR_TABLE_SETTINGS = `enabled: true;[\s\S]*targetWidth: 5\.614;[\s\S]*minPlanarOccupancyRatio: 0\.62;[\s\S]*maxPlanarOccupancyRatio: 0\.84;[\s\S]*minHeightOccupancyRatio: 0\.45;[\s\S]*heightBandMinRatio: 0\.38;[\s\S]*heightBandMaxRatio: 0\.72;[\s\S]*tableEdgeMargin: 0\.18;[\s\S]*stabilizationStablePasses: 3`;/);

    const matches = templateCharts.match(/codexr-chart-pedestal="\$\{UNIVERSAL_XR_TABLE_SETTINGS\}"/g) || [];
    assert.equal(matches.length, 8);
    assert.equal(templateCharts.includes('codexr-boats-pedestal'), false);
    assert.match(createChart, /UNIVERSAL_XR_TABLE_SETTINGS/);
    assert.match(createChart, /codexr-chart-pedestal="\$\{UNIVERSAL_XR_TABLE_SETTINGS\}"/);
});

test('mapping UI triggers chart pedestal renormalization immediately and after geometry settles', () => {
    const mappingUiRuntime = readProjectFile('templates', 'components', 'codexr', 'xr-chart-mapping-ui', 'xrChartMappingUiRuntime.js');

    assert.match(mappingUiRuntime, /function requestChartPedestalRenormalize\(reason\)/);
    assert.match(mappingUiRuntime, /chartPedestalRuntime\.renormalizeAll\(reason \|\| 'mapping-ui-change'\)/);
    assert.match(mappingUiRuntime, /chartPedestalRuntime\.renormalizeAll\(\(reason \|\| 'mapping-ui-change'\) \+ '-settled'\)/);
    assert.match(mappingUiRuntime, /applyDimensionSelection\(config, dimensionId, fieldName, options\)/);
    assert.match(mappingUiRuntime, /var alreadySelected = state\.selectedByDimension\[dimensionId\] === fieldName;/);
    assert.match(mappingUiRuntime, /var forceSelection = !!\(options && options\.force === true\);/);
    assert.match(mappingUiRuntime, /if \(alreadySelected && !forceSelection\) \{/);
    assert.match(mappingUiRuntime, /schedulePendingMappingValidation\(config, state\.pendingMappingToken\);/);
});
