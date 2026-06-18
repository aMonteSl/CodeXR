(function registerCodeXRAnalysisModeRuntime(root) {
  'use strict';

  var VALID_MODES = new Set(['selection', 'single', 'historical-compare', 'dependency-graph']);
  var lifecycles = {};
  var state = {
    mode: 'single',
    activeLifecycleMode: 'single',
    requestedMode: 'single',
    transitioning: false,
    generation: 0,
    transition: Promise.resolve(),
    collaborationRegistered: false,
    pendingNormalRefresh: null,
    lastNormalModeRevision: 0,
    modeOptions: [],
    unregisterPanelView: null,
    selectionPanelView: 'visualization-mode',
    panelRoot: null,
    openingSelectorFromPanel: false
  };

  function debugLog() {
    var args = Array.prototype.slice.call(arguments);
    args.unshift('[CodeXR.Debug]:');
    root.console?.log?.apply?.(root.console, args);
  }

  function setElementTreeVisible(element, visible) {
    if (!element) { return; }
    element.setAttribute?.('visible', !!visible);
    if (element.object3D) {
      element.object3D.visible = !!visible;
      element.object3D.traverse?.(function (object) {
        object.visible = !!visible;
      });
    }
  }

  function setElementSelfVisible(element, visible) {
    if (!element) { return; }
    element.setAttribute?.('visible', !!visible);
    if (element.object3D) {
      element.object3D.visible = !!visible;
    }
  }

  function removeElement(element) {
    if (!element) { return; }
    element.components?.['codexr-dependency-graph']?.disposeView?.();
    if (element.parentNode) {
      element.parentNode.removeChild(element);
      return;
    }
    element.remove?.();
  }

  function ensureAnalysisSurfaceRuntime() {
    if (root.CodeXRAnalysisSurfaceRuntime) {
      return root.CodeXRAnalysisSurfaceRuntime;
    }
    var SURFACE_ID = 'codexrAnalysisSurface';
    var NORMAL_ROOT_ID = 'codexrNormalAnalysisRoot';
    var registeredRoots = new Map();
    var localGeneration = 0;

    function documentRef() {
      return root.document;
    }

    function sceneRef() {
      return documentRef()?.querySelector?.('a-scene') || null;
    }

    function getSurface(createIfMissing) {
      var document = documentRef();
      if (!document) { return null; }
      var cfg = getConfig();
      var surfaceId = String(cfg?.normalSurfaceId || SURFACE_ID);
      var surface = document.getElementById?.(surfaceId);
      if (!surface && createIfMissing !== false && document.createElement) {
        surface = document.createElement('a-entity');
        surface.setAttribute('id', surfaceId);
        surface.setAttribute('data-codexr-analysis-surface', 'true');
        sceneRef()?.appendChild?.(surface);
        debugLog('Analysis surface created', { surfaceId: surfaceId });
      }
      return surface || null;
    }

    function getNormalRoot() {
      var document = documentRef();
      if (!document) { return null; }
      var cfg = getConfig();
      return document.getElementById?.(String(cfg?.normalRootId || NORMAL_ROOT_ID))
        || document.querySelector?.('[data-codexr-normal-root="true"]')
        || null;
    }

    function getModeRoots(mode) {
      var document = documentRef();
      if (!document) { return []; }
      var roots = [];
      var surface = getSurface(false);
      registeredRoots.forEach(function (entry) {
        if (entry.mode === mode && entry.element?.isConnected !== false) {
          roots.push(entry.element);
        }
      });
      document.querySelectorAll?.('[data-codexr-analysis-root="true"]').forEach(function (element) {
        if (element.getAttribute?.('data-codexr-analysis-mode') === mode) {
          roots.push(element);
        }
      });
      surface?.querySelectorAll?.('[data-codexr-analysis-mode="' + mode + '"]').forEach(function (element) {
        roots.push(element);
      });
      return uniqueElements(roots);
    }

    function mountRoot(mode, element) {
      if (!element) { return null; }
      var surface = getSurface(true);
      if (!surface) { return element; }
      element.setAttribute?.('data-codexr-analysis-root', 'true');
      element.setAttribute?.('data-codexr-analysis-mode', mode);
      if (element.parentNode !== surface) {
        surface.appendChild(element);
      }
      setElementSelfVisible(surface, true);
      setElementTreeVisible(element, true);
      registeredRoots.set(element.id || mode + ':' + registeredRoots.size, {
        mode: mode,
        element: element
      });
      debugLog('Surface root mounted', {
        mode: mode,
        id: element.id || '',
        surfaceChildren: surface.children?.length || 0
      });
      return element;
    }

    function removeMode(mode) {
      if (mode === 'single') {
        setNormalVisible(false);
        return 0;
      }
      var removed = 0;
      getModeRoots(mode).forEach(function (element) {
        removeElement(element);
        removed += 1;
      });
      registeredRoots.forEach(function (entry, key) {
        if (entry.mode === mode) {
          registeredRoots.delete(key);
        }
      });
      return removed;
    }

    function removeTransientRoots() {
      var document = documentRef();
      if (!document) { return []; }
      var removed = [];
      var normalRoot = getNormalRoot();
      var surface = getSurface(false);
      document.querySelectorAll?.('[data-codexr-analysis-root="true"]').forEach(function (element) {
        if (element === normalRoot || element.getAttribute?.('data-codexr-analysis-mode') === 'single') {
          return;
        }
        removed.push(element.id || element.getAttribute?.('data-codexr-analysis-mode') || 'anonymous-root');
        removeElement(element);
      });
      surface?.children && Array.from(surface.children).forEach(function (child) {
        if (child === normalRoot || child.getAttribute?.('data-codexr-analysis-mode') === 'single') {
          return;
        }
        removed.push(child.id || child.getAttribute?.('data-codexr-analysis-mode') || 'anonymous-child');
        removeElement(child);
      });
      registeredRoots.forEach(function (entry, key) {
        if (entry.mode !== 'single') {
          registeredRoots.delete(key);
        }
      });
      return removed;
    }

    function setNormalVisible(visible) {
      var surface = getSurface(visible);
      var roots = getNormalVisualizationRoots();
      var normalRoot = getNormalRoot();
      if (normalRoot && !roots.includes(normalRoot)) {
        roots.unshift(normalRoot);
      }
      if (!roots.length && surface) {
        var surfaceNormal = surface.querySelector?.('[data-codexr-analysis-mode="single"]');
        if (surfaceNormal) { roots.push(surfaceNormal); }
      }
      if (surface && visible) {
        setElementSelfVisible(surface, true);
      }
      roots.forEach(function (element) {
        setElementTreeVisible(element, visible);
      });
      if (surface && !visible && !surface.querySelector?.('[data-codexr-analysis-mode]:not([data-codexr-analysis-mode="single"])')) {
        setElementTreeVisible(surface, false);
      }
      debugLog('Surface normal visibility changed', {
        visible: !!visible,
        rootCount: roots.length,
        ids: roots.map(function (element) { return element.id || element.tagName || 'anonymous'; })
      });
      return roots.length;
    }

    function clearForSelection(reason) {
      localGeneration += 1;
      var generation = localGeneration;
      var surface = getSurface(false);
      debugLog('Surface clear requested', {
        reason: reason || '',
        generation: generation,
        surfaceFound: !!surface,
        childCount: surface?.children?.length || 0
      });
      var removed = removeTransientRoots();
      var hiddenNormalCount = setNormalVisible(false);
      surface = getSurface(false);
      if (surface) {
        setElementTreeVisible(surface, false);
      }
      var remaining = surface?.querySelectorAll?.('[data-codexr-analysis-root="true"]')?.length || 0;
      debugLog('Surface cleared', {
        generation: generation,
        removed: removed,
        hiddenNormalCount: hiddenNormalCount,
        remainingRoots: remaining
      });
      return {
        generation: generation,
        removed: removed,
        hiddenNormalCount: hiddenNormalCount,
        remainingRoots: remaining
      };
    }

    function activateMode(mode) {
      var surface = getSurface(true);
      if (surface) {
        setElementSelfVisible(surface, true);
      }
      if (mode === 'single') {
        removeTransientRoots();
        setNormalVisible(true);
      } else {
        setNormalVisible(false);
      }
      debugLog('Mode activated on surface', {
        mode: mode,
        childCount: surface?.children?.length || 0
      });
    }

    function getSnapshot() {
      var surface = getSurface(false);
      var roots = surface?.querySelectorAll?.('[data-codexr-analysis-root="true"]') || [];
      return {
        surfaceId: surface?.id || null,
        surfaceVisible: surface?.getAttribute?.('visible') !== false,
        childCount: surface?.children?.length || 0,
        visualRootCount: roots.length || 0,
        roots: Array.from(roots).map(function (element) {
          return {
            id: element.id || '',
            mode: element.getAttribute?.('data-codexr-analysis-mode') || '',
            visible: element.getAttribute?.('visible') !== false
          };
        }),
        registeredRootCount: registeredRoots.size,
        generation: localGeneration
      };
    }

    root.CodeXRAnalysisSurfaceRuntime = {
      getSurface: function () { return getSurface(true); },
      mountRoot: mountRoot,
      removeMode: removeMode,
      clearForSelection: clearForSelection,
      setNormalVisible: setNormalVisible,
      activateMode: activateMode,
      getSnapshot: getSnapshot,
      __testing: {
        setElementTreeVisible: setElementTreeVisible,
        clearForSelection: clearForSelection,
        removeTransientRoots: removeTransientRoots
      }
    };
    return root.CodeXRAnalysisSurfaceRuntime;
  }

  function getNormalRefreshRuntime() {
    if (root.CodeXRNormalAnalysisRefreshRuntime) {
      return root.CodeXRNormalAnalysisRefreshRuntime;
    }
    var refreshState = {
      generation: 0,
      completedGeneration: 0,
      refreshing: false,
      waiters: []
    };
    function resolveWaiters() {
      refreshState.waiters = refreshState.waiters.filter(function (waiter) {
        if (refreshState.completedGeneration <= waiter.baseline) {
          return true;
        }
        root.clearTimeout?.(waiter.timer);
        waiter.resolve({
          completed: true,
          generation: refreshState.completedGeneration
        });
        return false;
      });
    }
    root.CodeXRNormalAnalysisRefreshRuntime = {
      begin: function () {
        refreshState.generation += 1;
        refreshState.refreshing = true;
        return refreshState.generation;
      },
      complete: function (generation) {
        refreshState.completedGeneration = Math.max(
          refreshState.completedGeneration,
          Number(generation || refreshState.generation)
        );
        refreshState.refreshing = refreshState.completedGeneration < refreshState.generation;
        resolveWaiters();
        return refreshState.completedGeneration;
      },
      waitForCompletionAfter: function (baseline, timeoutMs) {
        if (refreshState.completedGeneration > Number(baseline || 0)) {
          return Promise.resolve({
            completed: true,
            generation: refreshState.completedGeneration
          });
        }
        return new Promise(function (resolve) {
          var waiter = {
            baseline: Number(baseline || 0),
            resolve: resolve,
            timer: null
          };
          waiter.timer = root.setTimeout?.(function () {
            refreshState.waiters = refreshState.waiters.filter(function (candidate) {
              return candidate !== waiter;
            });
            resolve({
              completed: false,
              generation: refreshState.completedGeneration,
              reason: 'refresh-timeout'
            });
          }, Math.max(500, Number(timeoutMs || 3500)));
          refreshState.waiters.push(waiter);
        });
      },
      getState: function () {
        return {
          generation: refreshState.generation,
          completedGeneration: refreshState.completedGeneration,
          refreshing: refreshState.refreshing
        };
      }
    };
    return root.CodeXRNormalAnalysisRefreshRuntime;
  }

  function invoke(lifecycle, method, context) {
    if (typeof lifecycle?.[method] !== 'function') {
      return Promise.resolve();
    }
    return Promise.resolve(lifecycle[method](context));
  }

  function register(mode, lifecycle) {
    if (!VALID_MODES.has(mode) || !lifecycle) {
      return function () {};
    }
    lifecycles[mode] = lifecycle;
    if (state.mode === mode && !state.transitioning) {
      void invoke(lifecycle, 'activate', {
        from: mode,
        to: mode,
        generation: state.generation,
        context: { reason: 'late-registration' }
      }).then(function () {
        if (!state.transitioning && state.mode === mode) {
          state.activeLifecycleMode = mode;
        }
      });
    }
    return function () {
      if (lifecycles[mode] === lifecycle) {
        delete lifecycles[mode];
      }
    };
  }

  function createEntity(tagName, attributes) {
    var element = root.document?.createElement?.(tagName);
    Object.keys(attributes || {}).forEach(function (key) {
      element?.setAttribute?.(key, attributes[key]);
    });
    return element;
  }

  function createModeButton(option, y) {
    var button = createEntity('a-plane', {
      position: '0 ' + y + ' 0.02',
      width: 4.5,
      height: 0.48,
      material: 'color: ' + (option.color || '#0e7490') + '; opacity: 0.96; shader: flat',
      class: 'codexr-analysis-mode-option',
      'data-codexr-interactive': 'true',
      'data-codexr-mode-option': option.id
    });
    var label = createEntity('a-text', {
      value: option.label,
      position: '0 0 0.02',
      width: 6.8,
      color: '#ffffff',
      align: 'center',
      baseline: 'center'
    });
    button?.appendChild?.(label);
    button?.addEventListener?.('click', function () {
      debugLog('Visualization mode option clicked', option.id);
      option.onSelect?.();
    });
    return button;
  }

  function requestModeActivation(mode) {
    if (!VALID_MODES.has(mode) || mode === 'selection') {
      return Promise.resolve(false);
    }
    debugLog('Requesting analysis mode activation', mode, {
      currentMode: state.mode,
      activeLifecycleMode: state.activeLifecycleMode,
      transitioning: state.transitioning
    });
    var client = root.CodeXRCollaborationRuntime?.getClient?.(root);
    client?.sendMessage?.('analysis-mode-activate', { mode: mode });
    return transitionTo(mode, {
      reason: 'local-analysis-mode-option',
      panelViewId: mode === 'single'
        ? 'mapping'
        : mode === 'dependency-graph'
          ? 'dependency-graph'
          : 'mapping'
    });
  }

  function renderModeOptions() {
    if (!state.panelRoot) { return; }
    while (state.panelRoot.firstChild) {
      state.panelRoot.removeChild(state.panelRoot.firstChild);
    }
    state.panelRoot.appendChild(createEntity('a-text', {
      value: 'Choose how the analysis table represents the data.',
      position: '0 1.18 0.02',
      width: 5.5,
      color: '#cde7ff',
      align: 'center',
      baseline: 'center'
    }));
    var options = [{
      id: 'single',
      label: 'Normal analysis',
      color: '#0e7490',
      onSelect: function () {
        void requestModeActivation('single');
      }
    }].concat(state.modeOptions);
    options.forEach(function (option, index) {
      state.panelRoot.appendChild(createModeButton(option, 0.55 - (index * 0.62)));
    });
  }

  function registerModeOption(option) {
    if (!option?.id || typeof option.onSelect !== 'function') {
      return function () {};
    }
    state.modeOptions = state.modeOptions.filter(function (candidate) {
      return candidate.id !== option.id;
    });
    state.modeOptions.push(option);
    renderModeOptions();
    return function () {
      state.modeOptions = state.modeOptions.filter(function (candidate) {
        return candidate.id !== option.id;
      });
      renderModeOptions();
    };
  }

  function resumeRequestedMode() {
    debugLog('Resuming requested analysis mode', state.requestedMode || 'single');
    root.CodeXRCollaborationRuntime?.getClient?.(root)
      ?.sendMessage?.('analysis-mode-activate', { mode: state.requestedMode || 'single' });
    void transitionTo(state.requestedMode || 'single', {
      reason: 'local-visualization-mode-toggle'
    });
  }

  function openSelector() {
    debugLog('Opening visualization mode selector', {
      currentMode: state.mode,
      activeLifecycleMode: state.activeLifecycleMode,
      transitioning: state.transitioning
    });
    state.selectionPanelView = 'visualization-mode';
    return transitionTo('selection', {
      reason: 'local-mode-selection',
      panelViewId: 'visualization-mode'
    }).then(function () {
      root.CodeXRCollaborationRuntime?.getClient?.(root)
        ?.sendMessage?.('analysis-mode-selection', {});
      return true;
    });
  }

  function mountModePanel(attempt) {
    if (state.unregisterPanelView) { return; }
    var mappingRuntime = root.CodeXRMappingUiRuntime;
    if (!mappingRuntime?.registerPanelView || !mappingRuntime.isPanelReady?.()) {
      if (attempt < 30) {
        root.setTimeout?.(function () { mountModePanel(attempt + 1); }, 100);
      }
      return;
    }
    state.panelRoot = createEntity('a-entity', {
      id: 'codexrVisualizationModePanel',
      position: '0 0 0.04'
    });
    state.unregisterPanelView = mappingRuntime.registerPanelView({
      id: 'visualization-mode',
      title: 'Visualization mode',
      buttonLabel: 'V',
      headerButton: true,
      panelHeight: 3.35,
      content: state.panelRoot,
      onShow: function () {
        state.selectionPanelView = 'visualization-mode';
        if (state.mode !== 'selection' && !state.openingSelectorFromPanel) {
          state.openingSelectorFromPanel = true;
          debugLog('Visualization mode panel shown directly; forcing selection mode', {
            currentMode: state.mode,
            activeLifecycleMode: state.activeLifecycleMode,
            transitioning: state.transitioning
          });
          void openSelector().finally(function () {
            state.openingSelectorFromPanel = false;
          });
        }
      },
      onToggleActive: resumeRequestedMode
    });
    if (!state.unregisterPanelView) {
      state.panelRoot = null;
      if (attempt < 30) {
        root.setTimeout?.(function () { mountModePanel(attempt + 1); }, 100);
      }
      return;
    }
    renderModeOptions();
  }

  async function performTransition(mode, context, generation) {
    var previousMode = state.activeLifecycleMode;
    debugLog('Analysis mode transition started', {
      from: previousMode,
      to: mode,
      generation: generation,
      reason: context?.reason || ''
    });
    if (previousMode !== mode) {
      await invoke(lifecycles[previousMode], 'deactivate', {
        from: previousMode,
        to: mode,
        generation: generation
      });
      if (state.activeLifecycleMode === previousMode) {
        state.activeLifecycleMode = null;
      }
    }
    if (generation !== state.generation) { return false; }
    if (mode !== 'selection') {
      state.requestedMode = mode;
    }
    setTableMode(mode);
    state.activeLifecycleMode = mode;
    state.mode = mode;
    var panelViewId = context?.panelViewId
      || (mode === 'selection' ? state.selectionPanelView : null)
      || (mode === 'single' ? 'mapping' : null);
    if (panelViewId) {
      root.CodeXRMappingUiRuntime?.showPanelView?.(panelViewId);
    }
    try {
      await invoke(lifecycles[mode], 'activate', {
        from: previousMode,
        to: mode,
        generation: generation,
        context: context || null
      });
    } catch (error) {
      if (generation === state.generation) {
        await invoke(lifecycles[mode], 'disposeView', {
          from: mode,
          to: 'selection',
          generation: generation,
          context: { reason: 'activation-error', error: error }
        });
        state.activeLifecycleMode = 'selection';
        state.mode = 'selection';
        setTableMode('selection');
        await clearVisualizationsForSelection({ generation: generation });
        root.CodeXRMappingUiRuntime?.showPanelView?.(state.selectionPanelView);
      }
      console.error('[CodeXR][AnalysisMode] Could not activate mode:', mode, error);
      return false;
    }
    if (generation !== state.generation) {
      await invoke(lifecycles[mode], 'deactivate', {
        from: mode,
        to: null,
        generation: generation,
        context: { reason: 'superseded-activation' }
      });
      if (state.activeLifecycleMode === mode) {
        state.activeLifecycleMode = null;
      }
      return false;
    }
    debugLog('Analysis mode transition completed', {
      mode: mode,
      activeLifecycleMode: state.activeLifecycleMode,
      generation: generation
    });
    return true;
  }

  function transitionTo(mode, context) {
    if (!VALID_MODES.has(mode)) {
      return Promise.reject(new Error('Unsupported CodeXR analysis mode: ' + mode));
    }
    var generation = ++state.generation;
    state.transitioning = true;
    var previousTransition = state.transition.catch(function () {});
    var nextTransition = previousTransition.then(function () {
      return performTransition(mode, context, generation);
    }).finally(function () {
      if (generation === state.generation) {
        state.transitioning = false;
      }
    });
    state.transition = nextTransition;
    return nextTransition;
  }

  function deactivate(mode, context) {
    if (state.mode !== mode) {
      return invoke(lifecycles[mode], 'disposeView', context || null);
    }
    return transitionTo('single', context);
  }

  function getConfig() {
    var script = root.document?.getElementById?.('codexr-tooling-config-xr-mapping-ui');
    try { return JSON.parse(script?.textContent || '{}'); } catch { return {}; }
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

  function getNormalVisualizationRoots() {
    var document = root.document;
    if (!document) {
      return [];
    }
    var config = getConfig();
    var roots = [];
    collectConfiguredIds(config, [
      'normalRootId',
      'normalEntityIds',
      'visualizationEntityIds',
      'chartEntityIds',
      'chartEntityId',
      'chartId'
    ]).forEach(function (id) {
      var element = document.getElementById?.(id);
      if (element) {
        roots.push(element);
      }
    });
    if (config?.chartSelector && typeof document.querySelector === 'function') {
      var selected = document.querySelector(config.chartSelector);
      if (selected) {
        roots.push(selected);
      }
    }
    document.querySelectorAll?.('[data-codexr-normal-root="true"], [data-codexr-normal-visualization="true"]')
      .forEach(function (element) {
        roots.push(element);
      });
    return uniqueElements(roots);
  }

  function getNormalMappingTargetIds(config) {
    var ids = collectConfiguredIds(config, ['chartEntityIds', 'chartEntityId', 'chartId']);
    if (!ids.length) {
      ids = getNormalVisualizationRoots()
        .map(function (element) { return element.id; })
        .filter(Boolean);
    }
    return Array.from(new Set(ids));
  }

  function setNormalVisualizationVisible(visible) {
    var surfaceRuntime = ensureAnalysisSurfaceRuntime();
    surfaceRuntime.setNormalVisible(visible);
  }

  function setTableMode(mode) {
    root.document?.getElementById?.('codexrAnalysisTable')
      ?.setAttribute?.('codexr-analysis-table', 'mode', mode);
  }

  function removeResidualVisualRoots() {
    var document = root.document;
    if (!document) {
      debugLog('Residual visual root cleanup skipped: document unavailable');
      return;
    }
    var roots = [];
    ['codexrHistoricalComparisonRoot', 'codexrDependencyGraph'].forEach(function (id) {
      var element = document.getElementById?.(id);
      if (element) {
        roots.push(element);
      }
    });
    document.querySelectorAll?.('[data-codexr-analysis-root="true"]').forEach(function (element) {
      if (
        element.getAttribute?.('data-codexr-analysis-mode') === 'single'
        || element.getAttribute?.('data-codexr-normal-root') === 'true'
      ) {
        return;
      }
      if (!roots.includes(element)) {
        roots.push(element);
      }
    });
    debugLog('Residual visual root cleanup', {
      count: roots.length,
      ids: roots.map(function (element) {
        return element.id || element.getAttribute?.('data-codexr-analysis-mode') || element.tagName || 'unknown';
      })
    });
    roots.forEach(function (element) {
      removeElement(element);
    });
  }

  async function clearVisualizationsForSelection(activation) {
    var context = {
      reason: 'visualization-mode-selection',
      generation: activation?.generation
    };
    debugLog('Clearing active visualizations for visualization selector', {
      generation: activation?.generation,
      activeLifecycleMode: state.activeLifecycleMode,
      mode: state.mode
    });
    await Promise.allSettled(
      ['single', 'historical-compare', 'dependency-graph'].map(function (mode) {
        var lifecycle = lifecycles[mode];
        return typeof lifecycle?.disposeView === 'function'
          ? invoke(lifecycle, 'disposeView', context)
          : invoke(lifecycle, 'deactivate', context);
      })
    );
    ensureAnalysisSurfaceRuntime().clearForSelection(context.reason);
    removeResidualVisualRoots();
    root.CodeXRMappingUiRuntime?.setChartEntityIds?.([]);
    debugLog('Visualization selector cleanup completed', {
      generation: activation?.generation
    });
  }

  function getSnapshotModeRevision(snapshot, mode) {
    return Number(snapshot?.modeRevision?.[mode] || 0);
  }

  async function refreshNormalDataSources(modeRevision) {
    var doc = root.document;
    if (!doc?.querySelectorAll || modeRevision <= state.lastNormalModeRevision) {
      return false;
    }
    var mappingRuntime = root.CodeXRMappingUiRuntime;
    var mappingState = mappingRuntime?.getState?.() || null;
    var dataEntities = Array.from(new Set(doc.querySelectorAll('[babia-queryjson]')));
    var timestamp = Date.now();
    dataEntities.forEach(function (dataEntity) {
      var current = dataEntity.getAttribute?.('babia-queryjson');
      if (!current) {
        return;
      }
      var currentUrl = typeof current === 'string' ? current : current.url || '';
      if (!currentUrl) {
        return;
      }
      var nextUrl = currentUrl.split('?')[0]
        + '?codexrModeRevision=' + modeRevision
        + '&t=' + timestamp;
      if (typeof current === 'string') {
        dataEntity.setAttribute('babia-queryjson', nextUrl);
      } else {
        dataEntity.setAttribute('babia-queryjson', Object.assign({}, current, { url: nextUrl }));
      }
    });
    await new Promise(function (resolve) {
      root.setTimeout?.(resolve, 450);
    });
    if (mappingState && mappingRuntime?.restoreState) {
      mappingRuntime.restoreState(mappingState);
    }
    state.lastNormalModeRevision = modeRevision;
    return dataEntities.length > 0;
  }

  async function waitForNormalChartReady(config, activation) {
    var snapshot = activation?.context?.snapshot || null;
    var modeRevision = getSnapshotModeRevision(snapshot, 'single');
    var refreshedFromRevision = await refreshNormalDataSources(modeRevision);
    var pending = state.pendingNormalRefresh;
    if (pending && !refreshedFromRevision) {
      await getNormalRefreshRuntime().waitForCompletionAfter(pending.baseline, 5000);
    }
    var chartIds = getNormalMappingTargetIds(config);
    if (chartIds.length && root.CodeXRAnalysisTableRuntime?.waitForChartsStable) {
      await root.CodeXRAnalysisTableRuntime.waitForChartsStable(chartIds, {
        timeoutMs: 8000,
        pollMs: 100,
        stablePasses: 2
      });
    }
    state.pendingNormalRefresh = null;
  }

  function registerBuiltInLifecycles() {
    register('selection', {
      activate: async function (activation) {
        await clearVisualizationsForSelection(activation);
      }
    });
    register('single', {
      activate: function (activation) {
        var config = getConfig();
        ensureAnalysisSurfaceRuntime().activateMode('single');
        var chartIds = getNormalMappingTargetIds(config);
        if (chartIds.length) {
          root.CodeXRMappingUiRuntime?.setChartEntityIds?.(chartIds);
        }
        void waitForNormalChartReady(config, activation).then(function () {
          if (state.mode !== 'single' && state.activeLifecycleMode !== 'single') {
            return;
          }
          setNormalVisualizationVisible(true);
          root.CodeXRAnalysisTableRuntime?.renormalizeAll?.('normal-analysis-restored');
        });
      },
      deactivate: function () {
        setNormalVisualizationVisible(false);
      }
    });
  }

  function registerCollaboration(attempt) {
    if (state.collaborationRegistered) { return; }
    var client = root.CodeXRCollaborationRuntime?.getClient?.(root);
    if (!client?.registerEntityRuntime) {
      if (attempt < 30) {
        root.setTimeout?.(function () { registerCollaboration(attempt + 1); }, 100);
      }
      return;
    }
    state.collaborationRegistered = true;
    client.registerEntityRuntime({
      entityKind: 'analysis-view',
      entityId: 'main',
      applySharedState: function (snapshot) {
        if (VALID_MODES.has(snapshot?.mode)) {
          if (snapshot.mode === 'single' && snapshot.status !== 'ready') {
            state.pendingNormalRefresh = {
              baseline: getNormalRefreshRuntime().getState().completedGeneration,
              sourceRevision: Number(snapshot.sourceRevision || 0)
            };
          }
          state.requestedMode = snapshot.mode === 'selection' ? state.requestedMode : snapshot.mode;
          var visibleMode = snapshot.mode;
          void transitionTo(visibleMode, {
            reason: 'authoritative-analysis-view',
            snapshot: snapshot,
            panelViewId: visibleMode === 'selection'
              ? state.selectionPanelView
              : visibleMode === 'single'
                ? 'mapping'
                : visibleMode === 'dependency-graph'
                  ? 'dependency-graph'
                  : 'mapping'
          });
        }
      },
      publishInitialSharedState: function () {}
    });
  }

  root.CodeXRAnalysisModeRuntime = {
    register: register,
    registerModeOption: registerModeOption,
    openSelector: openSelector,
    resumeRequestedMode: resumeRequestedMode,
    setSelectionPanel: function (viewId) {
      state.selectionPanelView = String(viewId || 'visualization-mode');
    },
    transitionTo: transitionTo,
    deactivate: deactivate,
    getState: function () {
      return {
        mode: state.mode,
        requestedMode: state.requestedMode,
        transitioning: state.transitioning,
        generation: state.generation
      };
    },
    __testing: {
      clearVisualizationsForSelection: clearVisualizationsForSelection,
      removeResidualVisualRoots: removeResidualVisualRoots,
      reset: function () {
        Object.keys(lifecycles).forEach(function (key) { delete lifecycles[key]; });
        state.mode = 'single';
        state.activeLifecycleMode = 'single';
        state.requestedMode = 'single';
        state.transitioning = false;
        state.generation = 0;
        state.transition = Promise.resolve();
        state.collaborationRegistered = false;
        state.pendingNormalRefresh = null;
        state.lastNormalModeRevision = 0;
        state.modeOptions = [];
        state.selectionPanelView = 'visualization-mode';
      }
    }
  };
  if (root.document) {
    getNormalRefreshRuntime();
    ensureAnalysisSurfaceRuntime();
    registerBuiltInLifecycles();
    mountModePanel(0);
    registerCollaboration(0);
  }
})(typeof window !== 'undefined' ? window : this);
