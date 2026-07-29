// == dependencyGraphRuntime.js | viewLifecycle (assembled per manifest.json; see COMPONENTS.md) ==
  function renderCurrentGraphIfReady() {
    if (!state.active || !state.dataset || state.snapshot?.status !== 'ready') { return; }
    var component = refs.graph?.components?.[COMPONENT];
    if (!component?.setGraph) { return; }
    component.setGraph(filteredDataset(), state.snapshot);
  }

  function renderGraphWhenReady(graph, snapshot, viewGeneration, attempt) {
    if (!state.active || state.snapshot !== snapshot || state.viewGeneration !== viewGeneration) { return; }
    if (!refs.graph?.isConnected) {
      scheduleGraphRenderRetry(graph, snapshot, viewGeneration, attempt);
      return;
    }
    var component = refs.graph.components?.[COMPONENT];
    if (component?.setGraph) {
      component.setGraph(graph, snapshot);
      return;
    }
    scheduleGraphRenderRetry(graph, snapshot, viewGeneration, attempt);
  }

  function scheduleGraphRenderRetry(graph, snapshot, viewGeneration, attempt) {
    if (attempt >= 120) {
      setStatus('Dependency graph component could not be initialized.', true);
      return;
    }
    var timer = setTimeout(function () {
      state.retryTimers.delete(timer);
      renderGraphWhenReady(graph, snapshot, viewGeneration, attempt + 1);
    }, 50);
    state.retryTimers.add(timer);
  }

  function resetView() {
    if (state.transitionLocked) { return; }
    refs.graph?.components?.[COMPONENT]?.resetView?.();
    var rig = doc()?.getElementById('rig');
    // Eye height lives on the rig itself — never on the camera.
    rig?.setAttribute?.('position', '0.07 1.75 -10.75');
    rig?.setAttribute?.('rotation', '0 0 0');
    setStatus('View reset.', false);
  }

  async function applySharedState(snapshot) {
    snapshot = snapshot ? Object.assign({
      edgeEncoding: 'relation-type',
      flowSize: FLOW_DEFAULTS.flowSize,
      flowSpeed: FLOW_DEFAULTS.flowSpeed,
      scope: { kind: 'directory', relativePath: '' }
    }, snapshot) : snapshot;
    state.snapshot = snapshot;
    if (!snapshot) {
      renderControls();
      return;
    }
    if (!isDependencyModeActiveOrActivating()) {
      renderControls();
      return;
    }
    renderControls();
    if (snapshot.status !== 'ready' || !snapshot.datasetUrl) {
      setStatus(snapshot.message || 'Analyzing dependencies...', false);
      if (snapshot.status === 'error') {
        setTransitionLocked(false);
      }
      return;
    }
    try {
      var loadGeneration = ++state.datasetLoadGeneration;
      var viewGeneration = state.viewGeneration;
      var response = await fetch(snapshot.datasetUrl + '?revision=' + snapshot.revision, { cache: 'no-store' });
      if (!response.ok) { throw new Error('Dependency dataset could not be loaded.'); }
      var dataset = await response.json();
      if (
        loadGeneration !== state.datasetLoadGeneration
        || viewGeneration !== state.viewGeneration
        || state.snapshot !== snapshot
        || !state.active
      ) {
        return;
      }
      state.dataset = dataset;
      if (dataset.targetType === 'directory') {
        state.projectDataset = dataset;
      } else {
        var fileKey = normalizeRelativePath(
          dataset.targetRelativePath || snapshot.scope?.relativePath
        );
        state.fileDatasets[fileKey] = dataset;
      }
      if (snapshot.projectDatasetUrl) {
        var projectResponse = await fetch(
          snapshot.projectDatasetUrl + '?sourceRevision=' + Number(snapshot.sourceRevision || 0),
          { cache: 'no-store' }
        );
        if (
          projectResponse.ok
          && loadGeneration === state.datasetLoadGeneration
          && viewGeneration === state.viewGeneration
          && state.active
        ) {
          var projectDataset = await projectResponse.json();
          if (projectDataset?.targetType === 'directory') {
            state.projectDataset = projectDataset;
          }
        }
      }
      renderGraph();
      setTransitionLocked(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error), true);
      setTransitionLocked(false);
    }
  }

  function hasReadySnapshot() {
    return state.snapshot?.status === 'ready' && !!state.snapshot?.datasetUrl;
  }

  function activateReadySnapshot(reason) {
    if (!hasReadySnapshot()) { return false; }
    var offline = client()?.isOfflineExport?.() === true;
    root.console?.log?.('[CodeXR.Debug]: Activating existing dependency graph snapshot', {
      offline: offline,
      hasDataset: !!state.dataset,
      datasetUrl: state.snapshot.datasetUrl
    });
    if (!offline) {
      client()?.sendMessage?.('analysis-mode-activate', {
        mode: 'dependency-graph'
      });
    }
    void root.CodeXRAnalysisModeRuntime?.changeAnalysis?.('dependency-graph', {
      reason: reason || 'local-dependency-mode-option',
      panelViewId: 'dependency-graph'
    });
    return true;
  }

  async function start() {
    if (state.availability !== 'enabled') {
      setStatus(state.unavailableReason, true);
      return;
    }
    if (state.transitionLocked) { return; }
    if (hasReadySnapshot() && client()?.isOfflineExport?.()) {
      activateReadySnapshot('offline-dependency-snapshot');
      return;
    }
    // An exported copy has no server to analyze with: say so instead of
    // entering the send-retry loop below, which would spin forever.
    if (client()?.isOfflineExport?.()) {
      setStatus('This exported analysis is read-only: re-analysis needs the live CodeXR session.', true);
      return;
    }
    var connection = client();
    if (!connection?.sendMessage) {
      setStatus('Dependency analysis is unavailable: no collaboration channel.', true);
      return;
    }
    setTransitionLocked(true, 'Opening dependencies...');
    // The hop to selection is cosmetic; the server's authoritative
    // analysis-view broadcast is what really drives the scene into
    // dependency mode. A failed local transition must never swallow the
    // start message (start() is called as `void start()` — an escaped
    // rejection here is total silence in the scene).
    try {
      await root.CodeXRAnalysisModeRuntime?.changeAnalysis?.('selection', {
        reason: 'dependency-refresh'
      });
    } catch (error) {
      root.console?.warn?.('[CodeXR][DependencyGraph] selection hop failed; sending dependency-graph-start anyway.', error);
    }
    // send() drops silently while the socket is still connecting — retry
    // until it goes through. Gated on a send generation of its own (the
    // transition lock legitimately clears during the hop to selection).
    var sendGeneration = state.startSendGeneration = (state.startSendGeneration || 0) + 1;
    var attemptSend = function () {
      if (sendGeneration !== state.startSendGeneration) { return; }
      // Only an explicit `false` means "socket not ready, dropped" — clients
      // whose sendMessage returns nothing are treated as delivered.
      if (client()?.sendMessage?.('dependency-graph-start', {}) !== false) { return; }
      root.console?.warn?.('[CodeXR][DependencyGraph] collaboration socket not ready; retrying dependency-graph-start...');
      setTimeout(attemptSend, 500);
    };
    attemptSend();
  }
  async function reanalyze() {
    if (state.availability !== 'enabled' || state.transitionLocked) { return; }
    if (client()?.isOfflineExport?.()) {
      setStatus('This exported analysis is read-only: re-analysis needs the live CodeXR session.', true);
      return;
    }
    setTransitionLocked(true, 'Re-analyzing dependencies...');
    client()?.sendMessage?.('dependency-graph-start', { forceFull: true });
  }
  function selectDependencyMode() {
    if (activateReadySnapshot('local-dependency-mode-option')) {
      return;
    }
    root.console?.log?.('[CodeXR.Debug]: Dependency graph mode selected; starting dependency analysis', {
      hasDataset: !!state.dataset,
      availability: state.availability
    });
    void start();
  }
  async function openModeSelector() {
    return root.CodeXRAnalysisModeRuntime?.openSelector?.();
  }
  async function configureAvailability() {
    try {
      var info = await client()?.getSessionInfoAsync?.();
      state.availability = info?.capabilities?.dependencyGraph === true ? 'enabled' : 'disabled';
      state.unavailableReason = info?.capabilities?.dependencyGraphReason
        || 'Dependency graphs require an XR file, directory, or project analysis.';
    } catch {
      state.availability = 'disabled';
      state.unavailableReason = 'Dependency graph availability could not be checked.';
    }
    registerDependencyModeOption();
  }
  function registerDependencyModeOption() {
    state.unregisterMode?.();
    state.unregisterMode = root.CodeXRAnalysisModeRuntime?.registerModeOption?.({
      id: 'dependency-graph',
      label: 'Dependency graph',
      color: '#7c3aed',
      disabled: state.availability !== 'enabled',
      disabledReason: state.unavailableReason
        || 'Dependency graphs require an XR file, directory, or project analysis.',
      onSelect: selectDependencyMode
    }) || null;
  }
  function registerCollaboration() {
    var connection = client();
    state.disposables.push(connection?.onMessage?.('dependency-graph-progress', function (message) {
      setStatus(message?.payload?.message || 'Analyzing dependencies...', false);
    }));
    state.disposables.push(connection?.onMessage?.('dependency-graph-error', function (message) {
      root.console?.warn?.('[CodeXR][DependencyGraph] Server reported:', message?.payload?.message || 'Dependency analysis failed.');
      setStatus(message?.payload?.message || 'Dependency analysis failed.', true);
      setTransitionLocked(false);
    }));
    connection?.registerEntityRuntime?.({
      entityKind: ENTITY_KIND,
      entityId: ENTITY_ID,
      applySharedState: applySharedState,
      publishInitialSharedState: function () {}
    });
  }
  function mount(attempt) {
    buildPanel();
    if (!state.unregisterLifecycle && root.CodeXRAnalysisModeRuntime?.register) {
      state.unregisterLifecycle = root.CodeXRAnalysisModeRuntime.register('dependency-graph', {
        mappingContextId: null,
        activate: function () {
          state.active = true;
          state.viewGeneration += 1;
          parkOriginal();
          renderControls();
          if (state.dataset && state.snapshot?.status === 'ready') {
            renderGraph();
            setTransitionLocked(false);
            void applySharedState(state.snapshot);
            return;
          }
          if (state.snapshot) {
            return applySharedState(state.snapshot);
          }
        },
        deactivate: function () {
          disposeView();
        }
      });
    }
    if (!state.unregisterMode && root.CodeXRAnalysisModeRuntime?.registerModeOption) {
      registerDependencyModeOption();
    }
    if ((!refs.controls || !state.unregisterMode || !state.unregisterLifecycle) && attempt < 30) {
      setTimeout(function () { mount(attempt + 1); }, 100);
    }
  }
  function autoInit() {
    if (state.initialized || !doc()) { return; }
    state.initialized = true;
    registerComponent();
    mount(0);
    registerCollaboration();
    void configureAvailability();
  }
  root.CodeXRDependencyGraphRuntime = {
    autoInit: autoInit,
    start: start,
    openModeSelector: openModeSelector,
    applySharedState: applySharedState,
    resetView: resetView,
    openDirectory: openDirectory,
    openFile: openFile,
    getState: function () { return state; },
    __testing: {
      computeNiceScale: computeNiceScale,
      buildMetricScales: buildMetricScales,
      nodeDetailModel: nodeDetailModel,
      edgeDetailModel: edgeDetailModel,
      intensityBucket: intensityBucket,
      edgeStyle: edgeStyle,
      edgeEncodingLegend: edgeEncodingLegend,
      flowSizeOption: flowSizeOption,
      flowSpeedOption: flowSpeedOption,
      FLOW_SIZE_OPTIONS: FLOW_SIZE_OPTIONS,
      FLOW_SPEED_OPTIONS: FLOW_SPEED_OPTIONS,
      FLOW_DEFAULTS: FLOW_DEFAULTS,
      graphDensityStats: graphDensityStats,
      buildExternalSummaryDataset: buildExternalSummaryDataset,
      projectDirectoryScope: projectDirectoryScope,
      projectFileScope: projectFileScope,
      normalizeRelativePath: normalizeRelativePath,
      symbolVisual: symbolVisual,
      selectDependencyMode: selectDependencyMode
    },
    destroy: function () {
      state.disposables.forEach(function (dispose) { dispose?.(); });
      state.unregisterMode?.();
      state.unregisterPanel?.();
      state.unregisterLifecycle?.();
      state.unregisterLifecycle = null;
      clearRenderRetries();
      disposeView();
      state.initialized = false;
    }
  };
  if (doc()) {
    if (doc().readyState === 'loading') { doc().addEventListener('DOMContentLoaded', autoInit, { once: true }); }
    else { autoInit(); }
  }
})(typeof window !== 'undefined' ? window : this);
