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
    assert.ok(componentDefinition.schema.tableTopSurfaceOffsetY);
    assert.ok(componentDefinition.schema.tabletopAnchorEpsilon);
    assert.ok(componentDefinition.schema.tabletopAnchorDeadbandY);
    assert.equal(componentDefinition.schema.transformTransitionMs.default, 650);
    assert.equal(componentDefinition.schema.hardHeightGuardEnabled.default, true);
    assert.equal(componentDefinition.schema.heightUnderflowCorrectionEnabled.default, true);
    assert.equal(componentDefinition.schema.planarUnderflowCorrectionEnabled.default, true);
});

test('analysis table runtime exposes the scale policy API', () => {
    const { runtime } = loadRuntimeSandbox();

    assert.ok(runtime);
    assert.equal(typeof runtime.getChartStatus, 'function');
    assert.equal(typeof runtime.getScaleRange, 'function');
    assert.equal(typeof runtime.setScaleRange, 'function');
    assert.equal(typeof runtime.getScalePolicy, 'function');
    assert.equal(typeof runtime.setHeightBand, 'function');
    assert.equal(typeof runtime.setMode, 'function');
    assert.equal(typeof runtime.getContainmentProfile, 'function');
    assert.equal(typeof runtime.applyContainmentProfile, 'function');
    assert.equal(typeof runtime.getActiveContainmentDiagnostics, 'function');
});

test('analysis table exposes reusable containment profiles by analysis mode', () => {
    const { runtime } = loadRuntimeSandbox();

    const defaultProfile = runtime.getContainmentProfile('default');
    const evolutionProfile = runtime.getContainmentProfile('project-evolution');
    const dependencyProfile = runtime.getContainmentProfile('dependency-graph');
    const historicalLeft = runtime.getContainmentProfile('historical-left');
    const historicalRight = runtime.getContainmentProfile('historical-right');

    assert.equal(defaultProfile.containment.targetWidth, 5.614);
    assert.equal(defaultProfile.containment.targetDepth, 3.218);
    assert.deepEqual(evolutionProfile.containment, defaultProfile.containment);
    assert.deepEqual(dependencyProfile.containment, defaultProfile.containment);
    assert.ok(historicalLeft.containment.targetWidth < defaultProfile.containment.targetWidth);
    assert.ok(historicalRight.containment.targetWidth < defaultProfile.containment.targetWidth);
    assert.ok(historicalLeft.position.x < 0);
    assert.ok(historicalRight.position.x > 0);
    assert.equal(historicalLeft.containment.heightBandMinRatio, 0.34);
    assert.equal(historicalRight.containment.heightBandMaxRatio, 0.68);
});

test('applyContainmentProfile updates chart placement and preserves unrelated containment fields', () => {
    const { runtime } = loadRuntimeSandbox();
    const attributes = {
        'codexr-chart-containment': {
            customDiagnosticFlag: true,
            minPlanarOccupancyRatio: 0.4,
        },
    };
    const chartEl = {
        getAttribute(name) {
            return attributes[name] || null;
        },
        setAttribute(name, value) {
            attributes[name] = value;
        },
    };

    const applied = runtime.applyContainmentProfile(chartEl, 'historical-right');

    assert.equal(applied.id, 'historical-right');
    assert.match(attributes.position, /^[0-9.]+ 1 -18$/);
    assert.equal(attributes['codexr-chart-containment'].customDiagnosticFlag, true);
    assert.equal(attributes['codexr-chart-containment'].minPlanarOccupancyRatio, 0.78);
    assert.equal(attributes['codexr-chart-containment'].targetWidth, applied.containment.targetWidth);
});

