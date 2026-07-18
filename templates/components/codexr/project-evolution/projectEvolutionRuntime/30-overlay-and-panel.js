// == projectEvolutionRuntime.js | part 30: overlay-and-panel (assembled with its siblings; see COMPONENTS.md) ==
  function ensurePlaybackOverlay() {
    if (refs.playbackOverlay && refs.playbackOverlay.isConnected !== false) {
      return refs.playbackOverlay;
    }
    var overlay = entity('a-entity', {
      id: 'codexr-project-evolution-playback-overlay',
      position: '0 3.35 -18',
      visible: 'false',
      'data-codexr-role': 'project-evolution playback-overlay'
    });
    overlay.appendChild(entity('a-plane', {
      width: 6.2,
      height: 0.72,
      material: 'color: #111827; opacity: 0.78; transparent: true; shader: flat'
    }));
    refs.overlayTitle = text('', '0 0.17 0.02', 5.8, '#fde68a');
    refs.overlayDetail = smallText('', '-2.7 -0.15 0.02', 5.4, '#e0f2fe', 'left', 52);
    overlay.appendChild(refs.overlayTitle);
    overlay.appendChild(refs.overlayDetail);
    sceneEl().appendChild?.(overlay);
    refs.playbackOverlay = overlay;
    return overlay;
  }

  function updatePlaybackOverlay(frame, frameCount, visible) {
    var overlay = ensurePlaybackOverlay();
    overlay.setAttribute?.('visible', visible && frameCount ? 'true' : 'false');
    if (!visible || !frameCount || !frame) { return; }
    var parts = splitSourceDescription(frame.source || frame);
    refs.overlayTitle.setAttribute?.('value', 'Project evolution  ' + (state.frameIndex + 1) + ' / ' + frameCount + '  |  ' + parts.date);
    refs.overlayDetail.setAttribute?.('value', compact(parts.label + (parts.subject ? ' - ' + parts.subject : ''), 86));
  }

  function hidePlaybackOverlay() {
    refs.playbackOverlay.setAttribute?.('visible', 'false');
  }

  async function configureAvailability() {
    var sessionInfo = null;
    try {
      sessionInfo = await client().getSessionInfoAsync?.();
    } catch {
      sessionInfo = null;
    }
    var capabilities = sessionInfo?.capabilities || {};
    var enabled = capabilities.projectEvolution === true;
    state.availability = enabled ? 'enabled' : 'disabled';
    state.unavailableReason = enabled
      ? ''
      : String(capabilities.projectEvolutionReason || 'Project evolution requires a local Git repository.');
    registerModeOption();
  }

  function registerModeOption() {
    state.unregisterModeOption?.();
    state.unregisterModeOption = root.CodeXRAnalysisModeRuntime.registerModeOption?.({
      id: MODE,
      label: 'Project evolution',
      color: '#f59e0b',
      disabled: state.availability !== 'enabled',
      disabledReason: state.unavailableReason || 'Project evolution requires a local Git repository.',
      onSelect: selectMode
    }) || null;
  }

  function buildPanel() {
    if (refs.panel || !root.CodeXRMappingUiRuntime.registerPanelView || !root.CodeXRMappingUiRuntime.isPanelReady?.()) {
      return !!refs.panel;
    }
    refs.panel = entity('a-entity', { position: '0 0 0.04' });
    refs.panel.appendChild(text('Project evolution', '0 ' + PANEL_LAYOUT.titleY + ' 0.02', 6.2, '#cde7ff'));
    refs.panel.appendChild(text('Replay the project through local Git commits.', '0 ' + PANEL_LAYOUT.subtitleY + ' 0.02', 5.8, '#cbd5e1'));
    refs.info = text('Automatic timeline: oldest commits to newest commits.', '0 ' + PANEL_LAYOUT.infoY + ' 0.02', 5.8, '#ffffff');
    refs.panel.appendChild(refs.info);
    refs.modeRoot = entity('a-entity', { position: '0 ' + PANEL_LAYOUT.modeY + ' 0.02' });
    refs.modeRoot.appendChild(modeButton('Auto', '-1.75 0 0', function () { setTimelineMode('auto'); }, '#0e7490'));
    refs.modeRoot.appendChild(modeButton('Range', '0 0 0', function () { setTimelineMode('range'); }, '#334155'));
    refs.modeRoot.appendChild(modeButton('Manual', '1.75 0 0', function () { setTimelineMode('manual'); }, '#334155'));
    refs.panel.appendChild(refs.modeRoot);
    refs.rangeRoot = entity('a-entity', { position: '0 ' + PANEL_LAYOUT.rangeY + ' 0.02' });
    refs.rangeRoot.appendChild(button('Pick start', '-1.05 0 0', 1.65, function () { setRangeSide('start'); }, '#15803d', { textWidth: 2.1, wrapCount: 18 }));
    refs.rangeRoot.appendChild(button('Pick end', '1.05 0 0', 1.65, function () { setRangeSide('end'); }, '#b91c1c', { textWidth: 2.1, wrapCount: 18 }));
    refs.panel.appendChild(refs.rangeRoot);
    refs.referencesRoot = entity('a-entity', { position: '0 ' + PANEL_LAYOUT.referencesY + ' 0.02' });
    refs.panel.appendChild(refs.referencesRoot);
    refs.pagerRoot = entity('a-entity', { position: '0 ' + PANEL_LAYOUT.pagerY + ' 0.02' });
    refs.pagerRoot.appendChild(button('<', '-0.72 0 0', 0.5, function () { setSelectionPage(state.selectionPage - 1); }, '#334155', { height: 0.26, textWidth: 0.7, wrapCount: 4 }));
    refs.pageText = smallText('Page 1 / 1', '0 0 0.02', 1.2, '#cbd5e1', 'center', 16);
    refs.pagerRoot.appendChild(refs.pageText);
    refs.pagerRoot.appendChild(button('>', '0.72 0 0', 0.5, function () { setSelectionPage(state.selectionPage + 1); }, '#334155', { height: 0.26, textWidth: 0.7, wrapCount: 4 }));
    refs.panel.appendChild(refs.pagerRoot);
    refs.frame = buildNowShowingCard();
    refs.panel.appendChild(refs.frame);
    refs.generateButton = primaryActionButton('Generate movie', '0 ' + PANEL_LAYOUT.generateY + ' 0.02', startSelectedTimeline);
    refs.panel.appendChild(refs.generateButton);
    refs.clearButton = button('Clear movie', '2.25 ' + PANEL_LAYOUT.generateY + ' 0.02', 1.18, clearMovie, '#7f1d1d', {
      height: 0.34,
      textWidth: 1.5,
      wrapCount: 14
    });
    refs.panel.appendChild(refs.clearButton);
    refs.panel.appendChild(transportButton('Prev', '-1.65 ' + PANEL_LAYOUT.transportY + ' 0.02', previousFrame));
    refs.playButton = transportButton('Play', '0 ' + PANEL_LAYOUT.transportY + ' 0.02', togglePlay);
    refs.panel.appendChild(refs.playButton);
    refs.panel.appendChild(transportButton('Next', '1.65 ' + PANEL_LAYOUT.transportY + ' 0.02', nextFrame));
    refs.panel.appendChild(speedButton('0.5x', '-1.35 ' + PANEL_LAYOUT.speedY + ' 0.02', 0.5));
    refs.panel.appendChild(speedButton('1x', '0 ' + PANEL_LAYOUT.speedY + ' 0.02', 1));
    refs.panel.appendChild(speedButton('2x', '1.35 ' + PANEL_LAYOUT.speedY + ' 0.02', 2));
    refs.status = smallText('', '-2.85 ' + PANEL_LAYOUT.statusY + ' 0.02', 5.7, '#fde68a', 'left', 54);
    refs.panel.appendChild(refs.status);
    state.unregisterPanelView = root.CodeXRMappingUiRuntime.registerPanelView({
      id: MODE,
      title: 'Project evolution',
      buttonLabel: 'E',
      headerButton: false,
      panelHeight: PANEL_LAYOUT.panelHeight,
      content: refs.panel,
      onShow: handlePanelShown
    });
    return true;
  }

  function handlePanelShown() {
    render();
    var modeState = root.CodeXRAnalysisModeRuntime.getState?.() || {};
    if (
      modeState.mode === MODE
      || (modeState.transitioning && modeState.requestedMode === MODE)
    ) {
      return;
    }
    root.CodeXRAnalysisModeRuntime.setSelectionPanel?.(MODE);
    client().sendMessage?.('analysis-mode-activate', { mode: MODE });
    void root.CodeXRAnalysisModeRuntime.transitionTo?.(MODE, {
      reason: 'project-evolution-panel-shown',
      controllerView: 'project-evolution',
      panelViewId: MODE
    });
  }
