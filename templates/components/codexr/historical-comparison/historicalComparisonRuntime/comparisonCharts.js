// == historicalComparisonRuntime.js | comparisonCharts (assembled per manifest.json; see COMPONENTS.md) ==
  function getChartComponentName(chart) {
    if (!chart) {
      return '';
    }
    // The chart-id marker is the authoritative statement of which chart the
    // entity carries. Scanning the component list first picked by DECLARATION
    // ORDER, so an entity still holding a leftover component could be read as
    // the wrong chart — and then cloned with the wrong orientation.
    var markedChartId = String(chart.getAttribute?.('data-codexr-active-chart-id') || '');
    if (markedChartId) {
      var markedComponent = CHART_COMPONENT_NAMES.find(function (name) {
        return CHART_ID_BY_COMPONENT[name] === markedChartId && chart.hasAttribute?.(name);
      });
      if (markedComponent) {
        return markedComponent;
      }
    }
    return CHART_COMPONENT_NAMES.find(function (name) {
      return chart.hasAttribute?.(name);
    }) || chart.getAttributeNames().find(function (name) {
      return name.indexOf('babia-') === 0
        && name !== 'babia-queryjson'
        && name !== 'babia-treebuilder';
    }) || '';
  }

  function isHierarchicalBoatsComponent(componentName) {
    return componentName === 'babia-boats';
  }

  // Orientation comes from the canonical presentation profile of the chart the
  // clone actually carries — never inherited from the original entity, which
  // may still be wearing a previous chart's rotation.
  function getChartRotationForComponent(componentName) {
    var chartId = CHART_ID_BY_COMPONENT[componentName] || '';
    var presentation = chartId
      ? root.CodeXRMappingUiRuntime?.getChartPresentation?.(chartId)
      : null;
    return (presentation && presentation.rotation) || '0 0 0';
  }

  // Shared boats tree contract (generator-injected via the mapping runtime):
  // directory quarters split the full analyzed path (filePath — both sides
  // rebuild it against the ORIGINAL target, so working copy and materialized
  // commit paint identical quarters), file mode the synthetic treePath.
  function comparisonTreeField(targetType) {
    var treeFields = root.CodeXRMappingUiRuntime?.getChartBaseConfig?.()?.treeFields;
    if (targetType === 'directory') {
      return treeFields?.directory || 'filePath';
    }
    return treeFields?.file || 'treePath';
  }

  function createDataSource(id, url) {
    return createEntity('a-entity', {
      id: id,
      'babia-queryjson': 'url: ' + url
    });
  }

  function setDeclarativeBabiaComponent(entity, componentName, componentData) {
    var mappingRuntime = root.CodeXRMappingUiRuntime;
    if (
      mappingRuntime
      && typeof mappingRuntime.setDeclarativeAttribute === 'function'
      && typeof mappingRuntime.serializeDeclarativeComponentData === 'function'
    ) {
      mappingRuntime.setDeclarativeAttribute(
        entity,
        componentName,
        mappingRuntime.serializeDeclarativeComponentData(componentData)
      );
      return true;
    }
    entity.setAttribute(componentName, componentData);
    return true;
  }

  function serializeInlineBabiaData(payload) {
    // A-Frame component strings use semicolons as property separators. Keep
    // user-controlled names/paths lossless inside inline JSON by encoding the
    // character before the shared component serializer sees it; JSON.parse
    // restores it transparently for Babia.
    return JSON.stringify(payload).replace(/;/g, '\\u003b');
  }

  function vectorToPositionAttribute(position) {
    var source = position || {};
    return [
      Number.isFinite(source.x) ? source.x : 0,
      Number.isFinite(source.y) ? source.y : 1,
      Number.isFinite(source.z) ? source.z : -18
    ].join(' ');
  }

  function getHistoricalContainmentProfile(zone) {
    var profileId = zone && zone.id === 'right' ? 'historical-right' : 'historical-left';
    var profile = root.CodeXRAnalysisTableRuntime?.getContainmentProfile?.(profileId);
    if (!profile) {
      profile = {
        id: profileId,
        position: { x: zone.anchorX, y: 1, z: zone.anchorZ },
        containment: {
          enabled: true,
          anchorX: zone.anchorX,
          anchorY: 1,
          anchorZ: zone.anchorZ,
          targetWidth: zone.width,
          targetHeight: 1.8,
          targetDepth: zone.depth,
          bootstrapPlanarMaxRatio: 0.84,
          minPlanarOccupancyRatio: 0.78,
          maxPlanarOccupancyRatio: 0.92,
          heightBandMinRatio: 0.34,
          heightBandMaxRatio: 0.68,
          tableTopPadding: 0.14,
          tableEdgeMargin: 0.12,
          yScaleMin: 0.01,
          yScaleMax: 12,
          containmentToleranceRatio: 0.018,
          periodicContainmentEnabled: true,
          transformTransitionMs: 650,
          hardHeightGuardEnabled: true
        }
      };
    }
    return profile;
  }

  function createChartFromTemplate(original, id, sourceId, zone, targetType, options) {
    var clone = createEntity('a-entity');
    var componentName = getChartComponentName(original);
    original.getAttributeNames().forEach(function (attributeName) {
      if (
        attributeName === 'id'
        || attributeName === 'visible'
        || attributeName === 'position'
        || attributeName === 'scale'
        // Orientation and the chart marker are derived below from the chart
        // this clone actually carries, not copied from an entity that may be
        // wearing a previous chart's rotation.
        || attributeName === 'rotation'
        || attributeName === 'data-codexr-active-chart-id'
        || attributeName === 'codexr-chart-containment'
        || CHART_COMPONENT_NAMES.indexOf(attributeName) !== -1
      ) {
        return;
      }
      clone.setAttribute(attributeName, original.getAttribute(attributeName));
    });
    clone.setAttribute('id', id);
    clone.setAttribute('rotation', getChartRotationForComponent(componentName));
    if (CHART_ID_BY_COMPONENT[componentName]) {
      clone.setAttribute('data-codexr-active-chart-id', CHART_ID_BY_COMPONENT[componentName]);
    }
    if (componentName) {
      var chartData = Object.assign({}, original.getAttribute(componentName) || {});
      if (options?.inlineData) {
        delete chartData.from;
        chartData.data = serializeInlineBabiaData(options.inlineData);
        chartData.field = 'uid';
      } else {
        delete chartData.data;
        chartData.from = sourceId;
      }
      setDeclarativeBabiaComponent(clone, componentName, chartData);
    }
    var containmentProfile = getHistoricalContainmentProfile(zone);
    clone.setAttribute('scale', '0.01 0.05 0.01');
    if (root.CodeXRAnalysisTableRuntime.applyContainmentProfile) {
      root.CodeXRAnalysisTableRuntime.applyContainmentProfile(clone, containmentProfile);
    } else {
      clone.setAttribute('position', vectorToPositionAttribute(containmentProfile.position));
      clone.setAttribute('codexr-chart-containment', containmentProfile.containment);
    }
    clone.dataset.codexrComparisonTargetType = targetType || '';
    return clone;
  }

  function normalizeComparisonPath(value) {
    return String(value || '')
      .replace(/\\/g, '/')
      .split('/')
      .filter(Boolean);
  }

  function buildComparisonBoatsTree(payload, pathField, namespace) {
    var roots = [];
    var safeNamespace = String(namespace || 'comparison').replace(/[^a-zA-Z0-9_-]/g, '-');

    normalizePayload(payload).forEach(function (entry) {
      // Payloads decorated before relativePath existed only carry filePath.
      var parts = normalizeComparisonPath(entry?.[pathField] || entry?.filePath);
      if (!parts.length) {
        return;
      }

      var siblings = roots;
      var accumulated = [];
      parts.forEach(function (part, index) {
        accumulated.push(part);
        var isLeaf = index === parts.length - 1;
        var existing = siblings.find(function (candidate) {
          return candidate && candidate.name === part;
        });
        var node = existing;

        if (!node) {
          node = isLeaf ? Object.assign({}, entry) : { children: [] };
          node.name = part;
          node.uid = safeNamespace + ':' + accumulated.join('/');
          siblings.push(node);
        } else if (isLeaf) {
          Object.assign(node, entry);
          node.name = part;
          node.uid = safeNamespace + ':' + accumulated.join('/');
        }

        if (!isLeaf) {
          if (!Array.isArray(node.children)) {
            node.children = [];
          }
          siblings = node.children;
        }
      });
    });

    return roots;
  }

  // Side nameplates are shared Git chrome (see codexrGitRefPickerRuntime): a
  // lectern-style plate on the table edge closest to the user. Project
  // evolution labels its current frame with the very same plate.
  function buildSideNameplateText(source) {
    return root.CodeXRGitRefPickerRuntime.buildSourceNameplateText(source);
  }

  function createSideNameplate(source, zone, color) {
    return root.CodeXRGitRefPickerRuntime.createSourceNameplate(source, zone, color);
  }

  async function renderComparison(result, leftPayload, rightPayload) {
    disposeComparisonGeometry(false);
    var config = getConfig();
    var scene = getDocument()?.querySelector('a-scene');
    var original = getTemplateChart(config);
    if (!scene || !original) {
      throw new Error('The original XR chart is not available.');
    }
    state.payloads = {
      left: normalizePayload(leftPayload),
      right: normalizePayload(rightPayload)
    };
    refs.comparisonRoot = createEntity('a-entity', {
      id: 'codexrHistoricalComparisonRoot',
      'data-codexr-analysis-root': 'true',
      'data-codexr-analysis-mode': 'historical-compare',
      // Preserved: leaving the mode hides this root (surface preserve pass)
      // instead of removing it, so returning restores the comparison as left
      // without a rebuild — same save/restore pattern as the single mode.
      'data-codexr-preserve': 'true'
    });
    if (root.CodeXRAnalysisSurfaceRuntime?.mountRoot) {
      root.CodeXRAnalysisSurfaceRuntime.mountRoot('historical-compare', refs.comparisonRoot);
    } else {
      scene.appendChild(refs.comparisonRoot);
    }
    var chartComponent = getChartComponentName(original);
    var leftFrom = 'codexrComparisonDataLeft';
    var rightFrom = 'codexrComparisonDataRight';
    var boatsPathField = comparisonTreeField(config?.targetType);
    var leftChartOptions = null;
    var rightChartOptions = null;
    if (isHierarchicalBoatsComponent(chartComponent)) {
      leftFrom = '';
      rightFrom = '';
      leftChartOptions = {
        inlineData: buildComparisonBoatsTree(state.payloads.left, boatsPathField, 'codexr-left')
      };
      rightChartOptions = {
        inlineData: buildComparisonBoatsTree(state.payloads.right, boatsPathField, 'codexr-right')
      };
    } else {
      var leftData = createDataSource('codexrComparisonDataLeft', result.left.url + '?revision=' + result.revision);
      var rightData = createDataSource('codexrComparisonDataRight', result.right.url + '?revision=' + result.revision);
      refs.comparisonRoot.appendChild(leftData);
      refs.comparisonRoot.appendChild(rightData);
    }

    await nextFrame();
    var zones = root.CodeXRAnalysisTableRuntime?.getAnalysisTableZones?.('historical-compare') || [
      { id: 'left', anchorX: -1.45, anchorZ: -18, width: 2.7, depth: 3.218 },
      { id: 'right', anchorX: 1.45, anchorZ: -18, width: 2.7, depth: 3.218 }
    ];
    var activeChartIds = [];
    if (result.left.itemCount > 0) {
      var leftChart = createChartFromTemplate(
        original,
        'codexrComparisonChartLeft',
        leftFrom,
        zones[0],
        config?.targetType,
        leftChartOptions
      );
      refs.comparisonRoot.appendChild(leftChart);
      activeChartIds.push(leftChart.id);
    } else {
      refs.comparisonRoot.appendChild(createEmptyState(result.left, zones[0], '#67e8f9'));
    }
    if (result.right.itemCount > 0) {
      var rightChart = createChartFromTemplate(
        original,
        'codexrComparisonChartRight',
        rightFrom,
        zones[1],
        config?.targetType,
        rightChartOptions
      );
      refs.comparisonRoot.appendChild(rightChart);
      activeChartIds.push(rightChart.id);
    } else {
      refs.comparisonRoot.appendChild(createEmptyState(result.right, zones[1], '#6ee7b7'));
    }
    // Side nameplates on the table edge; the delta/metric comparison now lives
    // in the Field Mapping companion table (no floating text over the table).
    refs.leftLabel = createSideNameplate(result.left.source, zones[0], '#67e8f9');
    refs.rightLabel = createSideNameplate(result.right.source, zones[1], '#6ee7b7');
    updateMappingCompanion();
    refs.comparisonRoot.appendChild(refs.leftLabel);
    refs.comparisonRoot.appendChild(refs.rightLabel);

    await nextFrame();
    refs.comparisonChartIds = activeChartIds.slice();
    root.CodeXRMappingUiRuntime?.setChartEntityIds?.(
      activeChartIds,
      { renormalize: false }
    );
    root.CodeXRMappingUiRuntime.switchMappingContext?.('historical-comparison', {
      reason: 'historical-comparison-ready'
    });
    parkOriginalChart(original);
    // Targeted: only the two comparison charts. renormalizeAll would also
    // re-fit charts belonging to other modes (the parked normal one), leaving
    // them re-measuring for no reason.
    root.CodeXRAnalysisTableRuntime?.renormalizeCharts?.(activeChartIds, 'historical-comparison-ready');
    if (activeChartIds.length) {
      var stabilization = await root.CodeXRAnalysisTableRuntime?.waitForChartsStable?.(activeChartIds, {
        timeoutMs: 12000,
        pollMs: 140,
        stablePasses: 2
      });
      if (stabilization && !stabilization.valid) {
        throw new Error('One side of the historical comparison could not build a valid chart.');
      }
    }
    refs.renderedRevision = result.revision;
  }

  // Fast path for re-entering the mode with the comparison still mounted
  // (hidden by the surface preserve pass on leave): re-park the normal charts,
  // re-show the preserved root and re-point the mapping controller at the
  // comparison — no geometry rebuild, the scene comes back exactly as left.
  function restoreComparisonScene() {
    var config = getConfig();
    var original = getTemplateChart(config);
    parkOriginalChart(original);
    if (root.CodeXRAnalysisSurfaceRuntime?.mountRoot) {
      root.CodeXRAnalysisSurfaceRuntime.mountRoot('historical-compare', refs.comparisonRoot);
    }
    var chartIds = Array.isArray(refs.comparisonChartIds) ? refs.comparisonChartIds : [];
    if (chartIds.length) {
      root.CodeXRMappingUiRuntime?.setChartEntityIds?.(
        chartIds,
        { renormalize: false }
      );
    }
    root.CodeXRMappingUiRuntime?.switchMappingContext?.('historical-comparison', {
      reason: 'historical-comparison-restored'
    });
    // The charts were hidden, so any re-fit request made meanwhile was deferred.
    // Honour it now that they are visible again: a no-op when nothing changed
    // (the fit they already have is still valid), a real re-fit if it did.
    if (chartIds.length) {
      root.CodeXRAnalysisTableRuntime?.renormalizeCharts?.(chartIds, 'historical-comparison-restored');
    }
  }

  function createEmptyState(dataset, zone, color) {
    var empty = createEntity('a-plane', {
      position: zone.anchorX + ' 1.55 ' + zone.anchorZ,
      width: Math.max(1.4, zone.width - 0.3),
      height: 1.25,
      material: 'color: #172033; opacity: 0.92; shader: flat'
    });
    empty.appendChild(createText(
      dataset.missingTarget
        ? 'Target not present in this revision'
        : 'This analysis produced no elements',
      '0 0 0.03',
      3.3,
      color,
      'center',
      34
    ));
    return empty;
  }
