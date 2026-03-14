const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');

function readProjectFile(...segments) {
    return fs.readFileSync(path.join(projectRoot, ...segments), 'utf8');
}

function assertChartContract(source, chartId, dimensions) {
    let previousIndex = source.indexOf(`id: '${chartId}'`);
    assert.notEqual(previousIndex, -1, `Chart ${chartId} should exist`);

    for (const dimension of dimensions) {
        const nameIndex = source.indexOf(`name: '${dimension.name}'`, previousIndex);
        assert.notEqual(nameIndex, -1, `Chart ${chartId} should define ${dimension.name}`);
        const typeIndex = source.indexOf(`dataType: '${dimension.type}'`, nameIndex);
        assert.notEqual(typeIndex, -1, `Chart ${chartId} should mark ${dimension.name} as ${dimension.type}`);
        previousIndex = typeIndex;
    }
}

test('BabiaXR chart templates keep the audited dimension type contract', () => {
    const templateCharts = readProjectFile('src', 'babia_templates', 'charts', 'templateCharts.ts');
    const createChart = readProjectFile('src', 'babia_templates', 'processing', 'placeholders', 'createChart.ts');

    assertChartContract(templateCharts, 'bars', [
        { name: 'x_axis', type: 'any' },
        { name: 'height', type: 'numeric' },
    ]);
    assertChartContract(templateCharts, 'barsmap', [
        { name: 'x_axis', type: 'any' },
        { name: 'z_axis', type: 'any' },
        { name: 'height', type: 'numeric' },
    ]);
    assertChartContract(templateCharts, 'cyls', [
        { name: 'x_axis', type: 'any' },
        { name: 'height', type: 'numeric' },
        { name: 'radius', type: 'numeric' },
    ]);
    assertChartContract(templateCharts, 'cylsmap', [
        { name: 'x_axis', type: 'any' },
        { name: 'z_axis', type: 'any' },
        { name: 'height', type: 'numeric' },
        { name: 'radius', type: 'numeric' },
    ]);
    assertChartContract(templateCharts, 'donut', [
        { name: 'key', type: 'any' },
        { name: 'size', type: 'numeric' },
    ]);
    assertChartContract(templateCharts, 'pie', [
        { name: 'key', type: 'any' },
        { name: 'size', type: 'numeric' },
    ]);
    assertChartContract(templateCharts, 'bubbles', [
        { name: 'x_axis', type: 'any' },
        { name: 'z_axis', type: 'any' },
        { name: 'height', type: 'numeric' },
        { name: 'radius', type: 'numeric' },
    ]);
    assertChartContract(templateCharts, 'boats', [
        { name: 'area', type: 'numeric' },
        { name: 'height', type: 'numeric' },
        { name: 'color', type: 'any' },
    ]);

    assert.match(createChart, /name: 'area'[\s\S]*dataType: 'numeric'/);
    assert.match(createChart, /name: 'height'[\s\S]*dataType: 'numeric'/);
    assert.match(createChart, /name: 'color'[\s\S]*dataType: 'any'/);
    assert.doesNotMatch(templateCharts, /name: 'width'[\s\S]*id: 'boats'/);
    assert.doesNotMatch(templateCharts, /name: 'depth'[\s\S]*id: 'boats'/);
});
