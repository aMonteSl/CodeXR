// == xrChartMappingUiRuntime.js | part 40: mapping-profiles (assembled with its siblings; see COMPONENTS.md) ==
  function cloneMapping(mapping) {
    return Object.assign({}, mapping || {});
  }

  function cloneInvalidOptions(invalidOptionsByDimension) {
    return JSON.parse(JSON.stringify(invalidOptionsByDimension || {}));
  }

  function getActiveChartId(config) {
    return state.activeChartId || (config && config.chartId) || '';
  }

  function getMappingProfileKey(contextId, chartId) {
    return String(contextId || 'default') + '::' + String(chartId || 'default-chart');
  }

  function getDimensionsForChart(config, chartId) {
    var byChart = config && config.dimensionsByChart;
    var dimensions = byChart && Array.isArray(byChart[chartId])
      ? byChart[chartId]
      : (Array.isArray(config && config.dimensions) ? config.dimensions : []);
    return dimensions;
  }

  function getDefaultMappingForChart(config, chartId) {
    var defaultsByChart = config && config.defaultMappingsByChart;
    if (defaultsByChart && defaultsByChart[chartId]) {
      return cloneMapping(defaultsByChart[chartId]);
    }
    var selectedByDimension = {};
    getDimensionsForChart(config, chartId).forEach(function (dimension) {
      if (!dimension || !dimension.id) {
        return;
      }
      var fields = Array.isArray(dimension.fields) ? dimension.fields : [];
      selectedByDimension[dimension.id] = dimension.currentField || fields[0] || '';
    });
    return selectedByDimension;
  }

  function buildDefaultMappingSnapshot(config) {
    var selectedByDimension = getDefaultMappingForChart(config, getActiveChartId(config));
    return {
      visible: config && config.panelVisible !== false,
      selectedByDimension: cloneMapping(selectedByDimension),
      lastKnownGoodMapping: cloneMapping(selectedByDimension),
      invalidOptionsByDimension: {}
    };
  }

  function normalizeMappingSnapshot(snapshot, config) {
    var fallback = buildDefaultMappingSnapshot(config);
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      return fallback;
    }
    var selected = snapshot.selectedByDimension && typeof snapshot.selectedByDimension === 'object' && !Array.isArray(snapshot.selectedByDimension)
      ? snapshot.selectedByDimension
      : fallback.selectedByDimension;
    var lastKnownGood = snapshot.lastKnownGoodMapping && typeof snapshot.lastKnownGoodMapping === 'object' && !Array.isArray(snapshot.lastKnownGoodMapping)
      ? snapshot.lastKnownGoodMapping
      : selected;
    return {
      visible: typeof snapshot.visible === 'boolean' ? snapshot.visible : fallback.visible,
      selectedByDimension: cloneMapping(selected),
      lastKnownGoodMapping: cloneMapping(lastKnownGood),
      invalidOptionsByDimension: cloneInvalidOptions(snapshot.invalidOptionsByDimension)
    };
  }

  function captureMappingProfile() {
    var confirmedMapping = Object.keys(state.lastKnownGoodMapping || {}).length
      ? state.lastKnownGoodMapping
      : state.selectedByDimension;
    return {
      visible: state.visible,
      selectedByDimension: cloneMapping(confirmedMapping),
      lastKnownGoodMapping: cloneMapping(confirmedMapping),
      invalidOptionsByDimension: cloneInvalidOptions(state.invalidOptionsByDimension)
    };
  }

  function saveActiveMappingProfile() {
    var contextId = state.activeMappingContextId || 'default';
    var chartId = getActiveChartId(getConfig());
    var profileKey = getMappingProfileKey(contextId, chartId);
    state.mappingProfiles[profileKey] = captureMappingProfile();
    return state.mappingProfiles[profileKey];
  }

  function applyMappingRuntimeState(config, runtimeState, reason) {
    var snapshot = normalizeMappingSnapshot(runtimeState, config);
    clearPendingValidationTimers();
    clearStatusTimer();
    state.pendingMapping = null;
    state.statusMessage = '';
    state.statusLevel = 'info';
    state.visible = snapshot.visible;
    state.selectedByDimension = cloneMapping(snapshot.selectedByDimension);
    state.lastKnownGoodMapping = cloneMapping(snapshot.lastKnownGoodMapping || snapshot.selectedByDimension);
    state.invalidOptionsByDimension = cloneInvalidOptions(snapshot.invalidOptionsByDimension);
    applyMappingSnapshot(config, state.lastKnownGoodMapping, reason || 'mapping-ui-restore');
    state.selectedByDimension = cloneMapping(state.lastKnownGoodMapping);
    setVisible(config, state.visible);
    renderRows(config);
    requestChartContainmentRenormalize(reason || 'mapping-ui-restore');
    saveActiveMappingProfile();
    return true;
  }

  function mappingsEqual(left, right) {
    var leftKeys = Object.keys(left || {});
    var rightKeys = Object.keys(right || {});
    if (leftKeys.length !== rightKeys.length) {
      return false;
    }
    return leftKeys.every(function (key) {
      return (left || {})[key] === (right || {})[key];
    });
  }

  function getChartComponentName(config) {
    return COMPONENT_BY_CHART[(state.activeChartId || (config && config.chartId)) || ''] || null;
  }

  function buildChartComponentUpdate(chartEntity, componentName, mappingSnapshot) {
    var currentData = chartEntity && componentName
      ? chartEntity.getAttribute(componentName)
      : null;
    var preservedData = currentData && typeof currentData === 'object' && !Array.isArray(currentData)
      ? currentData
      : {};
    return Object.assign({}, preservedData, mappingSnapshot || {});
  }

  function applyMappingToCharts(chartEntities, componentName, mappingSnapshot) {
    chartEntities.forEach(function (chartEntity) {
      chartEntity.setAttribute(
        componentName,
        buildChartComponentUpdate(chartEntity, componentName, mappingSnapshot)
      );
    });
  }

  function isHierarchicalChart(chartId) {
    return chartId === 'boats';
  }

  function getChartFromSource(chartId, existingData) {
    if (existingData && existingData.from) {
      var fromValue = String(existingData.from);
      if (isHierarchicalChart(chartId)) {
        if (/Tree/i.test(fromValue) || fromValue === 'tree') {
          return fromValue;
        }
        return 'tree';
      }
      if (/Comparison/i.test(fromValue) && !/Tree/i.test(fromValue)) {
        return fromValue;
      }
    }
    return isHierarchicalChart(chartId) ? 'tree' : 'data';
  }

  function buildRuntimeChartData(chartId, existingData, mappingSnapshot) {
    var data = Object.assign({}, mappingSnapshot || {});
    var source = getChartFromSource(chartId, existingData);
    data.from = source;
    data.legend = true;
    data.palette = existingData.palette || 'ubuntu';
    data.title = existingData.title || 'CodeXR Analysis';
    data.axis_name = true;

    if (chartId === 'boats') {
      return Object.assign({
        legend_text: '{name}\\n{path}',
        height_building_legend: -0.5,
        legend_scale: 0.25,
        legend_lookat: '[laser-controls]',
        extra: 1,
        separation: 0.5,
        zone_elevation: 0.01,
        height_quarter_legend_box: 0.01,
        height_quarter_legend_title: 2.5
      }, data);
    }

    return data;
  }

  function readCurrentChartData(chartEntity) {
    if (!chartEntity || typeof chartEntity.getAttribute !== 'function') {
      return {};
    }
    var componentNames = Object.keys(COMPONENT_BY_CHART).map(function (chartId) {
      return COMPONENT_BY_CHART[chartId];
    }).filter(function (componentName, index, list) {
      return componentName && list.indexOf(componentName) === index;
    });
    for (var i = 0; i < componentNames.length; i += 1) {
      var value = chartEntity.getAttribute(componentNames[i]);
      if (value && typeof value === 'object') {
        return value;
      }
    }
    return {};
  }

  function clearChartComponents(chartEntity) {
    Object.keys(COMPONENT_BY_CHART).forEach(function (chartId) {
      var componentName = COMPONENT_BY_CHART[chartId];
      if (componentName && chartEntity.removeAttribute) {
        chartEntity.removeAttribute(componentName);
      }
    });
  }

  function clearChartGeneratedChildren(chartEntity) {
    if (!chartEntity || typeof chartEntity.removeChild !== 'function') {
      return;
    }
    while (chartEntity.firstChild) {
      chartEntity.removeChild(chartEntity.firstChild);
    }
  }

  function applyChartDefaultTransform(chartEntity, chartId) {
    if (!chartEntity || typeof chartEntity.setAttribute !== 'function') {
      return;
    }
    var rotation = DEFAULT_ROTATION_BY_CHART[chartId] || '0 0 0';
    chartEntity.setAttribute('rotation', rotation);
  }

  function applyChartTypeToEntity(chartEntity, chartId, mappingSnapshot) {
    var componentName = COMPONENT_BY_CHART[chartId];
    if (!chartEntity || !componentName || typeof chartEntity.setAttribute !== 'function') {
      return false;
    }
    var existingData = readCurrentChartData(chartEntity);
    clearChartComponents(chartEntity);
    clearChartGeneratedChildren(chartEntity);
    applyChartDefaultTransform(chartEntity, chartId);
    chartEntity.setAttribute(componentName, buildRuntimeChartData(chartId, existingData, mappingSnapshot));
    chartEntity.setAttribute('data-codexr-active-chart-id', chartId);
    return true;
  }

  function applyChartTypeToEntities(config, chartId, mappingSnapshot) {
    var chartEntities = getChartEntities(config);
    var componentName = COMPONENT_BY_CHART[chartId];
    if (!chartEntities.length || !componentName) {
      return false;
    }
    chartEntities.forEach(function (chartEntity) {
      applyChartTypeToEntity(chartEntity, chartId, mappingSnapshot);
    });
    return true;
  }

  function getDimensionConfig(config, dimensionId) {
    var dimensions = Array.isArray(config && config.dimensions) ? config.dimensions : [];
    for (var i = 0; i < dimensions.length; i += 1) {
      if (dimensions[i] && dimensions[i].id === dimensionId) {
        return dimensions[i];
      }
    }
    return null;
  }
