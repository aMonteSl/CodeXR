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
    'analysis-table',
    'analysisTableRuntime.js',
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
        runtime: sandbox.CodeXRAnalysisTableRuntime,
        componentDefinition: registered['codexr-chart-containment'],
    };
}

test('analysis table runtime registers the rectangular bootstrap and steady-state schema', () => {
    const { componentDefinition } = loadRuntimeSandbox();

    assert.ok(componentDefinition);
    assert.ok(componentDefinition.schema.bootstrapPlanarMaxRatio);
    assert.ok(componentDefinition.schema.minPlanarOccupancyRatio);
    assert.ok(componentDefinition.schema.maxPlanarOccupancyRatio);
    assert.ok(componentDefinition.schema.heightBandMinRatio);
    assert.ok(componentDefinition.schema.heightBandMaxRatio);
    assert.ok(componentDefinition.schema.tableEdgeMargin);
});

test('analysis table runtime exposes the scale policy API', () => {
    const { runtime } = loadRuntimeSandbox();

    assert.ok(runtime);
    assert.equal(typeof runtime.getChartStatus, 'function');
    assert.equal(typeof runtime.getScaleRange, 'function');
    assert.equal(typeof runtime.setScaleRange, 'function');
    assert.equal(typeof runtime.getScalePolicy, 'function');
    assert.equal(typeof runtime.setHeightBand, 'function');
});

test('chart containment helper ignores auxiliary content and containment metadata', () => {
    const { runtime } = loadRuntimeSandbox();
    const helpers = runtime.__testing;

    assert.equal(helpers.matchesIgnoredBoundsMeta({ tagName: 'a-text' }), true);
    assert.equal(helpers.matchesIgnoredBoundsMeta({ className: 'chart-legend panel' }), true);
    assert.equal(helpers.matchesIgnoredBoundsMeta({ nodeName: 'axis-tick-label' }), true);
    assert.equal(helpers.matchesIgnoredContainmentBoundsMeta({ nodeName: 'axis-tick-line' }), false);
    assert.equal(helpers.matchesIgnoredContainmentBoundsMeta({ className: 'chart-legend panel' }), true);
    assert.equal(helpers.matchesIgnoredBoundsMeta({ id: 'chart-body', className: 'mesh' }), false);
});

test('bootstrap planar fit only guarantees visibility and containment', () => {
    const { runtime } = loadRuntimeSandbox();
    const helpers = runtime.__testing;

    const bootstrap = helpers.computeBootstrapPlanarScale(
        {
            size: { x: 6.2, y: 1, z: 2.6 },
            center: { x: 0, y: 0, z: 0 },
            bounds: { min: { x: -3.1, y: 0, z: -1.3 }, max: { x: 3.1, y: 1, z: 1.3 } },
        },
        {
            size: { x: 6.4, y: 1.2, z: 2.8 },
            center: { x: 0, y: 0, z: 0 },
            bounds: { min: { x: -3.2, y: 0, z: -1.4 }, max: { x: 3.2, y: 1.2, z: 1.4 } },
        },
        {
            targetWidth: 5.614,
            targetDepth: 3.218,
            bootstrapPlanarMaxRatio: 0.84,
            tableTopPadding: 0.9,
            tableEdgeMargin: 0.18,
        },
    );

    assert.ok(bootstrap);
    assert.ok(bootstrap.xFactor < 1);
    assert.ok(bootstrap.zFactor <= 1);
    assert.equal(bootstrap.reason, 'bootstrap-containment');
});

test('steady planar fit adjusts X and Z independently for a rectangular table', () => {
    const { runtime } = loadRuntimeSandbox();
    const helpers = runtime.__testing;

    const planarBand = helpers.computePlanarBandScale(
        {
            size: { x: 3, y: 1, z: 4.6 },
            center: { x: 0, y: 0, z: 0 },
            bounds: { min: { x: -1.5, y: 0, z: -2.3 }, max: { x: 1.5, y: 1, z: 2.3 } },
        },
        {
            size: { x: 3.2, y: 1.2, z: 4.8 },
            center: { x: 0, y: 0, z: 0 },
            bounds: { min: { x: -1.6, y: 0, z: -2.4 }, max: { x: 1.6, y: 1.2, z: 2.4 } },
        },
        {
            targetWidth: 5.614,
            targetDepth: 3.218,
            minPlanarOccupancyRatio: 0.78,
            maxPlanarOccupancyRatio: 0.92,
            tableTopPadding: 0.9,
            tableEdgeMargin: 0.18,
        },
    );

    assert.ok(planarBand);
    assert.ok(planarBand.xFactor > 1);
    assert.ok(planarBand.zFactor < 1);
    assert.notEqual(planarBand.xFactor, planarBand.zFactor);
    assert.equal(planarBand.compromised, false);
});

