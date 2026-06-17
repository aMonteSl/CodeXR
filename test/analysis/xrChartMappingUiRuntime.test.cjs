const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..', '..');
const runtimePath = path.join(
    projectRoot,
    'src',
    'codexr-components',
    'others',
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
    assert.match(runtimeSource, /if \(result && result\.valid\) \{/);
    assert.match(runtimeSource, /if \(result && result\.state === 'invalid'\) \{/);
    assert.match(runtimeSource, /invalidStatus\?\.message \|\| 'The selected mapping produced invalid chart geometry\.'/);
    assert.match(runtimeSource, /markInvalidOption\(state\.pendingMapping\.dimensionId, state\.pendingMapping\.fieldName, friendlyMessage\);/);
    assert.match(runtimeSource, /applyMappingSnapshot\(config, state\.pendingMapping\.previousMapping, 'mapping-ui-revert'\)/);
    assert.match(runtimeSource, /state\.lastKnownGoodMapping = cloneMapping\(state\.pendingMapping\.nextMapping\);/);
    assert.match(runtimeSource, /resizeTrace\('mapping-confirmed'/);
    assert.match(runtimeSource, /resizeTrace\('mapping-selection-blocked'/);
    assert.doesNotMatch(runtimeSource, /precheckDimensionSelection/);
    assert.doesNotMatch(runtimeSource, /validateValueRule/);
    assert.doesNotMatch(runtimeSource, /validateCylsGeometry/);
    assert.doesNotMatch(runtimeSource, /validateCylsMapGeometry/);
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

test('mapping UI resolves CodeXR Code City through the shared chart contract', () => {
    const runtime = loadRuntime();
    const chart = {
        getAttribute(componentName) {
            assert.equal(componentName, 'codexr-code-city');
            return {
                from: 'data',
                area: 'parameters',
                height: 'lineCount',
                color: 'complexity',
            };
        },
    };

    const update = runtime.__testing.buildChartComponentUpdate(chart, 'codexr-code-city', {
        area: 'functionCount',
        height: 'totalLines',
        color: 'language',
    });

    assert.deepEqual(
        JSON.parse(JSON.stringify(update)),
        {
            from: 'data',
            area: 'functionCount',
            height: 'totalLines',
            color: 'language',
        },
    );
    assert.match(runtimeSource, /'code-city': 'codexr-code-city'/);
    assert.match(runtimeSource, /config && config\.chartComponentName/);
});


test('mapping UI disables raycast interaction for hidden views and keeps a stable shared entity id', () => {
    assert.match(runtimeSource, /function setEntityInteractionEnabled\(entity, enabled\)/);
    assert.match(runtimeSource, /querySelectorAll\('\[data-codexr-interactive="true"\]'\)/);
    assert.match(runtimeSource, /control\.classList\.remove\('babiaxraycasterclass'\)/);
    assert.match(runtimeSource, /setEntityInteractionEnabled\(previousView\.content, false\)/);
    assert.match(runtimeSource, /setEntityInteractionEnabled\(refs\.rowsRoot, nextViewId === 'mapping'\)/);
    assert.match(runtimeSource, /setEntityInteractionEnabled\(targetView\.content, true\)/);
    assert.match(runtimeSource, /setEntityInteractionEnabled\(refs\.rowsRoot, state\.activePanelView === 'mapping'\)/);
    assert.match(runtimeSource, /new root\.MutationObserver/);
    assert.match(runtimeSource, /state\.activePanelView === viewId/);
    assert.match(runtimeSource, /data-codexr-interactive/);
    assert.match(runtimeSource, /config\.chartEntityId \|\| config\.chartSelector \|\| config\.chartId/);
});

test('mapping UI emits confirmed mappings for local and collaborative updates', () => {
    assert.match(runtimeSource, /function notifyMappingConfirmed\(mapping\)/);
    assert.match(runtimeSource, /new root\.CustomEvent\('codexr-mapping-confirmed'/);
    assert.match(runtimeSource, /notifyMappingConfirmed\(state\.lastKnownGoodMapping\)/);
});

test('mapping UI runtime keeps the user-facing rollback message centered on visualization failures', () => {
    assert.match(runtimeSource, /function buildFriendlyInvalidMappingMessage\(config, dimensionId, fieldName, reason, includeRestoreLine\)/);
    assert.match(runtimeSource, /caused an invalid chart for/);
    assert.match(runtimeSource, /CodeXR restored the last valid mapping to keep the visualization stable\./);
    assert.match(runtimeSource, /CodeXR blocked this option because the visualization failed the last time it was used\./);
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
