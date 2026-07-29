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
        if (dimension.valueRule) {
            const valueRuleIndex = source.indexOf(`valueRule: '${dimension.valueRule}'`, typeIndex);
            assert.notEqual(valueRuleIndex, -1, `Chart ${chartId} should mark ${dimension.name} with valueRule ${dimension.valueRule}`);
            previousIndex = valueRuleIndex;
            continue;
        }
        previousIndex = typeIndex;
    }
}

test('BabiaXR chart templates keep the audited dimension type contract', () => {
    const templateCharts = readProjectFile('src', 'babia_templates', 'charts', 'templateCharts.ts');
    const createChart = readProjectFile('src', 'babia_templates', 'processing', 'placeholders', 'createChart.ts');

    assertChartContract(templateCharts, 'bars', [
        { name: 'x_axis', type: 'any' },
        { name: 'height', type: 'numeric', valueRule: 'numeric-finite' },
    ]);
    assertChartContract(templateCharts, 'barsmap', [
        { name: 'x_axis', type: 'any' },
        { name: 'z_axis', type: 'any' },
        { name: 'height', type: 'numeric', valueRule: 'numeric-finite' },
    ]);
    assertChartContract(templateCharts, 'cyls', [
        { name: 'x_axis', type: 'any' },
        { name: 'height', type: 'numeric', valueRule: 'numeric-finite' },
        { name: 'radius', type: 'numeric', valueRule: 'numeric-positive' },
    ]);
    assertChartContract(templateCharts, 'cylsmap', [
        { name: 'x_axis', type: 'any' },
        { name: 'z_axis', type: 'any' },
        { name: 'height', type: 'numeric', valueRule: 'numeric-finite' },
        { name: 'radius', type: 'numeric', valueRule: 'numeric-positive' },
    ]);
    assertChartContract(templateCharts, 'donut', [
        { name: 'key', type: 'any' },
        { name: 'size', type: 'numeric', valueRule: 'numeric-positive' },
    ]);
    assertChartContract(templateCharts, 'pie', [
        { name: 'key', type: 'any' },
        { name: 'size', type: 'numeric', valueRule: 'numeric-positive' },
    ]);
    assertChartContract(templateCharts, 'bubbles', [
        { name: 'x_axis', type: 'any' },
        { name: 'z_axis', type: 'any' },
        { name: 'height', type: 'numeric', valueRule: 'numeric-finite' },
        { name: 'radius', type: 'numeric', valueRule: 'numeric-positive' },
    ]);
    assertChartContract(templateCharts, 'boats', [
        { name: 'area', type: 'numeric', valueRule: 'numeric-positive' },
        { name: 'height', type: 'numeric', valueRule: 'numeric-finite' },
        { name: 'color', type: 'any' },
    ]);

    // createChart no longer keeps its own boats contract: every chart —
    // dimensions included — resolves from the canonical template list.
    assert.doesNotMatch(createChart, /babia-boats|createDefaultBoatsChart/);
    assert.match(createChart, /chartTemplates\.find\(\(candidate\) => candidate\.id === chartId\)/);
    assert.doesNotMatch(templateCharts, /name: 'width'[\s\S]*id: 'boats'/);
    assert.doesNotMatch(templateCharts, /name: 'depth'[\s\S]*id: 'boats'/);
});
