// == historicalComparisonRuntime.js | selectionPanel (assembled per manifest.json; see COMPONENTS.md) ==
  function buildPanel() {
    var mappingRuntime = root.CodeXRMappingUiRuntime;
    if (
      !mappingRuntime?.registerPanelView
      || !mappingRuntime.isPanelReady?.()
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
    refs.leftSelection = buildButton('LEFT', '-1.48 2.18 0.02', 2.75, 0.48, function () {
      state.activeSide = 'left';
      renderReferences();
    }, '#164e63');
    refs.rightSelection = buildButton('RIGHT', '1.48 2.18 0.02', 2.75, 0.48, function () {
      state.activeSide = 'right';
      renderReferences();
    }, '#166534');
    refs.categoryRoot = createEntity('a-entity', { position: '0 1.62 0.02' });
    refs.list = createEntity('a-entity', { position: '0 0.92 0.02' });
    refs.selectionDetail = createText('', '0 -1.25 0.02', 5.45, '#cbd5e1', 'center', 52);
    refs.pageText = createText('', '0 -1.82 0.02', 3.8, '#cde7ff');
    refs.status = createText('', '-2.82 -2.17 0.02', 5.65, '#fde68a', 'left', 42);
    refs.status.setAttribute('visible', false);

    refs.sourceRoot.appendChild(refs.leftSelection);
    refs.sourceRoot.appendChild(refs.rightSelection);
    refs.sourceRoot.appendChild(refs.categoryRoot);
    refs.sourceRoot.appendChild(refs.list);
    refs.sourceRoot.appendChild(refs.selectionDetail);
    refs.sourceRoot.appendChild(refs.pageText);
    refs.sourceRoot.appendChild(buildButton('<', '-1.25 -1.82 0.02', 0.55, 0.3, function () {
      state.page = Math.max(0, state.page - 1);
      renderReferences();
    }, '#334155'));
    refs.sourceRoot.appendChild(buildButton('>', '1.25 -1.82 0.02', 0.55, 0.3, function () {
      var sourceCount = getCategorySources().length;
      var maxPage = Math.max(0, Math.ceil(sourceCount / state.pageSize) - 1);
      state.page = Math.min(maxPage, state.page + 1);
      renderReferences();
    }, '#334155'));
    refs.sourceRoot.appendChild(buildButton('Back', '-1.7 -2.72 0.02', 1.1, 0.38, function () {
      root.CodeXRAnalysisModeRuntime?.openSelector?.();
    }, '#475569'));
    refs.sourceRoot.appendChild(buildButton('Compare', '0 -2.72 0.02', 1.55, 0.38, startComparison, '#be123c'));
    refs.sourceRoot.appendChild(buildButton('Axes', '1.7 -2.72 0.02', 1.1, 0.38, function () {
      root.CodeXRMappingUiRuntime?.showPanelView?.('mapping');
    }, '#0e7490'));

    refs.panel.appendChild(refs.sourceRoot);
    refs.panel.appendChild(refs.status);
    renderCategoryTabs();
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
    setStatus('Loading local Git references...', 'info');
    var client = getClient();
    if (!client?.sendMessage?.('historical-comparison-references-request', {})) {
      setStatus('Collaboration connection is not ready.', 'error');
    }
  }

  function setActiveCategory(category) {
    state.activeCategory = category;
    state.page = 0;
    renderCategoryTabs();
    renderReferences();
  }

  function renderCategoryTabs() {
    if (!refs.categoryRoot) {
      return;
    }
    while (refs.categoryRoot.firstChild) {
      refs.categoryRoot.removeChild(refs.categoryRoot.firstChild);
    }
    [
      { id: 'branch', label: 'Branches' },
      { id: 'tag', label: 'Tags' },
      { id: 'commit', label: 'Commits' }
    ].forEach(function (category, index) {
      refs.categoryRoot.appendChild(buildButton(
        category.label,
        (-1.9 + (index * 1.9)) + ' 0 0',
        1.7,
        0.3,
        function () { setActiveCategory(category.id); },
        state.activeCategory === category.id ? '#0e7490' : '#1e293b',
        2.15
      ));
    });
  }

  function getCategorySources() {
    var sources = Array.isArray(state.references?.sources) ? state.references.sources : [];
    return sources.filter(function (source) {
      if (state.activeCategory === 'branch' && source.kind === 'workingCopy') {
        return true;
      }
      return source.kind === 'gitRef' && source.refType === state.activeCategory;
    });
  }

  function renderReferences() {
    if (!refs.list) {
      return;
    }
    while (refs.list.firstChild) {
      refs.list.removeChild(refs.list.firstChild);
    }
    var allSources = Array.isArray(state.references?.sources) ? state.references.sources : [];
    var sources = getCategorySources();
    if (!state.selected.right) {
      state.selected.right = allSources.find(function (source) {
        return source.id !== 'working-copy';
      })?.id || 'working-copy';
    }
    var left = allSources.find(function (source) { return source.id === state.selected.left; });
    var right = allSources.find(function (source) { return source.id === state.selected.right; });
    setText(refs.leftSelection, 'LEFT\n' + compactSelection(left), 4.1, state.activeSide === 'left' ? '#67e8f9' : '#ffffff');
    setText(refs.rightSelection, 'RIGHT\n' + compactSelection(right), 4.1, state.activeSide === 'right' ? '#6ee7b7' : '#ffffff');

    var start = state.page * state.pageSize;
    sources.slice(start, start + state.pageSize).forEach(function (source, index) {
      var row = buildReferenceRow(source, index);
      refs.list.appendChild(row);
    });
    var activeSelection = allSources.find(function (source) {
      return source.id === state.selected[state.activeSide];
    });
    refs.selectionDetail?.setAttribute('value', buildSelectionDetail(activeSelection));
    refs.pageText?.setAttribute(
      'value',
      sources.length
        ? 'Page ' + (state.page + 1) + ' / ' + Math.max(1, Math.ceil(sources.length / state.pageSize))
        : 'No ' + state.activeCategory + ' references'
    );
  }

  function compactSelection(source) {
    var value = source?.label || 'Not selected';
    return value.length > 26 ? value.slice(0, 23) + '...' : value;
  }

  function splitSourceDescription(source) {
    var label = String(source.label || source.refName || source.id || 'unknown');
    var description = String(source.description || '').trim();
    var match = description.match(/^(\d{4}-\d{2}-\d{2})\s*(.*)$/);
    var date = match ? match[1] : '';
    var subject = match ? match[2] : description;
    if (source.kind === 'workingCopy') {
      date = 'Working copy';
    }
    return {
      label: truncate(label, 28),
      date: date || 'No commit date',
      subject: truncate(subject, 58)
    };
  }

  function buildSourceLabel(source) {
    var parts = splitSourceDescription(source);
    var subject = parts.subject ? '\n' + parts.subject : '';
    return parts.label + '\n' + parts.date + subject;
  }

  function compactLabel(source) {
    var prefix = source.kind === 'workingCopy'
      ? 'LIVE'
      : String(source.refType || 'ref').toUpperCase().slice(0, 6);
    var description = source.description ? ' - ' + source.description : '';
    var value = prefix + ' | ' + String(source.label || source.refName || source.id) + description;
    return value.length > 58 ? value.slice(0, 55) + '...' : value;
  }

  function buildReferenceRow(source, index) {
    var isCommit = source.kind === 'gitRef' && source.refType === 'commit';
    var selected = state.selected[state.activeSide] === source.id;
    var rowHeight = isCommit ? 0.4 : 0.28;
    var spacing = isCommit ? 0.45 : 0.31;
    var row = createEntity('a-plane', {
      position: '0 ' + (0.3 - (index * spacing)) + ' 0',
      width: 5.7,
      height: rowHeight,
      material: 'color: ' + (selected ? '#be123c' : '#1e3a5f') + '; opacity: 0.96; shader: flat',
      class: 'babiaxraycasterclass codexr-history-button',
      'data-codexr-interactive': 'true'
    });
    var badge = source.kind === 'workingCopy'
      ? 'LIVE'
      : String(source.refType || 'ref').toUpperCase();
    row.appendChild(createText(badge, '-2.38 0 0.02', 1.35, source.kind === 'workingCopy' ? '#6ee7b7' : '#67e8f9', 'center', 10));
    if (isCommit) {
      var parts = splitSourceDescription(source);
      row.appendChild(createText(
        String(source.label || '').slice(0, 8) + '  ' + parts.date,
        '-1.72 0.1 0.02',
        4.3,
        '#ffffff',
        'left',
        32
      ));
      row.appendChild(createText(
        truncate(parts.subject, 54),
        '-1.72 -0.1 0.02',
        4.3,
        '#cbd5e1',
        'left',
        50
      ));
    } else {
      row.appendChild(createText(
        truncate(source.label || source.refName || source.id, 48),
        '-1.72 0 0.02',
        4.3,
        '#ffffff',
        'left',
        48
      ));
    }
    row.addEventListener('click', function () {
      state.selected[state.activeSide] = source.id;
      renderReferences();
    });
    return row;
  }

  function buildSelectionDetail(source) {
    if (!source) {
      return 'No source selected';
    }
    if (source.kind === 'workingCopy') {
      return source.label + '\nWorking copy';
    }
    return truncate(buildSourceLabel(source), 112);
  }

  function truncate(value, limit) {
    var text = String(value || '');
    return text.length > limit ? text.slice(0, Math.max(1, limit - 3)) + '...' : text;
  }
