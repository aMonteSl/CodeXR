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
      var pathField = config?.targetType === 'directory' ? 'filePath' : 'treePath';
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
    setText(liveSide === 'left' ? refs.leftLabel : refs.rightLabel, buildSourceLabel(dataset.source), 4.2, liveSide === 'left' ? '#67e8f9' : '#6ee7b7');
    setText(refs.deltaLabel, buildDeltaText(result.delta, state.selectedMapping, state.payloads), 4.2, '#ffffff');
    state.result = result;
    await nextFrame();
    root.CodeXRAnalysisTableRuntime?.renormalizeAll?.('historical-comparison-live-refresh');
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

  function buildDeltaText(delta, mapping, payloads) {
    var text = 'Added ' + Number(delta?.added || 0)
      + ' | Removed ' + Number(delta?.removed || 0)
      + ' | Modified ' + Number(delta?.modified || 0)
      + ' | Unchanged ' + Number(delta?.unchanged || 0);
    var mappedMetrics = getMappedMetricDeltas(mapping, payloads);
    var metrics = (mappedMetrics.length ? mappedMetrics : (Array.isArray(delta?.metrics) ? delta.metrics : [])).slice(0, 3);
    if (metrics.length) {
      text += '\n' + metrics.map(function (metric) {
        var sign = Number(metric.delta) > 0 ? '+' : '';
        return truncate(metric.metric, 14) + ' ' + sign + Number(metric.delta || 0).toFixed(1);
      }).join(' | ');
    }
    return text;
  }

  function handleMappingConfirmed(event) {
    state.selectedMapping = Object.assign({}, event?.detail?.selectedByDimension || {});
    if (state.result && refs.deltaLabel) {
      setText(
        refs.deltaLabel,
        buildDeltaText(state.result.delta, state.selectedMapping, state.payloads),
        4.2,
        '#ffffff'
      );
    }
  }

  function disposeComparisonGeometry(clearResult) {
    if (refs.comparisonRoot?.parentNode) {
      refs.comparisonRoot.parentNode.removeChild(refs.comparisonRoot);
    }
    refs.comparisonRoot = null;
    var config = getConfig();
    var original = restoreOriginalChart() || getTemplateChart(config);
    restoreRaycastInteraction(original);
    restoreOriginalChartMapping(config);
    if (clearResult !== false) {
      state.result = null;
      state.payloads = { left: [], right: [] };
    }
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

  function mountPanelView(attempt) {
    if (buildPanel()) {
      return;
    }
    if (Number(attempt || 0) >= 20) {
      console.warn('[CodeXR][HistoricalComparison] Mapping panel was not available.');
      return;
    }
    setTimeout(function () {
      mountPanelView(Number(attempt || 0) + 1);
    }, 100);
  }

  function autoInit() {
    if (state.initialized || !getDocument()) {
      return;
    }
    state.initialized = true;
    state.unregisterLifecycle = root.CodeXRAnalysisModeRuntime?.register?.('historical-compare', {
      activate: function () {
        if (state.result) {
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
      deactivate: function () {
        state.loadGeneration += 1;
        disposeComparisonGeometry(false);
      },
      disposeView: function () {
        state.loadGeneration += 1;
        disposeComparisonGeometry(false);
      }
    }) || null;
    registerHistoricalModeOption();
    mountPanelView(0);
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
      state.loadGeneration += 1;
      disposeComparisonGeometry(false);
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
      refs.panel = null;
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
