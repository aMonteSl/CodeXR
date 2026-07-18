// == analysisModeRuntime.js | modeApplication (assembled per manifest.json; see COMPONENTS.md) ==
  function applyAnalysisMode(mode, context) {
    var nextMode = VALID_MODES.has(mode) ? mode : 'single';
    var controllerView = resolveControllerView(nextMode, context || null);
    if (nextMode !== 'selection') {
      state.requestedMode = nextMode;
    }
    state.activeLifecycleMode = nextMode;
    state.mode = nextMode;
    state.controllerView = controllerView;
    setTableMode(nextMode);
    var panelViewId = resolveModePanelView(nextMode, context || null);
    applyControllerView(nextMode, controllerView, panelViewId, context || null);
    return nextMode;
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
      ['single', 'historical-compare', 'project-evolution', 'dependency-graph'].map(function (mode) {
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
