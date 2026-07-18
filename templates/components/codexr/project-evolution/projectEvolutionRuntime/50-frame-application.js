// == projectEvolutionRuntime.js | part 50: frame-application (assembled with its siblings; see COMPONENTS.md) ==
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

  function applySharedState(shared) {
    if (!shared || shared.entityKind !== ENTITY_KIND || !shared.result) {
      return;
    }
    state.result = shared.result;
    state.frameIndex = 0;
    state.preparedChartIds = {};
    setStatus('Project evolution ready.', 'info');
    client().sendMessage?.('analysis-mode-activate', { mode: MODE });
    void root.CodeXRAnalysisModeRuntime.transitionTo?.(MODE, {
      reason: 'project-evolution-ready',
      panelViewId: MODE
    }).then(function () {
      return seek(0);
    });
  }

  function clearChartVisualization() {
    getChartEntities().forEach(function (chart) {
      chart.setAttribute?.('visible', false);
    });
    refs.evolutionFrameRoot.parentNode.removeChild?.(refs.evolutionFrameRoot);
    refs.evolutionPlaybackRoot.parentNode.removeChild?.(refs.evolutionPlaybackRoot);
    refs.evolutionDataSource.parentNode.removeChild?.(refs.evolutionDataSource);
    refs.evolutionTreeBuilder.parentNode.removeChild?.(refs.evolutionTreeBuilder);
    refs.evolutionFrameRoot = null;
    refs.evolutionPlaybackRoot = null;
    refs.evolutionChart = null;
    refs.evolutionDataSource = null;
    refs.evolutionTreeBuilder = null;
    state.chartDataSignature = '';
    state.dataRefreshGeneration += 1;
    if (state.pendingFrameApply.requestId) {
      state.supersededFrameApplyIds[state.pendingFrameApply.requestId] = true;
    }
    state.pendingFrameApply.reject?.(Object.assign(new Error('Project evolution movie cleared.'), {
      code: 'project-evolution-cleared'
    }));
    state.pendingFrameApply = null;
    root.CodeXRMappingUiRuntime.setChartEntityIds?.([]);
    root.CodeXRAnalysisTableRuntime.renormalizeAll?.('project-evolution-cleared');
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
    return refs.evolutionChart.isConnected === false || !refs.evolutionChart
      ? []
      : [refs.evolutionChart];
  }

  function getDefaultChartId() {
    return config().chartId || 'boats';
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
    var mappingState = root.CodeXRMappingUiRuntime.getState?.() || {};
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

  function onMappingConfirmed() {
    syncActiveChartFromMapping();
  }

  function getTemplateChart(chartId) {
    var document = doc();
    var cfg = config();
    var componentName = COMPONENT_BY_CHART[chartId] || '';
    var ids = Array.isArray(cfg.chartEntityIds) && cfg.chartEntityIds.length
      ? cfg.chartEntityIds
      : [cfg.chartEntityId, cfg.chartId];
    for (var index = 0; index < ids.length; index += 1) {
      var candidate = ids[index] ? document.getElementById?.(ids[index]) : null;
      if (candidate?.hasAttribute?.(componentName)) {
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
