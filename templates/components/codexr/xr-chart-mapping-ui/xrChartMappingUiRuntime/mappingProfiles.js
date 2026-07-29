// == xrChartMappingUiRuntime.js | mappingProfiles (assembled per manifest.json; see COMPONENTS.md) ==
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
    if (byChart && Array.isArray(byChart[chartId])) {
      return byChart[chartId];
    }
    // config.dimensions belongs to the chart currently applied (selectChart
    // rewrites it), so it is only a valid answer for that same chart — using it
    // for another one handed back the PREVIOUS chart's axes.
    var appliedChartId = config && config.chartId;
    if (!chartId || chartId === appliedChartId) {
      return Array.isArray(config && config.dimensions) ? config.dimensions : [];
    }
    return [];
  }

  // The mapping of a chart always covers every dimension the chart declares:
  // published defaults first, then the dimension's own current/first field for
  // anything missing. A partial mapping reached Babia as a missing axis, which
  // is what surfaced as "invalid axis" (and it can still arrive that way from a
  // scene generated before the contract was fixed).
  function getDefaultMappingForChart(config, chartId) {
    var defaultsByChart = config && config.defaultMappingsByChart;
    var published = defaultsByChart && defaultsByChart[chartId]
      ? cloneMapping(defaultsByChart[chartId])
      : {};
    getDimensionsForChart(config, chartId).forEach(function (dimension) {
      if (!dimension || !dimension.id || published[dimension.id]) {
        return;
      }
      var fields = Array.isArray(dimension.fields) ? dimension.fields : [];
      var field = dimension.currentField || fields[0] || '';
      if (field) {
        published[dimension.id] = field;
      }
    });
    return published;
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

  // Reconciles a mapping against the chart that is about to be applied: the
  // chart's own dimensions win the shape (stale axes from the previous chart are
  // dropped, missing ones are filled from the defaults). Every snapshot path —
  // restore, context switch, chart switch — funnels through here, so no chart
  // can be applied with a partial or foreign mapping.
  function reconcileMappingForChart(mapping, fallbackMapping, dimensions) {
    var source = mapping && typeof mapping === 'object' && !Array.isArray(mapping) ? mapping : {};
    if (!dimensions.length) {
      return Object.assign({}, fallbackMapping, source);
    }
    var reconciled = {};
    dimensions.forEach(function (dimension) {
      if (!dimension || !dimension.id) { return; }
      var field = source[dimension.id] || fallbackMapping[dimension.id] || '';
      if (field) {
        reconciled[dimension.id] = field;
      }
    });
    return reconciled;
  }

  function normalizeMappingSnapshot(snapshot, config) {
    var fallback = buildDefaultMappingSnapshot(config);
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      return fallback;
    }
    var dimensions = getDimensionsForChart(config, getActiveChartId(config));
    var selected = reconcileMappingForChart(snapshot.selectedByDimension, fallback.selectedByDimension, dimensions);
    var lastKnownGood = snapshot.lastKnownGoodMapping && typeof snapshot.lastKnownGoodMapping === 'object' && !Array.isArray(snapshot.lastKnownGoodMapping)
      ? reconcileMappingForChart(snapshot.lastKnownGoodMapping, selected, dimensions)
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

  // `options.applyToEntities: false` updates the runtime STATE and rows only:
  // UI-only chart switches route the panel while the resolved chart entities
  // may belong to another mode — applying the new mapping to them stamped a
  // foreign chart component onto the parked normal chart.
  function applyMappingRuntimeState(config, runtimeState, reason, options) {
    var applyToEntities = !options || options.applyToEntities !== false;
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
    if (applyToEntities) {
      applyMappingSnapshot(config, state.lastKnownGoodMapping, reason || 'mapping-ui-restore');
    }
    state.selectedByDimension = cloneMapping(state.lastKnownGoodMapping);
    setVisible(config, state.visible);
    renderRows(config);
    // No re-fit request here: applyMappingSnapshot above already asks for one
    // when it actually applies a mapping to the charts. Asking again queued a
    // second pass over every chart for the same change.
    saveActiveMappingProfile();
    // Single place where the runtime state is applied → the profile now on
    // screen. switchMappingContext compares against this to stay idempotent.
    state.appliedMappingProfileKey = getMappingProfileKey(
      state.activeMappingContextId,
      getActiveChartId(config)
    );
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

  // The chart the entity is actually WEARING, which is not always the chart
  // the selector points at: `selectChart(id, { applyToEntities: false })`
  // moves the selector alone (every mode change does it, so a mode can own its
  // own entity), leaving the scene chart on the previous type until something
  // re-applies the mapping.
  function getEntityChartId(chartEntity) {
    return chartEntity && typeof chartEntity.getAttribute === 'function'
      ? String(chartEntity.getAttribute('data-codexr-active-chart-id') || '')
      : '';
  }

  function applyMappingToCharts(chartEntities, componentName, mappingSnapshot) {
    var activeChartId = state.activeChartId;
    chartEntities.forEach(function (chartEntity) {
      var entityChartId = getEntityChartId(chartEntity);
      // Stamping the new component onto an entity still wearing the previous
      // one left it half converted: both babia components alive, the previous
      // chart's rotation still applied (a boats arriving after a pie stayed
      // rotated 90°) and a stale chart-id marker, which also mis-routes the
      // containment's fit strategy and surface lift. Converting it properly is
      // what applyChartTypeToEntity already does.
      if (activeChartId && entityChartId && entityChartId !== activeChartId) {
        applyChartTypeToEntity(chartEntity, activeChartId, mappingSnapshot);
        return;
      }
      setDeclarativeAttribute(
        chartEntity,
        componentName,
        serializeDeclarativeComponentData(
          buildChartComponentUpdate(chartEntity, componentName, mappingSnapshot)
        )
      );
    });
    // A re-mapping changes the fields that rank and filter the top-N slice:
    // recompute slice content for every entity reading from one.
    refreshChartDataSlicesForMapping(
      chartEntities,
      componentName,
      state.activeChartId,
      mappingSnapshot
    );
  }

  function isHierarchicalChart(chartId) {
    return chartId === 'boats';
  }

  // Canonical chart construction, injected by the generator as JSON
  // (#codexr-chart-base-config). The fallback mirrors the generator's values
  // (chartPresentation.ts) for scenes generated before the config existed and
  // for harnesses; the injected config always wins so the generator stays the
  // single source.
  var BOATS_BASE_ATTRIBUTES_FALLBACK = {
    legend: true,
    legend_text: '{name}\n{fheight} (height): {height}\n{farea} (area): {area}\n{fcolor} (color): {color}',
    height_building_legend: -0.5,
    legend_scale: 0.25,
    legend_lookat: '[camera]',
    axis_name: true,
    extra: 1,
    separation: 0.5,
    zone_elevation: 0.01,
    height_quarter_legend_box: 0.01,
    height_quarter_legend_title: 2.5
  };
  var CHART_BASE_CONFIG_FALLBACK = {
    boats: BOATS_BASE_ATTRIBUTES_FALLBACK,
    // Mirror of CHART_PRESENTATION_PROFILES (chartPresentation.ts): rotation
    // the chart needs to stand as Babia designed it, base component
    // attributes beyond the mapped fields, and how many data rows the chart
    // can express legibly (applied as a top-N slice by chartDataSlice.js).
    presentation: {
      bars: { rotation: '0 0 0', initialScale: '1.5 1.5 1.5', fit: 'planar-uniform', rowBudget: 20, orderBy: 'height', keyBy: ['x_axis'], baseAttributes: {} },
      barsmap: { rotation: '0 0 0', initialScale: '1.5 1.5 1.5', rowBudget: 30, orderBy: 'height', keyBy: ['x_axis', 'z_axis'], baseAttributes: {} },
      cyls: { rotation: '0 0 0', initialScale: '1.5 1.5 1.5', fit: 'planar-uniform', rowBudget: 20, orderBy: 'height', keyBy: ['x_axis'], baseAttributes: { radiusMax: 1 } },
      cylsmap: { rotation: '0 0 0', initialScale: '1.5 1.5 1.5', fit: 'planar-uniform', rowBudget: 30, orderBy: 'height', keyBy: ['x_axis', 'z_axis'], baseAttributes: { radiusMax: 1 } },
      pie: { rotation: '90 0 0', initialScale: '1.5 1.5 1.5', fit: 'uniform', rowBudget: 12, orderBy: 'size', keyBy: ['key'], baseAttributes: { titlePosition: '2.5 0 -3' } },
      donut: { rotation: '90 0 0', initialScale: '1.5 1.5 1.5', fit: 'uniform', rowBudget: 12, orderBy: 'size', keyBy: ['key'], baseAttributes: { titlePosition: '2.5 0 -3' } },
      bubbles: { rotation: '0 0 0', initialScale: '1.5 1.5 1.5', fit: 'uniform', rowBudget: 12, orderBy: 'height', keyBy: ['x_axis', 'z_axis'], surfaceLift: 0.03, baseAttributes: { heightMax: 5, radiusMax: 1.5 } },
      boats: {
        rotation: '0 0 0',
        initialScale: '0.01 0.05 0.01',
        preserveRelativeHierarchyLayers: true,
        baseAttributes: BOATS_BASE_ATTRIBUTES_FALLBACK
      }
    },
    treeFields: { directory: 'filePath', file: 'treePath' }
  };
  var chartBaseConfigCache = null;

  function getChartBaseConfig() {
    if (chartBaseConfigCache) {
      return chartBaseConfigCache;
    }
    var parsed = null;
    var element = getDoc()?.getElementById?.('codexr-chart-base-config');
    if (element && element.textContent) {
      try {
        parsed = JSON.parse(element.textContent);
      } catch (error) {
        console.warn('CODEXR_MAPPING_UI: invalid codexr-chart-base-config JSON', error);
      }
    }
    var presentation = {};
    Object.keys(CHART_BASE_CONFIG_FALLBACK.presentation).forEach(function (chartId) {
      var fallbackProfile = CHART_BASE_CONFIG_FALLBACK.presentation[chartId];
      var injectedProfile = (parsed && parsed.presentation && parsed.presentation[chartId]) || {};
      // Scenes generated before the presentation profile existed inject only
      // the legacy `boats` key: it must keep overriding the boats base.
      var legacyBoatsOverride = chartId === 'boats' ? (parsed?.boats || {}) : {};
      presentation[chartId] = Object.assign({}, fallbackProfile, injectedProfile, {
        baseAttributes: Object.assign(
          {},
          fallbackProfile.baseAttributes,
          legacyBoatsOverride,
          injectedProfile.baseAttributes || {}
        )
      });
    });
    chartBaseConfigCache = {
      boats: Object.assign({}, CHART_BASE_CONFIG_FALLBACK.boats, parsed?.boats || {}),
      presentation: presentation,
      treeFields: Object.assign({}, CHART_BASE_CONFIG_FALLBACK.treeFields, parsed?.treeFields || {})
    };
    return chartBaseConfigCache;
  }

  function getChartPresentation(chartId) {
    var presentation = getChartBaseConfig().presentation;
    return presentation[chartId] || {
      rotation: '0 0 0',
      initialScale: '1.5 1.5 1.5',
      baseAttributes: {}
    };
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
    // Budgeted charts read from the CodeXR-maintained top-N slice instead of
    // the full dataset (chartDataSlice.js); boats keeps its tree source.
    data.from = resolveChartDataSourceId(chartId, source, mappingSnapshot);
    data.legend = true;
    data.palette = existingData.palette || 'ubuntu';
    data.title = existingData.title || 'CodeXR Analysis';
    data.axis_name = true;

    // Every chart carries its canonical base attributes (normalization caps,
    // title placement, boats construction) under the mapping — the live
    // switch used to drop them for everything but boats, which is how
    // bubbles lost heightMax/radiusMax and exploded to raw metric scale.
    return Object.assign({}, getChartPresentation(chartId).baseAttributes, data);
  }

  function serializeDeclarativeComponentData(componentData) {
    return Object.keys(componentData || {})
      .filter(function (key) {
        var value = componentData[key];
        return value !== undefined && value !== null && value !== '';
      })
      .map(function (key) {
        var value = componentData[key];
        if (Array.isArray(value)) {
          value = value.join(',');
        } else if (value && typeof value === 'object') {
          value = JSON.stringify(value);
        }
        return key + ': ' + String(value).replace(/;/g, ',');
      })
      .join(';\n');
  }

  function setDeclarativeAttribute(element, name, value) {
    if (!element || !name) {
      return false;
    }
    var serialized = String(value ?? '');
    var nativeSetter = root.Element?.prototype?.setAttribute;
    if (typeof nativeSetter !== 'function') {
      element.setAttribute?.(name, serialized);
      return true;
    }
    // Once mounted, A-Frame's setter is still responsible for updating the
    // live component. It serializes component attributes as "", however, so
    // restore the authoritative declarative string with the native DOM setter.
    if (element.isConnected) {
      element.setAttribute(name, serialized);
    }
    nativeSetter.call(element, name, serialized);
    return true;
  }

  function syncHierarchyLayerStability(chart, presentation) {
    if (!chart) {
      return false;
    }
    var attributeName = 'codexr-boats-layout-stability';
    if (presentation && presentation.preserveRelativeHierarchyLayers === true) {
      return setDeclarativeAttribute(chart, attributeName, 'enabled: true');
    }
    if (typeof chart.removeAttribute === 'function') {
      chart.removeAttribute(attributeName);
    }
    return false;
  }

  function declarativePosition(position) {
    if (typeof position === 'string' && position.trim()) {
      return position;
    }
    var value = position || {};
    return [
      Number.isFinite(Number(value.x)) ? Number(value.x) : 0,
      Number.isFinite(Number(value.y)) ? Number(value.y) : 1,
      Number.isFinite(Number(value.z)) ? Number(value.z) : -18
    ].join(' ');
  }

  function buildDeclarativeTreeEntity(options) {
    var settings = options || {};
    var document = getDoc();
    if (!document?.createElement) {
      return null;
    }
    var tree = document.createElement('a-entity');
    setDeclarativeAttribute(tree, 'id', String(settings.entityId || 'tree'));
    setDeclarativeAttribute(
      tree,
      'babia-treebuilder',
      serializeDeclarativeComponentData({
        field: settings.field || 'filePath',
        split_by: settings.splitBy || '/',
        from: settings.sourceId || 'data'
      })
    );
    return tree;
  }

  function buildDeclarativeChartComponentData(options) {
    var settings = options || {};
    var chartId = String(settings.chartId || '');
    var existingData = {
      from: settings.sourceId || (isHierarchicalChart(chartId) ? 'tree' : 'data'),
      palette: settings.palette || 'ubuntu',
      title: settings.title || 'CodeXR Analysis'
    };
    var mapping = settings.mapping || {};
    var data = buildRuntimeChartData(chartId, existingData, mapping);
    var ordered = {
      from: existingData.from,
      title: data.title,
      palette: data.palette
    };
    Object.keys(mapping).forEach(function (key) {
      ordered[key] = data[key];
    });
    Object.keys(data).forEach(function (key) {
      if (!Object.prototype.hasOwnProperty.call(ordered, key)) {
        ordered[key] = data[key];
      }
    });
    return Object.assign(ordered, settings.componentData || {});
  }

  function configureDeclarativeChartEntity(chart, options) {
    var settings = options || {};
    var chartId = String(settings.chartId || '');
    var componentName = COMPONENT_BY_CHART[chartId];
    if (!chart || !componentName) {
      return false;
    }
    var presentation = getChartPresentation(chartId);
    setDeclarativeAttribute(chart, 'data-codexr-active-chart-id', chartId);
    if (settings.role) {
      setDeclarativeAttribute(chart, 'data-codexr-role', String(settings.role));
    }
    if (settings.applyTransform !== false) {
      if (settings.containmentProfile) {
        var containmentProfile = settings.containmentProfile;
        setDeclarativeAttribute(
          chart,
          'codexr-chart-containment',
          serializeDeclarativeComponentData(containmentProfile.containment || {})
        );
        setDeclarativeAttribute(chart, 'data-codexr-chart-containment', 'true');
        setDeclarativeAttribute(
          chart,
          'position',
          declarativePosition(containmentProfile.position)
        );
      } else if (settings.position) {
        setDeclarativeAttribute(chart, 'position', declarativePosition(settings.position));
      }
      setDeclarativeAttribute(
        chart,
        'rotation',
        settings.rotation || presentation.rotation || '0 0 0'
      );
      if (settings.applyInitialScale !== false) {
        setDeclarativeAttribute(
          chart,
          'scale',
          settings.initialScale || presentation.initialScale || '1.5 1.5 1.5'
        );
      }
    }
    syncHierarchyLayerStability(chart, presentation);
    // Install/update Babia last. On a connected entity the component may
    // synchronously build during setAttribute(), so its canonical scale and
    // hierarchy-layer policy must already be in force before that first
    // generateElements call.
    setDeclarativeAttribute(
      chart,
      componentName,
      serializeDeclarativeComponentData(buildDeclarativeChartComponentData(settings))
    );
    return true;
  }

  function buildDeclarativeChartEntity(options) {
    var settings = options || {};
    var document = getDoc();
    if (!document?.createElement) {
      return null;
    }
    var chart = document.createElement('a-entity');
    setDeclarativeAttribute(chart, 'id', String(settings.entityId || 'chart'));
    return configureDeclarativeChartEntity(chart, settings) ? chart : null;
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

  // BabiaXR chart components subscribe to their data source through the
  // producer's NotiBuffer and — as of 1.3.4 — NONE of them declares `remove()`,
  // so removing the component leaves its callback registered. The next data
  // push (every refresh; in project evolution, every frame) then makes the
  // DELETED chart paint itself again on top of the new one: the leftover
  // geometry left behind by a chart switch. Unregistering with Babia's own API
  // is what its components forgot to do.
  function releaseChartComponentSubscription(chartEntity, componentName) {
    var component = chartEntity && chartEntity.components && chartEntity.components[componentName];
    if (!component) {
      return;
    }
    var buffer = component.prodComponent && component.prodComponent.notiBuffer;
    if (buffer && typeof buffer.unregister === 'function' && component.notiBufferId !== undefined) {
      try {
        buffer.unregister(component.notiBufferId);
      } catch (error) {
        console.warn('CODEXR_MAPPING_UI: could not unsubscribe ' + componentName, error);
      }
    }
    component.prodComponent = null;
    component.notiBufferId = undefined;
  }

  function releaseChartEntity(chartEntity) {
    if (!chartEntity || !chartEntity.components) {
      return;
    }
    Object.keys(chartEntity.components).forEach(function (componentName) {
      if (componentName.indexOf('babia-') === 0) {
        releaseChartComponentSubscription(chartEntity, componentName);
      }
    });
  }

  function clearChartComponents(chartEntity) {
    Object.keys(COMPONENT_BY_CHART).forEach(function (chartId) {
      var componentName = COMPONENT_BY_CHART[chartId];
      if (componentName && chartEntity.removeAttribute) {
        releaseChartComponentSubscription(chartEntity, componentName);
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

  // Second line of defence: anything hanging off the chart entity that no LIVE
  // component claims is residue from a previous chart (Babia caches its roots
  // as `chartEl`/`titleEl` on the component instance). Runs after the new chart
  // has had time to build, so a producer we could not reach cannot leave a
  // ghost chart on the table.
  function sweepOrphanChartChildren(chartEntity) {
    if (!chartEntity || !chartEntity.children || typeof chartEntity.removeChild !== 'function') {
      return 0;
    }
    var liveRoots = [];
    var unclaimableLiveComponent = false;
    Object.keys(chartEntity.components || {}).forEach(function (componentName) {
      if (componentName.indexOf('babia-') !== 0 || componentName === 'babia-queryjson') {
        return;
      }
      var component = chartEntity.components[componentName];
      var claimed = 0;
      ['chartEl', 'titleEl', 'legendEl'].forEach(function (key) {
        if (component && component[key]) {
          liveRoots.push(component[key]);
          claimed += 1;
        }
      });
      if (!claimed) {
        // babia-boats appends its figures DIRECTLY to the entity and exposes
        // no root property at all: with a component like that live, orphans
        // cannot be told apart from the chart itself. Sweeping here deleted
        // the freshly built boats and left the table empty until the next
        // data push (a mapping change) rebuilt it.
        unclaimableLiveComponent = true;
      }
    });
    if (unclaimableLiveComponent) {
      return 0;
    }
    var removed = 0;
    Array.prototype.slice.call(chartEntity.children).forEach(function (child) {
      // Never touch nodes CodeXR itself mounts inside a chart.
      if (child.getAttribute && String(child.getAttribute('data-codexr-role') || '')) {
        return;
      }
      if (liveRoots.indexOf(child) === -1) {
        chartEntity.removeChild(child);
        removed += 1;
      }
    });
    return removed;
  }

  function scheduleOrphanChartSweep(chartEntity) {
    if (!chartEntity) {
      return;
    }
    [400, 1500].forEach(function (delayMs) {
      setTimeout(function () {
        var removed = sweepOrphanChartChildren(chartEntity);
        if (removed) {
          resizeTrace('chart-orphan-children-removed', { chartId: chartEntity.id || '', removed: removed });
        }
      }, delayMs);
    });
  }

  function applyChartDefaultTransform(chartEntity, chartId) {
    if (!chartEntity || typeof chartEntity.setAttribute !== 'function') {
      return;
    }
    // Canonical orientation from the presentation profile: pie/donut lie flat
    // by construction and Babia's own demos stand them with 90 0 0.
    setDeclarativeAttribute(chartEntity, 'rotation', getChartPresentation(chartId).rotation);
  }

  // A scene generated by an older extension build can carry a chart entity
  // whose HTML predates the presentation profile: a pie/donut generated flat
  // (rotation 0 0 0) and no chart-id attribute for the fit profiles. Align
  // the ACTIVE chart with its profile at bootstrap so the runtime heals such
  // scenes without waiting for a chart switch or a re-generation.
  function syncActiveChartPresentation(config) {
    var chartId = state.activeChartId || (config && config.chartId) || null;
    if (!chartId || !COMPONENT_BY_CHART[chartId]) {
      return;
    }
    getChartEntities(config).forEach(function (chartEntity) {
      if (!chartEntity || typeof chartEntity.setAttribute !== 'function') {
        return;
      }
      if (typeof chartEntity.getAttribute === 'function'
        && !chartEntity.getAttribute('data-codexr-active-chart-id')) {
        chartEntity.setAttribute('data-codexr-active-chart-id', chartId);
      }
      applyChartDefaultTransform(chartEntity, chartId);
      syncHierarchyLayerStability(chartEntity, getChartPresentation(chartId));
    });
  }

  function applyChartTypeToEntity(chartEntity, chartId, mappingSnapshot) {
    var componentName = COMPONENT_BY_CHART[chartId];
    if (!chartEntity || !componentName || typeof chartEntity.setAttribute !== 'function') {
      return false;
    }
    var existingData = readCurrentChartData(chartEntity);
    var presentation = getChartPresentation(chartId);
    clearChartComponents(chartEntity);
    clearChartGeneratedChildren(chartEntity);
    // An explicit chart-type change starts a new Babia instance. Reset its
    // REAL object3D scale before installing the component: the DOM may still
    // say 0.01 0.05 0.01 while containment has raised object3D.scale.y. Boats
    // reads that live Y scale synchronously during its first layout.
    setDeclarativeAttribute(chartEntity, 'data-codexr-active-chart-id', chartId);
    applyChartDefaultTransform(chartEntity, chartId);
    setDeclarativeAttribute(
      chartEntity,
      'scale',
      presentation.initialScale || '1.5 1.5 1.5'
    );
    syncHierarchyLayerStability(chartEntity, presentation);
    setDeclarativeAttribute(
      chartEntity,
      componentName,
      serializeDeclarativeComponentData(
        buildRuntimeChartData(chartId, existingData, mappingSnapshot)
      )
    );
    scheduleOrphanChartSweep(chartEntity);
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
