// == projectEvolutionRuntime.js | timelineAndSources (assembled per manifest.json; see COMPONENTS.md) ==
  function unwrapPayload(message) {
    return message && typeof message === 'object' && Object.prototype.hasOwnProperty.call(message, 'payload')
      ? message.payload
      : message;
  }

  function setTimelineMode(mode) {
    var nextMode = mode === 'range' || mode === 'manual' ? mode : 'auto';
    if (state.timelineMode !== nextMode) {
      state.startSourceId = '';
      state.endSourceId = '';
      state.manualSourceIds = [];
      state.rangeSide = 'start';
    }
    state.timelineMode = nextMode;
    render();
  }

  function setRangeSide(side) {
    state.rangeSide = side === 'end' ? 'end' : 'start';
    render();
  }

  function compact(value, limit) {
    var textValue = String(value || '');
    return textValue.length > limit ? textValue.slice(0, Math.max(1, limit - 3)) + '...' : textValue;
  }

  // The shared git-ref-picker runtime owns source descriptions, but it is
  // presentation chrome: if it is missing, playback must keep running on the
  // raw source fields instead of dying inside play() with `playing` stuck on.
  function describeSourceSafe(source) {
    var picker = root.CodeXRGitRefPickerRuntime;
    if (picker?.describeSource) {
      return picker.describeSource(source);
    }
    var description = String(source?.description || '');
    var dateMatch = description.match(/^(\d{4}-\d{2}-\d{2})/);
    return {
      label: String(source?.label || source?.id || 'unknown'),
      date: String(source?.date || (dateMatch ? dateMatch[1] : '')),
      subject: '',
      typeLabel: String(source?.revisionType || source?.refType || '')
    };
  }

  function sourceDescription(source) {
    if (!source) { return 'Not selected'; }
    var described = describeSourceSafe(source);
    var subject = described.subject ? ' - ' + described.subject : '';
    return compact(described.label + subject, 56);
  }

  function getSuggestedAutoOrderById() {
    var order = {};
    // References stay null until the server answers; stop() renders during
    // deactivate, so this must not assume the mode was ever opened.
    var references = state.references || {};
    var ids = Array.isArray(references.suggestedSourceIds)
      ? references.suggestedSourceIds
      : [];
    ids.forEach(function (id, index) {
      if (id && order[id] === undefined) {
        order[id] = index + 1;
      }
    });
    return order;
  }

  // Now-showing / playback-overlay text reuses the shared vocabulary.
  function splitSourceDescription(source) {
    var described = describeSourceSafe(source);
    return {
      label: compact(described.label, 16),
      date: described.date,
      subject: compact(described.subject, 42),
      type: described.typeLabel
    };
  }

  // ── Playback chrome: timeline bar, generation progress, evolution sparkline ──
  // All three are pooled: nodes are created once here and later updated by
  // attribute only (the controller panel watches childList mutations).

  var TIMELINE_MAX_TICKS = 40;
  var TIMELINE_WIDTH = 5.4;

  // `store` keeps this instance's ticks/cursor, so the panel and the controller
  // companion can each own a bar without sharing nodes. `width` sizes THIS
  // instance: the shared constant overflowed the narrower companion column.
  function buildTimelineBar(store, width) {
    store.width = Number(width) || TIMELINE_WIDTH;
    var barRoot = entity('a-entity', { position: '0 0 0.02' });
    barRoot.appendChild(entity('a-plane', {
      position: '0 0 -0.005',
      width: store.width,
      height: 0.07,
      material: 'color: #1e293b; opacity: 0.9; shader: flat'
    }));
    // Clickable strip: seek to the frame under the pointer.
    var strip = entity('a-plane', {
      position: '0 0 0',
      width: store.width,
      height: 0.26,
      material: 'color: #000000; opacity: 0.001; transparent: true; shader: flat',
      class: 'babiaxraycasterclass codexr-project-evolution-button',
      'data-codexr-interactive': 'true'
    });
    strip.addEventListener('click', function (event) {
      var frames = state.result?.frames || [];
      // Seeking is locked while a chart/mapping change is being applied.
      if (!frames.length || state.applyingMapping) { return; }
      var localX = resolveLocalX(event, strip);
      var ratio = Math.min(1, Math.max(0, (localX + (store.width / 2)) / store.width));
      stop();
      seek(Math.round(ratio * (frames.length - 1)));
    });
    barRoot.appendChild(strip);
    store.ticks = [];
    for (var tickIndex = 0; tickIndex < TIMELINE_MAX_TICKS; tickIndex += 1) {
      var tick = entity('a-plane', {
        position: '0 0 0.001',
        width: 0.03,
        height: 0.16,
        material: 'color: #475569; opacity: 0.9; shader: flat',
        visible: 'false'
      });
      barRoot.appendChild(tick);
      store.ticks.push(tick);
    }
    store.cursor = entity('a-plane', {
      position: '0 0 0.003',
      width: 0.07,
      height: 0.28,
      material: 'color: #fde68a; opacity: 0.98; shader: flat',
      visible: 'false'
    });
    barRoot.appendChild(store.cursor);
    store.root = barRoot;
    return barRoot;
  }

  // Pointer x in the strip's own frame, so a click maps to a frame index.
  function resolveLocalX(event, strip) {
    var point = event?.detail?.intersection?.point;
    if (!point || !strip.object3D) { return 0; }
    var local = point.clone ? point.clone() : null;
    if (!local || !strip.object3D.worldToLocal) { return 0; }
    return strip.object3D.worldToLocal(local).x;
  }

  function renderTimelineBar(store) {
    if (!store?.root) { return; }
    var frames = state.result?.frames || [];
    var count = frames.length;
    var barWidth = store.width || TIMELINE_WIDTH;
    setNodeVisible(store.root, count > 0);
    if (!count) { return; }
    var shown = Math.min(count, TIMELINE_MAX_TICKS);
    store.ticks.forEach(function (tick, index) {
      var active = index < shown;
      setNodeVisible(tick, active);
      if (!active) { return; }
      var ratio = shown === 1 ? 0.5 : index / (shown - 1);
      tick.setAttribute('position', ((ratio - 0.5) * barWidth) + ' 0 0.001');
    });
    var cursorRatio = count === 1 ? 0.5 : state.frameIndex / (count - 1);
    store.cursor.setAttribute('position', ((cursorRatio - 0.5) * barWidth) + ' 0 0.003');
    setNodeVisible(store.cursor, true);
  }

  function buildProgressBar() {
    var progressRoot = entity('a-entity', { position: '0 0 0.02', visible: 'false' });
    progressRoot.appendChild(entity('a-plane', {
      position: '0 0 -0.005',
      width: TIMELINE_WIDTH,
      height: 0.14,
      material: 'color: #0b1220; opacity: 0.9; shader: flat'
    }));
    refs.progressFill = entity('a-plane', {
      position: (-TIMELINE_WIDTH / 2) + ' 0 0',
      width: 0.01,
      height: 0.14,
      material: 'color: #0e7490; opacity: 0.95; shader: flat'
    });
    progressRoot.appendChild(refs.progressFill);
    refs.progressLabel = smallText('', '0 0 0.01', 3.4, '#e0f2fe', 'center', 34);
    progressRoot.appendChild(refs.progressLabel);
    return progressRoot;
  }

  // Driven by project-evolution-progress, which already carries frameIndex and
  // frameCount — generating a movie takes a while and used to show only text.
  function renderGenerationProgress(payload) {
    if (!refs.progressRoot) { return; }
    var count = Number(payload?.frameCount) || 0;
    var index = Number(payload?.frameIndex) || 0;
    var analyzing = payload?.state === 'analyzing' && count > 0;
    setNodeVisible(refs.progressRoot, analyzing);
    if (!analyzing) { return; }
    var ratio = Math.min(1, Math.max(0, index / count));
    var width = Math.max(0.01, ratio * TIMELINE_WIDTH);
    refs.progressFill.setAttribute('width', width);
    // Grows from the left edge.
    refs.progressFill.setAttribute('position', ((width / 2) - (TIMELINE_WIDTH / 2)) + ' 0 0');
    refs.progressLabel.setAttribute('value', 'Generating frame ' + Math.min(index + 1, count) + ' / ' + count);
  }

  function buildSparkline() {
    var sparkRoot = entity('a-entity', { position: '0 0 0.02', visible: 'false' });
    // Relative to the sparkline root, which layoutPanel centres on the strip.
    sparkRoot.appendChild(smallText('Files per frame', (-TIMELINE_WIDTH / 2) + ' 0.2 0.01', 2.4, '#94a3b8', 'left', 26));
    refs.sparkBars = [];
    for (var barIndex = 0; barIndex < TIMELINE_MAX_TICKS; barIndex += 1) {
      var bar = entity('a-plane', {
        position: '0 0 0.001',
        width: 0.08,
        height: 0.02,
        material: 'color: #38bdf8; opacity: 0.85; shader: flat',
        visible: 'false'
      });
      sparkRoot.appendChild(bar);
      refs.sparkBars.push(bar);
    }
    return sparkRoot;
  }

  // itemCount already travels with every frame, so the trend costs no extra
  // request: each bar is one frame, the current one highlighted.
  function renderSparkline() {
    if (!refs.sparkline) { return; }
    var frames = state.result?.frames || [];
    var shown = Math.min(frames.length, TIMELINE_MAX_TICKS);
    setNodeVisible(refs.sparkline, shown > 1);
    if (shown <= 1) { return; }
    var counts = frames.slice(0, shown).map(function (frame) { return Number(frame?.itemCount) || 0; });
    var peak = Math.max.apply(null, counts.concat([1]));
    var maxHeight = 0.32;
    refs.sparkBars.forEach(function (bar, index) {
      var active = index < shown;
      setNodeVisible(bar, active);
      if (!active) { return; }
      var height = Math.max(0.02, (counts[index] / peak) * maxHeight);
      var ratio = shown === 1 ? 0.5 : index / (shown - 1);
      bar.setAttribute('height', height);
      bar.setAttribute('position', ((ratio - 0.5) * TIMELINE_WIDTH) + ' ' + (-0.12 + (height / 2)) + ' 0.001');
      bar.setAttribute(
        'material',
        'color: ' + (index === state.frameIndex ? '#fde68a' : '#38bdf8') + '; opacity: 0.9; shader: flat'
      );
    });
  }

  // ── Controller companion ────────────────────────────────────────────────
  // Child section of the Field Mapping view (same side placement Historical
  // uses): with the chart/axis controls on the left, this keeps the movie and
  // its transport on the right, so the chart can be re-mapped between frames.

  var COMPANION_WIDTH = 3.1;

  // Companion → timeline selection panel (mirror of Historical's "Change
  // comparison"). The explicit view wins over the lifecycle resolver, so this
  // reaches the selection panel even while a movie exists.
  function showMovieSelectionView() {
    root.CodeXRAnalysisControllerRuntime?.showView?.('project-evolution.playback', {
      mode: MODE,
      reason: 'project-evolution-change-movie',
      mappingContextId: MODE
    }) || root.CodeXRMappingUiRuntime?.showPanelView?.(MODE);
  }

  // Selection panel → Field Mapping view without regenerating (mirror of
  // Historical's closePanel). Only meaningful once a movie exists.
  function showMovieMappingView() {
    root.CodeXRAnalysisControllerRuntime?.showView?.('project-evolution.mapping', {
      mode: MODE,
      reason: 'project-evolution-open-mapping',
      mappingContextId: MODE
    }) || root.CodeXRMappingUiRuntime?.showPanelView?.('mapping');
  }

  // Companion column geometry: the mapping-ui reserves COMPANION_WIDTH; the
  // framing card (same chrome as the historical COMPARISON card) sits inside,
  // and every child stays within its ±1.4 content strip.
  var COMPANION_CARD_W = 2.98;
  var COMPANION_BAR_W = 2.6;
  var COMPANION_SPEED_W = 0.86;

  function buildMovieCompanion(mappingRuntime) {
    if (refs.companionRoot || !mappingRuntime?.registerMappingCompanion) { return; }
    refs.companionRoot = entity('a-entity', {});
    // Framing card (border behind a subtle fill) so the column reads as one
    // cohesive section instead of loose elements floating on the panel.
    refs.companionCardBorder = entity('a-plane', {
      position: '0 0 -0.04', width: COMPANION_CARD_W + 0.06, height: 1,
      material: 'color: #2b3a55; opacity: 0.55; shader: flat'
    });
    refs.companionCard = entity('a-plane', {
      position: '0 0 -0.03', width: COMPANION_CARD_W, height: 1,
      material: 'color: #0e1526; opacity: 0.66; shader: flat'
    });
    refs.companionRoot.appendChild(refs.companionCardBorder);
    refs.companionRoot.appendChild(refs.companionCard);
    // Section title + accent underline, in the movie's amber.
    refs.companionTitle = smallText('PROJECT EVOLUTION', '0 0 0.01', 2.3, '#f59e0b', 'center', 22);
    refs.companionUnderline = entity('a-plane', {
      position: '0 0 -0.005', width: 2.4, height: 0.012,
      material: 'color: #f59e0b; opacity: 0.85; shader: flat'
    });
    refs.companionRoot.appendChild(refs.companionTitle);
    refs.companionRoot.appendChild(refs.companionUnderline);
    refs.companionFrame = smallText('No movie loaded', '0 0 0.01', 2.7, '#e0f2fe', 'center', 26);
    refs.companionRoot.appendChild(refs.companionFrame);
    refs.companionDetail = smallText('', '0 0 0.01', 2.8, '#94a3b8', 'center', 36);
    refs.companionRoot.appendChild(refs.companionDetail);
    refs.companionTimeline = {};
    refs.companionBar = buildTimelineBar(refs.companionTimeline, COMPANION_BAR_W);
    refs.companionRoot.appendChild(refs.companionBar);
    refs.companionTransport = entity('a-entity', { position: '0 0 0.02' });
    refs.companionPrev = button('Prev', '-1.0 0 0', 0.9, previousFrame, '#1e3a5f', { height: 0.34, textWidth: 1.2, wrapCount: 12 });
    refs.companionPlay = button('Play', '0 0 0', 0.9, togglePlay, '#0e7490', { height: 0.34, textWidth: 1.2, wrapCount: 12 });
    refs.companionNext = button('Next', '1.0 0 0', 0.9, nextFrame, '#1e3a5f', { height: 0.34, textWidth: 1.2, wrapCount: 12 });
    refs.companionTransport.appendChild(refs.companionPrev);
    refs.companionTransport.appendChild(refs.companionPlay);
    refs.companionTransport.appendChild(refs.companionNext);
    refs.companionRoot.appendChild(refs.companionTransport);
    // Speed shortcuts: same labels and atom as the panel, narrowed to the
    // column (extremes at ±1.33, inside the card's ±1.4 content strip).
    refs.companionSpeedRoot = entity('a-entity', { position: '0 0 0.02' });
    refs.companionSpeedRoot.appendChild(speedButton('0.5x', '-0.9 0 0', 0.5, COMPANION_SPEED_W));
    refs.companionSpeedRoot.appendChild(speedButton('1x', '0 0 0', 1, COMPANION_SPEED_W));
    refs.companionSpeedRoot.appendChild(speedButton('2x', '0.9 0 0', 2, COMPANION_SPEED_W));
    refs.companionRoot.appendChild(refs.companionSpeedRoot);
    refs.companionCountdown = smallText('', '0 0 0.01', 2.7, '#67e8f9', 'center', 30);
    refs.companionRoot.appendChild(refs.companionCountdown);
    refs.companionHint = smallText('', '0 0 0.01', 2.7, '#fde68a', 'center', 34);
    refs.companionRoot.appendChild(refs.companionHint);
    refs.companionBack = button('Change movie', '0 0 0', 2.2, showMovieSelectionView, '#be123c', { height: 0.38, textWidth: 2.8, wrapCount: 18 });
    refs.companionRoot.appendChild(refs.companionBack);

    state.unregisterMappingCompanion = mappingRuntime.registerMappingCompanion(MODE, {
      content: refs.companionRoot,
      placement: 'side',
      width: COMPANION_WIDTH,
      title: 'Field Mapping - Project evolution',
      layout: layoutMovieCompanion
    }) || null;
    layoutMovieCompanion(6.45);
    renderMovieCompanion();
  }

  // Fills the column like the historical card: the frame stretches to the
  // available height, the info group hangs from the top, Change movie is
  // pinned to the bottom edge, and the playback group centres in between.
  function layoutMovieCompanion(availableHeight) {
    if (!refs.companionRoot) { return; }
    var height = Number(availableHeight) || 6.45;
    var cardTop = 0.12;
    var cardBottom = -(height - 0.18);
    var cardHeight = Math.max(0.6, cardTop - cardBottom);
    var cardCentre = (cardTop + cardBottom) / 2;
    refs.companionCard?.setAttribute?.('height', cardHeight);
    refs.companionCard?.setAttribute?.('position', '0 ' + cardCentre + ' -0.03');
    refs.companionCardBorder?.setAttribute?.('height', cardHeight + 0.06);
    refs.companionCardBorder?.setAttribute?.('position', '0 ' + cardCentre + ' -0.04');

    // Top group: title + underline + frame counter + commit detail.
    var titleY = cardTop - 0.28;
    refs.companionTitle?.setAttribute?.('position', '0 ' + titleY + ' 0.01');
    refs.companionUnderline?.setAttribute?.('position', '0 ' + (titleY - 0.17) + ' -0.005');
    var frameY = titleY - 0.55;
    refs.companionFrame?.setAttribute?.('position', '0 ' + frameY + ' 0.01');
    var detailY = frameY - 0.3;
    refs.companionDetail?.setAttribute?.('position', '0 ' + detailY + ' 0.01');
    var topGroupBottom = detailY - 0.26;

    // Bottom group: the action pinned near the card's lower edge.
    var buttonY = cardBottom + 0.34;
    refs.companionBack?.setAttribute?.('position', '0 ' + buttonY + ' 0.02');
    var bottomGroupTop = buttonY + 0.34;

    // Middle group: timeline bar, transport, speed shortcuts, the countdown
    // to the next frame and the lock hint, spread around the centre of
    // whatever space is free between the two anchored groups.
    var midCentre = (topGroupBottom + bottomGroupTop) / 2;
    refs.companionBar?.setAttribute?.('position', '0 ' + (midCentre + 1.04) + ' 0.02');
    refs.companionTransport?.setAttribute?.('position', '0 ' + (midCentre + 0.52) + ' 0.02');
    refs.companionSpeedRoot?.setAttribute?.('position', '0 ' + midCentre + ' 0.02');
    refs.companionCountdown?.setAttribute?.('position', '0 ' + (midCentre - 0.52) + ' 0.01');
    refs.companionHint?.setAttribute?.('position', '0 ' + (midCentre - 1.04) + ' 0.01');
    // Visibility is NOT touched here: the mapping-ui's syncMappingCompanion is
    // the only owner. Forcing it visible from the layout leaked this section
    // into every other analysis' mapping view.
    return height;
  }

  // Mirrors the panel: current frame, timeline cursor, Play/Pause label, and
  // why a control is currently locked.
  function renderMovieCompanion() {
    if (!refs.companionRoot) { return; }
    var frames = state.result?.frames || [];
    var frame = frames[state.frameIndex];
    var parts = frames.length ? splitSourceDescription(frame?.source || frame) : null;
    refs.companionFrame?.setAttribute('value', frames.length
      ? 'Frame ' + (state.frameIndex + 1) + ' / ' + frames.length
      : 'No movie loaded');
    refs.companionDetail?.setAttribute('value', parts
      ? compact(parts.date + ' | ' + parts.label + (parts.subject ? ' - ' + parts.subject : ''), 44)
      : '');
    renderTimelineBar(refs.companionTimeline);
    setButtonText(refs.companionPlay, state.playing ? 'Pause' : 'Play');
    paintSpeedRow(refs.companionSpeedRoot);
    refs.companionCountdown?.setAttribute('value', playbackCountdownText());
    refs.companionHint?.setAttribute('value', movieLockHint());
  }

  // How long until the movie advances. Empty while stopped: the line only
  // speaks when there is a wait to report.
  function playbackCountdownText() {
    if (!state.playing) { return ''; }
    if (state.frameIndex >= ((state.result?.frames || []).length - 1)) { return 'Last frame'; }
    return state.nextFrameSeconds > 0
      ? 'Next frame in ' + state.nextFrameSeconds + 's'
      : 'Preparing next frame...';
  }

  // Highlights the speed the movie is actually running at. Shared by the
  // panel row and the companion row so both always agree.
  function paintSpeedRow(rootEntity) {
    if (!rootEntity) { return; }
    [0.5, 1, 2].forEach(function (speed, index) {
      paintButton(rootEntity, index, state.speed === speed ? '#0e7490' : '#334155');
    });
  }

  // One sentence explaining the current safety lock, or empty when free.
  function movieLockHint() {
    if (state.applyingMapping) { return 'Applying chart change...'; }
    if (state.playing) { return 'Pause to change chart or axes.'; }
    if (!(state.result?.frames || []).length) { return 'Generate a movie to play it here.'; }
    return 'Paused: chart and axes can be changed.';
  }

  function setButtonText(buttonEl, value) {
    var label = buttonEl && (buttonEl._codexrLabel || buttonEl.querySelector?.('a-text'));
    label?.setAttribute?.('value', value);
  }

  function buildNowShowingCard() {
    var card = entity('a-plane', {
      // Positioned by layoutPanel.
      position: '0 0 0.02',
      width: PANEL_LAYOUT.contentWidth,
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
    var sources = Array.isArray(state.references.sources) ? state.references.sources : [];
    return sources.find(function (source) { return source.id === sourceId; }) || null;
  }

  function sceneEl() {
    return doc().querySelector?.('a-scene') || doc().body || null;
  }
