// == analysisModeRuntime.js | part 60: snapshots-and-lifecycles (assembled with its siblings; see COMPONENTS.md) ==
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
        root.CodeXRMappingUiRuntime?.switchMappingContext?.('normal-analysis', {
          reason: 'normal-analysis-activate'
        });
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
            controllerView: snapshot.controllerView || getDefaultControllerViewForMode(visibleMode),
            panelViewId: visibleMode === 'selection'
              ? state.selectionPanelView
              : getPanelViewForControllerView(snapshot.controllerView || getDefaultControllerViewForMode(visibleMode))
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
        controllerView: state.controllerView,
        activeLifecycleMode: state.activeLifecycleMode,
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
        state.controllerView = 'single.mapping';
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
