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

test('mapping UI runtime only exposes session invalid-option helpers for chart rollback handling', () => {
    const runtime = loadRuntime();

    assert.ok(runtime.__testing);
    assert.equal(typeof runtime.__testing.getInvalidOptionReason, 'function');
    assert.equal('validateValueRule' in runtime.__testing, false);
    assert.equal('validateCylsGeometry' in runtime.__testing, false);
    assert.equal('validateCylsMapGeometry' in runtime.__testing, false);
    assert.equal('precheckDimensionSelection' in runtime.__testing, false);
});

test('mapping UI runtime relies on post-Babia validation and rollback instead of prechecking field values', () => {
    assert.match(runtimeSource, /function inspectChartStatus\(config\)/);
    assert.match(runtimeSource, /function evaluatePendingMapping\(config, token, isFinalAttempt\)/);
    assert.match(runtimeSource, /var status = inspectChartStatus\(config\);/);
    assert.match(runtimeSource, /if \(status\.valid\) \{/);
    assert.match(runtimeSource, /revertPendingMapping\(config, token, status\.message \|\| 'The selected mapping produced invalid chart geometry\.'\);/);
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

test('mapping UI runtime keeps the user-facing rollback message centered on Babia chart failures', () => {
    assert.match(runtimeSource, /function buildFriendlyInvalidMappingMessage\(config, dimensionId, fieldName, reason, includeRestoreLine\)/);
    assert.match(runtimeSource, /caused an invalid chart for/);
    assert.match(runtimeSource, /CodeXR restored the last valid mapping to keep the visualization stable\./);
    assert.match(runtimeSource, /CodeXR blocked this option because Babia failed the last time it was used\./);
    assert.match(runtimeSource, /Try another field for this axis\./);
    assert.match(runtimeSource, /setStatusMessage\(friendlyMessage, 'error', 4800\);/);
    assert.match(runtimeSource, /setStatusMessage\(invalidOptionReason, 'error', 3600\);/);
});
