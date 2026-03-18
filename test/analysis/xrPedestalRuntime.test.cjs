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
    'chart-pedestal',
    'chartPedestalRuntime.js',
);
const runtimeSource = fs.readFileSync(runtimePath, 'utf8');

function loadRuntimeSandbox() {
    const registered = {};
    const sandbox = {
        console: {
            log() {},
            warn() {},
            error() {},
            table() {},
        },
        setTimeout() {
            return 1;
        },
        clearTimeout() {},
        AFRAME: {
            components: {},
            registerComponent(name, definition) {
                registered[name] = definition;
                this.components[name] = definition;
            },
        },
    };

    sandbox.window = sandbox;
    vm.runInNewContext(runtimeSource, sandbox, { filename: runtimePath });

    return {
        sandbox,
        runtime: sandbox.CodeXRChartPedestalRuntime,
        componentDefinition: registered['codexr-chart-pedestal'],
        legacyComponentDefinition: registered['codexr-boats-pedestal'],
    };
}

test('chart pedestal runtime registers the generic component name and preserves the legacy alias', () => {
    const { componentDefinition, legacyComponentDefinition } = loadRuntimeSandbox();

    assert.ok(componentDefinition);
    assert.ok(legacyComponentDefinition);
    assert.ok(componentDefinition.schema.maxPlanarOccupancyRatio);
    assert.ok(componentDefinition.schema.tableEdgeMargin);
    assert.ok(componentDefinition.schema.stabilizationCheckMs);
    assert.ok(componentDefinition.schema.stabilizationMaxChecks);
    assert.ok(componentDefinition.schema.stabilizationStablePasses);
});

test('chart pedestal runtime exposes manual debug controls under the generic runtime API', () => {
    const { runtime, sandbox } = loadRuntimeSandbox();

    assert.ok(runtime);
    assert.equal(typeof runtime.getChartStatus, 'function');
    assert.equal(runtime.isDebugEnabled(), false);
    runtime.enableDebug();
    assert.equal(runtime.isDebugEnabled(), true);
    runtime.disableDebug();
    assert.equal(runtime.isDebugEnabled(), false);
    runtime.setDebug(true);
    assert.equal(runtime.isDebugEnabled(), true);
    assert.equal(sandbox.CodeXRBoatsPedestalRuntime, runtime);
});

