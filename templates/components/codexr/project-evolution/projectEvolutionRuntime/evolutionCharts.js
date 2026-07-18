// == projectEvolutionRuntime.js | evolutionCharts (assembled per manifest.json; see COMPONENTS.md) ==
  function ensureEvolutionRoot() {
    if (refs.evolutionRoot?.isConnected !== false && refs.evolutionRoot) {
      root.CodeXRAnalysisSurfaceRuntime?.mountRoot?.(MODE, refs.evolutionRoot);
      return refs.evolutionRoot;
    }
    refs.evolutionRoot = entity('a-entity', {
      id: 'codexrProjectEvolutionRoot',
      'data-codexr-analysis-root': 'true',
      'data-codexr-analysis-mode': MODE
    });
    if (root.CodeXRAnalysisSurfaceRuntime?.mountRoot) {
      root.CodeXRAnalysisSurfaceRuntime?.mountRoot(MODE, refs.evolutionRoot);
    } else {
      doc().querySelector?.('a-scene').appendChild?.(refs.evolutionRoot);
    }
    return refs.evolutionRoot;
  }

  function cloneChartForEvolution(template, chartId) {
    var componentName = COMPONENT_BY_CHART[chartId];
    var clone = entity('a-entity');
    template.getAttributeNames?.().forEach(function (attributeName) {
      if (
        attributeName === 'id'
        || attributeName === 'visible'
        || attributeName === 'position'
        || attributeName === 'scale'
        || attributeName === 'codexr-chart-containment'
        || attributeName === componentName
      ) {
        return;
      }
      clone.setAttribute(attributeName, template.getAttribute(attributeName));
    });
    clone.setAttribute('id', 'codexrProjectEvolutionChart');
    clone.setAttribute('data-codexr-project-evolution-chart', 'true');
    clone.setAttribute('data-codexr-project-evolution-chart-id', chartId);
    return clone;
  }

  function ensureEvolutionChart(chartId) {
    var componentName = COMPONENT_BY_CHART[chartId];
    if (!componentName) { return null; }
    var chart = refs.evolutionChart;
    if (
      chart?.isConnected !== false
      && chart?.getAttribute('data-codexr-project-evolution-chart-id') === chartId
    ) {
      chart.setAttribute('visible', true);
      return chart;
    }
    if (chart?.parentNode) {
      chart.parentNode.removeChild(chart);
    }
    var template = getTemplateChart(chartId);
    if (!template) { return null; }
    refs.evolutionChart = cloneChartForEvolution(template, chartId);
    state.activeChartId = chartId;
    state.preparedChartIds = {};
    state.chartDataSignature = '';
    return refs.evolutionChart;
  }

  function vectorToPositionAttribute(position) {
    var source = position || {};
    return [
      Number.isFinite(source.x) ? source.x : 0,
      Number.isFinite(source.y) ? source.y : 1,
      Number.isFinite(source.z) ? source.z : -18
    ].join(' ');
  }

  function projectEvolutionContainmentProfile() {
    return root.CodeXRAnalysisTableRuntime?.getContainmentProfile?.('project-evolution') || {
      id: 'project-evolution',
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
        minHeightOccupancyRatio: 0.45,
        heightBandMinRatio: 0.38,
        heightBandMaxRatio: 0.72,
        tableTopPadding: 0.9,
        tableEdgeMargin: 0.18,
        yScaleMin: 0.01,
        yScaleMax: 12,
        containmentToleranceRatio: 0.018,
        periodicContainmentEnabled: true,
        transformTransitionMs: 650,
        hardHeightGuardEnabled: true
      }
    };
  }

  function projectEvolutionInitialScale(chartId) {
    var isBoats = chartId === 'boats';
    return isBoats ? '0.01 0.05 0.01' : '1 1 1';
  }

  function prepareChartForEvolution(chart, chartId, options) {
    if (!chart || !chart.id) { return; }
    var preparationKey = chart.id + ':' + chartId;
    var force = !!(options && options.force);
    if (!force && state.preparedChartIds[preparationKey]) { return; }
    var profile = projectEvolutionContainmentProfile();
    if (!state.preparedChartIds[preparationKey]) {
      chart.setAttribute('scale', projectEvolutionInitialScale(chartId));
    }
    if (root.CodeXRAnalysisTableRuntime?.applyContainmentProfile) {
      root.CodeXRAnalysisTableRuntime?.applyContainmentProfile(chart, profile);
    } else {
      chart.setAttribute('position', vectorToPositionAttribute(profile.position));
      chart.setAttribute('codexr-chart-containment', profile.containment);
    }
    state.preparedChartIds[preparationKey] = true;
  }

  function ensureEvolutionPlaybackRoot(frame) {
    if (refs.evolutionPlaybackRoot?.isConnected !== false && refs.evolutionPlaybackRoot) {
      refs.evolutionPlaybackRoot?.setAttribute('data-codexr-frame-index', String((frame.index || 0) + 1));
      return refs.evolutionPlaybackRoot;
    }
    var rootEl = ensureEvolutionRoot();
    refs.evolutionPlaybackRoot = entity('a-entity', {
      id: 'codexrProjectEvolutionPlaybackRoot',
      'data-codexr-role': 'project-evolution playback-root',
      'data-codexr-frame-index': String((frame.index || 0) + 1)
    });
    rootEl.appendChild(refs.evolutionPlaybackRoot);
    return refs.evolutionPlaybackRoot;
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
      }, timeoutMs || 900);
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

  function ensureEvolutionDataSource(playbackRoot, initialUrl) {
    if (refs.evolutionDataSource?.isConnected !== false && refs.evolutionDataSource) {
      if (refs.evolutionDataSource.parentNode !== playbackRoot) {
        playbackRoot.appendChild(refs.evolutionDataSource);
      }
      return refs.evolutionDataSource;
    }
    var attrs = {
      id: 'codexrProjectEvolutionData',
      visible: false,
      'data-codexr-role': 'project-evolution datasource'
    };
    if (initialUrl) {
      attrs['babia-queryjson'] = 'url: ' + initialUrl;
      attrs['data-codexr-evolution-url'] = initialUrl;
    }
    refs.evolutionDataSource = entity('a-entity', attrs);
    playbackRoot.appendChild(refs.evolutionDataSource);
    return refs.evolutionDataSource;
  }

  function refreshEvolutionDataSource(frameUrl) {
    if (!refs.evolutionDataSource || !frameUrl) {
      return false;
    }
    var generation = ++state.dataRefreshGeneration;
    refs.evolutionDataSource.setAttribute('data-codexr-evolution-url', frameUrl);
    refs.evolutionDataSource.setAttribute('babia-queryjson', 'url: ' + frameUrl);
    root.console.debug?.('[CodeXR Project Evolution] datasource refresh', {
      frameUrl: frameUrl,
      generation: generation
    });
    root.setTimeout(function () {
      if (generation !== state.dataRefreshGeneration) {
        return;
      }
      refs.evolutionDataSource?.emit('data-loaded', {});
    }, 100);
    return true;
  }

  function ensureEvolutionTreeBuilder(playbackRoot, targetType) {
    var field = targetType === 'directory' ? 'filePath' : 'treePath';
    var treeAttr = 'field: ' + field + '; split_by: /; from: codexrProjectEvolutionData';
    if (refs.evolutionTreeBuilder?.isConnected !== false && refs.evolutionTreeBuilder) {
      if (refs.evolutionTreeBuilder.parentNode !== playbackRoot) {
        playbackRoot.appendChild(refs.evolutionTreeBuilder);
      }
      refs.evolutionTreeBuilder.setAttribute('babia-treebuilder', treeAttr);
      return refs.evolutionTreeBuilder;
    }
    refs.evolutionTreeBuilder = entity('a-entity', {
      id: 'codexrProjectEvolutionTree',
      visible: false,
      'data-codexr-role': 'project-evolution treebuilder',
      'babia-treebuilder': treeAttr
    });
    playbackRoot.appendChild(refs.evolutionTreeBuilder);
    return refs.evolutionTreeBuilder;
  }
