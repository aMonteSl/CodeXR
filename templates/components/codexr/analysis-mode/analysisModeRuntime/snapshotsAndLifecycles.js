// == analysisModeRuntime.js | snapshotsAndLifecycles (assembled per manifest.json; see COMPONENTS.md) ==
  function getSnapshotModeRevision(snapshot, mode) {
    return Number(snapshot?.modeRevision?.[mode] || 0);
  }

  function getProducerId(componentData) {
    if (componentData && typeof componentData === 'object') {
      return componentData.from ? String(componentData.from) : '';
    }
    var match = String(componentData || '').match(/(?:^|;)\s*from\s*:\s*([^;]+)/);
    return match ? match[1].trim() : '';
  }

  function getNormalDataEntities(config) {
    var document = root.document;
    if (!document) { return []; }
    var queue = [];
    var visited = new Set();
    var dataEntities = [];
    collectConfiguredIds(config, [
      'normalDataEntityIds',
      'dataEntityIds',
      'dataEntityId'
    ]).forEach(function (id) {
      var element = document.getElementById?.(id);
      if (element) { queue.push(element); }
    });
    getNormalVisualizationRoots().forEach(function (element) {
      queue.push(element);
      element.querySelectorAll?.('[babia-queryjson], [babia-treebuilder], [data-codexr-normal-visualization="true"]')
        ?.forEach(function (child) { queue.push(child); });
    });
    getNormalMappingTargetIds(config).forEach(function (id) {
      var element = document.getElementById?.(id);
      if (element) { queue.push(element); }
    });
    while (queue.length) {
      var element = queue.shift();
      if (!element || visited.has(element)) { continue; }
      visited.add(element);
      var queryData = element.getAttribute?.('babia-queryjson');
      if (queryData) {
        dataEntities.push(element);
      }
      var attributeNames = element.getAttributeNames?.() || [];
      var componentNames = Object.keys(element.components || {});
      Array.from(new Set(attributeNames.concat(componentNames)))
        .filter(function (name) {
          return name === 'babia-treebuilder'
            || (name.indexOf('babia-') === 0 && name !== 'babia-queryjson');
        })
        .forEach(function (name) {
          var producerId = getProducerId(
            element.getAttribute?.(name) || element.components?.[name]?.data
          );
          var producer = producerId ? document.getElementById?.(producerId) : null;
          if (producer) { queue.push(producer); }
        });
    }
    // Old generated scenes predate normalDataEntityIds but use this canonical
    // producer id. Keep the fallback scoped to that one entity, never to every
    // babia-queryjson in the document (which includes parked Evolution data).
    if (!dataEntities.length) {
      var canonical = document.getElementById?.('data');
      if (canonical?.getAttribute?.('babia-queryjson')) {
        dataEntities.push(canonical);
      }
    }
    return Array.from(new Set(dataEntities));
  }

  async function refreshNormalDataSources(modeRevision) {
    var doc = root.document;
    if (!doc || modeRevision <= state.lastNormalModeRevision) {
      return false;
    }
    var mappingRuntime = root.CodeXRMappingUiRuntime;
    var mappingState = mappingRuntime?.getState?.() || null;
    var dataEntities = getNormalDataEntities(getConfig());
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
      var declarativeUrl = 'url: ' + nextUrl;
      if (mappingRuntime && typeof mappingRuntime.setDeclarativeAttribute === 'function') {
        mappingRuntime.setDeclarativeAttribute(dataEntity, 'babia-queryjson', declarativeUrl);
      } else {
        dataEntity.setAttribute('babia-queryjson', declarativeUrl);
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
    var completedPendingRefresh = false;
    if (pending && !refreshedFromRevision) {
      var completion = await getNormalRefreshRuntime().waitForCompletionAfter(pending.baseline, 5000);
      completedPendingRefresh = !!completion?.completed;
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
    return refreshedFromRevision || completedPendingRefresh;
  }

  function registerBuiltInLifecycles() {
    register('selection', {
      mappingContextId: null,
      activate: async function (activation) {
        await clearVisualizationsForSelection(activation);
      }
    });
    register('single', {
      mappingContextId: 'normal-analysis',
      captureState: function () {
        var config = getConfig();
        var mappingState = root.CodeXRMappingUiRuntime?.getState?.();
        var chartIds = getNormalMappingTargetIds(config);
        return {
          chartId: mappingState?.chartId || root.CodeXRMappingUiRuntime?.getSceneChartId?.() || null,
          chartIds: chartIds,
          mappingState: mappingState || null,
          chartTransforms: captureChartTransforms(chartIds)
        };
      },
      restoreState: function (activation) {
        var saved = activation?.savedState;
        if (!saved) { return; }
        var mappingRuntime = root.CodeXRMappingUiRuntime;
        if (saved.chartId && mappingRuntime?.getState?.()?.chartId !== saved.chartId) {
          mappingRuntime.selectChart?.(saved.chartId, { applyToEntities: false });
        }
        mappingRuntime?.switchMappingContext?.('normal-analysis', {
          reason: 'normal-analysis-state-restore',
          applyToEntities: false
        });
        if (saved.mappingState) {
          mappingRuntime?.restoreState?.(saved.mappingState, { applyToEntities: false });
        }
        restoreChartTransforms(saved.chartTransforms);
      },
      // The authoritative analysis-view snapshot is this mode's data-refresh
      // path (waitForNormalChartReady reads its modeRevision), so a snapshot
      // echo must re-activate it. Modes with their own shared entity don't
      // declare this and are left alone by echoes.
      consumesSnapshot: true,
      activate: function (activation) {
        var config = getConfig();
        ensureAnalysisSurfaceRuntime().activateMode('single');
        var chartIds = activation?.savedState?.chartIds || getNormalMappingTargetIds(config);
        if (chartIds.length) {
          root.CodeXRMappingUiRuntime?.setChartEntityIds?.(chartIds, { renormalize: false });
        }
        restoreChartTransforms(activation?.savedState?.chartTransforms);
        void waitForNormalChartReady(config, activation).then(function (dataChanged) {
          if (state.mode !== 'single' && state.activeLifecycleMode !== 'single') {
            return;
          }
          setNormalVisualizationVisible(true);
          restoreChartTransforms(activation?.savedState?.chartTransforms);
          if (dataChanged && chartIds.length) {
            root.CodeXRAnalysisTableRuntime?.renormalizeCharts?.(
              chartIds,
              'normal-analysis-data-refreshed'
            );
          }
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
          var viewRevision = Number(snapshot?.viewRevision || 0);
          if (
            viewRevision > 0
            && viewRevision < state.lastAuthoritativeViewRevision
          ) {
            debugLog('Ignored stale authoritative analysis view', {
              mode: snapshot.mode,
              viewRevision: viewRevision,
              lastApplied: state.lastAuthoritativeViewRevision
            });
            return;
          }
          if (viewRevision > 0) {
            state.lastAuthoritativeViewRevision = Math.max(
              state.lastAuthoritativeViewRevision,
              viewRevision
            );
          }
          if (snapshot.mode === 'single' && snapshot.status !== 'ready') {
            state.pendingNormalRefresh = {
              baseline: getNormalRefreshRuntime().getState().completedGeneration,
              sourceRevision: Number(snapshot.sourceRevision || 0)
            };
          }
          state.requestedMode = snapshot.mode === 'selection' ? state.requestedMode : snapshot.mode;
          var visibleMode = snapshot.mode;
          // Echo dedupe: a transition toward this exact mode is already in
          // flight (the runtime that sent analysis-mode-activate also called
          // changeAnalysis directly). Queueing the echo behind it would repeat
          // the whole deactivate/activate cycle — the double park/rebuild
          // behind the entry flicker.
          if (state.transitioning && state.pendingTransitionMode === visibleMode) {
            return;
          }
          // View routing: the mode's own lifecycle resolver wins over the
          // snapshot's controllerView. The server-side view can be stale (its
          // historical-comparison entity persists after the client clears the
          // comparison locally), and trusting it stranded the panel on the
          // generic mapping with nothing rendered. The client's live state is
          // the routing authority; the snapshot view is only a fallback.
          var echoView = lifecycles[visibleMode]?.resolveControllerView?.()
            || snapshot.controllerView
            || getDefaultControllerViewForMode(visibleMode);
          void changeAnalysis(visibleMode, {
            reason: 'authoritative-analysis-view',
            snapshot: snapshot,
            controllerView: echoView,
            panelViewId: visibleMode === 'selection'
              ? state.selectionPanelView
              : getPanelViewForControllerView(echoView)
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
    changeAnalysis: changeAnalysis,
    deactivate: deactivate,
    getState: function () {
      return {
        mode: state.mode,
        requestedMode: state.requestedMode,
        controllerView: state.controllerView,
        activeLifecycleMode: state.activeLifecycleMode,
        transitioning: state.transitioning,
        pendingTransitionMode: state.pendingTransitionMode,
        lastAuthoritativeViewRevision: state.lastAuthoritativeViewRevision,
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
        state.pendingTransitionMode = null;
        state.generation = 0;
        state.transition = Promise.resolve();
        state.modeSnapshots = {};
        state.lastAuthoritativeViewRevision = 0;
        state.collaborationRegistered = false;
        state.pendingNormalRefresh = null;
        state.lastNormalModeRevision = 0;
        state.modeOptions = [];
        state.selectionPanelView = 'visualization-mode';
      }
    }
  };
  if (root.document) {
    // Each boot step is isolated: a failure in one (e.g. a config that is not
    // in the DOM yet) must never prevent the later steps from running — that
    // is how the analysis selector silently disappeared from the controller.
    [getNormalRefreshRuntime, ensureAnalysisSurfaceRuntime, registerBuiltInLifecycles,
      function () { mountModePanel(0); },
      function () { registerCollaboration(0); }].forEach(function (step) {
      try {
        step();
      } catch (error) {
        root.console?.warn?.('[CodeXR][AnalysisMode] boot step failed:', error);
      }
    });
  }
})(typeof window !== 'undefined' ? window : this);
