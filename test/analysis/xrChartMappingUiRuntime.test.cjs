const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..', '..');
const { readAssembledRuntime } = require(path.join(projectRoot, 'test', 'helpers', 'runtimeAssembly.cjs'));
const runtimeSource = readAssembledRuntime('xr-chart-mapping-ui', 'xrChartMappingUiRuntime.js');

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
    vm.runInNewContext(runtimeSource, sandbox, { filename: 'xrChartMappingUiRuntime.js' });
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
    vm.runInNewContext(runtimeSource, sandbox, { filename: 'xrChartMappingUiRuntime.js' });
    return { runtime: sandbox.module.exports, document };
}

function createChartEntityForSwitchTest(initialAttributes = {}) {
    const chart = createFakeElement('a-entity', () => {});
    const nativeSetAttribute = chart.setAttribute.bind(chart);
    const nativeGetAttribute = chart.getAttribute.bind(chart);
    chart.attributeWrites = [];
    chart.setAttribute = function setAttribute(name, value) {
        this.attributeWrites.push({ name, value });
        nativeSetAttribute(name, value);
    };
    chart.getRawAttribute = function getRawAttribute(name) {
        return nativeGetAttribute(name);
    };
    chart.getAttribute = function getAttribute(name) {
        const value = nativeGetAttribute(name);
        if (!name.startsWith('babia-') || typeof value !== 'string') {
            return value;
        }
        return Object.fromEntries(
            value.split(/;\s*/).filter(Boolean).map((entry) => {
                const separator = entry.indexOf(':');
                const key = separator === -1 ? entry.trim() : entry.slice(0, separator).trim();
                const raw = separator === -1 ? '' : entry.slice(separator + 1).trim();
                if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(raw)) {
                    return [key, Number(raw)];
                }
                if (raw === 'true' || raw === 'false') {
                    return [key, raw === 'true'];
                }
                return [key, raw];
            }),
        );
    };
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
    // Live components count as well as DOM attributes: an entity built at
    // runtime (the movie chart) has no DOM attribute, so chart resolution fell
    // through to the parked NORMAL chart and switches landed on the wrong one.
    assert.match(runtimeSource, /function hasEntityComponent\(entity, componentName\)/);
    assert.match(runtimeSource, /entity\.components && entity\.components\[componentName\]/);
    assert.match(runtimeSource, /hasEntityComponent\(entity, 'codexr-chart-containment'\)/);
    assert.match(runtimeSource, /return false;\s*\}\s*return !!\(componentName && \(hasEntityAttribute\(entity, componentName\) \|\| hasEntityComponent\(entity, componentName\)\)\);/);
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
    // The ladder stops once every chart reports a settled, valid fit instead of
    // re-measuring a stable scene for 18 seconds.
    assert.match(runtimeSource, /if \(chain\.cancelled\) \{\s*return;\s*\}/);
    assert.match(runtimeSource, /if \(settled\) \{\s*chain\.cancelled = true;/);
});

test('a chart type switch is validated and reverted when the new chart is invalid', () => {
    // The per-dimension pending-mapping flow never covered a chart TYPE switch:
    // an invalid chart stayed on screen under a "Chart changed to X" message.
    assert.match(runtimeSource, /function scheduleChartSwitchValidation\(config, chartId, previousChartId\)/);
    assert.match(runtimeSource, /scheduleChartSwitchValidation\(config, chartId, previousChartId\)/);
    assert.match(runtimeSource, /if \(!result \|\| result\.state !== 'invalid'\) \{\s*return;\s*\}/);
    assert.match(runtimeSource, /CodeXR restored the previous chart\./);
});

