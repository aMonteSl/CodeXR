// == projectEvolutionRuntime.js | playbackControlsAndMessages (assembled per manifest.json; see COMPONENTS.md) ==
  function render() {
    renderTimelineControls();
    var frames = state.result.frames || [];
    var frame = frames[state.frameIndex];
    updateNowShowing(frame, frames.length);
    refs.playButton?.querySelector('a-text').setAttribute?.('value', state.playing ? 'Pause' : 'Play');
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

  function renderTimelineControls() {
    if (!refs.referencesRoot) { return; }
    refs.modeRoot.children[0].setAttribute?.('material', 'color: ' + (state.timelineMode === 'auto' ? '#be123c' : '#334155') + '; opacity: 0.95; shader: flat');
    refs.modeRoot.children[1].setAttribute?.('material', 'color: ' + (state.timelineMode === 'range' ? '#be123c' : '#334155') + '; opacity: 0.95; shader: flat');
    refs.modeRoot.children[2].setAttribute?.('material', 'color: ' + (state.timelineMode === 'manual' ? '#be123c' : '#334155') + '; opacity: 0.95; shader: flat');
    refs.rangeRoot?.setAttribute('visible', state.timelineMode === 'range');
    refs.rangeRoot.children[0].setAttribute?.('material', 'color: ' + (state.rangeSide === 'start' ? '#16a34a' : '#14532d') + '; opacity: 0.95; shader: flat');
    refs.rangeRoot.children[1].setAttribute?.('material', 'color: ' + (state.rangeSide === 'end' ? '#dc2626' : '#7f1d1d') + '; opacity: 0.95; shader: flat');
    while (refs.referencesRoot.firstChild) {
      refs.referencesRoot.removeChild(refs.referencesRoot.firstChild);
    }
    var allSources = getReferenceSources();
    var autoOrderById = getSuggestedAutoOrderById();
    var autoCount = Object.keys(autoOrderById).length;
    var maxPage = clampSelectionPage();
    var pageStart = state.selectionPage * PANEL_LAYOUT.referenceRows;
    var sources = allSources.slice(pageStart, pageStart + PANEL_LAYOUT.referenceRows);
    refs.pagerRoot?.setAttribute('visible', allSources.length > PANEL_LAYOUT.referenceRows);
    refs.pageText?.setAttribute('value', 'Page ' + (state.selectionPage + 1) + ' / ' + (maxPage + 1));
    var start = findSource(state.startSourceId);
    var end = findSource(state.endSourceId);
    var info = state.timelineMode === 'auto'
      ? 'Auto: CodeXR samples ' + (autoCount || 'the') + ' timeline frames.'
      : state.timelineMode === 'range'
        ? 'Range: ' + state.rangeSide.toUpperCase() + ' | ' + sourceDescription(start) + ' -> ' + sourceDescription(end)
        : 'Manual: ' + state.manualSourceIds.length + ' selected frames.';
    refs.info?.setAttribute('value', info);
    if (!sources.length) {
      refs.referencesRoot.appendChild(text('No Git references received yet.', '0 0 0.02', 5.6, '#fecaca'));
      return;
    }
    sources.forEach(function (source, index) {
      var manualIndex = state.manualSourceIds.indexOf(source.id);
      var selection = { selected: false };
      if (source.id === state.startSourceId) {
        selection = { selected: true, color: '#15803d' };
      } else if (source.id === state.endSourceId) {
        selection = { selected: true, color: '#b91c1c' };
      } else if (manualIndex >= 0) {
        selection = { selected: true, color: '#7c3aed', orderLabel: String(manualIndex + 1) };
      } else if (state.timelineMode === 'auto' && autoOrderById[source.id]) {
        selection = { selected: true, color: '#92400e', orderLabel: String(autoOrderById[source.id]) };
      }
      refs.referencesRoot.appendChild(referenceRow(source, index, selection));
    });
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
    await root.CodeXRAnalysisModeRuntime?.transitionTo?.(MODE, {
      reason: 'project-evolution-selection',
      controllerView: 'project-evolution',
      panelViewId: MODE
    });
    root.CodeXRAnalysisControllerRuntime?.showView?.('project-evolution', {
      mode: MODE,
      reason: 'project-evolution-selection'
    }) || root.CodeXRMappingUiRuntime?.showPanelView?.(MODE);
    setStatus('Loading project timeline...', 'info');
    if (!client()?.sendMessage?.('project-evolution-references-request', {})) {
      setStatus('Collaboration connection is not ready.', 'error');
    }
    return true;
  }

  function startSelectedTimeline() {
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
    stop();
    setStatus('Clearing project evolution movie...', 'info');
    if (!client()?.sendMessage?.('project-evolution-clear', {})) {
      applyClearedState('Project evolution movie cleared locally.');
    }
  }

  function handleReferences(message) {
    var payload = unwrapPayload(message);
    state.references = payload || null;
    clampSelectionPage();
    var count = getReferenceSources().filter(function (source) {
      return source && source.kind === 'gitRef';
    }).length;
    setStatus(count ? 'Ready to generate ' + count + ' timeline frames.' : 'No commits available for evolution.', count ? 'info' : 'error');
    render();
  }

  function handleProgress(message) {
    var payload = unwrapPayload(message);
    if (!payload) { return; }
    setStatus(payload.message || '', payload.state === 'error' ? 'error' : 'info');
  }

  function handleError(message) {
    var payload = unwrapPayload(message);
    state.pendingFrameApply?.reject?.(new Error(payload.message || 'Project evolution failed.'));
    state.pendingFrameApply = null;
    stop();
    setStatus(payload.message || 'Project evolution failed.', 'error');
  }
