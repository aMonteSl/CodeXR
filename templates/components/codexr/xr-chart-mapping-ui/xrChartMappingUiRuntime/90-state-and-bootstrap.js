// == xrChartMappingUiRuntime.js | part 90: state-and-bootstrap (assembled with its siblings; see COMPONENTS.md) ==
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
    saveActiveMappingProfile();
    state.activeMappingContextId = nextContextId;
    var profileKey = getMappingProfileKey(nextContextId, getActiveChartId(config));
    var profile = state.mappingProfiles[profileKey] || buildDefaultMappingSnapshot(config);
    applyMappingRuntimeState(config, profile, (options && options.reason) || ('mapping-ui-context-' + nextContextId));
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

  function autoInit() {
    var config = getConfig();
    if (!config || state.initialized) {
      return;
    }

    state.initialized = true;

    hydrateStateFromConfig(config);
    buildUi(config);
    registerSharedMappingEntity(config);
  }

  var runtime = {
    autoInit: autoInit,
    getState: getState,
    restoreState: restoreState,
    selectChart: selectChart,
    switchMappingContext: switchMappingContext,
    showView: showControllerView,
    getModeMemory: getModeMemory,
    saveModeMemory: saveModeMemory,
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
    registerPanelView: registerPanelView,
    showPanelView: showPanelView,
    setPanelViewTitle: setPanelViewTitle,
    setPanelViewHeight: setPanelViewHeight,
    getActivePanelView: function () {
      return state.activePanelView;
    },
    isPanelReady: function () {
      return !!(refs.panel && refs.panelContent);
    },
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
      PANEL_LAYOUT: PANEL_LAYOUT,
      getGridButtonWidth: getGridButtonWidth,
      getGridButtonX: getGridButtonX
    }
  };

  if (root.document) {
    if (root.document.readyState === 'loading') {
      root.document.addEventListener('DOMContentLoaded', function () {
        runtime.autoInit();
      }, { once: true });
    } else {
      runtime.autoInit();
    }
  }

  root.CodeXRMappingUiRuntime = runtime;
  root.CodeXRAnalysisControllerRuntime = runtime;
  return runtime;
});
