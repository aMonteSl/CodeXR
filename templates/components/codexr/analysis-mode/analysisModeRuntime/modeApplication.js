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
    var reason = 'visualization-mode-selection';
    debugLog('Clearing active visualizations for visualization selector', {
      generation: activation?.generation,
      activeLifecycleMode: state.activeLifecycleMode,
      mode: state.mode
    });
    // The outgoing lifecycle was already deactivated transactionally by
    // performTransition. Sweeping every lifecycle here ran cleanup twice and
    // let inactive modes cancel or rebuild state they no longer owned.
    ensureAnalysisSurfaceRuntime().clearForSelection(reason);
    removeResidualVisualRoots();
    root.CodeXRMappingUiRuntime?.setChartEntityIds?.([], { renormalize: false });
    debugLog('Visualization selector cleanup completed', {
      generation: activation?.generation
    });
  }
