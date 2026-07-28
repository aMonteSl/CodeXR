// == historicalComparisonRuntime.js | selectionPanel (assembled per manifest.json; see COMPONENTS.md) ==
  // The Git source selector embeds the shared CodeXRGitRefPickerRuntime picker
  // in 'compare' mode (two slots + category tabs); this file only owns the
  // history-specific chrome around it (selection detail, Back/Compare
  // actions, status) and the compare message plumbing.
  function buildPanel() {
    var mappingRuntime = root.CodeXRMappingUiRuntime;
    var pickerRuntime = root.CodeXRGitRefPickerRuntime;
    if (
      !mappingRuntime?.registerPanelView
      || !mappingRuntime.isPanelReady?.()
      || !pickerRuntime?.createPicker
      || refs.panel
    ) {
      return !!refs.panel;
    }
    refs.panel = createEntity('a-entity', {
      id: 'codexrHistoricalComparisonPanel',
      position: '0 0 0.04',
      visible: false
    });

    refs.sourceRoot = createEntity('a-entity', { position: '0 0 0.02', visible: true });

    refs.picker = root.CodeXRGitRefPickerRuntime.createPicker({
      mode: 'compare',
      pageSize: 7,
      slotsY: 2.3,
      tabsY: 1.75,
      listY: 0.9,
      listTopY: 0.32,
      rowGap: 0.32,
      pagerY: -1.5,
      rowClass: 'codexr-history-button',
      slots: [
        { id: 'left', label: 'LEFT', color: '#164e63', activeColor: '#67e8f9' },
        { id: 'right', label: 'RIGHT', color: '#166534', activeColor: '#6ee7b7' }
      ],
      slotSelection: function (slotId) { return state.selected[slotId]; },
      resolveRowState: function (source, ctx) {
        return { selected: state.selected[ctx.activeSlot] === source.id, color: '#be123c' };
      },
      onSelect: function (sourceId, slotId) {
        state.selected[slotId] = sourceId;
        renderSelectionDetail();
      },
      onSlotChange: function (slotId) {
        state.activeSide = slotId;
        renderSelectionDetail();
      }
    });
    refs.sourceRoot.appendChild(refs.picker.el);

    refs.selectionDetail = createText('', '0 -1.02 0.02', 5.45, '#cbd5e1', 'center', 52);
    refs.status = createText('', '-2.82 -1.98 0.02', 5.65, '#fde68a', 'left', 42);
    refs.status.setAttribute('visible', false);

    refs.sourceRoot.appendChild(refs.selectionDetail);
    // Two centred actions: Back and Compare (the old third 'Axes' shortcut was
    // removed — the mapping/axes view is reached automatically after Compare).
    refs.sourceRoot.appendChild(buildButton('Back', '-0.75 -2.4 0.02', 1.3, 0.38, function () {
      root.CodeXRAnalysisModeRuntime?.openSelector?.();
    }, '#475569'));
    refs.sourceRoot.appendChild(buildButton('Compare', '0.75 -2.4 0.02', 1.3, 0.38, startComparison, '#be123c'));

    refs.panel.appendChild(refs.sourceRoot);
    refs.panel.appendChild(refs.status);
    buildMappingCompanion(mappingRuntime);
    state.unregisterPanelView = mappingRuntime.registerPanelView({
      id: 'historical-selection',
      title: 'History comparison',
      headerButton: false,
      panelHeight: 6.45,
      content: refs.panel,
      onShow: function () {
        state.panelVisible = true;
        showSourceSelection();
      },
      onHide: function () {
        state.panelVisible = false;
      }
    });
    return true;
  }

  function openPanel() {
    if (!buildPanel()) {
      setTimeout(openPanel, 100);
      return;
    }
    root.CodeXRMappingUiRuntime?.showPanelView?.('historical-selection');
  }

  function closePanel() {
    state.panelVisible = false;
    if (root.CodeXRAnalysisControllerRuntime.showView) {
      root.CodeXRAnalysisControllerRuntime.showView('historical.mapping', {
        mode: 'historical-compare',
        mappingContextId: 'historical-comparison',
        reason: 'historical-comparison-ready'
      });
      return;
    }
    root.CodeXRMappingUiRuntime?.showPanelView?.('mapping');
  }

  function showSourceSelection() {
    if (state.availability !== 'enabled') {
      setStatus(state.unavailableReason, 'error');
      return;
    }
    refs.sourceRoot?.setAttribute('visible', true);
    refs.status?.setAttribute('position', '-2.82 -2.17 0.02');
    root.CodeXRMappingUiRuntime?.setPanelViewTitle?.('historical-selection', 'History comparison');
    root.CodeXRMappingUiRuntime?.setPanelViewHeight?.('historical-selection', 6.45);
    // An exported copy has no git or Python behind it: references cannot be
    // listed and new comparisons cannot be computed. Offer the computed
    // comparisons as a replay list instead (Compare loads the next one).
    if (getClient()?.isOfflineExport?.()) {
      showOfflineReplayStatus();
      return;
    }
    setStatus('Loading local Git references...', 'info');
    var client = getClient();
    if (!client?.sendMessage?.('historical-comparison-references-request', {})) {
      setStatus('Collaboration connection is not ready.', 'error');
    }
  }

  // Feeds the shared picker with the latest references and refreshes the
  // history-specific selection detail. Called whenever references arrive.
  function renderReferences() {
    if (!refs.picker) {
      return;
    }
    var allSources = Array.isArray(state.references?.sources) ? state.references.sources : [];
    if (!state.selected.right) {
      state.selected.right = allSources.find(function (source) {
        return source.id !== 'working-copy';
      })?.id || 'working-copy';
    }
    refs.picker.setReferences(state.references);
    renderSelectionDetail();
  }

  function renderSelectionDetail() {
    if (!refs.selectionDetail) {
      return;
    }
    var allSources = Array.isArray(state.references?.sources) ? state.references.sources : [];
    var active = allSources.find(function (source) {
      return source.id === state.selected[state.activeSide];
    });
    refs.selectionDetail.setAttribute('value', buildSelectionDetail(active));
    refs.picker?.render();
  }

  function buildSelectionDetail(source) {
    if (!source) {
      return 'No source selected';
    }
    var described = root.CodeXRGitRefPickerRuntime.describeSource(source);
    if (described.isLive) {
      return described.label + '\nWorking copy';
    }
    var subject = described.subject ? '\n' + described.subject : '';
    return truncate(described.label + '\n' + described.date + subject, 112);
  }

  function truncate(value, limit) {
    var text = String(value || '');
    return text.length > limit ? text.slice(0, Math.max(1, limit - 3)) + '...' : text;
  }

  // ── Field Mapping child section (mapping companion) ───────────────────────
  // A right-column child of the Field Mapping view for this analysis, laid out
  // as a framed card that fills the column: section title, two colour-coded
  // side chips, a per-axis-metric comparison table (left / right / difference —
  // always the metrics currently mapped to the chart axes, read live from the
  // mapping-ui), a 2×2 file-delta dashboard, and a Change comparison action.
  // Built once; updated attribute-only (the panel's childList observer must
  // not see node churn — same rule as the pooled Git ref rows).

  var COMPANION_METRIC_ROWS = 5;
  // Right-column x columns (companion root at the column centre, ~3.1 wide;
  // everything is centred inside the framing card, content within ±1.4).
  var COMP_COL = { name: -1.4, left: -0.1, right: 0.55, diff: 1.15 };
  var COMPANION_CARD_W = 2.98;   // framing card width
  var COMPANION_TABLE_W = 2.82;  // header bar / zebra row width
  var COMPANION_ROW_GAP = 0.32;
  var COMPANION_STAT_META = [
    { key: 'added', label: 'Added', color: '#4ade80' },
    { key: 'removed', label: 'Removed', color: '#f87171' },
    { key: 'modified', label: 'Modified', color: '#fbbf24' },
    { key: 'unchanged', label: 'Unchanged', color: '#94a3b8' }
  ];

  function compText(value, position, width, color, align, wrapCount) {
    return createText(value, position, width, color, align || 'left', wrapCount || 18);
  }

  function setRowVisible(el, visible) {
    if (!el) { return; }
    if (el.object3D) { el.object3D.visible = !!visible; }
    el.setAttribute('visible', visible ? 'true' : 'false');
  }

  function formatMetricValue(value) {
    var n = Number(value) || 0;
    var abs = Math.abs(n);
    if (abs >= 100000) { return (n / 1000).toFixed(0) + 'k'; }
    if (abs >= 1000) { return (n / 1000).toFixed(1) + 'k'; }
    return (Math.round(n * 10) / 10).toString();
  }

  function buildMappingCompanion(mappingRuntime) {
    if (refs.companionRoot || !mappingRuntime?.registerMappingCompanion) {
      return;
    }
    refs.companionRoot = createEntity('a-entity', {});

    // Framing card (border behind a subtle fill) so the column reads as one
    // cohesive section instead of loose elements floating on the panel.
    refs.companionCardBorder = createEntity('a-plane', {
      position: '0 0 -0.04', width: COMPANION_CARD_W + 0.06, height: 1,
      material: 'color: #2b3a55; opacity: 0.55; shader: flat'
    });
    refs.companionCard = createEntity('a-plane', {
      position: '0 0 -0.03', width: COMPANION_CARD_W, height: 1,
      material: 'color: #0e1526; opacity: 0.66; shader: flat'
    });
    refs.companionRoot.appendChild(refs.companionCardBorder);
    refs.companionRoot.appendChild(refs.companionCard);

    // Section title + accent underline.
    refs.companionTitle = createText('COMPARISON', '0 0 0.01', 2.3, '#f9a8d4', 'center', 22);
    refs.companionUnderline = createEntity('a-plane', {
      position: '0 0 -0.005', width: 2.4, height: 0.012,
      material: 'color: #f472b6; opacity: 0.85; shader: flat'
    });
    refs.companionRoot.appendChild(refs.companionTitle);
    refs.companionRoot.appendChild(refs.companionUnderline);

    // Side chips: which branch is on each axis side (colour-coded, full width).
    refs.companionLeftChip = buildSideChip('#0e3a4a', '#67e8f9', 'LEFT');
    refs.companionRightChip = buildSideChip('#123524', '#6ee7b7', 'RIGHT');
    refs.companionRoot.appendChild(refs.companionLeftChip.root);
    refs.companionRoot.appendChild(refs.companionRightChip.root);

    // Table header bar + column labels (y set in positionMappingCompanion).
    refs.companionHeaderBar = createEntity('a-plane', {
      position: '0 0 -0.008', width: COMPANION_TABLE_W, height: 0.3,
      material: 'color: #1e293b; opacity: 0.75; shader: flat'
    });
    refs.companionRoot.appendChild(refs.companionHeaderBar);
    refs.companionHeader = {
      name: createText('Metric', COMP_COL.name + ' 0 0.01', 1.0, '#94a3b8', 'left', 12),
      left: createText('L', COMP_COL.left + ' 0 0.01', 0.5, '#67e8f9', 'center', 6),
      right: createText('R', COMP_COL.right + ' 0 0.01', 0.5, '#6ee7b7', 'center', 6),
      diff: createText('Diff', COMP_COL.diff + ' 0 0.01', 0.7, '#fde68a', 'center', 8)
    };
    refs.companionRoot.appendChild(refs.companionHeader.name);
    refs.companionRoot.appendChild(refs.companionHeader.left);
    refs.companionRoot.appendChild(refs.companionHeader.right);
    refs.companionRoot.appendChild(refs.companionHeader.diff);

    // Pooled metric rows, each with a zebra background (y set later).
    refs.companionRows = [];
    for (var i = 0; i < COMPANION_METRIC_ROWS; i += 1) {
      var row = createEntity('a-entity', { position: '0 0 0', visible: 'false' });
      row.appendChild(createEntity('a-plane', {
        position: '0 0 -0.006', width: COMPANION_TABLE_W, height: COMPANION_ROW_GAP,
        material: 'color: #1e293b; opacity: ' + (i % 2 === 0 ? 0.32 : 0.12) + '; shader: flat'
      }));
      row.__name = compText('', COMP_COL.name + ' 0 0', 1.0, '#e2e8f0', 'left', 13);
      row.__left = compText('', COMP_COL.left + ' 0 0', 0.62, '#a5f3fc', 'center', 8);
      row.__right = compText('', COMP_COL.right + ' 0 0', 0.62, '#a7f3d0', 'center', 8);
      row.__diff = compText('', COMP_COL.diff + ' 0 0', 0.7, '#cbd5e1', 'center', 9);
      row.appendChild(row.__name);
      row.appendChild(row.__left);
      row.appendChild(row.__right);
      row.appendChild(row.__diff);
      refs.companionRoot.appendChild(row);
      refs.companionRows.push(row);
    }
    refs.companionVisibleRows = 0;

    // Placeholder shown when no metric is mapped to the axes yet.
    refs.companionEmpty = createText('Map metrics to the chart axes to compare them here', '0 0 0.01', 2.4, '#64748b', 'center', 26);
    setRowVisible(refs.companionEmpty, false);
    refs.companionRoot.appendChild(refs.companionEmpty);

    // File-delta dashboard: a "Files changed" heading over four stat cells
    // (Added / Removed / Modified / Unchanged) so it's clear the counts are
    // files. Values filled in updateMappingCompanion.
    refs.companionFilesLabel = createText('Files (right vs left)', '0 0 0.01', 2.1, '#cbd5e1', 'center', 24);
    refs.companionRoot.appendChild(refs.companionFilesLabel);
    refs.companionStats = COMPANION_STAT_META.map(function (meta) {
      var cell = buildStatCell(meta.label, meta.color);
      refs.companionRoot.appendChild(cell.root);
      return cell;
    });

    // Change comparison action (pinned near the bottom of the card).
    refs.companionButton = buildButton('Change comparison', '0 0 0', 2.5, 0.38, changeComparison, '#be123c', 3.2);
    refs.companionRoot.appendChild(refs.companionButton);

    positionMappingCompanion();

    state.unregisterMappingCompanion = mappingRuntime.registerMappingCompanion('historical-comparison', {
      content: refs.companionRoot,
      placement: 'side',
      width: 3.1,
      title: 'Field Mapping - History comparison',
      layout: layoutMappingCompanion
    }) || null;
    updateMappingCompanion();
  }

  // The mapping panel is much taller than the comparison content, so distribute
  // it across the full framing card: title + chips near the top, the metric
  // table centred in the free middle, and the file dashboard + Change
  // comparison pinned near the bottom. Runs on panel (re)layout (layout
  // callback) and when the visible-row count changes — attribute-only.
  function layoutMappingCompanion(availableHeight) {
    var h = Number(availableHeight) || 0;
    if (h > 0) {
      refs.companionHeight = h;
    }
    positionMappingCompanion();
  }

  function positionMappingCompanion() {
    if (!refs.companionRoot) {
      return;
    }
    var h = Number(refs.companionHeight) || 6.45;
    var cardTop = 0.12;
    var cardBottom = -(h - 0.18);
    var cardHeight = cardTop - cardBottom;
    var cardCentre = (cardTop + cardBottom) / 2;

    // Framing card fills the whole column.
    refs.companionCard.setAttribute('height', Math.max(0.6, cardHeight));
    refs.companionCard.setAttribute('position', '0 ' + cardCentre + ' -0.03');
    refs.companionCardBorder.setAttribute('height', Math.max(0.6, cardHeight) + 0.06);
    refs.companionCardBorder.setAttribute('position', '0 ' + cardCentre + ' -0.04');

    // Top group: title + underline + the two side chips.
    var titleY = cardTop - 0.28;
    refs.companionTitle.setAttribute('position', '0 ' + titleY + ' 0.01');
    refs.companionUnderline.setAttribute('position', '0 ' + (titleY - 0.17) + ' -0.005');
    var leftChipY = titleY - 0.5;
    var rightChipY = leftChipY - 0.36;
    refs.companionLeftChip.root.setAttribute('position', '0 ' + leftChipY + ' 0');
    refs.companionRightChip.root.setAttribute('position', '0 ' + rightChipY + ' 0');
    var topGroupBottom = rightChipY - 0.3;

    // Bottom group: "Files changed" heading + file dashboard (2×2) above the
    // Change comparison button.
    var buttonY = cardBottom + 0.34;
    var statBottomRowY = buttonY + 0.62;
    var statTopRowY = statBottomRowY + 0.46;
    refs.companionStats.forEach(function (cell, index) {
      var x = index % 2 === 0 ? -0.72 : 0.72;
      var y = index < 2 ? statTopRowY : statBottomRowY;
      cell.root.setAttribute('position', x + ' ' + y + ' 0');
    });
    var filesLabelY = statTopRowY + 0.36;
    refs.companionFilesLabel.setAttribute('position', '0 ' + filesLabelY + ' 0.01');
    var bottomGroupTop = filesLabelY + 0.2;

    // Middle group: centre the metric table (header + rows) in the free space.
    var visibleRows = Math.max(0, Math.min(COMPANION_METRIC_ROWS, Number(refs.companionVisibleRows) || 0));
    var tableHeight = 0.34 + (Math.max(1, visibleRows) * COMPANION_ROW_GAP);
    var regionHeight = Math.max(0, topGroupBottom - bottomGroupTop);
    var headerY = topGroupBottom - Math.max(0, (regionHeight - tableHeight) / 2);
    var firstRowY = headerY - 0.36;

    refs.companionHeaderBar.setAttribute('position', '0 ' + headerY + ' -0.008');
    refs.companionHeader.name.setAttribute('position', COMP_COL.name + ' ' + headerY + ' 0.01');
    refs.companionHeader.left.setAttribute('position', COMP_COL.left + ' ' + headerY + ' 0.01');
    refs.companionHeader.right.setAttribute('position', COMP_COL.right + ' ' + headerY + ' 0.01');
    refs.companionHeader.diff.setAttribute('position', COMP_COL.diff + ' ' + headerY + ' 0.01');
    refs.companionRows.forEach(function (row, index) {
      row.setAttribute('position', '0 ' + (firstRowY - (index * COMPANION_ROW_GAP)) + ' 0');
    });
    refs.companionEmpty.setAttribute('position', '0 ' + firstRowY + ' 0.01');
    refs.companionButton.setAttribute('position', '0 ' + buttonY + ' 0');
  }

  // Full-width side chip: accent bar + side tag ("LEFT"/"RIGHT") + branch label.
  function buildSideChip(bgColor, accentColor, sideTag) {
    var root_ = createEntity('a-entity', { position: '0 0 0' });
    root_.appendChild(createEntity('a-plane', {
      position: '0 0 -0.006', width: 2.82, height: 0.3,
      material: 'color: ' + bgColor + '; opacity: 0.92; shader: flat'
    }));
    root_.appendChild(createEntity('a-plane', {
      position: '-1.37 0 0', width: 0.08, height: 0.3,
      material: 'color: ' + accentColor + '; opacity: 0.98; shader: flat'
    }));
    root_.appendChild(createText(sideTag, '-1.28 0 0.01', 0.55, accentColor, 'left', 7));
    var label = createText('', '-0.58 0 0.01', 1.95, '#e2e8f0', 'left', 32);
    root_.appendChild(label);
    return { root: root_, label: label };
  }

  // One dashboard stat cell (value on top, label below, on a subtle plate).
  function buildStatCell(labelText, accentColor) {
    var root_ = createEntity('a-entity', { position: '0 0 0' });
    root_.appendChild(createEntity('a-plane', {
      position: '0 0 -0.006', width: 1.34, height: 0.4,
      material: 'color: #16233b; opacity: 0.8; shader: flat'
    }));
    var value = createText('0', '0 0.075 0.01', 0.65, accentColor, 'center', 8);
    root_.appendChild(value);
    root_.appendChild(createText(labelText, '0 -0.095 0.01', 1.2, '#94a3b8', 'center', 16));
    return { root: root_, value: value };
  }

  function chipText(dataset) {
    if (!dataset?.source) {
      return '-';
    }
    var described = root.CodeXRGitRefPickerRuntime.describeSource(dataset.source);
    var date = described.isLive ? 'Working copy' : described.date;
    return truncate(described.label + '  -  ' + date, 32);
  }

  // The comparison table always mirrors what the user has mapped to the chart
  // axes right now — read live from the mapping-ui (its lastKnownGoodMapping is
  // the mapping the charts actually use), not a stale cache. A confirmed axis
  // change (codexr-mapping-confirmed) also re-triggers this update.
  function getLiveMapping() {
    var mappingState = root.CodeXRMappingUiRuntime?.getState?.() || {};
    if (Object.keys(mappingState.lastKnownGoodMapping || {}).length) {
      return mappingState.lastKnownGoodMapping;
    }
    if (Object.keys(mappingState.selectedByDimension || {}).length) {
      return mappingState.selectedByDimension;
    }
    return state.selectedMapping || {};
  }

  function updateMappingCompanion() {
    if (!refs.companionRoot) {
      return;
    }
    refs.companionLeftChip?.label.setAttribute('value', chipText(state.result?.left));
    refs.companionRightChip?.label.setAttribute('value', chipText(state.result?.right));

    state.selectedMapping = getLiveMapping();
    var metrics = state.result
      ? getMappedMetricDeltas(state.selectedMapping, state.payloads).slice(0, COMPANION_METRIC_ROWS)
      : [];
    refs.companionVisibleRows = metrics.length;
    refs.companionRows.forEach(function (row, index) {
      var metric = metrics[index];
      if (!metric) {
        setRowVisible(row, false);
        return;
      }
      setRowVisible(row, true);
      row.__name.setAttribute('value', truncate(metric.metric, 13));
      row.__left.setAttribute('value', formatMetricValue(metric.left));
      row.__right.setAttribute('value', formatMetricValue(metric.right));
      var diff = Number(metric.delta) || 0;
      var sign = diff > 0 ? '+' : '';
      row.__diff.setAttribute('value', sign + formatMetricValue(diff));
      row.__diff.setAttribute('color', diff > 0 ? '#4ade80' : (diff < 0 ? '#f87171' : '#94a3b8'));
    });
    // Empty state: placeholder instead of a lone table header.
    var hasRows = metrics.length > 0;
    setRowVisible(refs.companionEmpty, !hasRows);
    setRowVisible(refs.companionHeaderBar, hasRows);
    setRowVisible(refs.companionHeader.name, hasRows);
    setRowVisible(refs.companionHeader.left, hasRows);
    setRowVisible(refs.companionHeader.right, hasRows);
    setRowVisible(refs.companionHeader.diff, hasRows);

    var delta = state.result?.delta || {};
    refs.companionStats.forEach(function (cell, index) {
      cell.value.setAttribute('value', state.result ? String(Number(delta[COMPANION_STAT_META[index].key] || 0)) : '-');
    });

    // Row count changed → re-centre the table in its middle zone.
    positionMappingCompanion();
  }

  // Clears the table (comparison geometry + result) and reopens the source
  // selector, ready to pick a new pair. The mode stays historical.
  function changeComparison() {
    state.loadGeneration += 1;
    disposeComparisonGeometry(true);
    updateMappingCompanion();
    setStatus('', 'info');
    openPanel();
  }
