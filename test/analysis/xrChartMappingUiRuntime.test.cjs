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

function loadRuntimeWithFakeDom() {
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
    assert.match(runtimeSource, /runtime\.waitForChartsStable\(chartIds/);
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

test('mapping UI schedules containment bursts while waiting for a stable table fit', () => {
    assert.match(runtimeSource, /function scheduleContainmentValidationBursts\(reason\)/);
    assert.match(runtimeSource, /scheduleContainmentValidationBursts\('mapping-ui-validation'\)/);
    assert.match(runtimeSource, /\[650, 1300, 2200, 3600, 5200\]/);
    assert.match(runtimeSource, /renormalizeAll\(\(reason \|\| 'mapping-ui-validation'\) \+ '-burst-'/);
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
});

test('mapping UI disables raycast interaction for hidden views and keeps a stable shared entity id', () => {
    assert.match(runtimeSource, /function setEntityInteractionEnabled\(entity, enabled\)/);
    assert.match(runtimeSource, /function syncPanelViewInteraction\(viewId\)/);
    assert.match(runtimeSource, /state\.visible && state\.activePanelView === viewId/);
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
