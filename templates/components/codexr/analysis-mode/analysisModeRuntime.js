(function registerCodeXRAnalysisModeRuntime(root) {
  'use strict';

  var VALID_MODES = new Set(['selection', 'single', 'historical-compare', 'dependency-graph']);
  var lifecycles = {};
  var state = {
    mode: 'selection',
    activeLifecycleMode: 'selection',
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
    panelRoot: null
  };

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
      class: 'babiaxraycasterclass codexr-analysis-mode-option',
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
      option.onSelect?.();
    });
    return button;
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
        root.CodeXRCollaborationRuntime?.getClient?.(root)
          ?.sendMessage?.('analysis-mode-activate', { mode: 'single' });
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
    root.CodeXRCollaborationRuntime?.getClient?.(root)
      ?.sendMessage?.('analysis-mode-activate', { mode: state.requestedMode || 'single' });
  }

  function openSelector() {
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
      if (state.activeLifecycleMode === mode) {
        await invoke(lifecycles[mode], 'deactivate', {
          from: mode,
          to: null,
          generation: generation,
          context: { reason: 'superseded-activation' }
        });
        state.activeLifecycleMode = null;
      }
      return false;
    }
    return true;
  }

  function transitionTo(mode, context) {
    if (!VALID_MODES.has(mode)) {
      return Promise.reject(new Error('Unsupported CodeXR analysis mode: ' + mode));
    }
    var generation = ++state.generation;
    state.transitioning = true;
    var previousTransition = mode === 'selection'
      ? Promise.resolve()
      : state.transition.catch(function () {});
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

  function getOriginalChart() {
    var chartEntityId = getConfig().chartEntityId;
    return chartEntityId ? root.document?.getElementById?.(chartEntityId) : null;
  }

  function setTableMode(mode) {
    root.document?.getElementById?.('codexrAnalysisTable')
      ?.setAttribute?.('codexr-analysis-table', 'mode', mode);
  }

  function removeResidualVisualRoots() {
    var document = root.document;
    if (!document) {
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
      if (!roots.includes(element)) {
        roots.push(element);
      }
    });
    roots.forEach(function (element) {
      element?.components?.['codexr-dependency-graph']?.disposeView?.();
      if (element?.parentNode) {
        element.parentNode.removeChild(element);
      } else {
        element?.remove?.();
      }
    });
  }

  async function clearVisualizationsForSelection(activation) {
    var context = {
      reason: 'visualization-mode-selection',
      generation: activation?.generation
    };
    await Promise.allSettled(
      ['single', 'historical-compare', 'dependency-graph'].map(function (mode) {
        var lifecycle = lifecycles[mode];
        return typeof lifecycle?.disposeView === 'function'
          ? invoke(lifecycle, 'disposeView', context)
          : invoke(lifecycle, 'deactivate', context);
      })
    );
    removeResidualVisualRoots();
    getOriginalChart()?.setAttribute?.('visible', false);
    root.CodeXRMappingUiRuntime?.setChartEntityIds?.([]);
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
    var original = getOriginalChart();
    var rebuildDelay = original?.hasAttribute?.('babia-boats') ? 900 : 300;
    await new Promise(function (resolve) {
      root.setTimeout?.(resolve, rebuildDelay);
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
    var chartId = config.chartEntityId;
    if (chartId && root.CodeXRAnalysisTableRuntime?.waitForChartsStable) {
      await root.CodeXRAnalysisTableRuntime.waitForChartsStable([chartId], {
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
        var original = getOriginalChart();
        original?.setAttribute?.('visible', true);
        if (config.chartEntityId) {
          root.CodeXRMappingUiRuntime?.setChartEntityIds?.([config.chartEntityId]);
        }
        void waitForNormalChartReady(config, activation).then(function () {
          if (state.mode !== 'single' && state.activeLifecycleMode !== 'single') {
            return;
          }
          original?.setAttribute?.('visible', true);
          root.CodeXRAnalysisTableRuntime?.renormalizeAll?.('normal-analysis-restored');
        });
      },
      deactivate: function () {
        getOriginalChart()?.setAttribute?.('visible', false);
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
        state.mode = 'selection';
        state.activeLifecycleMode = 'selection';
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
    registerBuiltInLifecycles();
    mountModePanel(0);
    registerCollaboration(0);
  }
})(typeof window !== 'undefined' ? window : this);
