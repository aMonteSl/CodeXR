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

    const boatsBlock = templateCharts.match(/babia-boats="from: tree;[\s\S]*?zone_elevation: 0\.01"/);
    assert.ok(boatsBlock);
    assert.match(boatsBlock[0], /legend_text: \$\{DEFAULT_BOATS_LEGEND_TEXT\};/);
    assert.match(boatsBlock[0], /extra: 1;/);
    assert.match(templateCharts, /id="chart"[\s\S]*?scale="0\.01 0\.5 0\.01"/);
    assert.doesNotMatch(boatsBlock[0], /\{fwidth\}|\{fdepth\}|\{width\}|\{depth\}/);

    const donutBlock = templateCharts.match(/babia-doughnut="from: data;[\s\S]*?axis_name: true"/);
    assert.ok(donutBlock);
    assert.equal(donutBlock[0].includes('legend_text'), false);

    assert.match(createChart, /legend_text: \$\{DEFAULT_BOATS_LEGEND_TEXT\};/);
    assert.match(createChart, /extra: 1;/);
    assert.match(createChart, /zone_elevation: 0\.01/);
    assert.match(createChart, /scale="0\.01 0\.5 0\.01"/);
    assert.doesNotMatch(createChart, /\{fwidth\}|\{fdepth\}|\{width\}|\{depth\}/);
});

test('XR template keeps babia-queryjson bound to the injected DATA_SOURCE placeholder', () => {
    const template = readProjectFile('templates', 'xr', 'file', 'xr-visualization.html');

    assert.match(
        template,
        /<a-entity id="data" babia-queryjson="url: \$\{DATA_SOURCE\}"><\/a-entity>/,
    );

    assert.match(
        template,
        /<script src="https:\/\/babiaxr\.gitlab\.io\/aframe-babia-components\/examples\/publications\/codecityvs\/aframe-lounge-component\.min\.js"><\/script>/,
    );
    assert.match(
        template,
        /<a-entity id="loungeRoom" position="0 5\.5 -2" lounge="width: 22; depth: 28; height: 11; north: barrier"><\/a-entity>/,
    );
    assert.match(template, /<a-entity id="rig" movement-controls="fly: true" position="0 1\.6 2\.5">/);
    assert.match(template, /<a-entity camera position="0 0 0" look-controls><\/a-entity>/);
});
