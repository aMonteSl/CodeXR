// == historicalComparisonRuntime.js | liveRefreshAndRegistration (assembled per manifest.json; see COMPONENTS.md) ==
  function nextFrame() {
    return new Promise(function (resolve) {
      (root.requestAnimationFrame || function (callback) { return setTimeout(callback, 16); })(resolve);
    });
  }

  function canRefreshLiveSide(result, previousResult) {
    if (!previousResult || !refs.comparisonRoot) {
      return false;
    }
    var sameSources = previousResult.left.source.id === result.left.source.id
      && previousResult.right.source.id === result.right.source.id;
    var liveSide = result.left.source.kind === 'workingCopy' ? 'left'
      : result.right.source.kind === 'workingCopy' ? 'right'
        : '';
    return sameSources
      && !!liveSide
      && previousResult[liveSide].itemCount > 0
      && result[liveSide].itemCount > 0;
  }

  async function refreshLiveSide(result, datasets) {
    var liveSide = result.left.source.kind === 'workingCopy' ? 'left' : 'right';
    var dataset = result[liveSide];
    state.payloads[liveSide] = normalizePayload(datasets[liveSide === 'left' ? 0 : 1]);
    var chart = getDocument().getElementById(
      liveSide === 'left' ? 'codexrComparisonChartLeft' : 'codexrComparisonChartRight'
    );
    var componentName = getChartComponentName(chart);
    if (isHierarchicalBoatsComponent(componentName)) {
      var config = getConfig();
      var pathField = comparisonTreeField(config?.targetType);
      var chartData = Object.assign({}, chart.getAttribute(componentName) || {});
      delete chartData.from;
      chartData.data = JSON.stringify(buildComparisonBoatsTree(
        state.payloads[liveSide],
        pathField,
        liveSide === 'left' ? 'codexr-left' : 'codexr-right'
      ));
      chartData.field = 'uid';
      chart.setAttribute(componentName, chartData);
    } else {
      var dataEntity = getDocument().getElementById(
        liveSide === 'left' ? 'codexrComparisonDataLeft' : 'codexrComparisonDataRight'
      );
      if (!dataEntity) {
        throw new Error('The live comparison data source is unavailable.');
      }
      dataEntity.setAttribute('babia-queryjson', 'url: ' + dataset.url + '?revision=' + result.revision);
    }
    setText(liveSide === 'left' ? refs.leftLabel : refs.rightLabel, buildSideNameplateText(dataset.source), 2.6, liveSide === 'left' ? '#67e8f9' : '#6ee7b7');
    updateMappingCompanion();
    state.result = result;
    refs.renderedRevision = result.revision;
    await nextFrame();
    // Targeted renormalization: only the refreshed live chart. Renormalizing
    // every chart reset the untouched immutable side to its 'rebuilding'
    // containment state, waiting for a Babia build event that never comes —
    // the chart vanished behind "The chart is still rebuilding its geometry".
    root.CodeXRAnalysisTableRuntime?.renormalizeCharts?.(
      [liveSide === 'left' ? 'codexrComparisonChartLeft' : 'codexrComparisonChartRight'],
      'historical-comparison-live-refresh'
    );
  }

  function normalizePayload(payload) {
    return Array.isArray(payload) ? payload : [];
  }

  function sumMetric(payload, metric) {
    return normalizePayload(payload).reduce(function (sum, entry) {
      var value = Number(entry && entry[metric]);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
  }

  function getMappedMetricDeltas(mapping, payloads) {
    var fields = Object.keys(mapping || {}).map(function (key) {
      return String(mapping[key] || '');
    }).filter(Boolean);
    return Array.from(new Set(fields)).map(function (metric) {
      var left = sumMetric(payloads?.left, metric);
      var right = sumMetric(payloads?.right, metric);
      return { metric: metric, left: left, right: right, delta: right - left };
    }).filter(function (metric) {
      return metric.left !== 0 || metric.right !== 0;
    });
  }

  function handleMappingConfirmed(event) {
    // The comparison table always mirrors what the user maps to the chart axes:
    // a changed axis metric re-computes its left/right/delta here.
    state.selectedMapping = Object.assign({}, event?.detail?.selectedByDimension || {});
    updateMappingCompanion();
  }

  // Hands the scene back to the normal charts (raycast + mapping targets)
  // without touching the comparison geometry.
  function releaseSceneToNormal() {
    var config = getConfig();
    var original = restoreOriginalChart() || getTemplateChart(config);
    restoreRaycastInteraction(original);
    restoreOriginalChartMapping(config);
  }

  function disposeComparisonGeometry(clearResult) {
    // Babia leaves a removed chart component subscribed to its data producer,
    // so a discarded comparison chart repaints itself on the next push. Release
    // both before dropping the root.
    (Array.isArray(refs.comparisonChartIds) ? refs.comparisonChartIds : []).forEach(function (chartId) {
      var chart = getDocument()?.getElementById?.(chartId);
      if (chart) {
        root.CodeXRMappingUiRuntime?.releaseChartEntity?.(chart);
      }
    });
    if (refs.comparisonRoot?.parentNode) {
      refs.comparisonRoot.parentNode.removeChild(refs.comparisonRoot);
    }
    refs.comparisonRoot = null;
    refs.comparisonChartIds = null;
    refs.renderedRevision = null;
    releaseSceneToNormal();
    if (clearResult !== false) {
      state.result = null;
      state.payloads = { left: [], right: [] };
    }
  }

  // Leaving the mode with a live comparison: SAVE it. The root stays mounted
  // (the surface preserve pass hides it with its own interaction bookkeeping)
  // and only the scene is handed back to normal; restoreComparisonScene brings
  // everything back as left, with no rebuild (and no visible teardown).
  function parkComparisonGeometry() {
    root.CodeXRAnalysisSurfaceRuntime?.preserveModeRoots?.('historical-compare');
    releaseSceneToNormal();
  }

  function releaseComparisonOnLeave() {
    state.loadGeneration += 1;
    if (state.result && refs.comparisonRoot?.isConnected) {
      parkComparisonGeometry();
      return;
    }
    disposeComparisonGeometry(false);
  }

  function registerCollaboration() {
    var client = getClient();
    if (!client) {
      return;
    }
    state.disposables.push(client.onMessage?.('historical-comparison-references', handleReferences));
    state.disposables.push(client.onMessage?.('historical-comparison-progress', handleProgress));
    state.disposables.push(client.onMessage?.('historical-comparison-error', handleError));
    client.registerEntityRuntime?.({
      entityKind: ENTITY_KIND,
      entityId: ENTITY_ID,
      applySharedState: applySharedState,
      publishInitialSharedState: function () {}
    });
  }

  function mountPanelView() {
    if (buildPanel()) {
      return;
    }
    // Event-driven: the controller calls back once its panel exists (a capped
    // retry here used to silently drop the view on slow scenes).
    root.CodeXRMappingUiRuntime?.whenPanelReady?.(function () {
      buildPanel();
    });
  }

  function autoInit() {
    if (state.initialized || !getDocument()) {
      return;
    }
    state.initialized = true;
    state.unregisterLifecycle = root.CodeXRAnalysisModeRuntime?.register?.('historical-compare', {
      activate: function () {
        if (state.result) {
          // Comparison geometry still mounted (preserved on leave, or a
          // duplicate activation): restore it in place — no renderComparison,
          // no re-park/stabilization wait, the scene comes back as left.
          if (refs.comparisonRoot?.isConnected) {
            restoreComparisonScene();
            if (state.result.revision !== refs.renderedRevision) {
              // The live side moved while the mode was parked (the entity
              // update only stored state.result): re-sync the charts now.
              return applySharedState({
                entityKind: ENTITY_KIND,
                entityId: ENTITY_ID,
                mode: 'historical-compare',
                result: state.result
              });
            }
            closePanel();
            return true;
          }
          if (state.payloads.left.length || state.payloads.right.length) {
            return renderComparison(
              state.result,
              state.payloads.left,
              state.payloads.right
            ).then(function () {
              closePanel();
            });
          }
          return applySharedState({
            entityKind: ENTITY_KIND,
            entityId: ENTITY_ID,
            mode: 'historical-compare',
            result: state.result
          });
        }
        showHistoricalSelectionPanel();
        return true;
      },
      // Leaving historical SAVES a live comparison (root preserved-and-hidden,
      // result + payloads kept) so returning restores it as left; with none,
      // the geometry is disposed and re-entry shows the source selector.
      // Determinism comes from resolveControllerView below: every route
      // (local + authoritative echo) agrees on historical.mapping when a
      // comparison exists, historical.selection otherwise.
      deactivate: function () {
        releaseComparisonOnLeave();
      },
      disposeView: function () {
        releaseComparisonOnLeave();
      },
      // Authoritative default view for this mode: with a live comparison the
      // controller restores it (mapping); otherwise it shows the source
      // selector. getDefaultControllerViewForMode consults this so the local
      // transition and the server echo can never disagree on the view.
      resolveControllerView: function () {
        return state.result ? 'historical.mapping' : 'historical.selection';
      }
    }) || null;
    registerHistoricalModeOption();
    mountPanelView();
    state.selectedMapping = Object.assign(
      {},
      root.CodeXRMappingUiRuntime?.getState?.().lastKnownGoodMapping || {}
    );
    getDocument().addEventListener('codexr-mapping-confirmed', handleMappingConfirmed);
    state.disposables.push(function () {
      getDocument()?.removeEventListener('codexr-mapping-confirmed', handleMappingConfirmed);
    });
    void configureAvailability();
    registerCollaboration();
  }

  var runtime = {
    autoInit: autoInit,
    open: openPanel,
    close: closePanel,
    activate: enterHistoricalSelection,
    deactivate: function () {
      return root.CodeXRAnalysisModeRuntime?.deactivate?.('historical-compare');
    },
    disposeView: function () {
      releaseComparisonOnLeave();
    },
    applySharedState: applySharedState,
    getState: function () {
      return {
        panelVisible: state.panelVisible,
        selected: Object.assign({}, state.selected),
        result: state.result,
        status: state.status
      };
    },
    destroy: function () {
      state.disposables.forEach(function (dispose) { dispose?.(); });
      state.disposables = [];
      disposeComparisonGeometry();
      state.unregisterModeOption?.();
      state.unregisterModeOption = null;
      state.unregisterLifecycle?.();
      state.unregisterLifecycle = null;
      state.unregisterPanelView?.();
      state.unregisterPanelView = null;
      state.unregisterMappingCompanion?.();
      state.unregisterMappingCompanion = null;
      refs.panel = null;
      refs.companionRoot = null;
      state.initialized = false;
    },
    __testing: {
      buildComparisonBoatsTree: buildComparisonBoatsTree,
      selectHistoricalMode: selectHistoricalMode
    }
  };

  if (getDocument()) {
    if (getDocument().readyState === 'loading') {
      getDocument().addEventListener('DOMContentLoaded', autoInit, { once: true });
    } else {
      autoInit();
    }
  }
  root.CodeXRHistoricalComparisonRuntime = runtime;
})(typeof window !== 'undefined' ? window : this);
