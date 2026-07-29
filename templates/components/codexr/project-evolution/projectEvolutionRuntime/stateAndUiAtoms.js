// == projectEvolutionRuntime.js | stateAndUiAtoms (assembled per manifest.json; see COMPONENTS.md) ==
(function registerCodeXRProjectEvolutionRuntime(root) {
  'use strict';

  var ENTITY_KIND = 'project-evolution';
  var ENTITY_ID = 'main';
  var MODE = 'project-evolution';
  var COMPONENT_BY_CHART = {
    bars: 'babia-bars',
    barsmap: 'babia-barsmap',
    cyls: 'babia-cyls',
    cylsmap: 'babia-cylsmap',
    donut: 'babia-doughnut',
    pie: 'babia-pie',
    bubbles: 'babia-bubbles',
    boats: 'babia-boats'
  };
  // Derived from the map above rather than guessed from the attribute name:
  // `donut` maps to `babia-doughnut`, so stripping the `babia-` prefix and
  // looking the key up missed exactly that one and let a doughnut component
  // ride along onto the movie's chart entity.
  var CHART_COMPONENT_NAMES = Object.keys(COMPONENT_BY_CHART).map(function (chartId) {
    return COMPONENT_BY_CHART[chartId];
  });
  var state = {
    initialized: false,
    availability: 'loading',
    unavailableReason: 'Checking Git history availability...',
    references: null,
    result: null,
    frameIndex: 0,
    playing: false,
    speed: 1,
    frameDurationMs: 5000,
    settleDelayMs: 5000,
    playbackGeneration: 0,
    viewGeneration: 0,
    frameApplyRequestId: 0,
    supersededFrameApplyIds: {},
    timelineMode: 'auto',
    // True while the server is building the movie: shows the progress bar and
    // makes the panel reserve room for it.
    generating: false,
    // True while a confirmed chart/axis change is being applied to the current
    // frame: playback and seeking stay locked until it settles.
    applyingMapping: false,
    // Whether the movie was playing when the user left the mode, so re-entry
    // resumes playback and not just the frame position.
    resumePlayback: false,
    // Seconds left before the movie advances (0 while a frame is still
    // settling): the panel prints it on its status line, the companion on its
    // own countdown line.
    nextFrameSeconds: 0,
    unregisterMappingCompanion: null,
    rangeSide: 'start',
    startSourceId: '',
    endSourceId: '',
    manualSourceIds: [],
    pendingFrameApply: null,
    dataRefreshGeneration: 0,
    appliedFrameIndex: -1,
    appliedResultRevision: 0,
    playbackMappingSnapshot: null,
    timer: null,
    status: '',
    statusLevel: 'info',
    activeChartId: 'boats',
    unregisterPanelView: null,
    unregisterModeOption: null,
    unregisterLifecycle: null,
    disposables: []
  };
  var refs = {};
  // Section heights, top to bottom. Positions are COMPUTED from these (see
  // layoutPanel) instead of being hand-tuned constants: the range row folds
  // away when it is not in use, and every section keeps a real gap, so nothing
  // overlaps and nothing drifts outside the panel margins.
  var PANEL_LAYOUT = {
    left: -2.85,
    right: 2.55,
    // The usable strip is not centred on 0, so full-width rows must be centred
    // here or they hang over the right edge.
    centerX: -0.15,
    contentWidth: 5.4,
    gap: 0.18,
    helpHeight: 0.3,
    infoHeight: 0.3,
    modeHeight: 0.36,
    rangeHeight: 0.36,
    tabsHeight: 0.3,
    referenceRows: 6,
    rowGap: 0.32,
    pagerHeight: 0.3,
    nowShowingHeight: 0.5,
    progressHeight: 0.26,
    actionsHeight: 0.4,
    transportHeight: 0.38,
    speedHeight: 0.32,
    timelineBarHeight: 0.3,
    sparklineHeight: 0.5,
    statusHeight: 0.3,
    bottomPadding: 0.34
  };

  function doc() { return root.document; }
  function client() { return root.CodeXRCollaborationRuntime?.getClient?.(root) || null; }

  function changeToEvolutionAnalysis(context) {
    return root.CodeXRAnalysisModeRuntime?.changeAnalysis?.(MODE, context || {})
      || Promise.resolve(false);
  }

  function config() {
    var script = doc().getElementById?.('codexr-tooling-config-xr-mapping-ui');
    try { return JSON.parse(script.textContent || '{}'); } catch { return {}; }
  }

  function entity(tag, attrs) {
    var element = doc().createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) { element.setAttribute(key, attrs[key]); });
    return element;
  }

  function text(value, position, width, color, align) {
    return entity('a-text', {
      value: value || '',
      position: position || '0 0 0',
      width: width || 5,
      color: color || '#ffffff',
      align: align || 'center',
      baseline: 'center',
      'wrap-count': 42
    });
  }

  function smallText(value, position, width, color, align, wrapCount) {
    return entity('a-text', {
      value: value || '',
      position: position || '0 0 0',
      width: width || 3,
      color: color || '#ffffff',
      align: align || 'left',
      baseline: 'center',
      'wrap-count': wrapCount || 60
    });
  }

  // Buttons come from the shared Git chrome so this panel and the historical
  // comparison look like the same product; only the marker class stays local.
  function button(label, position, width, onClick, color, options) {
    var config = options || {};
    return root.CodeXRGitRefPickerRuntime.buildButton(
      label,
      position,
      width || 1,
      config.height || 0.36,
      color || '#0f3a5f',
      onClick,
      config.textWidth || (width || 1) * 1.55,
      { className: 'codexr-project-evolution-button', wrapCount: config.wrapCount || 22 }
    );
  }

  function modeButton(label, position, onClick, color) {
    return button(label, position, 1.42, onClick, color, { height: 0.36, textWidth: 1.95, wrapCount: 18 });
  }

  function primaryActionButton(label, position, onClick) {
    return button(label, position, 3.15, onClick, '#be123c', { height: 0.4, textWidth: 3.9, wrapCount: 28 });
  }

  function transportButton(label, position, onClick) {
    return button(label, position, 1.32, onClick, label === 'Play' ? '#0e7490' : '#1e3a5f', {
      height: 0.38,
      textWidth: 1.75,
      wrapCount: 14
    });
  }

  // `width` narrows the same atom for the controller companion's column
  // (the panel keeps the default), so both places speak one vocabulary.
  function speedButton(label, position, speed, width) {
    var buttonWidth = Number(width) || 1.02;
    return button(label, position, buttonWidth, function () { setSpeed(speed); }, '#334155', {
      height: 0.32,
      textWidth: buttonWidth * 1.32,
      wrapCount: 10
    });
  }

  function setStatus(message, level) {
    state.status = String(message || '');
    state.statusLevel = level || 'info';
    refs.status?.setAttribute('value', state.status);
    refs.status?.setAttribute('color', level === 'error' ? '#fecaca' : '#fde68a');
  }
