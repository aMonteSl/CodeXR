const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('XR mode panel exposes one neutral V button and no dependency header button', () => {
  const modeRuntime = read('templates/components/codexr/analysis-mode/analysisModeRuntime.js');
  const tableRuntime = read('templates/components/codexr/analysis-table/analysisTableRuntime.js');
  const dependencyRuntime = read('templates/components/codexr/dependency-graph/dependencyGraphRuntime.js');
  const historyRuntime = read('templates/components/codexr/historical-comparison/historicalComparisonRuntime.js');
  const mappingRuntime = read('templates/components/codexr/xr-chart-mapping-ui/xrChartMappingUiRuntime.js');

  assert.match(modeRuntime, /id: 'visualization-mode'/);
  assert.match(modeRuntime, /buttonLabel: 'V'/);
  assert.match(modeRuntime, /headerButton: true/);
  assert.match(dependencyRuntime, /id: 'dependency-graph'[\s\S]*headerButton: false/);
  assert.match(historyRuntime, /id: 'historical-selection'[\s\S]*headerButton: false/);
  assert.doesNotMatch(dependencyRuntime, /buttonLabel: 'D'/);
  assert.match(mappingRuntime, /if \(options\.headerButton === true\)/);
  assert.match(mappingRuntime, /isPanelReady: function \(\)/);
  assert.match(modeRuntime, /!mappingRuntime\.isPanelReady\?\.\(\)/);
  assert.match(historyRuntime, /!mappingRuntime\.isPanelReady\?\.\(\)/);
  assert.match(dependencyRuntime, /!root\.CodeXRMappingUiRuntime\?\.isPanelReady\?\.\(\)/);
  assert.match(tableRuntime, /oneOf: \['selection', 'single', 'historical-compare', 'dependency-graph'\]/);
  assert.match(tableRuntime, /selection[\s\S]*#b45309/);
  assert.match(modeRuntime, /setTableMode\(mode\)/);
  assert.doesNotMatch(modeRuntime, /mode === 'selection' \? 'single' : mode/);
  assert.match(modeRuntime, /clearVisualizationsForSelection/);
  assert.match(modeRuntime, /data-codexr-analysis-root/);
  assert.match(historyRuntime, /function selectHistoricalMode\(\)[\s\S]*if \(state\.result\)[\s\S]*analysis-mode-activate/);
  assert.match(dependencyRuntime, /function selectDependencyMode\(\)[\s\S]*if \(state\.dataset && state\.snapshot\?\.datasetUrl\)[\s\S]*analysis-mode-activate/);
  assert.ok(
    historyRuntime.indexOf('state.result = result;')
      < historyRuntime.indexOf('await renderComparison(result, datasets[0], datasets[1]);'),
  );
  assert.match(historyRuntime, /async function renderComparison[\s\S]*disposeComparisonGeometry\(false\)/);
});

test('Visualization mode is orange and removes every analysis root before showing options', async () => {
  const source = read('templates/components/codexr/analysis-mode/analysisModeRuntime.js');
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

test('XR mode megatest keeps one visual root and preserves mode-owned state', async () => {
  const source = read('templates/components/codexr/analysis-mode/analysisModeRuntime.js');
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
  const source = read('templates/components/codexr/analysis-mode/analysisModeRuntime.js');
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
  const source = read('templates/components/codexr/analysis-mode/analysisModeRuntime.js');
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

test('Visualization mode interrupts a long historical activation immediately', async () => {
  const source = read('templates/components/codexr/analysis-mode/analysisModeRuntime.js');
  const context = { setTimeout, clearTimeout, console };
  vm.runInNewContext(source, context);
  const runtime = context.CodeXRAnalysisModeRuntime;
  const roots = new Set();
  let releaseHistory;

  runtime.register('historical-compare', {
    activate() {
      roots.add('historical-compare');
      return new Promise(resolve => { releaseHistory = resolve; });
    },
    deactivate() {
      roots.delete('historical-compare');
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

  assert.equal(await selection, true);
  assert.equal(runtime.getState().mode, 'selection');
  assert.equal(runtime.getState().transitioning, false);
  assert.equal(roots.size, 0);

  releaseHistory();
  assert.equal(await history, false);
  assert.equal(runtime.getState().mode, 'selection');
  assert.equal(roots.size, 0);
});

test('a failed mode activation returns to an empty selection state', async () => {
  const source = read('templates/components/codexr/analysis-mode/analysisModeRuntime.js');
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