test('switching chart type unsubscribes the previous chart from its data producer', () => {
    // BabiaXR 1.3.4 declares no `remove()` on any chart component, so removing
    // one leaves its NotiBuffer callback registered: the next data push makes
    // the DELETED chart paint itself again over the new one. CodeXR
    // unsubscribes on the library's behalf, using its own API.
    assert.match(runtimeSource, /function releaseChartComponentSubscription\(chartEntity, componentName\)/);
    assert.match(runtimeSource, /buffer\.unregister\(component\.notiBufferId\)/);
    assert.match(runtimeSource, /component\.prodComponent = null/);
    assert.match(runtimeSource, /releaseChartComponentSubscription\(chartEntity, componentName\);\s*chartEntity\.removeAttribute\(componentName\);/);
    // Exposed so the movie and the comparison can release a chart they drop.
    assert.match(runtimeSource, /releaseChartEntity: releaseChartEntity/);
    // Second line of defence: children no live component claims are residue.
    assert.match(runtimeSource, /function sweepOrphanChartChildren\(chartEntity\)/);
    assert.match(runtimeSource, /\['chartEl', 'titleEl', 'legendEl'\]/);
    assert.match(runtimeSource, /scheduleOrphanChartSweep\(chartEntity\);/);

    // Functional: a component holding a producer handle is unsubscribed and its
    // handles cleared, so a later push cannot reach it.
    const runtime = loadRuntime();
    const unregistered = [];
    const chart = createChartEntityForSwitchTest({});
    chart.components = {
        'babia-bars': {
            prodComponent: { notiBuffer: { unregister(id) { unregistered.push(id); } } },
            notiBufferId: 7,
        },
    };
    runtime.releaseChartEntity(chart);
    assert.deepEqual([...unregistered], [7]);
    assert.equal(chart.components['babia-bars'].prodComponent, null);
    assert.equal(chart.components['babia-bars'].notiBufferId, undefined);
});

test('an incomplete published default is completed from the chart dimensions', () => {
    const runtime = loadRuntime();
    // Exactly the shape a scene generated before the contract fix produces:
    // barsmap declares x_axis/z_axis/height but the published defaults dropped
    // z_axis (no text field survived the strict pool). That missing axis is
    // what reached Babia and surfaced as "invalid axis".
    const config = {
        chartId: 'bars',
        dimensionsByChart: {
            barsmap: [
                { id: 'x_axis', currentField: 'fileName', fields: ['fileName', 'language'] },
                { id: 'z_axis', currentField: 'language', fields: ['language', 'fileName'] },
                { id: 'height', currentField: 'totalLines', fields: ['totalLines'] },
            ],
        },
        defaultMappingsByChart: {
            barsmap: { x_axis: 'fileName', height: 'totalLines' },
        },
    };

    const mapping = runtime.__testing.getDefaultMappingForChart(config, 'barsmap');
    // Spread into a host array: values built inside the vm context are not
    // reference-equal to host ones under deepStrictEqual.
    assert.deepEqual([...Object.keys(mapping)].sort(), ['height', 'x_axis', 'z_axis']);
    assert.equal(mapping.z_axis, 'language');
    // Published values win over the dimension's own current field.
    assert.equal(mapping.x_axis, 'fileName');

    // config.dimensions describes the APPLIED chart only: asking for another
    // chart must not hand back its axes.
    const withLooseDimensions = Object.assign({}, config, {
        dimensions: [{ id: 'key', currentField: 'fileName', fields: ['fileName'] }],
    });
    assert.equal(runtime.__testing.getDimensionsForChart(withLooseDimensions, 'pie').length, 0);
    assert.equal(runtime.__testing.getDimensionsForChart(withLooseDimensions, 'bars').length, 1);
});

