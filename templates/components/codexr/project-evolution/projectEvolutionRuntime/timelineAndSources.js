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
      state.selectionPage = 0;
    }
    state.timelineMode = nextMode;
    render();
  }

  function setRangeSide(side) {
    state.rangeSide = side === 'end' ? 'end' : 'start';
    render();
  }

  function getReferenceSources() {
    // References stay null until the server answers; every render path
    // (including stop() during deactivate) must tolerate that.
    var references = state.references || {};
    var sources = Array.isArray(references.sources) ? references.sources : [];
    var byId = {};
    sources.forEach(function (source) { byId[source.id] = source; });
    var suggested = Array.isArray(references.suggestedSourceIds)
      ? references.suggestedSourceIds.map(function (id) { return byId[id]; }).filter(Boolean)
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
    return textValue.length > limit ? textValue.slice(0, Math.max(1, limit - 3)) + '...' : textValue;
  }

  function sourceDescription(source) {
    if (!source) { return 'Not selected'; }
    var description = source.description ? ' - ' + source.description : '';
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
      ? state.references.suggestedSourceIds
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
    var date = explicitDate || (match ? match[1] : '');
    var subject = match ? match[2] : description;
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
      material: 'color: ' + (selected ? (stateInfo.color || '#be123c') : '#1e3a5f') + '; opacity: 0.95; shader: flat',
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
    var sources = Array.isArray(state.references.sources) ? state.references.sources : [];
    return sources.find(function (source) { return source.id === sourceId; }) || null;
  }

  function sceneEl() {
    return doc().querySelector?.('a-scene') || doc().body || null;
  }