test('chart pedestal helper ignores auxiliary bounds metadata and keeps content helpers available', () => {
    const { runtime } = loadRuntimeSandbox();
    const helpers = runtime.__testing;

    assert.equal(helpers.matchesIgnoredBoundsMeta({ tagName: 'a-text' }), true);
    assert.equal(helpers.matchesIgnoredBoundsMeta({ className: 'chart-legend panel' }), true);
    assert.equal(helpers.matchesIgnoredBoundsMeta({ nodeName: 'axis-tick-label' }), true);
    assert.equal(helpers.matchesIgnoredBoundsMeta({ attributeNames: 'babia-label data-ready' }), true);
    assert.equal(helpers.matchesIgnoredContainmentBoundsMeta({ nodeName: 'axis-tick-line' }), false);
    assert.equal(helpers.matchesIgnoredContainmentBoundsMeta({ className: 'chart-legend panel' }), true);
    assert.equal(helpers.matchesIgnoredBoundsMeta({ id: 'chart-body', className: 'mesh' }), false);
    assert.match(runtimeSource, /function buildContentBounds\(three, object3D\)/);
    assert.match(runtimeSource, /function buildContainmentBounds\(three, object3D\)/);
    assert.match(runtimeSource, /function buildRenderableBounds\(three, object3D\)/);
    assert.match(runtimeSource, /function shouldUseContentBounds\(contentBounds, fullBounds\)/);
    assert.match(runtimeSource, /function inspectInvalidAxisState\(chartEl\)/);
    assert.match(runtimeSource, /resizeTrace\('invalid-axis-length-detected'/);
    assert.match(runtimeSource, /this\.lastNormalizationIssue = null;/);
    assert.match(runtimeSource, /this\.lastSuccessfulNormalizeAt = 0;/);
    assert.doesNotMatch(runtimeSource, /applyAuxiliaryVisualCompensation: function \(\)/);
    assert.doesNotMatch(runtimeSource, /codexrAuxiliaryCompensation/);
});

test('chart pedestal helper computes universal planar fit and height band targets', () => {
    const { runtime } = loadRuntimeSandbox();
    const helpers = runtime.__testing;

    assert.equal(helpers.computePlanarFitFactor({ x: 10, z: 5 }, 5, 5), 0.5);

    const ratioTargets = helpers.resolveHeightBandTargets({
        targetHeight: 2,
        heightBandMinRatio: 0.4,
        heightBandMaxRatio: 0.7,
    });
    assert.equal(ratioTargets.minHeight, 0.8);
    assert.equal(ratioTargets.maxHeight, 1.4);
    assert.equal(ratioTargets.minRatio, 0.4);
    assert.equal(ratioTargets.maxRatio, 0.7);

    const legacyTargets = helpers.resolveHeightBandTargets({
        targetHeight: 2,
        buildingHeightMinTarget: 0.5,
        buildingHeightMaxTarget: 1.25,
    });
    assert.equal(legacyTargets.minHeight, 0.5);
    assert.equal(legacyTargets.maxHeight, 1.25);
    assert.equal(legacyTargets.minRatio, 0.25);
    assert.equal(legacyTargets.maxRatio, 0.625);
});

test('chart pedestal helper clamps height band scale and builds stable measurement signatures', () => {
    const { runtime } = loadRuntimeSandbox();
    const helpers = runtime.__testing;

    const upscale = helpers.computeHeightBandScale(0.4, 1, { minHeight: 0.8, maxHeight: 1.5 }, 0.01, 4);
    assert.equal(upscale.changed, true);
    assert.equal(upscale.targetY, 2);

    const downscale = helpers.computeHeightBandScale(2, 1, { minHeight: 0.8, maxHeight: 1.5 }, 0.01, 4);
    assert.equal(downscale.changed, true);
    assert.equal(downscale.targetY, 0.75);

    const signature = helpers.buildMeasurementSignature(
        {
            primary: { size: { x: 1, y: 2, z: 3 } },
            containment: { size: { x: 3.5, y: 4.5, z: 5.5 } },
            full: { size: { x: 4, y: 5, z: 6 } },
            peakHeight: 1.25,
        },
        {
            scale: { x: 0.5, y: 0.75, z: 1.25 },
            position: { x: 7, y: 8, z: 9 },
        },
    );

    assert.equal(signature, '1|2|3|3.5|4.5|5.5|4|5|6|1.25|0.5|0.75|1.25|7|8|9');
});

test('chart pedestal helper computes planar band scaling from content range and containment limits', () => {
    const { runtime } = loadRuntimeSandbox();
    const helpers = runtime.__testing;

    const upscale = helpers.computePlanarBandScale(
        {
            size: { x: 0.8, y: 1, z: 0.8 },
            center: { x: 0, y: 0, z: 0 },
            bounds: { min: { x: -0.4, y: 0, z: -0.4 }, max: { x: 0.4, y: 1, z: 0.4 } },
        },
        {
            size: { x: 1, y: 1.2, z: 1 },
            center: { x: 0, y: 0, z: 0 },
            bounds: { min: { x: -0.5, y: 0, z: -0.5 }, max: { x: 0.5, y: 1.2, z: 0.5 } },
        },
        {
            targetWidth: 5,
            targetDepth: 5,
            minPlanarOccupancyRatio: 0.62,
            maxPlanarOccupancyRatio: 0.84,
            pedestalTopPadding: 0.9,
            tableEdgeMargin: 0.18,
        },
    );

    assert.equal(upscale.reason, 'upscale-minimum');
    assert.equal(upscale.compromised, false);
    assert.equal(upscale.factor, 3.875);

    const downscale = helpers.computePlanarBandScale(
        {
            size: { x: 5.5, y: 1, z: 5 },
            center: { x: 0, y: 0, z: 0 },
            bounds: { min: { x: -2.75, y: 0, z: -2.5 }, max: { x: 2.75, y: 1, z: 2.5 } },
        },
        {
            size: { x: 5.8, y: 1.2, z: 5.4 },
            center: { x: 0, y: 0, z: 0 },
            bounds: { min: { x: -2.9, y: 0, z: -2.7 }, max: { x: 2.9, y: 1.2, z: 2.7 } },
        },
        {
            targetWidth: 5,
            targetDepth: 5,
            minPlanarOccupancyRatio: 0.62,
            maxPlanarOccupancyRatio: 0.84,
            pedestalTopPadding: 0.9,
            tableEdgeMargin: 0.18,
        },
    );

    assert.equal(downscale.reason, 'downscale-range');
    assert.equal(downscale.compromised, false);
    assert.ok(Math.abs(downscale.factor - 0.7636363636363637) < 1e-12);
});

test('chart pedestal helper computes containment clamp and content peak height', () => {
    const { runtime } = loadRuntimeSandbox();
    const helpers = runtime.__testing;

    const containmentLimit = helpers.computeContainmentPlanarLimit(
        {
            size: { x: 5.8, y: 1.2, z: 5.4 },
            center: { x: 0, y: 0, z: 0 },
            bounds: { min: { x: -2.9, y: 0, z: -2.7 }, max: { x: 2.9, y: 1.2, z: 2.7 } },
        },
        {
            targetWidth: 5,
            targetDepth: 5,
            pedestalTopPadding: 0.9,
            tableEdgeMargin: 0.18,
        },
    );

    assert.ok(Math.abs(containmentLimit.factor - 0.9551724137931035) < 1e-12);
    assert.ok(Math.abs(containmentLimit.containmentWidthLimit - 5.54) < 1e-12);
    assert.ok(Math.abs(containmentLimit.containmentDepthLimit - 5.54) < 1e-12);

    const peakHeight = helpers.computePeakHeight(
        {
            size: { x: 1, y: 2, z: 1 },
            center: { x: 0, y: 2, z: 0 },
            bounds: { min: { x: -0.5, y: 1.03, z: -0.5 }, max: { x: 0.5, y: 2.43, z: 0.5 } },
        },
        {
            anchorY: 1,
            revealOffsetY: 0.03,
        },
    );

    assert.ok(Math.abs(peakHeight - 1.4) < 1e-12);
});

test('chart pedestal helper computes anchor placement as a delta from measured world bounds', () => {
    const { runtime } = loadRuntimeSandbox();
    const helpers = runtime.__testing;

    const offset = helpers.computeAnchorOffset(
        {
            primary: {
                center: { x: 4, y: 2, z: -11 },
                size: { x: 3, y: 1, z: 2 },
                bounds: { min: { x: 2.5, y: 1.5, z: -12 }, max: { x: 5.5, y: 2.5, z: -10 } },
            },
            full: {
                center: { x: 4.2, y: 2.2, z: -10.4 },
                size: { x: 4, y: 2, z: 3 },
                bounds: { min: { x: 2.2, y: 0.9, z: -11.9 }, max: { x: 6.2, y: 2.9, z: -8.9 } },
            },
        },
        {
            anchorX: 0,
            anchorY: 1,
            anchorZ: -18,
            revealOffsetY: 0.03,
        },
    );

    assert.equal(offset.deltaX, -4);
    assert.equal(offset.deltaY, 0.13);
    assert.equal(offset.deltaZ, -7);
});

test('chart pedestal helper detects non-finite axis values from Babia-driven descendants', () => {
    const { runtime } = loadRuntimeSandbox();
    const helpers = runtime.__testing;

    const issues = helpers.collectNonFiniteValueIssues({ maxValue: '-Infinity', nested: { safe: 1 } }, 'axis', [], 0);
    assert.equal(Array.isArray(issues), true);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].path, 'axis.maxValue');
    assert.equal(issues[0].value, '-Infinity');

    const fakeChart = {
        querySelectorAll(selector) {
            if (selector !== '[babia-axis-x]') {
                return [];
            }
            return [{
                id: 'x-axis',
                getAttribute(name) {
                    if (name === 'babia-axis-x') {
                        return { maxValue: '-Infinity', length: 5 };
                    }
                    return null;
                },
                components: {},
            }];
        },
    };

    const issue = helpers.inspectInvalidAxisState(fakeChart);
    assert.equal(issue.reason, 'invalid-axis-length');
    assert.equal(issue.attribute, 'babia-axis-x');
    assert.equal(issue.elementId, 'x-axis');
});

test('chart pedestal runtime tracks normalization generations for retry cancellation', () => {
    assert.match(runtimeSource, /this\.normalizationGeneration = 0;/);
    assert.match(runtimeSource, /this\.lastStableTransform = null;/);
    assert.match(runtimeSource, /bumpNormalizationGeneration: function \(\)/);
    assert.match(runtimeSource, /isCurrentGeneration: function \(generation\)/);
    assert.match(runtimeSource, /if \(!this\.isCurrentGeneration\(generation\)\) \{/);
    assert.match(runtimeSource, /var previousTransform = cloneTransform\(el\.object3D\) \|\| this\.lastStableTransform;/);
    assert.match(runtimeSource, /var initialPlanarBand = computePlanarBandScale\(initialMeasurements\.primary, initialMeasurements\.containment, this\.data\);/);
    assert.match(runtimeSource, /el\.object3D\.scale\.set\(nextPlanarScale, el\.object3D\.scale\.y, nextPlanarScale\);/);
    assert.match(runtimeSource, /restoreTransform\(el\.object3D, previousTransform\);/);
});
