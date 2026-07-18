// == dependencyGraphRuntime.js | datasetProjection (assembled per manifest.json; see COMPONENTS.md) ==
  function getNormalVisualizationRoots() {
    var document = doc();
    if (!document) { return []; }
    var cfg = config();
    var roots = [];
    collectConfiguredIds(cfg, [
      'normalEntityIds',
      'visualizationEntityIds',
      'chartEntityIds',
      'chartEntityId',
      'chartId'
    ]).forEach(function (id) {
      var element = document.getElementById?.(id);
      if (element) { roots.push(element); }
    });
    if (cfg?.chartSelector && typeof document.querySelector === 'function') {
      var selected = document.querySelector(cfg.chartSelector);
      if (selected) { roots.push(selected); }
    }
    document.querySelectorAll?.('[data-codexr-normal-root="true"], [data-codexr-normal-visualization="true"]')
      .forEach(function (element) { roots.push(element); });
    return uniqueElements(roots);
  }
  function parkOriginal() {
    var surface = root.CodeXRAnalysisSurfaceRuntime;
    if (surface?.setNormalVisible) {
      surface.setNormalVisible(false);
      state.originalRoots = [];
      return;
    }
    var roots = getNormalVisualizationRoots();
    if (!roots.length) { return; }
    state.originalRoots = roots;
    roots.forEach(function (element) {
      element.setAttribute?.('visible', false);
      if (element.object3D) { element.object3D.visible = false; }
    });
  }
  function restoreOriginal() {
    var surface = root.CodeXRAnalysisSurfaceRuntime;
    if (surface?.setNormalVisible && root.CodeXRAnalysisModeRuntime?.getState?.().mode === 'single') {
      surface.setNormalVisible(true);
      return;
    }
    if (!state.originalRoots.length) { return; }
    if (root.CodeXRAnalysisModeRuntime?.getState?.().mode === 'single') {
      state.originalRoots.forEach(function (element) {
        element.setAttribute?.('visible', true);
        if (element.object3D) { element.object3D.visible = true; }
      });
    }
    state.originalRoots = [];
  }
  function removeGraph() {
    refs.graph?.components?.[COMPONENT]?.disposeView?.();
    refs.graph?.remove?.();
    refs.graph = null;
  }
  function clearRenderRetries() {
    state.retryTimers.forEach(function (timer) { root.clearTimeout?.(timer); });
    state.retryTimers.clear();
  }
  function setTransitionLocked(locked, message) {
    state.transitionLocked = !!locked;
    if (message) { setStatus(message, false); }
    // The lock is a promise of a server answer; if none arrives the watchdog
    // releases it with a visible error instead of eating every later click.
    if (state.transitionLockTimer) {
      clearTimeout(state.transitionLockTimer);
      state.transitionLockTimer = null;
    }
    if (state.transitionLocked) {
      state.transitionLockTimer = setTimeout(function () {
        state.transitionLockTimer = null;
        if (state.transitionLocked) {
          state.transitionLocked = false;
          setStatus('The dependency analysis did not respond. Try again.', true);
          root.console?.warn?.('[CodeXR][DependencyGraph] dependency-graph-start received no response within 20s.');
        }
      }, 20000);
      state.transitionLockTimer?.unref?.();
    }
  }
  function disposeView() {
    state.active = false;
    state.viewGeneration += 1;
    state.datasetLoadGeneration += 1;
    clearRenderRetries();
    removeGraph();
    restoreOriginal();
    setTransitionLocked(false);
  }
  function isDependencyModeActiveOrActivating() {
    var modeState = root.CodeXRAnalysisModeRuntime?.getState?.();
    return modeState?.mode === 'dependency-graph'
      || (modeState?.transitioning && modeState?.requestedMode === 'dependency-graph');
  }

  function intensityBucket(occurrences) {
    var value = Math.max(1, Number(occurrences || 1));
    return value >= 16 ? 4 : value >= 8 ? 3 : value >= 4 ? 2 : value >= 2 ? 1 : 0;
  }

  function edgeStyle(edge, encoding, visualBudget) {
    var bucket = intensityBucket(edge?.occurrences);
    var useIntensityColor = encoding === 'intensity-color' || encoding === 'intensity-combined';
    var useIntensityWidth = encoding === 'intensity-width' || encoding === 'intensity-combined';
    var widths = visualBudget?.widths || FALLBACK_INTENSITY_WIDTHS;
    var defaultWidth = widths[1] || widths[0] || .006;
    return {
      bucket: bucket,
      color: useIntensityColor
        ? INTENSITY_COLORS[bucket]
        : (RELATION_COLORS[edge?.kind] || RELATION_COLORS.import),
      width: useIntensityWidth ? widths[bucket] : defaultWidth,
      opacity: root.CodeXRDependencyVisualBudgetRuntime?.opacityFor?.(
        visualBudget?.effectiveProfile || 'balanced',
        edge?.confidence || 'probable',
        false
      ) || FALLBACK_CONFIDENCE_OPACITY[edge?.confidence] || FALLBACK_CONFIDENCE_OPACITY.probable
    };
  }

  function graphDensityStats(dataset) {
    var nodes = Array.isArray(dataset?.nodes) ? dataset.nodes : [];
    var edges = Array.isArray(dataset?.edges) ? dataset.edges : [];
    var degree = {};
    edges.forEach(function (edge) {
      degree[edge.source] = Number(degree[edge.source] || 0) + 1;
      degree[edge.target] = Number(degree[edge.target] || 0) + 1;
    });
    return {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      maxDegree: Math.max.apply(Math, Object.values(degree).concat([0]))
    };
  }

  function setDetailOverride(nextOverride) {
    root.CodeXRDependencyVisualBudgetRuntime?.setOverride?.(nextOverride);
    refs.graph?.components?.[COMPONENT]?.refreshVisualBudget?.();
    renderControls();
  }

  function mergeConfidence(current, next) {
    var rank = { exact: 0, probable: 1, ambiguous: 2 };
    return (rank[next] || 0) > (rank[current] || 0) ? next : current;
  }

  function buildExternalSummaryDataset(dataset) {
    var source = dataset || { nodes: [], edges: [] };
    var externalIds = new Set((source.nodes || []).filter(function (node) {
      return node.external;
    }).map(function (node) { return node.id; }));
    if (!externalIds.size) { return source; }

    var internalNodes = (source.nodes || []).filter(function (node) { return !node.external; });
    var internalIds = new Set(internalNodes.map(function (node) { return node.id; }));
    var externalEdges = (source.edges || []).filter(function (edge) {
      return externalIds.has(edge.source) || externalIds.has(edge.target);
    });
    if (!externalEdges.length) {
      return Object.assign({}, source, {
        nodes: internalNodes,
        edges: (source.edges || []).filter(function (edge) {
          return internalIds.has(edge.source) && internalIds.has(edge.target);
        })
      });
    }

    var packages = {};
    (source.nodes || []).filter(function (node) { return node.external; }).forEach(function (node) {
      packages[node.id] = node.label || node.id;
    });
    var relationKinds = {};
    var edgeMap = {};
    var totalOccurrences = 0;
    externalEdges.forEach(function (edge) {
      var internalId = externalIds.has(edge.source) ? edge.target : edge.source;
      if (!internalIds.has(internalId)) { return; }
      var outgoing = !externalIds.has(edge.source);
      var sourceId = outgoing ? internalId : EXTERNAL_SUMMARY_ID;
      var targetId = outgoing ? EXTERNAL_SUMMARY_ID : internalId;
      var key = sourceId + '|' + targetId + '|' + edge.kind;
      var occurrences = Math.max(1, Number(edge.occurrences || 1));
      relationKinds[edge.kind] = Number(relationKinds[edge.kind] || 0) + occurrences;
      totalOccurrences += occurrences;
      if (!edgeMap[key]) {
        edgeMap[key] = Object.assign({}, edge, {
          id: 'external-summary-edge:' + key,
          source: sourceId,
          target: targetId,
          occurrences: 0,
          confidence: edge.confidence || 'probable',
          syntheticExternal: true
        });
      }
      edgeMap[key].occurrences += occurrences;
      edgeMap[key].confidence = mergeConfidence(edgeMap[key].confidence, edge.confidence || 'probable');
    });

    var packageCounts = {};
    externalEdges.forEach(function (edge) {
      var externalId = externalIds.has(edge.source) ? edge.source : edge.target;
      var label = packages[externalId] || externalId;
      packageCounts[label] = Number(packageCounts[label] || 0) + Number(edge.occurrences || 1);
    });
    var topPackages = Object.keys(packageCounts).sort(function (a, b) {
      return packageCounts[b] - packageCounts[a] || a.localeCompare(b);
    }).slice(0, 3);
    var summaryNode = {
      id: EXTERNAL_SUMMARY_ID,
      kind: 'external-summary',
      label: 'External dependencies',
      external: true,
      syntheticExternal: true,
      metrics: {
        totalLines: 0,
        fanIn: 0,
        fanOut: 0,
        degree: externalEdges.length,
        dependentCount: 0,
        cycleSize: 0,
        relationCount: totalOccurrences
      },
      summary: {
        packageCount: externalIds.size,
        relationCount: totalOccurrences,
        topPackages: topPackages,
        relationKinds: relationKinds
      }
    };
    var internalEdges = (source.edges || []).filter(function (edge) {
      return internalIds.has(edge.source) && internalIds.has(edge.target);
    });
    return Object.assign({}, source, {
      nodes: internalNodes.concat([summaryNode]),
      edges: internalEdges.concat(Object.values(edgeMap))
    });
  }

  function normalizeRelativePath(value) {
    return String(value || '').replace(/\\/g, '/').replace(/^\.\/+/, '')
      .replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
  }
  function directoryName(value) {
    var normalized = normalizeRelativePath(value);
    var index = normalized.lastIndexOf('/');
    return index < 0 ? '' : normalized.slice(0, index);
  }
  function baseName(value) {
    var normalized = normalizeRelativePath(value);
    var index = normalized.lastIndexOf('/');
    return index < 0 ? normalized : normalized.slice(index + 1);
  }
  function createAggregateNode(id, label, navigationPath, syntheticKind) {
    return {
      id: id, kind: 'group', label: label, relativePath: navigationPath,
      navigationPath: navigationPath, syntheticKind: syntheticKind,
      external: false,
      metrics: {
        totalLines: 0, fanIn: 0, fanOut: 0, degree: 0,
        dependentCount: 0, cycleSize: 0, relationCount: 0
      }
    };
  }
  function addNodeMetrics(target, source) {
    Object.keys(target.metrics || {}).forEach(function (metric) {
      target.metrics[metric] += Number(source?.metrics?.[metric] || 0);
    });
  }
  function aggregateProjectedEdges(edges, membership, visibleIds) {
    var edgeMap = {};
    (edges || []).forEach(function (edge) {
      var source = membership[edge.source] || edge.source;
      var target = membership[edge.target] || edge.target;
      if (!visibleIds.has(source) || !visibleIds.has(target) || source === target) { return; }
      var key = source + '|' + target + '|' + edge.kind;
      if (!edgeMap[key]) {
        edgeMap[key] = Object.assign({}, edge, {
          id: 'scope-edge:' + key, source: source, target: target, occurrences: 0
        });
      }
      edgeMap[key].occurrences += Math.max(1, Number(edge.occurrences || 1));
      edgeMap[key].confidence = mergeConfidence(
        edgeMap[key].confidence || 'exact', edge.confidence || 'probable'
      );
    });
    return Object.values(edgeMap);
  }
  function projectDirectoryScope(dataset, scopePath) {
    var current = normalizeRelativePath(scopePath);
    var prefix = current ? current + '/' : '';
    var parentPath = directoryName(current);
    var parentId = 'scope:parent:' + (current || 'root');
    var nodes = [];
    var membership = {};
    var aggregates = {};
    if (current) {
      aggregates[parentId] = createAggregateNode(parentId, '..', parentPath, 'parent');
      nodes.push(aggregates[parentId]);
    }
    (dataset.nodes || []).filter(function (node) {
      return !node.external && node.kind === 'file';
    }).forEach(function (node) {
      var relative = normalizeRelativePath(node.relativePath || node.label);
      var directParent = directoryName(relative);
      if (directParent === current) {
        membership[node.id] = node.id;
        nodes.push(Object.assign({}, node));
        return;
      }
      if (relative.indexOf(prefix) === 0) {
        var remainder = relative.slice(prefix.length);
        if (remainder.indexOf('/') >= 0) {
          var childName = remainder.split('/')[0];
          var childPath = prefix + childName;
          var childId = 'scope:directory:' + childPath;
          if (!aggregates[childId]) {
            aggregates[childId] = createAggregateNode(childId, childName, childPath, 'directory');
            nodes.push(aggregates[childId]);
          }
          membership[node.id] = childId;
          addNodeMetrics(aggregates[childId], node);
          return;
        }
      }
      if (current) {
        membership[node.id] = parentId;
        addNodeMetrics(aggregates[parentId], node);
      }
    });
    (dataset.nodes || []).filter(function (node) { return node.external; }).forEach(function (node) {
      membership[node.id] = node.id;
      nodes.push(Object.assign({}, node));
    });
    var visibleIds = new Set(nodes.map(function (node) { return node.id; }));
    return Object.assign({}, dataset, {
      nodes: nodes,
      edges: aggregateProjectedEdges(dataset.edges, membership, visibleIds),
      scopeLabel: current || '(project root)'
    });
  }
  function projectFileScope(dataset) {
    var internalSummaryId = 'codexr:internal-files-summary';
    var symbols = (dataset.nodes || []).filter(function (node) {
      return node.kind === 'symbol';
    }).map(function (node) { return Object.assign({}, node); });
    var otherFiles = (dataset.nodes || []).filter(function (node) {
      return !node.external && node.kind === 'file';
    });
    var nodes = symbols.slice();
    var membership = {};
    symbols.forEach(function (node) { membership[node.id] = node.id; });
    if (otherFiles.length) {
      var summary = createAggregateNode(
        internalSummaryId, 'Other project files', '', 'internal-files'
      );
      otherFiles.forEach(function (node) {
        membership[node.id] = internalSummaryId;
        addNodeMetrics(summary, node);
      });
      nodes.push(summary);
    }
    (dataset.nodes || []).filter(function (node) { return node.external; }).forEach(function (node) {
      membership[node.id] = node.id;
      nodes.push(Object.assign({}, node));
    });
    var visibleIds = new Set(nodes.map(function (node) { return node.id; }));
    return Object.assign({}, dataset, {
      nodes: nodes,
      edges: aggregateProjectedEdges(dataset.edges, membership, visibleIds),
      scopeLabel: dataset.targetRelativePath || 'File dependencies'
    });
  }
  function filteredDataset() {
    if (!state.snapshot) { return { nodes: [], edges: [] }; }
    var scope = state.snapshot.scope || { kind: 'directory', relativePath: '' };
    var pathKey = normalizeRelativePath(scope.relativePath);
    var selected = scope.kind === 'file'
      ? state.fileDatasets[pathKey] || (state.dataset?.targetType === 'file' ? state.dataset : null)
      : state.projectDataset || (state.dataset?.targetType === 'directory' ? state.dataset : null);
    if (!selected) { return { nodes: [], edges: [] }; }
    var projected = scope.kind === 'file'
      ? projectFileScope(selected)
      : projectDirectoryScope(selected, scope.relativePath);
    var source = state.snapshot.showExternal ? projected : buildExternalSummaryDataset(projected);
    var nodes = (source.nodes || []).filter(function (node) {
      return state.snapshot.showExternal || !node.external || node.syntheticExternal;
    });
    var ids = new Set(nodes.map(function (node) { return node.id; }));
    var edges = (source.edges || []).filter(function (edge) {
      return ids.has(edge.source) && ids.has(edge.target)
        && state.snapshot.relationFilters?.[edge.kind] !== false;
    });
    return { nodes: nodes, edges: edges, scopeLabel: projected.scopeLabel };
  }

  function publishState(patch) {
    if (!state.snapshot || state.transitionLocked) { return; }
    state.snapshot = Object.assign({}, state.snapshot, patch || {});
    client()?.sendMessage?.('dependency-graph-settings', {
      layout: state.snapshot.layout,
      showExternal: state.snapshot.showExternal,
      edgeEncoding: state.snapshot.edgeEncoding || 'relation-type',
      relationFilters: state.snapshot.relationFilters,
      mapping: state.snapshot.mapping,
      scope: state.snapshot.scope
    });
    renderControls();
    renderGraph();
  }
