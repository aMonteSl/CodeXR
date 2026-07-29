// == projectEvolutionRuntime.js | transportAndRegistration (assembled per manifest.json; see COMPONENTS.md) ==
  function play() {
    if (!isEvolutionViewCurrent(state.viewGeneration)) {
      return false;
    }
    if (!state.result?.frames?.length) {
      setStatus('Generate a project evolution movie first.', 'error');
      return false;
    }
    // Safety: never start a movie while a chart/axis change is still landing.
    if (state.applyingMapping) {
      setStatus('Applying chart change - playback starts when it settles.', 'info');
      return false;
    }
    state.playbackMappingSnapshot = root.CodeXRMappingUiRuntime?.getState?.() || null;
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
    // Otherwise the last "Next frame in Ns" stays frozen on the companion.
    state.nextFrameSeconds = 0;
    hidePlaybackOverlay();
    render();
  }

  function togglePlay() {
    if (state.playing) {
      // A deliberate pause also cancels any pending auto-resume, so playback
      // never restarts behind the user's back once a lock releases.
      state.resumePlayback = false;
      stop();
    } else {
      play();
    }
  }

  // Resume playback saved by releaseEvolutionOnLeave — but only when nothing
  // holds the safety lock. Re-entering the mode re-applies the chart mapping,
  // which raises `applyingMapping`; a one-shot play() here was silently
  // rejected by that lock, so the flag stays set and setMappingApplying(false)
  // retries once the change settles.
  function tryResumePlayback() {
    if (!state.resumePlayback) { return; }
    if (state.applyingMapping || state.playing || !(state.result?.frames || []).length) { return; }
    state.resumePlayback = false;
    play();
  }

  function nextFrame() {
    if (state.applyingMapping || !isEvolutionViewCurrent(state.viewGeneration)) { return false; }
    stop();
    return seek(state.frameIndex + 1);
  }

  function previousFrame() {
    if (state.applyingMapping || !isEvolutionViewCurrent(state.viewGeneration)) { return false; }
    stop();
    return seek(state.frameIndex - 1);
  }

  function setSpeed(speed) {
    state.speed = Number(speed) || 1;
    setStatus('Playback speed: ' + state.speed + 'x', 'info');
    // Repaints both speed rows (panel + companion) so they show which speed
    // the movie is actually running at.
    render();
    if (state.playing) {
      state.playbackGeneration += 1;
      void scheduleNext(state.playbackGeneration);
    }
  }

  function isEvolutionViewCurrent(viewGeneration) {
    if (Number(viewGeneration) !== Number(state.viewGeneration)) {
      return false;
    }
    var modeState = root.CodeXRAnalysisModeRuntime?.getState?.() || {};
    if (modeState.transitioning) {
      return modeState.pendingTransitionMode === MODE;
    }
    return modeState.mode === MODE;
  }

  function invalidateEvolutionView(reason) {
    state.viewGeneration += 1;
    state.dataRefreshGeneration += 1;
    cancelEvolutionDataTransition(reason || 'project-evolution-view-released');
    if (state.pendingFrameApply?.requestId) {
      state.supersededFrameApplyIds[state.pendingFrameApply.requestId] = true;
    }
    state.pendingFrameApply?.reject?.(Object.assign(
      new Error(reason || 'project-evolution-view-released'),
      { code: reason || 'project-evolution-view-released' }
    ));
    state.pendingFrameApply = null;
    return state.viewGeneration;
  }

  function captureEvolutionState() {
    return {
      resultRevision: Number(state.result?.revision || 0),
      frameIndex: state.frameIndex,
      resumePlayback: state.resumePlayback || state.playing,
      speed: state.speed,
      activeChartId: state.activeChartId,
      timelineMode: state.timelineMode,
      rangeSide: state.rangeSide,
      startSourceId: state.startSourceId,
      endSourceId: state.endSourceId,
      manualSourceIds: state.manualSourceIds.slice()
    };
  }

  function restoreEvolutionState(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') {
      return;
    }
    state.speed = Number(snapshot.speed) || state.speed;
    state.activeChartId = snapshot.activeChartId || state.activeChartId;
    state.timelineMode = snapshot.timelineMode || state.timelineMode;
    state.rangeSide = snapshot.rangeSide === 'end' ? 'end' : 'start';
    state.startSourceId = String(snapshot.startSourceId || '');
    state.endSourceId = String(snapshot.endSourceId || '');
    state.manualSourceIds = Array.isArray(snapshot.manualSourceIds)
      ? snapshot.manualSourceIds.slice()
      : [];
    if (
      state.result
      && Number(state.result.revision || 0) === Number(snapshot.resultRevision || 0)
    ) {
      state.frameIndex = Math.max(
        0,
        Math.min((state.result.frames || []).length - 1, Number(snapshot.frameIndex) || 0)
      );
      state.resumePlayback = !!snapshot.resumePlayback;
    }
  }

  // Leaving the mode, per scenario: a generation in flight is CANCELLED and
  // everything cleaned (the server aborts its workers on project-evolution-clear
  // and broadcasts -cleared, which resets the local state too); a generated
  // movie is paused, remembering whether it was playing so re-entry resumes it.
  function releaseEvolutionOnLeave() {
    invalidateEvolutionView('project-evolution-view-released');
    if (state.generating) {
      state.generating = false;
      renderGenerationProgress({ state: 'idle' });
      clearMovie();
    } else {
      state.resumePlayback = state.resumePlayback || state.playing;
    }
    stop();
    root.CodeXRAnalysisSurfaceRuntime?.preserveModeRoots?.(MODE);
    setNodeVisible(refs.frameNameplate, false);
    root.CodeXRMappingUiRuntime?.setMappingControlsEnabled?.(true, '');
    hidePlaybackOverlay();
    // Hand the chart entity targeting back to the scene: while a movie is
    // loaded the override points at the evolution chart, and leaving it in
    // place made the NORMAL analysis' chart switches and mapping applies land
    // on the parked movie chart. Re-entry re-claims it on the next frame
    // apply.
    root.CodeXRMappingUiRuntime?.setChartEntityIds?.([], { renormalize: false });
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
      mappingContextId: MODE,
      captureState: captureEvolutionState,
      restoreState: function (activation) {
        if (activation?.token?.isCurrent && !activation.token.isCurrent()) {
          return;
        }
        restoreEvolutionState(activation?.savedState);
      },
      activate: function (activation) {
        if (activation?.token?.isCurrent && !activation.token.isCurrent()) {
          return false;
        }
        state.viewGeneration += 1;
        var viewGeneration = state.viewGeneration;
        root.CodeXRAnalysisSurfaceRuntime?.activateMode?.(MODE);
        state.activeChartId = state.activeChartId || getDefaultChartId();
        var mappingState = root.CodeXRMappingUiRuntime?.getState?.() || {};
        if (mappingState.chartId !== state.activeChartId && root.CodeXRMappingUiRuntime?.selectChart) {
          // UI-only: the movie pipeline applies the chart to ITS entity when
          // a frame lands. A full switch here ran while the resolved chart
          // ids still pointed at the parked NORMAL chart and converted it.
          root.CodeXRMappingUiRuntime?.selectChart(state.activeChartId, { applyToEntities: false });
        }
        // Same route the resolver below picks: with a movie, land on the
        // Field Mapping view (chart/axes left, movie companion right) —
        // without one, on the timeline selection panel.
        var activateView = state.result ? 'project-evolution.mapping' : 'project-evolution';
        root.CodeXRAnalysisControllerRuntime?.showView?.(activateView, {
          mode: MODE,
          reason: 'project-evolution-activate',
          mappingContextId: MODE
        }) || root.CodeXRMappingUiRuntime?.showPanelView?.(state.result ? 'mapping' : MODE);
        if (!state.references) {
          client()?.sendMessage?.('project-evolution-references-request', {});
        }
        if (!state.result) {
          clearChartVisualization();
          buildPanel();
          render();
          return true;
        }
        // Reclaim the preserved surface immediately. The bridge refresh below
        // may take several seconds, but the already-rendered frame is valid
        // saved state and must be visible as soon as the mode owns the table.
        var currentFrame = state.result.frames?.[state.frameIndex];
        if (currentFrame && refs.evolutionRoot) {
          ensureEvolutionRoot(currentFrame);
          refs.evolutionChart.setAttribute?.('visible', true);
          root.CodeXRMappingUiRuntime?.setChartEntityIds?.(
            getChartEntities().map(function (chart) { return chart.id; }).filter(Boolean),
            { renormalize: false }
          );
          updateFrameNameplate(currentFrame);
          updatePlaybackOverlay(currentFrame, state.result.frames.length, false);
        }
        // A preserved pipeline already represents this exact frame. Re-entry
        // remounts it without a server request or datasource refresh.
        var hasPreservedFrame = !!(
          refs.evolutionRoot
          && refs.evolutionDataSource
          && refs.evolutionTreeBuilder
          && refs.evolutionChart
          && Number(state.appliedResultRevision) === Number(state.result.revision)
          && Number(state.appliedFrameIndex) === Number(state.frameIndex)
        );
        var activation = hasPreservedFrame
          ? Promise.resolve(waitForEvolutionContainmentStable(viewGeneration))
          : Promise.resolve(seek(state.frameIndex, viewGeneration));
        return activation.then(function (applied) {
          if (!isEvolutionViewCurrent(viewGeneration)) {
            return false;
          }
          if (applied) {
            tryResumePlayback();
          } else {
            state.resumePlayback = false;
          }
          return applied;
        });
      },
      deactivate: function () {
        releaseEvolutionOnLeave();
      },
      // With a generated movie the mode lives on the Field Mapping view
      // (mapping controls + movie companion); otherwise on its selection
      // panel. getDefaultControllerViewForMode and the authoritative server
      // echo both consult this, so local and echoed routing cannot disagree
      // — same contract as historical-compare.
      resolveControllerView: function () {
        return state.result ? 'project-evolution.mapping' : 'project-evolution';
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
      getActiveMappingForChart: getActiveMappingForChart,
      getSuggestedAutoOrderById: getSuggestedAutoOrderById,
      // Declarative chart construction is exercised directly so the movie
      // cannot regress to cloning the parked Single chart.
      buildEvolutionChart: buildEvolutionChart,
      namespaceEvolutionTreeNodes: namespaceEvolutionTreeNodes,
      getDefaultChartId: getDefaultChartId,
      releaseEvolutionVisualization: releaseEvolutionVisualization,
      // The passive-entity contract (a movie snapshot must never steal the
      // table from another mode) is asserted by CALLING this, not by reading
      // its source.
      applySharedState: applySharedState,
      // Offline movie generation from exported git payloads: asserted by
      // building frames for each timeline mode, not by reading source.
      buildOfflineFrames: buildOfflineFrames,
      synthesizeOfflineEvolutionReferences: synthesizeOfflineEvolutionReferences
    },
    getState: function () {
      return {
        availability: state.availability,
        status: state.status,
        result: state.result,
        frameIndex: state.frameIndex,
        playing: state.playing,
        speed: state.speed,
        // Interlock observability: which safety state is holding playback.
        generating: state.generating,
        applyingMapping: state.applyingMapping,
        resumePlayback: state.resumePlayback,
        appliedFrameIndex: state.appliedFrameIndex,
        appliedResultRevision: state.appliedResultRevision
      };
    },
    destroy: function () {
      stop();
      releaseEvolutionVisualization();
      state.disposables.forEach(function (dispose) { dispose?.(); });
      state.disposables = [];
      doc().removeEventListener?.('codexr-mapping-confirmed', onMappingConfirmed);
      state.unregisterModeOption?.();
      state.unregisterLifecycle?.();
      state.unregisterPanelView?.();
      state.unregisterMappingCompanion?.();
      state.unregisterMappingCompanion = null;
      refs.companionRoot = null;
      // The overlay only exists once playback has run at least once.
      refs.playbackOverlay?.parentNode?.removeChild?.(refs.playbackOverlay);
      refs.playbackOverlay = null;
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
