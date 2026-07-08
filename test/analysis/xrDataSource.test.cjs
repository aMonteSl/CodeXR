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

test('XR hierarchical boats tree builder uses treePath for file analysis and filePath for directory analysis', () => {
    const source = readProjectFile('src', 'babia_templates', 'processing', 'placeholders', 'createStructure.ts');

    assert.match(
        source,
        /users can switch between flat and hierarchical charts live[\s\S]*if \(analysisType === 'xr'\)[\s\S]*Adding tree builder for XR hierarchical boats chart \(directory analysis\)[\s\S]*babia-treebuilder="field: filePath; split_by: \/; from: data"/,
    );
    assert.match(
        source,
        /Adding tree builder for XR hierarchical boats chart \(file analysis\)[\s\S]*babia-treebuilder="field: treePath; split_by: \/; from: data"/,
    );
});

test('XR mapping UI config includes live chart selector metadata', () => {
    const processor = readProjectFile('src', 'babia_templates', 'processing', 'templateProcessor.ts');

    assert.match(processor, /availableCharts/);
    assert.match(processor, /dimensionsByChart/);
    assert.match(processor, /defaultMappingsByChart/);
    assert.match(processor, /area: \['functionCount', 'totalFunctions', 'fileCount', 'codeLines', 'totalLines'\]/);
    assert.match(processor, /height: \['totalLines', 'codeLines', 'functionCount', 'cyclomaticComplexityNumber'\]/);
    assert.match(processor, /color: \['cyclomaticComplexityNumber', 'language', 'fileName', 'relativePath'\]/);
});