test('height band scale remains independent from the planar scale policy', () => {
    const { runtime } = loadRuntimeSandbox();
    const helpers = runtime.__testing;

    const upscale = helpers.computeHeightBandScale(0.4, 1, { minHeight: 0.8, maxHeight: 1.5 }, 0.01, 4);
    const downscale = helpers.computeHeightBandScale(2, 1, { minHeight: 0.8, maxHeight: 1.5 }, 0.01, 4);

    assert.equal(upscale.changed, true);
    assert.equal(upscale.targetY, 2);
    assert.equal(downscale.changed, true);
    assert.equal(downscale.targetY, 0.75);
});

test('steady target helpers aim for the midpoint of each band instead of the edges', () => {
    const { runtime } = loadRuntimeSandbox();
    const helpers = runtime.__testing;

    const planarTarget = helpers.computePlanarAxisTargetScale(
        2.4,
        2.6,
        1,
        5,
        { min: 0.78, max: 0.92 },
        0.018,
    );
    const verticalTarget = helpers.computeHeightBandTargetScale(
        0.6,
        1,
        { minHeight: 0.8, maxHeight: 1.4 },
        0.01,
        4,
    );

    assert.ok(planarTarget);
    assert.ok(Math.abs(planarTarget.setpointRatio - 0.85) < 1e-12);
    assert.ok(planarTarget.targetScale > 1);
    assert.ok(verticalTarget);
    assert.equal(verticalTarget.setpointHeight, 1.1);
    assert.ok(verticalTarget.targetScale > 1);
});

test('pid helper advances scale progressively instead of jumping straight to the target', () => {
    const { runtime } = loadRuntimeSandbox();
    const helpers = runtime.__testing;
    const axisState = helpers.createPidAxisState();

    const step = helpers.stepPidAxis(
        axisState,
        1,
        2,
        1 / 60,
        helpers.PID_PROFILE.planar,
    );

    assert.equal(step.changed, true);
    assert.equal(step.stable, false);
    assert.ok(step.nextValue > 1);
    assert.ok(step.nextValue < 2);
});

test('runtime scale commands update planar and vertical policy independently', () => {
    const { runtime, sandbox } = loadRuntimeSandbox();

    const chartAttributes = {
        'codexr-chart-containment': {
            bootstrapPlanarMaxRatio: 0.84,
            minPlanarOccupancyRatio: 0.78,
            maxPlanarOccupancyRatio: 0.92,
            heightBandMinRatio: 0.38,
            heightBandMaxRatio: 0.72,
        },
    };

    const component = {
        data: chartAttributes['codexr-chart-containment'],
        getChartStatus() {
            return {
                ready: true,
                valid: true,
                reason: 'ok',
            };
        },
        renormalize() {},
    };

    const chartEl = {
        components: {
            'codexr-chart-containment': component,
        },
        getAttribute(name) {
            return chartAttributes[name] || null;
        },
        setAttribute(name, value) {
            chartAttributes[name] = value;
            component.data = value;
        },
    };

    sandbox.document = {
        querySelector(selector) {
            assert.equal(selector, '[codexr-chart-containment]');
            return chartEl;
        },
        querySelectorAll(selector) {
            assert.equal(selector, '[codexr-chart-containment]');
            return [chartEl];
        },
    };

    assert.deepEqual(JSON.parse(JSON.stringify(runtime.getScaleRange())), {
        charts: 1,
        min: 0.78,
        max: 0.92,
        planar: { min: 0.78, max: 0.92 },
    });

    assert.deepEqual(JSON.parse(JSON.stringify(runtime.getScalePolicy())), {
        charts: 1,
        bootstrap: { max: 0.84 },
        steady: { min: 0.78, max: 0.92 },
        vertical: { min: 0.38, max: 0.72 },
    });

    assert.deepEqual(JSON.parse(JSON.stringify(runtime.setScaleRange(0.8, 0.9))), {
        charts: 1,
        min: 0.8,
        max: 0.9,
        planar: { min: 0.8, max: 0.9 },
    });

    assert.deepEqual(JSON.parse(JSON.stringify(chartAttributes['codexr-chart-containment'])), {
        bootstrapPlanarMaxRatio: 0.84,
        minPlanarOccupancyRatio: 0.8,
        maxPlanarOccupancyRatio: 0.9,
        heightBandMinRatio: 0.38,
        heightBandMaxRatio: 0.72,
    });

    assert.deepEqual(JSON.parse(JSON.stringify(runtime.setHeightBand(0.4, 0.68))), {
        charts: 1,
        bootstrap: { max: 0.84 },
        steady: { min: 0.8, max: 0.9 },
        vertical: { min: 0.4, max: 0.68 },
    });

    assert.deepEqual(JSON.parse(JSON.stringify(chartAttributes['codexr-chart-containment'])), {
        bootstrapPlanarMaxRatio: 0.84,
        minPlanarOccupancyRatio: 0.8,
        maxPlanarOccupancyRatio: 0.9,
        heightBandMinRatio: 0.4,
        heightBandMaxRatio: 0.68,
    });

    assert.throws(
        () => runtime.setScaleRange(0.8, 1.1),
        /percentages below 1/,
    );
});

