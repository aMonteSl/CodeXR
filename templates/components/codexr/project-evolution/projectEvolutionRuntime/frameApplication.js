// == projectEvolutionRuntime.js | frameApplication (assembled per manifest.json; see COMPONENTS.md) ==
  function handleFrameApplied(message) {
    var payload = unwrapPayload(message);
    if (
      !payload
      || !state.result
      || Number(payload.revision) !== Number(state.result.revision)
    ) {
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
    var viewGeneration = state.viewGeneration;
    if (!isEvolutionViewCurrent(viewGeneration)) {
      return;
    }
    void applyBridgeFrameToChart(frames[state.frameIndex], payload.bridgeUrl, viewGeneration).then(function (applied) {
      if (!applied || !isEvolutionViewCurrent(viewGeneration)) {
        return;
      }
      render();
      updatePlaybackOverlay(frames[state.frameIndex], frames.length, state.playing);
    });
  }

  function isEvolutionModeActiveOrActivating() {
    var modeState = root.CodeXRAnalysisModeRuntime?.getState?.();
    if (modeState?.transitioning) {
      return modeState?.pendingTransitionMode === MODE;
    }
    return modeState?.mode === MODE;
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
    var previousRevision = Number(state.result?.revision || 0);
    state.result = shared.result;
    state.frameIndex = 0;
    if (previousRevision && previousRevision !== Number(shared.result.revision || 0)) {
      releaseEvolutionVisualization();
    }
    if (!isEvolutionModeActiveOrActivating()) {
      return;
    }
    setStatus('Project evolution ready.', 'info');
    // Already in (or entering) evolution: reroute from the selection panel to
    // the movie view and land on the first frame. resolveControllerView picks
    // the view, so the local transition and the server echo cannot disagree.
    var transition = changeToEvolutionAnalysis({ reason: 'project-evolution-ready' });
    void Promise.resolve(transition).then(function () {
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

  function releaseEvolutionVisualization() {
    state.dataRefreshGeneration += 1;
    releaseEvolutionChart();
    root.CodeXRMappingUiRuntime?.releaseChartEntity?.(refs.evolutionTreeBuilder);
    detachEvolutionNode(refs.frameNameplate);
    detachEvolutionNode(refs.evolutionDataSource);
    detachEvolutionNode(refs.evolutionRoot);
    refs.frameNameplate = null;
    refs.evolutionRoot = null;
    refs.evolutionDataSource = null;
    refs.evolutionTreeBuilder = null;
    state.appliedFrameIndex = -1;
    state.appliedResultRevision = 0;
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
      refs.frameNameplate.setAttribute?.('id', 'codexrProjectEvolutionFrameNameplate');
      refs.frameNameplate.setAttribute?.(
        'data-codexr-role',
        'project-evolution auxiliary'
      );
      doc().querySelector?.('a-scene')?.appendChild?.(refs.frameNameplate);
      return;
    }
    picker.setSourceNameplate?.(refs.frameNameplate, source, '#f59e0b');
    setNodeVisible(refs.frameNameplate, true);
  }

  function clearChartVisualization() {
    var ownedPrimaryAnalysis = isEvolutionModeActiveOrActivating();
    releaseEvolutionVisualization();
    if (state.pendingFrameApply?.requestId) {
      state.supersededFrameApplyIds[state.pendingFrameApply?.requestId] = true;
    }
    state.pendingFrameApply?.reject?.(Object.assign(new Error('Project evolution movie cleared.'), {
      code: 'project-evolution-cleared'
    }));
    state.pendingFrameApply = null;
    if (ownedPrimaryAnalysis) {
      root.CodeXRMappingUiRuntime?.setChartEntityIds?.([], { renormalize: false });
    }
  }

  function applyClearedState(message) {
    invalidateEvolutionView('project-evolution-cleared');
    stop();
    state.result = null;
    state.frameIndex = 0;
    state.playbackMappingSnapshot = null;
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
    return true;
  }

  // A confirmed chart/axis change reconfigures only the persistent chart.
  // The datasource URL, bridge payload and frame index stay untouched.
  function onMappingConfirmed() {
    if (state.playing) {
      if (state.playbackMappingSnapshot) {
        root.CodeXRMappingUiRuntime?.restoreState?.(
          state.playbackMappingSnapshot,
          { applyToEntities: false, forceWhenLocked: true }
        );
      }
      setStatus('Playback running - pause to change chart or axes.', 'info');
      render();
      return;
    }
    if (!(state.result?.frames || []).length) {
      syncActiveChartFromMapping();
      return;
    }
    if (state.applyingMapping) {
      return;
    }
    stop();
    setMappingApplying(true);
    var chartChanged = syncActiveChartFromMapping();
    Promise.resolve(applyEvolutionChartSelection(chartChanged, state.viewGeneration))
      .catch(function () { /* seek reports its own failure through the status */ })
      .then(function (applied) {
        if (applied) {
          state.playbackMappingSnapshot = root.CodeXRMappingUiRuntime?.getState?.() || null;
        }
        setMappingApplying(false);
      });
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

  function isHierarchicalBoatsChart(chartId, componentName) {
    return chartId === 'boats'
      || componentName === 'babia-boats';
  }
