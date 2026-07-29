const assert = require('node:assert/strict');
const test = require('node:test');

const {
  AnalysisRefreshCoordinator,
} = require('../../out/code_analysis/refresh/analysisRefreshCoordinator.js');

const flush = () => new Promise(resolve => setTimeout(resolve, 10));

test('refresh coordinator runs background modes on every change even while another mode is active', async () => {
  const coordinator = new AnalysisRefreshCoordinator();
  const calls = { single: [], dependency: [] };
  coordinator.registerHandler('bg', 'single', async batch => { calls.single.push(batch); });
  coordinator.registerHandler('bg', 'dependency-graph', async batch => { calls.dependency.push(batch); });
  coordinator.changeActiveMode('bg', 'single');
  // LivePanel marks its dependency graph as a background mode.
  coordinator.setBackgroundRefresh('bg', 'dependency-graph', true);

  coordinator.publishChanges('bg', { changedFiles: ['a.ts'], addedFiles: [], removedFiles: [] });
  await flush();

  assert.equal(calls.single.length, 1, 'the active mode runs');
  assert.equal(calls.dependency.length, 1, 'the background mode also runs while inactive');
  assert.deepEqual(calls.dependency[0].changedFiles, ['a.ts']);

  // Disabling the background mode stops future off-view runs.
  coordinator.setBackgroundRefresh('bg', 'dependency-graph', false);
  coordinator.publishChanges('bg', { changedFiles: ['b.ts'], addedFiles: [], removedFiles: [] });
  await flush();

  assert.equal(calls.dependency.length, 1, 'no further background runs after disabling');
});

test('refresh coordinator only runs the active analysis mode', async () => {
  const coordinator = new AnalysisRefreshCoordinator();
  const calls = { single: [], dependency: [] };
  coordinator.registerHandler('session', 'single', async batch => calls.single.push(batch));
  coordinator.registerHandler('session', 'dependency-graph', async batch => calls.dependency.push(batch));

  coordinator.changeActiveMode('session', 'dependency-graph');
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
  coordinator.changeActiveMode('session', 'dependency-graph');

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
  coordinator.changeActiveMode('session', 'single');
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
  coordinator.changeActiveMode('session', 'historical-compare');
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
  coordinator.changeActiveMode('session', 'selection');
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
  coordinator.changeActiveMode('session', 'selection');
  coordinator.changeActiveMode('session', 'single');
  await flush();

  assert.equal(calls.length, 0);
  const readyState = coordinator.getViewState('session');
  assert.equal(readyState.status, 'ready');
  assert.equal(readyState.hasUsableSnapshot, true);
  assert.equal(readyState.controllerView, 'single.mapping');
});

test('refresh coordinator publishes controller views for mode shells and ready mapping views', () => {
  const coordinator = new AnalysisRefreshCoordinator();

  coordinator.changeActiveMode('session', 'historical-compare');
  let state = coordinator.getViewState('session');
  assert.equal(state.mode, 'historical-compare');
  assert.equal(state.controllerView, 'historical.selection');
  assert.equal(state.hasUsableSnapshot, false);

  coordinator.setSnapshotAvailable('session', 'historical-compare', true);
  coordinator.changeActiveMode('session', 'historical-compare', 'historical.mapping');
  state = coordinator.getViewState('session');
  assert.equal(state.mode, 'historical-compare');
  assert.equal(state.controllerView, 'historical.mapping');
  assert.equal(state.hasUsableSnapshot, true);

  coordinator.changeActiveMode('session', 'project-evolution');
  state = coordinator.getViewState('session');
  assert.equal(state.mode, 'project-evolution');
  assert.equal(state.controllerView, 'project-evolution');
});

test('controller routing keeps the current owner epoch while a real mode change invalidates it', () => {
  const coordinator = new AnalysisRefreshCoordinator();
  const evolution = coordinator.changeActiveMode(
    'session',
    'project-evolution',
    'project-evolution',
  );
  const routed = coordinator.changeActiveMode(
    'session',
    'project-evolution',
    'project-evolution.mapping',
  );

  assert.equal(routed.viewRevision, evolution.viewRevision);
  assert.equal(
    coordinator.updateActiveViewIfCurrent(
      'session',
      'project-evolution',
      evolution.viewRevision,
      'project-evolution.playback',
    )?.controllerView,
    'project-evolution.playback',
  );

  coordinator.changeActiveMode('session', 'single');
  assert.equal(
    coordinator.updateActiveViewIfCurrent(
      'session',
      'project-evolution',
      evolution.viewRevision,
      'project-evolution',
    ),
    null,
  );
  const reentered = coordinator.changeActiveMode('session', 'project-evolution');
  assert.notEqual(reentered.viewRevision, evolution.viewRevision);
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

test('export-safe refresh waits for an already running dependency dataset', async () => {
  const coordinator = new AnalysisRefreshCoordinator();
  let release;
  let completed = false;
  coordinator.registerHandler('export-session', 'dependency-graph', () => new Promise(resolve => {
    release = resolve;
  }));
  coordinator.changeActiveMode('export-session', 'dependency-graph');
  coordinator.requestRefresh('export-session', 'dependency-graph');
  await flush();

  const waiting = coordinator.forceRefreshModeAndWait(
    'export-session',
    'dependency-graph',
    1000,
  ).then(state => {
    completed = true;
    return state;
  });
  await flush();
  assert.equal(completed, false, 'export must not copy while the dataset is still running');

  release();
  const state = await waiting;
  assert.equal(completed, true);
  assert.equal(state.modeRevision['dependency-graph'] >= 1, true);
  assert.equal(state.appliedRevision['dependency-graph'] >= state.sourceRevision, true);
});

test('export-safe refresh rejects when a mode has no registered producer', async () => {
  const coordinator = new AnalysisRefreshCoordinator();
  await assert.rejects(
    coordinator.forceRefreshModeAndWait('missing', 'dependency-graph', 50),
    /No refresh handler/,
  );
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
  coordinator.changeActiveMode('session', 'dependency-graph');
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