test('getChartStatus falls back to the first active chart when no selector is provided', () => {
    const { runtime, sandbox } = loadRuntimeSandbox();
    const chartEl = {
        components: {
            'codexr-chart-containment': {
                getChartStatus() {
                    return {
                        ready: true,
                        valid: true,
                        reason: 'ok',
                        details: { phase: 'steady-fit' },
                    };
                },
            },
        },
    };

    sandbox.document = {
        querySelector() {
            return null;
        },
        querySelectorAll(selector) {
            assert.equal(selector, '[codexr-chart-containment]');
            return [chartEl];
        },
    };

    assert.deepEqual(JSON.parse(JSON.stringify(runtime.getChartStatus())), {
        ready: true,
        valid: true,
        reason: 'ok',
        details: { phase: 'steady-fit' },
    });
});

test('getScaleRange keeps the steady planar range separate from the vertical band policy', () => {
    const { runtime, sandbox } = loadRuntimeSandbox();
    const chartEl = {
        components: {
            'codexr-chart-containment': {
                data: {
                    bootstrapPlanarMaxRatio: 0.84,
                    minPlanarOccupancyRatio: 0.78,
                    maxPlanarOccupancyRatio: 0.92,
                    heightBandMinRatio: 0.38,
                    heightBandMaxRatio: 0.72,
                },
            },
        },
    };

    sandbox.document = {
        querySelectorAll(selector) {
            assert.equal(selector, '[codexr-chart-containment]');
            return [chartEl];
        },
    };

    assert.deepEqual(JSON.parse(JSON.stringify(runtime.getScaleRange())), {
        charts: 1,
        min: 0.78,
        max: 0.92,
        planar: { min: 0.78, max: 0.92 },
    });
});

test('runtime source reflects the render-first phase controller and geometry-ready hooks', () => {
    assert.match(runtimeSource, /this\.renderPhase = 'waiting-geometry';/);
    assert.match(runtimeSource, /this\.renderPhase = 'bootstrap-visible';/);
    assert.match(runtimeSource, /this\.activateSteadyController\(\);/);
    assert.match(runtimeSource, /runSteadyControllerStep: function \(source, dtMs\)/);
    assert.match(runtimeSource, /stepPidAxis\(this\.pidController\.axes\.x/);
    assert.match(runtimeSource, /this\.el\.addEventListener\('child-attached', this\.onGeometryReadyBound\);/);
    assert.match(runtimeSource, /this\.el\.addEventListener\('object3dset', this\.onGeometryReadyBound\);/);
    assert.match(runtimeSource, /this\.renderPhase === 'steady-fit'/);
    assert.match(runtimeSource, /markWaitingGeometry: function \(reason, generation, details\)/);
    assert.doesNotMatch(runtimeSource, /heightBandMinRatio: min,\s*heightBandMaxRatio: max/);
    assert.match(runtimeSource, /setHeightBand = function \(min, max\)/);
});
