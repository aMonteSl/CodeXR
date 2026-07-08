const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..', '..');
const runtimePath = path.join(
    projectRoot,
    'templates',
    'components',
    'codexr',
    'xr-chart-mapping-ui',
    'xrChartMappingUiRuntime.js',
);
const runtimeSource = fs.readFileSync(runtimePath, 'utf8');

function plain(value) {
    return JSON.parse(JSON.stringify(value));
}

function loadRuntime() {
    const sandbox = {
        console: {
            log() {},
            warn() {},
            error() {},
        },
        module: { exports: {} },
        exports: {},
        setTimeout() {
            return 1;
        },
        clearTimeout() {},
    };

    sandbox.globalThis = sandbox;
    vm.runInNewContext(runtimeSource, sandbox, { filename: runtimePath });
    return sandbox.module.exports;
}

function createFakeElement(tagName, notifyMutation) {
    const element = {
        tagName,
        children: [],
        parentNode: null,
        attributes: {},
        textContent: '',
        classList: {
            values: new Set(),
            add(value) {
                this.values.add(value);
            },
            remove(value) {
                this.values.delete(value);
            },
            contains(value) {
                return this.values.has(value);
            },
        },
        appendChild(child) {
            this.children.push(child);
            child.parentNode = this;
            notifyMutation(this);
        },
        removeChild(child) {
            this.children = this.children.filter((candidate) => candidate !== child);
            child.parentNode = null;
            notifyMutation(this);
        },
        remove() {
            if (this.parentNode) {
                this.parentNode.removeChild(this);
            }
        },
        setAttribute(name, value) {
            this.attributes[name] = value;
            if (name === 'class') {
                this.classList.values = new Set(String(value).split(/\s+/).filter(Boolean));
            }
        },
        getAttribute(name) {
            return this.attributes[name];
        },
        removeAttribute(name) {
            delete this.attributes[name];
        },
        addEventListener() {},
        querySelectorAll(selector) {
            const results = [];
            function visit(node) {
                node.children.forEach((child) => {
                    if (selector === '[data-codexr-interactive="true"]' && child.attributes['data-codexr-interactive'] === 'true') {
                        results.push(child);
                    }
                    visit(child);
                });
            }
            visit(this);
            return results;
        },
    };
    Object.defineProperty(element, 'firstChild', {
        get() {
            return this.children[0] || null;
        },
    });
    return element;
}

function loadRuntimeWithFakeDom(configOverride = {}) {
    const observers = new Map();
    const elements = new Map();
    function notifyMutation(target) {
        let current = target;
        while (current) {
            (observers.get(current) || []).forEach((observer) => observer.callback());
            current = current.parentNode;
        }
    }
    function element(tagName, id) {
        const node = createFakeElement(tagName, notifyMutation);
        if (id) {
            node.setAttribute('id', id);
            elements.set(id, node);
        }
        return node;
    }
    const scene = element('a-scene', 'scene');
    const configScript = element('script', 'codexr-tooling-config-xr-mapping-ui');
    configScript.textContent = JSON.stringify({
        sceneSelector: '#scene',
        chartId: 'boats',
        chartEntityId: 'chart',
        dimensions: [],
        ...configOverride,
    });
    const document = {
        readyState: 'complete',
        createElement(tagName) {
            return element(tagName);
        },
        getElementById(id) {
            return elements.get(id) || null;
        },
        querySelector(selector) {
            if (selector === '#scene') {
                return scene;
            }
            return null;
        },
        querySelectorAll() {
            return [];
        },
    };
    const sandbox = {
        console: {
            log() {},
            warn() {},
            error() {},
        },
        document,
        module: { exports: {} },
        exports: {},
        setTimeout() {
            return 1;
        },
        clearTimeout() {},
        MutationObserver: class MutationObserver {
            constructor(callback) {
                this.callback = callback;
            }
            observe(target) {
                if (!observers.has(target)) {
                    observers.set(target, []);
                }
                observers.get(target).push(this);
            }
            disconnect() {}
        },
    };
    sandbox.globalThis = sandbox;
    vm.runInNewContext(runtimeSource, sandbox, { filename: runtimePath });
    return { runtime: sandbox.module.exports, document };
}

function createChartEntityForSwitchTest(initialAttributes = {}) {
    const chart = createFakeElement('a-entity', () => {});
    Object.entries(initialAttributes).forEach(([name, value]) => {
        chart.setAttribute(name, value);
    });
    return chart;
}

