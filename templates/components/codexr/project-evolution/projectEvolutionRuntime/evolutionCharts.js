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

  // Orientation comes from the canonical presentation profile — the same
  // source the generator and the chart switch use — so the movie can never
  // disagree with the rest of the scene about how a chart stands.
  function getChartRotation(chartId) {
    var presentation = root.CodeXRMappingUiRuntime?.getChartPresentation?.(chartId);
    return (presentation && presentation.rotation) || '0 0 0';
  }

  // Builds the movie's chart entity from scratch. Everything it NEEDS is known
  // here (id, markers, orientation, the babia component name); a scene chart,
  // when present, only contributes decorative attributes. Cloning a DOM
  // template used to be mandatory, which made the whole movie depend on an
  // attribute the mapping UI removes on the first chart switch.
  function buildEvolutionChart(chartId) {
    var componentName = COMPONENT_BY_CHART[chartId];
    if (!componentName) { return null; }
    var chart = entity('a-entity');
    var styleSource = getChartStyleSource(chartId);
    styleSource?.getAttributeNames?.().forEach(function (attributeName) {
      if (
        attributeName === 'id'
        || attributeName === 'visible'
        || attributeName === 'position'
        || attributeName === 'scale'
        // Orientation belongs to the chart the movie is building, never to the
        // scene chart we borrow decoration from: inheriting it stood a boats
        // movie on its side after the scene had been switched to pie/donut.
        || attributeName === 'rotation'
        || attributeName === 'codexr-chart-containment'
        || attributeName === 'data-codexr-chart-containment'
        || attributeName === 'data-codexr-active-chart-id'
        || CHART_COMPONENT_NAMES.indexOf(attributeName) !== -1
      ) {
        return;
      }
      chart.setAttribute(attributeName, styleSource.getAttribute(attributeName));
    });
    chart.setAttribute('id', 'codexrProjectEvolutionChart');
    chart.setAttribute('data-codexr-project-evolution-chart', 'true');
    chart.setAttribute('data-codexr-project-evolution-chart-id', chartId);
    chart.setAttribute('rotation', getChartRotation(chartId));
    return chart;
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
    // Build the replacement BEFORE dropping the current one: the old order
    // detached the chart and only then looked for a template, so a failure left
    // the scene with no chart at all and refs pointing at a detached node.
    var nextChart = buildEvolutionChart(chartId);
    if (!nextChart) { return null; }
    if (chart) {
      // Babia never unsubscribes a chart component from its data producer, so
      // the discarded chart would keep repainting on every frame push.
      root.CodeXRMappingUiRuntime?.releaseChartEntity?.(chart);
      chart.parentNode?.removeChild(chart);
    }
    refs.evolutionChart = nextChart;
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

  // babia-boats only redraws from scratch when it has no previous figures
  // (babia-boats.js: `if (this.figures_old.length == 0)` → wipe children and
  // draw); on any later data push it takes a morph animation path instead,
  // which assumes the two trees are shaped alike. A movie frame is the exact
  // opposite: a different revision with different files and directories, and
  // the morph loses geometry it never restores — the chart degraded frame by
  // frame until it was unrecognizable. Emptying its figure list before the
  // frame lands puts it back on the redraw path.
  function resetChartRedrawState(chart, componentName) {
    if (componentName !== 'babia-boats') {
      return false;
    }
    var component = chart?.components?.[componentName];
    if (!component) {
      return false;
    }
    component.figures = [];
    component.figures_old = [];
    component.figures_del = [];
    component.figures_in = [];
    component.animation = false;
    return true;
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

  function evolutionTreeField(targetType) {
    // Shared boats tree contract (generator-injected): directory quarters
    // split the full analyzed path (filePath — rebuilt by the service against
    // the ORIGINAL target, exactly like the normal analysis), file mode the
    // synthetic treePath.
    var treeFields = root.CodeXRMappingUiRuntime?.getChartBaseConfig?.()?.treeFields;
    if (targetType === 'directory') {
      return treeFields?.directory || 'filePath';
    }
    return treeFields?.file || 'treePath';
  }

  function ensureEvolutionTreeBuilder(playbackRoot, targetType) {
    var field = evolutionTreeField(targetType);
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
