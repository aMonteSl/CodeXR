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
    // The chart selector follows the mode: project evolution selects its own
    // movie chart (boats) in its activate; every other mode shows the chart
    // the scene was generated with. UI-only — converting entities is the
    // target mode's own business, and chart selection is global otherwise.
    if (nextMode !== 'project-evolution') {
      var mappingRuntime = root.CodeXRMappingUiRuntime;
      var sceneChartId = mappingRuntime?.getSceneChartId?.();
      if (sceneChartId && mappingRuntime?.getState?.()?.chartId !== sceneChartId) {
        mappingRuntime?.selectChart?.(sceneChartId, { applyToEntities: false });
      }
    }
    setTableMode(nextMode);
    // The selector's header button carries the accent of the analysis you are
    // in, so the panel tells you where you are before you open anything.
    root.CodeXRMappingUiRuntime?.setPanelViewButtonColor?.(
      'visualization-mode',
      MODE_ACCENT_BY_ID[nextMode] || MODE_ACCENT_BY_ID.single
    );
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
    // Preserved roots are saved state, not residue: their mode hides them and
    // restores them as left (mirrors removeTransientRoots in the surface).
    roots = roots.filter(function (element) {
      return element.getAttribute?.('data-codexr-preserve') !== 'true';
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
    // invokeSafely, not invoke: a synchronous throw inside one mode's cleanup
    // would escape the .map() before Promise.allSettled could contain it,
    // rejecting the whole transition (and silently killing anything awaiting
    // it, like the dependency-graph start handshake).
    await Promise.allSettled(
      ['single', 'historical-compare', 'project-evolution', 'dependency-graph'].map(function (mode) {
        var lifecycle = lifecycles[mode];
        return typeof lifecycle?.disposeView === 'function'
          ? invokeSafely(lifecycle, 'disposeView', context)
          : invokeSafely(lifecycle, 'deactivate', context);
      })
    );
    ensureAnalysisSurfaceRuntime().clearForSelection(context.reason);
    removeResidualVisualRoots();
    root.CodeXRMappingUiRuntime?.setChartEntityIds?.([]);
    debugLog('Visualization selector cleanup completed', {
      generation: activation?.generation
    });
  }