test('active containment diagnostics report missing charts and clear warnings in selection mode', () => {
    const { runtime, sandbox } = loadRuntimeSandbox();
    const warnings = [];
    const tableComponent = {
        data: { mode: 'single' },
        setContainmentWarning(diagnostic) {
            warnings.push(diagnostic);
            return true;
        },
    };
    const tableEl = {
        components: {
            'codexr-analysis-table': tableComponent,
        },
    };
    sandbox.document = {
        getElementById(id) {
            return id === 'codexrAnalysisTable'  tableEl : null;
        },
        querySelectorAll(selector) {
            assert.equal(selector, '[codexr-chart-containment]');
            return [];
        },
    };

    const missing = runtime.getActiveContainmentDiagnostics();
    assert.equal(missing.level, 'warning');
    assert.equal(missing.reason, 'chart-not-found');
    assert.equal(missing.message, 'No chart detected');
    assert.equal(warnings.at(-1).message, 'No chart detected');

    tableComponent.data.mode = 'selection';
    const neutral = runtime.getActiveContainmentDiagnostics();
    assert.equal(neutral.level, 'ok');
    assert.equal(neutral.reason, 'selection-mode');
    assert.equal(warnings.at(-1).level, 'ok');
});

test('active containment diagnostics recognize dependency graph visuals without chart containment', () => {
    const { runtime, sandbox } = loadRuntimeSandbox();
    const tableComponent = {
        data: { mode: 'dependency-graph' },
        setContainmentWarning() {
            return true;
        },
    };
    const tableEl = {
        components: {
            'codexr-analysis-table': tableComponent,
        },
    };
    const dependencyGraphEl = {
        getAttribute(name) {
            return name === 'visible'  true : null;
        },
        object3D: { visible: true },
    };
    sandbox.document = {
        getElementById(id) {
            return id === 'codexrAnalysisTable'  tableEl : null;
        },
        querySelectorAll(selector) {
            if (selector === '[codexr-chart-containment]') {
                return [];
            }
            if (selector.includes('codexrDependencyGraph')) {
                return [dependencyGraphEl];
            }
            return [];
        },
    };

    const diagnostic = runtime.getActiveContainmentDiagnostics();

    assert.equal(diagnostic.level, 'ok');
    assert.equal(diagnostic.reason, 'dependency-graph-visible');
    assert.equal(diagnostic.visualCount, 1);
});

