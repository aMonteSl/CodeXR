// == projectEvolutionRuntime.js | part 10: state-and-ui-atoms (assembled with its siblings; see COMPONENTS.md) ==
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
    frameApplyRequestId: 0,
    supersededFrameApplyIds: {},
    timelineMode: 'auto',
    selectionPage: 0,
    rangeSide: 'start',
    startSourceId: '',
    endSourceId: '',
    manualSourceIds: [],
    preparedChartIds: {},
    pendingFrameApply: null,
    dataRefreshGeneration: 0,
    chartDataSignature: '',
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
  var PANEL_LAYOUT = {
    titleY: 2.55,
    subtitleY: 2.22,
    infoY: 1.9,
    modeY: 1.5,
    rangeY: 1.15,
    referencesY: 0.78,
    referenceRows: 5,
    referenceRowGap: 0.34,
    pagerY: -0.94,
    nowShowingY: -1.26,
    generateY: -1.74,
    transportY: -2.22,
    speedY: -2.66,
    statusY: -3.18,
    panelHeight: 7.8
  };

  function doc() { return root.document; }
  function client() { return root.CodeXRCollaborationRuntime?.getClient?.(root) || null; }

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

  function button(label, position, width, onClick, color, options) {
    var config = options || {};
    var rootEntity = entity('a-plane', {
      position: position,
      width: width || 1,
      height: config.height || 0.36,
      material: 'color: ' + (color || '#0f3a5f') + '; opacity: 0.95; shader: flat',
      class: 'babiaxraycasterclass codexr-project-evolution-button',
      'data-codexr-interactive': 'true'
    });
    rootEntity.appendChild(smallText(
      label,
      '0 0 0.02',
      config.textWidth || (width || 1) * 1.55,
      '#ffffff',
      'center',
      config.wrapCount || 22
    ));
    rootEntity.addEventListener('click', onClick);
    return rootEntity;
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

  function speedButton(label, position, speed) {
    return button(label, position, 1.02, function () { setSpeed(speed); }, '#334155', {
      height: 0.32,
      textWidth: 1.35,
      wrapCount: 10
    });
  }

  function setStatus(message, level) {
    state.status = String(message || '');
    state.statusLevel = level || 'info';
    refs.status?.setAttribute('value', state.status);
    refs.status?.setAttribute('color', level === 'error' ? '#fecaca' : '#fde68a');
  }
