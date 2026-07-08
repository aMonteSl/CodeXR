const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('dependency graph is a first-class analysis table mode', () => {
  const table = read('templates/components/codexr/analysis-table/analysisTableRuntime.js');
  const models = read('src/code_analysis/historical/historicalComparisonModels.ts');
  assert.match(table, /dependency-graph/);
  assert.match(models, /'dependency-graph'/);
  assert.match(table, /#7c3aed/);
});

test('dependency runtime uses a worker and owns three layouts', () => {
  const runtime = read('templates/components/codexr/dependency-graph/dependencyGraphRuntime.js');
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
  assert.match(runtime, /graphTopY \+ \.92/);
  assert.match(runtime, /CodeXRCommonRuntime\?\.faceCamera/);
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
  assert.match(runtime, /Show external details/);
  assert.match(runtime, /response\.generation !== this\.pendingGraph\.generation/);
  assert.doesNotMatch(runtime, /setGraph: function \(dataset, view\) \{\s*this\.clear/);
  assert.match(runtime, /data-codexr-help/);
  assert.match(runtime, /Imports: module dependencies/);
  assert.match(runtime, /Confidence/);
  assert.match(runtime, /Occurrences/);
  assert.match(runtime, /Open folder/);
  assert.match(runtime, /Go to parent/);
  assert.match(runtime, /Open file/);
  assert.match(runtime, /footerReserve: canNavigate \ \.28 : 0/);
  assert.match(runtime, /'0 -0\.62 0\.02'/);
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
  const source = read('templates/components/codexr/dependency-graph/dependencyGraphRuntime.js');
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
  const source = read('templates/components/codexr/dependency-graph/dependencyGraphRuntime.js');
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
  const source = read('templates/components/codexr/dependency-graph/dependencyGraphRuntime.js');
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
  const source = read('templates/components/codexr/dependency-graph/dependencyGraphRuntime.js');
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
  const budget = read('templates/components/codexr/render-budget/renderBudgetRuntime.js');
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
  const source = read('templates/components/codexr/dependency-visual-budget/dependencyVisualBudgetRuntime.js');
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
  const source = read('templates/components/codexr/dependency-visual-budget/dependencyVisualBudgetRuntime.js');
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
  const runtime = read('templates/components/codexr/dependency-graph/dependencyGraphRuntime.js');
  const parser = read('src/code_analysis/engine/parsers/directoryXRParser.ts');
  assert.match(runtime, /Detail: /);
  assert.match(runtime, /setDetailOverride/);
  assert.match(runtime, /CodeXRCommonRuntime\?\.createTooltip/);
  assert.match(runtime, /CodeXRCommonRuntime\?\.updateTooltip/);
  assert.match(runtime, /CodeXRCommonRuntime\\.updateTooltipConnector/);
  assert.match(runtime, /CodeXRCommonRuntime\?\.faceCamera/);
  assert.match(runtime, /'data-codexr-interactive': 'true'/);
  assert.match(runtime, /connectorTarget/);
  assert.doesNotMatch(runtime, /detailOverride: state\.snapshot/);
  assert.match(parser, /DEPENDENCY_VISUAL_BUDGET_RUNTIME_OUTPUT_NAME/);
  assert.match(parser, /CODEXR_DEBUG_RUNTIME_OUTPUT_NAME/);
});

test('render budget degrades and recovers with hysteresis', () => {
  const source = read('templates/components/codexr/render-budget/renderBudgetRuntime.js');
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
  const source = read('templates/components/codexr/render-budget/renderBudgetRuntime.js');
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
  const source = read('templates/components/codexr/dependency-graph/dependencyGraphRuntime.js');
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
    relativePath: 'src/service.ts',
    language: 'TypeScript',
    metrics: { fanIn: 4, fanOut: 6, degree: 10, relationCount: 8, cycleSize: 2, totalLines: 1000 },
  });
  assert.equal(details.title, 'service.ts');
  assert.equal(details.subtitle, 'src/service.ts');
  assert.match(details.primary, /Fan-in 4/);
  assert.match(details.secondary, /Lines 1000/);
  assert.ok(Object.values(details).every(value => !String(value).includes('\n')));
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
  const source = read('templates/components/codexr/analysis-mode/analysisModeRuntime.js');
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
  const source = read('templates/components/codexr/analysis-mode/analysisModeRuntime.js');
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
  const source = read('templates/components/codexr/analysis-mode/analysisModeRuntime.js');
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
  const server = read('src/servers/runtime/httpServer.ts');
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
