const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..', '..');
const { readAssembledRuntime } = require(path.join(projectRoot, 'test', 'helpers', 'runtimeAssembly.cjs'));

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('XR mode panel exposes one neutral V button and no dependency header button', () => {
  const modeRuntime = readAssembledRuntime('analysis-mode', 'analysisModeRuntime.js');
  const tableRuntime = readAssembledRuntime('analysis-table', 'analysisTableRuntime.js');
  const dependencyRuntime = readAssembledRuntime('dependency-graph', 'dependencyGraphRuntime.js');
  const historyRuntime = readAssembledRuntime('historical-comparison', 'historicalComparisonRuntime.js');
  const evolutionRuntime = readAssembledRuntime('project-evolution', 'projectEvolutionRuntime.js');
  const mappingRuntime = readAssembledRuntime('xr-chart-mapping-ui', 'xrChartMappingUiRuntime.js');

  assert.match(modeRuntime, /id: 'visualization-mode'/);
  assert.match(modeRuntime, /buttonLabel: 'V'/);
  assert.match(modeRuntime, /headerButton: true/);
  assert.match(modeRuntime, /data-codexr-disabled/);
  assert.match(modeRuntime, /data-codexr-mode-disabled-tooltip/);
  assert.match(modeRuntime, /raycaster-intersected/);
  assert.match(modeRuntime, /raycaster-intersected-cleared/);
  assert.match(modeRuntime, /if \(disabled\) \{[\s\S]*return;[\s\S]*debugLog\('Visualization mode option clicked'/);
  assert.match(dependencyRuntime, /id: 'dependency-graph'[\s\S]*headerButton: false/);
  assert.match(historyRuntime, /id: 'historical-selection'[\s\S]*headerButton: false/);
  assert.match(historyRuntime, /function registerHistoricalModeOption\(\)/);
  assert.match(historyRuntime, /disabled: state\.availability !== 'enabled'/);
  assert.match(historyRuntime, /disabledReason: state\.unavailableReason \|\| 'Historical comparison requires a local Git repository\.'/);
  assert.match(historyRuntime, /state\.unregisterModeOption\?\.\(\);/);
  assert.match(evolutionRuntime, /id: MODE/);
  assert.match(evolutionRuntime, /label: 'Project evolution'/);
  assert.match(evolutionRuntime, /disabled: state\.availability !== 'enabled'/);
  assert.match(evolutionRuntime, /Project evolution requires a local Git repository/);
  assert.match(evolutionRuntime, /if \(!state\.result\) \{[\s\S]*clearChartVisualization\(\);[\s\S]*return true;[\s\S]*\}/);
  assert.match(evolutionRuntime, /registerPanelView\(\{/);
  assert.match(evolutionRuntime, /id: MODE/);
  assert.match(evolutionRuntime, /headerButton: false/);
  assert.match(evolutionRuntime, /onShow: handlePanelShown/);
  assert.match(evolutionRuntime, /reason: 'project-evolution-panel-shown'/);
  assert.doesNotMatch(dependencyRuntime, /buttonLabel: 'D'/);
  assert.match(mappingRuntime, /if \(options\.headerButton === true\)/);
  assert.doesNotMatch(modeRuntime, /class: 'babiaxraycasterclass codexr-analysis-mode-option'/);
  assert.match(modeRuntime, /class: 'codexr-analysis-mode-option'/);
  assert.match(mappingRuntime, /isPanelReady: function \(\)/);
  // View registration is event-driven: the controller exposes whenPanelReady
  // and every feature runtime schedules its registerPanelView through it
  // (capped polling used to silently lose views on slow scenes).
  assert.match(mappingRuntime, /whenPanelReady: whenPanelReady/);
  assert.match(mappingRuntime, /flushPanelReadyCallbacks\(\);/);
  assert.match(modeRuntime, /whenPanelReady\?\.\(function \(\) \{/);
  // A missing tooling config must yield null, never a TypeError: the crash it
  // caused during the mode runtime's boot aborted every later step and
  // silently removed the analysis selector from the controller panel.
  assert.match(mappingRuntime, /state\.runtimeConfig \? \(state\.runtimeConfig\.chartId \|\| null\) : null/);
  // Boot steps are isolated so one failure cannot cascade into the others.
  assert.match(modeRuntime, /boot step failed/);
  // Cleanup lifecycle hooks run fault-isolated: a throwing deactivate or
  // disposeView must never abort a transition (it left the table stuck in the
  // old mode's theme with all interactions suspended - dead clicks).
  assert.match(modeRuntime, /function invokeSafely\(lifecycle, method, context\)/);
  assert.match(modeRuntime, /await invokeSafely\(lifecycles\[previousMode\], 'deactivate'/);
  assert.match(modeRuntime, /await invokeSafely\(lifecycles\[mode\], 'disposeView'/);
  assert.match(historyRuntime, /whenPanelReady\?\.\(function \(\) \{/);
  assert.match(dependencyRuntime, /whenPanelReady\?\.\(function \(\) \{/);
  assert.match(tableRuntime, /oneOf: \['selection', 'single', 'historical-compare', 'project-evolution', 'dependency-graph'\]/);
  assert.match(tableRuntime, /selection[\s\S]*#f8fafc/);
  assert.match(tableRuntime, /MODE_THEME_BY_ID = \{/);
  assert.match(tableRuntime, /single: \{[\s\S]*top: 'color: #0e7490/);
  assert.match(tableRuntime, /'historical-compare': \{[\s\S]*top: 'color: #be123c/);
  assert.match(tableRuntime, /'project-evolution': \{[\s\S]*top: 'color: #f59e0b/);
  assert.match(tableRuntime, /setMode = function \(mode\)/);
  assert.match(mappingRuntime, /root\.CodeXRAnalysisControllerRuntime = runtime/);
  assert.match(mappingRuntime, /function showControllerView\(viewId, context\)/);
  assert.match(mappingRuntime, /modeMemory: \{\}/);
  assert.doesNotMatch(evolutionRuntime, /setProjectEvolutionTableMode/);
  assert.match(evolutionRuntime, /transitionTo\?\.\(MODE, \{[\s\S]*panelViewId: MODE/);
  assert.match(modeRuntime, /setTableMode\(mode\)/);
  assert.match(modeRuntime, /MODE_CONTROLLER_VIEW_BY_ID = \{/);
  assert.match(modeRuntime, /'historical-compare': 'historical.selection'/);
  assert.match(modeRuntime, /MODE_PANEL_VIEW_BY_ID = \{[\s\S]*'project-evolution': 'project-evolution'/);
  assert.match(modeRuntime, /function getDefaultPanelViewForMode\(mode\)/);
  assert.match(modeRuntime, /function applyAnalysisMode\(mode, context\)/);
  assert.match(modeRuntime, /element\.querySelectorAll\?\.\('\[codexr-chart-containment\]'\)/);
  assert.match(modeRuntime, /ids = containedChartIds\.length \? containedChartIds : getNormalVisualizationRoots\(\)/);
  assert.match(modeRuntime, /function detachNormalRoots\(reason\)[\s\S]*setElementTreeVisible\(element, false\);/);
  assert.doesNotMatch(modeRuntime, /function detachNormalRoots\(reason\)[\s\S]*element\.parentNode\.removeChild\(element\);[\s\S]*function mountNormalRoots/);
  assert.match(modeRuntime, /switchMappingContext\?\.\('normal-analysis'/);
  assert.doesNotMatch(modeRuntime, /mode === 'selection' \? 'single' : mode/);
  assert.match(modeRuntime, /clearVisualizationsForSelection/);
  assert.match(modeRuntime, /data-codexr-analysis-root/);
  assert.match(historyRuntime, /function selectHistoricalMode\(\)[\s\S]*if \(state\.result\)[\s\S]*analysis-mode-activate/);
  assert.match(historyRuntime, /async function enterHistoricalSelection\(\)[\s\S]*transitionTo\?\.\('historical-compare'/);
  assert.doesNotMatch(historyRuntime, /transitionTo\?\.\('selection', \{[\s\S]*historical-selection/);
  assert.match(dependencyRuntime, /function selectDependencyMode\(\)[\s\S]*if \(state\.dataset && state\.snapshot\?\.datasetUrl\)[\s\S]*analysis-mode-activate/);
  assert.ok(
    historyRuntime.indexOf('state.result = result;')
      < historyRuntime.indexOf('await renderComparison(result, datasets[0], datasets[1]);'),
  );
  assert.match(historyRuntime, /async function renderComparison[\s\S]*disposeComparisonGeometry\(false\)/);
});

test('Visualization mode is neutral and removes every analysis root before showing options', async () => {
  const source = readAssembledRuntime('analysis-mode', 'analysisModeRuntime.js');
  const roots = new Map();
  const removed = [];
  const tableModes = [];
  const original = {
    setAttribute(name, value) {
      if (name === 'visible') {
        this.visible = value;
      }
    },
    visible: true,
  };
  const table = {
    setAttribute(component, property, value) {
      if (component === 'codexr-analysis-table' && property === 'mode') {
        tableModes.push(value);
      }
    },
  };
  function addRoot(id) {
    const element = {
      id,
      parentNode: {
        removeChild(child) {
          removed.push(child.id);
          roots.delete(child.id);
          child.parentNode = null;
        },
      },
    };
    roots.set(id, element);
    return element;
  }
  addRoot('codexrHistoricalComparisonRoot');
  addRoot('codexrDependencyGraph');
  const document = {
    getElementById(id) {
      if (id === 'codexrAnalysisTable') {
        return table;
      }
      if (id === 'normalChart') {
        return original;
      }
      if (id === 'codexr-tooling-config-xr-mapping-ui') {
        return { textContent: JSON.stringify({ chartEntityId: 'normalChart' }) };
      }
      return roots.get(id) || null;
    },
    querySelectorAll(selector) {
      return selector === '[data-codexr-analysis-root="true"]'
        ? Array.from(roots.values())
        : [];
    },
  };
  const context = { setTimeout, clearTimeout, console };
  vm.runInNewContext(source, context);
  const runtime = context.CodeXRAnalysisModeRuntime;
  context.document = document;
  runtime.register('selection', {
    activate: runtime.__testing.clearVisualizationsForSelection,
  });

  await runtime.transitionTo('selection', { reason: 'test-empty-selector' });

  assert.equal(original.visible, false);
  assert.equal(roots.size, 0);
  assert.deepEqual(new Set(removed), new Set([
    'codexrHistoricalComparisonRoot',
    'codexrDependencyGraph',
  ]));
  assert.equal(tableModes.at(-1), 'selection');
  assert.equal(runtime.getState().mode, 'selection');
});

test('Project evolution leaves the neutral selection table theme through the authoritative mode transition', async () => {
  const source = readAssembledRuntime('analysis-mode', 'analysisModeRuntime.js');
  const tableModes = [];
  const shownPanels = [];
  const shownControllerViews = [];
  const context = {
    setTimeout,
    clearTimeout,
    console,
    CodeXRAnalysisTableRuntime: {
      setMode(mode) {
        tableModes.push(mode);
        return mode;
      },
    },
    CodeXRMappingUiRuntime: {
      showPanelView(panelId) {
        shownPanels.push(panelId);
      },
    },
    CodeXRAnalysisControllerRuntime: {
      showView(viewId, options) {
        shownControllerViews.push({ viewId, options });
        shownPanels.push(viewId === 'visualization-menu' ? 'visualization-mode' : 'project-evolution');
      },
    },
  };
  vm.runInNewContext(source, context);
  const runtime = context.CodeXRAnalysisModeRuntime;

  runtime.register('selection', { activate() {} });
  runtime.register('project-evolution', {
    activate() {
      return true;
    },
  });

  assert.equal(await runtime.transitionTo('selection', { panelViewId: 'visualization-mode' }), true);
  assert.equal(tableModes.at(-1), 'selection');

  assert.equal(await runtime.transitionTo('project-evolution', { panelViewId: 'project-evolution' }), true);

  assert.equal(runtime.getState().mode, 'project-evolution');
  assert.equal(runtime.getState().requestedMode, 'project-evolution');
  assert.equal(runtime.getState().controllerView, 'project-evolution');
  assert.equal(tableModes.at(-1), 'project-evolution');
  assert.equal(shownControllerViews.at(-1).viewId, 'project-evolution');
});

test('Historical selection lives under the historical table theme', async () => {
  const source = readAssembledRuntime('analysis-mode', 'analysisModeRuntime.js');
  const tableModes = [];
  const shownPanels = [];
  const shownControllerViews = [];
  const context = {
    setTimeout,
    clearTimeout,
    console,
    CodeXRAnalysisTableRuntime: {
      setMode(mode) {
        tableModes.push(mode);
        return mode;
      },
    },
    CodeXRMappingUiRuntime: {
      showPanelView(panelId) {
        shownPanels.push(panelId);
      },
    },
    CodeXRAnalysisControllerRuntime: {
      showView(viewId, options) {
        shownControllerViews.push({ viewId, options });
        shownPanels.push(viewId === 'historical.selection' ? 'historical-selection' : 'mapping');
      },
    },
  };
  vm.runInNewContext(source, context);
  const runtime = context.CodeXRAnalysisModeRuntime;

  runtime.register('selection', { activate() {} });
  runtime.register('historical-compare', {
    activate() {
      return true;
    },
  });

  assert.equal(await runtime.transitionTo('selection', { panelViewId: 'visualization-mode' }), true);
  assert.equal(tableModes.at(-1), 'selection');

  assert.equal(
    await runtime.transitionTo('historical-compare', { panelViewId: 'historical-selection' }),
    true,
  );

  assert.equal(runtime.getState().mode, 'historical-compare');
  assert.equal(runtime.getState().requestedMode, 'historical-compare');
  assert.equal(runtime.getState().controllerView, 'historical.selection');
  assert.equal(tableModes.at(-1), 'historical-compare');
  assert.equal(shownControllerViews.at(-1).viewId, 'historical.selection');
});

test('first Visualization mode click hides but preserves normal visualization roots', async () => {
  const source = readAssembledRuntime('analysis-mode', 'analysisModeRuntime.js');
  const tableModes = [];
  const chartIds = [];
  let registeredView = null;
  const elements = new Map();
  function element(id) {
    const el = {
      id,
      children: [],
      attributes: {},
      visible: true,
      appendChild(child) {
        this.children.push(child);
        child.parentNode = this;
      },
      removeChild(child) {
        this.children = this.children.filter(candidate => candidate !== child);
        child.parentNode = null;
      },
      setAttribute(name, property, value) {
        if (id === 'codexrAnalysisTable' && name === 'codexr-analysis-table' && property === 'mode') {
          tableModes.push(value);
        }
        if (name === 'visible') {
          this.visible = property;
        }
        this.attributes[name] = value === undefined ? property : { property, value };
      },
      getAttribute(name) {
        return this.attributes[name];
      },
      querySelector(selector) {
        if (selector === '[data-codexr-analysis-root="true"]') {
          return this.children.find(child => child.attributes['data-codexr-analysis-root'] === 'true') || null;
        }
        return null;
      },
      querySelectorAll(selector) {
        if (selector === '[data-codexr-normal-root="true"], [data-codexr-analysis-mode="single"]') {
          return this.children.filter(child =>
            child.attributes['data-codexr-normal-root'] === 'true'
            || child.attributes['data-codexr-analysis-mode'] === 'single');
        }
        if (selector === '[data-codexr-analysis-root="true"]') {
          return this.children.filter(child => child.attributes['data-codexr-analysis-root'] === 'true');
        }
        return [];
      },
      addEventListener() {},
      remove() {
        this.removed = true;
      },
    };
    elements.set(id, el);
    return el;
  }
  const primaryVisual = element('primaryVisual');
  const secondaryVisual = element('secondaryVisual');
  const scene = element('scene');
  const surface = element('codexrAnalysisSurface');
  const normalRoot = element('codexrNormalAnalysisRoot');
  normalRoot.setAttribute('data-codexr-analysis-root', 'true');
  normalRoot.setAttribute('data-codexr-analysis-mode', 'single');
  normalRoot.setAttribute('data-codexr-normal-root', 'true');
  normalRoot.appendChild(primaryVisual);
  normalRoot.appendChild(secondaryVisual);
  surface.appendChild(normalRoot);
  scene.appendChild(surface);
  const table = element('codexrAnalysisTable');
  const config = element('codexr-tooling-config-xr-mapping-ui');
  config.textContent = JSON.stringify({
    normalSurfaceId: 'codexrAnalysisSurface',
    normalRootId: 'codexrNormalAnalysisRoot',
    chartEntityIds: ['primaryVisual', 'secondaryVisual'],
  });
  const document = {
    createElement(tagName) {
      return element(tagName + '-' + elements.size);
    },
    getElementById(id) {
      if (id === 'primaryVisual') { return primaryVisual; }
      if (id === 'secondaryVisual') { return secondaryVisual; }
      if (id === 'codexrAnalysisSurface') { return surface; }
      if (id === 'codexrNormalAnalysisRoot') { return normalRoot; }
      if (id === 'codexrAnalysisTable') { return table; }
      if (id === 'codexr-tooling-config-xr-mapping-ui') { return config; }
      return elements.get(id) || null;
    },
    querySelector(selector) {
      if (selector === 'a-scene') { return scene; }
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '[data-codexr-normal-root="true"]') {
        return normalRoot.parentNode ? [normalRoot] : [];
      }
      return [];
    },
  };
  const context = {
    setTimeout,
    clearTimeout,
    console,
    document,
    CodeXRMappingUiRuntime: {
      isPanelReady() { return true; },
      registerPanelView(view) {
        registeredView = view;
        return () => {};
      },
      showPanelView() {},
      setChartEntityIds(ids) {
        chartIds.push(ids);
      },
    },
    CodeXRAnalysisTableRuntime: {
      waitForChartsStable() { return Promise.resolve({ valid: true }); },
      renormalizeAll() {},
    },
  };
  vm.runInNewContext(source, context);
  const runtime = context.CodeXRAnalysisModeRuntime;

  assert.equal(runtime.getState().mode, 'single');
  assert.equal(registeredView?.id, 'visualization-mode');
  registeredView.onShow();
  await new Promise(resolve => setTimeout(resolve, 10));

  assert.equal(runtime.getState().mode, 'selection');
  assert.equal(tableModes.at(-1), 'selection');
  assert.equal(normalRoot.parentNode, surface);
  assert.equal(surface.children.includes(normalRoot), true);
  assert.equal(normalRoot.visible, false);
  assert.deepEqual(Array.from(chartIds.at(-1)), []);
});

test('mounting a non-normal surface root keeps the preserved normal chart hidden', () => {
  const source = readAssembledRuntime('analysis-mode', 'analysisModeRuntime.js');
  const elements = new Map();
  function object3D() {
    return {
      visible: true,
      traverse(callback) {
        callback(this);
      },
    };
  }
  function element(id) {
    const el = {
      id,
      children: [],
      attributes: {},
      object3D: object3D(),
      appendChild(child) {
        this.children.push(child);
        child.parentNode = this;
      },
      removeChild(child) {
        this.children = this.children.filter(candidate => candidate !== child);
        child.parentNode = null;
      },
      setAttribute(name, value) {
        this.attributes[name] = value;
        if (name === 'visible') {
          this.visible = value;
        }
      },
      removeAttribute(name) {
        delete this.attributes[name];
      },
      getAttribute(name) {
        return this.attributes[name];
      },
      querySelector(selector) {
        if (selector === '[data-codexr-analysis-mode]:not([data-codexr-analysis-mode="single"])') {
          return this.children.find(child => child.attributes['data-codexr-analysis-mode'] !== 'single') || null;
        }
        if (selector === '[data-codexr-analysis-mode="single"]') {
          return this.children.find(child => child.attributes['data-codexr-analysis-mode'] === 'single') || null;
        }
        return null;
      },
      querySelectorAll(selector) {
        if (selector === '[data-codexr-analysis-mode="dependency-graph"]') {
          return this.children.filter(child => child.attributes['data-codexr-analysis-mode'] === 'dependency-graph');
        }
        if (selector === '[data-codexr-analysis-root="true"]') {
          return this.children.filter(child => child.attributes['data-codexr-analysis-root'] === 'true');
        }
        return [];
      },
    };
    elements.set(id, el);
    return el;
  }
  const scene = element('scene');
  const surface = element('codexrAnalysisSurface');
  const normal = element('codexrNormalAnalysisRoot');
  normal.setAttribute('data-codexr-analysis-root', 'true');
  normal.setAttribute('data-codexr-analysis-mode', 'single');
  normal.setAttribute('data-codexr-normal-root', 'true');
  const normalBuilding = element('normalBuilding');
  let normalTooltipClears = 0;
  normalBuilding.setAttribute('class', 'babiaxraycasterclass codexr-building');
  normalBuilding.setAttribute('data-codexr-interactive', 'true');
  normalBuilding.components = {
    'codexr-test-tooltip-source': {
      clearTooltips() { normalTooltipClears += 1; },
    },
  };
  normal.appendChild(normalBuilding);
  surface.appendChild(normal);
  const dependency = element('codexrDependencyGraph');
  const config = { textContent: JSON.stringify({
    normalSurfaceId: 'codexrAnalysisSurface',
    normalRootId: 'codexrNormalAnalysisRoot',
  }) };
  const document = {
    createElement(tagName) {
      return element(tagName + '-' + elements.size);
    },
    getElementById(id) {
      if (id === 'codexr-tooling-config-xr-mapping-ui') return config;
      return elements.get(id) || null;
    },
    querySelector(selector) {
      return selector === 'a-scene' ? scene : null;
    },
    querySelectorAll(selector) {
      if (selector === '[data-codexr-normal-root="true"], [data-codexr-normal-visualization="true"]') {
        return [normal];
      }
      if (selector === '[data-codexr-analysis-root="true"]') {
        return [normal, dependency].filter(candidate => candidate.attributes['data-codexr-analysis-root'] === 'true');
      }
      return [];
    },
  };
  const context = { setTimeout, clearTimeout, console, document };
  vm.runInNewContext(source, context);
  const surfaceRuntime = context.CodeXRAnalysisSurfaceRuntime;

  surfaceRuntime.setNormalVisible(false);
  surfaceRuntime.mountRoot('dependency-graph', dependency);

  assert.equal(surface.object3D.visible, true);
  assert.equal(normal.parentNode, surface);
  assert.equal(normal.object3D.visible, false);
  assert.equal(normalBuilding.attributes.class, 'codexr-building');
  assert.equal(normalBuilding.attributes['data-codexr-interactive'], 'false');
  assert.ok(normalTooltipClears >= 1);
  assert.equal(dependency.object3D.visible, true);
  assert.equal(dependency.parentNode, surface);

  surfaceRuntime.setNormalVisible(true);

  assert.match(normalBuilding.attributes.class, /babiaxraycasterclass/);
  assert.equal(normalBuilding.attributes['data-codexr-interactive'], 'true');
});

test('XR mode megatest keeps one visual root and preserves mode-owned state', async () => {
  const source = readAssembledRuntime('analysis-mode', 'analysisModeRuntime.js');
  const context = { setTimeout, clearTimeout, console };
  vm.runInNewContext(source, context);
  const runtime = context.CodeXRAnalysisModeRuntime;
  const roots = new Set();
  const memory = {
    single: { mapping: 'lines/complexity/color' },
    'historical-compare': { mapping: 'lines/complexity/color', refs: 'working-copy..HEAD~1' },
    'dependency-graph': { layout: 'hierarchical', scope: 'src/tools', filters: 'imports+calls' },
  };

  function lifecycle(mode) {
    return {
      activate() {
        roots.add(mode);
        assert.equal(roots.size, 1);
      },
      deactivate() {
        roots.delete(mode);
      },
    };
  }

  runtime.register('single', lifecycle('single'));
  runtime.register('historical-compare', lifecycle('historical-compare'));
  runtime.register('dependency-graph', lifecycle('dependency-graph'));
  runtime.register('selection', {
    activate() {
      assert.equal(roots.size, 0);
    },
  });

  const sequence = [
    'single',
    'selection',
    'dependency-graph',
    'historical-compare',
    'single',
    'dependency-graph',
    'selection',
    'historical-compare',
    'single',
  ];
  for (const mode of sequence) {
    assert.equal(await runtime.transitionTo(mode, { reason: 'megatest' }), true);
    assert.equal(roots.size, mode === 'selection' ? 0 : 1);
    assert.deepEqual(memory.single, { mapping: 'lines/complexity/color' });
    assert.deepEqual(memory['historical-compare'], {
      mapping: 'lines/complexity/color',
      refs: 'working-copy..HEAD~1',
    });
    assert.deepEqual(memory['dependency-graph'], {
      layout: 'hierarchical',
      scope: 'src/tools',
      filters: 'imports+calls',
    });
  }

  assert.deepEqual(Array.from(roots), ['single']);
  assert.equal(runtime.getState().mode, 'single');
  assert.equal(runtime.getState().requestedMode, 'single');
});

test('opening Visualization mode clears locally before publishing shared selection', async () => {
  const source = readAssembledRuntime('analysis-mode', 'analysisModeRuntime.js');
  const events = [];
  const context = {
    setTimeout,
    clearTimeout,
    console,
    CodeXRCollaborationRuntime: {
      getClient() {
        return {
          sendMessage(type) {
            events.push(type);
          },
        };
      },
    },
  };
  vm.runInNewContext(source, context);
  const runtime = context.CodeXRAnalysisModeRuntime;
  runtime.register('selection', {
    async activate() {
      await new Promise(resolve => setTimeout(resolve, 5));
      events.push('selection-cleared');
    },
  });
  await new Promise(resolve => setTimeout(resolve, 10));
  events.length = 0;

  await runtime.openSelector();

  assert.deepEqual(events, [
    'selection-cleared',
    'analysis-mode-selection',
  ]);
  assert.equal(runtime.getState().mode, 'selection');
});

test('a superseded dependency activation cannot recreate its visual root', async () => {
  const source = readAssembledRuntime('analysis-mode', 'analysisModeRuntime.js');
  const context = { setTimeout, clearTimeout, console };
  vm.runInNewContext(source, context);
  const runtime = context.CodeXRAnalysisModeRuntime;
  const roots = new Set();
  let releaseDependency;

  runtime.register('dependency-graph', {
    activate() {
      roots.add('dependency-graph');
      return new Promise(resolve => { releaseDependency = resolve; });
    },
    deactivate() {
      roots.delete('dependency-graph');
    },
  });
  runtime.register('single', {
    activate() { roots.add('single'); },
    deactivate() { roots.delete('single'); },
  });

  const dependency = runtime.transitionTo('dependency-graph');
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(runtime.getState().mode, 'dependency-graph');
  assert.equal(runtime.getState().transitioning, true);
  const normal = runtime.transitionTo('single');
  releaseDependency();

  assert.equal(await dependency, false);
  assert.equal(await normal, true);
  assert.deepEqual(Array.from(roots), ['single']);
});

test('Visualization mode waits for a long historical activation and then clears it', async () => {
  const source = readAssembledRuntime('analysis-mode', 'analysisModeRuntime.js');
  const context = { setTimeout, clearTimeout, console };
  vm.runInNewContext(source, context);
  const runtime = context.CodeXRAnalysisModeRuntime;
  const roots = new Set();
  let releaseHistory;

  runtime.register('historical-compare', {
    async activate() {
      roots.add('historical-compare');
      await new Promise(resolve => { releaseHistory = resolve; });
      roots.add('historical-compare-late-root');
    },
    deactivate() {
      roots.delete('historical-compare');
      roots.delete('historical-compare-late-root');
    },
  });
  runtime.register('selection', {
    activate() {
      assert.equal(roots.size, 0);
    },
  });

  const history = runtime.transitionTo('historical-compare');
  await new Promise(resolve => setTimeout(resolve, 0));
  const selection = runtime.transitionTo('selection');

  assert.equal(runtime.getState().transitioning, true);
  releaseHistory();
  assert.equal(await history, false);
  assert.equal(await selection, true);
  assert.equal(runtime.getState().mode, 'selection');
  assert.equal(runtime.getState().transitioning, false);
  assert.equal(roots.size, 0);
});

test('late dependency activation is disposed after user returns to normal', async () => {
  const source = readAssembledRuntime('analysis-mode', 'analysisModeRuntime.js');
  const context = { setTimeout, clearTimeout, console };
  vm.runInNewContext(source, context);
  const runtime = context.CodeXRAnalysisModeRuntime;
  const roots = new Set();
  let releaseDependency;

  runtime.register('dependency-graph', {
    async activate() {
      roots.add('dependency-graph');
      await new Promise(resolve => { releaseDependency = resolve; });
      roots.add('dependency-graph-late-root');
    },
    deactivate() {
      roots.delete('dependency-graph');
      roots.delete('dependency-graph-late-root');
    },
  });
  runtime.register('single', {
    activate() { roots.add('single'); },
    deactivate() { roots.delete('single'); },
  });

  const dependency = runtime.transitionTo('dependency-graph');
  await new Promise(resolve => setTimeout(resolve, 0));
  const normal = runtime.transitionTo('single');
  releaseDependency();

  assert.equal(await dependency, false);
  assert.equal(await normal, true);
  assert.deepEqual(Array.from(roots), ['single']);
});

test('a failed mode activation returns to an empty selection state', async () => {
  const source = readAssembledRuntime('analysis-mode', 'analysisModeRuntime.js');
  const context = {
    setTimeout,
    clearTimeout,
    console: { error() {}, warn() {}, log() {}, table() {} },
  };
  vm.runInNewContext(source, context);
  const runtime = context.CodeXRAnalysisModeRuntime;
  let disposed = false;

  runtime.register('historical-compare', {
    activate() {
      throw new Error('fixture activation failure');
    },
    disposeView() {
      disposed = true;
    },
  });
  runtime.register('selection', {
    activate() {},
  });

  assert.equal(await runtime.transitionTo('historical-compare'), false);
  assert.equal(disposed, true);
  assert.equal(runtime.getState().mode, 'selection');
  assert.equal(runtime.getState().transitioning, false);
});

test('a mode whose disposeView throws synchronously cannot abort the selection transition', async () => {
  const source = readAssembledRuntime('analysis-mode', 'analysisModeRuntime.js');
  const context = { setTimeout, clearTimeout, console };
  vm.runInNewContext(source, context);
  const runtime = context.CodeXRAnalysisModeRuntime;
  context.document = {
    getElementById() { return null; },
    querySelectorAll() { return []; },
  };

  runtime.register('selection', {
    activate: runtime.__testing.clearVisualizationsForSelection,
  });
  // Reproduces the dependency-graph start bug: project evolution's disposeView
  // threw a synchronous TypeError, which escaped the cleanup .map() before
  // Promise.allSettled could contain it and rejected the whole transition.
  runtime.register('project-evolution', {
    activate() {},
    disposeView() {
      throw new TypeError("Cannot read properties of null (reading 'suggestedSourceIds')");
    },
  });

  assert.equal(await runtime.transitionTo('selection', { reason: 'broken-cleanup-regression' }), true);
  assert.equal(runtime.getState().mode, 'selection');
  assert.equal(runtime.getState().transitioning, false);
});
