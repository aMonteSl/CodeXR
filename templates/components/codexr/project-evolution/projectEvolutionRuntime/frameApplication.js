// == projectEvolutionRuntime.js | frameApplication (assembled per manifest.json; see COMPONENTS.md) ==
  function handleFrameApplied(message) {
    var payload = unwrapPayload(message);
    if (!payload || Number(payload.revision) !== Number(state.result.revision)) {
      return;
    }
    var frames = state.result.frames || [];
    var frameIndex = Math.max(0, Math.min(frames.length - 1, Number(payload.frameIndex) || 0));
    var pending = state.pendingFrameApply;
    if (payload.requestId && state.supersededFrameApplyIds[payload.requestId]) {
      delete state.supersededFrameApplyIds[payload.requestId];
      return;
    }
    if (
      pending
      && payload.requestId
      && pending.requestId
      && payload.requestId !== pending.requestId
    ) {
      return;
    }
    if (
      pending
      && Number(pending.revision) === Number(payload.revision)
      && Number(pending.frameIndex) === frameIndex
    ) {
      state.pendingFrameApply = null;
      pending.resolve(payload);
      return;
    }
    state.frameIndex = frameIndex;
    void applyBridgeFrameToChart(frames[state.frameIndex], payload.bridgeUrl).then(function () {
      render();
      updatePlaybackOverlay(frames[state.frameIndex], frames.length, state.playing);
    });
  }

  function isEvolutionModeActiveOrActivating() {
    var modeState = root.CodeXRAnalysisModeRuntime?.getState?.();
    return modeState?.mode === MODE
      || (modeState?.transitioning && modeState?.requestedMode === MODE);
  }

  // Mode-data entities are PASSIVE: receiving a movie result must never steal
  // the table from whatever mode the participant is in. Only the authoritative
  // `analysis-view` entity (or an explicit user action) changes the active
  // mode — the server publishes it when a generation completes, and the mode
  // lifecycle's activate() renders from the result stored here. Same contract
  // as the historical and dependency runtimes; new modes must follow it too
  // (see COMPONENTS.md). The unconditional transition that used to live here
  // hijacked the scene on room-snapshot replays and in exported copies.
  function applySharedState(shared) {
    if (!shared || shared.entityKind !== ENTITY_KIND || !shared.result) {
      return;
    }
    state.result = shared.result;
    state.frameIndex = 0;
    state.preparedChartIds = {};
    if (!isEvolutionModeActiveOrActivating()) {
      return;
    }
    setStatus('Project evolution ready.', 'info');
    // Already in (or entering) evolution: reroute from the selection panel to
    // the movie view and land on the first frame. resolveControllerView picks
    // the view, so the local transition and the server echo cannot disagree.
    void root.CodeXRAnalysisModeRuntime?.transitionTo?.(MODE, {
      reason: 'project-evolution-ready'
    }).then(function () {
      return seek(0);
    });
  }

  // Safe to call cold (no movie built yet) and repeatedly: this runs from the
  // mode's activate() on every entry without a result, so anything that throws
  // here aborts the transition and bounces the user back to the analysis
  // selector. The refs start out undefined (`var refs = {}`), so each node is
  // detached only if it is actually mounted.
  function detachEvolutionNode(node) {
    node?.parentNode?.removeChild?.(node);
  }

  // Table-edge plate naming the commit on screen — the same shared plate the
  // historical comparison uses for its two sides, so both Git analyses label
  // the table identically. Created once, updated by attribute.
  function updateFrameNameplate(frame) {
    var picker = root.CodeXRGitRefPickerRuntime;
    var source = frame?.source || frame;
    if (!picker?.createSourceNameplate || !source) { return; }
    if (!refs.frameNameplate) {
      var zone = root.CodeXRAnalysisTableRuntime?.getAnalysisTableZones?.('project-evolution')?.[0]
        || { anchorX: 0, anchorZ: -18, depth: 3.2 };
      refs.frameNameplate = picker.createSourceNameplate(source, zone, '#f59e0b');
      var mounted = refs.evolutionPlaybackRoot || doc()?.querySelector('a-scene');
      mounted?.appendChild?.(refs.frameNameplate);
      return;
    }
    picker.setSourceNameplate?.(refs.frameNameplate, source, '#f59e0b');
    setNodeVisible(refs.frameNameplate, true);
  }

  function clearChartVisualization() {
    detachEvolutionNode(refs.frameNameplate);
    refs.frameNameplate = null;
    // Unsubscribe before hiding: a Babia chart component keeps its data
    // subscription after removal, so a discarded movie chart repaints itself
    // on the next push and shows through as leftover geometry.
    root.CodeXRMappingUiRuntime?.releaseChartEntity?.(refs.evolutionChart);
    getChartEntities().forEach(function (chart) {
      chart?.setAttribute?.('visible', false);
    });
    detachEvolutionNode(refs.evolutionFrameRoot);
    detachEvolutionNode(refs.evolutionPlaybackRoot);
    detachEvolutionNode(refs.evolutionDataSource);
    detachEvolutionNode(refs.evolutionTreeBuilder);
    refs.evolutionFrameRoot = null;
    refs.evolutionPlaybackRoot = null;
    refs.evolutionChart = null;
    refs.evolutionDataSource = null;
    refs.evolutionTreeBuilder = null;
    state.chartDataSignature = '';
    state.dataRefreshGeneration += 1;
    if (state.pendingFrameApply?.requestId) {
      state.supersededFrameApplyIds[state.pendingFrameApply?.requestId] = true;
    }
    state.pendingFrameApply?.reject?.(Object.assign(new Error('Project evolution movie cleared.'), {
      code: 'project-evolution-cleared'
    }));
    state.pendingFrameApply = null;
    root.CodeXRMappingUiRuntime?.setChartEntityIds?.([]);
    root.CodeXRAnalysisTableRuntime?.renormalizeAll?.('project-evolution-cleared');
  }

  function applyClearedState(message) {
    stop();
    state.result = null;
    state.frameIndex = 0;
    state.preparedChartIds = {};
    clearChartVisualization();
    hidePlaybackOverlay();
    updateNowShowing(null, 0);
    setStatus(message || 'Project evolution movie cleared.', 'info');
    render();
  }

  function getChartEntities() {
    return refs.evolutionChart?.isConnected === false || !refs.evolutionChart
      ? []
      : [refs.evolutionChart];
  }

  function getDefaultChartId() {
    // Boats is the mode's identity chart. config().chartId is the chart the
    // NORMAL analysis scene was created with — preferring it opened the movie
    // as a pie when the scene was a pie. Fall back to it only when the scene
    // has no boats template.
    var toolingConfig = config();
    var hasBoats = Array.isArray(toolingConfig.availableCharts)
      && toolingConfig.availableCharts.some(function (chart) { return chart && chart.id === 'boats'; });
    return hasBoats ? 'boats' : (toolingConfig.chartId || 'boats');
  }

  function getActiveChartId() {
    return state.activeChartId || getDefaultChartId();
  }

  function getDefaultMappingForChart(chartId) {
    var defaults = config().defaultMappingsByChart || {};
    return Object.assign({}, defaults[chartId] || {});
  }

  function getActiveMappingForChart(chartId) {
    var mappingState = root.CodeXRMappingUiRuntime?.getState?.() || {};
    var defaultMapping = getDefaultMappingForChart(chartId);
    var liveMapping = mappingState.mappingContextId === MODE && mappingState.chartId === chartId
      ? (mappingState.lastKnownGoodMapping || mappingState.selectedByDimension || {})
      : {};
    return Object.assign({}, defaultMapping, liveMapping);
  }

  function syncActiveChartFromMapping() {
    var mappingState = root.CodeXRMappingUiRuntime?.getState?.() || {};
    if (mappingState.mappingContextId !== MODE || !mappingState.chartId) {
      return false;
    }
    if (mappingState.chartId === state.activeChartId) {
      return false;
    }
    state.activeChartId = mappingState.chartId;
    state.preparedChartIds = {};
    if (state.result.frames.length) {
      void seek(state.frameIndex);
    }
    return true;
  }

  // A confirmed chart/axis change re-applies the current frame. Playback and
  // seeking stay locked until the frame is stable again, so the user cannot
  // start a movie on top of a half-applied chart.
  function onMappingConfirmed() {
    if (!(state.result?.frames || []).length) {
      syncActiveChartFromMapping();
      return;
    }
    stop();
    setMappingApplying(true);
    var applied = syncActiveChartFromMapping();
    var settle = applied ? Promise.resolve() : seek(state.frameIndex);
    Promise.resolve(settle)
      .catch(function () { /* seek reports its own failure through the status */ })
      .then(function () { setMappingApplying(false); });
  }

  // Single source of truth for the "chart change in flight" lock.
  function setMappingApplying(applying) {
    state.applyingMapping = !!applying;
    setStatus(applying ? 'Applying chart change...' : '', applying ? 'info' : 'info');
    render();
    if (!state.applyingMapping) {
      // The lock that may have deferred a leave/return resume is gone.
      tryResumePlayback();
    }
  }

  // The chart/axis controls are only safe to use while the movie is stopped.
  function syncMappingControlsLock() {
    var locked = state.playing;
    root.CodeXRMappingUiRuntime?.setMappingControlsEnabled?.(
      !locked,
      locked ? 'Playback running - pause to change chart or axes.' : ''
    );
  }

  // Best-effort source of DECORATIVE attributes (class, cursor hooks, custom
  // components the scene template added) for the movie chart. Never a
  // requirement: this used to be `getTemplateChart` and the movie could not be
  // built without it, but the lookup is by DOM attribute and the mapping UI's
  // removeAttribute wipes the only real `[babia-*]` on the first chart switch —
  // after that every chart failed to build ("no chart detected").
  function getChartStyleSource(chartId) {
    var document = doc();
    var cfg = config();
    var componentName = COMPONENT_BY_CHART[chartId] || '';
    var ids = Array.isArray(cfg.chartEntityIds) && cfg.chartEntityIds.length
      ? cfg.chartEntityIds
      : [cfg.chartEntityId, cfg.chartId];
    for (var index = 0; index < ids.length; index += 1) {
      var candidate = ids[index] ? document.getElementById?.(ids[index]) : null;
      if (candidate) {
        return candidate;
      }
    }
    return document.querySelector?.('[data-codexr-normal-root="true"] [' + componentName + ']')
      || document.querySelector?.('[' + componentName + ']')
      || null;
  }

  function isHierarchicalBoatsChart(chartId, componentName) {
    return chartId === 'boats'
      || componentName === 'babia-boats';
  }
