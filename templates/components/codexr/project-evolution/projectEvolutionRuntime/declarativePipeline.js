// == projectEvolutionRuntime.js | declarativePipeline (assembled per manifest.json) ==
  var EVOLUTION_TREE_COMPONENT = 'babia-treebuilder';
  var EVOLUTION_DATA_ID = 'codexrProjectEvolutionData';
  var EVOLUTION_TREE_ID = 'codexrProjectEvolutionTree';
  var EVOLUTION_CHART_ID = 'codexrProjectEvolutionChart';

  function ensureEvolutionRoot(frame) {
    if (refs.evolutionRoot?.isConnected !== false && refs.evolutionRoot) {
      root.CodeXRAnalysisSurfaceRuntime?.mountRoot?.(MODE, refs.evolutionRoot);
    } else {
      refs.evolutionRoot = entity('a-entity', {
        id: 'codexrProjectEvolutionRoot',
        'data-codexr-analysis-root': 'true',
        'data-codexr-analysis-mode': MODE,
        'data-codexr-preserve': 'true'
      });
      if (root.CodeXRAnalysisSurfaceRuntime?.mountRoot) {
        root.CodeXRAnalysisSurfaceRuntime.mountRoot(MODE, refs.evolutionRoot);
      } else {
        doc().querySelector?.('a-scene')?.appendChild?.(refs.evolutionRoot);
      }
    }
    if (frame) {
      refs.evolutionRoot.setAttribute(
        'data-codexr-frame-index',
        String((Number(frame.index) || 0) + 1)
      );
    }
    return refs.evolutionRoot;
  }

  function projectEvolutionContainmentProfile() {
    return root.CodeXRAnalysisTableRuntime?.getContainmentProfile?.(MODE) || {
      id: MODE,
      position: { x: 0, y: 1, z: -18 },
      containment: {
        enabled: true,
        anchorX: 0,
        anchorY: 1,
        anchorZ: -18,
        targetWidth: 5.614,
        targetHeight: 1.8,
        targetDepth: 3.218,
        bootstrapPlanarMaxRatio: 0.84,
        minPlanarOccupancyRatio: 0.78,
        maxPlanarOccupancyRatio: 0.92,
        heightBandMinRatio: 0.38,
        heightBandMaxRatio: 0.72,
        tableTopPadding: 0.9,
        tableEdgeMargin: 0.18,
        yScaleMin: 0.01,
        yScaleMax: 12,
        containmentToleranceRatio: 0.018,
        periodicContainmentEnabled: true,
        stabilizationCheckMs: 140,
        stabilizationMaxChecks: 14,
        stabilizationStablePasses: 3,
        transformTransitionMs: 650,
        hardHeightGuardEnabled: true
      }
    };
  }

  function evolutionTreeField(targetType) {
    var treeFields = root.CodeXRMappingUiRuntime?.getChartBaseConfig?.()?.treeFields;
    return targetType === 'directory'
      ? (treeFields?.directory || 'filePath')
      : (treeFields?.file || 'treePath');
  }

  function evolutionChartTitle() {
    return String(config().analysisTitle || 'Project Evolution');
  }

  function serializeEvolutionComponentData(data) {
    var serializer = root.CodeXRMappingUiRuntime?.serializeDeclarativeComponentData;
    if (typeof serializer === 'function') {
      return serializer(data);
    }
    return Object.keys(data || {})
      .filter(function (key) {
        return data[key] !== undefined && data[key] !== null && data[key] !== '';
      })
      .map(function (key) {
        return key + ': ' + String(data[key]).replace(/;/g, ',');
      })
      .join(';\n');
  }

  function ensureEvolutionDataSource(frameUrl) {
    var scene = doc().querySelector?.('a-scene');
    if (!scene) {
      return { entity: null, created: false };
    }
    if (refs.evolutionDataSource) {
      if (refs.evolutionDataSource.parentNode !== scene) {
        scene.appendChild(refs.evolutionDataSource);
      }
      return { entity: refs.evolutionDataSource, created: false };
    }
    var url = String(frameUrl || bridgeUrl() || '');
    if (!url) {
      return { entity: null, created: false };
    }
    refs.evolutionDataSource = entity('a-entity', {
      id: EVOLUTION_DATA_ID,
      'data-codexr-role': 'project-evolution datasource',
      'data-codexr-project-evolution-support': 'true',
      'data-codexr-evolution-url': url
    });
    root.CodeXRMappingUiRuntime?.setDeclarativeAttribute?.(
      refs.evolutionDataSource,
      'babia-queryjson',
      serializeEvolutionComponentData({ url: url })
    );
    scene.appendChild(refs.evolutionDataSource);
    return { entity: refs.evolutionDataSource, created: true };
  }

  function ensureEvolutionTreeBuilder(rootEl) {
    if (refs.evolutionTreeBuilder) {
      if (refs.evolutionTreeBuilder.parentNode !== rootEl) {
        rootEl.insertBefore?.(refs.evolutionTreeBuilder, rootEl.firstChild || null);
      }
      return refs.evolutionTreeBuilder;
    }
    refs.evolutionTreeBuilder = root.CodeXRMappingUiRuntime?.buildDeclarativeTreeEntity?.({
      entityId: EVOLUTION_TREE_ID,
      sourceId: EVOLUTION_DATA_ID,
      field: evolutionTreeField(config().targetType),
      splitBy: '/'
    }) || null;
    if (!refs.evolutionTreeBuilder) {
      return null;
    }
    refs.evolutionTreeBuilder.setAttribute(
      'data-codexr-role',
      'project-evolution treebuilder'
    );
    rootEl.insertBefore?.(refs.evolutionTreeBuilder, rootEl.firstChild || null);
    return refs.evolutionTreeBuilder;
  }

  function namespaceEvolutionTreeNodes(nodes, namespace) {
    var safeNamespace = String(namespace || MODE).replace(/[^a-zA-Z0-9_-]/g, '-');
    return (Array.isArray(nodes) ? nodes : []).map(function (node) {
      var copy = Object.assign({}, node);
      var rawUid = String(node?.uid || node?.name || '');
      copy.uid = rawUid.indexOf(safeNamespace + ':') === 0
        ? rawUid
        : safeNamespace + ':' + rawUid;
      if (Array.isArray(node?.children)) {
        copy.children = namespaceEvolutionTreeNodes(node.children, safeNamespace);
      }
      return copy;
    });
  }

  function scopeEvolutionTreeOutput(treeBuilder) {
    var component = treeBuilder?.components?.[EVOLUTION_TREE_COMPONENT];
    var buffer = component?.notiBuffer;
    if (!buffer || typeof buffer.set !== 'function' || buffer.__codexrEvolutionNamespace) {
      return !!buffer;
    }
    var originalSet = buffer.set.bind(buffer);
    buffer.set = function (payload) {
      originalSet(namespaceEvolutionTreeNodes(payload, MODE));
    };
    buffer.__codexrEvolutionNamespace = MODE;
    if (buffer.data !== undefined) {
      buffer.data = namespaceEvolutionTreeNodes(buffer.data, MODE);
    }
    return true;
  }

  function evolutionChartSourceId(chartId) {
    return chartId === 'boats' ? EVOLUTION_TREE_ID : EVOLUTION_DATA_ID;
  }

  function declarativeEvolutionChartOptions(chartId, applyTransform) {
    return {
      entityId: EVOLUTION_CHART_ID,
      chartId: chartId,
      sourceId: evolutionChartSourceId(chartId),
      mapping: getActiveMappingForChart(chartId),
      title: evolutionChartTitle(),
      containmentProfile: projectEvolutionContainmentProfile(),
      role: 'project-evolution chart',
      applyTransform: applyTransform !== false,
      applyInitialScale: applyTransform !== false
    };
  }

  function buildEvolutionChart(chartId) {
    var chart = root.CodeXRMappingUiRuntime?.buildDeclarativeChartEntity?.(
      declarativeEvolutionChartOptions(chartId, true)
    ) || null;
    if (!chart) {
      return null;
    }
    chart.setAttribute('data-codexr-project-evolution-chart', 'true');
    chart.setAttribute('data-codexr-project-evolution-chart-id', chartId);
    return chart;
  }

  function releaseEvolutionChart() {
    var chartIds = refs.evolutionChart?.id ? [refs.evolutionChart.id] : [];
    root.CodeXRAnalysisTableRuntime?.cancelChartDataTransition?.(
      chartIds,
      'project-evolution-chart-released'
    );
    root.CodeXRMappingUiRuntime?.releaseChartEntity?.(refs.evolutionChart);
    refs.evolutionChart?.parentNode?.removeChild?.(refs.evolutionChart);
    refs.evolutionChart = null;
  }

  function ensureEvolutionChart(chartId, rootEl) {
    var chart = refs.evolutionChart;
    if (
      chart
      && chart.getAttribute?.('data-codexr-project-evolution-chart-id') === chartId
    ) {
      if (chart.parentNode !== rootEl) {
        rootEl.appendChild(chart);
      }
      chart.setAttribute('visible', true);
      return chart;
    }
    var nextChart = buildEvolutionChart(chartId);
    if (!nextChart) {
      return null;
    }
    releaseEvolutionChart();
    rootEl.appendChild(nextChart);
    refs.evolutionChart = nextChart;
    state.activeChartId = chartId;
    return refs.evolutionChart;
  }

  function configureEvolutionChart(chart, chartId) {
    if (!chart) {
      return false;
    }
    return !!root.CodeXRMappingUiRuntime?.configureDeclarativeChartEntity?.(
      chart,
      declarativeEvolutionChartOptions(chartId, false)
    );
  }

  function waitForComponent(element, componentName, timeoutMs) {
    if (!element || !componentName) {
      return Promise.resolve(false);
    }
    if (element.components && element.components[componentName]) {
      return Promise.resolve(true);
    }
    return new Promise(function (resolve) {
      var settled = false;
      var timeout = root.setTimeout(function () {
        if (settled) { return; }
        settled = true;
        element.removeEventListener?.('componentinitialized', onInitialized);
        resolve(!!(element.components && element.components[componentName]));
      }, timeoutMs || 1200);
      function onInitialized(event) {
        if (event.detail.name !== componentName || settled) {
          return;
        }
        settled = true;
        root.clearTimeout?.(timeout);
        element.removeEventListener?.('componentinitialized', onInitialized);
        resolve(true);
      }
      element.addEventListener?.('componentinitialized', onInitialized);
    });
  }

  function nextRenderFrame() {
    return new Promise(function (resolve) {
      (root.requestAnimationFrame || function (callback) {
        return root.setTimeout(callback, 16);
      })(function () { resolve(true); });
    });
  }

  async function ensureDeclarativeEvolutionPipeline(frame, frameUrl, viewGeneration) {
    if (!isEvolutionViewCurrent(viewGeneration)) {
      return null;
    }
    var chartId = getActiveChartId();
    var componentName = COMPONENT_BY_CHART[chartId];
    if (!componentName) {
      return null;
    }
    var rootEl = ensureEvolutionRoot(frame);
    var dataResult = ensureEvolutionDataSource(frameUrl);
    var dataSource = dataResult.entity;
    if (!dataSource || !await waitForComponent(dataSource, 'babia-queryjson', 1200)) {
      setStatus('Project evolution datasource is not available.', 'error');
      return null;
    }
    if (!isEvolutionViewCurrent(viewGeneration)) {
      return null;
    }
    var treeBuilder = ensureEvolutionTreeBuilder(rootEl);
    if (!treeBuilder || !await waitForComponent(treeBuilder, EVOLUTION_TREE_COMPONENT, 1200)) {
      setStatus('Project evolution tree is not available.', 'error');
      return null;
    }
    scopeEvolutionTreeOutput(treeBuilder);
    if (!isEvolutionViewCurrent(viewGeneration)) {
      return null;
    }
    var chart = ensureEvolutionChart(chartId, rootEl);
    if (!chart || !await waitForComponent(chart, componentName, 1200)) {
      setStatus('Project evolution chart is not available.', 'error');
      return null;
    }
    await waitForComponent(chart, 'codexr-chart-containment', 1200);
    if (!isEvolutionViewCurrent(viewGeneration)) {
      return null;
    }
    root.CodeXRMappingUiRuntime?.setChartEntityIds?.([chart.id], {
      renormalize: false
    });
    return {
      chartId: chartId,
      componentName: componentName,
      chart: chart,
      dataSource: dataSource,
      dataSourceCreated: dataResult.created,
      treeBuilder: treeBuilder
    };
  }

  function getEvolutionDataBuffer() {
    return refs.evolutionDataSource?.components?.['babia-queryjson']?.notiBuffer || null;
  }

  function refreshEvolutionDataSource(frameUrl) {
    var viewGeneration = state.viewGeneration;
    if (
      !refs.evolutionDataSource
      || !frameUrl
      || !isEvolutionViewCurrent(viewGeneration)
    ) {
      return 0;
    }
    var generation = ++state.dataRefreshGeneration;
    refs.evolutionDataSource.setAttribute('data-codexr-evolution-url', frameUrl);
    root.CodeXRMappingUiRuntime?.setDeclarativeAttribute?.(
      refs.evolutionDataSource,
      'babia-queryjson',
      serializeEvolutionComponentData({ url: frameUrl })
    );
    return generation;
  }

  function beginInitialEvolutionDataLoad(frameUrl) {
    state.dataRefreshGeneration += 1;
    refs.evolutionDataSource?.setAttribute?.('data-codexr-evolution-url', frameUrl);
    return state.dataRefreshGeneration;
  }

  function waitForEvolutionDataRefresh(
    generation,
    previousData,
    viewGeneration,
    timeoutMs,
    acceptCurrentData
  ) {
    var startedAt = Date.now();
    return new Promise(function (resolve) {
      function inspect() {
        if (
          generation !== state.dataRefreshGeneration
          || !isEvolutionViewCurrent(viewGeneration)
        ) {
          resolve(false);
          return;
        }
        var buffer = getEvolutionDataBuffer();
        if (
          buffer
          && buffer.data !== undefined
          && (acceptCurrentData || buffer.data !== previousData)
        ) {
          resolve(true);
          return;
        }
        if (Date.now() - startedAt >= (timeoutMs || 8000)) {
          resolve(false);
          return;
        }
        root.setTimeout(inspect, 30);
      }
      inspect();
    });
  }

  function captureEvolutionChartTransition(chart, componentName) {
    var component = chart?.components?.[componentName] || null;
    return {
      component: component,
      figures: component?.figures,
      figuresOld: component?.figures_old,
      childCount: Number(chart?.children?.length) || 0
    };
  }

  function waitForEvolutionChartAnimation(
    chart,
    componentName,
    generation,
    viewGeneration,
    previousTransition
  ) {
    var startedAt = Date.now();
    var sawAnimation = false;
    return new Promise(function (resolve) {
      function inspect() {
        if (
          generation !== state.dataRefreshGeneration
          || !isEvolutionViewCurrent(viewGeneration)
          || chart !== refs.evolutionChart
        ) {
          resolve(false);
          return;
        }
        var component = chart?.components?.[componentName];
        if (!component) {
          if (Date.now() - startedAt > 1800) {
            resolve(false);
          } else {
            root.setTimeout(inspect, 30);
          }
          return;
        }
        var duration = Math.max(
          0,
          Number(component.duration) || Number(component.data?.dur) || 0
        );
        var observesFigures = componentName === 'babia-boats';
        var producerUpdateObserved = !previousTransition || (
          observesFigures
            ? (
              component !== previousTransition.component
              || component.figures !== previousTransition.figures
              || component.figures_old !== previousTransition.figuresOld
            )
            : (
              component !== previousTransition.component
              || (Number(chart?.children?.length) || 0) !== previousTransition.childCount
              || Date.now() - startedAt >= 60
            )
        );
        if (!producerUpdateObserved) {
          if (Date.now() - startedAt > Math.max(1800, duration + 600)) {
            resolve(false);
          } else {
            root.setTimeout(inspect, 30);
          }
          return;
        }
        if (component.animation === true) {
          sawAnimation = true;
          if (Date.now() - startedAt > duration + 1800) {
            resolve(true);
          } else {
            root.setTimeout(inspect, 40);
          }
          return;
        }
        void nextRenderFrame().then(function () {
          void nextRenderFrame().then(function () {
            resolve(
              generation === state.dataRefreshGeneration
              && isEvolutionViewCurrent(viewGeneration)
              && chart === refs.evolutionChart
              && (!sawAnimation || component.animation !== true)
            );
          });
        });
      }
      inspect();
    });
  }

  function getEvolutionContainmentIds() {
    return refs.evolutionChart?.isConnected === false || !refs.evolutionChart?.id
      ? []
      : [refs.evolutionChart.id];
  }

  function beginEvolutionDataTransition(reason) {
    root.CodeXRAnalysisTableRuntime?.beginChartDataTransition?.(
      getEvolutionContainmentIds(),
      reason || 'project-evolution-frame'
    );
  }

  function finishEvolutionDataTransition(reason) {
    root.CodeXRAnalysisTableRuntime?.finishChartDataTransition?.(
      getEvolutionContainmentIds(),
      reason || 'project-evolution-frame'
    );
  }

  function cancelEvolutionDataTransition(reason) {
    root.CodeXRAnalysisTableRuntime?.cancelChartDataTransition?.(
      getEvolutionContainmentIds(),
      reason || 'project-evolution-cancelled'
    );
  }

  async function waitForEvolutionContainmentStable(viewGeneration) {
    if (!isEvolutionViewCurrent(viewGeneration)) {
      return false;
    }
    var ids = getEvolutionContainmentIds();
    var wait = root.CodeXRAnalysisTableRuntime?.waitForChartsStable;
    if (typeof wait !== 'function' || !ids.length) {
      await nextRenderFrame();
      return isEvolutionViewCurrent(viewGeneration);
    }
    try {
      await wait(ids, { timeoutMs: 12000, pollMs: 120, stablePasses: 2 });
      return isEvolutionViewCurrent(viewGeneration);
    } catch (_error) {
      return false;
    }
  }
