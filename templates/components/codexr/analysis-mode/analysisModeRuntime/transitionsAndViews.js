// == analysisModeRuntime.js | transitionsAndViews (assembled per manifest.json; see COMPONENTS.md) ==
  function transitionTo(mode, context) {
    if (!VALID_MODES.has(mode)) {
      return Promise.reject(new Error('Unsupported CodeXR analysis mode: ' + mode));
    }
    // Same-mode dedupe: entering the mode that is already fully active only
    // re-applies the controller/panel routing — it must NOT queue another
    // deactivate/activate cycle. Every entry fires twice (the runtime's direct
    // transitionTo plus the server's authoritative analysis-view echo), and the
    // duplicated lifecycle pass re-parked and re-built everything: the entry
    // flicker, and — with a comparison result present — a full chart rebuild
    // with the scene left empty for its stabilization wait.
    // A snapshot only forces a re-activation for lifecycles that declare they
    // consume it (single: the analysis-view snapshot IS its data-refresh path).
    // Modes fed by their own shared entity — historical, dependency graph,
    // project evolution — must NOT re-run their whole lifecycle for an echo:
    // that second pass re-applied the table geometry and rebuilt the panel
    // rows over an already-correct scene, which is what the entry flicker was.
    var snapshotDrivesReactivation = !!context?.snapshot
      && lifecycles[mode]?.consumesSnapshot === true;
    if (mode === state.mode && state.activeLifecycleMode === mode && !state.transitioning && !snapshotDrivesReactivation) {
      debugLog('Analysis mode transition skipped (mode already active)', {
        mode: mode,
        reason: context?.reason || ''
      });
      applyAnalysisMode(mode, context || null);
      return Promise.resolve(true);
    }
    // In-flight dedupe: a transition to this exact mode is already queued
    // (every entry fires twice — direct call + authoritative echo, in either
    // order). Ride the in-flight transition and re-apply only this caller's
    // routing once it lands, instead of queueing a second lifecycle cycle.
    if (state.transitioning && state.pendingTransitionMode === mode) {
      debugLog('Analysis mode transition merged into in-flight transition', {
        mode: mode,
        reason: context?.reason || ''
      });
      return state.transition.then(function (result) {
        if (state.mode === mode && !state.transitioning) {
          applyAnalysisMode(mode, context || null);
        }
        return result;
      });
    }
    var generation = ++state.generation;
    state.transitioning = true;
    // Target of the latest queued transition — lets the authoritative-echo
    // handler recognise a duplicate before it queues a second full cycle.
    state.pendingTransitionMode = mode;
    var previousTransition = state.transition.catch(function () {});
    var nextTransition = previousTransition.then(function () {
      return performTransition(mode, context, generation);
    }).finally(function () {
      if (generation === state.generation) {
        state.transitioning = false;
        state.pendingTransitionMode = null;
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
      var containedChartIds = [];
      getNormalVisualizationRoots().forEach(function (element) {
        element.querySelectorAll?.('[codexr-chart-containment]')
          .forEach(function (chart) {
            if (chart.id) {
              containedChartIds.push(chart.id);
            }
          });
      });
      ids = containedChartIds.length ? containedChartIds : getNormalVisualizationRoots()
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
    var appliedMode = root.CodeXRAnalysisTableRuntime?.setMode?.(mode);
    if (appliedMode) {
      return appliedMode;
    }
    root.document?.getElementById?.('codexrAnalysisTable')
      ?.setAttribute?.('codexr-analysis-table', 'mode', mode);
    return mode;
  }

  function getDefaultPanelViewForMode(mode) {
    return MODE_PANEL_VIEW_BY_ID[mode] || 'mapping';
  }

  function getDefaultControllerViewForMode(mode) {
    // A mode lifecycle may resolve its default view from its own live state
    // (e.g. historical: mapping when a comparison exists, selector otherwise).
    // This keeps the local transition and the authoritative server echo — which
    // both fall back to this default — from disagreeing on the view.
    var lifecycleView = lifecycles[mode]?.resolveControllerView?.();
    return lifecycleView || MODE_CONTROLLER_VIEW_BY_ID[mode] || 'single.mapping';
  }

  function getPanelViewForControllerView(controllerView) {
    return PANEL_VIEW_BY_CONTROLLER_VIEW[controllerView] || 'mapping';
  }

  function resolveControllerView(mode, context) {
    var snapshotView = context?.snapshot?.controllerView;
    return context?.controllerView
      || snapshotView
      || getDefaultControllerViewForMode(mode);
  }

  function resolveModePanelView(mode, context) {
    var controllerView = resolveControllerView(mode, context || null);
    return context?.panelViewId
      || getPanelViewForControllerView(controllerView)
      || (mode === 'selection' ? state.selectionPanelView : null)
      || getDefaultPanelViewForMode(mode);
  }

  function applyControllerView(mode, controllerView, panelViewId, context) {
    var controller = root.CodeXRAnalysisControllerRuntime || root.CodeXRMappingUiRuntime;
    if (controller?.showView) {
      return controller.showView(controllerView, {
        mode: mode,
        panelViewId: panelViewId,
        reason: context?.reason || 'analysis-mode',
        mappingContextId: context?.mappingContextId || null
      });
    }
    root.CodeXRMappingUiRuntime?.showPanelView?.(panelViewId);
    return {
      mode: mode,
      controllerView: controllerView,
      panelView: panelViewId
    };
  }
