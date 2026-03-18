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
    assert.ok(componentDefinition.schema.stabilizationCheckMs);
    assert.ok(componentDefinition.schema.stabilizationMaxChecks);
    assert.ok(componentDefinition.schema.stabilizationStablePasses);
});

test('chart pedestal runtime exposes manual debug controls under the generic runtime API', () => {
    const { runtime, sandbox } = loadRuntimeSandbox();

    assert.ok(runtime);
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
    assert.equal(helpers.matchesIgnoredBoundsMeta({ id: 'chart-body', className: 'mesh' }), false);
    assert.match(runtimeSource, /function buildContentBounds\(three, object3D\)/);
    assert.match(runtimeSource, /function shouldUseContentBounds\(contentBounds, fullBounds\)/);
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
            full: { size: { x: 4, y: 5, z: 6 } },
        },
        {
            scale: { x: 0.5, y: 0.75, z: 1.25 },
            position: { x: 7, y: 8, z: 9 },
        },
    );

    assert.equal(signature, '1|2|3|4|5|6|0.5|0.75|1.25|7|8|9');
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
