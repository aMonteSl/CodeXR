// == projectEvolutionRuntime.js | playbackControlsAndMessages (assembled per manifest.json; see COMPONENTS.md) ==
  function render() {
    renderTimelineControls();
    // Result stays null until a movie is built; stop() renders during
    // deactivate/disposeView, so this runs for never-opened modes too.
    var frames = state.result?.frames || [];
    var frame = frames[state.frameIndex];
    updateNowShowing(frame, frames.length);
    renderTimelineBar(refs.timeline);
    renderSparkline();
    renderMovieCompanion();
    // The chart/axis controls follow playback: usable only when stopped.
    syncMappingControlsLock();
    // Sections are re-placed here because the range row folds in/out with the
    // timeline mode; the panel height follows it.
    if (refs.panel) {
      root.CodeXRMappingUiRuntime?.setPanelViewHeight?.(MODE, layoutPanel());
    }
    // render() runs before the panel exists (activate with no movie) and during
    // deactivate, so every node here is optional all the way down.
    refs.playButton?.querySelector?.('a-text')?.setAttribute?.('value', state.playing ? 'Pause' : 'Play');
  }

  function updateNowShowing(frame, frameCount) {
    if (!refs.frameTitle || !refs.frameDetail) { return; }
    if (!frameCount) {
      refs.frameTitle.setAttribute('value', 'Now showing');
      refs.frameDetail.setAttribute('value', 'No movie loaded');
      return;
    }
    var parts = splitSourceDescription(frame.source || frame);
    refs.frameTitle.setAttribute('value', 'Frame ' + (state.frameIndex + 1) + ' / ' + frameCount);
    refs.frameDetail.setAttribute('value', compact(parts.date + ' | ' + parts.label + (parts.subject ? ' - ' + parts.subject : ''), 72));
  }

  // Committer time as a sortable number: the precise epoch timestamp when the
  // server sends one, else the (day-granular) short date, else NaN. The short
  // date alone ties every same-day ref, which painted refs NEWER than the
  // range end as span.
  function sourceTimeKey(source) {
    var timestamp = Number(source?.timestamp);
    if (Number.isFinite(timestamp) && timestamp > 0) { return timestamp * 1000; }
    var parsed = Date.parse(String(source?.date || ''));
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  // A range ENDPOINT without a time can only be the working copy, which is
  // "now": Infinity sorts after every commit so the span up to Live still
  // paints. Only endpoints get this fallback — an undated row being TESTED is
  // the Live row itself, which is either an endpoint (coloured by id before
  // the span check) or genuinely outside a commit-ended range.
  function endpointTimeKey(source) {
    var time = sourceTimeKey(source);
    if (Number.isFinite(time)) { return time; }
    var isLive = source?.kind === 'workingCopy' || source?.revisionType === 'working-copy';
    return isLive ? Infinity : NaN;
  }

  // True when the source falls between the two picked range endpoints. Uses
  // committer times because the range is temporal; the endpoints themselves
  // (and refs aliasing their commit) are handled — and coloured — separately.
  function isInsideSelectedRange(source) {
    if (!state.startSourceId || !state.endSourceId) { return false; }
    var startTime = endpointTimeKey(findSource(state.startSourceId));
    var endTime = endpointTimeKey(findSource(state.endSourceId));
    var time = sourceTimeKey(source);
    if (!Number.isFinite(time) || isNaN(startTime) || isNaN(endTime)) { return false; }
    return time >= Math.min(startTime, endTime) && time <= Math.max(startTime, endTime);
  }

  // Per-row highlight/order for the shared picker: start/end (range), the
  // span between them, the click-order number (manual), or the suggested
  // order (auto).
  function resolveRowStateForSource(source) {
    if (!source) { return { selected: false }; }
    if (source.id === state.startSourceId) {
      return { selected: true, color: '#15803d' };
    }
    if (source.id === state.endSourceId) {
      return { selected: true, color: '#b91c1c' };
    }
    // A ref pointing AT an endpoint's commit (a branch/tag on the same sha,
    // e.g. the repo tip picked as end plus origin/master) IS that endpoint,
    // not span: its colour answers "why is this row marked".
    if (state.timelineMode === 'range' && source.commitSha) {
      if (source.commitSha === findSource(state.startSourceId)?.commitSha) {
        return { selected: true, color: '#15803d' };
      }
      if (source.commitSha === findSource(state.endSourceId)?.commitSha) {
        return { selected: true, color: '#b91c1c' };
      }
    }
    if (state.timelineMode === 'range' && isInsideSelectedRange(source)) {
      return { selected: true, color: '#b45309' };
    }
    var manualIndex = state.manualSourceIds.indexOf(source.id);
    if (manualIndex >= 0) {
      return { selected: true, color: '#7c3aed', orderLabel: String(manualIndex + 1) };
    }
    if (state.timelineMode === 'auto') {
      var autoOrder = getSuggestedAutoOrderById()[source.id];
      if (autoOrder) {
        return { selected: true, color: '#92400e', orderLabel: String(autoOrder) };
      }
    }
    return { selected: false };
  }

  // Panel buttons are only there once buildPanel ran; painting one that does not
  // exist must never throw (this runs from the mode's activate/deactivate).
  function paintButton(rootEntity, index, color) {
    rootEntity?.children?.[index]?.setAttribute?.(
      'material',
      'color: ' + color + '; opacity: 0.95; shader: flat'
    );
  }

  function renderTimelineControls() {
    if (!refs.picker) { return; }
    paintButton(refs.modeRoot, 0, state.timelineMode === 'auto' ? '#be123c' : '#334155');
    paintButton(refs.modeRoot, 1, state.timelineMode === 'range' ? '#be123c' : '#334155');
    paintButton(refs.modeRoot, 2, state.timelineMode === 'manual' ? '#be123c' : '#334155');
    refs.rangeRoot?.setAttribute?.('visible', state.timelineMode === 'range');
    paintButton(refs.rangeRoot, 0, state.rangeSide === 'start' ? '#16a34a' : '#14532d');
    paintButton(refs.rangeRoot, 1, state.rangeSide === 'end' ? '#dc2626' : '#7f1d1d');
    // Same active-speed highlight the companion shows, so both rows agree.
    paintSpeedRow(refs.speedRoot);
    var autoCount = Object.keys(getSuggestedAutoOrderById()).length;
    var info = state.timelineMode === 'auto'
      ? 'Auto: CodeXR samples ' + (autoCount || 'the') + ' timeline frames.'
      : state.timelineMode === 'range'
        ? 'Range: ' + state.rangeSide.toUpperCase() + ' | ' + sourceDescription(findSource(state.startSourceId)) + ' -> ' + sourceDescription(findSource(state.endSourceId))
        : 'Manual: ' + state.manualSourceIds.length + ' selected frames.';
    refs.info?.setAttribute('value', info);
    refs.picker.render();
  }

  function selectSourceForTimeline(source) {
    if (state.timelineMode === 'range') {
      if (state.rangeSide === 'end') {
        state.endSourceId = source.id;
      } else {
        state.startSourceId = source.id;
      }
      render();
      return;
    }
    if (state.timelineMode === 'manual') {
      if (state.manualSourceIds.includes(source.id)) {
        state.manualSourceIds = state.manualSourceIds.filter(function (id) { return id !== source.id; });
      } else {
        state.manualSourceIds.push(source.id);
      }
      render();
    }
  }

  function selectMode() {
    openSelection();
  }

  async function openSelection() {
    if (state.availability !== 'enabled') {
      setStatus(state.unavailableReason, 'error');
      return false;
    }
    buildPanel();
    root.CodeXRAnalysisModeRuntime?.setSelectionPanel?.(MODE);
    client()?.sendMessage?.('analysis-mode-activate', { mode: MODE });
    // Single entry path: no explicit controllerView/panelViewId — the mode's
    // resolveControllerView routes (Field Mapping when a movie exists, the
    // selection panel otherwise) and the lifecycle's activate shows it, so
    // the local transition and the server echo can never disagree.
    await root.CodeXRAnalysisModeRuntime?.transitionTo?.(MODE, {
      reason: 'project-evolution-selection'
    });
    // An exported copy cannot list git references or generate new movies:
    // replay the exported one and say so instead of requesting references.
    if (client()?.isOfflineExport?.()) {
      var frameCount = state.result?.frames?.length || 0;
      setStatus(
        frameCount
          ? 'Exported movie: play, pause and seek work here. Generating a new movie needs the live CodeXR session.'
          : 'No evolution movie was generated before this export: generating one needs the live CodeXR session.',
        frameCount ? 'info' : 'error'
      );
      return true;
    }
    setStatus('Loading project timeline...', 'info');
    if (!client()?.sendMessage?.('project-evolution-references-request', {})) {
      setStatus('Collaboration connection is not ready.', 'error');
    }
    return true;
  }

  function startSelectedTimeline() {
    if (client()?.isOfflineExport?.()) {
      setStatus('This export replays the movie generated before export: a new movie needs the live CodeXR session.', 'error');
      return;
    }
    var request = {
      mode: state.timelineMode,
      maxFrames: Number(state.references.maxFrames || 24)
    };
    if (state.timelineMode === 'range') {
      request.startSourceId = state.startSourceId;
      request.endSourceId = state.endSourceId;
      if (!request.startSourceId || !request.endSourceId) {
        setStatus('Choose start and end commits for the range.', 'error');
        return;
      }
    }
    if (state.timelineMode === 'manual') {
      request.sourceIds = state.manualSourceIds.slice();
      if (request.sourceIds.length < 1) {
        setStatus('Select at least one commit for the manual movie.', 'error');
        return;
      }
    }
    setStatus('Analyzing project evolution. Please wait...', 'info');
    state.preparedChartIds = {};
    clearChartVisualization();
    client()?.sendMessage?.('project-evolution-start', request);
  }

  function clearMovie() {
    // Clearing deletes server-side files; offline it would only wipe the
    // replay this export exists to provide.
    if (client()?.isOfflineExport?.()) {
      setStatus('This exported movie is replay-only: it cannot be cleared or regenerated here.', 'error');
      return;
    }
    stop();
    setStatus('Clearing project evolution movie...', 'info');
    if (!client()?.sendMessage?.('project-evolution-clear', {})) {
      applyClearedState('Project evolution movie cleared locally.');
    }
  }

  function handleReferences(message) {
    var payload = unwrapPayload(message);
    state.references = payload || null;
    refs.picker?.setReferences(state.references);
    var count = (refs.picker?.getVisibleSources?.() || []).filter(function (source) {
      return source && source.kind === 'gitRef';
    }).length;
    setStatus(count ? 'Ready to generate ' + count + ' timeline frames.' : 'No commits available for evolution.', count ? 'info' : 'error');
    render();
  }

  function handleProgress(message) {
    var payload = unwrapPayload(message);
    if (!payload) { return; }
    setStatus(payload.message || '', payload.state === 'error' ? 'error' : 'info');
    // Drives both the progress bar and whether the panel reserves room for it.
    state.generating = payload.state === 'analyzing' && Number(payload.frameCount) > 0;
    renderGenerationProgress(payload);
    render();
  }

  function handleError(message) {
    var payload = unwrapPayload(message);
    state.pendingFrameApply?.reject?.(new Error(payload.message || 'Project evolution failed.'));
    state.pendingFrameApply = null;
    stop();
    setStatus(payload.message || 'Project evolution failed.', 'error');
  }
