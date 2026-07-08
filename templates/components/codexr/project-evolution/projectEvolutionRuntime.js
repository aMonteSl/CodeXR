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
  function client() { return root.CodeXRCollaborationRuntime.getClient.(root) || null; }

  function config() {
    var script = doc().getElementById.('codexr-tooling-config-xr-mapping-ui');
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
    return button(label, position, 1.32, onClick, label === 'Play'  '#0e7490' : '#1e3a5f', {
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
    refs.status.setAttribute.('value', state.status);
    refs.status.setAttribute.('color', level === 'error'  '#fecaca' : '#fde68a');
  }

  function unwrapPayload(message) {
    return message && typeof message === 'object' && Object.prototype.hasOwnProperty.call(message, 'payload')
       message.payload
      : message;
  }

  function setTimelineMode(mode) {
    var nextMode = mode === 'range' || mode === 'manual'  mode : 'auto';
    if (state.timelineMode !== nextMode) {
      state.startSourceId = '';
      state.endSourceId = '';
      state.manualSourceIds = [];
      state.rangeSide = 'start';
      state.selectionPage = 0;
    }
    state.timelineMode = nextMode;
    render();
  }

  function setRangeSide(side) {
    state.rangeSide = side === 'end'  'end' : 'start';
    render();
  }

  function getReferenceSources() {
    var sources = Array.isArray(state.references.sources)  state.references.sources : [];
    var byId = {};
    sources.forEach(function (source) { byId[source.id] = source; });
    var suggested = Array.isArray(state.references.suggestedSourceIds)
       state.references.suggestedSourceIds.map(function (id) { return byId[id]; }).filter(Boolean)
      : [];
    var fallback = sources.filter(function (source) {
      return source && (source.kind === 'workingCopy' || source.kind === 'gitRef');
    });
    var merged = [];
    suggested.concat(fallback).forEach(function (source) {
      if (source && !merged.some(function (candidate) { return candidate.id === source.id; })) {
        merged.push(source);
      }
    });
    return merged;
  }

  function compact(value, limit) {
    var textValue = String(value || '');
    return textValue.length > limit  textValue.slice(0, Math.max(1, limit - 3)) + '...' : textValue;
  }

  function sourceDescription(source) {
    if (!source) { return 'Not selected'; }
    var description = source.description  ' - ' + source.description : '';
    return compact(String(source.label || source.id) + description, 56);
  }

  function clampSelectionPage() {
    var sources = getReferenceSources();
    var maxPage = Math.max(0, Math.ceil(sources.length / PANEL_LAYOUT.referenceRows) - 1);
    state.selectionPage = Math.max(0, Math.min(maxPage, Number(state.selectionPage) || 0));
    return maxPage;
  }

  function setSelectionPage(page) {
    state.selectionPage = Number(page) || 0;
    clampSelectionPage();
    render();
  }

  function getSuggestedAutoOrderById() {
    var order = {};
    var ids = Array.isArray(state.references.suggestedSourceIds)
       state.references.suggestedSourceIds
      : [];
    ids.forEach(function (id, index) {
      if (id && order[id] === undefined) {
        order[id] = index + 1;
      }
    });
    return order;
  }

  function splitSourceDescription(source) {
    var label = String(source.label || source.id || 'unknown');
    var description = String(source.description || '').trim();
    var explicitDate = String(source.date || '').trim();
    var match = description.match(/^(\d{4}-\d{2}-\d{2})\s*(.*)$/);
    var date = explicitDate || (match  match[1] : '');
    var subject = match  match[2] : description;
    if (source.kind === 'workingCopy') {
      date = date || 'Working copy';
    }
    return {
      label: compact(label, 16),
      date: date || 'No commit date',
      subject: compact(subject, 42),
      type: sourceTypeLabel(source)
    };
  }

  function sourceTypeLabel(source) {
    if (!source) { return 'REF'; }
    if (source.revisionType === 'working-copy' || source.kind === 'workingCopy') { return 'LIVE'; }
    if (source.revisionType === 'merge') { return 'MERGE'; }
    if (source.revisionType === 'branch' || source.refType === 'branch') { return 'BRANCH'; }
    if (source.revisionType === 'tag' || source.refType === 'tag') { return 'TAG'; }
    if (source.revisionType === 'commit' || source.refType === 'commit') { return 'COMMIT'; }
    return 'REF';
  }

  function sourceTypeColor(source) {
    var label = sourceTypeLabel(source);
    if (label === 'MERGE') { return '#f97316'; }
    if (label === 'BRANCH') { return '#22c55e'; }
    if (label === 'TAG') { return '#a78bfa'; }
    if (label === 'LIVE') { return '#06b6d4'; }
    return '#64748b';
  }

  function referenceRow(source, index, selection) {
    var parts = splitSourceDescription(source);
    var stateInfo = selection || {};
    var selected = stateInfo.selected === true;
    var row = entity('a-plane', {
      position: '0 ' + (-index * PANEL_LAYOUT.referenceRowGap) + ' 0',
      width: 5.7,
      height: 0.31,
      material: 'color: ' + (selected  (stateInfo.color || '#be123c') : '#1e3a5f') + '; opacity: 0.95; shader: flat',
      class: 'babiaxraycasterclass codexr-project-evolution-button',
      'data-codexr-interactive': 'true'
    });
    row.appendChild(smallText(parts.label, '-2.68 0.055 0.02', 1.28, '#e0f2fe', 'left', 18));
    row.appendChild(smallText(parts.date || 'No commit date', '-2.68 -0.075 0.02', 1.28, '#67e8f9', 'left', 18));
    row.appendChild(smallText(parts.subject || sourceDescription(source), '-1.2 0 0.02', 3.45, '#ffffff', 'left', 48));
    row.appendChild(entity('a-plane', {
      position: '1.92 0 0.018',
      width: 0.72,
      height: 0.18,
      material: 'color: ' + sourceTypeColor(source) + '; opacity: 0.9; shader: flat'
    }));
    row.appendChild(smallText(parts.type, '1.92 0 0.035', 0.72, '#ffffff', 'center', 8));
    if (stateInfo.orderLabel) {
      row.appendChild(smallText(stateInfo.orderLabel, '2.48 0 0.02', 0.52, '#fde68a', 'right', 8));
    }
    row.addEventListener('click', function () {
      selectSourceForTimeline(source);
    });
    return row;
  }

  function buildNowShowingCard() {
    var card = entity('a-plane', {
      position: '0 ' + PANEL_LAYOUT.nowShowingY + ' 0.02',
      width: 5.7,
      height: 0.46,
      material: 'color: #111827; opacity: 0.76; shader: flat'
    });
    refs.frameTitle = smallText('Now showing', '-2.58 0.12 0.02', 2.2, '#67e8f9', 'left', 18);
    refs.frameDetail = smallText('No movie loaded', '-2.58 -0.08 0.02', 5.05, '#e0f2fe', 'left', 62);
    card.appendChild(refs.frameTitle);
    card.appendChild(refs.frameDetail);
    return card;
  }

  function findSource(sourceId) {
    var sources = Array.isArray(state.references.sources)  state.references.sources : [];
    return sources.find(function (source) { return source.id === sourceId; }) || null;
  }

  function sceneEl() {
    return doc().querySelector.('a-scene') || doc().body || null;
  }

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
    sceneEl().appendChild.(overlay);
    refs.playbackOverlay = overlay;
    return overlay;
  }

  function updatePlaybackOverlay(frame, frameCount, visible) {
    var overlay = ensurePlaybackOverlay();
    overlay.setAttribute.('visible', visible && frameCount  'true' : 'false');
    if (!visible || !frameCount || !frame) { return; }
    var parts = splitSourceDescription(frame.source || frame);
    refs.overlayTitle.setAttribute.('value', 'Project evolution  ' + (state.frameIndex + 1) + ' / ' + frameCount + '  |  ' + parts.date);
    refs.overlayDetail.setAttribute.('value', compact(parts.label + (parts.subject  ' - ' + parts.subject : ''), 86));
  }

  function hidePlaybackOverlay() {
    refs.playbackOverlay.setAttribute.('visible', 'false');
  }

  async function configureAvailability() {
    var sessionInfo = null;
    try {
      sessionInfo = await client().getSessionInfoAsync.();
    } catch {
      sessionInfo = null;
    }
    var capabilities = sessionInfo.capabilities || {};
    var enabled = capabilities.projectEvolution === true;
    state.availability = enabled  'enabled' : 'disabled';
    state.unavailableReason = enabled
       ''
      : String(capabilities.projectEvolutionReason || 'Project evolution requires a local Git repository.');
    registerModeOption();
  }

  function registerModeOption() {
    state.unregisterModeOption.();
    state.unregisterModeOption = root.CodeXRAnalysisModeRuntime.registerModeOption.({
      id: MODE,
      label: 'Project evolution',
      color: '#f59e0b',
      disabled: state.availability !== 'enabled',
      disabledReason: state.unavailableReason || 'Project evolution requires a local Git repository.',
      onSelect: selectMode
    }) || null;
  }

  function buildPanel() {
    if (refs.panel || !root.CodeXRMappingUiRuntime.registerPanelView || !root.CodeXRMappingUiRuntime.isPanelReady.()) {
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
    var modeState = root.CodeXRAnalysisModeRuntime.getState.() || {};
    if (
      modeState.mode === MODE
      || (modeState.transitioning && modeState.requestedMode === MODE)
    ) {
      return;
    }
    root.CodeXRAnalysisModeRuntime.setSelectionPanel.(MODE);
    client().sendMessage.('analysis-mode-activate', { mode: MODE });
    void root.CodeXRAnalysisModeRuntime.transitionTo.(MODE, {
      reason: 'project-evolution-panel-shown',
      controllerView: 'project-evolution',
      panelViewId: MODE
    });
  }

  function render() {
    renderTimelineControls();
    var frames = state.result.frames || [];
    var frame = frames[state.frameIndex];
    updateNowShowing(frame, frames.length);
    refs.playButton.querySelector.('a-text').setAttribute.('value', state.playing  'Pause' : 'Play');
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
    refs.frameDetail.setAttribute('value', compact(parts.date + ' | ' + parts.label + (parts.subject  ' - ' + parts.subject : ''), 72));
  }

  function renderTimelineControls() {
    if (!refs.referencesRoot) { return; }
    refs.modeRoot.children.[0].setAttribute.('material', 'color: ' + (state.timelineMode === 'auto'  '#be123c' : '#334155') + '; opacity: 0.95; shader: flat');
    refs.modeRoot.children.[1].setAttribute.('material', 'color: ' + (state.timelineMode === 'range'  '#be123c' : '#334155') + '; opacity: 0.95; shader: flat');
    refs.modeRoot.children.[2].setAttribute.('material', 'color: ' + (state.timelineMode === 'manual'  '#be123c' : '#334155') + '; opacity: 0.95; shader: flat');
    refs.rangeRoot.setAttribute.('visible', state.timelineMode === 'range');
    refs.rangeRoot.children.[0].setAttribute.('material', 'color: ' + (state.rangeSide === 'start'  '#16a34a' : '#14532d') + '; opacity: 0.95; shader: flat');
    refs.rangeRoot.children.[1].setAttribute.('material', 'color: ' + (state.rangeSide === 'end'  '#dc2626' : '#7f1d1d') + '; opacity: 0.95; shader: flat');
    while (refs.referencesRoot.firstChild) {
      refs.referencesRoot.removeChild(refs.referencesRoot.firstChild);
    }
    var allSources = getReferenceSources();
    var autoOrderById = getSuggestedAutoOrderById();
    var autoCount = Object.keys(autoOrderById).length;
    var maxPage = clampSelectionPage();
    var pageStart = state.selectionPage * PANEL_LAYOUT.referenceRows;
    var sources = allSources.slice(pageStart, pageStart + PANEL_LAYOUT.referenceRows);
    refs.pagerRoot.setAttribute.('visible', allSources.length > PANEL_LAYOUT.referenceRows);
    refs.pageText.setAttribute.('value', 'Page ' + (state.selectionPage + 1) + ' / ' + (maxPage + 1));
    var start = findSource(state.startSourceId);
    var end = findSource(state.endSourceId);
    var info = state.timelineMode === 'auto'
       'Auto: CodeXR samples ' + (autoCount || 'the') + ' timeline frames.'
      : state.timelineMode === 'range'
         'Range: ' + state.rangeSide.toUpperCase() + ' | ' + sourceDescription(start) + ' -> ' + sourceDescription(end)
        : 'Manual: ' + state.manualSourceIds.length + ' selected frames.';
    refs.info.setAttribute.('value', info);
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
    root.CodeXRAnalysisModeRuntime.setSelectionPanel.(MODE);
    client().sendMessage.('analysis-mode-activate', { mode: MODE });
    await root.CodeXRAnalysisModeRuntime.transitionTo.(MODE, {
      reason: 'project-evolution-selection',
      controllerView: 'project-evolution',
      panelViewId: MODE
    });
    root.CodeXRAnalysisControllerRuntime.showView.('project-evolution', {
      mode: MODE,
      reason: 'project-evolution-selection'
    }) || root.CodeXRMappingUiRuntime.showPanelView.(MODE);
    setStatus('Loading project timeline...', 'info');
    if (!client().sendMessage.('project-evolution-references-request', {})) {
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
    client().sendMessage.('project-evolution-start', request);
  }

  function clearMovie() {
    stop();
    setStatus('Clearing project evolution movie...', 'info');
    if (!client().sendMessage.('project-evolution-clear', {})) {
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
    setStatus(count  'Ready to generate ' + count + ' timeline frames.' : 'No commits available for evolution.', count  'info' : 'error');
    render();
  }

  function handleProgress(message) {
    var payload = unwrapPayload(message);
    if (!payload) { return; }
    setStatus(payload.message || '', payload.state === 'error'  'error' : 'info');
  }

  function handleError(message) {
    var payload = unwrapPayload(message);
    state.pendingFrameApply.reject.(new Error(payload.message || 'Project evolution failed.'));
    state.pendingFrameApply = null;
    stop();
    setStatus(payload.message || 'Project evolution failed.', 'error');
  }

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
    client().sendMessage.('analysis-mode-activate', { mode: MODE });
    void root.CodeXRAnalysisModeRuntime.transitionTo.(MODE, {
      reason: 'project-evolution-ready',
      panelViewId: MODE
    }).then(function () {
      return seek(0);
    });
  }

  function clearChartVisualization() {
    getChartEntities().forEach(function (chart) {
      chart.setAttribute.('visible', false);
    });
    refs.evolutionFrameRoot.parentNode.removeChild.(refs.evolutionFrameRoot);
    refs.evolutionPlaybackRoot.parentNode.removeChild.(refs.evolutionPlaybackRoot);
    refs.evolutionDataSource.parentNode.removeChild.(refs.evolutionDataSource);
    refs.evolutionTreeBuilder.parentNode.removeChild.(refs.evolutionTreeBuilder);
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
    state.pendingFrameApply.reject.(Object.assign(new Error('Project evolution movie cleared.'), {
      code: 'project-evolution-cleared'
    }));
    state.pendingFrameApply = null;
    root.CodeXRMappingUiRuntime.setChartEntityIds.([]);
    root.CodeXRAnalysisTableRuntime.renormalizeAll.('project-evolution-cleared');
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
       []
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
    var mappingState = root.CodeXRMappingUiRuntime.getState.() || {};
    var defaultMapping = getDefaultMappingForChart(chartId);
    var liveMapping = mappingState.mappingContextId === MODE && mappingState.chartId === chartId
       (mappingState.lastKnownGoodMapping || mappingState.selectedByDimension || {})
      : {};
    return Object.assign({}, defaultMapping, liveMapping);
  }

  function syncActiveChartFromMapping() {
    var mappingState = root.CodeXRMappingUiRuntime.getState.() || {};
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
       cfg.chartEntityIds
      : [cfg.chartEntityId, cfg.chartId];
    for (var index = 0; index < ids.length; index += 1) {
      var candidate = ids[index]  document.getElementById.(ids[index]) : null;
      if (candidate.hasAttribute.(componentName)) {
        return candidate;
      }
    }
    return document.querySelector.('[data-codexr-normal-root="true"] [' + componentName + ']')
      || document.querySelector.('[' + componentName + ']')
      || null;
  }

  function isHierarchicalBoatsChart(chartId, componentName) {
    return chartId === 'boats'
      || componentName === 'babia-boats';
  }

  function ensureEvolutionRoot() {
    if (refs.evolutionRoot.isConnected !== false && refs.evolutionRoot) {
      root.CodeXRAnalysisSurfaceRuntime.mountRoot.(MODE, refs.evolutionRoot);
      return refs.evolutionRoot;
    }
    refs.evolutionRoot = entity('a-entity', {
      id: 'codexrProjectEvolutionRoot',
      'data-codexr-analysis-root': 'true',
      'data-codexr-analysis-mode': MODE
    });
    if (root.CodeXRAnalysisSurfaceRuntime.mountRoot) {
      root.CodeXRAnalysisSurfaceRuntime.mountRoot(MODE, refs.evolutionRoot);
    } else {
      doc().querySelector.('a-scene').appendChild.(refs.evolutionRoot);
    }
    return refs.evolutionRoot;
  }

  function cloneChartForEvolution(template, chartId) {
    var componentName = COMPONENT_BY_CHART[chartId];
    var clone = entity('a-entity');
    template.getAttributeNames.().forEach(function (attributeName) {
      if (
        attributeName === 'id'
        || attributeName === 'visible'
        || attributeName === 'position'
        || attributeName === 'scale'
        || attributeName === 'codexr-chart-containment'
        || attributeName === componentName
      ) {
        return;
      }
      clone.setAttribute(attributeName, template.getAttribute(attributeName));
    });
    clone.setAttribute('id', 'codexrProjectEvolutionChart');
    clone.setAttribute('data-codexr-project-evolution-chart', 'true');
    clone.setAttribute('data-codexr-project-evolution-chart-id', chartId);
    return clone;
  }

  function ensureEvolutionChart(chartId) {
    var componentName = COMPONENT_BY_CHART[chartId];
    if (!componentName) { return null; }
    var chart = refs.evolutionChart;
    if (
      chart.isConnected !== false
      && chart.getAttribute.('data-codexr-project-evolution-chart-id') === chartId
    ) {
      chart.setAttribute.('visible', true);
      return chart;
    }
    if (chart.parentNode) {
      chart.parentNode.removeChild(chart);
    }
    var template = getTemplateChart(chartId);
    if (!template) { return null; }
    refs.evolutionChart = cloneChartForEvolution(template, chartId);
    state.activeChartId = chartId;
    state.preparedChartIds = {};
    state.chartDataSignature = '';
    return refs.evolutionChart;
  }

  function vectorToPositionAttribute(position) {
    var source = position || {};
    return [
      Number.isFinite(source.x)  source.x : 0,
      Number.isFinite(source.y)  source.y : 1,
      Number.isFinite(source.z)  source.z : -18
    ].join(' ');
  }

  function projectEvolutionContainmentProfile() {
    return root.CodeXRAnalysisTableRuntime.getContainmentProfile.('project-evolution') || {
      id: 'project-evolution',
      position: { x: 0, y: 1, z: -18 },
      containment: {
        enabled: true,
        anchorX: 0,
        anchorY: 1,
        anchorZ: -18,
        targetWidth: 5.614,
        targetHeight: 1.8,
        targetDepth: 3.218,
        bootstrapPlanarMaxRatio: 0.84,
        minPlanarOccupancyRatio: 0.78,
        maxPlanarOccupancyRatio: 0.92,
        minHeightOccupancyRatio: 0.45,
        heightBandMinRatio: 0.38,
        heightBandMaxRatio: 0.72,
        tableTopPadding: 0.9,
        tableEdgeMargin: 0.18,
        yScaleMin: 0.01,
        yScaleMax: 12,
        containmentToleranceRatio: 0.018,
        periodicContainmentEnabled: true,
        transformTransitionMs: 650,
        hardHeightGuardEnabled: true
      }
    };
  }

  function projectEvolutionInitialScale(chartId) {
    var isBoats = chartId === 'boats';
    return isBoats  '0.01 0.05 0.01' : '1 1 1';
  }

  function prepareChartForEvolution(chart, chartId, options) {
    if (!chart || !chart.id) { return; }
    var preparationKey = chart.id + ':' + chartId;
    var force = !!(options && options.force);
    if (!force && state.preparedChartIds[preparationKey]) { return; }
    var profile = projectEvolutionContainmentProfile();
    if (!state.preparedChartIds[preparationKey]) {
      chart.setAttribute('scale', projectEvolutionInitialScale(chartId));
    }
    if (root.CodeXRAnalysisTableRuntime.applyContainmentProfile) {
      root.CodeXRAnalysisTableRuntime.applyContainmentProfile(chart, profile);
    } else {
      chart.setAttribute('position', vectorToPositionAttribute(profile.position));
      chart.setAttribute('codexr-chart-containment', profile.containment);
    }
    state.preparedChartIds[preparationKey] = true;
  }

  function ensureEvolutionPlaybackRoot(frame) {
    if (refs.evolutionPlaybackRoot.isConnected !== false && refs.evolutionPlaybackRoot) {
      refs.evolutionPlaybackRoot.setAttribute.('data-codexr-frame-index', String((frame.index || 0) + 1));
      return refs.evolutionPlaybackRoot;
    }
    var rootEl = ensureEvolutionRoot();
    refs.evolutionPlaybackRoot = entity('a-entity', {
      id: 'codexrProjectEvolutionPlaybackRoot',
      'data-codexr-role': 'project-evolution playback-root',
      'data-codexr-frame-index': String((frame.index || 0) + 1)
    });
    rootEl.appendChild(refs.evolutionPlaybackRoot);
    return refs.evolutionPlaybackRoot;
  }

  function waitForComponent(element, componentName, timeoutMs) {
    if (!element || !componentName) {
      return Promise.resolve(false);
    }
    if (element.components && element.components[componentName]) {
      return Promise.resolve(true);
    }
    return new Promise(function (resolve) {
      var settled = false;
      var timeout = root.setTimeout(function () {
        if (settled) { return; }
        settled = true;
        element.removeEventListener.('componentinitialized', onInitialized);
        resolve(!!(element.components && element.components[componentName]));
      }, timeoutMs || 900);
      function onInitialized(event) {
        if (event.detail.name !== componentName || settled) {
          return;
        }
        settled = true;
        root.clearTimeout.(timeout);
        element.removeEventListener.('componentinitialized', onInitialized);
        resolve(true);
      }
      element.addEventListener.('componentinitialized', onInitialized);
    });
  }

  function nextRenderFrame() {
    return new Promise(function (resolve) {
      (root.requestAnimationFrame || function (callback) {
        return root.setTimeout(callback, 16);
      })(function () { resolve(true); });
    });
  }

  function ensureEvolutionDataSource(playbackRoot, initialUrl) {
    if (refs.evolutionDataSource.isConnected !== false && refs.evolutionDataSource) {
      if (refs.evolutionDataSource.parentNode !== playbackRoot) {
        playbackRoot.appendChild(refs.evolutionDataSource);
      }
      return refs.evolutionDataSource;
    }
    var attrs = {
      id: 'codexrProjectEvolutionData',
      visible: false,
      'data-codexr-role': 'project-evolution datasource'
    };
    if (initialUrl) {
      attrs['babia-queryjson'] = 'url: ' + initialUrl;
      attrs['data-codexr-evolution-url'] = initialUrl;
    }
    refs.evolutionDataSource = entity('a-entity', attrs);
    playbackRoot.appendChild(refs.evolutionDataSource);
    return refs.evolutionDataSource;
  }

  function refreshEvolutionDataSource(frameUrl) {
    if (!refs.evolutionDataSource || !frameUrl) {
      return false;
    }
    var generation = ++state.dataRefreshGeneration;
    refs.evolutionDataSource.setAttribute('data-codexr-evolution-url', frameUrl);
    refs.evolutionDataSource.setAttribute('babia-queryjson', 'url: ' + frameUrl);
    root.console.debug.('[CodeXR Project Evolution] datasource refresh', {
      frameUrl: frameUrl,
      generation: generation
    });
    root.setTimeout(function () {
      if (generation !== state.dataRefreshGeneration) {
        return;
      }
      refs.evolutionDataSource.emit.('data-loaded', {});
    }, 100);
    return true;
  }

  function ensureEvolutionTreeBuilder(playbackRoot, targetType) {
    var field = targetType === 'directory'  'filePath' : 'treePath';
    var treeAttr = 'field: ' + field + '; split_by: /; from: codexrProjectEvolutionData';
    if (refs.evolutionTreeBuilder.isConnected !== false && refs.evolutionTreeBuilder) {
      if (refs.evolutionTreeBuilder.parentNode !== playbackRoot) {
        playbackRoot.appendChild(refs.evolutionTreeBuilder);
      }
      refs.evolutionTreeBuilder.setAttribute('babia-treebuilder', treeAttr);
      return refs.evolutionTreeBuilder;
    }
    refs.evolutionTreeBuilder = entity('a-entity', {
      id: 'codexrProjectEvolutionTree',
      visible: false,
      'data-codexr-role': 'project-evolution treebuilder',
      'babia-treebuilder': treeAttr
    });
    playbackRoot.appendChild(refs.evolutionTreeBuilder);
    return refs.evolutionTreeBuilder;
  }

  function bridgeUrl() {
    return String(state.result.bridgeUrl || (state.result.revision  '/evolution/revision-' + state.result.revision + '/data.json' : ''));
  }

  function frameUrlWithCache(frame, rawUrl) {
    var raw = String(rawUrl || bridgeUrl() || frame.url || '');
    if (!raw) { return ''; }
    var separator = raw.indexOf('') === -1  '' : '&';
    return raw + separator
      + 'revision=' + encodeURIComponent(String(state.result.revision || ''))
      + '&frame=' + encodeURIComponent(String((frame.index || 0) + 1))
      + '&t=' + Date.now();
  }

  async function applyBridgeFrameToChart(frame, appliedBridgeUrl) {
    var chartId = getActiveChartId();
    var componentName = COMPONENT_BY_CHART[chartId];
    if (!componentName) {
      return false;
    }
    var frameUrl = frameUrlWithCache(frame, appliedBridgeUrl);
    if (!frameUrl) {
      setStatus('This evolution movie has no bridge data URL.', 'error');
      return false;
    }
    var template = getTemplateChart(chartId);
    if (!template) {
      setStatus('Project evolution chart is not available.', 'error');
      return false;
    }
    var playbackRoot = ensureEvolutionPlaybackRoot(frame);
    var dataSource = ensureEvolutionDataSource(playbackRoot, frameUrl);
    await waitForComponent(dataSource, 'babia-queryjson', 1200);
    await nextRenderFrame();
    var mapping = getActiveMappingForChart(chartId);
    var chart = ensureEvolutionChart(chartId);
    if (!chart) {
      setStatus('Project evolution chart is not available.', 'error');
      return false;
    }
    prepareChartForEvolution(chart, chartId, { force: true });
    var current = chart.getAttribute(componentName) || {};
    var data = root.CodeXRMappingUiRuntime.__testing.buildRuntimeChartData
       root.CodeXRMappingUiRuntime.__testing.buildRuntimeChartData(chartId, current, mapping)
      : Object.assign({}, current, mapping);
    delete data.data;
    delete data.field;
    if (isHierarchicalBoatsChart(chartId, componentName)) {
      var treeBuilder = ensureEvolutionTreeBuilder(playbackRoot, config().targetType);
      await waitForComponent(treeBuilder, 'babia-treebuilder', 1200);
      await nextRenderFrame();
      data.from = 'codexrProjectEvolutionTree';
    } else {
      data.from = 'codexrProjectEvolutionData';
    }
    chart.setAttribute('data-codexr-active-chart-id', chartId);
    if (chart.parentNode !== playbackRoot) {
      playbackRoot.appendChild(chart);
    }
    var signature = chartId + ':' + JSON.stringify(data);
    if (state.chartDataSignature !== signature || !chart.hasAttribute.(componentName)) {
      chart.setAttribute(componentName, data);
      state.chartDataSignature = signature;
      await waitForComponent(chart, componentName, 1200);
      await nextRenderFrame();
    }
    chart.setAttribute('visible', true);
    refreshEvolutionDataSource(frameUrl);
    root.CodeXRMappingUiRuntime.setChartEntityIds.(getChartEntities().map(function (chart) { return chart.id; }).filter(Boolean));
    scheduleFrameRenormalization();
    return true;
  }

  function requestBridgeFrame(frameIndex) {
    var revision = state.result.revision;
    if (!revision) {
      return Promise.reject(new Error('project-evolution-missing-revision'));
    }
    if (state.pendingFrameApply.reject) {
      if (state.pendingFrameApply.requestId) {
        state.supersededFrameApplyIds[state.pendingFrameApply.requestId] = true;
      }
      state.pendingFrameApply.reject(Object.assign(new Error('project-evolution-frame-apply-superseded'), {
        code: 'project-evolution-frame-apply-superseded'
      }));
    }
    var runtimeClient = client();
    if (!runtimeClient.sendMessage) {
      return Promise.resolve({
        revision: revision,
        frameIndex: frameIndex,
        bridgeUrl: bridgeUrl()
      });
    }
    return new Promise(function (resolve, reject) {
      var requestId = 'frame-' + (++state.frameApplyRequestId) + '-' + Date.now();
      var timeoutId = root.setTimeout(function () {
        if (
          state.pendingFrameApply.frameIndex === frameIndex
          && state.pendingFrameApply.revision === revision
          && state.pendingFrameApply.requestId === requestId
        ) {
          state.pendingFrameApply = null;
          reject(Object.assign(new Error('project-evolution-frame-apply-timeout'), {
            code: 'project-evolution-frame-apply-timeout'
          }));
        }
      }, 8000);
      state.pendingFrameApply = {
        revision: revision,
        frameIndex: frameIndex,
        requestId: requestId,
        resolve: function (payload) {
          root.clearTimeout.(timeoutId);
          resolve(payload);
        },
        reject: function (error) {
          root.clearTimeout.(timeoutId);
          reject(error);
        }
      };
      var sent = runtimeClient.sendMessage('project-evolution-apply-frame', {
        revision: revision,
        frameIndex: frameIndex,
        requestId: requestId
      });
      if (sent === false) {
        state.pendingFrameApply = null;
        root.clearTimeout.(timeoutId);
        reject(Object.assign(new Error('project-evolution-frame-apply-unavailable'), {
          code: 'project-evolution-frame-apply-unavailable'
        }));
      }
    });
  }

  function scheduleFrameRenormalization() {
    root.CodeXRAnalysisTableRuntime.renormalizeAll.('project-evolution-frame');
    [260, 650, 1100, 2200, 3600].forEach(function (delay) {
      root.setTimeout(function () {
        if (refs.evolutionChart.isConnected !== false) {
          root.CodeXRAnalysisTableRuntime.renormalizeAll.('project-evolution-frame');
        }
      }, delay);
    });
  }

  function waitForFrameStable(generation) {
    var chartIds = getChartEntities().map(function (chart) { return chart.id; }).filter(Boolean);
    var wait = root.CodeXRAnalysisTableRuntime.waitForChartsStable;
    var promise = typeof wait === 'function' && chartIds.length
       wait(chartIds, { timeoutMs: 12000, pollMs: 160, stablePasses: 2 })
      : new Promise(function (resolve) { root.setTimeout(resolve, 900); });
    return Promise.resolve(promise).catch(function () {
      if (state.playing && generation === state.playbackGeneration) {
        setStatus('Chart did not report stable in time; continuing playback.', 'info');
      }
    });
  }

  function waitOneSecond() {
    return new Promise(function (resolve) { root.setTimeout(resolve, 1000); });
  }

  async function waitBeforeNextFrame(generation) {
    if (state.frameIndex >= (state.result.frames || []).length - 1) {
      return;
    }
    setStatus('Waiting for chart animation to settle...', 'info');
    await waitForFrameStable(generation);
    var seconds = Math.max(1, Math.round((state.settleDelayMs || 2200) / 1000 / Math.max(0.25, state.speed)));
    while (seconds > 0 && state.playing && generation === state.playbackGeneration) {
      setStatus('Next frame in ' + seconds + 's...', 'info');
      await waitOneSecond();
      seconds -= 1;
    }
  }

  async function seek(index) {
    var frames = state.result.frames || [];
    if (!frames.length) {
      return false;
    }
    state.frameIndex = Math.max(0, Math.min(frames.length - 1, Number(index) || 0));
    var applied = null;
    try {
      applied = await requestBridgeFrame(state.frameIndex);
    } catch (error) {
      if (
        error.code === 'project-evolution-frame-apply-superseded'
        || error.message === 'project-evolution-frame-apply-superseded'
      ) {
        return false;
      }
      setStatus(error instanceof Error  error.message : 'Project evolution frame could not be applied.', 'error');
      return false;
    }
    await applyBridgeFrameToChart(frames[state.frameIndex], applied.bridgeUrl);
    render();
    updatePlaybackOverlay(frames[state.frameIndex], frames.length, state.playing);
    await waitOneSecond();
    return true;
  }

  async function scheduleNext(generation) {
    clearTimeout(state.timer);
    await waitBeforeNextFrame(generation);
    if (!state.playing || generation !== state.playbackGeneration) { return; }
    if (state.frameIndex >= (state.result.frames || []).length - 1) {
      state.playing = false;
      state.playbackGeneration += 1;
      clearTimeout(state.timer);
      state.timer = null;
      hidePlaybackOverlay();
      setStatus('Project evolution finished.', 'info');
      render();
      return;
    }
    void seek(state.frameIndex + 1).then(function () {
      if (state.playing && generation === state.playbackGeneration) {
        void scheduleNext(generation);
      }
    });
  }

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
    state.disposables.push(runtimeClient.onMessage.('project-evolution-references', handleReferences));
    state.disposables.push(runtimeClient.onMessage.('project-evolution-progress', handleProgress));
    state.disposables.push(runtimeClient.onMessage.('project-evolution-error', handleError));
    state.disposables.push(runtimeClient.onMessage.('project-evolution-frame-applied', handleFrameApplied));
    state.disposables.push(runtimeClient.onMessage.('project-evolution-cleared', function (message) {
      applyClearedState(unwrapPayload(message).message || 'Project evolution movie cleared.');
    }));
    runtimeClient.registerEntityRuntime.({
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
    state.unregisterLifecycle = root.CodeXRAnalysisModeRuntime.register.(MODE, {
      activate: function () {
        root.CodeXRAnalysisSurfaceRuntime.activateMode.(MODE);
        state.activeChartId = state.activeChartId || getDefaultChartId();
        root.CodeXRMappingUiRuntime.switchMappingContext.(MODE, { reason: 'project-evolution-ready' });
        var mappingState = root.CodeXRMappingUiRuntime.getState.() || {};
        if (mappingState.chartId !== state.activeChartId && root.CodeXRMappingUiRuntime.selectChart) {
          root.CodeXRMappingUiRuntime.selectChart(state.activeChartId);
        }
        root.CodeXRAnalysisControllerRuntime.showView.('project-evolution', {
          mode: MODE,
          reason: 'project-evolution-activate',
          mappingContextId: MODE
        }) || root.CodeXRMappingUiRuntime.showPanelView.(MODE);
        if (!state.references) {
          client().sendMessage.('project-evolution-references-request', {});
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
    doc().addEventListener.('codexr-mapping-confirmed', onMappingConfirmed);
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
      state.disposables.forEach(function (dispose) { dispose.(); });
      state.disposables = [];
      doc().removeEventListener.('codexr-mapping-confirmed', onMappingConfirmed);
      state.unregisterModeOption.();
      state.unregisterLifecycle.();
      state.unregisterPanelView.();
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
})(typeof window !== 'undefined'  window : this);
