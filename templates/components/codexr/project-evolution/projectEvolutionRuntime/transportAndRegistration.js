// == projectEvolutionRuntime.js | transportAndRegistration (assembled per manifest.json; see COMPONENTS.md) ==
  function play() {
    if (!state.result.frames.length) {
      setStatus('Generate a project evolution movie first.', 'error');
      return false;
    }
    state.playing = true;
    state.playbackGeneration += 1;
    render();
    updatePlaybackOverlay(state.result.frames[state.frameIndex], state.result.frames.length, true);
    void scheduleNext(state.playbackGeneration);
    return true;
  }

  function stop() {
    state.playing = false;
    state.playbackGeneration += 1;
    clearTimeout(state.timer);
    state.timer = null;
    hidePlaybackOverlay();
    render();
  }

  function togglePlay() {
    if (state.playing) {
      stop();
    } else {
      play();
    }
  }

  function nextFrame() {
    stop();
    return seek(state.frameIndex + 1);
  }

  function previousFrame() {
    stop();
    return seek(state.frameIndex - 1);
  }

  function setSpeed(speed) {
    state.speed = Number(speed) || 1;
    setStatus('Playback speed: ' + state.speed + 'x', 'info');
    if (state.playing) {
      state.playbackGeneration += 1;
      void scheduleNext(state.playbackGeneration);
    }
  }

  function registerCollaboration() {
    var runtimeClient = client();
    if (!runtimeClient) { return; }
    state.disposables.push(runtimeClient?.onMessage?.('project-evolution-references', handleReferences));
    state.disposables.push(runtimeClient?.onMessage?.('project-evolution-progress', handleProgress));
    state.disposables.push(runtimeClient?.onMessage?.('project-evolution-error', handleError));
    state.disposables.push(runtimeClient?.onMessage?.('project-evolution-frame-applied', handleFrameApplied));
    state.disposables.push(runtimeClient?.onMessage?.('project-evolution-cleared', function (message) {
      applyClearedState(unwrapPayload(message).message || 'Project evolution movie cleared.');
    }));
    runtimeClient?.registerEntityRuntime?.({
      entityKind: ENTITY_KIND,
      entityId: ENTITY_ID,
      applySharedState: applySharedState,
      publishInitialSharedState: function () {},
      handleCollaborationMessage: function (message) {
        if (message.type === 'entity-removed') {
          applyClearedState('Project evolution movie cleared.');
        }
      }
    });
  }

  function autoInit() {
    if (state.initialized || !doc()) { return; }
    state.initialized = true;
    state.unregisterLifecycle = root.CodeXRAnalysisModeRuntime?.register?.(MODE, {
      activate: function () {
        root.CodeXRAnalysisSurfaceRuntime?.activateMode?.(MODE);
        state.activeChartId = state.activeChartId || getDefaultChartId();
        root.CodeXRMappingUiRuntime?.switchMappingContext?.(MODE, { reason: 'project-evolution-ready' });
        var mappingState = root.CodeXRMappingUiRuntime?.getState?.() || {};
        if (mappingState.chartId !== state.activeChartId && root.CodeXRMappingUiRuntime?.selectChart) {
          root.CodeXRMappingUiRuntime?.selectChart(state.activeChartId);
        }
        root.CodeXRAnalysisControllerRuntime?.showView?.('project-evolution', {
          mode: MODE,
          reason: 'project-evolution-activate',
          mappingContextId: MODE
        }) || root.CodeXRMappingUiRuntime?.showPanelView?.(MODE);
        if (!state.references) {
          client()?.sendMessage?.('project-evolution-references-request', {});
        }
        if (!state.result) {
          clearChartVisualization();
          buildPanel();
          render();
          return true;
        }
        return seek(state.frameIndex);
      },
      deactivate: function () {
        stop();
        hidePlaybackOverlay();
      },
      disposeView: function () {
        stop();
        hidePlaybackOverlay();
      }
    }) || null;
    registerModeOption();
    buildPanel();
    void configureAvailability();
    registerCollaboration();
    doc().addEventListener?.('codexr-mapping-confirmed', onMappingConfirmed);
  }

  var runtime = {
    autoInit: autoInit,
    openSelection: openSelection,
    start: startSelectedTimeline,
    clear: clearMovie,
    play: play,
    pause: stop,
    seek: seek,
    __testing: {
      isHierarchicalBoatsChart: isHierarchicalBoatsChart,
      frameUrlWithCache: frameUrlWithCache,
      bridgeUrl: bridgeUrl,
      projectEvolutionContainmentProfile: projectEvolutionContainmentProfile,
      getActiveMappingForChart: getActiveMappingForChart
    },
    getState: function () {
      return {
        availability: state.availability,
        status: state.status,
        result: state.result,
        frameIndex: state.frameIndex,
        playing: state.playing,
        speed: state.speed
      };
    },
    destroy: function () {
      stop();
      state.disposables.forEach(function (dispose) { dispose?.(); });
      state.disposables = [];
      doc().removeEventListener?.('codexr-mapping-confirmed', onMappingConfirmed);
      state.unregisterModeOption?.();
      state.unregisterLifecycle?.();
      state.unregisterPanelView?.();
      if (refs.playbackOverlay.parentNode) {
        refs.playbackOverlay.parentNode.removeChild(refs.playbackOverlay);
      }
      state.initialized = false;
    }
  };

  if (doc()) {
    if (doc().readyState === 'loading') {
      doc().addEventListener('DOMContentLoaded', autoInit, { once: true });
    } else {
      autoInit();
    }
  }
  root.CodeXRProjectEvolutionRuntime = runtime;
})(typeof window !== 'undefined' ? window : this);
