(function registerCodeXRHistoricalComparisonRuntime(root) {
  'use strict';

  var ENTITY_KIND = 'historical-comparison';
  var ENTITY_ID = 'main';
  var state = {
    initialized: false,
    panelVisible: false,
    references: null,
    page: 0,
    pageSize: 5,
    activeSide: 'left',
    activeCategory: 'branch',
    availability: 'loading',
    unavailableReason: 'Checking Git history availability...',
    selected: { left: 'working-copy', right: '' },
    result: null,
    payloads: { left: [], right: [] },
    selectedMapping: {},
    status: '',
    statusLevel: 'info',
    disposables: [],
    unregisterPanelView: null,
    unregisterLifecycle: null,
    unregisterModeOption: null,
    loadGeneration: 0
  };
  var refs = {};
  var RAYCAST_CLASS = 'babiaxraycasterclass';
  var RAYCAST_SUSPENDED_ATTRIBUTE = 'data-codexr-raycast-suspended';
  var CHART_COMPONENT_NAMES = [
    'babia-bars',
    'babia-barsmap',
    'babia-cyls',
    'babia-cylsmap',
    'babia-pie',
    'babia-doughnut',
    'babia-bubbles',
    'babia-boats'
  ];

  function getDocument() {
    return root.document;
  }

  function getConfig() {
    var script = getDocument()?.getElementById('codexr-tooling-config-xr-mapping-ui');
    if (!script) {
      return null;
    }
    try {
      return JSON.parse(script.textContent || '{}');
    } catch {
      return null;
    }
  }

  function getClient() {
    return root.CodeXRCollaborationRuntime?.getClient?.(root) || null;
  }

  function isHistoricalModeActiveOrActivating() {
    var modeState = root.CodeXRAnalysisModeRuntime?.getState?.();
    return modeState?.mode === 'historical-compare'
      || (modeState?.transitioning && modeState?.requestedMode === 'historical-compare');
  }

  async function configureAvailability() {
    var client = getClient();
    var sessionInfo = null;
    try {
      sessionInfo = await client?.getSessionInfoAsync?.();
    } catch {
      sessionInfo = null;
    }
    var capabilities = sessionInfo?.capabilities || {};
    var enabled = capabilities.historicalComparison === true;
    var reason = String(
      capabilities.historicalComparisonReason
        || 'Historical comparison requires a local Git repository.'
    );
    state.availability = enabled ? 'enabled' : 'disabled';
    state.unavailableReason = enabled ? '' : reason;
    registerHistoricalModeOption();
  }

  function registerHistoricalModeOption() {
    state.unregisterModeOption.();
    state.unregisterModeOption = root.CodeXRAnalysisModeRuntime.registerModeOption.({
      id: 'historical-compare',
      label: 'Historical comparison',
      color: '#be123c',
      disabled: state.availability !== 'enabled',
      disabledReason: state.unavailableReason || 'Historical comparison requires a local Git repository.',
      onSelect: selectHistoricalMode
    }) || null;
  }

  function createEntity(tagName, attributes) {
    var entity = getDocument().createElement(tagName);
    Object.keys(attributes || {}).forEach(function (key) {
      entity.setAttribute(key, attributes[key]);
    });
    return entity;
  }

  function suspendRaycastInteraction(rootEntity) {
    if (!rootEntity) {
      return;
    }
    function suspendEntity(entity) {
      if (!entity?.classList?.contains(RAYCAST_CLASS)) {
        return;
      }
      entity.classList.remove(RAYCAST_CLASS);
      entity.setAttribute(RAYCAST_SUSPENDED_ATTRIBUTE, 'true');
    }
    suspendEntity(rootEntity);
    rootEntity.querySelectorAll?.('.' + RAYCAST_CLASS).forEach(suspendEntity);
    refs.originalInteractionObserver?.disconnect?.();
    if (typeof root.MutationObserver !== 'function') {
      return;
    }
    refs.originalInteractionObserver = new root.MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(function (node) {
            if (node?.nodeType !== 1) {
              return;
            }
            suspendEntity(node);
            node.querySelectorAll?.('.' + RAYCAST_CLASS).forEach(suspendEntity);
          });
          return;
        }
        if (mutation.type === 'attributes') {
          suspendEntity(mutation.target);
        }
      });
    });
    refs.originalInteractionObserver.observe(rootEntity, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  function restoreRaycastInteraction(rootEntity) {
    refs.originalInteractionObserver?.disconnect?.();
    refs.originalInteractionObserver = null;
    if (!rootEntity) {
      return;
    }
    var suspended = [];
    if (rootEntity.getAttribute?.(RAYCAST_SUSPENDED_ATTRIBUTE) === 'true') {
      suspended.push(rootEntity);
    }
    rootEntity.querySelectorAll?.('[' + RAYCAST_SUSPENDED_ATTRIBUTE + '="true"]').forEach(function (entity) {
      suspended.push(entity);
    });
    suspended.forEach(function (entity) {
      entity.classList?.add(RAYCAST_CLASS);
      entity.removeAttribute?.(RAYCAST_SUSPENDED_ATTRIBUTE);
    });
  }

  function collectConfiguredIds(config, keys) {
    var ids = [];
    keys.forEach(function (key) {
      var value = config?.[key];
      if (Array.isArray(value)) {
        value.forEach(function (id) { if (id) { ids.push(String(id)); } });
      } else if (value) {
        ids.push(String(value));
      }
    });
    return ids;
  }

  function uniqueElements(elements) {
    return elements.filter(function (element, index) {
      return !!element && elements.indexOf(element) === index;
    });
  }

  function getNormalVisualizationRoots(config) {
    var document = getDocument();
    if (!document) { return []; }
    var roots = [];
    collectConfiguredIds(config || getConfig(), [
      'normalEntityIds',
      'visualizationEntityIds',
      'chartEntityIds',
      'chartEntityId',
      'chartId'
    ]).forEach(function (id) {
      var element = document.getElementById?.(id);
      if (element) { roots.push(element); }
    });
    if (config?.chartSelector && typeof document.querySelector === 'function') {
      var selected = document.querySelector(config.chartSelector);
      if (selected) { roots.push(selected); }
    }
    document.querySelectorAll?.('[data-codexr-normal-root="true"], [data-codexr-normal-visualization="true"]')
      .forEach(function (element) { roots.push(element); });
    return uniqueElements(roots);
  }

  function getTemplateChart(config) {
    var document = getDocument();
    if (!document) { return null; }
    if (config?.chartEntityId) {
      return document.getElementById(config.chartEntityId);
    }
    if (Array.isArray(config?.chartEntityIds) && config.chartEntityIds.length) {
      return document.getElementById(config.chartEntityIds[0]);
    }
    return getNormalVisualizationRoots(config)[0] || null;
  }

  function getNormalMappingTargetIds(config) {
    var ids = collectConfiguredIds(config, ['chartEntityIds', 'chartEntityId', 'chartId']);
    if (!ids.length) {
      ids = getNormalVisualizationRoots(config)
        .map(function (element) { return element.id; })
        .filter(Boolean);
    }
    return Array.from(new Set(ids));
  }

  function parkOriginalChart(original) {
    if (root.CodeXRAnalysisSurfaceRuntime?.setNormalVisible) {
      root.CodeXRAnalysisSurfaceRuntime.setNormalVisible(false);
      refs.originalCharts = [];
      if (original) { suspendRaycastInteraction(original); }
      return;
    }
    var roots = getNormalVisualizationRoots(getConfig());
    if (original && !roots.includes(original)) {
      roots.push(original);
    }
    refs.originalCharts = uniqueElements(roots);
    refs.originalCharts.forEach(function (element) {
      suspendRaycastInteraction(element);
      element.setAttribute?.('visible', false);
    });
  }

  function restoreOriginalChart() {
    if (root.CodeXRAnalysisSurfaceRuntime?.setNormalVisible) {
      if (root.CodeXRAnalysisModeRuntime?.getState?.().mode === 'single') {
        root.CodeXRAnalysisSurfaceRuntime.setNormalVisible(true);
      }
      var original = getTemplateChart(getConfig());
      restoreRaycastInteraction(original);
      refs.originalCharts = null;
      return original;
    }
    var originals = Array.isArray(refs.originalCharts) ? refs.originalCharts : [];
    if (!originals.length) {
      return null;
    }
    if (root.CodeXRAnalysisModeRuntime?.getState?.().mode === 'single') {
      originals.forEach(function (element) {
        element.setAttribute?.('visible', true);
      });
    }
    originals.forEach(restoreRaycastInteraction);
    refs.originalCharts = null;
    return originals[0] || null;
  }

  function restoreOriginalChartMapping(config) {
    var mappingRuntime = root.CodeXRMappingUiRuntime;
    var ids = getNormalMappingTargetIds(config);
    if (!ids.length || !mappingRuntime?.setChartEntityIds) {
      return;
    }
    mappingRuntime.setChartEntityIds(ids);
    mappingRuntime.switchMappingContext.('normal-analysis', {
      reason: 'historical-restore-normal-targets'
    });
  }

  function setText(entity, value, width, color) {
    var target = entity?._codexrLabel || entity;
    if (!target) {
      return;
    }
    if (String(target.tagName || '').toLowerCase() === 'a-text') {
      target.setAttribute('value', String(value || ''));
      target.setAttribute('width', width || 3);
      target.setAttribute('color', color || '#ffffff');
      return;
    }
    target.setAttribute('text', {
      value: String(value || ''),
      align: 'center',
      color: color || '#ffffff',
      width: width || 3,
      baseline: 'center',
      wrapCount: 38
    });
  }

  function createText(value, position, width, color, align, wrapCount) {
    return createEntity('a-text', {
      value: String(value || ''),
      position: position || '0 0 0.03',
      width: width || 5.8,
      color: color || '#ffffff',
      align: align || 'center',
      baseline: 'center',
      'wrap-count': wrapCount || 38
    });
  }

  function setStatus(message, level) {
    state.status = String(message || '');
    state.statusLevel = level || 'info';
    refs.status?.setAttribute('value', state.status);
    refs.status?.setAttribute(
      'color',
      state.statusLevel === 'error' ? '#fca5a5' : '#fde68a'
    );
    refs.status?.setAttribute('visible', !!state.status);
  }

  function buildButton(label, position, width, height, onClick, color, textWidth) {
    var button = createEntity('a-plane', {
      position: position,
      width: width || 1.35,
      height: height || 0.3,
      material: 'color: ' + (color || '#1e3a5f') + '; opacity: 0.96; shader: flat',
      class: 'babiaxraycasterclass codexr-history-button',
      'data-codexr-interactive': 'true'
    });
    button._codexrLabel = createText(
      label,
      '0 0 0.02',
      textWidth || Math.max(2.2, (width || 1.35) * 1.85)
    );
    button.appendChild(button._codexrLabel);
    button.addEventListener('click', onClick);
    return button;
  }

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
    var date = match  match[1] : '';
    var subject = match  match[2] : description;
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
    var subject = parts.subject  '\n' + parts.subject : '';
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

  function startComparison() {
    if (!state.selected.left || !state.selected.right) {
      setStatus('Select both comparison sources.', 'error');
      return;
    }
    if (state.selected.left === state.selected.right) {
      setStatus('Choose two different comparison sources.', 'error');
      return;
    }
    setStatus('Analyzing historical comparison. Please wait...', 'info');
    getClient()?.sendMessage?.('historical-comparison-start', {
      leftSourceId: state.selected.left,
      rightSourceId: state.selected.right
    });
  }

  function showHistoricalSelectionPanel() {
    root.CodeXRAnalysisModeRuntime.setSelectionPanel.('historical-selection');
    root.CodeXRMappingUiRuntime.showPanelView.('historical-selection');
    showSourceSelection();
  }

  async function enterHistoricalSelection() {
    getClient().sendMessage.('analysis-mode-activate', {
      mode: 'historical-compare'
    });
    await root.CodeXRAnalysisModeRuntime.transitionTo.('historical-compare', {
      reason: 'historical-selection',
      controllerView: 'historical.selection',
      panelViewId: 'historical-selection'
    });
  }

  function selectHistoricalMode() {
    if (state.result) {
      root.console?.log?.('[CodeXR.Debug]: Historical comparison mode selected from visualization panel', {
        hasResult: true,
        revision: state.result.revision
      });
      getClient()?.sendMessage?.('analysis-mode-activate', {
        mode: 'historical-compare'
      });
      void root.CodeXRAnalysisModeRuntime?.transitionTo?.('historical-compare', {
        reason: 'local-historical-mode-option',
        controllerView: 'historical.mapping',
        panelViewId: 'mapping'
      });
      return;
    }
    root.console?.log?.('[CodeXR.Debug]: Historical comparison selected; opening source selector');
    void enterHistoricalSelection();
  }

  function handleReferences(message) {
    state.references = message?.payload || null;
    var activeRequest = state.references?.activeRequest;
    if (activeRequest?.leftSourceId && activeRequest?.rightSourceId) {
      state.selected = {
        left: activeRequest.leftSourceId,
        right: activeRequest.rightSourceId
      };
    }
    state.pageSize = Math.min(5, Number(state.references?.pageSize || 5));
    state.page = 0;
    if (!getCategorySources().length) {
      state.activeCategory = state.references?.sources?.some(function (source) {
        return source.kind === 'gitRef' && source.refType === 'branch';
      }) ? 'branch' : 'branch';
    }
    renderCategoryTabs();
    renderReferences();
    setStatus('', 'info');
  }

  function handleProgress(message) {
    setStatus(message?.payload?.message || 'Analyzing...', 'info');
  }

  function handleError(message) {
    var code = String(message?.payload?.code || '');
    var rawMessage = String(message?.payload?.message || '');
    var friendlyMessage = code === 'references-unavailable' || /not a git repository|git-command-failed/i.test(rawMessage)
      ? 'History compare requires an analysis inside a local Git repository.'
      : code === 'comparison-busy'
        ? 'Another comparison is already being generated.'
        : 'Historical comparison failed. Please try again.';
    setStatus(friendlyMessage, 'error');
  }

  async function applySharedState(snapshot) {
    if (!snapshot || !snapshot.result) {
      return;
    }
    if (!isHistoricalModeActiveOrActivating()) {
      state.result = snapshot.result;
      return;
    }
    try {
      var loadGeneration = ++state.loadGeneration;
      setStatus('Loading comparison datasets...', 'info');
      var result = snapshot.result;
      var responses = await Promise.all([
        fetch(result.left.url + '?revision=' + result.revision, { cache: 'no-store' }),
        fetch(result.right.url + '?revision=' + result.revision, { cache: 'no-store' })
      ]);
      if (!responses[0].ok || !responses[1].ok) {
        throw new Error('Comparison datasets could not be loaded.');
      }
      var datasets = await Promise.all(responses.map(function (response) { return response.json(); }));
      if (
        loadGeneration !== state.loadGeneration
        || !isHistoricalModeActiveOrActivating()
      ) {
        return;
      }
      var previousResult = state.result;
      state.result = result;
      if (canRefreshLiveSide(result, previousResult)) {
        await refreshLiveSide(result, datasets);
      } else {
        await renderComparison(result, datasets[0], datasets[1]);
      }
      closePanel();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error), 'error');
    }
  }

  function getChartComponentName(chart) {
    if (!chart) {
      return '';
    }
    return CHART_COMPONENT_NAMES.find(function (name) {
      return chart.hasAttribute.(name);
    }) || chart.getAttributeNames().find(function (name) {
      return name.indexOf('babia-') === 0
        && name !== 'babia-queryjson'
        && name !== 'babia-treebuilder';
    }) || '';
  }

  function isHierarchicalBoatsComponent(componentName) {
    return componentName === 'babia-boats';
  }

  function createDataSource(id, url) {
    return createEntity('a-entity', {
      id: id,
      'babia-queryjson': 'url: ' + url
    });
  }

  function vectorToPositionAttribute(position) {
    var source = position || {};
    return [
      Number.isFinite(source.x)  source.x : 0,
      Number.isFinite(source.y)  source.y : 1,
      Number.isFinite(source.z)  source.z : -18
    ].join(' ');
  }

  function getHistoricalContainmentProfile(zone) {
    var profileId = zone && zone.id === 'right'  'historical-right' : 'historical-left';
    var profile = root.CodeXRAnalysisTableRuntime.getContainmentProfile.(profileId);
    if (!profile) {
      profile = {
        id: profileId,
        position: { x: zone.anchorX, y: 1, z: zone.anchorZ },
        containment: {
          enabled: true,
          anchorX: zone.anchorX,
          anchorY: 1,
          anchorZ: zone.anchorZ,
          targetWidth: zone.width,
          targetHeight: 1.8,
          targetDepth: zone.depth,
          bootstrapPlanarMaxRatio: 0.84,
          minPlanarOccupancyRatio: 0.78,
          maxPlanarOccupancyRatio: 0.92,
          heightBandMinRatio: 0.34,
          heightBandMaxRatio: 0.68,
          tableTopPadding: 0.14,
          tableEdgeMargin: 0.12,
          yScaleMin: 0.01,
          yScaleMax: 12,
          containmentToleranceRatio: 0.018,
          periodicContainmentEnabled: true,
          transformTransitionMs: 650,
          hardHeightGuardEnabled: true
        }
      };
    }
    return profile;
  }

  function createChartFromTemplate(original, id, sourceId, zone, targetType, options) {
    var clone = createEntity('a-entity');
    var componentName = getChartComponentName(original);
    original.getAttributeNames().forEach(function (attributeName) {
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
      clone.setAttribute(attributeName, original.getAttribute(attributeName));
    });
    clone.setAttribute('id', id);
    if (componentName) {
      var chartData = Object.assign({}, original.getAttribute(componentName) || {});
      if (options?.inlineData) {
        delete chartData.from;
        chartData.data = JSON.stringify(options.inlineData);
        chartData.field = 'uid';
      } else {
        delete chartData.data;
        chartData.from = sourceId;
      }
      clone.setAttribute(componentName, chartData);
    }
    var containmentProfile = getHistoricalContainmentProfile(zone);
    clone.setAttribute('scale', '0.01 0.05 0.01');
    if (root.CodeXRAnalysisTableRuntime.applyContainmentProfile) {
      root.CodeXRAnalysisTableRuntime.applyContainmentProfile(clone, containmentProfile);
    } else {
      clone.setAttribute('position', vectorToPositionAttribute(containmentProfile.position));
      clone.setAttribute('codexr-chart-containment', containmentProfile.containment);
    }
    clone.dataset.codexrComparisonTargetType = targetType || '';
    return clone;
  }

  function normalizeComparisonPath(value) {
    return String(value || '')
      .replace(/\\/g, '/')
      .split('/')
      .filter(Boolean);
  }

  function buildComparisonBoatsTree(payload, pathField, namespace) {
    var roots = [];
    var safeNamespace = String(namespace || 'comparison').replace(/[^a-zA-Z0-9_-]/g, '-');

    normalizePayload(payload).forEach(function (entry) {
      var parts = normalizeComparisonPath(entry?.[pathField]);
      if (!parts.length) {
        return;
      }

      var siblings = roots;
      var accumulated = [];
      parts.forEach(function (part, index) {
        accumulated.push(part);
        var isLeaf = index === parts.length - 1;
        var existing = siblings.find(function (candidate) {
          return candidate && candidate.name === part;
        });
        var node = existing;

        if (!node) {
          node = isLeaf ? Object.assign({}, entry) : { children: [] };
          node.name = part;
          node.uid = safeNamespace + ':' + accumulated.join('/');
          siblings.push(node);
        } else if (isLeaf) {
          Object.assign(node, entry);
          node.name = part;
          node.uid = safeNamespace + ':' + accumulated.join('/');
        }

        if (!isLeaf) {
          if (!Array.isArray(node.children)) {
            node.children = [];
          }
          siblings = node.children;
        }
      });
    });

    return roots;
  }

  function createLabel(value, position, color) {
    var label = createEntity('a-entity', { position: position });
    setText(label, value, 4.2, color);
    return label;
  }

  async function renderComparison(result, leftPayload, rightPayload) {
    disposeComparisonGeometry(false);
    var config = getConfig();
    var scene = getDocument()?.querySelector('a-scene');
    var original = getTemplateChart(config);
    if (!scene || !original) {
      throw new Error('The original XR chart is not available.');
    }
    state.payloads = {
      left: normalizePayload(leftPayload),
      right: normalizePayload(rightPayload)
    };
    refs.comparisonRoot = createEntity('a-entity', {
      id: 'codexrHistoricalComparisonRoot',
      'data-codexr-analysis-root': 'true',
      'data-codexr-analysis-mode': 'historical-compare'
    });
    if (root.CodeXRAnalysisSurfaceRuntime?.mountRoot) {
      root.CodeXRAnalysisSurfaceRuntime.mountRoot('historical-compare', refs.comparisonRoot);
    } else {
      scene.appendChild(refs.comparisonRoot);
    }
    var chartComponent = getChartComponentName(original);
    var leftFrom = 'codexrComparisonDataLeft';
    var rightFrom = 'codexrComparisonDataRight';
    var boatsPathField = config?.targetType === 'directory' ? 'filePath' : 'treePath';
    var leftChartOptions = null;
    var rightChartOptions = null;
    if (isHierarchicalBoatsComponent(chartComponent)) {
      leftFrom = '';
      rightFrom = '';
      leftChartOptions = {
        inlineData: buildComparisonBoatsTree(state.payloads.left, boatsPathField, 'codexr-left')
      };
      rightChartOptions = {
        inlineData: buildComparisonBoatsTree(state.payloads.right, boatsPathField, 'codexr-right')
      };
    } else {
      var leftData = createDataSource('codexrComparisonDataLeft', result.left.url + '?revision=' + result.revision);
      var rightData = createDataSource('codexrComparisonDataRight', result.right.url + '?revision=' + result.revision);
      refs.comparisonRoot.appendChild(leftData);
      refs.comparisonRoot.appendChild(rightData);
    }

    await nextFrame();
    var zones = root.CodeXRAnalysisTableRuntime?.getAnalysisTableZones?.('historical-compare') || [
      { id: 'left', anchorX: -1.45, anchorZ: -18, width: 2.7, depth: 3.218 },
      { id: 'right', anchorX: 1.45, anchorZ: -18, width: 2.7, depth: 3.218 }
    ];
    var activeChartIds = [];
    if (result.left.itemCount > 0) {
      var leftChart = createChartFromTemplate(
        original,
        'codexrComparisonChartLeft',
        leftFrom,
        zones[0],
        config?.targetType,
        leftChartOptions
      );
      refs.comparisonRoot.appendChild(leftChart);
      activeChartIds.push(leftChart.id);
    } else {
      refs.comparisonRoot.appendChild(createEmptyState(result.left, zones[0], '#67e8f9'));
    }
    if (result.right.itemCount > 0) {
      var rightChart = createChartFromTemplate(
        original,
        'codexrComparisonChartRight',
        rightFrom,
        zones[1],
        config?.targetType,
        rightChartOptions
      );
      refs.comparisonRoot.appendChild(rightChart);
      activeChartIds.push(rightChart.id);
    } else {
      refs.comparisonRoot.appendChild(createEmptyState(result.right, zones[1], '#6ee7b7'));
    }
    refs.leftLabel = createLabel(buildSourceLabel(result.left.source), zones[0].anchorX + ' 3.05 ' + zones[0].anchorZ, '#67e8f9');
    refs.rightLabel = createLabel(buildSourceLabel(result.right.source), zones[1].anchorX + ' 3.05 ' + zones[1].anchorZ, '#6ee7b7');
    refs.deltaLabel = createLabel(buildDeltaText(result.delta, state.selectedMapping, state.payloads), '0 3.48 -18', '#ffffff');
    refs.comparisonRoot.appendChild(refs.leftLabel);
    refs.comparisonRoot.appendChild(refs.rightLabel);
    refs.comparisonRoot.appendChild(refs.deltaLabel);

    await nextFrame();
    root.CodeXRMappingUiRuntime?.setChartEntityIds?.(activeChartIds);
    root.CodeXRMappingUiRuntime.switchMappingContext.('historical-comparison', {
      reason: 'historical-comparison-ready'
    });
    parkOriginalChart(original);
    root.CodeXRAnalysisTableRuntime?.renormalizeAll?.('historical-comparison-ready');
    if (activeChartIds.length) {
      var stabilization = await root.CodeXRAnalysisTableRuntime?.waitForChartsStable?.(activeChartIds, {
        timeoutMs: 12000,
        pollMs: 140,
        stablePasses: 2
      });
      if (stabilization && !stabilization.valid) {
        throw new Error('One side of the historical comparison could not build a valid chart.');
      }
    }
  }

  function createEmptyState(dataset, zone, color) {
    var empty = createEntity('a-plane', {
      position: zone.anchorX + ' 1.55 ' + zone.anchorZ,
      width: Math.max(1.4, zone.width - 0.3),
      height: 1.25,
      material: 'color: #172033; opacity: 0.92; shader: flat'
    });
    empty.appendChild(createText(
      dataset.missingTarget
        ? 'Target not present in this revision'
        : 'This analysis produced no elements',
      '0 0 0.03',
      3.3,
      color,
      'center',
      34
    ));
    return empty;
  }

  function nextFrame() {
    return new Promise(function (resolve) {
      (root.requestAnimationFrame || function (callback) { return setTimeout(callback, 16); })(resolve);
    });
  }

  function canRefreshLiveSide(result, previousResult) {
    if (!previousResult || !refs.comparisonRoot) {
      return false;
    }
    var sameSources = previousResult.left.source.id === result.left.source.id
      && previousResult.right.source.id === result.right.source.id;
    var liveSide = result.left.source.kind === 'workingCopy' ? 'left'
      : result.right.source.kind === 'workingCopy' ? 'right'
        : '';
    return sameSources
      && !!liveSide
      && previousResult[liveSide].itemCount > 0
      && result[liveSide].itemCount > 0;
  }

  async function refreshLiveSide(result, datasets) {
    var liveSide = result.left.source.kind === 'workingCopy' ? 'left' : 'right';
    var dataset = result[liveSide];
    state.payloads[liveSide] = normalizePayload(datasets[liveSide === 'left' ? 0 : 1]);
    var chart = getDocument().getElementById(
      liveSide === 'left' ? 'codexrComparisonChartLeft' : 'codexrComparisonChartRight'
    );
    var componentName = getChartComponentName(chart);
    if (isHierarchicalBoatsComponent(componentName)) {
      var config = getConfig();
      var pathField = config?.targetType === 'directory' ? 'filePath' : 'treePath';
      var chartData = Object.assign({}, chart.getAttribute(componentName) || {});
      delete chartData.from;
      chartData.data = JSON.stringify(buildComparisonBoatsTree(
        state.payloads[liveSide],
        pathField,
        liveSide === 'left' ? 'codexr-left' : 'codexr-right'
      ));
      chartData.field = 'uid';
      chart.setAttribute(componentName, chartData);
    } else {
      var dataEntity = getDocument().getElementById(
        liveSide === 'left' ? 'codexrComparisonDataLeft' : 'codexrComparisonDataRight'
      );
      if (!dataEntity) {
        throw new Error('The live comparison data source is unavailable.');
      }
      dataEntity.setAttribute('babia-queryjson', 'url: ' + dataset.url + '?revision=' + result.revision);
    }
    setText(liveSide === 'left'  refs.leftLabel : refs.rightLabel, buildSourceLabel(dataset.source), 4.2, liveSide === 'left'  '#67e8f9' : '#6ee7b7');
    setText(refs.deltaLabel, buildDeltaText(result.delta, state.selectedMapping, state.payloads), 4.2, '#ffffff');
    state.result = result;
    await nextFrame();
    root.CodeXRAnalysisTableRuntime?.renormalizeAll?.('historical-comparison-live-refresh');
  }

  function normalizePayload(payload) {
    return Array.isArray(payload) ? payload : [];
  }

  function sumMetric(payload, metric) {
    return normalizePayload(payload).reduce(function (sum, entry) {
      var value = Number(entry && entry[metric]);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
  }

  function getMappedMetricDeltas(mapping, payloads) {
    var fields = Object.keys(mapping || {}).map(function (key) {
      return String(mapping[key] || '');
    }).filter(Boolean);
    return Array.from(new Set(fields)).map(function (metric) {
      var left = sumMetric(payloads?.left, metric);
      var right = sumMetric(payloads?.right, metric);
      return { metric: metric, left: left, right: right, delta: right - left };
    }).filter(function (metric) {
      return metric.left !== 0 || metric.right !== 0;
    });
  }

  function buildDeltaText(delta, mapping, payloads) {
    var text = 'Added ' + Number(delta?.added || 0)
      + ' | Removed ' + Number(delta?.removed || 0)
      + ' | Modified ' + Number(delta?.modified || 0)
      + ' | Unchanged ' + Number(delta?.unchanged || 0);
    var mappedMetrics = getMappedMetricDeltas(mapping, payloads);
    var metrics = (mappedMetrics.length ? mappedMetrics : (Array.isArray(delta?.metrics) ? delta.metrics : [])).slice(0, 3);
    if (metrics.length) {
      text += '\n' + metrics.map(function (metric) {
        var sign = Number(metric.delta) > 0 ? '+' : '';
        return truncate(metric.metric, 14) + ' ' + sign + Number(metric.delta || 0).toFixed(1);
      }).join(' | ');
    }
    return text;
  }

  function handleMappingConfirmed(event) {
    state.selectedMapping = Object.assign({}, event?.detail?.selectedByDimension || {});
    if (state.result && refs.deltaLabel) {
      setText(
        refs.deltaLabel,
        buildDeltaText(state.result.delta, state.selectedMapping, state.payloads),
        4.2,
        '#ffffff'
      );
    }
  }

  function disposeComparisonGeometry(clearResult) {
    if (refs.comparisonRoot?.parentNode) {
      refs.comparisonRoot.parentNode.removeChild(refs.comparisonRoot);
    }
    refs.comparisonRoot = null;
    var config = getConfig();
    var original = restoreOriginalChart() || getTemplateChart(config);
    restoreRaycastInteraction(original);
    restoreOriginalChartMapping(config);
    if (clearResult !== false) {
      state.result = null;
      state.payloads = { left: [], right: [] };
    }
  }

  function registerCollaboration() {
    var client = getClient();
    if (!client) {
      return;
    }
    state.disposables.push(client.onMessage?.('historical-comparison-references', handleReferences));
    state.disposables.push(client.onMessage?.('historical-comparison-progress', handleProgress));
    state.disposables.push(client.onMessage?.('historical-comparison-error', handleError));
    client.registerEntityRuntime?.({
      entityKind: ENTITY_KIND,
      entityId: ENTITY_ID,
      applySharedState: applySharedState,
      publishInitialSharedState: function () {}
    });
  }

  function mountPanelView(attempt) {
    if (buildPanel()) {
      return;
    }
    if (Number(attempt || 0) >= 20) {
      console.warn('[CodeXR][HistoricalComparison] Mapping panel was not available.');
      return;
    }
    setTimeout(function () {
      mountPanelView(Number(attempt || 0) + 1);
    }, 100);
  }

  function autoInit() {
    if (state.initialized || !getDocument()) {
      return;
    }
    state.initialized = true;
    state.unregisterLifecycle = root.CodeXRAnalysisModeRuntime?.register?.('historical-compare', {
      activate: function () {
        if (state.result) {
          if (state.payloads.left.length || state.payloads.right.length) {
            return renderComparison(
              state.result,
              state.payloads.left,
              state.payloads.right
            ).then(function () {
              closePanel();
            });
          }
          return applySharedState({
            entityKind: ENTITY_KIND,
            entityId: ENTITY_ID,
            mode: 'historical-compare',
            result: state.result
          });
        }
        showHistoricalSelectionPanel();
        return true;
      },
      deactivate: function () {
        state.loadGeneration += 1;
        disposeComparisonGeometry(false);
      },
      disposeView: function () {
        state.loadGeneration += 1;
        disposeComparisonGeometry(false);
      }
    }) || null;
    registerHistoricalModeOption();
    mountPanelView(0);
    state.selectedMapping = Object.assign(
      {},
      root.CodeXRMappingUiRuntime?.getState?.().lastKnownGoodMapping || {}
    );
    getDocument().addEventListener('codexr-mapping-confirmed', handleMappingConfirmed);
    state.disposables.push(function () {
      getDocument()?.removeEventListener('codexr-mapping-confirmed', handleMappingConfirmed);
    });
    void configureAvailability();
    registerCollaboration();
  }

  var runtime = {
    autoInit: autoInit,
    open: openPanel,
    close: closePanel,
    activate: enterHistoricalSelection,
    deactivate: function () {
      return root.CodeXRAnalysisModeRuntime?.deactivate?.('historical-compare');
    },
    disposeView: function () {
      state.loadGeneration += 1;
      disposeComparisonGeometry(false);
    },
    applySharedState: applySharedState,
    getState: function () {
      return {
        panelVisible: state.panelVisible,
        selected: Object.assign({}, state.selected),
        result: state.result,
        status: state.status
      };
    },
    destroy: function () {
      state.disposables.forEach(function (dispose) { dispose?.(); });
      state.disposables = [];
      disposeComparisonGeometry();
      state.unregisterModeOption?.();
      state.unregisterModeOption = null;
      state.unregisterLifecycle?.();
      state.unregisterLifecycle = null;
      state.unregisterPanelView?.();
      state.unregisterPanelView = null;
      refs.panel = null;
      state.initialized = false;
    },
    __testing: {
      buildComparisonBoatsTree: buildComparisonBoatsTree,
      selectHistoricalMode: selectHistoricalMode
    }
  };

  if (getDocument()) {
    if (getDocument().readyState === 'loading') {
      getDocument().addEventListener('DOMContentLoaded', autoInit, { once: true });
    } else {
      autoInit();
    }
  }
  root.CodeXRHistoricalComparisonRuntime = runtime;
})(typeof window !== 'undefined' ? window : this);