test('analysis table uses declarative mode themes and exposes safe mode switching', () => {
    const { sandbox, runtime } = loadRuntimeSandbox();
    const applied = [];
    sandbox.document = {
        getElementById(id) {
            if (id !== 'codexrAnalysisTable') {
                return null;
            }
            return {
                setAttribute(component, property, value) {
                    applied.push({ component, property, value });
                },
            };
        },
    };

    assert.match(runtimeSource, /MODE_THEME_BY_ID = \{/);
    assert.match(runtimeSource, /selection: \{[\s\S]*top: 'color: #f8fafc/);
    assert.match(runtimeSource, /single: \{[\s\S]*top: 'color: #0e7490/);
    assert.match(runtimeSource, /'historical-compare': \{[\s\S]*top: 'color: #be123c/);
    assert.match(runtimeSource, /'project-evolution': \{[\s\S]*top: 'color: #f59e0b/);
    assert.match(runtimeSource, /var theme = MODE_THEME_BY_ID\[this\.data\.mode\] \|\| MODE_THEME_BY_ID\.single;/);

    assert.equal(runtime.setMode('project-evolution'), 'project-evolution');
    assert.equal(applied.at(-1).component, 'codexr-analysis-table');
    assert.equal(applied.at(-1).property, 'mode');
    assert.equal(applied.at(-1).value, 'project-evolution');

    assert.equal(runtime.setMode('unknown-mode'), 'single');
    assert.equal(applied.at(-1).value, 'single');
});

test('waitForChartsStable resolves dynamic chart targets on each polling pass', () => {
    assert.match(runtimeSource, /function resolveWaitTarget\(target, doc\)/);
    assert.match(runtimeSource, /if \(typeof target === 'function'\) \{/);
    assert.match(runtimeSource, /return resolveWaitTarget\(target\(\), doc\);/);
    assert.match(runtimeSource, /doc\.getElementById\(idCandidate\)/);
    assert.match(runtimeSource, /doc\.querySelector\(rawTarget\)/);
    assert.match(runtimeSource, /var chart = resolveWaitTarget\(target, doc\);/);
    assert.doesNotMatch(runtimeSource, /typeof target === 'string'\s*\\s*\(doc && doc\.getElementById/);
});

test('chart containment helper ignores auxiliary content and containment metadata', () => {
    const { runtime } = loadRuntimeSandbox();
    const helpers = runtime.__testing;

    assert.equal(helpers.matchesIgnoredBoundsMeta({ tagName: 'a-text' }), true);
    assert.equal(helpers.matchesIgnoredBoundsMeta({ className: 'chart-legend panel' }), true);
    assert.equal(helpers.matchesIgnoredBoundsMeta({ nodeName: 'axis-tick-label' }), true);
    assert.equal(helpers.matchesIgnoredContainmentBoundsMeta({ nodeName: 'axis-tick-line' }), false);
    assert.equal(helpers.matchesIgnoredContainmentBoundsMeta({ className: 'chart-legend panel' }), true);
    assert.equal(helpers.matchesIgnoredBoundsMeta({ className: 'codexr-boats-primary babiaxraycasterclass', attributeNames: 'title material geometry' }), false);
    assert.equal(helpers.matchesIgnoredContainmentBoundsMeta({ className: 'codexr-boats-primary babiaxraycasterclass', attributeNames: 'title material geometry' }), false);
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

test('planar underflow can be accepted while preserving overflow containment', () => {
    const { runtime } = loadRuntimeSandbox();
    const helpers = runtime.__testing;
    const range = { min: 0.78, max: 0.92 };

    const accepted = helpers.computePlanarAxisTargetScale(
        2,
        2,
        0.5,
        5,
        range,
        0.018,
        false,
    );
    const overflow = helpers.computePlanarAxisTargetScale(
        8,
        8,
        0.5,
        5,
        range,
        0.018,
        false,
    );
    const band = helpers.computePlanarBandScale(
        {
            size: { x: 2, y: 1, z: 2 },
            center: { x: 0, y: 0, z: 0 },
            bounds: { min: { x: -1, y: 0, z: -1 }, max: { x: 1, y: 1, z: 1 } },
        },
        {
            size: { x: 2, y: 1, z: 2 },
            center: { x: 0, y: 0, z: 0 },
            bounds: { min: { x: -1, y: 0, z: -1 }, max: { x: 1, y: 1, z: 1 } },
        },
        {
            targetWidth: 5.614,
            targetDepth: 3.218,
            minPlanarOccupancyRatio: 0.78,
            maxPlanarOccupancyRatio: 0.92,
            tableTopPadding: 0.9,
            tableEdgeMargin: 0.18,
            planarUnderflowCorrectionEnabled: false,
        },
    );

    assert.equal(accepted.withinBand, true);
    assert.equal(accepted.underflowing, true);
    assert.equal(accepted.underflowAllowed, true);
    assert.equal(accepted.targetScale, 0.5);
    assert.equal(accepted.reason, 'underflow-accepted');
    assert.equal(overflow.overflowing, true);
    assert.ok(overflow.targetScale < 0.5);
    assert.equal(band.xFactor, 1);
    assert.equal(band.x.reason, 'underflow-accepted');
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

test('height underflow can be accepted while preserving the hard max guard', () => {
    const { runtime } = loadRuntimeSandbox();
    const helpers = runtime.__testing;

    const accepted = helpers.computeHeightBandTargetScale(
        0.4,
        0.5,
        { minHeight: 0.8, maxHeight: 1.5 },
        0.01,
        4,
        false,
    );
    const unchanged = helpers.computeHeightBandScale(
        0.4,
        0.5,
        { minHeight: 0.8, maxHeight: 1.5 },
        0.01,
        4,
        false,
    );
    const overflow = helpers.computeHeightBandTargetScale(
        2,
        0.5,
        { minHeight: 0.8, maxHeight: 1.5 },
        0.01,
        4,
        false,
    );

    assert.equal(accepted.withinBand, true);
    assert.equal(accepted.underflowing, true);
    assert.equal(accepted.underflowAllowed, true);
    assert.equal(accepted.reason, 'underflow-accepted');
    assert.equal(accepted.targetScale, 0.5);
    assert.equal(unchanged.changed, false);
    assert.equal(overflow.overflowing, true);
    assert.ok(overflow.targetScale < 0.5);
});

test('hard height guard computes an immediate Y scale target for red band overflow', () => {
    const { runtime } = loadRuntimeSandbox();
    const helpers = runtime.__testing;

    const overflow = helpers.computeHardHeightGuardTarget(
        2.4,
        1,
        { minHeight: 0.684, maxHeight: 1.296 },
        0.01,
        12,
        true,
    );
    const disabled = helpers.computeHardHeightGuardTarget(
        2.4,
        1,
        { minHeight: 0.684, maxHeight: 1.296 },
        0.01,
        12,
        false,
    );

    assert.equal(overflow.overflowing, true);
    assert.equal(overflow.changed, true);
    assert.equal(Number(overflow.targetY.toFixed(3)), 0.54);
    assert.equal(Number(overflow.heightRatio.toFixed(3)), 1.852);
    assert.equal(disabled.overflowing, false);
    assert.equal(disabled.changed, false);
});

test('containment transition policy animates remapping but skips initial and hard guard jumps', () => {
    const { runtime } = loadRuntimeSandbox();
    const helpers = runtime.__testing;
    const from = {
        position: { x: 0, y: 1, z: -18 },
        scale: { x: 1, y: 1, z: 1 },
    };
    const to = {
        position: { x: 0.2, y: 1.1, z: -18 },
        scale: { x: 1.4, y: 0.8, z: 1.2 },
    };

    assert.equal(helpers.shouldAnimateContainmentTransform('mapping-ui-change', from, to, { transformTransitionMs: 650 }), true);
    assert.equal(helpers.shouldAnimateContainmentTransform('init', from, to, { transformTransitionMs: 650 }), false);
    assert.equal(helpers.shouldAnimateContainmentTransform('tick-hard-height-guard', from, to, { transformTransitionMs: 650 }), false);
    assert.equal(helpers.shouldAnimateContainmentTransform('mapping-ui-change', from, to, { transformTransitionMs: 0 }), false);
});

test('maintenance pass enforces the height band outside steady PID mode', () => {
    assert.match(runtimeSource, /var changedHeight = this\.enforceHeightBand\(source \|\| 'maintenance-height-band'\);/);
    assert.doesNotMatch(runtimeSource, /var changedHeight = false;/);
});

test('maintenance pass applies the hard height guard before smooth correction paths', () => {
    assert.match(runtimeSource, /applyHardHeightGuard: function \(measurements, source\)/);
    assert.match(runtimeSource, /hard-height-guard-applied/);
    assert.match(runtimeSource, /this\.applyHardHeightGuard\(guardMeasurements, \(source \|\| 'maintenance'\) \+ '-hard-height-guard'\)/);
    assert.match(runtimeSource, /this\.applyHardHeightGuard\(measurements, \(source \|\| 'steady-fit'\) \+ '-hard-height-guard'\)/);
    assert.match(runtimeSource, /this\.applyHardHeightGuard\(tickMeasurements, 'tick-hard-height-guard'\)/);
});

test('tabletop anchor uses primary geometry floor instead of full auxiliary bounds', () => {
    const { runtime } = loadRuntimeSandbox();
    const helpers = runtime.__testing;
    const data = {
        anchorX: 1,
        anchorY: 1,
        anchorZ: -18,
        tableTopSurfaceOffsetY: -0.08,
        tabletopAnchorEpsilon: 0.004,
    };
    const measurements = {
        primary: {
            size: { x: 2, y: 1, z: 2 },
            center: { x: 0, y: 1.42, z: -20 },
            bounds: { min: { x: -1, y: 0.924, z: -21 }, max: { x: 1, y: 1.924, z: -19 } },
        },
        full: {
            size: { x: 3, y: 2, z: 3 },
            center: { x: 0, y: 0.6, z: -20 },
            bounds: { min: { x: -1.5, y: -0.4, z: -21.5 }, max: { x: 1.5, y: 1.6, z: -18.5 } },
        },
    };

    const offset = helpers.computeAnchorOffset(measurements, data);
    const diagnostics = helpers.buildTabletopAnchorDiagnostics(measurements, data);

    assert.equal(helpers.getTableTopY(data), 0.924);
    assert.equal(Number(offset.deltaY.toFixed(6)), 0);
    assert.equal(Number(offset.deltaX.toFixed(6)), 1);
    assert.equal(Number(offset.deltaZ.toFixed(6)), 2);
    assert.deepEqual(JSON.parse(JSON.stringify(diagnostics)), {
        tableTopY: 0.924,
        primaryMinY: 0.924,
        deltaY: 0,
        epsilon: 0.004,
        deadbandY: 0.015,
        surfaceOffsetY: -0.08,
    });
});

test('tabletop anchor lifts geometry that penetrates below the physical table plane', () => {
    const { runtime } = loadRuntimeSandbox();
    const helpers = runtime.__testing;
    const data = {
        anchorX: 0,
        anchorY: 1,
        anchorZ: -18,
        tableTopSurfaceOffsetY: -0.08,
        tabletopAnchorEpsilon: 0.004,
    };
    const measurements = {
        primary: {
            size: { x: 2, y: 1, z: 2 },
            center: { x: 0, y: 0.6, z: -18 },
            bounds: { min: { x: -1, y: 0.6, z: -19 }, max: { x: 1, y: 1.6, z: -17 } },
        },
        full: {
            size: { x: 2, y: 1, z: 2 },
            center: { x: 0, y: 0.6, z: -18 },
            bounds: { min: { x: -1, y: 0.6, z: -19 }, max: { x: 1, y: 1.6, z: -17 } },
        },
    };

    const offset = helpers.computeAnchorOffset(measurements, data);
    assert.equal(Number(offset.deltaY.toFixed(6)), 0.324);
});

test('analysis table runtime exposes tabletop debug plane controls and waits through chart animation', () => {
    assert.match(runtimeSource, /showTabletopAnchorPlane = function \(visible\)/);
    assert.match(runtimeSource, /hideTabletopAnchorPlane = function \(\)/);
    assert.match(runtimeSource, /id', 'codexr-analysis-table-anchor-plane'/);
    assert.match(runtimeSource, /isChartAnimationActive\(this\.el\)/);
    assert.match(runtimeSource, /reason: animationActive/);
    assert.match(runtimeSource, /pendingRenormalizeReason/);
    assert.match(runtimeSource, /if \(isChartAnimationActive\(this\.el\)\) \{/);
    assert.match(runtimeSource, /this\.el\.addEventListener\('codexr-boats-rendered', this\.onChartRenderedBound\);/);
    assert.match(runtimeSource, /name === 'codexr-boats'/);
});

test('chart status exposes vertical guard and containment transition diagnostics', () => {
    assert.match(runtimeSource, /var transitionActive = !!\(this\.containmentTransition && this\.containmentTransition\.active\);/);
    assert.match(runtimeSource, /var heightOverflow = !!\(correctionState && correctionState\.heightOverflow\);/);
    assert.match(runtimeSource, /: heightOverflow[\s\S]*\ 'height-overflow'/);
    assert.match(runtimeSource, /transitionActive: transitionActive/);
    assert.match(runtimeSource, /heightGuardApplied:/);
    assert.match(runtimeSource, /heightRatio: correctionState \ toFixedNumber\(correctionState\.heightRatio\) : null/);
});

test('steady controller applies emergency containment before smooth PID adjustment', () => {
    assert.match(runtimeSource, /applyEmergencyContainment: function \(measurements, xTarget, yTarget, zTarget, source\)/);
    assert.match(runtimeSource, /xTarget\.overflowing \|\| xTarget\.underflowing/);
    assert.match(runtimeSource, /zTarget\.overflowing \|\| zTarget\.underflowing/);
    assert.match(runtimeSource, /var needsHeightGuard = !yTarget\.withinBand;/);
    assert.match(runtimeSource, /if \(this\.applyEmergencyContainment\(measurements, xTarget, yTarget, zTarget, source \|\| 'steady-fit'\)\) \{/);
    assert.match(runtimeSource, /debugLog\('emergency-containment-applied'/);
});

test('containment correction state detects minimum and maximum drift on all axes', () => {
    const { runtime } = loadRuntimeSandbox();
    const helpers = runtime.__testing;

    const small = helpers.buildContainmentCorrectionState(
        {
            primary: {
                size: { x: 1.2, y: 0.2, z: 0.8 },
                center: { x: 0, y: 0.1, z: 0 },
                bounds: { min: { x: -0.6, y: 0, z: -0.4 }, max: { x: 0.6, y: 0.2, z: 0.4 } },
            },
            containment: {
                size: { x: 1.2, y: 0.2, z: 0.8 },
                center: { x: 0, y: 0.1, z: 0 },
                bounds: { min: { x: -0.6, y: 0, z: -0.4 }, max: { x: 0.6, y: 0.2, z: 0.4 } },
            },
            full: {
                size: { x: 1.2, y: 0.2, z: 0.8 },
                center: { x: 0, y: 0.1, z: 0 },
                bounds: { min: { x: -0.6, y: 0, z: -0.4 }, max: { x: 0.6, y: 0.2, z: 0.4 } },
            },
            peakHeight: 0.25,
        },
        { scale: { x: 1, y: 1, z: 1 } },
        {
            targetWidth: 5.614,
            targetHeight: 1.8,
            targetDepth: 3.218,
            anchorY: 1,
            revealOffsetY: 0.03,
            minPlanarOccupancyRatio: 0.78,
            maxPlanarOccupancyRatio: 0.92,
            heightBandMinRatio: 0.38,
            heightBandMaxRatio: 0.72,
            tableTopPadding: 0.9,
            tableEdgeMargin: 0.18,
            containmentToleranceRatio: 0.018,
            yScaleMin: 0.01,
            yScaleMax: 4,
        },
    );

    assert.equal(small.needsCorrection, true);
    assert.equal(small.x.underflowing, true);
    assert.equal(small.y.underflowing, true);
    assert.equal(small.z.underflowing, true);
    assert.ok(small.x.targetScale > 1);
    assert.ok(small.y.targetScale > 1);
    assert.ok(small.z.targetScale > 1);
    assert.deepEqual(JSON.parse(JSON.stringify({
        x: small.axes.x.underflowing,
        y: small.axes.y.underflowing,
        z: small.axes.z.underflowing,
        needsCorrection: small.needsCorrection,
    })), {
        x: true,
        y: true,
        z: true,
        needsCorrection: true,
    });

    const large = helpers.buildContainmentCorrectionState(
        {
            primary: {
                size: { x: 8, y: 4, z: 5 },
                center: { x: 0, y: 2, z: 0 },
                bounds: { min: { x: -4, y: 0, z: -2.5 }, max: { x: 4, y: 4, z: 2.5 } },
            },
            containment: {
                size: { x: 8.2, y: 4.2, z: 5.2 },
                center: { x: 0, y: 2.1, z: 0 },
                bounds: { min: { x: -4.1, y: 0, z: -2.6 }, max: { x: 4.1, y: 4.2, z: 2.6 } },
            },
            full: {
                size: { x: 8.2, y: 4.2, z: 5.2 },
                center: { x: 0, y: 2.1, z: 0 },
                bounds: { min: { x: -4.1, y: 0, z: -2.6 }, max: { x: 4.1, y: 4.2, z: 2.6 } },
            },
            peakHeight: 4.2,
        },
        { scale: { x: 1, y: 1, z: 1 } },
        {
            targetWidth: 5.614,
            targetHeight: 1.8,
            targetDepth: 3.218,
            anchorY: 1,
            revealOffsetY: 0.03,
            minPlanarOccupancyRatio: 0.78,
            maxPlanarOccupancyRatio: 0.92,
            heightBandMinRatio: 0.38,
            heightBandMaxRatio: 0.72,
            tableTopPadding: 0.9,
            tableEdgeMargin: 0.18,
            containmentToleranceRatio: 0.018,
            yScaleMin: 0.01,
            yScaleMax: 4,
        },
    );

    assert.equal(large.needsCorrection, true);
    assert.equal(large.x.overflowing, true);
    assert.equal(large.y.overflowing, true);
    assert.equal(large.z.overflowing, true);
    assert.equal(large.heightOverflow, true);
    assert.ok(large.heightRatio > 1);
    assert.ok(large.hardHeightGuardTargetY < 1);
    assert.ok(large.x.targetScale < 1);
    assert.ok(large.y.targetScale < 1);
    assert.ok(large.z.targetScale < 1);
});

test('containment correction state keeps planar correction when height is temporarily unavailable', () => {
    const { runtime } = loadRuntimeSandbox();
    const helpers = runtime.__testing;

    const state = helpers.buildContainmentCorrectionState(
        {
            primary: {
                size: { x: 1.2, y: 0.2, z: 0.8 },
                center: { x: 0, y: 0.1, z: 0 },
                bounds: { min: { x: -0.6, y: 0, z: -0.4 }, max: { x: 0.6, y: 0.2, z: 0.4 } },
            },
            containment: {
                size: { x: 1.2, y: 0.2, z: 0.8 },
                center: { x: 0, y: 0.1, z: 0 },
                bounds: { min: { x: -0.6, y: 0, z: -0.4 }, max: { x: 0.6, y: 0.2, z: 0.4 } },
            },
            full: {
                size: { x: 1.2, y: 0.2, z: 0.8 },
                center: { x: 0, y: 0.1, z: 0 },
                bounds: { min: { x: -0.6, y: 0, z: -0.4 }, max: { x: 0.6, y: 0.2, z: 0.4 } },
            },
            peakHeight: null,
        },
        { scale: { x: 1, y: 1, z: 1 } },
        {
            targetWidth: 5.614,
            targetHeight: 1.8,
            targetDepth: 3.218,
            anchorY: 1,
            revealOffsetY: 0.03,
            minPlanarOccupancyRatio: 0.78,
            maxPlanarOccupancyRatio: 0.92,
            heightBandMinRatio: 0.38,
            heightBandMaxRatio: 0.72,
            tableTopPadding: 0.9,
            tableEdgeMargin: 0.18,
            containmentToleranceRatio: 0.018,
            yScaleMin: 0.01,
            yScaleMax: 4,
        },
    );

    assert.equal(state.needsCorrection, true);
    assert.equal(state.x.underflowing, true);
    assert.equal(state.y.withinBand, true);
    assert.equal(state.y.reason, 'height-unavailable');
    assert.equal(state.z.underflowing, true);
});

test('containment correction state treats compromised minimums as explicit non-correctable states', () => {
    const { runtime } = loadRuntimeSandbox();
    const helpers = runtime.__testing;

    const target = {
        withinBand: false,
        compromised: true,
        targetScale: 4,
    };

    assert.equal(helpers.targetNeedsCorrection(target, 1), false);

    const state = helpers.buildContainmentCorrectionState(
        {
            primary: {
                size: { x: 1, y: 0.05, z: 2.45 },
                center: { x: 0, y: 0.025, z: 0 },
                bounds: { min: { x: -0.5, y: 0, z: -1.225 }, max: { x: 0.5, y: 0.05, z: 1.225 } },
            },
            containment: {
                size: { x: 5, y: 0.05, z: 2.45 },
                center: { x: 0, y: 0.025, z: 0 },
                bounds: { min: { x: -2.5, y: 0, z: -1.225 }, max: { x: 2.5, y: 0.05, z: 1.225 } },
            },
            full: {
                size: { x: 5, y: 0.05, z: 2.45 },
                center: { x: 0, y: 0.025, z: 0 },
                bounds: { min: { x: -2.5, y: 0, z: -1.225 }, max: { x: 2.5, y: 0.05, z: 1.225 } },
            },
            peakHeight: 0.05,
        },
        { scale: { x: 1, y: 1, z: 1 } },
        {
            targetWidth: 5.614,
            targetHeight: 1.8,
            targetDepth: 3.218,
            anchorY: 1,
            revealOffsetY: 0.03,
            minPlanarOccupancyRatio: 0.78,
            maxPlanarOccupancyRatio: 0.92,
            heightBandMinRatio: 0.38,
            heightBandMaxRatio: 0.72,
            tableTopPadding: 0,
            tableEdgeMargin: 0.18,
            containmentToleranceRatio: 0.018,
            yScaleMin: 0.01,
            yScaleMax: 1.2,
        },
    );

    assert.equal(state.compromised, true);
    assert.equal(state.needsCorrection, false);
    assert.equal(state.x.compromised, true);
    assert.equal(state.y.compromised, true);
    assert.equal(state.axes.x.reason, 'toward-midpoint-up');
});

test('height overflow compromise prevents planar underflow from growing through the vertical band', () => {
    const { runtime } = loadRuntimeSandbox();
    const helpers = runtime.__testing;

    const constrained = helpers.constrainPlanarTargetForHeightCompromise(
        {
            ratio: 0.1,
            setpointRatio: 0.85,
            withinBand: false,
            underflowing: true,
            overflowing: false,
            compromised: false,
            targetScale: 8,
            reason: 'toward-midpoint-up',
        },
        1.5,
        {
            withinBand: false,
            underflowing: false,
            overflowing: true,
            compromised: true,
            setpointHeight: 0.99,
            targetScale: 0.01,
            reason: 'toward-midpoint-down',
        },
        6,
        1.296,
    );

    assert.equal(constrained.compromised, true);
    assert.equal(constrained.reason, 'height-overflow-compromise');
    assert.ok(constrained.targetScale < 1.5);
    assert.equal(helpers.targetNeedsCorrection(constrained, 1.5), false);
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
    assert.match(runtimeSource, /this\.el\.contains && this\.el\.contains\(event\.target\)/);
    assert.match(runtimeSource, /this\.renderPhase === 'steady-fit'/);
    assert.match(runtimeSource, /markWaitingGeometry: function \(reason, generation, details\)/);
    assert.match(runtimeSource, /scheduleSteadyControllerStep: function \(source\)/);
    assert.match(runtimeSource, /this\.steadyControllerTimer = setTimeout/);
    assert.match(runtimeSource, /toTransformNumber\(object3D\.scale\.x\)/);
    assert.match(runtimeSource, /constrainPlanarTargetForHeightCompromise/);
    assert.doesNotMatch(runtimeSource, /heightBandMinRatio: min,\s*heightBandMaxRatio: max/);
    assert.match(runtimeSource, /setHeightBand = function \(min, max\)/);
});

test('generated XR presets give the vertical controller enough headroom for tiny Babia geometry', () => {
    const templateCharts = fs.readFileSync(
        path.join(projectRoot, 'src', 'babia_templates', 'charts', 'templateCharts.ts'),
        'utf8',
    );
    const historicalRuntime = fs.readFileSync(
        path.join(projectRoot, 'templates', 'components', 'codexr', 'historical-comparison', 'historicalComparisonRuntime.js'),
        'utf8',
    );

    assert.match(runtimeSource, /yScaleMax: 12/);
    assert.match(templateCharts, /yScaleMax: 12;/);
    assert.match(historicalRuntime, /function getHistoricalContainmentProfile\(zone\)/);
    assert.match(historicalRuntime, /getContainmentProfile\\.\(profileId\)/);
    assert.match(historicalRuntime, /applyContainmentProfile\(clone, containmentProfile\)/);
    assert.doesNotMatch(historicalRuntime, /heightUnderflowCorrectionEnabled: false/);
    assert.doesNotMatch(historicalRuntime, /planarUnderflowCorrectionEnabled: false/);
});

test('manual XR containment harness is wired to the real table runtime and npm script', () => {
    const harness = fs.readFileSync(
        path.join(projectRoot, 'test', 'manual', 'xr-containment-harness.html'),
        'utf8',
    );
    const runner = fs.readFileSync(
        path.join(projectRoot, 'test', 'runners', 'run-xr-containment-harness.cjs'),
        'utf8',
    );
    const evolutionHarness = fs.readFileSync(
        path.join(projectRoot, 'test', 'manual', 'project-evolution-playback-harness.html'),
        'utf8',
    );
    const evolutionRunner = fs.readFileSync(
        path.join(projectRoot, 'test', 'runners', 'run-project-evolution-harness.cjs'),
        'utf8',
    );
    const manifest = fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8');

    assert.match(harness, /analysisTableRuntime\.js/);
    assert.match(harness, /CodeXRContainmentHarness/);
    assert.match(harness, /getContainmentProfile\(profileId\(\)\)/);
    assert.match(harness, /applyContainmentProfile\(target, profileId\(\)\)/);
    assert.match(harness, /getActiveContainmentDiagnostics\('#harnessChart'\)/);
    assert.match(runner, /Playwright is not installed; static harness validation passed/);
    assert.match(evolutionHarness, /CodeXRProjectEvolutionHarness/);
    assert.match(evolutionHarness, /project-evolution-apply-frame/);
    assert.match(evolutionRunner, /data1\.json/);
    assert.match(evolutionRunner, /frame-2\.png/);
    assert.match(manifest, /"test:xr-harness": "node test\/runners\/run-xr-containment-harness\.cjs"/);
    assert.match(manifest, /"test:project-evolution-harness": "node test\/runners\/run-project-evolution-harness\.cjs"/);
});