test('local XR server prevents stale runtime script caching', () => {
    const server = readProjectFile('src', 'servers', 'runtime', 'httpServer.ts');

    assert.ok(server.includes('/\\.(:html|js|mjs|json|map)$/i.test(filePath)'));
    assert.match(server, /Cache-Control'\] = 'no-store, no-cache, must-revalidate, max-age=0'/);
    assert.match(server, /headers\.Pragma = 'no-cache'/);
    assert.match(server, /headers\.Expires = '0'/);
});

test('Babia Boats is the default XR file and directory chart while CodeXR Boats remains paused', () => {
    const config = readProjectFile('src', 'code_analysis', 'configuration', 'models', 'analysisConfiguration.ts');
    const profile = readProjectFile(
        'src',
        'code_analysis',
        'views',
        'subsections',
        'analysis_settings',
        'profile_configuration',
        'profileConfiguration.ts',
    );
    const templateCharts = readProjectFile('src', 'babia_templates', 'charts', 'templateCharts.ts');

    assert.match(config, /chartTypeFile: 'boats'/);
    assert.match(config, /chartTypeDirectory: 'boats'/);
    assert.match(profile, /chartTypeFile: 'boats'/);
    assert.match(profile, /chartTypeDirectory: 'boats'/);
    assert.doesNotMatch(templateCharts, /id: 'codexr-boats'/);
    assert.match(templateCharts, /id: 'boats'[\s\S]*name: 'Babia Boats'/);
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
    assert.match(boatsBlock[0], /scale="0\.01 0\.05 0\.01"/);
    assert.doesNotMatch(boatsBlock[0], /\{fwidth\}|\{fdepth\}|\{width\}|\{depth\}/);

    const donutBlock = templateCharts.match(/babia-doughnut="from: data;[\s\S]*?axis_name: true"/);
    assert.ok(donutBlock);
    assert.equal(donutBlock[0].includes('legend_text'), false);

    assert.match(createChart, /legend_text: \$\{DEFAULT_BOATS_LEGEND_TEXT\};/);
    assert.doesNotMatch(createChart, /\{fwidth\}|\{fdepth\}|\{width\}|\{depth\}/);
});

test('pie and donut XR chart templates render upright on the analysis table', () => {
    const templateCharts = readProjectFile('src', 'babia_templates', 'charts', 'templateCharts.ts');
    const donutBlock = templateCharts.match(/id: 'donut'[\s\S]*htmlTemplate: `<!-- Donut Chart -->[\s\S]*<\/a-entity>`/);
    const pieBlock = templateCharts.match(/id: 'pie'[\s\S]*htmlTemplate: `<!-- Pie Chart -->[\s\S]*<\/a-entity>`/);

    assert.ok(donutBlock);
    assert.ok(pieBlock);
    assert.match(donutBlock[0], /babia-doughnut=/);
    assert.match(donutBlock[0], /rotation="0 0 0"/);
    assert.doesNotMatch(donutBlock[0], /rotation="90 0 0"/);
    assert.match(pieBlock[0], /babia-pie=/);
    assert.match(pieBlock[0], /rotation="0 0 0"/);
    assert.doesNotMatch(pieBlock[0], /rotation="90 0 0"/);
});

test('XR template keeps babia-queryjson bound to the injected DATA_SOURCE placeholder', () => {
    const template = readProjectFile('templates', 'xr', 'file', 'xr-visualization.html');

    assert.match(
        template,
        /<a-entity id="data" babia-queryjson="url: \$\{DATA_SOURCE\}"><\/a-entity>/,
    );
});

test('XR template owns the initial chart through a CodeXR analysis surface', () => {
    const template = readProjectFile('templates', 'xr', 'file', 'xr-visualization.html');
    const processor = readProjectFile('src', 'babia_templates', 'processing', 'templateProcessor.ts');

    assert.match(template, /id="codexrAnalysisSurface"[\s\S]*data-codexr-analysis-surface="true"/);
    assert.match(template, /id="codexrNormalAnalysisRoot"[\s\S]*data-codexr-analysis-mode="single"/);
    assert.ok(template.indexOf('${TREE_BUILDER}') > template.indexOf('id="codexrNormalAnalysisRoot"'));
    assert.ok(template.indexOf('${CHART_COMPONENT}') > template.indexOf('id="codexrNormalAnalysisRoot"'));
    assert.match(processor, /normalSurfaceId: 'codexrAnalysisSurface'/);
    assert.match(processor, /normalRootId: 'codexrNormalAnalysisRoot'/);
    assert.match(processor, /normalEntityIds: \['codexrNormalAnalysisRoot'\]/);
    assert.match(processor, /chartEntityIds: chartEntityId \? \[chartEntityId\] : \[\]/);
});

test('XR template includes local CodeXR room component while preserving configurable environment', () => {
    const template = readProjectFile('templates', 'xr', 'file', 'xr-visualization.html');

    assert.doesNotMatch(template, /aframe-lounge-component\.min\.js/);
    assert.match(template, /src="\.\/codexrRoomRuntime\.js(?:\?v=\$\{nonce\})?"/);
    assert.match(template, /src="\.\/codexrMultiScreenManagerRuntime\.js(?:\?v=\$\{nonce\})?"/);
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
    assert.match(template, /src="\.\/analysisTableRuntime\.js(?:\?v=\$\{nonce\})?"/);
    assert.match(template, /src="\.\/codexrCommonRuntime\.js(?:\?v=\$\{nonce\})?"/);
    assert.doesNotMatch(template, /src="\.\/codexrVisualStyleRuntime\.js(:\v=\$\{nonce\})"/);
    assert.doesNotMatch(template, /src="\.\/codeXrBoatsRuntime\.js(:\v=\$\{nonce\})"/);
    assert.match(template, /src="\.\/historicalComparisonRuntime\.js(?:\?v=\$\{nonce\})?"/);
    assert.match(template, /src="\.\/projectEvolutionRuntime\.js(:\v=\$\{nonce\})"/);
    assert.ok(template.indexOf('historicalComparisonRuntime.js') < template.indexOf('projectEvolutionRuntime.js'));
    assert.ok(template.indexOf('codexrCommonRuntime.js') < template.indexOf('dependencyGraphRuntime.js'));
    assert.match(template, /id="codexrAnalysisTable"/);
    assert.match(template, /codexr-analysis-table=/);
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
    assert.match(fileParser, /copyCodeXrCommonRuntimeToOutput/);
    assert.match(fileParser, /CODEXR_COMMON_RUNTIME_OUTPUT_NAME/);
    assert.doesNotMatch(fileParser, /CODEXR_VISUAL_STYLE_RUNTIME_OUTPUT_NAME/);
    assert.doesNotMatch(fileParser, /copyCodeXrVisualStyleRuntimeToOutput/);
    assert.doesNotMatch(fileParser, /CODEXR_BOATS_RUNTIME_OUTPUT_NAME/);
    assert.match(fileParser, /CODEXR_ROOM_RUNTIME_OUTPUT_NAME/);
    assert.match(fileParser, /copyVirtualScreenManagerRuntimeToOutput/);
    assert.match(fileParser, /VIRTUAL_SCREEN_MANAGER_RUNTIME_OUTPUT_NAME/);
    assert.match(fileParser, /copyAnalysisTableRuntimeToOutput/);
    assert.match(fileParser, /ANALYSIS_TABLE_RUNTIME_OUTPUT_NAME/);
    assert.match(directoryParser, /readCodeXrRoomRuntimeContent/);
    assert.match(directoryParser, /readCodeXrCommonRuntimeContent/);
    assert.match(directoryParser, /CODEXR_COMMON_RUNTIME_OUTPUT_NAME/);
    assert.doesNotMatch(directoryParser, /CODEXR_VISUAL_STYLE_RUNTIME_OUTPUT_NAME/);
    assert.doesNotMatch(directoryParser, /readCodeXrVisualStyleRuntimeContent/);
    assert.doesNotMatch(directoryParser, /CODEXR_BOATS_RUNTIME_OUTPUT_NAME/);
    assert.match(directoryParser, /readCodeXrRoomTextureContents/);
    assert.match(directoryParser, /readVirtualScreenManagerRuntimeContent/);
    assert.match(directoryParser, /readAnalysisTableRuntimeContent/);
    assert.match(directoryParser, /generatedFiles\.set\(VIRTUAL_SCREEN_MANAGER_RUNTIME_OUTPUT_NAME, virtualScreenManagerRuntimeContent\)/);
    assert.match(directoryParser, /generatedFiles\.set\(CODEXR_COMMON_RUNTIME_OUTPUT_NAME, codexrCommonRuntimeContent\)/);
    assert.doesNotMatch(directoryParser, /generatedFiles\.set\(CODEXR_VISUAL_STYLE_RUNTIME_OUTPUT_NAME, codexrVisualStyleRuntimeContent\)/);
    assert.doesNotMatch(directoryParser, /generatedFiles\.set\(CODEXR_BOATS_RUNTIME_OUTPUT_NAME, codeXrBoatsRuntimeContent\)/);
    assert.doesNotMatch(directoryParser, /codeXrBoatsTextures\.forEach\(\(asset\) => \{/);
    assert.match(directoryParser, /generatedFiles\.set\(CODEXR_ROOM_RUNTIME_OUTPUT_NAME, codexrRoomRuntimeContent\)/);
    assert.match(directoryParser, /generatedFiles\.set\(ANALYSIS_TABLE_RUNTIME_OUTPUT_NAME, analysisTableRuntimeContent\)/);
    assert.match(directoryParser, /generatedFiles\.set\(HISTORICAL_COMPARISON_RUNTIME_OUTPUT_NAME, historicalComparisonRuntimeContent\)/);
    assert.match(fileParser, /copyProjectEvolutionRuntimeToOutput/);
    assert.match(fileParser, /PROJECT_EVOLUTION_RUNTIME_OUTPUT_NAME/);
    assert.match(directoryParser, /readProjectEvolutionRuntimeContent/);
    assert.match(directoryParser, /generatedFiles\.set\(PROJECT_EVOLUTION_RUNTIME_OUTPUT_NAME, projectEvolutionRuntimeContent\)/);
    assert.match(directoryParser, /generatedFiles\.set\(asset\.relativeOutputPath, asset\.content\)/);
});

test('all XR charts share the containment preset and the programmatic boats fallback reuses it', () => {
    const templateCharts = readProjectFile('src', 'babia_templates', 'charts', 'templateCharts.ts');
    const createChart = readProjectFile('src', 'babia_templates', 'processing', 'placeholders', 'createChart.ts');

    assert.match(templateCharts, /export const XR_TABLE_BOOTSTRAP_PLANAR_MAX = 0\.84;/);
    assert.match(templateCharts, /export const XR_TABLE_STEADY_PLANAR_MIN = 0\.78;/);
    assert.match(templateCharts, /export const XR_TABLE_STEADY_PLANAR_MAX = 0\.92;/);
    assert.match(templateCharts, /export const UNIVERSAL_XR_TABLE_SETTINGS = `enabled: true;[\s\S]*targetWidth: 5\.614;[\s\S]*bootstrapPlanarMaxRatio: \$\{XR_TABLE_BOOTSTRAP_PLANAR_MAX\};[\s\S]*minPlanarOccupancyRatio: \$\{XR_TABLE_STEADY_PLANAR_MIN\};[\s\S]*maxPlanarOccupancyRatio: \$\{XR_TABLE_STEADY_PLANAR_MAX\};[\s\S]*minHeightOccupancyRatio: 0\.45;[\s\S]*heightBandMinRatio: \$\{XR_TABLE_HEIGHT_BAND_MIN\};[\s\S]*heightBandMaxRatio: \$\{XR_TABLE_HEIGHT_BAND_MAX\};[\s\S]*tableEdgeMargin: 0\.18;[\s\S]*periodicContainmentEnabled: true;[\s\S]*stabilizationStablePasses: 3;[\s\S]*transformTransitionMs: 650;[\s\S]*hardHeightGuardEnabled: true`;/);

    const matches = templateCharts.match(/codexr-chart-containment="\$\{UNIVERSAL_XR_TABLE_SETTINGS\}"/g) || [];
    assert.equal(matches.length, 8);
    assert.match(createChart, /UNIVERSAL_XR_TABLE_SETTINGS/);
    assert.match(createChart, /codexr-chart-containment="\$\{UNIVERSAL_XR_TABLE_SETTINGS\}"/);
    assert.match(createChart, /babia-boats="from: tree;/);
    assert.doesNotMatch(templateCharts, /id: 'codexr-boats'/);
    assert.match(templateCharts, /id: 'boats'[\s\S]*name: 'Babia Boats'/);
});

test('XR live SSE refresh lets Babia rebuild boats from refreshed sources instead of forcing a blind chart rebuild', () => {
    const source = readProjectFile('templates', 'xr', 'sse', 'live_sse_fileXR.js');

    assert.match(source, /const CHART_COMPONENT_TYPES = \[/);
    assert.doesNotMatch(source, /'codexr-boats'/);
    assert.match(source, /'babia-boats'/);
    assert.match(source, /function getChartEntities\(\)/);
    assert.match(source, /function hasBoatsChart\(chartEntities\)/);
    assert.match(source, /renormalizeChartContainment\('analysis-updated'/);
    assert.match(source, /renormalizeChartContainment\('analysis-updated-boats-settled'/);
    assert.match(source, /renormalizeChartContainment\('dataRefresh-boats-settled'/);
    assert.doesNotMatch(source, /removeAttribute\(type\)/);
    assert.doesNotMatch(source, /babiaxraycasterclass/);
});

test('mapping UI renormalizes all active comparison charts transactionally', () => {
    const mappingUiRuntime = readProjectFile('templates', 'components', 'codexr', 'xr-chart-mapping-ui', 'xrChartMappingUiRuntime.js');

    assert.match(mappingUiRuntime, /function requestChartContainmentRenormalize\(reason\)/);
    assert.match(mappingUiRuntime, /analysisTableRuntime\.renormalizeAll\(reason \|\| 'mapping-ui-change'\)/);
    assert.match(mappingUiRuntime, /analysisTableRuntime\.renormalizeAll\(\(reason \|\| 'mapping-ui-change'\) \+ '-settled'\)/);
    assert.match(mappingUiRuntime, /function getChartEntities\(config\)/);
    assert.match(mappingUiRuntime, /setChartEntityIds: function \(chartEntityIds\)/);
    assert.match(mappingUiRuntime, /applyDimensionSelection\(config, dimensionId, fieldName, options\)/);
    assert.match(mappingUiRuntime, /var alreadySelected = state\.selectedByDimension\[dimensionId\] === fieldName;/);
    assert.match(mappingUiRuntime, /var forceSelection = !!\(options && options\.force === true\);/);
    assert.match(mappingUiRuntime, /if \(alreadySelected && !forceSelection\) \{/);
    assert.match(mappingUiRuntime, /schedulePendingMappingValidation\(config, state\.pendingMappingToken\);/);
    assert.match(mappingUiRuntime, /requestChartContainmentRenormalize\('mapping-ui-validation-start'\)/);
    assert.match(mappingUiRuntime, /runtime\.waitForChartsStable\(chartTargets/);
    assert.match(mappingUiRuntime, /timeoutMs: 26000/);
    assert.match(mappingUiRuntime, /stablePasses: 2/);
    assert.match(mappingUiRuntime, /registerPanelView: registerPanelView/);
    assert.match(mappingUiRuntime, /showPanelView: showPanelView/);
    assert.match(mappingUiRuntime, /setPanelViewHeight: setPanelViewHeight/);
});

test('analysis table exposes stable geometry states and symmetric historical zones', () => {
    const runtime = readProjectFile('templates', 'components', 'codexr', 'analysis-table', 'analysisTableRuntime.js');

    assert.match(runtime, /geometryState: 'rebuilding'/);
    assert.match(runtime, /geometryState: stabilized \? 'stabilized' : 'valid'/);
    assert.match(runtime, /waitForChartsStable = function \(targets, options\)/);
    assert.match(runtime, /state: allReady \? 'valid-timeout' : 'timeout'/);
    assert.match(runtime, /getAnalysisTableZones = function \(mode\)/);
    assert.match(runtime, /var zoneWidth = \(fullWidth - centerGap\) \/ 2/);
    assert.match(runtime, /anchorX: -centerOffset/);
    assert.match(runtime, /anchorX: centerOffset/);
});
