// == xrChartMappingUiRuntime.js | stateAndBootstrap (assembled per manifest.json; see COMPONENTS.md) ==
  function hydrateStateFromConfig(config) {
    state.activeMappingContextId = state.activeMappingContextId || 'normal-analysis';
    state.activeChartId = state.activeChartId || (config && config.chartId) || null;
    var profileKey = getMappingProfileKey(state.activeMappingContextId, getActiveChartId(config));
    var snapshot = state.mappingProfiles[profileKey] || buildDefaultMappingSnapshot(config);
    applyMappingRuntimeState(config, snapshot, 'mapping-ui-hydrate');
  }

  function switchMappingContext(contextId, options) {
    var config = getConfig();
    if (!config) {
      return false;
    }
    var nextContextId = String(contextId || 'default');
    // Idempotent: re-applying the profile already in force would run
    // applyMappingRuntimeState → renderRows, which clears and rebuilds every
    // panel row — the visible controller flash when an entry applies its state
    // more than once. Only the companion needs re-syncing (attribute-only).
    if (getMappingProfileKey(nextContextId, getActiveChartId(config)) === state.appliedMappingProfileKey) {
      state.activeMappingContextId = nextContextId;
      syncMappingCompanion();
      return getState();
    }
    saveActiveMappingProfile();
    state.activeMappingContextId = nextContextId;
    var profileKey = getMappingProfileKey(nextContextId, getActiveChartId(config));
    var profile = state.mappingProfiles[profileKey] || buildDefaultMappingSnapshot(config);
    applyMappingRuntimeState(config, profile, (options && options.reason) || ('mapping-ui-context-' + nextContextId));
    // The mapping view is context-sensitive: swap in the new context's
    // companion section (child title + content) if one is registered.
    syncMappingCompanion();
    return getState();
  }

  function getState() {
    return {
      visible: state.visible,
      mode: state.mode,
      controllerView: state.activeControllerView,
      mappingContextId: state.activeMappingContextId,
      chartId: getActiveChartId(getConfig()),
      selectedByDimension: Object.assign({}, state.selectedByDimension),
      lastKnownGoodMapping: Object.assign({}, state.lastKnownGoodMapping),
      invalidOptionsByDimension: cloneInvalidOptions(state.invalidOptionsByDimension || {})
    };
  }

  function restoreState(runtimeState) {
    var config = getConfig();
    if (!config || !runtimeState || typeof runtimeState !== 'object' || Array.isArray(runtimeState)) {
      console.warn('[CodeXR][MappingUI] Invalid state snapshot; restore skipped.');
      return false;
    }

    return applyMappingRuntimeState(config, runtimeState, 'mapping-ui-restore');
  }

  var sceneLoadHookInstalled = false;

  function autoInit() {
    var config = getConfig();
    if (!config || state.initialized) {
      return;
    }

    // Never build panel entities into a scene that is still loading: entities
    // attached mid-load can wedge A-Frame's load pipeline (their components
    // never initialize and the scene never fires 'loaded'). Deterministic
    // ordering instead of timing luck.
    var scene = getScene();
    if (scene && scene.hasLoaded === false) {
      if (!sceneLoadHookInstalled) {
        sceneLoadHookInstalled = true;
        scene.addEventListener('loaded', function () {
          autoInit();
        }, { once: true });
      }
      return;
    }

    state.initialized = true;

    hydrateStateFromConfig(config);
    buildUi(config);
    registerSharedMappingEntity(config);
    // A generated scene's initial chart reads the raw source in its HTML:
    // if that chart is row-budgeted, re-point it at its top-N slice as soon
    // as the producers are live.
    scheduleChartDataSliceSync();
  }

  var runtime = {
    autoInit: autoInit,
    getState: getState,
    restoreState: restoreState,
    selectChart: selectChart,
    // The chart the XR scene was generated with, immune to later selector
    // switches — the mode machinery restores it when leaving project
    // evolution (the only mode that selects its own chart).
    getSceneChartId: function () {
      getConfig();
      return state.sceneChartId || null;
    },
    // Unsubscribes an entity's Babia chart components from their data producer
    // before it is dropped or rebuilt. Babia never does it, so a discarded
    // chart keeps repainting on every data push.
    releaseChartEntity: releaseChartEntity,
    switchMappingContext: switchMappingContext,
    showView: showControllerView,
    // Lets other runtimes surface a message on the controller's status line
    // (e.g. the mode machinery reporting why an analysis could not open).
    setStatusMessage: setStatusMessage,
    // Locks the chart/axis controls while an analysis cannot safely accept a
    // re-mapping (project evolution locks them while its movie is playing).
    // `reason` is shown so the panel explains why it is not responding.
    setMappingControlsEnabled: function (enabled, reason) {
      state.mappingControlsLocked = !enabled;
      setEntityInteractionEnabled(refs.rowsRoot, !!enabled);
      setEntityInteractionEnabled(refs.chartRoot, !!enabled);
      if (!enabled && reason) {
        setStatusMessage(String(reason), 'info', 0);
      } else if (enabled && state.statusLevel === 'info') {
        setStatusMessage('', 'info', 0);
      }
      return !state.mappingControlsLocked;
    },
    getControllerState: function () {
      return {
        mode: state.mode,
        controllerView: state.activeControllerView,
        panelView: state.activePanelView
      };
    },
    getMappingContext: function () {
      return state.activeMappingContextId;
    },
    refreshAdaptivePlacement: function () {
      var config = getConfig();
      if (!config || !config.adaptiveCorner) {
        return;
      }
      applyAdaptivePlacement(config);
      ensureAdaptivePlacementLoop();
    },
    setVisible: function (visible) {
      var config = getConfig();
      if (!config) {
        return;
      }
      setVisible(config, visible);
    },
    // Canonical chart construction (injected by the generator): the evolution
    // movie and the historical comparison read the boats base and the tree
    // field contract from here instead of keeping their own copies.
    getChartBaseConfig: getChartBaseConfig,
    // Canonical per-chart presentation (rotation, base attributes, row
    // budget) — injected by the generator with a runtime fallback mirror.
    getChartPresentation: getChartPresentation,
    registerPanelView: registerPanelView,
    registerMappingCompanion: registerMappingCompanion,
    showPanelView: showPanelView,
    setPanelViewTitle: setPanelViewTitle,
    setPanelViewHeight: setPanelViewHeight,
    getActivePanelView: function () {
      return state.activePanelView;
    },
    isPanelReady: function () {
      return !!(refs.panel && refs.panelContent);
    },
    whenPanelReady: whenPanelReady,
    setChartEntityIds: function (chartEntityIds) {
      state.chartEntityIdsOverride = Array.isArray(chartEntityIds)
        ? chartEntityIds.filter(Boolean).map(String)
        : null;
      requestChartContainmentRenormalize('mapping-ui-targets-changed');
      return state.chartEntityIdsOverride ? state.chartEntityIdsOverride.slice() : [];
    },
    __testing: {
      getInvalidOptionReason: getInvalidOptionReason,
      buildChartComponentUpdate: buildChartComponentUpdate,
      buildRuntimeChartData: buildRuntimeChartData,
      applyChartTypeToEntity: applyChartTypeToEntity,
      applyChartTypeToEntities: applyChartTypeToEntities,
      isHierarchicalChart: isHierarchicalChart,
      clearChartGeneratedChildren: clearChartGeneratedChildren,
      applyChartDefaultTransform: applyChartDefaultTransform,
      getMappingProfileKey: getMappingProfileKey,
      // The "a chart's mapping always covers its dimensions" invariant is what
      // keeps Babia from building a chart with a missing axis, so it is tested
      // directly rather than through a full chart switch.
      getDefaultMappingForChart: getDefaultMappingForChart,
      getDimensionsForChart: getDimensionsForChart,
      sweepOrphanChartChildren: sweepOrphanChartChildren,
      computeChartDataSlice: computeChartDataSlice,
      resolveChartDataSourceId: resolveChartDataSourceId,
      getSliceEntityId: getSliceEntityId,
      syncActiveChartDataSlice: syncActiveChartDataSlice,
      PANEL_LAYOUT: PANEL_LAYOUT,
      getGridButtonWidth: getGridButtonWidth,
      getGridButtonX: getGridButtonX
    }
  };

  // Bootstrap keeps re-trying until the tooling config is present: a config
  // script injected after DOMContentLoaded must delay the controller, never
  // permanently disable it (autoInit is a no-op until getConfig() resolves).
  function bootstrapWhenConfigReady(attempt) {
    runtime.autoInit();
    if (state.initialized || attempt >= 120) {
      return;
    }
    root.setTimeout?.(function () {
      bootstrapWhenConfigReady(attempt + 1);
    }, 250);
  }

  if (root.document) {
    if (root.document.readyState === 'loading') {
      root.document.addEventListener('DOMContentLoaded', function () {
        bootstrapWhenConfigReady(0);
      }, { once: true });
    } else {
      bootstrapWhenConfigReady(0);
    }
  }

  root.CodeXRMappingUiRuntime = runtime;
  root.CodeXRAnalysisControllerRuntime = runtime;
  return runtime;
});