test('a chart mapping always covers every dimension the chart declares', () => {
    // Partial mappings reached Babia as a missing axis — the "invalid axis"
    // failure. Defaults are completed, and stale axes from the previous chart
    // are dropped, in the single funnel every snapshot goes through.
    assert.match(runtimeSource, /function reconcileMappingForChart\(mapping, fallbackMapping, dimensions\)/);
    assert.match(runtimeSource, /var selected = reconcileMappingForChart\(snapshot\.selectedByDimension/);
    assert.match(runtimeSource, /getDimensionsForChart\(config, chartId\)\.forEach\(function \(dimension\) \{[\s\S]{0,400}published\[dimension\.id\] = field;/);
    // config.dimensions belongs to the applied chart only (selectChart rewrites
    // it), so it must not answer for a different chart.
    assert.match(runtimeSource, /if \(!chartId \|\| chartId === appliedChartId\)/);
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
    // Switching to the mapping profile already on screen is a no-op: otherwise
    // applyMappingRuntimeState → renderRows clears and rebuilds every panel
    // row, which is the visible controller flash when a mode entry applies its
    // state more than once.
    assert.match(runtimeSource, /getMappingProfileKey\(nextContextId, getActiveChartId\(config\)\) === state\.appliedMappingProfileKey/);
    assert.match(runtimeSource, /state\.appliedMappingProfileKey = getMappingProfileKey\(/);
    // One re-fit request per change, on the next frame. The extra 300 ms
    // "settled" pass was a second retry mechanism competing with the
    // containment component's own, and its only visible effect was a late
    // re-fit after the scene was already correct.
    assert.doesNotMatch(runtimeSource, /-settled/);
    assert.doesNotMatch(runtimeSource, /delayedRenormalizeTimer/);
    // applyMappingSnapshot already asks for the re-fit when it applies a
    // mapping; applyMappingRuntimeState must not ask a second time for the
    // same change (selectChart still asks — a chart swap is a real change).
    assert.match(runtimeSource, /renderRows\(config\);\s*\/\/ No re-fit request here/);
    // Panel title resolved from one place (generic-then-overwritten flickered).
    assert.match(runtimeSource, /function getMappingPanelTitle\(\)/);
    assert.doesNotMatch(runtimeSource, /setAttribute\('value', 'CodeXR Field Mapping'\)/);
    // Zombie modeMemory API removed (no callers existed).
    assert.doesNotMatch(runtimeSource, /getModeMemory|saveModeMemory/);
    assert.match(runtimeSource, /controllerView: state\.activeControllerView/);
});

test('boats runtime base comes from the injected chart-base config, with a faithful fallback', () => {
    // With no document at all the runtime must fall back to the canonical
    // values it mirrors from the generator.
    const fallbackRuntime = loadRuntime();
    const fallbackData = fallbackRuntime.buildRuntimeChartData('boats', {}, { area: 'functionCount' });
    assert.equal(typeof fallbackRuntime.buildRuntimeChartData, 'function');
    assert.equal(
        fallbackData.legend_text,
        '{name}\n{fheight} (height): {height}\n{farea} (area): {area}\n{fcolor} (color): {color}',
    );
    assert.equal(fallbackData.extra, 1);
    assert.equal(fallbackData.separation, 0.5);
    assert.equal(fallbackData.legend_lookat, '[camera]');
    assert.deepEqual(plain(fallbackRuntime.getChartBaseConfig().treeFields), {
        directory: 'filePath',
        file: 'treePath',
    });

    // The generator-injected JSON always wins over the fallback.
    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        module: { exports: {} },
        exports: {},
        setTimeout() { return 1; },
        clearTimeout() {},
        document: {
            getElementById(id) {
                if (id !== 'codexr-chart-base-config') {
                    return null;
                }
                return {
                    textContent: JSON.stringify({
                        boats: { legend_text: '{name} only', extra: 2 },
                        treeFields: { directory: 'filePath', file: 'treePath' },
                    }),
                };
            },
        },
    };
    sandbox.globalThis = sandbox;
    vm.runInNewContext(runtimeSource, sandbox, { filename: 'xrChartMappingUiRuntime.js' });
    const injectedRuntime = sandbox.module.exports;
    const injectedData = injectedRuntime.buildRuntimeChartData('boats', {}, { area: 'functionCount' });
    assert.equal(injectedData.legend_text, '{name} only');
    assert.equal(injectedData.extra, 2);
    // Keys the injected config does not override keep the canonical value.
    assert.equal(injectedData.separation, 0.5);

    // Drift guard: the runtime fallback must spell out the SAME construction
    // the generator publishes (chartPresentation.BOATS_BASE_COMPONENT_ATTRIBUTES).
    const chartPresentation = fs.readFileSync(
        path.join(projectRoot, 'src', 'babia_templates', 'charts', 'chartPresentation.ts'),
        'utf8',
    );
    for (const fragment of [
        'height_building_legend: -0.5',
        'legend_scale: 0.25',
        "legend_lookat: '[camera]'",
        'extra: 1',
        'separation: 0.5',
        'zone_elevation: 0.01',
        'height_quarter_legend_box: 0.01',
        'height_quarter_legend_title: 2.5',
    ]) {
        assert.ok(chartPresentation.includes(fragment), `chartPresentation must declare ${fragment}`);
        assert.ok(runtimeSource.includes(fragment), `runtime fallback must mirror ${fragment}`);
    }
});

test('runtime presentation fallback mirrors the generator profiles field by field', () => {
    // The compiled generator profile is the single source; the runtime carries
    // a fallback mirror for scenes generated before the config existed. Any
    // drift between the two is a bug.
    const { CHART_PRESENTATION_PROFILES } = require(path.join(
        projectRoot, 'out', 'babia_templates', 'charts', 'chartPresentation.js',
    ));
    const runtime = loadRuntime();
    for (const [chartId, profile] of Object.entries(CHART_PRESENTATION_PROFILES)) {
        const mirrored = plain(runtime.getChartPresentation(chartId));
        assert.deepEqual(
            mirrored,
            JSON.parse(JSON.stringify(profile)),
            `runtime presentation fallback for ${chartId} must equal the generator profile`,
        );
    }
});

test('shared declarative factories emit the same complete A-Frame contract used by Single', () => {
    const { runtime } = loadRuntimeWithFakeDom();
    const containmentProfile = {
        position: { x: 0, y: 1, z: -18 },
        containment: {
            enabled: true,
            targetWidth: 5.614,
            targetHeight: 1.8,
            targetDepth: 3.218,
        },
    };
    const tree = runtime.buildDeclarativeTreeEntity({
        entityId: 'codexrProjectEvolutionTree',
        sourceId: 'codexrProjectEvolutionData',
        field: 'filePath',
    });
    const chart = runtime.buildDeclarativeChartEntity({
        entityId: 'codexrProjectEvolutionChart',
        chartId: 'boats',
        sourceId: 'codexrProjectEvolutionTree',
        mapping: {
            area: 'functionCount',
            height: 'totalLines',
            color: 'cyclomaticComplexityNumber',
        },
        title: 'Project Evolution',
        containmentProfile,
    });

    assert.equal(
        tree.getAttribute('babia-treebuilder'),
        'field: filePath;\nsplit_by: /;\nfrom: codexrProjectEvolutionData',
    );
    const boats = chart.getAttribute('babia-boats');
    assert.equal(typeof boats, 'string');
    for (const fragment of [
        'from: codexrProjectEvolutionTree',
        'title: Project Evolution',
        'area: functionCount',
        'height: totalLines',
        'color: cyclomaticComplexityNumber',
        'legend: true',
        'axis_name: true',
        'separation: 0.5',
    ]) {
        assert.match(boats, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
    assert.equal(chart.getAttribute('position'), '0 1 -18');
    assert.equal(chart.getAttribute('rotation'), '0 0 0');
    assert.equal(chart.getAttribute('scale'), '0.01 0.05 0.01');
    assert.equal(chart.getAttribute('codexr-boats-layout-stability'), 'enabled: true');
    assert.match(chart.getAttribute('codexr-chart-containment'), /enabled: true/);
    assert.match(chart.getAttribute('codexr-chart-containment'), /targetWidth: 5\.614/);
    assert.notEqual(chart.getAttribute('babia-boats'), '');
    assert.notEqual(chart.getAttribute('codexr-chart-containment'), '');
});

test('mapping UI exposes live chart switching with chart-specific defaults', () => {
    const runtime = loadRuntime();
    const chartData = runtime.buildRuntimeChartData('boats', { from: 'data', palette: 'ubuntu' }, {
        area: 'functionCount',
        height: 'totalLines',
        color: 'language',
    });
    const barsData = runtime.buildRuntimeChartData('bars', { from: 'codexrComparisonLeft' }, {
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
    assert.match(runtimeSource, /function selectChart\(chartId, options\)/);
    assert.match(runtimeSource, /state\.mappingControlsLocked && !\(options && options\.forceWhenLocked === true\)/);
    assert.match(runtimeSource, /state\.activeMappingContextId === 'project-evolution'/);
    assert.match(runtimeSource, /var applyToEntities = requestedEntityApply && !delegatedEntityApply/);
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
    assert.equal(chart.getAttribute('codexr-boats-layout-stability'), undefined);
    assert.equal(chart.getAttribute('codexr-chart-containment'), 'preset: table');
});

test('mapping UI installs the Boats layer contract and removes it on chart change', () => {
    const runtime = loadRuntime();
    const chart = createChartEntityForSwitchTest({
        'codexr-chart-containment': 'preset: table',
        'babia-bars': {
            from: 'data',
            x_axis: 'fileName',
            height: 'totalLines',
        },
    });

    assert.equal(runtime.__testing.applyChartTypeToEntity(chart, 'boats', {
        area: 'functionCount',
        height: 'totalLines',
        color: 'cyclomaticComplexityNumber',
    }), true);
    assert.equal(chart.getAttribute('codexr-boats-layout-stability'), 'enabled: true');
    assert.match(chart.getRawAttribute('babia-boats'), /zone_elevation: 0\.01/);
    assert.notEqual(chart.getRawAttribute('babia-boats'), '');
    const scaleWrite = chart.attributeWrites.findIndex((entry) => (
        entry.name === 'scale' && entry.value === '0.01 0.05 0.01'
    ));
    const boatsWrite = chart.attributeWrites.findIndex((entry) => entry.name === 'babia-boats');
    assert.ok(scaleWrite >= 0 && boatsWrite > scaleWrite, 'Boats must be installed after its initial scale');

    assert.equal(runtime.__testing.applyChartTypeToEntity(chart, 'bars', {
        x_axis: 'fileName',
        height: 'totalLines',
    }), true);
    assert.equal(chart.getAttribute('codexr-boats-layout-stability'), undefined);
});

test('mapping UI chart switch stands pie and donut upright and resets flat charts', () => {
    // Pie slices and doughnut toruses lie flat by construction; Babia's own
    // demos stand them with rotation 90 0 0. The switch applies the profile
    // rotation in BOTH directions: circular charts stand up, and a chart
    // switched away from them returns to 0 0 0.
    const runtime = loadRuntime();
    const donutChart = createChartEntityForSwitchTest({
        'codexr-chart-containment': 'preset: table',
        'babia-bars': {
            from: 'data',
            x_axis: 'fileName',
            height: 'totalLines',
        },
        rotation: '0 0 0',
    });
    const barsChart = createChartEntityForSwitchTest({
        'codexr-chart-containment': 'preset: table',
        'babia-pie': {
            from: 'data',
            key: 'fileName',
            size: 'totalLines',
        },
        rotation: '90 0 0',
    });

    assert.equal(runtime.__testing.applyChartTypeToEntity(donutChart, 'donut', {
        key: 'language',
        size: 'totalLines',
    }), true);
    assert.equal(runtime.__testing.applyChartTypeToEntity(barsChart, 'bars', {
        x_axis: 'fileName',
        height: 'totalLines',
    }), true);

    assert.equal(donutChart.getAttribute('rotation'), '90 0 0');
    assert.equal(donutChart.getAttribute('babia-bars'), undefined);
    assert.equal(donutChart.getAttribute('babia-doughnut').key, 'language');
    // Base attributes travel with the switch for every chart, not just boats.
    assert.equal(donutChart.getAttribute('babia-doughnut').titlePosition, '2.5 0 -3');
    assert.equal(barsChart.getAttribute('rotation'), '0 0 0');
    assert.equal(barsChart.getAttribute('babia-pie'), undefined);
    assert.equal(barsChart.getAttribute('babia-bars').x_axis, 'fileName');
});

test('applying a mapping converts an entity still wearing the previous chart', () => {
    // The selector can move without touching the entity — every mode change
    // does `selectChart(id, { applyToEntities: false })` so a mode can own its
    // own chart. Re-activating the normal analysis then re-applies the mapping,
    // and stamping the new component on top used to leave the entity half
    // converted: both babia components alive, the PREVIOUS chart's rotation
    // still on it (a boats arriving after a pie stayed rotated 90°) and a stale
    // chart-id marker, which also mis-routes the table's fit strategy.
    const runtime = loadRuntime();
    const chart = createChartEntityForSwitchTest({
        'codexr-chart-containment': 'preset: table',
        'babia-pie': { from: 'data', key: 'fileName', size: 'functionCount' },
        'data-codexr-active-chart-id': 'pie',
        rotation: '90 0 0',
    });

    runtime.__testing.setActiveChartIdForTests('boats');
    runtime.__testing.applyMappingToCharts([chart], 'babia-boats', {
        area: 'functionCount',
        height: 'totalLines',
        color: 'cyclomaticComplexityNumber',
    });

    assert.equal(chart.getAttribute('rotation'), '0 0 0', 'boats is not left standing on its side');
    assert.equal(chart.getAttribute('babia-pie'), undefined, 'the previous chart component is gone');
    assert.equal(chart.getAttribute('data-codexr-active-chart-id'), 'boats');
    assert.equal(chart.getAttribute('babia-boats').area, 'functionCount');
    // Reconciling means a full build, so the chart's base attributes come too.
    assert.equal(chart.getAttribute('babia-boats').extra, 1);

    // An entity already wearing the active chart keeps the cheap path: the
    // mapping is merged into the live component, nothing is rebuilt.
    const previousComponent = chart.getAttribute('babia-boats');
    runtime.__testing.applyMappingToCharts([chart], 'babia-boats', { height: 'codeLines' });
    assert.equal(chart.getAttribute('babia-boats').height, 'codeLines');
    assert.equal(chart.getAttribute('babia-boats').area, previousComponent.area);
});

test('bubbles chart switch always carries its normalization caps', () => {
    // babia-bubbles declares heightMax/radiusMax WITHOUT schema defaults:
    // losing them on a live switch rendered bubbles at raw metric scale
    // (a 12k-line file became a 12k-unit column).
    const runtime = loadRuntime();
    const chart = createChartEntityForSwitchTest({
        'codexr-chart-containment': 'preset: table',
        'babia-bars': { from: 'data', x_axis: 'fileName', height: 'totalLines' },
    });
    assert.equal(runtime.__testing.applyChartTypeToEntity(chart, 'bubbles', {
        x_axis: 'fileName',
        z_axis: 'cyclomaticComplexityNumber',
        height: 'totalLines',
        radius: 'functionCount',
    }), true);
    const bubbles = chart.getAttribute('babia-bubbles');
    assert.equal(bubbles.heightMax, 5);
    assert.equal(bubbles.radiusMax, 1.5);
});

test('orphan sweep never deletes a chart whose live component claims no root (boats)', () => {
    // babia-boats appends its figures DIRECTLY to the entity and exposes no
    // chartEl/titleEl/legendEl: the sweep cannot tell its children from
    // residue, and sweeping deleted the freshly built boats — the table
    // stayed empty until the next data push rebuilt it.
    const runtime = loadRuntime();
    const chart = createChartEntityForSwitchTest({ 'codexr-chart-containment': 'preset: table' });
    chart.components = { 'babia-boats': { /* no chartEl/titleEl/legendEl */ } };
    const figure = createFakeElement('a-entity', () => {});
    chart.appendChild(figure);

    assert.equal(runtime.__testing.sweepOrphanChartChildren(chart), 0);
    assert.equal(chart.children.length, 1);

    // With a root-claiming component (bars-style), unclaimed children are
    // still swept — the ghost-chart defence stays in force.
    const claimedRoot = createFakeElement('a-entity', () => {});
    const orphan = createFakeElement('a-entity', () => {});
    const barsChart = createChartEntityForSwitchTest({ 'codexr-chart-containment': 'preset: table' });
    barsChart.components = { 'babia-bars': { chartEl: claimedRoot } };
    barsChart.appendChild(claimedRoot);
    barsChart.appendChild(orphan);

    assert.equal(runtime.__testing.sweepOrphanChartChildren(barsChart), 1);
    assert.equal(barsChart.children.length, 1);
    assert.equal(barsChart.children[0], claimedRoot);
});

test('chart data slice ranks, filters and de-duplicates rows for budgeted charts', () => {
    const runtime = loadRuntime();
    const compute = runtime.__testing.computeChartDataSlice;
    const rows = [];
    for (let i = 0; i < 40; i += 1) {
        rows.push({ fileName: `file-${i}.js`, totalLines: 10 + i, functionCount: 1 + (i % 7) });
    }
    // Zero radius breaks babia-cylsmap (Math.max over `o != ''`-filtered radii
    // yields -Infinity axis lengths) — the numeric-positive rule filters it.
    rows.push({ fileName: 'zero-radius.js', totalLines: 9999, functionCount: 0 });
    // Duplicate labels collapse onto one babia element: only the highest
    // ranked duplicate may survive.
    rows.push({ fileName: 'file-39.js', totalLines: 5000, functionCount: 3 });

    const mapping = { x_axis: 'fileName', height: 'totalLines', radius: 'functionCount' };
    const slice = compute('cyls', rows, mapping);

    assert.equal(slice.length, 20, 'cyls row budget is 20');
    assert.equal(slice.some((row) => row.fileName === 'zero-radius.js'), false, 'zero radius rows are dropped');
    const top = slice[0];
    assert.equal(top.fileName, 'file-39.js');
    assert.equal(top.totalLines, 5000, 'the highest-ranked duplicate wins');
    const names = slice.map((row) => row.fileName);
    assert.equal(new Set(names).size, names.length, 'labels are unique after the slice');
    for (let i = 1; i < slice.length; i += 1) {
        assert.ok(slice[i - 1].totalLines >= slice[i].totalLines, 'slice is ordered by the height field, descending');
    }

    // Boats has no budget: the slice machinery leaves the dataset alone.
    assert.equal(compute('boats', rows, mapping).length, rows.length);
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

// The fake document only indexes ids handed to createElement, and the runtime
// stamps the id afterwards — so header buttons are found by walking the scene.
function findEntityById(document, id) {
    const seen = new Set();
    const queue = [document.querySelector('#scene')].filter(Boolean);
    while (queue.length) {
        const node = queue.shift();
        if (!node || seen.has(node)) { continue; }
        seen.add(node);
        if (node.getAttribute && node.getAttribute('id') === id) { return node; }
        (node.children || []).forEach((child) => queue.push(child));
    }
    return null;
}

test('a header button carries a word, sizes its text and can mean something', () => {
    // The analysis selector used to be a 0.34 square with the letter 'V' — at
    // the panel's 0.2 world scale that is a ~7 cm plate holding a ~5 mm glyph
    // that says nothing about where it leads.
    const { runtime, document } = loadRuntimeWithFakeDom();

    runtime.registerPanelView({
        id: 'visualization-mode',
        title: 'Visualization mode',
        buttonLabel: 'Analyses',
        buttonWidth: 0.9,
        buttonColor: '#0e7490',
        content: document.createElement('a-entity'),
        headerButton: true,
    });
    const button = findEntityById(document, 'codexrMappingUiView-visualization-mode');

    assert.ok(button, 'the header button keeps its id — the mode harness clicks it');
    assert.equal(button.getAttribute('width'), 0.9);
    assert.equal(button.getAttribute('text').value, 'Analyses', 'the label is not truncated to one letter');
    // Text scales with the plate instead of the inherited width: 1.
    assert.equal(button.getAttribute('text').width, 0.9 * 1.9);
    assert.equal(button.getAttribute('material').color, '#0e7490');

    // A declared colour outranks the open/closed default, and can be changed
    // while the scene runs: that is how the button follows the active analysis.
    runtime.showPanelView('visualization-mode');
    assert.equal(button.getAttribute('material').color, '#0e7490', 'the declared colour survives opening the view');
    assert.equal(runtime.setPanelViewButtonColor('visualization-mode', '#7c3aed'), true);
    assert.equal(button.getAttribute('material').color, '#7c3aed');
    assert.equal(runtime.setPanelViewButtonColor('not-a-view', '#000000'), false);

    // Without a declared colour the button still reports whether its view is
    // open, so any future header button keeps the old behaviour.
    const { runtime: plainRuntime, document: plainDocument } = loadRuntimeWithFakeDom();
    plainRuntime.registerPanelView({
        id: 'plain-view',
        title: 'Plain view',
        content: plainDocument.createElement('a-entity'),
        headerButton: true,
    });
    const plainButton = findEntityById(plainDocument, 'codexrMappingUiView-plain-view');
    assert.equal(plainButton.getAttribute('width'), 0.34, 'the square plate stays the default');
    assert.equal(plainButton.getAttribute('text').value, 'Plain view', 'the title is the fallback label');
    assert.equal(plainButton.getAttribute('material').color, '#0e7490');
    plainRuntime.showPanelView('plain-view');
    assert.equal(plainButton.getAttribute('material').color, '#be123c');
});

test('header buttons are laid out by width, clear of the toggle and the title', () => {
    // The old layout stepped by a fixed 0.42 pitch, which only works while
    // every button is the same 0.34 square.
    const { runtime, document } = loadRuntimeWithFakeDom();
    runtime.registerPanelView({
        id: 'visualization-mode',
        title: 'Visualization mode',
        buttonLabel: 'Analyses',
        buttonWidth: 0.9,
        content: document.createElement('a-entity'),
        headerButton: true,
    });
    runtime.registerPanelView({
        id: 'second-view',
        title: 'Second',
        content: document.createElement('a-entity'),
        headerButton: true,
    });

    const readX = (id) => Number(String(findEntityById(document, id).getAttribute('position')).split(' ')[0]);
    const wide = readX('codexrMappingUiView-visualization-mode');
    const square = readX('codexrMappingUiView-second-view');
    const toggleLeft = 3.1 - 0.15 - 0.17;

    // Right edge of the wide button sits one gap left of the +/- toggle.
    assert.ok(Math.abs((wide + 0.45) - (toggleLeft - 0.08)) < 0.0001);
    // The square one follows it, still one gap apart, and neither reaches the
    // title backdrop (which ends at x = 1.35).
    assert.ok(Math.abs((square + 0.17) - (wide - 0.45 - 0.08)) < 0.0001);
    assert.ok((square - 0.17) > 1.35, 'header buttons never overlap the panel title');
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
