const assert = require('node:assert/strict');
const test = require('node:test');

const {
  AnalysisRefreshCoordinator,
} = require('../../out/code_analysis/refresh/analysisRefreshCoordinator.js');

const flush = () => new Promise(resolve => setTimeout(resolve, 10));

test('refresh coordinator only runs the active analysis mode', async () => {
  const coordinator = new AnalysisRefreshCoordinator();
  const calls = { single: [], dependency: [] };
  coordinator.registerHandler('session', 'single', async batch => calls.single.push(batch));
  coordinator.registerHandler('session', 'dependency-graph', async batch => calls.dependency.push(batch));

  coordinator.setActiveMode('session', 'dependency-graph');
  coordinator.publishChanges('session', {
    changedFiles: ['changed.ts'],
    addedFiles: [],
    removedFiles: [],
  });
  await flush();

  assert.equal(calls.single.length, 0);
  assert.equal(calls.dependency.length, 1);
  assert.deepEqual(calls.dependency[0].changedFiles, ['changed.ts']);
});

test('refresh coordinator catches a stale mode up once on entry', async () => {
  const coordinator = new AnalysisRefreshCoordinator();
  const calls = [];
  coordinator.registerHandler('session', 'single', async batch => calls.push(batch));
  coordinator.setActiveMode('session', 'dependency-graph');

  coordinator.publishChanges('session', {
    changedFiles: ['first.ts'],
    addedFiles: ['added.ts'],
    removedFiles: [],
  });
  coordinator.publishChanges('session', {
    changedFiles: ['first.ts', 'added.ts'],
    addedFiles: [],
    removedFiles: ['temporary.ts'],
  });
  coordinator.setActiveMode('session', 'single');
  await flush();

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].changedFiles.sort(), ['first.ts']);
  assert.deepEqual(calls[0].addedFiles, ['added.ts']);
  assert.deepEqual(calls[0].removedFiles, ['temporary.ts']);
  assert.equal(calls[0].sourceRevision, 2);
});

test('refresh coordinator queues one combined rerun while a job is active', async () => {
  const coordinator = new AnalysisRefreshCoordinator();
  const calls = [];
  let releaseFirst;
  coordinator.registerHandler('session', 'single', batch => {
    calls.push(batch);
    if (calls.length === 1) {
      return new Promise(resolve => { releaseFirst = resolve; });
    }
    return Promise.resolve();
  });

  coordinator.publishChanges('session', {
    changedFiles: ['first.ts'],
    addedFiles: [],
    removedFiles: [],
  });
  await flush();
  coordinator.publishChanges('session', {
    changedFiles: ['second.ts'],
    addedFiles: [],
    removedFiles: [],
  });
  coordinator.publishChanges('session', {
    changedFiles: ['third.ts'],
    addedFiles: [],
    removedFiles: [],
  });
  releaseFirst();
  await flush();

  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].changedFiles.sort(), ['second.ts', 'third.ts']);
});

test('refresh coordinator retains changes while an immutable mode is disabled', async () => {
  const coordinator = new AnalysisRefreshCoordinator();
  const calls = [];
  coordinator.registerHandler('session', 'historical-compare', async batch => calls.push(batch));
  coordinator.setRefreshEnabled('session', 'historical-compare', false);
  coordinator.setActiveMode('session', 'historical-compare');
  coordinator.publishChanges('session', {
    changedFiles: ['live.ts'],
    addedFiles: [],
    removedFiles: [],
  });
  await flush();
  assert.equal(calls.length, 0);

  coordinator.setRefreshEnabled('session', 'historical-compare', true);
  await flush();
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].changedFiles, ['live.ts']);
});

test('selection keeps every analysis renderer idle', async () => {
  const coordinator = new AnalysisRefreshCoordinator();
  const calls = [];
  coordinator.registerHandler('session', 'single', async batch => calls.push(batch));
  coordinator.setActiveMode('session', 'selection');
  coordinator.publishChanges('session', {
    changedFiles: ['pending.ts'],
    addedFiles: [],
    removedFiles: [],
  });
  await flush();

  assert.equal(calls.length, 0);
  assert.equal(coordinator.getViewState('session').status, 'selecting');
  assert.equal(coordinator.getViewState('session').controllerView, 'visualization-menu');
});

test('activating a mode resumes its snapshot without forcing a refresh', async () => {
  const coordinator = new AnalysisRefreshCoordinator();
  const calls = [];
  coordinator.registerHandler('session', 'single', async batch => calls.push(batch));
  coordinator.setActiveMode('session', 'selection');
  coordinator.activateMode('session', 'single');
  await flush();

  assert.equal(calls.length, 0);
  const readyState = coordinator.getViewState('session');
  assert.equal(readyState.status, 'ready');
  assert.equal(readyState.hasUsableSnapshot, true);
  assert.equal(readyState.controllerView, 'single.mapping');
});

test('refresh coordinator publishes controller views for mode shells and ready mapping views', () => {
  const coordinator = new AnalysisRefreshCoordinator();

  coordinator.setActiveMode('session', 'historical-compare');
  let state = coordinator.getViewState('session');
  assert.equal(state.mode, 'historical-compare');
  assert.equal(state.controllerView, 'historical.selection');
  assert.equal(state.hasUsableSnapshot, false);

  coordinator.setSnapshotAvailable('session', 'historical-compare', true);
  coordinator.setActiveMode('session', 'historical-compare', 'historical.mapping');
  state = coordinator.getViewState('session');
  assert.equal(state.mode, 'historical-compare');
  assert.equal(state.controllerView, 'historical.mapping');
  assert.equal(state.hasUsableSnapshot, true);

  coordinator.setActiveMode('session', 'project-evolution');
  state = coordinator.getViewState('session');
  assert.equal(state.mode, 'project-evolution');
  assert.equal(state.controllerView, 'project-evolution');
});

test('an explicit refresh remains the only path that forces a full refresh', async () => {
  const coordinator = new AnalysisRefreshCoordinator();
  const calls = [];
  coordinator.registerHandler('session', 'single', async batch => calls.push(batch));
  coordinator.requestRefresh('session', 'single');
  await flush();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].forceRefresh, true);
});

test('cached snapshots remain usable while an incremental update is running', async () => {
  const coordinator = new AnalysisRefreshCoordinator();
  let release;
  coordinator.registerHandler('session', 'single', () => new Promise(resolve => {
    release = resolve;
  }));

  coordinator.publishChanges('session', {
    changedFiles: ['changed.ts'],
    addedFiles: [],
    removedFiles: [],
  });
  await flush();

  const updating = coordinator.getViewState('session');
  assert.equal(updating.status, 'updating');
  assert.equal(updating.hasUsableSnapshot, true);

  release();
  await flush();
  assert.equal(coordinator.getViewState('session').status, 'ready');
});

test('an uncached mode reports loading until its first dataset succeeds', async () => {
  const coordinator = new AnalysisRefreshCoordinator();
  let release;
  coordinator.registerHandler('session', 'dependency-graph', () => new Promise(resolve => {
    release = resolve;
  }));
  coordinator.setActiveMode('session', 'dependency-graph');
  coordinator.requestRefresh('session', 'dependency-graph');
  await flush();

  const loading = coordinator.getViewState('session');
  assert.equal(loading.status, 'loading');
  assert.equal(loading.hasUsableSnapshot, false);

  release();
  await flush();
  const ready = coordinator.getViewState('session');
  assert.equal(ready.status, 'ready');
  assert.equal(ready.hasUsableSnapshot, true);
});
