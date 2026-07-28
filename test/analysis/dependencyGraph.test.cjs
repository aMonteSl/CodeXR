const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..', '..');
const { readAssembledRuntime } = require(path.join(root, 'test', 'helpers', 'runtimeAssembly.cjs'));
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('dependency graph is a first-class analysis table mode', () => {
  const table = readAssembledRuntime('analysis-table', 'analysisTableRuntime.js');
  const models = read('src/code_analysis/historical/historicalComparisonModels.ts');
  assert.match(table, /dependency-graph/);
  assert.match(models, /'dependency-graph'/);
  assert.match(table, /#7c3aed/);
});

test('dependency runtime uses a worker and owns three layouts', () => {
  const runtime = readAssembledRuntime('dependency-graph', 'dependencyGraphRuntime.js');
  assert.match(runtime, /new root\.Worker/);
  assert.match(runtime, /force-3d/);
  assert.match(runtime, /hierarchical/);
  assert.match(runtime, /metric-space/);
  assert.match(runtime, /xMetric=m\.x/);
  assert.match(runtime, /zMetric=m\.z/);
  assert.match(runtime, /codexr-dependency-graph/);
  assert.match(runtime, /ensureWorker: function \(\)/);
  assert.match(runtime, /this\.ensureWorker\(\)\.postMessage/);
  assert.match(runtime, /line\.geometry\?\.dispose/);
  assert.match(runtime, /showTransientSelection/);
  assert.match(runtime, /togglePinnedSelection/);
  assert.match(runtime, /data-edge-id/);
  assert.match(runtime, /renderGraphWhenReady/);
  assert.match(runtime, /cycleButton/);
  assert.match(runtime, /RELATION_HELP/);
  assert.match(runtime, /drawAxes/);
  // Legends are laid out in a non-overlapping grid above the graph.
  assert.match(runtime, /graphTopY \+ LEGEND_SLOT\.originYOffset/);
  assert.match(runtime, /CodeXRCommonRuntime\.legendSlotPosition/);
  assert.doesNotMatch(runtime, /tooltipCameraPosition/);
  assert.match(runtime, /transitionDuration.*600/);
  assert.match(runtime, /beginTransition/);
  assert.match(runtime, /reconcileEdges/);
  assert.match(runtime, /prefers-reduced-motion/);
  assert.match(runtime, /requestAnimationFrame/);
  assert.match(runtime, /InstancedMesh/);
  assert.match(runtime, /ShaderMaterial/);
  assert.match(runtime, /DependencyVisualBudgetRuntime/);
  assert.match(runtime, /rebuildFocusEdges/);
  assert.match(runtime, /getDebugSnapshot/);
  assert.match(runtime, /colorWrite: false/);
  assert.match(runtime, /visible: false/);
  assert.match(runtime, /focusEdgeIds\.has/);
  assert.match(runtime, /external-summary/);
  assert.match(runtime, /intensity-combined/);
  assert.match(runtime, /Show external/);
  assert.match(runtime, /response\.generation !== this\.pendingGraph\.generation/);
  assert.doesNotMatch(runtime, /setGraph: function \(dataset, view\) \{\s*this\.clear/);
  assert.match(runtime, /data-codexr-help/);
  assert.match(runtime, /Imports: module dependencies/);
  assert.match(runtime, /Confidence/);
  assert.match(runtime, /Occurrences/);
  assert.match(runtime, /Open folder/);
  assert.match(runtime, /Go to parent/);
  assert.match(runtime, /Open file/);
  assert.match(runtime, /footerReserve: canNavigate \? \.3 : 0/);
  // The per-card action button sits at the card's own (dynamic) bottom edge.
  assert.match(runtime, /-\(card\.height \/ 2\) \+ \.17/);
  assert.match(runtime, /Project root/);
  assert.match(runtime, /Back to:/);
  assert.match(runtime, /Reset view/);
  assert.match(runtime, /disposeView/);
  assert.match(runtime, /clearRenderRetries/);
  assert.match(runtime, /viewGeneration/);
  assert.doesNotMatch(runtime, /'View: '\s*\+/);
  assert.doesNotMatch(runtime, /granularity/);
  assert.doesNotMatch(runtime, /slice\(0, 600\)/);
  assert.doesNotMatch(runtime, /slice\(0, 2000\)/);
  assert.doesNotMatch(runtime, /setObject3D\('edge-line'/);
  assert.doesNotMatch(runtime, /babia-(?:bars|boats|bubbles|pie|doughnut)/);
  assert.doesNotMatch(runtime, /Legacy/);
});

test('dependency edge styles use fixed occurrence buckets', () => {
  const source = readAssembledRuntime('dependency-graph', 'dependencyGraphRuntime.js');
  const context = {};
  vm.runInNewContext(source, context);
  const helpers = context.CodeXRDependencyGraphRuntime.__testing;

  assert.deepEqual([1, 2, 4, 8, 16].map(helpers.intensityBucket), [0, 1, 2, 3, 4]);
  assert.equal(helpers.edgeStyle(
    { kind: 'call', confidence: 'exact', occurrences: 16 },
    'intensity-combined',
  ).color, '#f97316');
  assert.ok(helpers.edgeStyle(
    { kind: 'import', confidence: 'exact', occurrences: 16 },
    'intensity-width',
  ).width > helpers.edgeStyle(
    { kind: 'import', confidence: 'exact', occurrences: 1 },
    'intensity-width',
  ).width);
  assert.notEqual(helpers.edgeStyle(
    { kind: 'call', confidence: 'exact', occurrences: 1 },
    'relation-type',
  ).color, helpers.edgeStyle(
    { kind: 'import', confidence: 'exact', occurrences: 1 },
    'relation-type',
  ).color);
});

test('hidden external dependencies become one directional summary portal', () => {
  const source = readAssembledRuntime('dependency-graph', 'dependencyGraphRuntime.js');
  const context = {};
  vm.runInNewContext(source, context);
  const helpers = context.CodeXRDependencyGraphRuntime.__testing;
  const dataset = helpers.buildExternalSummaryDataset({
    nodes: [
      { id: 'file:a', label: 'a.ts', external: false, metrics: {} },
      { id: 'external:react', label: 'react', external: true, metrics: {} },
      { id: 'external:vue', label: 'vue', external: true, metrics: {} },
    ],
    edges: [
      { id: 'e1', source: 'file:a', target: 'external:react', kind: 'import', confidence: 'exact', occurrences: 2 },
      { id: 'e2', source: 'external:vue', target: 'file:a', kind: 'call', confidence: 'ambiguous', occurrences: 3 },
    ],
  });

  const summary = dataset.nodes.find(node => node.syntheticExternal);
  assert.equal(summary.summary.packageCount, 2);
  assert.equal(summary.summary.relationCount, 5);
  assert.equal(dataset.nodes.filter(node => node.external).length, 1);
  assert.ok(dataset.edges.some(edge => edge.target === summary.id));
  assert.ok(dataset.edges.some(edge => edge.source === summary.id));
});

test('directory scope projection exposes direct files, child folders, and parent navigation', () => {
  const source = readAssembledRuntime('dependency-graph', 'dependencyGraphRuntime.js');
  const context = {};
  vm.runInNewContext(source, context);
  const helpers = context.CodeXRDependencyGraphRuntime.__testing;
  const dataset = {
    targetType: 'directory',
    nodes: [
      { id: 'root', kind: 'file', label: 'root.ts', relativePath: 'root.ts', external: false, metrics: {} },
      { id: 'src-a', kind: 'file', label: 'a.ts', relativePath: 'src/a.ts', external: false, metrics: {} },
      { id: 'tool', kind: 'file', label: 'tool.ts', relativePath: 'src/tools/tool.ts', external: false, metrics: {} },
    ],
    edges: [
      { id: 'e1', source: 'src-a', target: 'tool', kind: 'import', confidence: 'exact', occurrences: 2 },
      { id: 'e2', source: 'src-a', target: 'root', kind: 'call', confidence: 'ambiguous', occurrences: 1 },
    ],
  };
  const projected = helpers.projectDirectoryScope(dataset, 'src');
  assert.ok(projected.nodes.some(node => node.relativePath === 'src/a.ts'));
  assert.ok(projected.nodes.some(node => node.syntheticKind === 'directory' && node.navigationPath === 'src/tools'));
  assert.ok(projected.nodes.some(node => node.syntheticKind === 'parent' && node.navigationPath === ''));
  assert.equal(projected.edges.length, 2);
  assert.ok(projected.edges.every(edge => edge.source !== edge.target));
});

test('file scope projection keeps symbols and aggregates other project files', () => {
  const source = readAssembledRuntime('dependency-graph', 'dependencyGraphRuntime.js');
  const context = {};
  vm.runInNewContext(source, context);
  const helpers = context.CodeXRDependencyGraphRuntime.__testing;
  const projected = helpers.projectFileScope({
    targetType: 'file',
    targetRelativePath: 'src/a.ts',
    nodes: [
      { id: 'module', kind: 'symbol', symbolKind: 'module', label: 'a.ts', external: false, metrics: {} },
      { id: 'fn', kind: 'symbol', symbolKind: 'function', label: 'run', external: false, metrics: {} },
      { id: 'other', kind: 'file', label: 'b.ts', external: false, metrics: {} },
    ],
    edges: [
      { id: 'e1', source: 'module', target: 'fn', kind: 'contains', confidence: 'exact', occurrences: 1 },
      { id: 'e2', source: 'module', target: 'other', kind: 'import', confidence: 'exact', occurrences: 1 },
    ],
  });
  assert.ok(projected.nodes.some(node => node.symbolKind === 'function'));
  assert.ok(projected.nodes.some(node => node.syntheticKind === 'internal-files'));
  assert.ok(projected.edges.some(edge => edge.kind === 'contains'));
});

test('render budget runtime is packaged before dependency rendering', () => {
  const parser = read('src/code_analysis/engine/parsers/directoryXRParser.ts');
  const template = read('templates/xr/file/xr-visualization.html');
  const budget = readAssembledRuntime('render-budget', 'renderBudgetRuntime.js');
  assert.match(parser, /RENDER_BUDGET_RUNTIME_OUTPUT_NAME/);
  assert.ok(template.indexOf('codexrCommonRuntime.js') < template.indexOf('dependencyGraphRuntime.js'));
  assert.ok(template.indexOf('renderBudgetRuntime.js') < template.indexOf('dependencyGraphRuntime.js'));
  assert.ok(template.indexOf('dependencyVisualBudgetRuntime.js') < template.indexOf('dependencyGraphRuntime.js'));
  assert.ok(template.indexOf('analysisModeRuntime.js') < template.indexOf('historicalComparisonRuntime.js'));
  assert.ok(template.indexOf('dependencyGraphRuntime.js') < template.indexOf('codexrDebugRuntime.js'));
  assert.match(budget, /CodeXRRenderBudgetRuntime/);
  assert.match(budget, /averageFps/);
  assert.match(budget, /frameTimeP95/);
  assert.match(budget, /targetFps/);
  assert.match(budget, /prefers-reduced-motion/);
});

test('dependency visual budget classifies density and preserves fixed width ranges', () => {
  const source = readAssembledRuntime('dependency-visual-budget', 'dependencyVisualBudgetRuntime.js');
  const context = {};
  vm.runInNewContext(source, context);
  const runtime = context.CodeXRDependencyVisualBudgetRuntime;
  const helpers = runtime.__testing;

  assert.equal(helpers.calculateDensity({ nodeCount: 50, edgeCount: 80, maxDegree: 10 }).profile, 'sparse');
  assert.equal(helpers.calculateDensity({ nodeCount: 250, edgeCount: 500, maxDegree: 45 }).profile, 'balanced');
  assert.equal(helpers.calculateDensity({ nodeCount: 291, edgeCount: 2000, maxDegree: 459 }).profile, 'dense');
  assert.deepEqual(
    [helpers.widthsForProfile('sparse')[0], helpers.widthsForProfile('sparse')[4]],
    [.006, .024],
  );
  assert.deepEqual(
    [helpers.widthsForProfile('balanced')[0], helpers.widthsForProfile('balanced')[4]],
    [.004, .018],
  );
  assert.deepEqual(
    [helpers.widthsForProfile('dense')[0], helpers.widthsForProfile('dense')[4]],
    [.0025, .01],
  );
});

test('dependency detail override combines with performance conservatively', () => {
  const source = readAssembledRuntime('dependency-visual-budget', 'dependencyVisualBudgetRuntime.js');
  const context = {};
  vm.runInNewContext(source, context);
  const helpers = context.CodeXRDependencyVisualBudgetRuntime.__testing;

  assert.equal(helpers.effectiveProfile('dense', 'full', 'auto'), 'dense');
  assert.equal(helpers.effectiveProfile('dense', 'full', 'full'), 'balanced');
  assert.equal(helpers.effectiveProfile('sparse', 'static', 'full'), 'dense');
  assert.equal(helpers.effectiveProfile('sparse', 'full', 'focus'), 'dense');
  assert.ok(helpers.opacityFor('dense', 'exact', false) < helpers.opacityFor('sparse', 'exact', false));
  assert.ok(helpers.opacityFor('dense', 'exact', true) > helpers.opacityFor('dense', 'exact', false));
  assert.ok(helpers.opacityFor('dense', 'exact', false) > helpers.opacityFor('dense', 'probable', false));
  assert.equal(helpers.createSnapshot(
    { nodeCount: 50, edgeCount: 80, maxDegree: 10 },
    'full',
    'auto',
  ).flowLimit, 300);
  assert.equal(helpers.createSnapshot(
    { nodeCount: 250, edgeCount: 500, maxDegree: 45 },
    'full',
    'auto',
  ).flowLimit, 80);
  assert.equal(helpers.createSnapshot(
    { nodeCount: 291, edgeCount: 2000, maxDegree: 459 },
    'full',
    'auto',
  ).flowLimit, 40);
});

test('dependency graph keeps density control local and packages diagnostics', () => {
  const runtime = readAssembledRuntime('dependency-graph', 'dependencyGraphRuntime.js');
  const parser = read('src/code_analysis/engine/parsers/directoryXRParser.ts');
  assert.match(runtime, /Detail: /);
  assert.match(runtime, /setDetailOverride/);
  assert.match(runtime, /CodeXRCommonRuntime\?\.createTooltip/);
  assert.match(runtime, /CodeXRCommonRuntime\?\.updateTooltip/);
  assert.match(runtime, /CodeXRCommonRuntime\.updateTooltipConnector\(/);
  // Multiple legends can be pinned and are re-placed together without overlap.
  assert.match(runtime, /relayoutLegends/);
  assert.match(runtime, /pinnedSelections/);
  assert.match(runtime, /'data-codexr-interactive': 'true'/);
  assert.match(runtime, /connectorTarget/);
  assert.doesNotMatch(runtime, /detailOverride: state\.snapshot/);
  assert.match(parser, /DEPENDENCY_VISUAL_BUDGET_RUNTIME_OUTPUT_NAME/);
  assert.match(parser, /CODEXR_DEBUG_RUNTIME_OUTPUT_NAME/);
});

test('render budget degrades and recovers with hysteresis', () => {
  const source = readAssembledRuntime('render-budget', 'renderBudgetRuntime.js');
  const context = {};
  vm.runInNewContext(source, context);
  const runtime = context.CodeXRRenderBudgetRuntime;
  const slow = Array(180).fill(42);
  const healthy = Array(180).fill(16);

  runtime.__testing.reset({ quality: 'full' });
  runtime.__testing.evaluateSamples(slow);
  assert.equal(runtime.__testing.evaluateSamples(slow).quality, 'interactive');
  runtime.__testing.evaluateSamples(slow);
  assert.equal(runtime.__testing.evaluateSamples(slow).quality, 'static');

  for (let index = 0; index < 4; index += 1) {
    runtime.__testing.evaluateSamples(healthy);
  }
  assert.equal(runtime.getSnapshot().quality, 'static');
  assert.equal(runtime.__testing.evaluateSamples(healthy).quality, 'interactive');
});

test('render budget tolerates browsers that reject WebXR session inspection', () => {
  const source = readAssembledRuntime('render-budget', 'renderBudgetRuntime.js');
  const callbacks = [];
  const context = {
    document: {
      hidden: false,
      querySelector() {
        return {
          renderer: {
            xr: {
              getSession() {
                throw new TypeError('Permissions check failed');
              },
            },
          },
        };
      },
    },
    requestAnimationFrame(callback) {
      callbacks.push(callback);
      return callbacks.length;
    },
  };
  vm.runInNewContext(source, context);

  assert.doesNotThrow(() => {
    context.CodeXRRenderBudgetRuntime.__testing.evaluateSamples(Array(180).fill(16.7));
  });
  assert.equal(context.CodeXRRenderBudgetRuntime.getSnapshot().targetFps, 60);
});

test('dependency metric axes use readable shared scales', () => {
  const source = readAssembledRuntime('dependency-graph', 'dependencyGraphRuntime.js');
  const context = {};
  vm.runInNewContext(source, context);
  const helpers = context.CodeXRDependencyGraphRuntime.__testing;

  assert.deepEqual(
    Array.from(helpers.computeNiceScale(1000, 10).ticks),
    [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000],
  );
  const scales = helpers.buildMetricScales([
    { metrics: { totalLines: 1000, fanIn: 21, fanOut: 7 } },
    { metrics: { totalLines: 250, fanIn: 3, fanOut: 2 } },
  ], { x: 'totalLines', z: 'fanOut', height: 'fanIn' });
  assert.equal(scales.x.maximum, 1000);
  assert.equal(scales.x.step, 100);
  assert.equal(scales.z.maximum, 7);
  assert.equal(scales.y.maximum, 25);

  const details = helpers.nodeDetailModel({
    label: 'service.ts',
    kind: 'file',
    relativePath: 'src/service.ts',
    language: 'TypeScript',
    metrics: { fanIn: 4, fanOut: 6, degree: 10, relationCount: 8, cycleSize: 2, totalLines: 1000 },
  });
  assert.equal(details.title, 'service.ts');
  assert.equal(details.subtitle, 'FILE · TypeScript · src/service.ts');
  // Legacy summary fields are kept for backward compatibility.
  assert.match(details.primary, /Fan-in 4/);
  assert.match(details.secondary, /Lines 1000/);
  // Richer content: a metric grid, a type-colour accent, and the Instability metric.
  assert.match(details.accentColor, /^#[0-9a-fA-F]{3,8}$/);
  assert.ok(Array.isArray(details.rows) && details.rows.length >= 7);
  const instability = details.rows.find(row => row.label === 'Instab.');
  assert.ok(instability, 'exposes an Instability row');
  assert.equal(instability.value, '60%');
  assert.ok(details.rows.some(row => row.label === 'Fan-in' && row.value === '4'));
  assert.ok(Object.keys(details).every(key => !String(details[key]).includes('\n')));
});

test('directory XR parser packages the dependency runtime', () => {
  const parser = read('src/code_analysis/engine/parsers/directoryXRParser.ts');
  const template = read('templates/xr/file/xr-visualization.html');
  assert.match(parser, /CODEXR_COMMON_RUNTIME_OUTPUT_NAME/);
  assert.match(parser, /readCodeXrCommonRuntimeContent/);
  assert.match(parser, /DEPENDENCY_GRAPH_RUNTIME_OUTPUT_NAME/);
  assert.match(template, /codexrCommonRuntime\.js/);
  assert.match(template, /dependencyGraphRuntime\.js/);
});

test('file XR parser packages the dependency runtime', () => {
  const parser = read('src/code_analysis/engine/parsers/fileXRParser.ts');
  assert.match(parser, /copyCodeXrCommonRuntimeToOutput/);
  assert.match(parser, /CODEXR_COMMON_RUNTIME_OUTPUT_NAME/);
  assert.match(parser, /copyDependencyGraphRuntimeToOutput/);
  assert.match(parser, /DEPENDENCY_GRAPH_RUNTIME_OUTPUT_NAME/);
  assert.match(parser, /copyAnalysisModeRuntimeToOutput/);
});

test('analysis mode coordinator deactivates the previous view before activating the next one', async () => {
  const source = readAssembledRuntime('analysis-mode', 'analysisModeRuntime.js');
  const context = {
    setTimeout,
    console,
  };
  vm.runInNewContext(source, context);
  const runtime = context.CodeXRAnalysisModeRuntime;
  const events = [];

  runtime.register('dependency-graph', {
    activate: () => events.push('dependency:activate'),
    deactivate: () => events.push('dependency:deactivate'),
  });
  runtime.register('historical-compare', {
    activate: () => events.push('history:activate'),
    deactivate: () => events.push('history:deactivate'),
  });

  await runtime.transitionTo('dependency-graph');
  await runtime.transitionTo('historical-compare');
  await runtime.transitionTo('single');

  assert.deepEqual(events, [
    'dependency:activate',
    'dependency:deactivate',
    'history:activate',
    'history:deactivate',
  ]);
  assert.equal(runtime.getState().mode, 'single');
});

test('analysis mode coordinator disposes an activation superseded while it is loading', async () => {
  const source = readAssembledRuntime('analysis-mode', 'analysisModeRuntime.js');
  const context = {
    setTimeout,
    console,
  };
  vm.runInNewContext(source, context);
  const runtime = context.CodeXRAnalysisModeRuntime;
  const events = [];
  let releaseDependency;

  runtime.register('dependency-graph', {
    activate: () => new Promise(resolve => {
      events.push('dependency:activate');
      releaseDependency = resolve;
    }),
    deactivate: () => events.push('dependency:deactivate'),
  });
  runtime.register('single', {
    activate: () => events.push('single:activate'),
  });
  events.length = 0;

  const dependencyTransition = runtime.transitionTo('dependency-graph');
  await new Promise(resolve => setTimeout(resolve, 0));
  const singleTransition = runtime.transitionTo('single');
  releaseDependency();

  assert.equal(await dependencyTransition, false);
  assert.equal(await singleTransition, true);
  assert.deepEqual(events, [
    'dependency:activate',
    'dependency:deactivate',
    'single:activate',
  ]);
  assert.equal(runtime.getState().mode, 'single');
});

test('normal analysis restores its cached chart immediately and refreshes its revision in place', async () => {
  const source = readAssembledRuntime('analysis-mode', 'analysisModeRuntime.js');
  const attributes = new Map([['visible', true]]);
  const chart = {
    setAttribute(name, value) { attributes.set(name, value); },
    getAttribute(name) { return attributes.get(name); },
  };
  let dataSource = { url: 'data.json' };
  const dataEntity = {
    getAttribute(name) {
      return name === 'babia-queryjson' ? dataSource : null;
    },
    setAttribute(name, value) {
      if (name === 'babia-queryjson') dataSource = value;
    },
  };
  const table = { setAttribute() {} };
  const config = {
    textContent: JSON.stringify({ chartEntityId: 'normalChart' }),
  };
  let sharedRuntime;
  let restoredMapping = null;
  let activeChartIds = null;
  const context = {
    setTimeout,
    clearTimeout,
    console,
    document: {
      getElementById(id) {
        if (id === 'codexr-tooling-config-xr-mapping-ui') return config;
        if (id === 'normalChart') return chart;
        if (id === 'codexrAnalysisTable') return table;
        return null;
      },
      querySelectorAll(selector) {
        return selector === '[babia-queryjson]' ? [dataEntity] : [];
      },
    },
    CodeXRCollaborationRuntime: {
      getClient() {
        return {
          registerEntityRuntime(runtime) { sharedRuntime = runtime; },
        };
      },
    },
    CodeXRMappingUiRuntime: {
      setChartEntityIds(ids) { activeChartIds = Array.from(ids); },
      getState() {
        return {
          selectedByDimension: { area: 'totalLines' },
          lastKnownGoodMapping: { area: 'totalLines' },
        };
      },
      restoreState(snapshot) { restoredMapping = snapshot; },
    },
    CodeXRAnalysisTableRuntime: {
      async waitForChartsStable() {
        return { state: 'stabilized', valid: true, stabilized: true };
      },
      renormalizeAll() {},
    },
  };
  vm.runInNewContext(source, context);

  sharedRuntime.applySharedState({
    entityKind: 'analysis-view',
    entityId: 'main',
    mode: 'single',
    status: 'updating',
    hasUsableSnapshot: true,
    sourceRevision: 2,
    modeRevision: { single: 0 },
  });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(attributes.get('visible'), true);

  sharedRuntime.applySharedState({
    entityKind: 'analysis-view',
    entityId: 'main',
    mode: 'single',
    status: 'ready',
    sourceRevision: 2,
    modeRevision: { single: 1 },
  });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(attributes.get('visible'), true);

  await new Promise(resolve => setTimeout(resolve, 520));
  assert.equal(attributes.get('visible'), true);
  assert.equal(context.CodeXRAnalysisModeRuntime.getState().mode, 'single');
  assert.match(dataSource.url, /codexrModeRevision=1/);
  assert.deepEqual(activeChartIds, ['normalChart']);
  assert.equal(restoredMapping.lastKnownGoodMapping.area, 'totalLines');
});

test('XR SSE signals normal analysis readiness after Babia stabilization', () => {
  const source = read('templates/xr/sse/live_sse_fileXR.js');
  assert.match(source, /CodeXRNormalAnalysisRefreshRuntime/);
  assert.match(source, /waitForChartsStable/);
  assert.match(source, /codexr-normal-analysis-refreshed/);
  assert.match(source, /dataRefresh-boats-settled/);
  assert.match(source, /analysis-updated-boats-settled/);
});

test('dependency server preserves cached datasets and no longer accepts granularity', () => {
  const server = read('src/servers/runtime/analysis/analysisMessageRouter.ts')
    + read('src/servers/runtime/analysis/dependencyGraphBridge.ts')
    + read('src/servers/runtime/analysis/analysisFeatureHost.ts')
    + read('src/servers/runtime/httpServer.ts');
  const service = read('src/code_analysis/dependencies/dependencyGraphService.ts');
  const models = read('src/code_analysis/dependencies/dependencyGraphModels.ts');
  assert.match(server, /hasCachedDataset/);
  assert.match(server, /Restoring dependency graph/);
  assert.match(server, /existingDependencyState\?\.layout/);
  assert.match(server, /existingDependencyState\?\.mapping/);
  assert.match(server, /existingDependencyState\?\.scope/);
  assert.match(server, /message\.type === 'analysis-mode-selection'/);
  assert.match(server, /message\.type === 'analysis-mode-activate'/);
  assert.match(server, /activateAnalysisViewMode\('dependency-graph', 'dependency\.settings'\)/);
  assert.doesNotMatch(server, /message\.type === 'dependency-graph-reset'/);
  assert.doesNotMatch(server, /allowedGranularity/);
  assert.doesNotMatch(models, /DependencyGraphGranularity/);
  assert.doesNotMatch(service, /void job\.finally/);
  assert.match(service, /void job\.then\(clearActiveJob, clearActiveJob\)/);
});

test('python dependency packages are pinned centrally', () => {
  const manifest = read('src/python_env/runtime/pythonPackageManifest.ts');
  assert.match(manifest, /lizard/);
  assert.match(manifest, /tree-sitter-language-pack/);
  assert.match(manifest, /version: '1\.8\.1'/);
});

test('dependency graph availability gate allows LivePanel directory/project analyses', () => {
  const service = read('src/code_analysis/dependencies/dependencyGraphService.ts');
  assert.match(service, /session\.analysisMode !== 'XR' && session\.analysisMode !== 'LivePanel'/);
});

test('LivePanel dependency graph summary REST endpoint is thin and reuses the existing service', () => {
  const server = read('src/servers/runtime/analysis/analysisMessageRouter.ts')
    + read('src/servers/runtime/analysis/dependencyGraphBridge.ts')
    + read('src/servers/runtime/analysis/analysisFeatureHost.ts')
    + read('src/servers/runtime/httpServer.ts');
  assert.match(server, /case '\/dependency-graph\/summary':/);
  assert.match(server, /public async handleDependencyGraphSummary\(/);
  assert.match(server, /this\.dependencyGraphService\.getAvailability\(\)/);
  assert.match(server, /scope\.kind !== 'directory'/);
  assert.match(server, /this\.dependencyGraphService\.isBusy\(\)/);
  assert.match(server, /await this\.dependencyGraphService\.analyze\(\)/);
});

test('LivePanel ties the dependency graph into the re-analysis chain as a background mode and pushes updates over SSE', () => {
  const server = read('src/servers/runtime/analysis/analysisMessageRouter.ts')
    + read('src/servers/runtime/analysis/dependencyGraphBridge.ts')
    + read('src/servers/runtime/analysis/analysisFeatureHost.ts')
    + read('src/servers/runtime/httpServer.ts');
  // Background refresh: recompute the dependency graph on every source change,
  // seed the initial dataset, and clean up on dispose.
  assert.match(server, /setBackgroundRefresh\(livePanelSessionId, 'dependency-graph', true\)/);
  assert.match(server, /forceRefreshMode\(livePanelSessionId, 'dependency-graph'\)/);
  assert.match(server, /setBackgroundRefresh\(livePanelSessionId, 'dependency-graph', false\)/);
  // Delivery to the LivePanel browser (no collaboration room) is via SSE.
  assert.match(server, /notifyLivePanelDependencyUpdated\(dataset\.revision\)/);
  assert.match(server, /sseManager\.sendCustomMessage\(fileUri, \{[\s\S]*type: 'dependency-updated'/);
});

test('the refresh coordinator exposes background modes that publishChanges runs while inactive', () => {
  const coordinator = read('src/code_analysis/refresh/analysisRefreshCoordinator.ts');
  assert.match(coordinator, /backgroundModes: Set<AnalysisRefreshMode>/);
  assert.match(coordinator, /public setBackgroundRefresh\(/);
  assert.match(coordinator, /for \(const backgroundMode of state\.backgroundModes\)/);
  assert.match(coordinator, /this\.runIfNeeded\(sessionId, backgroundMode, false, true\)/);
});

test('the dependency service consumes an incremental change batch (changed files only, extraction cache)', () => {
  const service = read('src/code_analysis/dependencies/dependencyGraphService.ts');
  // The incremental request feeds the Python analyzer the change batch + a cache.
  assert.match(service, /const requestPath = path\.join\(requestDirectory, 'refresh-request\.json'\)/);
  assert.match(service, /this\.extractionCachePath/);
  const server = read('src/servers/runtime/analysis/analysisMessageRouter.ts')
    + read('src/servers/runtime/analysis/dependencyGraphBridge.ts')
    + read('src/servers/runtime/analysis/analysisFeatureHost.ts')
    + read('src/servers/runtime/httpServer.ts');
  // The handler builds the request from the coordinator batch (first run full, then incremental).
  assert.match(server, /changedFiles: batch\.changedFiles/);
  assert.match(server, /forceFullScan: batch\.forceRefresh \|\| !this\.dependencyGraphService\.hasGeneratedDataset\(\)/);
});

test('directory LivePanel template exposes the Dependency Summary section with no manual refresh control', () => {
  const html = read('templates/analysis_livePanel/directory/directoryAnalysis.html');
  assert.match(html, /id="dependency-graph-summary"/);
  assert.match(html, /<h2>Dependency Summary<\/h2>/);
  // The summary is recomputed by the re-analysis chain; there is no refresh button.
  assert.doesNotMatch(html, /dependency-refresh-btn/);
  assert.doesNotMatch(html, /Generate\/Refresh Dependency Summary/);
  assert.match(html, /id="dependency-status"/);
  assert.match(html, /id="dependency-node-count"/);
  assert.match(html, /id="dependency-edge-count"/);
  assert.match(html, /id="dependency-external-count"/);
  assert.match(html, /id="dependency-cycle-count"/);
  assert.match(html, /id="dependency-warning-count"/);
  // Each list is now a shared DataTable mount (div), not a static table.
  assert.match(html, /<div id="dependency-fan-in-table"><\/div>/);
  assert.match(html, /<div id="dependency-fan-out-table"><\/div>/);
  assert.match(html, /<div id="dependency-external-table"><\/div>/);
  assert.match(html, /<div id="dependency-cycles-table"><\/div>/);
  assert.match(html, /<div id="dependency-confidence-table"><\/div>/);
  assert.match(html, /<div id="dependency-capability-table"><\/div>/);
  assert.match(html, /id="dependency-warnings-list"/);
});

test('directory LivePanel script loads the dependency artifact same-origin and reacts to the dependency-updated SSE event', () => {
  const main = read('templates/analysis_livePanel/directory/directoryAnalysismain.js');
  const panel = read('templates/components/livepanel/dependencySummaryPanel.js');
  // No manual POST: the dataset is produced by the re-analysis chain and read as
  // a static artifact by the shared dependency panel component.
  assert.match(panel, /fetch\('\.\/dependency-graph\.json/);
  assert.doesNotMatch(main, /\/api\/dependency-graph\/summary/);
  assert.doesNotMatch(panel, /\/api\/dependency-graph\/summary/);
  assert.match(main, /case 'dependency-updated':/);
  assert.match(main, /loadDependencySummary\(\)/);
  assert.doesNotMatch(main, /http:\/\/localhost/);
  assert.doesNotMatch(main, /window\.location\.origin \+ '\/api/);
  // The rendering logic lives in the shared panel component (one implementation
  // for the file and directory templates), all through the shared DataTable.
  assert.match(panel, /groupCycles\(/);
  assert.match(panel, /renderRankingTable\(/);
  assert.match(panel, /renderConfidenceTable\(/);
  assert.match(panel, /renderCapabilityTable\(/);
  assert.match(panel, /new DataTable\(mount/);
  assert.match(main, /initializeDependencyGraphSummary\(\);/);
});

test('dependency graph summary grouping/ranking logic runs standalone against a small dataset', () => {
  // The grouping logic lives in the shared panel component and must run with
  // no DOM and no other component loaded.
  const panelSource = read('templates/components/livepanel/dependencySummaryPanel.js');
  const context = {
    Map,
    Set,
    Array,
    Number,
    String,
    Object,
    console,
  };
  vm.runInNewContext(
    `${panelSource}\nthis.__testing = { panel: new CodexrDependencySummaryPanel() };`,
    context,
  );
  const groups = context.__testing.panel.groupCycles({
    nodes: [
      { id: 'a', external: false, metrics: { cycleSize: 2 } },
      { id: 'b', external: false, metrics: { cycleSize: 2 } },
      { id: 'c', external: false, metrics: { cycleSize: 0 } },
    ],
    edges: [
      { id: 'e1', source: 'a', target: 'b', kind: 'import', confidence: 'exact', occurrences: 1 },
      { id: 'e2', source: 'b', target: 'a', kind: 'import', confidence: 'exact', occurrences: 1 },
      { id: 'e3', source: 'a', target: 'c', kind: 'import', confidence: 'exact', occurrences: 1 },
    ],
  });
  assert.equal(groups.length, 1);
  assert.equal(groups[0].length, 2);
});

test('dependency-graph start still reaches the server when the selection hop rejects', async () => {
  const source = readAssembledRuntime('dependency-graph', 'dependencyGraphRuntime.js');
  const context = { setTimeout, clearTimeout, console };
  vm.runInNewContext(source, context);
  const runtime = context.CodeXRDependencyGraphRuntime;
  const sent = [];
  context.CodeXRCollaborationRuntime = {
    getClient() {
      return {
        sendMessage(type) {
          sent.push(type);
          return true;
        },
      };
    },
  };
  // start() is invoked as `void start()`: if the local hop to selection
  // rejects, the rejection used to abort start() before the send, leaving
  // the scene in total silence until the 20s watchdog fired.
  context.CodeXRAnalysisModeRuntime = {
    transitionTo() {
      return Promise.reject(new Error('selection hop broken'));
    },
  };
  runtime.getState().availability = 'enabled';

  await runtime.start();

  assert.deepEqual(sent, ['dependency-graph-start']);
});

test('edge batches rely on seeded instance colours, not vertex colours (black-edge regression)', () => {
  const runtime = readAssembledRuntime('dependency-graph', 'dependencyGraphRuntime.js');
  // vertexColors on the batch materials multiplied a missing vertex-colour
  // attribute and rendered every edge black (setColorAt visually ignored);
  // instance colours only need the instanceColor buffer, seeded before the
  // batches first render so the material compiles with instancing colour.
  // (The flow layer's ShaderMaterial keeps vertexColors — its geometry really
  // has a colour attribute.)
  assert.doesNotMatch(runtime, /0xffffff, vertexColors/);
  assert.match(runtime, /body\.setColorAt\(index, seed\)/);
  assert.match(runtime, /arrows\.setColorAt\(index, seed\)/);
});

test('every edge encoding declares a legend and the panel renders it through one path', () => {
  const source = readAssembledRuntime('dependency-graph', 'dependencyGraphRuntime.js');
  const context = {};
  vm.runInNewContext(source, context);
  const helpers = context.CodeXRDependencyGraphRuntime.__testing;

  const relation = helpers.edgeEncodingLegend('relation-type');
  assert.equal(relation.type, 'swatches');
  assert.equal(relation.entries.length, 7);
  assert.ok(relation.entries.every(entry => /^#/.test(entry.color) && entry.label));

  // Width mode colours by relation kind too, so it shares the swatch legend.
  assert.equal(helpers.edgeEncodingLegend('intensity-width').type, 'swatches');

  for (const encoding of ['intensity-color', 'intensity-combined']) {
    const ramp = helpers.edgeEncodingLegend(encoding);
    assert.equal(ramp.type, 'ramp');
    assert.equal(ramp.entries.length, 5);
    // JSON round-trip: vm-realm arrays fail cross-realm deepStrictEqual.
    assert.deepEqual(JSON.parse(JSON.stringify(ramp.entries.map(entry => entry.label))), ['1', '2-3', '4-7', '8-15', '16+']);
    for (let i = 1; i < ramp.entries.length; i++) {
      assert.ok(ramp.entries[i].barHeight > ramp.entries[i - 1].barHeight, 'ramp bars grow with the bucket');
    }
  }

  // One render path for every mode, and the relation filter buttons carry the
  // edge colours as always-visible chips.
  assert.match(source, /renderEdgeLegend\(edgeEncodingLegend\(currentEncoding\)\)/);
  assert.match(source, /RELATION_COLORS\[relation\]/);
  assert.doesNotMatch(source, /Colors identify relation kinds/);
});

test('legend cards follow the user as one rigid yaw-billboarded board', () => {
  const runtime = readAssembledRuntime('dependency-graph', 'dependencyGraphRuntime.js');
  // All cards hang off one board entity that yaw-billboards toward the camera;
  // rotating the group rigidly means cards can never rotate into overlap, and
  // leader-line anchors are converted into the rotated board's space.
  assert.match(runtime, /codexr-legend-board/);
  assert.match(runtime, /CodeXRCommonRuntime\?\.faceCameraYaw/);
  assert.match(runtime, /anchorInBoardSpace/);
  assert.match(runtime, /this\.updateLegendBoard\(\)/);
});

test('flow particles use true perspective sizing and a delta-accumulated clock', () => {
  const runtime = readAssembledRuntime('dependency-graph', 'dependencyGraphRuntime.js');
  // The old formula pinned a constant pixel size below 40 units (the whole
  // interaction range), which read as particles shrinking on approach.
  assert.doesNotMatch(runtime, /max\(40\.0, -mvPosition\.z\)/);
  assert.match(runtime, /clamp\(pointSize \* pointScale \* \(6\.0 \/ max\(0\.5, -mvPosition\.z\)\), 1\.0, 28\.0\)/);
  // Speed derives from the frame delta (smooth re-pacing), not absolute time.
  assert.doesNotMatch(runtime, /time \* \.00042/);
  assert.match(runtime, /this\.flowClock = \(\(this\.flowClock \|\| 0\)/);
  assert.match(runtime, /FLOW_BASE_SPEED/);
});

test('flow size and speed are a room-shared catalogue rendered in the panel', () => {
  const source = readAssembledRuntime('dependency-graph', 'dependencyGraphRuntime.js');
  const context = {};
  vm.runInNewContext(source, context);
  const helpers = context.CodeXRDependencyGraphRuntime.__testing;

  // Catalogue contract: ids/labels/multipliers with sane defaults.
  assert.equal(helpers.FLOW_SIZE_OPTIONS.length, 4);
  assert.equal(helpers.FLOW_SPEED_OPTIONS.length, 4);
  assert.equal(helpers.FLOW_DEFAULTS.flowSize, 'm');
  assert.equal(helpers.FLOW_DEFAULTS.flowSpeed, 'x1');
  assert.equal(helpers.flowSizeOption('xl').scale, 2.2);
  assert.equal(helpers.flowSpeedOption('x2').multiplier, 2);
  // Unknown ids fall back to the defaults instead of breaking the shader/clock.
  assert.equal(helpers.flowSizeOption('nope').id, 'm');
  assert.equal(helpers.flowSpeedOption(undefined).id, 'x1');

  // Shared like the edge encoding: published with the settings payload,
  // defaulted for old snapshots, and cycled from the panel.
  assert.match(source, /flowSize: state\.snapshot\.flowSize \|\| FLOW_DEFAULTS\.flowSize/);
  assert.match(source, /flowSpeed: state\.snapshot\.flowSpeed \|\| FLOW_DEFAULTS\.flowSpeed/);
  assert.match(source, /'Flow size: ' \+ flowSizeOption\(currentFlowSize\)\.label/);
  assert.match(source, /'Flow speed: ' \+ flowSpeedOption\(currentFlowSpeed\)\.label/);
  assert.match(source, /publishState\(\{ flowSize: cycleValue\(currentFlowSize, flowSizeIds, 1\) \}\)/);
  assert.match(source, /publishState\(\{ flowSpeed: cycleValue\(currentFlowSpeed, flowSpeedIds, 1\) \}\)/);

  // The analysis server validates and persists the same contract.
  const server = read('src/servers/runtime/analysis/analysisMessageRouter.ts')
    + read('src/servers/runtime/analysis/dependencyGraphBridge.ts')
    + read('src/servers/runtime/analysis/analysisFeatureHost.ts')
    + read('src/servers/runtime/httpServer.ts');
  assert.match(server, /allowedFlowSizes = new Set\(\['s', 'm', 'l', 'xl'\]\)/);
  assert.match(server, /allowedFlowSpeeds = new Set\(\['x05', 'x1', 'x2', 'x3'\]\)/);
  assert.match(server, /flowSize: existingDependencyState\?\.flowSize \|\| 'm'/);
  assert.match(server, /flowSpeed: existingDependencyState\?\.flowSpeed \|\| 'x1'/);
});

test('invisible cycle-button segments never write depth', () => {
    const source = readAssembledRuntime('dependency-graph', 'dependencyGraphRuntime.js');
    // The <  label  > click segments are near-invisible raycast surfaces; with
    // depthWrite they clip transparent content behind the settings panel.
    const segments = source.match(/opacity: 0\.001; shader: flat; depthWrite: false/g) || [];
    assert.equal(segments.length, 3, 'left/center/right segments must all be depth-inert');
    assert.doesNotMatch(source, /opacity: 0\.001; shader: flat',/);
});

test('dependency runtime is read-only in a self-contained export', () => {
  const source = readAssembledRuntime('dependency-graph', 'dependencyGraphRuntime.js');

  // start() bails with the read-only notice BEFORE the send-retry loop, which
  // would otherwise spin every 500 ms against a server that does not exist.
  assert.match(source, /isOfflineExport\?\.\(\)[\s\S]{0,220}read-only: re-analysis needs the live CodeXR session/);
  const offlineGuardIndex = source.indexOf('read-only: re-analysis needs the live CodeXR session');
  const retryLoopIndex = source.indexOf('retrying dependency-graph-start');
  assert.ok(offlineGuardIndex > -1 && retryLoopIndex > -1 && offlineGuardIndex < retryLoopIndex,
    'the offline guard must sit before the retry loop');

  // Drilling into a file needs a server-side symbol extraction: offline it
  // must explain itself instead of hanging on "Loading symbols...".
  assert.match(source, /File symbols are not part of this export/);
  const fileScopeGuard = source.indexOf('File symbols are not part of this export');
  const fileScopeSend = source.indexOf("sendMessage?.('dependency-file-scope-request'");
  assert.ok(fileScopeGuard > -1 && fileScopeSend > -1 && fileScopeGuard < fileScopeSend,
    'the offline guard must run before the file-scope request');

  // Availability still flows exclusively through the session capabilities the
  // collaboration client resolved (live server or export manifest alike).
  assert.match(source, /getSessionInfoAsync\?\.\(\)/);
  assert.match(source, /capabilities\?\.dependencyGraph === true/);
});

test('every mode runtime keeps its shared-state application passive (mode-entity contract)', () => {
  // The invariant that keeps mode switching honest as modes are added: a mode
  // runtime's applySharedState stores its data and renders ONLY if its mode is
  // already active or activating; the authoritative analysis-view entity is
  // the single thing that changes the active mode. Each runtime must gate on
  // its own active-check helper.
  const dependency = readAssembledRuntime('dependency-graph', 'dependencyGraphRuntime.js');
  assert.match(dependency, /function isDependencyModeActiveOrActivating\(\)/);
  assert.match(dependency, /if \(!isDependencyModeActiveOrActivating\(\)\) \{\s*renderControls\(\);\s*return;/);

  const historical = readAssembledRuntime('historical-comparison', 'historicalComparisonRuntime.js');
  assert.match(historical, /function isHistoricalModeActiveOrActivating\(\)/);
  assert.match(historical, /if \(!isHistoricalModeActiveOrActivating\(\)\) \{\s*state\.result = snapshot\.result;\s*return;/);

  const evolutionPart = read('templates/components/codexr/project-evolution/projectEvolutionRuntime/frameApplication.js');
  assert.match(evolutionPart, /function isEvolutionModeActiveOrActivating\(\)/);
  assert.match(evolutionPart, /if \(!isEvolutionModeActiveOrActivating\(\)\) \{\s*return;/);
  // The old hijack: an unconditional activate pushed the whole room (and any
  // exported copy) into evolution the moment the entity arrived.
  assert.doesNotMatch(evolutionPart, /sendMessage\?\.\('analysis-mode-activate'/);
});