test('mapping UI runtime only exposes session invalid-option helpers for chart rollback handling', () => {
    const runtime = loadRuntime();

    assert.ok(runtime.__testing);
    assert.equal(typeof runtime.__testing.getInvalidOptionReason, 'function');
    assert.equal(typeof runtime.__testing.buildChartComponentUpdate, 'function');
    assert.equal('validateValueRule' in runtime.__testing, false);
    assert.equal('validateCylsGeometry' in runtime.__testing, false);
    assert.equal('validateCylsMapGeometry' in runtime.__testing, false);
    assert.equal('precheckDimensionSelection' in runtime.__testing, false);
});

test('mapping UI runtime relies on post-Babia validation and rollback instead of prechecking field values', () => {
    assert.match(runtimeSource, /function inspectChartStatus\(config\)/);
    assert.match(runtimeSource, /function evaluatePendingMapping\(config, token, result\)/);
    assert.match(runtimeSource, /runtime\.waitForChartsStable\(chartTargets/);
    assert.match(runtimeSource, /if \(result && result\.valid && result\.stabilized\) \{/);
    assert.match(runtimeSource, /mapping-ui-unstable-revert/);
    assert.match(runtimeSource, /mapping-reverted-unstable-containment/);
    assert.match(runtimeSource, /if \(result && result\.state === 'invalid'\) \{/);
    assert.match(runtimeSource, /invalidStatus\?\.message \|\| 'The selected mapping produced invalid chart geometry\.'/);
    assert.match(runtimeSource, /markInvalidOption\(state\.pendingMapping\.dimensionId, state\.pendingMapping\.fieldName, friendlyMessage\);/);
    assert.match(runtimeSource, /applyMappingSnapshot\(config, state\.pendingMapping\.previousMapping, 'mapping-ui-revert'\)/);
    assert.match(runtimeSource, /state\.lastKnownGoodMapping = cloneMapping\(state\.pendingMapping\.nextMapping\);/);
    assert.match(runtimeSource, /resizeTrace\('mapping-confirmed'/);
    assert.match(runtimeSource, /resizeTrace\('mapping-selection-blocked'/);
    assert.doesNotMatch(runtimeSource, /keep stabilizing the chart in the background/);
    assert.doesNotMatch(runtimeSource, /precheckDimensionSelection/);
    assert.doesNotMatch(runtimeSource, /validateValueRule/);
    assert.doesNotMatch(runtimeSource, /validateCylsGeometry/);
    assert.doesNotMatch(runtimeSource, /validateCylsMapGeometry/);
});

test('mapping UI validates against dynamically resolved containment targets during Babia rebuilds', () => {
    assert.match(runtimeSource, /function isChartMappingEntity\(entity, componentName\)/);
    assert.match(runtimeSource, /hasEntityAttribute\(entity, 'codexr-chart-containment'\)/);
    assert.match(runtimeSource, /function isAnalysisRootEntity\(entity\)/);
    assert.match(runtimeSource, /return false;\s*\}\s*return !!\(componentName && hasEntityAttribute\(entity, componentName\)\);/);
    assert.match(runtimeSource, /function findFallbackChartEntity\(config, preferredId\)/);
    assert.match(runtimeSource, /function buildChartValidationTargets\(config\)/);
    assert.match(runtimeSource, /return function resolveChartTarget\(\) \{/);
    assert.match(runtimeSource, /return findFallbackChartEntity\(config, id\);/);
    assert.match(runtimeSource, /queryEntities\(scopes\[i\], '\[codexr-chart-containment\]'\)/);
    assert.match(runtimeSource, /hasEntityAttribute\(entity, componentName\)/);
    assert.match(runtimeSource, /var chartTargets = buildChartValidationTargets\(config\);/);
    assert.match(runtimeSource, /analysisTableRuntime\.getChartStatus\(resolveChartTarget\(\)\)/);
    assert.doesNotMatch(runtimeSource, /var chartIds = getChartEntities\(config\)\.map/);
});

test('mapping UI schedules containment bursts while waiting for a stable table fit', () => {
    assert.match(runtimeSource, /function scheduleContainmentValidationBursts\(reason\)/);
    assert.match(runtimeSource, /scheduleContainmentValidationBursts\('mapping-ui-validation'\)/);
    assert.match(runtimeSource, /\[650, 1300, 2200, 3600, 5200, 7600, 10500, 14000, 18000\]/);
    assert.match(runtimeSource, /timeoutMs: 26000/);
    assert.match(runtimeSource, /scheduleContainmentValidationBursts\('mapping-ui-revert'\)/);
    assert.match(runtimeSource, /scheduleContainmentValidationBursts\('mapping-ui-timeout-revert'\)/);
    assert.match(runtimeSource, /renormalizeAll\(\(reason \|\| 'mapping-ui-validation'\) \+ '-burst-'/);
});

test('mapping UI stores confirmed mappings per analysis context', () => {
    assert.doesNotMatch(runtimeSource, /'codexr-boats': 'codexr-boats'/);
    assert.match(runtimeSource, /boats: 'babia-boats'/);
    assert.match(runtimeSource, /activeMappingContextId: 'normal-analysis'/);
    assert.match(runtimeSource, /mappingProfiles: \{\}/);
    assert.match(runtimeSource, /function switchMappingContext\(contextId, options\)/);
    assert.match(runtimeSource, /saveActiveMappingProfile\(\);/);
    assert.match(runtimeSource, /state\.activeMappingContextId = nextContextId;/);
    assert.match(runtimeSource, /getMappingProfileKey\(nextContextId, getActiveChartId\(config\)\)/);
    assert.match(runtimeSource, /state\.mappingProfiles\[profileKey\] \|\| buildDefaultMappingSnapshot\(config\)/);
    assert.match(runtimeSource, /mappingContextId: state\.activeMappingContextId/);
    assert.match(runtimeSource, /switchMappingContext: switchMappingContext/);
    assert.match(runtimeSource, /getMappingContext: function \(\)/);
});

test('mapping UI exposes the Analysis Controller facade while preserving legacy mapping API', () => {
    assert.match(runtimeSource, /root\.CodeXRAnalysisControllerRuntime = runtime/);
    assert.match(runtimeSource, /CONTROLLER_PANEL_BY_VIEW = \{/);
    assert.match(runtimeSource, /'visualization-menu': 'visualization-mode'/);
    assert.match(runtimeSource, /'historical.mapping': 'mapping'/);
    assert.match(runtimeSource, /function showControllerView\(viewId, context\)/);
    assert.match(runtimeSource, /state\.activeControllerView = nextViewId;/);
    assert.match(runtimeSource, /getModeMemory: getModeMemory/);
    assert.match(runtimeSource, /saveModeMemory: saveModeMemory/);
    assert.match(runtimeSource, /controllerView: state\.activeControllerView/);
});

test('mapping UI exposes live chart switching with chart-specific defaults', () => {
    const runtime = loadRuntime();
    const chartData = runtime.__testing.buildRuntimeChartData('boats', { from: 'data', palette: 'ubuntu' }, {
        area: 'functionCount',
        height: 'totalLines',
        color: 'language',
    });
    const barsData = runtime.__testing.buildRuntimeChartData('bars', { from: 'codexrComparisonLeft' }, {
        x_axis: 'fileName',
        height: 'totalLines',
    });

    assert.equal(typeof runtime.selectChart, 'function');
    assert.equal(chartData.from, 'tree');
    assert.equal(chartData.area, 'functionCount');
    assert.equal(barsData.from, 'codexrComparisonLeft');
    assert.equal(barsData.x_axis, 'fileName');
    assert.match(runtimeSource, /function renderChartSelector\(config\)/);
    assert.match(runtimeSource, /data-codexr-chart-id/);
    assert.match(runtimeSource, /function selectChart\(chartId\)/);
    assert.match(runtimeSource, /chartId: getActiveChartId\(getConfig\(\)\)/);
    assert.match(runtimeSource, /chartId: getActiveChartId\(config\)/);
});

test('mapping UI chart switch removes stale Babia-rendered children before creating the next chart', () => {
    const runtime = loadRuntime();
    const chart = createChartEntityForSwitchTest({
        'codexr-chart-containment': 'preset: table',
        'babia-bars': {
            from: 'data',
            x_axis: 'fileName',
            height: 'totalLines',
            color: 'cyclomaticComplexityNumber',
        },
    });
    const oldBar = createFakeElement('a-box', () => {});
    oldBar.setAttribute('data-babia-rendered-child', 'old-bar');
    const oldAxis = createFakeElement('a-entity', () => {});
    oldAxis.setAttribute('data-babia-rendered-child', 'old-axis');
    chart.appendChild(oldBar);
    chart.appendChild(oldAxis);

    const applied = runtime.__testing.applyChartTypeToEntity(
        chart,
        'bubbles',
        {
            x_axis: 'fileName',
            height: 'totalLines',
            radius: 'functionCount',
        },
    );

    assert.equal(applied, true);
    assert.equal(chart.children.length, 0);
    assert.equal(chart.getAttribute('babia-bars'), undefined);
    assert.equal(chart.getAttribute('babia-bubbles').x_axis, 'fileName');
    assert.equal(chart.getAttribute('babia-bubbles').radius, 'functionCount');
    assert.equal(chart.getAttribute('data-codexr-active-chart-id'), 'bubbles');
    assert.equal(chart.getAttribute('codexr-chart-containment'), 'preset: table');
});

test('mapping UI chart switch keeps pie and donut upright instead of inheriting a flat rotation', () => {
    const runtime = loadRuntime();
    const donutChart = createChartEntityForSwitchTest({
        'codexr-chart-containment': 'preset: table',
        'babia-bars': {
            from: 'data',
            x_axis: 'fileName',
            height: 'totalLines',
        },
        rotation: '90 0 0',
    });
    const pieChart = createChartEntityForSwitchTest({
        'codexr-chart-containment': 'preset: table',
        'babia-bubbles': {
            from: 'data',
            x_axis: 'fileName',
            height: 'totalLines',
            radius: 'functionCount',
        },
        rotation: '90 0 0',
    });

    assert.equal(runtime.__testing.applyChartTypeToEntity(donutChart, 'donut', {
        key: 'language',
        size: 'totalLines',
    }), true);
    assert.equal(runtime.__testing.applyChartTypeToEntity(pieChart, 'pie', {
        key: 'language',
        size: 'totalLines',
    }), true);

    assert.equal(donutChart.getAttribute('rotation'), '0 0 0');
    assert.equal(donutChart.getAttribute('babia-bars'), undefined);
    assert.equal(donutChart.getAttribute('babia-doughnut').key, 'language');
    assert.equal(pieChart.getAttribute('rotation'), '0 0 0');
    assert.equal(pieChart.getAttribute('babia-bubbles'), undefined);
    assert.equal(pieChart.getAttribute('babia-pie').size, 'totalLines');
});

test('mapping UI chart selector and dimension grids share safe panel margins', () => {
    const runtime = loadRuntime();
    const layout = runtime.__testing.PANEL_LAYOUT;
    const chartCols = 3;
    const chartButtonWidth = runtime.__testing.getGridButtonWidth(chartCols);
    const firstX = runtime.__testing.getGridButtonX(0, chartButtonWidth);
    const lastX = runtime.__testing.getGridButtonX(chartCols - 1, chartButtonWidth);

    assert.ok(chartButtonWidth > 0);
    assert.ok(firstX - chartButtonWidth * 0.5 >= layout.left - 0.000001);
    assert.ok(lastX + chartButtonWidth * 0.5 <= layout.right + 0.000001);
    assert.ok(layout.sectionGap >= 0.3);
    const panelHeight = 5.8;
    const chartRootY = panelHeight * 0.45 - layout.chartRootHeightOffset;
    const rowsRootY = panelHeight * 0.45 - layout.rowsRootHeightOffset;
    const lastChartButtonBottomY = chartRootY - layout.labelToButtonsGap - (layout.maxChartRows - 1) * layout.rowGap - 0.11;
    const areaLabelTopY = rowsRootY - 0.05 + 0.11;
    assert.ok(lastChartButtonBottomY - areaLabelTopY >= 0.34);
    assert.match(runtimeSource, /position: '-0\.05 -0\.18 0\.02'/);
    assert.match(runtimeSource, /position: '-0\.05 0\.9 0\.03'/);
    assert.match(runtimeSource, /rowsRootHeightOffset: 1\.72/);
    assert.match(runtimeSource, /chartRootHeightOffset: 0\.34/);
    assert.match(runtimeSource, /var panelHeight = Math\.max\(2\.9, Math\.abs\(cursorY\) \+ PANEL_LAYOUT\.panelHeightPadding\)/);
});

test('mapping UI restores independent normal and historical mappings', () => {
    const { runtime } = loadRuntimeWithFakeDom({
        dimensions: [
            {
                id: 'area',
                label: 'Area',
                currentField: 'functionCount',
                fields: ['functionCount', 'fileSizeBytes', 'codeRatio'],
            },
            {
                id: 'height',
                label: 'Height',
                currentField: 'totalLines',
                fields: ['totalLines', 'commentLines'],
            },
            {
                id: 'color',
                label: 'Color',
                currentField: 'language',
                fields: ['language', 'cyclomaticComplexityNumber'],
            },
        ],
    });

    assert.equal(runtime.getMappingContext(), 'normal-analysis');
    assert.deepEqual(plain(runtime.getState().lastKnownGoodMapping), {
        area: 'functionCount',
        height: 'totalLines',
        color: 'language',
    });

    runtime.restoreState({
        selectedByDimension: {
            area: 'fileSizeBytes',
            height: 'totalLines',
            color: 'language',
        },
        lastKnownGoodMapping: {
            area: 'fileSizeBytes',
            height: 'totalLines',
            color: 'language',
        },
    });

    runtime.switchMappingContext('historical-comparison');
    assert.equal(runtime.getMappingContext(), 'historical-comparison');
    assert.deepEqual(plain(runtime.getState().lastKnownGoodMapping), {
        area: 'functionCount',
        height: 'totalLines',
        color: 'language',
    });

    runtime.restoreState({
        selectedByDimension: {
            area: 'codeRatio',
            height: 'commentLines',
            color: 'cyclomaticComplexityNumber',
        },
        lastKnownGoodMapping: {
            area: 'codeRatio',
            height: 'commentLines',
            color: 'cyclomaticComplexityNumber',
        },
    });

    runtime.switchMappingContext('normal-analysis');
    assert.deepEqual(plain(runtime.getState().lastKnownGoodMapping), {
        area: 'fileSizeBytes',
        height: 'totalLines',
        color: 'language',
    });

    runtime.switchMappingContext('historical-comparison');
    assert.deepEqual(plain(runtime.getState().lastKnownGoodMapping), {
        area: 'codeRatio',
        height: 'commentLines',
        color: 'cyclomaticComplexityNumber',
    });
});

test('mapping updates preserve each comparison chart datasource and chart-specific options', () => {
    const runtime = loadRuntime();
    const leftChart = {
        getAttribute(componentName) {
            assert.equal(componentName, 'babia-boats');
            return {
                from: 'codexrComparisonTreeLeft',
                area: 'functionCount',
                height: 'totalLines',
                color: 'cyclomaticComplexityNumber',
                legend: true,
            };
        },
    };
    const rightChart = {
        getAttribute() {
            return {
                from: 'codexrComparisonTreeRight',
                area: 'functionCount',
                height: 'totalLines',
                color: 'cyclomaticComplexityNumber',
                legend: false,
            };
        },
    };

    const mapping = {
        area: 'commentLines',
        height: 'maxFunctionParameters',
        color: 'cyclomaticComplexityNumber',
    };
    const leftUpdate = runtime.__testing.buildChartComponentUpdate(leftChart, 'babia-boats', mapping);
    const rightUpdate = runtime.__testing.buildChartComponentUpdate(rightChart, 'babia-boats', mapping);

    assert.deepEqual(
        JSON.parse(JSON.stringify(leftUpdate)),
        {
            from: 'codexrComparisonTreeLeft',
            area: 'commentLines',
            height: 'maxFunctionParameters',
            color: 'cyclomaticComplexityNumber',
            legend: true,
        },
    );
    assert.deepEqual(
        JSON.parse(JSON.stringify(rightUpdate)),
        {
            from: 'codexrComparisonTreeRight',
            area: 'commentLines',
            height: 'maxFunctionParameters',
            color: 'cyclomaticComplexityNumber',
            legend: false,
        },
    );

    assert.equal(runtime.__testing.isHierarchicalChart('codexr-boats'), false);
});

test('mapping UI disables raycast interaction for hidden views and keeps a stable shared entity id', () => {
    assert.match(runtimeSource, /function setEntityInteractionEnabled\(entity, enabled\)/);
    assert.match(runtimeSource, /function syncPanelViewInteraction\(viewId\)/);
    assert.match(runtimeSource, /state\.visible && state\.activePanelView === viewId/);
    assert.match(runtimeSource, /setEntityInteractionEnabled\(refs\.rowsRoot, state\.visible && state\.activePanelView === 'mapping'\)/);
    assert.match(runtimeSource, /setEntityInteractionEnabled\(refs\.chartRoot, state\.visible && state\.activePanelView === 'mapping'\)/);
    assert.match(runtimeSource, /refs\.rowsRoot\.setAttribute\('visible', nextViewId === 'mapping'\)/);
    assert.match(runtimeSource, /refs\.chartRoot\.setAttribute\('visible', nextViewId === 'mapping'\)/);
    assert.match(runtimeSource, /new root\.MutationObserver/);
    assert.match(runtimeSource, /observer\.observe\(content, \{ childList: true, subtree: true \}\)/);
    assert.match(runtimeSource, /querySelectorAll\('\[data-codexr-interactive="true"\]'\)/);
    assert.match(runtimeSource, /control\.classList\.remove\('babiaxraycasterclass'\)/);
    assert.match(runtimeSource, /syncPanelInteractions\(\)/);
    assert.match(runtimeSource, /data-codexr-interactive/);
    assert.match(runtimeSource, /config\.chartEntityId \|\| config\.chartSelector \|\| config\.chartId/);
});

test('mapping UI disables interactive controls added to hidden panel views after registration', () => {
    const { runtime, document } = loadRuntimeWithFakeDom();
    const content = document.createElement('a-entity');

    runtime.registerPanelView({
        id: 'visualization-mode',
        title: 'Visualization mode',
        content,
        headerButton: true,
    });

    const lateButton = document.createElement('a-plane');
    lateButton.setAttribute('class', 'babiaxraycasterclass codexr-analysis-mode-option');
    lateButton.setAttribute('data-codexr-interactive', 'true');
    content.appendChild(lateButton);

    assert.equal(runtime.getActivePanelView(), 'mapping');
    assert.equal(lateButton.classList.contains('babiaxraycasterclass'), false);

    runtime.showPanelView('visualization-mode');
    assert.equal(lateButton.classList.contains('babiaxraycasterclass'), true);

    runtime.showPanelView('mapping');
    assert.equal(lateButton.classList.contains('babiaxraycasterclass'), false);
});

test('mapping UI emits confirmed mappings for local and collaborative updates', () => {
    assert.match(runtimeSource, /function notifyMappingConfirmed\(mapping\)/);
    assert.match(runtimeSource, /new root\.CustomEvent\('codexr-mapping-confirmed'/);
    assert.match(runtimeSource, /notifyMappingConfirmed\(state\.lastKnownGoodMapping\)/);
});

test('mapping UI runtime keeps the user-facing rollback message centered on Babia chart failures', () => {
    assert.match(runtimeSource, /function buildFriendlyInvalidMappingMessage\(config, dimensionId, fieldName, reason, includeRestoreLine\)/);
    assert.match(runtimeSource, /caused an invalid chart for/);
    assert.match(runtimeSource, /CodeXR restored the last valid mapping to keep the visualization stable\./);
    assert.match(runtimeSource, /CodeXR blocked this option because Babia failed the last time it was used\./);
    assert.match(runtimeSource, /Try another field for this axis\./);
    assert.match(runtimeSource, /setStatusMessage\(friendlyMessage, 'error', 4800\);/);
    assert.match(runtimeSource, /setStatusMessage\(invalidOptionReason, 'error', 3600\);/);
});

test('mapping UI runtime publishes only confirmed mappings through the shared collaboration room', () => {
    assert.match(runtimeSource, /var SHARED_ENTITY_KIND = 'mapping';/);
    assert.match(runtimeSource, /function getCollaborationClient\(\)/);
    assert.match(runtimeSource, /function buildSharedMappingState\(config\)/);
    assert.match(runtimeSource, /function publishSharedMappingState\(config, eventType\)/);
    assert.match(runtimeSource, /function applySharedMappingState\(config, snapshot\)/);
    assert.match(runtimeSource, /function registerSharedMappingEntity\(config\)/);
    assert.match(runtimeSource, /publishSharedMappingState\(config\);/);
    assert.match(runtimeSource, /registerSharedMappingEntity\(config\);/);
    assert.match(runtimeSource, /entityKind: SHARED_ENTITY_KIND/);
    assert.match(runtimeSource, /selectedByDimension: cloneMapping\(state\.lastKnownGoodMapping \|\| state\.selectedByDimension\)/);
});
