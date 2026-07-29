// == projectEvolutionRuntime.js | overlayAndPanel (assembled per manifest.json; see COMPONENTS.md) ==
  function ensurePlaybackOverlay() {
    if (refs.playbackOverlay && refs.playbackOverlay?.isConnected !== false) {
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
    refs.overlayTitle?.setAttribute('value', 'Project evolution  ' + (state.frameIndex + 1) + ' / ' + frameCount + '  |  ' + parts.date);
    refs.overlayDetail?.setAttribute('value', compact(parts.label + (parts.subject ? ' - ' + parts.subject : ''), 86));
  }

  function hidePlaybackOverlay() {
    refs.playbackOverlay?.setAttribute('visible', 'false');
  }

  var EVOLUTION_UNAVAILABLE_REASON = 'Project evolution requires a local Git repository.';

  async function configureAvailability() {
    var picker = root.CodeXRGitRefPickerRuntime;
    var capabilities = picker?.resolveCapabilities ? await picker.resolveCapabilities() : {};
    var enabled = capabilities.projectEvolution === true;
    state.availability = enabled ? 'enabled' : 'disabled';
    state.unavailableReason = enabled
      ? ''
      : String(capabilities.projectEvolutionReason || EVOLUTION_UNAVAILABLE_REASON);
    registerModeOption();
  }

  // Delegates to the shared Git-gated mode registration (see historical).
  function registerModeOption() {
    state.unregisterModeOption?.();
    state.unregisterModeOption = root.CodeXRGitRefPickerRuntime?.registerGitGatedMode?.({
      modeId: MODE,
      label: 'Project evolution',
      color: '#f59e0b',
      capabilityKey: 'projectEvolution',
      enabled: state.availability === 'enabled',
      reasonFallback: state.unavailableReason || EVOLUTION_UNAVAILABLE_REASON,
      onSelect: selectMode
    }) || null;
  }

  function buildPanel() {
    if (refs.panel || !root.CodeXRMappingUiRuntime?.registerPanelView || !root.CodeXRGitRefPickerRuntime?.createPicker) {
      return !!refs.panel;
    }
    if (!root.CodeXRMappingUiRuntime.isPanelReady?.()) {
      // Event-driven: register as soon as the controller panel exists.
      if (!refs.panelMountQueued) {
        refs.panelMountQueued = true;
        root.CodeXRMappingUiRuntime.whenPanelReady?.(function () {
          refs.panelMountQueued = false;
          buildPanel();
        });
      }
      return false;
    }
    refs.panel = entity('a-entity', { position: '0 0 0.04' });
    // No title here: the controller's own header already names the view. It was
    // printed twice.
    refs.help = text('Replay the project through local Git commits.', '0 0 0.02', 5.8, '#cbd5e1');
    refs.panel.appendChild(refs.help);
    refs.info = text('Automatic timeline: oldest commits to newest commits.', '0 0 0.02', 5.8, '#ffffff');
    refs.panel.appendChild(refs.info);
    refs.modeRoot = entity('a-entity', { position: '0 0 0.02' });
    refs.modeRoot.appendChild(modeButton('Auto', '-1.75 0 0', function () { setTimelineMode('auto'); }, '#0e7490'));
    refs.modeRoot.appendChild(modeButton('Range', '0 0 0', function () { setTimelineMode('range'); }, '#334155'));
    refs.modeRoot.appendChild(modeButton('Manual', '1.75 0 0', function () { setTimelineMode('manual'); }, '#334155'));
    refs.panel.appendChild(refs.modeRoot);
    refs.rangeRoot = entity('a-entity', { position: '0 0 0.02' });
    refs.rangeRoot.appendChild(button('Pick start', '-1.05 0 0', 1.65, function () { setRangeSide('start'); }, '#15803d', { textWidth: 2.1, wrapCount: 18 }));
    refs.rangeRoot.appendChild(button('Pick end', '1.05 0 0', 1.65, function () { setRangeSide('end'); }, '#b91c1c', { textWidth: 2.1, wrapCount: 18 }));
    refs.panel.appendChild(refs.rangeRoot);
    // Ordered multi-select source list is the shared Git picker in 'sequence'
    // mode, now with the same category tabs and time-order toggle the
    // comparison uses — hundreds of commits are unusable without them.
    refs.picker = root.CodeXRGitRefPickerRuntime.createPicker({
      mode: 'sequence',
      tabs: true,
      sortToggle: true,
      pageSize: PANEL_LAYOUT.referenceRows,
      rowGap: PANEL_LAYOUT.rowGap,
      // Laid out relative to the picker root, which layoutPanel positions as a
      // single block: tabs on top, then the rows, then the pager.
      tabsY: -(PANEL_LAYOUT.tabsHeight / 2),
      listY: -(PANEL_LAYOUT.tabsHeight + PANEL_LAYOUT.gap),
      listTopY: 0,
      pagerY: -(pickerBlockHeight() - (PANEL_LAYOUT.pagerHeight / 2)),
      rowClass: 'codexr-project-evolution-button',
      resolveRowState: resolveRowStateForSource,
      onRowClick: function (source) { selectSourceForTimeline(source); }
    });
    refs.panel.appendChild(refs.picker.el);
    refs.frame = buildNowShowingCard();
    refs.panel.appendChild(refs.frame);
    refs.progressRoot = buildProgressBar();
    refs.panel.appendChild(refs.progressRoot);
    refs.generateButton = primaryActionButton('Generate movie', '0 0 0.02', startSelectedTimeline);
    refs.panel.appendChild(refs.generateButton);
    refs.clearButton = button('Clear movie', '0 0 0.02', 1.5, clearMovie, '#7f1d1d', {
      height: 0.4,
      textWidth: 1.9,
      wrapCount: 14
    });
    refs.panel.appendChild(refs.clearButton);
    // Back to the Field Mapping view without regenerating (mirror of
    // Historical's closePanel); its row folds away until a movie exists.
    refs.mappingButton = button('Field mapping', '0 0 0.02', 3.15, showMovieMappingView, '#0e7490', {
      height: 0.4,
      textWidth: 3.9,
      wrapCount: 28
    });
    refs.panel.appendChild(refs.mappingButton);
    refs.transportRoot = entity('a-entity', { position: '0 0 0.02' });
    refs.transportRoot.appendChild(transportButton('Prev', '-1.65 0 0', previousFrame));
    refs.playButton = transportButton('Play', '0 0 0', togglePlay);
    refs.transportRoot.appendChild(refs.playButton);
    refs.transportRoot.appendChild(transportButton('Next', '1.65 0 0', nextFrame));
    refs.panel.appendChild(refs.transportRoot);
    refs.speedRoot = entity('a-entity', { position: '0 0 0.02' });
    refs.speedRoot.appendChild(speedButton('0.5x', '-1.35 0 0', 0.5));
    refs.speedRoot.appendChild(speedButton('1x', '0 0 0', 1));
    refs.speedRoot.appendChild(speedButton('2x', '1.35 0 0', 2));
    refs.panel.appendChild(refs.speedRoot);
    refs.timeline = {};
    refs.timelineBar = buildTimelineBar(refs.timeline);
    refs.panel.appendChild(refs.timelineBar);
    refs.sparkline = buildSparkline();
    refs.panel.appendChild(refs.sparkline);
    refs.status = smallText('', PANEL_LAYOUT.left + ' 0 0.02', 5.7, '#fde68a', 'left', 54);
    refs.panel.appendChild(refs.status);
    state.unregisterPanelView = root.CodeXRMappingUiRuntime?.registerPanelView({
      id: MODE,
      title: 'Project evolution',
      buttonLabel: 'E',
      headerButton: false,
      panelHeight: layoutPanel(),
      content: refs.panel,
      onShow: handlePanelShown
    });
    // Child section of the Field Mapping view: chart/axis controls on the left,
    // the movie and its transport on the right (same pattern as Historical).
    buildMovieCompanion(root.CodeXRMappingUiRuntime);
    return true;
  }

  // Places every section from PANEL_LAYOUT, top to bottom, and returns the
  // panel height it needs. The range row only takes space in Range mode, so the
  // rest of the panel moves up instead of leaving a hole.
  function layoutPanel() {
    var L = PANEL_LAYOUT;
    var hasMovie = !!(state.result?.frames || []).length;
    var generating = !!state.generating;
    // Sections in order. `show: false` folds one away completely — it neither
    // takes space nor leaves a hole (the range row outside Range mode, the
    // playback chrome before a movie exists).
    var sections = [
      { node: refs.help, height: L.helpHeight, show: true },
      { node: refs.info, height: L.infoHeight, show: true },
      { node: refs.modeRoot, height: L.modeHeight, show: true },
      { node: refs.rangeRoot, height: L.rangeHeight, show: state.timelineMode === 'range' },
      { node: refs.picker?.el, height: pickerBlockHeight(), show: true, anchorTop: true },
      { node: refs.frame, height: L.nowShowingHeight, show: true },
      { node: refs.progressRoot, height: L.progressHeight, show: generating },
      { node: null, height: L.actionsHeight, show: true, actions: true },
      { node: refs.mappingButton, height: L.actionsHeight, show: hasMovie },
      { node: refs.transportRoot, height: L.transportHeight, show: true },
      { node: refs.speedRoot, height: L.speedHeight, show: true },
      { node: refs.timelineBar, height: L.timelineBarHeight, show: hasMovie },
      { node: refs.sparkline, height: L.sparklineHeight, show: hasMovie },
      { node: refs.status, height: L.statusHeight, show: true, alignLeft: true }
    ];
    var visible = sections.filter(function (section) { return section.show; });
    var contentHeight = visible.reduce(function (total, section) {
      return total + section.height;
    }, 0) + (Math.max(0, visible.length - 1) * L.gap);

    // Content is centred on the panel, which is drawn around y = 0.
    var y = contentHeight / 2;
    sections.forEach(function (section) {
      if (!section.actions) { setNodeVisible(section.node, section.show); }
      if (!section.show) { return; }
      if (section.anchorTop) {
        // The picker positions its own internals downward from its root.
        section.node?.setAttribute?.('position', L.centerX + ' ' + y + ' 0.02');
        y -= section.height + L.gap;
        return;
      }
      y -= section.height / 2;
      if (section.actions) {
        // Generate + Clear share a row, both inside the panel margins.
        refs.generateButton?.setAttribute?.('position', (L.centerX - 0.85) + ' ' + y + ' 0.02');
        refs.clearButton?.setAttribute?.('position', (L.centerX + 1.55) + ' ' + y + ' 0.02');
      } else {
        // Left-aligned text (the status line) hangs from the left margin.
        section.node?.setAttribute?.('position', (section.alignLeft ? L.left : L.centerX) + ' ' + y + ' 0.02');
      }
      y -= (section.height / 2) + L.gap;
    });
    return Math.max(2.45, contentHeight + L.bottomPadding);
  }

  function pickerBlockHeight() {
    var L = PANEL_LAYOUT;
    return L.tabsHeight + L.gap + (L.referenceRows * L.rowGap) + L.gap + L.pagerHeight;
  }

  function setNodeVisible(node, visible) {
    if (!node) { return; }
    if (node.object3D) { node.object3D.visible = !!visible; }
    node.setAttribute?.('visible', visible ? 'true' : 'false');
  }

  function handlePanelShown() {
    render();
    if (isEvolutionModeActiveOrActivating()) {
      return;
    }
    root.CodeXRAnalysisModeRuntime?.setSelectionPanel?.(MODE);
    client()?.sendMessage?.('analysis-mode-activate', { mode: MODE });
    void changeToEvolutionAnalysis({
      reason: 'project-evolution-panel-shown',
      controllerView: 'project-evolution',
      panelViewId: MODE
    });
  }
