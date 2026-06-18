(function registerCodeXRDependencyGraphRuntime(root) {
  'use strict';

  var AFRAME = root.AFRAME;
  var COMPONENT = 'codexr-dependency-graph';
  var ENTITY_KIND = 'dependency-graph';
  var ENTITY_ID = 'main';
  var RAYCAST_CLASS = 'babiaxraycasterclass';
  var GRAPH_WIDTH = 4.7;
  var GRAPH_DEPTH = 2.35;
  var GRAPH_BASE_Y = 0.12;
  var GRAPH_HEIGHT = 1.05;
  var AXIS_TICK_COUNT = 10;
  var EXTERNAL_SUMMARY_ID = 'codexr:external-summary';
  var EDGE_ENCODINGS = ['relation-type', 'intensity-color', 'intensity-width', 'intensity-combined'];
  var INTENSITY_COLORS = ['#67e8f9', '#38bdf8', '#818cf8', '#f59e0b', '#f97316'];
  var FALLBACK_INTENSITY_WIDTHS = [.006, .009, .013, .018, .024];
  var FALLBACK_CONFIDENCE_OPACITY = { exact: .78, probable: .52, ambiguous: .28 };
  var RELATIONS = ['import', 'include', 'require', 'inheritance', 'implementation', 'call', 'contains'];
  var RELATION_HELP = {
    import: 'Imports: module dependencies declared with import or equivalent syntax.',
    include: 'Includes: source or header files included during compilation or preprocessing.',
    require: 'Requires: modules or packages loaded with require-style syntax.',
    inheritance: 'Inheritance: classes or types that extend another type.',
    implementation: 'Implementation: classes or types implementing interfaces or traits.',
    call: 'Calls: detectable function or method calls; some languages are best-effort.',
    contains: 'Contains: a module or type owns the connected symbol.'
  };
  var COLORS = {
    Python: '#3776ab', Ruby: '#cc342d', Java: '#e76f00', C: '#659ad2',
    'C++': '#00599c', 'C#': '#9b4f96', JavaScript: '#f7df1e',
    TypeScript: '#3178c6', Go: '#00add8', PHP: '#777bb4',
    Swift: '#f05138', Kotlin: '#7f52ff', external: '#94a3b8',
    directory: '#22d3ee', parent: '#f59e0b', symbol: '#a78bfa'
  };
  var RELATION_COLORS = {
    import: '#67e8f9', include: '#22d3ee', require: '#60a5fa',
    inheritance: '#e879f9', implementation: '#c084fc', call: '#f59e0b',
    contains: '#a3e635'
  };
  var state = {
    initialized: false,
    availability: 'loading',
    unavailableReason: '',
    snapshot: null,
    dataset: null,
    projectDataset: null,
    fileDatasets: {},
    originalRoots: [],
    unregisterMode: null,
    unregisterPanel: null,
    unregisterLifecycle: null,
    disposables: [],
    datasetLoadGeneration: 0,
    viewGeneration: 0,
    active: false,
    transitionLocked: false,
    retryTimers: new Set()
  };
  var refs = {};

  function doc() { return root.document; }
  function client() { return root.CodeXRCollaborationRuntime?.getClient?.(root) || null; }
  function config() {
    var script = doc()?.getElementById('codexr-tooling-config-xr-mapping-ui');
    try { return JSON.parse(script?.textContent || '{}'); } catch { return {}; }
  }
  function entity(tag, attributes) {
    var el = doc().createElement(tag);
    Object.keys(attributes || {}).forEach(function (key) { el.setAttribute(key, attributes[key]); });
    return el;
  }
  function text(value, position, width, color, align) {
    return entity('a-text', {
      value: value || '', position: position || '0 0 0.02', width: width || 5,
      color: color || '#fff', align: align || 'center', baseline: 'center',
      'wrap-count': 42
    });
  }
  function button(label, position, width, onClick, color) {
    var el = entity('a-plane', {
      position: position, width: width || 1.5, height: 0.38,
      material: 'color: ' + (color || '#4c1d95') + '; opacity: 0.96; shader: flat',
      class: onClick ? RAYCAST_CLASS : '', 'data-codexr-interactive': onClick ? 'true' : 'false'
    });
    el.appendChild(text(label, '0 0 0.02', Math.max(2, (width || 1.5) * 1.7)));
    if (onClick) { el.addEventListener('click', onClick); }
    return el;
  }
  function attachHelp(el, message) {
    if (!message) { return el; }
    el.setAttribute('data-codexr-help', message);
    el.addEventListener('mouseenter', function () { setStatus(message, false); });
    el.addEventListener('mouseleave', function () {
      setStatus(state.snapshot?.status === 'ready' ? '' : (state.snapshot?.message || ''), false);
    });
    return el;
  }
  function cycleButton(label, position, width, onPrevious, onNext, color, help) {
    var rootEl = entity('a-entity', { position: position });
    var segmentWidth = 0.46;
    var centerWidth = Math.max(0.5, width - (segmentWidth * 2));
    var background = entity('a-plane', {
      width: width, height: 0.38,
      material: 'color: ' + (color || '#4c1d95') + '; opacity: 0.96; shader: flat'
    });
    var left = entity('a-plane', {
      position: (-width / 2 + segmentWidth / 2) + ' 0 0.012',
      width: segmentWidth, height: 0.38,
      material: 'color: ' + (color || '#4c1d95') + '; opacity: 0.001; shader: flat',
      class: RAYCAST_CLASS, 'data-codexr-interactive': 'true'
    });
    var center = entity('a-plane', {
      position: '0 0 0.012', width: centerWidth, height: 0.38,
      material: 'color: ' + (color || '#4c1d95') + '; opacity: 0.001; shader: flat',
      class: RAYCAST_CLASS, 'data-codexr-interactive': 'true'
    });
    var right = entity('a-plane', {
      position: (width / 2 - segmentWidth / 2) + ' 0 0.012',
      width: segmentWidth, height: 0.38,
      material: 'color: ' + (color || '#4c1d95') + '; opacity: 0.001; shader: flat',
      class: RAYCAST_CLASS, 'data-codexr-interactive': 'true'
    });
    left.appendChild(text('<', '0 0 0.012', 1.1));
    center.appendChild(text(label, '0 0 0.012', Math.max(2, centerWidth * 1.7)));
    right.appendChild(text('>', '0 0 0.012', 1.1));
    left.addEventListener('click', onPrevious);
    center.addEventListener('click', onNext);
    right.addEventListener('click', onNext);
    [left, center, right].forEach(function (part) { attachHelp(part, help); });
    rootEl.appendChild(background);
    rootEl.appendChild(left);
    rootEl.appendChild(center);
    rootEl.appendChild(right);
    return rootEl;
  }
  function setStatus(message, error) {
    if (!refs.status) { return; }
    refs.status.setAttribute('value', message || '');
    refs.status.setAttribute('color', error ? '#fca5a5' : '#fde68a');
    refs.status.setAttribute('visible', !!message);
  }
  function collectConfiguredIds(cfg, keys) {
    var ids = [];
    keys.forEach(function (key) {
      var value = cfg?.[key];
      if (Array.isArray(value)) {
        value.forEach(function (id) { if (id) { ids.push(String(id)); } });
      } else if (value) {
        ids.push(String(value));
      }
    });
    return ids;
  }
  function uniqueElements(elements) {
    return elements.filter(function (element, index) {
      return !!element && elements.indexOf(element) === index;
    });
  }
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

  function openDirectory(relativePath) {
    publishState({
      scope: { kind: 'directory', relativePath: normalizeRelativePath(relativePath) }
    });
  }

  function openFile(relativePath) {
    var normalized = normalizeRelativePath(relativePath);
    if (!normalized) { return; }
    if (state.fileDatasets[normalized]) {
      publishState({ scope: { kind: 'file', relativePath: normalized } });
      return;
    }
    setStatus('Loading symbols for ' + normalized + '...', false);
    client()?.sendMessage?.('dependency-file-scope-request', { relativePath: normalized });
  }

  function cycleValue(current, candidates, direction) {
    var index = candidates.indexOf(current);
    if (index < 0) { index = 0; }
    return candidates[(index + direction + candidates.length) % candidates.length];
  }

  function getMetricMaximum(nodes, metric) {
    return Math.max.apply(Math, (nodes || []).map(function (node) {
      var value = Number(node.metrics?.[metric] || 0);
      return Number.isFinite(value) ? value : 0;
    }).concat([0]));
  }

  function computeNiceScale(maximum, targetTicks) {
    var safeMaximum = Math.max(0, Number(maximum) || 0);
    if (safeMaximum === 0) {
      return { maximum: 1, step: 1, ticks: [0, 1] };
    }
    var roughStep = safeMaximum / Math.max(1, Number(targetTicks) || AXIS_TICK_COUNT);
    var magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
    var normalized = roughStep / magnitude;
    var niceFactor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    var step = niceFactor * magnitude;
    var scaleMaximum = Math.ceil(safeMaximum / step) * step;
    var ticks = [];
    for (var value = 0; value <= scaleMaximum + step * .001; value += step) {
      ticks.push(Number(value.toFixed(10)));
    }
    return { maximum: scaleMaximum, step: step, ticks: ticks };
  }

  function formatAxisValue(value) {
    var numeric = Number(value || 0);
    if (Math.abs(numeric) >= 1000000) { return (numeric / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'; }
    if (Math.abs(numeric) >= 1000) { return (numeric / 1000).toFixed(1).replace(/\.0$/, '') + 'k'; }
    if (Math.abs(numeric) >= 10 || Number.isInteger(numeric)) { return String(Math.round(numeric)); }
    return numeric.toFixed(1).replace(/\.0$/, '');
  }

  function buildMetricScales(nodes, mapping) {
    return {
      x: computeNiceScale(getMetricMaximum(nodes, mapping?.x || 'fanOut'), AXIS_TICK_COUNT),
      z: computeNiceScale(getMetricMaximum(nodes, mapping?.z || 'fanIn'), AXIS_TICK_COUNT),
      y: computeNiceScale(getMetricMaximum(nodes, mapping?.height || 'fanIn'), 5)
    };
  }

  function symbolVisual(node, layout) {
    var kind = node?.symbolKind;
    var colors = {
      module: '#14b8a6', function: '#38bdf8', method: '#22d3ee',
      class: '#f472b6', interface: '#c084fc', trait: '#a78bfa',
      struct: '#fb923c', record: '#fbbf24', enum: '#a3e635'
    };
    var shapes = {
      module: 'polyhedron', function: 'sphere', method: 'cylinder',
      class: 'pyramid', interface: 'diamond', trait: 'diamond',
      struct: 'box', record: 'box', enum: 'short-cylinder'
    };
    if (kind) {
      return { color: colors[kind] || COLORS.symbol, shape: shapes[kind] || 'sphere' };
    }
    if (node?.syntheticKind === 'parent') { return { color: COLORS.parent, shape: 'portal' }; }
    if (node?.syntheticKind === 'directory') { return { color: COLORS.directory, shape: 'box' }; }
    if (node?.syntheticKind === 'internal-files') { return { color: '#34d399', shape: 'portal' }; }
    if (node?.syntheticExternal) {
      return { color: '#fb923c', shape: layout === 'force-3d' ? 'sphere' : 'portal' };
    }
    return null;
  }

  function nodeGeometry(shape, radius) {
    var diameter = radius * 1.7;
    if (shape === 'box') {
      return 'primitive: box; width: ' + diameter + '; height: ' + diameter + '; depth: ' + diameter;
    }
    if (shape === 'portal') {
      return 'primitive: box; width: ' + (radius * 2.8) + '; height: ' + (radius * 1.8)
        + '; depth: ' + (radius * .6);
    }
    if (shape === 'cylinder') {
      return 'primitive: cylinder; radius: ' + (radius * .72) + '; height: ' + (radius * 2.1)
        + '; segmentsRadial: 16';
    }
    if (shape === 'short-cylinder') {
      return 'primitive: cylinder; radius: ' + radius + '; height: ' + (radius * .75)
        + '; segmentsRadial: 12';
    }
    if (shape === 'pyramid') {
      return 'primitive: cone; radiusBottom: ' + radius + '; radiusTop: 0; height: '
        + (radius * 2.2) + '; segmentsRadial: 4';
    }
    if (shape === 'diamond') {
      return 'primitive: octahedron; radius: ' + radius;
    }
    if (shape === 'polyhedron') {
      return 'primitive: dodecahedron; radius: ' + radius;
    }
    return 'primitive: sphere; radius: ' + radius + '; segmentsWidth: 18; segmentsHeight: 12';
  }

  function nodeDetailModel(node) {
    var metrics = node?.metrics || {};
    if (node?.syntheticExternal) {
      var summary = node.summary || {};
      var kinds = Object.keys(summary.relationKinds || {}).map(function (kind) {
        return kind + ' ' + summary.relationKinds[kind];
      }).join('   ');
      return {
        title: 'External dependencies',
        subtitle: Number(summary.packageCount || 0) + ' hidden packages',
        primary: 'Relations ' + Number(summary.relationCount || 0)
          + (summary.topPackages?.length ? '   Top: ' + summary.topPackages.join(', ') : ''),
        secondary: kinds || 'No external relation details'
      };
    }
    return {
      title: node?.label || node?.id || 'Unknown node',
      subtitle: node?.symbolKind
        ? String(node.symbolKind).toUpperCase() + (node.lineStart ? '   Line ' + node.lineStart : '')
        : node?.syntheticKind === 'parent'
          ? 'Parent directory'
          : node?.syntheticKind === 'directory'
            ? 'Directory'
            : node?.relativePath || (node?.external ? 'External dependency' : (node?.language || node?.kind || 'Node')),
      primary: 'Fan-in ' + Number(metrics.fanIn || 0)
        + '   Fan-out ' + Number(metrics.fanOut || 0)
        + '   Degree ' + Number(metrics.degree || 0),
      secondary: 'Relations ' + Number(metrics.relationCount || 0)
        + '   Cycle ' + Number(metrics.cycleSize || 0)
        + '   Lines ' + Number(metrics.totalLines || 0)
    };
  }

  function edgeDetailModel(edge, nodes) {
    return {
      title: String(edge?.kind || 'relation').toUpperCase(),
      subtitle: (nodes[edge?.source]?.data?.label || edge?.source || 'Unknown')
        + '  ->  ' + (nodes[edge?.target]?.data?.label || edge?.target || 'Unknown'),
      primary: 'Confidence: ' + String(edge?.confidence || 'unknown'),
      secondary: 'Occurrences: ' + Number(edge?.occurrences || 1)
    };
  }

  function truncateText(value, maximumLength) {
    var normalized = String(value || '').replace(/\s+/g, ' ').trim();
    return normalized.length > maximumLength
      ? normalized.slice(0, Math.max(1, maximumLength - 3)) + '...'
      : normalized;
  }

  function renderControls() {
    if (!refs.controls) { return; }
    while (refs.controls.firstChild) { refs.controls.removeChild(refs.controls.firstChild); }
    refs.controls.appendChild(text('Dependency graph', '0 2.45 0.02', 5.6, '#fcd34d'));
    if (!state.snapshot) {
      refs.controls.appendChild(text(
        state.availability === 'disabled'
          ? state.unavailableReason
          : 'Waiting for the dependency snapshot...',
        '0 0.45 0.02', 5.2, state.availability === 'disabled' ? '#fca5a5' : '#fde68a'
      ));
      refs.controls.appendChild(button(
        'Re-analyze', '0 -1.85 0.02', 1.7, reanalyze, '#b45309'
      ));
      return;
    }
    var scope = state.snapshot.scope || { kind: 'directory', relativePath: '' };
    refs.controls.appendChild(text(
      (scope.kind === 'file' ? 'File: ' : 'Folder: ')
        + (normalizeRelativePath(scope.relativePath) || '(project root)'),
      '0 2.17 0.02', 5.2, '#67e8f9'
    ));
    var layouts = ['force-3d', 'hierarchical', 'metric-space'];
    refs.controls.appendChild(cycleButton(
      'Layout: ' + state.snapshot.layout, '0 1.76 0.02', 4.9,
      function () { publishState({ layout: cycleValue(state.snapshot.layout, layouts, -1) }); },
      function () { publishState({ layout: cycleValue(state.snapshot.layout, layouts, 1) }); },
      '#6d28d9',
      'Layout controls how nodes are positioned: spatial, dependency levels or metric axes.'
    ));
    var normalizedScopePath = normalizeRelativePath(scope.relativePath);
    var parentPath = directoryName(normalizedScopePath);
    var navigationLabel = scope.kind === 'file'
      ? 'Back to: ' + (parentPath || 'root')
      : normalizedScopePath
        ? 'Up: ' + (parentPath || 'root')
        : 'Project root';
    refs.controls.appendChild(attachHelp(button(
      truncateText(navigationLabel, 26),
      '-1.55 1.28 0.02',
      2.75,
      normalizedScopePath ? function () { openDirectory(parentPath); } : null,
      normalizedScopePath ? '#0f766e' : '#475569'
    ), normalizedScopePath
      ? navigationLabel
      : 'The dependency graph is already showing the project root.'));
    refs.controls.appendChild(attachHelp(button(
      'Root',
      '0.15 1.28 0.02',
      0.55,
      normalizedScopePath ? function () { openDirectory(''); } : null,
      normalizedScopePath ? '#0369a1' : '#475569'
    ), 'Return directly to the project root.'));
    var externalValues = [false, true];
    refs.controls.appendChild(cycleButton(
      state.snapshot.showExternal ? 'External: shown' : 'External: hidden',
      '1.75 1.28 0.02', 2.05,
      function () { publishState({ showExternal: cycleValue(state.snapshot.showExternal, externalValues, -1) }); },
      function () { publishState({ showExternal: cycleValue(state.snapshot.showExternal, externalValues, 1) }); },
      '#7c3aed',
      'External dependencies are packages or modules resolved outside the analyzed project.'
    ));
    var numericMetrics = ['degree', 'fanIn', 'fanOut', 'totalLines', 'relationCount', 'cycleSize'];
    var mappingControls = state.snapshot.layout === 'metric-space'
      ? [
        { key: 'x', label: 'X', x: -2.2 },
        { key: 'z', label: 'Z', x: -1.1 },
        { key: 'size', label: 'Size', x: 0 },
        { key: 'height', label: 'Height', x: 1.1 },
        { key: 'color', label: 'Color', x: 2.2 }
      ]
      : [
        { key: 'size', label: 'Size', x: -1.9 },
        { key: 'height', label: 'Height', x: 0 },
        { key: 'color', label: 'Color', x: 1.9 }
      ];
    mappingControls.forEach(function (mappingControl) {
      var mappingHelp = mappingControl.key === 'color'
        ? 'Color selects the metric or language used to color each node.'
        : mappingControl.key === 'height'
          ? 'Height selects the metric used to raise nodes above the table.'
          : mappingControl.key === 'size'
            ? 'Size selects the metric used to scale each node.'
            : mappingControl.key.toUpperCase() + ' selects the metric used for this spatial axis.';
      function updateMapping(direction) {
        var mapping = Object.assign({}, state.snapshot.mapping);
        var candidates = mappingControl.key === 'color'
          ? ['language', 'degree', 'fanIn', 'fanOut', 'cycleSize']
          : numericMetrics;
        mapping[mappingControl.key] = cycleValue(mapping[mappingControl.key], candidates, direction);
        publishState({ mapping: mapping });
      }
      refs.controls.appendChild(cycleButton(
        mappingControl.label + ': ' + state.snapshot.mapping?.[mappingControl.key],
        mappingControl.x + ' 0.78 0.02',
        state.snapshot.layout === 'metric-space' ? 1.02 : 1.72,
        function () { updateMapping(-1); },
        function () { updateMapping(1); },
        '#5b21b6',
        mappingHelp
      ));
    });
    RELATIONS.forEach(function (relation, index) {
      var enabled = state.snapshot.relationFilters?.[relation] !== false;
      refs.controls.appendChild(cycleButton(
        (enabled ? 'ON ' : 'OFF ') + relation,
        (-2.1 + ((index % 4) * 1.4)) + ' ' + (0.25 - (Math.floor(index / 4) * 0.48)) + ' 0.02',
        1.25,
        function () {
          var filters = Object.assign({}, state.snapshot.relationFilters);
          filters[relation] = !enabled;
          publishState({ relationFilters: filters });
        },
        function () {
          var filters = Object.assign({}, state.snapshot.relationFilters);
          filters[relation] = !enabled;
          publishState({ relationFilters: filters });
        },
        enabled ? '#0f766e' : '#475569',
        RELATION_HELP[relation]
      ));
    });
    var encodingLabels = {
      'relation-type': 'Relation type',
      'intensity-color': 'Intensity color',
      'intensity-width': 'Intensity width',
      'intensity-combined': 'Color + width'
    };
    var currentEncoding = state.snapshot.edgeEncoding || 'relation-type';
    refs.controls.appendChild(cycleButton(
      'Edges: ' + encodingLabels[currentEncoding], '0 -0.72 0.02', 4.9,
      function () { publishState({ edgeEncoding: cycleValue(currentEncoding, EDGE_ENCODINGS, -1) }); },
      function () { publishState({ edgeEncoding: cycleValue(currentEncoding, EDGE_ENCODINGS, 1) }); },
      '#9a3412',
      'Edge style can show relation type, occurrence intensity, or both color and width.'
    ));
    var flowQuality = root.CodeXRRenderBudgetRuntime?.getSnapshot?.().quality || 'full';
    var visualBudget = root.CodeXRDependencyVisualBudgetRuntime?.getSnapshot?.() || {
      override: 'auto', profile: 'sparse', effectiveProfile: 'sparse'
    };
    var detailOverrides = ['auto', 'full', 'focus'];
    refs.controls.appendChild(cycleButton(
      'Detail: ' + visualBudget.override,
      '0 -1.04 0.02',
      4.9,
      function () {
        setDetailOverride(cycleValue(visualBudget.override, detailOverrides, -1));
      },
      function () {
        setDetailOverride(cycleValue(visualBudget.override, detailOverrides, 1));
      },
      '#334155',
      'Detail is local to this device. Auto adapts to density, Full increases contrast, and Focus emphasizes interactions.'
    ));
    refs.controls.appendChild(text(
      currentEncoding === 'relation-type'
        ? 'Colors identify relation kinds | Density: ' + visualBudget.profile + ' | Flow: ' + flowQuality
        : 'Intensity: 1 | 2-3 | 4-7 | 8-15 | 16+ | Density: ' + visualBudget.profile,
      '0 -1.31 0.02', 5.1, '#fdba74'
    ));
    if (currentEncoding !== 'relation-type') {
      INTENSITY_COLORS.forEach(function (color, index) {
        var sample = entity('a-plane', {
          position: (-1.52 + (index * .76)) + ' -1.45 0.024',
          width: .66,
          height: .035 + (index * .018),
          material: 'color: ' + color + '; opacity: .98; shader: flat'
        });
        refs.controls.appendChild(sample);
      });
    }
    refs.controls.appendChild(text(
      'Shapes: sphere function | cylinder method | pyramid class | diamond interface | box folder',
      '0 -1.58 0.02', 5.25, '#ddd6fe'
    ));
    refs.controls.appendChild(button('Reset view', '-0.9 -1.86 0.02', 1.55, resetView, '#475569'));
    refs.controls.appendChild(button('Re-analyze', '0.9 -1.86 0.02', 1.55, reanalyze, '#b45309'));
    refs.controls.appendChild(text(
      'Hover nodes or edges for details. Click once to pin and again to release.',
      '0 -2.18 0.02', 5.3, '#cbd5e1'
    ));
    refs.status = text(state.snapshot.message || '', '0 -2.42 0.02', 5.3, '#fde68a');
    refs.controls.appendChild(refs.status);
  }

  function buildPanel() {
    if (
      refs.controls
      || !root.CodeXRMappingUiRuntime?.registerPanelView
      || !root.CodeXRMappingUiRuntime?.isPanelReady?.()
    ) { return; }
    refs.controls = entity('a-entity', { position: '0 0 0.04' });
    state.unregisterPanel = root.CodeXRMappingUiRuntime.registerPanelView({
      id: 'dependency-graph',
      title: 'Dependencies',
      headerButton: false,
      panelHeight: 4.9,
      content: refs.controls,
      onShow: renderControls
    });
  }

  function createLayoutWorker() {
    var source = [
      'self.onmessage=function(event){',
      'var p=event.data,n=p.nodes||[],e=p.edges||[],layout=p.layout,w=p.width,d=p.depth,m=p.mapping||{},s=p.scales||{};',
      'var out={};',
      'if(layout==="hierarchical"){var incoming={};n.forEach(function(x){incoming[x.id]=0;});e.forEach(function(x){incoming[x.target]=(incoming[x.target]||0)+1;});',
      'var levels={};n.forEach(function(x){var l=Math.min(6,incoming[x.id]||0);(levels[l]||(levels[l]=[])).push(x);});',
      'Object.keys(levels).forEach(function(k){var a=levels[k];a.forEach(function(x,i){out[x.id]={x:-w/2+(Number(k)+.5)*(w/7),y:.12+(i%4)*.18,z:-d/2+((i+.5)/a.length)*d};});});',
      '}else if(layout==="metric-space"){var xMetric=m.x||"fanOut",zMetric=m.z||"fanIn",maxX=Math.max(1,Number(s.x&&s.x.maximum||1)),maxZ=Math.max(1,Number(s.z&&s.z.maximum||1));n.forEach(function(x){out[x.id]={x:-w/2+(Number(x.metrics[xMetric]||0)/maxX)*w,y:.12,z:-d/2+(Number(x.metrics[zMetric]||0)/maxZ)*d};});',
      '}else{var count=Math.max(1,n.length);n.forEach(function(x,i){var ring=Math.floor(Math.sqrt(i)),angle=i*2.399963;var radius=Math.min(Math.min(w,d)*.45,.28+ring*.22);out[x.id]={x:Math.cos(angle)*radius,y:.12+(i%5)*.09,z:Math.sin(angle)*radius};});}',
      'self.postMessage({generation:p.generation,positions:out});};'
    ].join('');
    return new root.Worker(root.URL.createObjectURL(new root.Blob([source], { type: 'application/javascript' })));
  }

  function registerComponent() {
    if (!AFRAME?.registerComponent || AFRAME.components[COMPONENT]) { return; }
    AFRAME.registerComponent(COMPONENT, {
      init: function () {
        this.worker = null;
        this.nodes = {};
        this.edges = [];
        this.edgeObjects = [];
        this.edgeRecords = {};
        this.edgeBatches = {};
        this.edgeBatchObjects = [];
        this.edgeTransform = root.THREE ? new root.THREE.Object3D() : null;
        this.flowPoints = null;
        this.flowGeometry = null;
        this.flowPositions = null;
        this.flowColors = null;
        this.flowQuality = root.CodeXRRenderBudgetRuntime?.getSnapshot?.().quality || 'full';
        this.visualBudget = root.CodeXRDependencyVisualBudgetRuntime?.getSnapshot?.() || {
          profile: 'sparse',
          effectiveProfile: 'sparse',
          override: 'auto',
          widths: FALLBACK_INTENSITY_WIDTHS,
          flowLimit: 300,
          arrowsForAll: true
        };
        this.focusEdgeObjects = [];
        this.focusEdgeIds = new Set();
        this.lastFlowCount = 0;
        this.visibleArrowCount = 0;
        this.selectionHalo = null;
        this.selectionStartedAt = 0;
        this.axisObjects = [];
        this.axesRoot = null;
        this.tooltip = null;
        this.pinnedSelection = null;
        this.hoveredSelection = null;
        this.graphTopY = GRAPH_BASE_Y;
        this.layoutGeneration = 0;
        this.pendingGraph = null;
        this.transition = null;
        this.transitionFrame = null;
        this.transitionDuration = root.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ? 0 : 600;
        this.ensureWorker();
        var self = this;
        this.disposeRenderBudget = root.CodeXRRenderBudgetRuntime?.subscribe?.(function (budget) {
          var qualityChanged = self.flowQuality !== budget.quality;
          self.flowQuality = budget.quality;
          self.refreshVisualBudget();
          if (qualityChanged) { renderControls(); }
        }) || null;
      },
      tick: function (time) {
        if (this.tooltip?.root?.getAttribute('visible') && root.THREE) {
          root.CodeXRCommonRuntime?.faceCamera?.(this.tooltip.root, this.el.sceneEl);
        }
        this.updateHighlightTransition();
        this.updateSelectionHalo(time || 0);
        this.updateFocusEdges();
        this.updateFlow(time || 0);
      },
      remove: function () {
        this.disposeView();
        this.disposeRenderBudget?.();
        this.disposeRenderBudget = null;
        this.worker?.terminate?.();
        this.worker = null;
      },
      ensureWorker: function () {
        if (this.worker) {
          return this.worker;
        }
        this.worker = createLayoutWorker();
        this.worker.onmessage = this.applyPositions.bind(this);
        return this.worker;
      },
      disposeView: function () {
        this.layoutGeneration += 1;
        this.pendingGraph = null;
        this.transition = null;
        if (this.transitionFrame !== null) {
          root.cancelAnimationFrame?.(this.transitionFrame);
          this.transitionFrame = null;
        }
        this.clear();
      },
      resetView: function () {
        this.pinnedSelection = null;
        this.hoveredSelection = null;
        this.tooltip?.root?.setAttribute?.('visible', false);
        this.clear(false);
        if (this.currentDataset && this.currentView) {
          this.setGraph(this.currentDataset, this.currentView);
        }
      },
      clear: function (preserveSelection) {
        (this.edgeObjects || []).forEach(function (line) {
          line.parent?.remove?.(line);
          line.geometry?.dispose?.();
          line.material?.dispose?.();
        }, this);
        this.disposeEdgeBatches();
        this.disposeFlowLayer();
        this.disposeFocusEdges();
        this.disposeSelectionHalo();
        (this.axisObjects || []).forEach(function (object) {
          object.parent?.remove?.(object);
          object.geometry?.dispose?.();
          object.material?.dispose?.();
        });
        while (this.el.firstChild) { this.el.removeChild(this.el.firstChild); }
        this.nodes = {};
        this.edges = [];
        this.edgeObjects = [];
        this.edgeRecords = {};
        this.edgeBatches = {};
        this.edgeBatchObjects = [];
        this.axisObjects = [];
        this.axesRoot = null;
        this.tooltip = null;
        this.scopeLabel = null;
        this.hoveredSelection = null;
        this.lastFlowCount = 0;
        this.visibleArrowCount = 0;
        this.graphTopY = GRAPH_BASE_Y;
        if (!preserveSelection) { this.pinnedSelection = null; }
      },
      setGraph: function (dataset, view) {
        dataset = dataset || { nodes: [], edges: [] };
        dataset.nodes = Array.isArray(dataset.nodes) ? dataset.nodes : [];
        dataset.edges = Array.isArray(dataset.edges) ? dataset.edges : [];
        var renderableIds = new Set(dataset.nodes.map(function (node) { return node.id; }));
        dataset = Object.assign({}, dataset, {
          nodes: dataset.nodes.slice(),
          edges: dataset.edges.filter(function (edge) {
            return renderableIds.has(edge.source) && renderableIds.has(edge.target);
          })
        });
        this.currentDataset = dataset;
        this.currentView = view;
        if (!this.scopeLabel?.isConnected) {
          this.scopeLabel = text('', '0 1.52 0.18', 5.4, '#67e8f9');
          this.scopeLabel.setAttribute('side', 'double');
          this.el.appendChild(this.scopeLabel);
        }
        this.scopeLabel.setAttribute(
          'value',
          (view.scope?.kind === 'file' ? 'File: ' : 'Folder: ')
            + (normalizeRelativePath(view.scope?.relativePath) || '(project root)')
        );
        var layoutNodes = dataset.nodes.filter(function (node) { return !node.syntheticExternal; });
        var metricScales = buildMetricScales(layoutNodes, view.mapping);
        var maxMetric = Math.max.apply(Math, layoutNodes.map(function (node) {
          return Number(node.metrics?.[view.mapping?.size || 'degree'] || 0);
        }).concat([1]));
        var visuals = {};
        dataset.nodes.forEach(function (node) {
          var metric = Number(node.metrics?.[view.mapping?.size || 'degree'] || 0);
          var radius = 0.055 + Math.sqrt(metric / maxMetric) * 0.14;
          var colorMetric = view.mapping?.color || 'language';
          var numericColor = Number(node.metrics?.[colorMetric]);
          var color = colorMetric === 'language'
            ? (COLORS[node.language] || COLORS[node.external ? 'external' : 'TypeScript'])
            : numericGradient(numericColor, maxMetric);
          var semanticVisual = symbolVisual(node, view.layout);
          if (semanticVisual) {
            color = semanticVisual.color;
          }
          if (node.syntheticExternal || node.syntheticKind) {
            radius = .16;
          }
          visuals[node.id] = {
            radius: radius,
            color: color,
            shape: semanticVisual?.shape || (node.kind === 'group' ? 'box' : 'sphere')
          };
        });
        var visualBudget = root.CodeXRDependencyVisualBudgetRuntime?.update?.(
          graphDensityStats(dataset),
          this.flowQuality
        ) || this.visualBudget;
        var generation = ++this.layoutGeneration;
        this.pendingGraph = {
          generation: generation,
          dataset: dataset,
          view: view,
          metricScales: metricScales,
          visuals: visuals,
          edges: dataset.edges,
          visualBudget: visualBudget
        };
        this.ensureWorker().postMessage({
          generation: generation,
          nodes: layoutNodes,
          edges: this.pendingGraph.edges,
          layout: view.layout,
          mapping: view.mapping,
          scales: metricScales,
          width: GRAPH_WIDTH,
          depth: GRAPH_DEPTH
        });
      },
      applyPositions: function (event) {
        var response = event.data || {};
        if (!this.pendingGraph || response.generation !== this.pendingGraph.generation) { return; }
        var positions = response.positions || {};
        var pending = this.pendingGraph;
        var summary = pending.dataset.nodes.find(function (node) { return node.syntheticExternal; });
        if (summary) {
          positions[summary.id] = pending.view.layout === 'force-3d'
            ? { x: GRAPH_WIDTH * .38, y: GRAPH_HEIGHT * .72, z: -GRAPH_DEPTH * .36 }
            : { x: GRAPH_WIDTH * .39, y: GRAPH_HEIGHT * .62, z: GRAPH_DEPTH * .34 };
        }
        this.pendingGraph = null;
        this.beginTransition(pending, positions);
      },
      createNodeRecord: function (node, visual, startPosition) {
        var self = this;
        var nodeEl = entity('a-entity', {
          geometry: nodeGeometry(visual.shape, visual.radius),
          material: 'color: ' + visual.color + '; shader: flat; transparent: true; opacity: 0',
          class: RAYCAST_CLASS,
          'data-node-id': node.id
        });
        nodeEl.object3D.position.copy(startPosition);
        nodeEl.object3D.scale.setScalar(0);
        nodeEl.addEventListener('mouseenter', function () {
          self.showTransientSelection({ type: 'node', id: node.id });
        });
        nodeEl.addEventListener('mouseleave', function () {
          self.hideTransientSelection({ type: 'node', id: node.id });
        });
        nodeEl.addEventListener('click', function (clickEvent) {
          clickEvent.stopPropagation?.();
          self.togglePinnedSelection({ type: 'node', id: node.id });
        });
        this.el.appendChild(nodeEl);
        return {
          el: nodeEl,
          data: node,
          radius: visual.radius,
          shape: visual.shape,
          highlightTarget: 1,
          highlightColor: false,
          baseColor: visual.color
        };
      },
      beginTransition: function (pending, positions) {
        if (!root.THREE) { return; }
        var self = this;
        var heightMetric = pending.view.mapping?.height || 'fanIn';
        var heightMaximum = Math.max(1, Number(pending.metricScales?.y?.maximum || 1));
        var targetIds = new Set();
        var nodeTransitions = [];
        Object.keys(positions).forEach(function (id) {
          var node = pending.dataset.nodes.find(function (candidate) { return candidate.id === id; });
          var visual = pending.visuals[id];
          if (!node || !visual) { return; }
          targetIds.add(id);
          var p = positions[id];
          var mappedHeight = (Math.max(0, Number(node.metrics?.[heightMetric] || 0)) / heightMaximum) * GRAPH_HEIGHT;
          var targetPosition = new root.THREE.Vector3(p.x, p.y + mappedHeight, p.z);
          var record = self.nodes[id];
          if (!record) {
            var connected = pending.edges.find(function (edge) {
              return edge.source === id && self.nodes[edge.target]
                || edge.target === id && self.nodes[edge.source];
            });
            var neighborId = connected
              ? (connected.source === id ? connected.target : connected.source)
              : null;
            var startPosition = neighborId && self.nodes[neighborId]
              ? self.nodes[neighborId].el.object3D.position.clone()
              : new root.THREE.Vector3(0, GRAPH_BASE_Y, 0);
            record = self.createNodeRecord(node, visual, startPosition);
            self.nodes[id] = record;
          }
          var material = record.el.getAttribute('material') || {};
          var previousRadius = Math.max(.0001, Number(record.radius || visual.radius));
          nodeTransitions.push({
            id: id,
            record: record,
            remove: false,
            fromPosition: record.el.object3D.position.clone(),
            toPosition: targetPosition,
            fromScale: Number(record.el.object3D.scale.x || 0),
            toScale: visual.radius / previousRadius,
            fromOpacity: Number(material.opacity ?? 1),
            toOpacity: 1,
            fromColor: new root.THREE.Color(material.color || visual.color),
            toColor: new root.THREE.Color(visual.color)
          });
          record.data = node;
          record.targetRadius = visual.radius;
          record.shape = visual.shape;
          record.baseColor = visual.color;
        });
        Object.keys(this.nodes).forEach(function (id) {
          if (targetIds.has(id)) { return; }
          var record = self.nodes[id];
          var material = record.el.getAttribute('material') || {};
          nodeTransitions.push({
            id: id,
            record: record,
            remove: true,
            fromPosition: record.el.object3D.position.clone(),
            toPosition: record.el.object3D.position.clone(),
            fromScale: Number(record.el.object3D.scale.x || 1),
            toScale: 0,
            fromOpacity: Number(material.opacity ?? 1),
            toOpacity: 0,
            fromColor: new root.THREE.Color(material.color || '#64748b'),
            toColor: new root.THREE.Color(material.color || '#64748b')
          });
        });
        this.visualBudget = pending.visualBudget || this.visualBudget;
        this.reconcileEdges(pending.edges, pending.view);
        this.dataset = pending.dataset;
        this.edges = pending.edges;
        this.view = pending.view;
        this.metricScales = pending.metricScales;
        this.transition = {
          startedAt: null,
          duration: this.transitionDuration,
          nodes: nodeTransitions,
          edgeIds: new Set(pending.edges.map(function (edge) { return edge.id; }))
        };
        this.scheduleTransitionFrame();
      },
      refreshVisualBudget: function () {
        if (!this.edges?.length) {
          this.visualBudget = root.CodeXRDependencyVisualBudgetRuntime?.update?.(
            { nodeCount: Object.keys(this.nodes || {}).length, edgeCount: 0, maxDegree: 0 },
            this.flowQuality
          ) || this.visualBudget;
          return;
        }
        this.visualBudget = root.CodeXRDependencyVisualBudgetRuntime?.update?.(
          graphDensityStats({ nodes: Object.values(this.nodes).map(function (record) { return record.data; }), edges: this.edges }),
          this.flowQuality
        ) || this.visualBudget;
        this.reconcileEdges(this.edges, this.view || {});
        Object.keys(this.edgeRecords).forEach(function (edgeId) {
          var record = this.edgeRecords[edgeId];
          if (!record.remove) { this.updateEdgeGeometry(record); }
        }, this);
        this.refreshEdgeColors(this.pinnedSelection || this.hoveredSelection);
        this.rebuildFocusEdges();
        this.updateFlowVisibility();
      },
      scheduleTransitionFrame: function () {
        if (!this.transition) { return; }
        if (this.transitionDuration === 0 || !root.requestAnimationFrame) {
          this.updateTransition(root.performance?.now?.() || Date.now(), true);
          return;
        }
        if (this.transitionFrame !== null) {
          root.cancelAnimationFrame?.(this.transitionFrame);
        }
        var self = this;
        this.transitionFrame = root.requestAnimationFrame(function (time) {
          self.transitionFrame = null;
          self.updateTransition(time, false);
        });
      },
      disposeEdgeBatches: function () {
        (this.edgeBatchObjects || []).forEach(function (object) {
          object.parent?.remove?.(object);
          object.geometry?.dispose?.();
          object.material?.dispose?.();
        });
        this.edgeBatches = {};
        this.edgeBatchObjects = [];
      },
      disposeFocusEdges: function () {
        (this.focusEdgeObjects || []).forEach(function (record) {
          [record.body, record.arrow].forEach(function (object) {
            object?.parent?.remove?.(object);
            object?.geometry?.dispose?.();
            object?.material?.dispose?.();
          });
        });
        this.focusEdgeObjects = [];
        this.focusEdgeIds = new Set();
      },
      rebuildFocusEdges: function () {
        this.disposeFocusEdges();
        if (!root.THREE || !(this.pinnedSelection || this.hoveredSelection)) { return; }
        var records = Object.values(this.edgeRecords).filter(function (record) {
          return !record.remove && (record.highlighted || this.isEdgeActive(record.data));
        }, this).sort(function (left, right) {
          return Number(right.data.occurrences || 1) - Number(left.data.occurrences || 1);
        }).slice(0, 40);
        records.forEach(function (record) {
          this.focusEdgeIds.add(record.data.id);
          var opacity = root.CodeXRDependencyVisualBudgetRuntime?.opacityFor?.(
            this.visualBudget?.effectiveProfile || 'balanced',
            record.data.confidence || 'probable',
            true
          ) || .94;
          var material = new root.THREE.MeshBasicMaterial({
            color: record.style?.color || '#fcd34d',
            transparent: true,
            opacity: opacity,
            depthWrite: false
          });
          var body = new root.THREE.Mesh(
            new root.THREE.CylinderGeometry(.01, .01, 1, 8),
            material
          );
          var arrow = new root.THREE.Mesh(
            new root.THREE.ConeGeometry(.026, .085, 8),
            material.clone()
          );
          body.frustumCulled = false;
          arrow.frustumCulled = false;
          this.el.object3D.add(body);
          this.el.object3D.add(arrow);
          this.focusEdgeObjects.push({ record: record, body: body, arrow: arrow });
        }, this);
        this.updateFocusEdges();
      },
      updateFocusEdges: function () {
        if (!root.THREE) { return; }
        (this.focusEdgeObjects || []).forEach(function (focus) {
          var source = this.nodes[focus.record.data.source]?.el?.object3D?.position;
          var target = this.nodes[focus.record.data.target]?.el?.object3D?.position;
          if (!source || !target) {
            focus.body.visible = false;
            focus.arrow.visible = false;
            return;
          }
          var direction = target.clone().sub(source);
          var length = Math.max(.001, direction.length());
          var normalized = direction.clone().normalize();
          var midpoint = source.clone().add(target).multiplyScalar(.5);
          var width = Math.max(.009, Number(focus.record.style?.width || .006) * 1.85);
          focus.body.visible = true;
          focus.body.position.copy(midpoint);
          focus.body.quaternion.setFromUnitVectors(new root.THREE.Vector3(0, 1, 0), normalized);
          focus.body.scale.set(width / .01, length, width / .01);
          focus.arrow.visible = true;
          focus.arrow.position.copy(target).addScaledVector(normalized, -.075);
          focus.arrow.quaternion.setFromUnitVectors(new root.THREE.Vector3(0, 1, 0), normalized);
          focus.arrow.scale.setScalar(Math.max(.9, width / .012));
        }, this);
      },
      createEdgeBatch: function (confidence, count) {
        if (!root.THREE || count < 1) { return null; }
        var opacity = root.CodeXRDependencyVisualBudgetRuntime?.opacityFor?.(
          this.visualBudget?.effectiveProfile || 'balanced',
          confidence,
          false
        ) || FALLBACK_CONFIDENCE_OPACITY[confidence] || FALLBACK_CONFIDENCE_OPACITY.probable;
        var body = new root.THREE.InstancedMesh(
          new root.THREE.CylinderGeometry(.01, .01, 1, 6),
          new root.THREE.MeshBasicMaterial({
            color: 0xffffff, vertexColors: true, transparent: true,
            opacity: opacity, depthWrite: false
          }),
          count
        );
        var arrows = new root.THREE.InstancedMesh(
          new root.THREE.ConeGeometry(.026, .085, 6),
          new root.THREE.MeshBasicMaterial({
            color: 0xffffff, vertexColors: true, transparent: true,
            opacity: Math.min(1, opacity + .12), depthWrite: false
          }),
          count
        );
        body.instanceMatrix.setUsage?.(root.THREE.DynamicDrawUsage);
        arrows.instanceMatrix.setUsage?.(root.THREE.DynamicDrawUsage);
        body.frustumCulled = false;
        arrows.frustumCulled = false;
        this.el.object3D.add(body);
        this.el.object3D.add(arrows);
        this.edgeBatchObjects.push(body, arrows);
        return { body: body, arrows: arrows, nextIndex: 0 };
      },
      createEdgeRecord: function (edge) {
        if (!root.THREE) { return null; }
        var self = this;
        var hitMesh = new root.THREE.Mesh(
          new root.THREE.CylinderGeometry(.018, .018, 1, 6),
          new root.THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            depthWrite: false,
            colorWrite: false,
            visible: false
          })
        );
        var edgeEl = entity('a-entity', {
          class: RAYCAST_CLASS,
          'data-edge-id': edge.id,
          'data-codexr-interactive': 'true'
        });
        edgeEl.setObject3D('edge-hit-target', hitMesh);
        edgeEl.addEventListener('mouseenter', function () {
          self.showTransientSelection({ type: 'edge', id: edge.id });
        });
        edgeEl.addEventListener('mouseleave', function () {
          self.hideTransientSelection({ type: 'edge', id: edge.id });
        });
        edgeEl.addEventListener('click', function (clickEvent) {
          clickEvent.stopPropagation?.();
          self.togglePinnedSelection({ type: 'edge', id: edge.id });
        });
        this.el.appendChild(edgeEl);
        this.edgeObjects.push(hitMesh);
        return {
          el: edgeEl,
          data: edge,
          hitMesh: hitMesh,
          midpoint: new root.THREE.Vector3(),
          style: edgeStyle(edge, this.view?.edgeEncoding || 'relation-type', this.visualBudget),
          batch: null,
          instanceIndex: -1,
          remove: false
        };
      },
      reconcileEdges: function (nextEdges, nextView) {
        var self = this;
        var nextIds = new Set();
        this.disposeEdgeBatches();
        var confidenceCounts = {};
        nextEdges.forEach(function (edge) {
          var key = edge.confidence || 'probable';
          confidenceCounts[key] = Number(confidenceCounts[key] || 0) + 1;
        });
        Object.keys(confidenceCounts).forEach(function (confidence) {
          self.edgeBatches[confidence] = self.createEdgeBatch(confidence, confidenceCounts[confidence]);
        });
        nextEdges.forEach(function (edge) {
          nextIds.add(edge.id);
          var record = self.edgeRecords[edge.id];
          if (!record) {
            record = self.createEdgeRecord(edge);
            if (!record) { return; }
            self.edgeRecords[edge.id] = record;
          }
          record.data = edge;
          record.style = edgeStyle(
            edge,
            nextView?.edgeEncoding || self.view?.edgeEncoding || 'relation-type',
            self.visualBudget
          );
          record.batch = self.edgeBatches[edge.confidence || 'probable'];
          record.instanceIndex = record.batch ? record.batch.nextIndex++ : -1;
          record.remove = false;
        });
        Object.keys(this.edgeRecords).forEach(function (edgeId) {
          if (nextIds.has(edgeId)) { return; }
          var record = self.edgeRecords[edgeId];
          record.batch = null;
          record.instanceIndex = -1;
          record.hitMesh.visible = false;
          record.remove = true;
        });
      },
      updateEdgeGeometry: function (record) {
        if (!root.THREE) { return; }
        var source = this.nodes[record.data.source]?.el?.object3D?.position;
        var target = this.nodes[record.data.target]?.el?.object3D?.position;
        if (!source || !target || !record.batch || record.instanceIndex < 0) {
          record.hitMesh.visible = false;
          return;
        }
        record.hitMesh.visible = true;
        record.midpoint.copy(source).add(target).multiplyScalar(.5);
        var direction = target.clone().sub(source);
        var length = Math.max(.001, direction.length());
        record.hitMesh.position.copy(record.midpoint);
        record.hitMesh.scale.set(1, length, 1);
        record.hitMesh.quaternion.setFromUnitVectors(
          new root.THREE.Vector3(0, 1, 0),
          direction.clone().normalize()
        );
        var style = record.style || edgeStyle(
          record.data,
          this.view?.edgeEncoding || 'relation-type',
          this.visualBudget
        );
        var normalizedDirection = direction.clone().normalize();
        this.edgeTransform.position.copy(record.midpoint);
        this.edgeTransform.quaternion.setFromUnitVectors(
          new root.THREE.Vector3(0, 1, 0),
          normalizedDirection
        );
        this.edgeTransform.scale.set(style.width / .01, length, style.width / .01);
        this.edgeTransform.updateMatrix();
        record.batch.body.setMatrixAt(record.instanceIndex, this.edgeTransform.matrix);
        record.batch.body.setColorAt(record.instanceIndex, new root.THREE.Color(style.color));

        var showArrow = this.visualBudget?.arrowsForAll || this.focusEdgeIds.has(record.data.id);
        this.edgeTransform.position.copy(target).addScaledVector(normalizedDirection, -.075);
        this.edgeTransform.quaternion.setFromUnitVectors(
          new root.THREE.Vector3(0, 1, 0),
          normalizedDirection
        );
        this.edgeTransform.scale.setScalar(showArrow ? Math.max(.75, style.width / .012) : 0);
        this.edgeTransform.updateMatrix();
        record.batch.arrows.setMatrixAt(record.instanceIndex, this.edgeTransform.matrix);
        record.batch.arrows.setColorAt(record.instanceIndex, new root.THREE.Color(style.color));
      },
      flushEdgeBatches: function () {
        Object.values(this.edgeBatches || {}).forEach(function (batch) {
          if (!batch) { return; }
          batch.body.instanceMatrix.needsUpdate = true;
          batch.arrows.instanceMatrix.needsUpdate = true;
          if (batch.body.instanceColor) { batch.body.instanceColor.needsUpdate = true; }
          if (batch.arrows.instanceColor) { batch.arrows.instanceColor.needsUpdate = true; }
        });
      },
      isEdgeActive: function (edge) {
        var selection = this.pinnedSelection || this.hoveredSelection;
        if (!selection) { return false; }
        if (selection.type === 'edge') { return selection.id === edge.id; }
        return edge.source === selection.id || edge.target === selection.id;
      },
      refreshEdgeColors: function (selection) {
        if (!root.THREE) { return; }
        this.visibleArrowCount = 0;
        Object.keys(this.edgeRecords).forEach(function (edgeId) {
          var record = this.edgeRecords[edgeId];
          if (!record.batch || record.instanceIndex < 0) { return; }
          var active = !selection || record.highlighted;
          var color = new root.THREE.Color(record.style?.color || '#67e8f9');
          if (!active) { color.multiplyScalar(.42); }
          this.updateEdgeGeometry(record);
          record.batch.body.setColorAt(record.instanceIndex, color);
          record.batch.arrows.setColorAt(record.instanceIndex, color);
        }, this);
        this.flushEdgeBatches();
      },
      updateHighlightTransition: function () {
        Object.keys(this.nodes).forEach(function (nodeId) {
          var record = this.nodes[nodeId];
          var material = record.el.getAttribute('material') || {};
          var current = Number(material.opacity ?? 1);
          var target = Number(record.highlightTarget ?? 1);
          if (Math.abs(current - target) < .01) { current = target; }
          else { current += (target - current) * .16; }
          record.el.setAttribute('material', 'opacity', current);
          record.el.setAttribute('material', 'transparent', current < .999);
          if (root.THREE && record.baseColor) {
            var targetColor = new root.THREE.Color(record.baseColor);
            if (record.highlightColor) {
              targetColor.lerp(new root.THREE.Color('#ffffff'), .28);
            }
            var currentColor = new root.THREE.Color(material.color || record.baseColor);
            currentColor.lerp(targetColor, .18);
            record.el.setAttribute('material', 'color', '#' + currentColor.getHexString());
          }
        }, this);
      },
      ensureSelectionHalo: function (selection) {
        this.disposeSelectionHalo();
        if (!root.THREE || selection.type !== 'node' || !this.nodes[selection.id]) { return; }
        var radius = Math.max(.09, Number(this.nodes[selection.id].radius || .1)) * 1.5;
        this.selectionHalo = new root.THREE.Mesh(
          new root.THREE.SphereGeometry(radius, 12, 8),
          new root.THREE.MeshBasicMaterial({
            color: 0xfcd34d, transparent: true, opacity: .42,
            wireframe: true, depthWrite: false
          })
        );
        this.selectionHalo.userData.nodeId = selection.id;
        this.el.object3D.add(this.selectionHalo);
      },
      updateSelectionHalo: function (time) {
        if (!this.selectionHalo) { return; }
        var node = this.nodes[this.selectionHalo.userData.nodeId];
        if (!node) {
          this.disposeSelectionHalo();
          return;
        }
        this.selectionHalo.position.copy(node.el.object3D.position);
        var pulse = this.flowQuality === 'static' ? 1 : 1 + Math.sin(time * .005) * .08;
        this.selectionHalo.scale.setScalar(pulse);
      },
      disposeSelectionHalo: function () {
        if (!this.selectionHalo) { return; }
        this.selectionHalo.parent?.remove?.(this.selectionHalo);
        this.selectionHalo.geometry?.dispose?.();
        this.selectionHalo.material?.dispose?.();
        this.selectionHalo = null;
      },
      ensureFlowLayer: function (capacity) {
        if (!root.THREE || capacity < 1) { return; }
        if (this.flowPositions && this.flowPositions.length >= capacity * 3) { return; }
        this.disposeFlowLayer();
        this.flowPositions = new Float32Array(capacity * 3);
        this.flowColors = new Float32Array(capacity * 3);
        this.flowGeometry = new root.THREE.BufferGeometry();
        this.flowGeometry.setAttribute('position', new root.THREE.BufferAttribute(this.flowPositions, 3));
        this.flowGeometry.setAttribute('color', new root.THREE.BufferAttribute(this.flowColors, 3));
        this.flowPoints = new root.THREE.Points(this.flowGeometry, new root.THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          vertexColors: true,
          uniforms: {
            pointSize: { value: this.visualBudget?.effectiveProfile === 'dense' ? 3 : 5 },
            opacity: { value: .88 }
          },
          vertexShader: [
            'varying vec3 vColor;',
            'uniform float pointSize;',
            'void main() {',
            '  vColor = color;',
            '  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);',
            '  gl_PointSize = pointSize * (80.0 / max(40.0, -mvPosition.z));',
            '  gl_Position = projectionMatrix * mvPosition;',
            '}'
          ].join('\n'),
          fragmentShader: [
            'varying vec3 vColor;',
            'uniform float opacity;',
            'void main() {',
            '  vec2 p = gl_PointCoord - vec2(0.5);',
            '  float radial = 1.0 - smoothstep(0.16, 0.5, length(vec2(p.x * 0.72, p.y)));',
            '  float tail = smoothstep(-0.5, 0.42, p.x);',
            '  float alpha = radial * (0.3 + 0.7 * tail) * opacity;',
            '  if (alpha < 0.02) discard;',
            '  gl_FragColor = vec4(vColor, alpha);',
            '}'
          ].join('\n')
        }));
        this.flowPoints.frustumCulled = false;
        this.el.object3D.add(this.flowPoints);
      },
      disposeFlowLayer: function () {
        if (this.flowPoints) {
          this.flowPoints.parent?.remove?.(this.flowPoints);
          this.flowPoints.material?.dispose?.();
        }
        this.flowGeometry?.dispose?.();
        this.flowPoints = this.flowGeometry = this.flowPositions = this.flowColors = null;
      },
      activeFlowEdges: function () {
        if (this.flowQuality === 'static') { return []; }
        var records = Object.values(this.edgeRecords).filter(function (record) {
          return !record.remove && record.batch;
        });
        var active = records.filter(function (record) {
          return record.highlighted || this.isEdgeActive(record.data);
        }, this).sort(function (left, right) {
          return Number(right.data.occurrences || 1) - Number(left.data.occurrences || 1);
        });
        var effectiveProfile = this.visualBudget?.effectiveProfile || 'balanced';
        var limit = Number(this.visualBudget?.flowLimit || 40);
        if (effectiveProfile === 'dense' || this.visualBudget?.override === 'focus') {
          return active.slice(0, limit);
        }
        var ranked = records.slice().sort(function (left, right) {
          return Number(right.data.occurrences || 1) - Number(left.data.occurrences || 1);
        });
        var preferred = active.concat(ranked.filter(function (record) {
          return !active.includes(record);
        }));
        return preferred.slice(0, limit);
      },
      updateFlowVisibility: function () {
        if (this.flowPoints) {
          this.flowPoints.visible = this.flowQuality !== 'static';
          if (this.flowPoints.material?.uniforms?.pointSize) {
            this.flowPoints.material.uniforms.pointSize.value =
              this.visualBudget?.effectiveProfile === 'dense' ? 3
                : this.visualBudget?.effectiveProfile === 'balanced' ? 4 : 5;
          }
        }
        Object.values(this.edgeRecords).forEach(function (record) {
          if (!record.remove) { this.updateEdgeGeometry(record); }
        }, this);
        this.flushEdgeBatches();
      },
      updateFlow: function (time) {
        if (!root.THREE) { return; }
        var records = this.activeFlowEdges();
        if (!records.length) {
          if (this.flowGeometry) { this.flowGeometry.setDrawRange(0, 0); }
          this.lastFlowCount = 0;
          return;
        }
        this.ensureFlowLayer(records.length);
        var selection = this.pinnedSelection || this.hoveredSelection;
        var count = 0;
        records.forEach(function (record, index) {
          var source = this.nodes[record.data.source]?.el?.object3D?.position;
          var target = this.nodes[record.data.target]?.el?.object3D?.position;
          if (!source || !target) { return; }
          var phase = ((time * .00042) + ((index * .137) % 1)) % 1;
          var position = source.clone().lerp(target, phase);
          this.flowPositions[count * 3] = position.x;
          this.flowPositions[count * 3 + 1] = position.y;
          this.flowPositions[count * 3 + 2] = position.z;
          var color = new root.THREE.Color(record.style?.color || '#fcd34d');
          if (selection?.type === 'node') {
            color.set(record.data.source === selection.id ? '#22d3ee' : '#fbbf24');
          }
          this.flowColors[count * 3] = color.r;
          this.flowColors[count * 3 + 1] = color.g;
          this.flowColors[count * 3 + 2] = color.b;
          count += 1;
        }, this);
        this.flowGeometry.setDrawRange(0, count);
        this.flowGeometry.getAttribute('position').needsUpdate = true;
        this.flowGeometry.getAttribute('color').needsUpdate = true;
        this.flowPoints.visible = count > 0;
        this.lastFlowCount = count;
      },
      updateTransition: function (time, forceComplete) {
        if (!this.transition || !root.THREE) { return; }
        if (this.transition.startedAt === null) {
          this.transition.startedAt = time;
        }
        var duration = Math.max(0, Number(this.transition.duration || 0));
        var raw = forceComplete || duration === 0
          ? 1
          : Math.min(1, Math.max(0, (time - this.transition.startedAt) / duration));
        this.el.setAttribute('data-codexr-transition-progress', raw.toFixed(3));
        var progress = raw * raw * (3 - (2 * raw));
        this.graphTopY = GRAPH_BASE_Y + GRAPH_HEIGHT;
        this.transition.nodes.forEach(function (item) {
          item.record.el.object3D.position.lerpVectors(item.fromPosition, item.toPosition, progress);
          var scale = item.fromScale + ((item.toScale - item.fromScale) * progress);
          item.record.el.object3D.scale.setScalar(scale);
          var opacity = item.fromOpacity + ((item.toOpacity - item.fromOpacity) * progress);
          var color = item.fromColor.clone().lerp(item.toColor, progress);
          item.record.el.setAttribute('material', 'opacity', opacity);
          item.record.el.setAttribute('material', 'color', '#' + color.getHexString());
          item.record.el.setAttribute('material', 'transparent', opacity < 1);
          this.graphTopY = Math.max(
            this.graphTopY,
            item.record.el.object3D.position.y + Number(item.record.targetRadius || item.record.radius || 0)
          );
        }, this);
        Object.keys(this.edgeRecords).forEach(function (edgeId) {
          var record = this.edgeRecords[edgeId];
          this.updateEdgeGeometry(record);
        }, this);
        this.flushEdgeBatches();
        this.positionPinnedTooltip();
        if (raw < 1) {
          this.scheduleTransitionFrame();
          return;
        }

        this.transition.nodes.filter(function (item) { return item.remove; }).forEach(function (item) {
          item.record.el.remove?.();
          delete this.nodes[item.id];
        }, this);
        this.transition.nodes.filter(function (item) { return !item.remove; }).forEach(function (item) {
          var targetRadius = item.record.targetRadius || item.record.radius;
          if (item.record.shape === 'box' || item.record.shape === 'portal') {
            item.record.el.setAttribute('width', item.record.shape === 'portal' ? targetRadius * 2.8 : targetRadius * 1.7);
            item.record.el.setAttribute('height', item.record.shape === 'portal' ? targetRadius * 1.8 : targetRadius * 1.7);
            item.record.el.setAttribute('depth', item.record.shape === 'portal' ? targetRadius * .6 : targetRadius * 1.7);
          } else {
            item.record.el.setAttribute('radius', targetRadius);
          }
          item.record.radius = targetRadius;
          item.record.targetRadius = null;
          item.record.el.object3D.scale.setScalar(1);
        });
        Object.keys(this.edgeRecords).forEach(function (edgeId) {
          var record = this.edgeRecords[edgeId];
          if (!record.remove) { return; }
          record.el.remove?.();
          record.hitMesh.geometry?.dispose?.();
          record.hitMesh.material?.dispose?.();
          delete this.edgeRecords[edgeId];
        }, this);
        this.edgeObjects = Object.values(this.edgeRecords).flatMap(function (record) {
          return [record.hitMesh];
        });
        this.clearAxes();
        this.drawAxes();
        if (this.pinnedSelection) {
          var pinnedRecord = this.pinnedSelection.type === 'node'
            ? this.nodes[this.pinnedSelection.id]
            : this.edgeRecords[this.pinnedSelection.id];
          if (!pinnedRecord) {
            this.pinnedSelection = null;
            this.hideTooltip();
          } else {
            this.restorePinnedSelection();
          }
        }
        this.transition = null;
        this.transitionFrame = null;
        this.el.removeAttribute('data-codexr-transition-progress');
      },
      clearAxes: function () {
        (this.axisObjects || []).forEach(function (object) {
          object.parent?.remove?.(object);
          object.geometry?.dispose?.();
          object.material?.dispose?.();
        });
        this.axisObjects = [];
        this.axesRoot?.remove?.();
        this.axesRoot = null;
      },
      addAxisLine: function (start, end, color) {
        var geometry = new root.THREE.BufferGeometry().setFromPoints([start, end]);
        var line = new root.THREE.Line(geometry, new root.THREE.LineBasicMaterial({
          color: color, transparent: true, opacity: .9
        }));
        this.el.object3D.add(line);
        this.axisObjects.push(line);
        return line;
      },
      addAxisArrow: function (position, direction, color) {
        var geometry = new root.THREE.ConeGeometry(.055, .18, 8);
        var material = new root.THREE.MeshBasicMaterial({ color: color });
        var arrow = new root.THREE.Mesh(geometry, material);
        arrow.position.copy(position);
        arrow.quaternion.setFromUnitVectors(
          new root.THREE.Vector3(0, 1, 0),
          direction.clone().normalize()
        );
        this.el.object3D.add(arrow);
        this.axisObjects.push(arrow);
        return arrow;
      },
      addAxisLabel: function (value, position, color, width, align) {
        var label = text(value, position.x + ' ' + position.y + ' ' + position.z, width || 1.2, color, align || 'center');
        label.setAttribute('wrap-count', 24);
        this.axesRoot.appendChild(label);
        return label;
      },
      drawAxes: function () {
        if (!root.THREE) { return; }
        this.axesRoot = entity('a-entity', { 'data-codexr-dependency-axes': 'true' });
        this.el.appendChild(this.axesRoot);
        var origin = new root.THREE.Vector3(-GRAPH_WIDTH / 2, .035, -GRAPH_DEPTH / 2);
        var xEnd = new root.THREE.Vector3(GRAPH_WIDTH / 2, .035, -GRAPH_DEPTH / 2);
        var zEnd = new root.THREE.Vector3(-GRAPH_WIDTH / 2, .035, GRAPH_DEPTH / 2);
        var yEnd = new root.THREE.Vector3(-GRAPH_WIDTH / 2, GRAPH_BASE_Y + GRAPH_HEIGHT, -GRAPH_DEPTH / 2);
        var self = this;
        var drawTicks = function (axis, scale, metric, color) {
          scale.ticks.forEach(function (value) {
            var ratio = value / Math.max(1, scale.maximum);
            var position;
            if (axis === 'x') {
              position = new root.THREE.Vector3(origin.x + GRAPH_WIDTH * ratio, origin.y, origin.z);
              self.addAxisLine(
                position.clone().add(new root.THREE.Vector3(0, 0, -.035)),
                position.clone().add(new root.THREE.Vector3(0, 0, .035)),
                color
              );
              self.addAxisLabel(formatAxisValue(value), position.clone().add(new root.THREE.Vector3(0, .08, -.11)), color, .72);
            } else if (axis === 'z') {
              position = new root.THREE.Vector3(origin.x, origin.y, origin.z + GRAPH_DEPTH * ratio);
              self.addAxisLine(
                position.clone().add(new root.THREE.Vector3(-.035, 0, 0)),
                position.clone().add(new root.THREE.Vector3(.035, 0, 0)),
                color
              );
              self.addAxisLabel(formatAxisValue(value), position.clone().add(new root.THREE.Vector3(-.13, .08, 0)), color, .72, 'right');
            } else {
              position = new root.THREE.Vector3(origin.x, GRAPH_BASE_Y + GRAPH_HEIGHT * ratio, origin.z);
              self.addAxisLine(
                position.clone().add(new root.THREE.Vector3(-.035, 0, 0)),
                position.clone().add(new root.THREE.Vector3(.035, 0, 0)),
                color
              );
              self.addAxisLabel(formatAxisValue(value), position.clone().add(new root.THREE.Vector3(-.14, 0, 0)), color, .72, 'right');
            }
          });
          var end = axis === 'x' ? xEnd : axis === 'z' ? zEnd : yEnd;
          var offset = axis === 'x'
            ? new root.THREE.Vector3(-.25, .2, -.05)
            : axis === 'z'
              ? new root.THREE.Vector3(-.2, .2, -.12)
              : new root.THREE.Vector3(.15, .12, 0);
          self.addAxisLabel(axis.toUpperCase() + ': ' + metric, end.clone().add(offset), color, 1.7, axis === 'y' ? 'left' : 'center');
        };
        this.addAxisLine(origin, yEnd, 0x4ade80);
        this.addAxisArrow(yEnd, new root.THREE.Vector3(0, 1, 0), 0x4ade80);
        drawTicks('y', this.metricScales.y, this.view.mapping?.height || 'fanIn', '#4ade80');
        if (this.view.layout === 'metric-space') {
          this.addAxisLine(origin, xEnd, 0xfb7185);
          this.addAxisLine(origin, zEnd, 0x60a5fa);
          this.addAxisArrow(xEnd, new root.THREE.Vector3(1, 0, 0), 0xfb7185);
          this.addAxisArrow(zEnd, new root.THREE.Vector3(0, 0, 1), 0x60a5fa);
          drawTicks('x', this.metricScales.x, this.view.mapping?.x || 'fanOut', '#fb7185');
          drawTicks('z', this.metricScales.z, this.view.mapping?.z || 'fanIn', '#60a5fa');
        }
      },
      ensureTooltip: function () {
        if (this.tooltip?.root?.parentNode) { return this.tooltip; }
        if (root.CodeXRCommonRuntime?.createTooltip) {
          this.tooltip = root.CodeXRCommonRuntime.createTooltip({ accentColor: '#f59e0b' });
          this.el.appendChild(this.tooltip.root);
          return this.tooltip;
        }
        var tooltipRoot = entity('a-entity', { visible: false });
        var background = entity('a-plane', {
          width: 3.25, height: 1.42,
          material: 'color: #0f172a; opacity: .94; shader: flat; side: double'
        });
        var title = text('', '0 .2 .018', 3, '#fcd34d', 'center');
        var primary = text('', '0 -.18 .018', 2.95, '#f8fafc', 'center');
        tooltipRoot.appendChild(background);
        tooltipRoot.appendChild(title);
        tooltipRoot.appendChild(primary);
        this.el.appendChild(tooltipRoot);
        this.tooltip = {
          root: tooltipRoot, background: background, title: title,
          subtitle: primary, primary: primary, secondary: primary, action: null
        };
        return this.tooltip;
      },
      positionPinnedTooltip: function () {
        if (!this.pinnedSelection || !this.tooltip?.root?.getAttribute('visible') || !root.THREE) { return; }
        var record = this.pinnedSelection.type === 'node'
          ? this.nodes[this.pinnedSelection.id]
          : this.edgeRecords[this.pinnedSelection.id];
        if (!record) { return; }
        var anchor = this.pinnedSelection.type === 'node'
          ? record.el.object3D.position
          : record.midpoint;
        this.tooltip.root.setAttribute('position',
          Math.max(-1.55, Math.min(1.55, Number(anchor.x || 0)))
          + ' ' + (this.graphTopY + 1.08) + ' .18'
        );
      },
      showSelection: function (selection) {
        var tooltip = this.ensureTooltip();
        var record = selection.type === 'node'
          ? this.nodes[selection.id]
          : this.edgeRecords[selection.id];
        if (!record) {
          if (this.pinnedSelection
              && this.pinnedSelection.type === selection.type
              && this.pinnedSelection.id === selection.id) {
            this.pinnedSelection = null;
          }
          tooltip.root.setAttribute('visible', false);
          return;
        }
        var anchor = selection.type === 'node' ? record.el.object3D.position : record.midpoint;
        var position = new root.THREE.Vector3(
          Math.max(-1.55, Math.min(1.55, Number(anchor.x || 0))),
          this.graphTopY + 1.08,
          .18
        );
        var detail = selection.type === 'node'
          ? nodeDetailModel(record.data)
          : edgeDetailModel(record.data, this.nodes);
        if (tooltip.action?.parentNode) { tooltip.action.parentNode.removeChild(tooltip.action); }
        tooltip.action = null;
        var canNavigate = selection.type === 'node'
          && (record.data.kind === 'group' || record.data.kind === 'file' || record.data.syntheticExternal);
        if (root.CodeXRCommonRuntime?.updateTooltip) {
          root.CodeXRCommonRuntime.updateTooltip(tooltip, detail, position, {
            height: canNavigate ? 1.78 : 1.42
          });
        } else {
          tooltip.root.setAttribute('position', position.x + ' ' + position.y + ' ' + position.z);
          tooltip.title.setAttribute('value', truncateText(detail.title, 42));
          tooltip.subtitle.setAttribute('value', truncateText(detail.subtitle, 60));
          tooltip.primary.setAttribute('value', truncateText(detail.primary, 68));
          tooltip.secondary.setAttribute('value', truncateText(detail.secondary, 68));
          tooltip.root.setAttribute('visible', true);
          tooltip.background.setAttribute('height', canNavigate ? 1.78 : 1.42);
        }
        if (canNavigate) {
          var actionLabel = record.data.syntheticExternal
            ? 'Show external details'
            : record.data.syntheticKind === 'parent'
              ? 'Go to parent'
              : record.data.syntheticKind === 'directory'
                ? 'Open folder'
                : record.data.kind === 'file'
                  ? 'Open file'
                  : 'Open';
          tooltip.action = button(
            actionLabel,
            '0 -0.7 0.02',
            record.data.syntheticExternal ? 2.15 : 1.55,
            function (event) {
              event.stopPropagation?.();
              if (record.data.syntheticExternal) {
                publishState({ showExternal: true });
              } else if (record.data.kind === 'file') {
                openFile(record.data.relativePath || record.data.label);
              } else {
                openDirectory(record.data.navigationPath || record.data.relativePath || '');
              }
            },
            record.data.syntheticExternal ? '#c2410c' : '#7c3aed'
          );
          tooltip.root.appendChild(tooltip.action);
        }
        this.applyHighlight(selection);
      },
      hideTooltip: function () {
        if (root.CodeXRCommonRuntime?.hideTooltip) {
          root.CodeXRCommonRuntime.hideTooltip(this.tooltip);
        } else if (this.tooltip?.root) {
          this.tooltip.root.setAttribute('visible', false);
        }
        this.clearHighlight();
      },
      showTransientSelection: function (selection) {
        if (this.pinnedSelection) { return; }
        this.hoveredSelection = selection;
        this.showSelection(selection);
      },
      hideTransientSelection: function (selection) {
        if (this.pinnedSelection
            || this.hoveredSelection?.type !== selection.type
            || this.hoveredSelection?.id !== selection.id) { return; }
        this.hoveredSelection = null;
        this.hideTooltip();
      },
      togglePinnedSelection: function (selection) {
        var isSame = this.pinnedSelection?.type === selection.type
          && this.pinnedSelection?.id === selection.id;
        this.pinnedSelection = isSame ? null : selection;
        this.hoveredSelection = null;
        if (this.pinnedSelection) { this.showSelection(this.pinnedSelection); }
        else { this.hideTooltip(); }
      },
      restorePinnedSelection: function () {
        if (this.pinnedSelection) { this.showSelection(this.pinnedSelection); }
      },
      applyHighlight: function (selection) {
        var related = new Set();
        if (selection.type === 'node') {
          related.add(selection.id);
          (this.dataset?.edges || []).forEach(function (edge) {
            if (edge.source === selection.id) { related.add(edge.target); }
            if (edge.target === selection.id) { related.add(edge.source); }
          });
        } else {
          var edge = this.edgeRecords[selection.id]?.data;
          if (edge) { related.add(edge.source); related.add(edge.target); }
        }
        Object.keys(this.nodes).forEach(function (nodeId) {
          this.nodes[nodeId].highlightTarget = related.has(nodeId) ? 1 : .18;
          this.nodes[nodeId].highlightColor = related.has(nodeId);
        }, this);
        Object.keys(this.edgeRecords).forEach(function (edgeId) {
          var record = this.edgeRecords[edgeId];
          var selected = selection.type === 'edge'
            ? edgeId === selection.id
            : record.data.source === selection.id || record.data.target === selection.id;
          record.highlighted = selected;
        }, this);
        this.selectionStartedAt = root.performance?.now?.() || Date.now();
        this.ensureSelectionHalo(selection);
        this.refreshEdgeColors(selection);
        this.rebuildFocusEdges();
        this.updateFlowVisibility();
        var detail = selection.type === 'node'
          ? nodeDetailModel(this.nodes[selection.id]?.data)
          : edgeDetailModel(this.edgeRecords[selection.id]?.data, this.nodes);
        setStatus([detail.title, detail.subtitle, detail.primary, detail.secondary].join(' | '), false);
      },
      clearHighlight: function () {
        Object.keys(this.nodes).forEach(function (nodeId) {
          this.nodes[nodeId].highlightTarget = 1;
          this.nodes[nodeId].highlightColor = false;
        }, this);
        Object.keys(this.edgeRecords).forEach(function (edgeId) {
          this.edgeRecords[edgeId].highlighted = false;
        }, this);
        this.disposeSelectionHalo();
        this.refreshEdgeColors(null);
        this.disposeFocusEdges();
        this.updateFlowVisibility();
        setStatus('', false);
      },
      selectNode: function (id) {
        this.togglePinnedSelection({ type: 'node', id: id });
      },
      getDebugSnapshot: function () {
        var visibleRecords = Object.values(this.edgeRecords || {}).filter(function (record) {
          return !record.remove && record.batch;
        });
        var activeSelection = this.pinnedSelection || this.hoveredSelection || null;
        return {
          layout: this.view?.layout || null,
          scope: this.view?.scope ? Object.assign({}, this.view.scope) : null,
          mapping: Object.assign({}, this.view?.mapping || {}),
          edgeEncoding: this.view?.edgeEncoding || 'relation-type',
          datasetNodes: Number(state.dataset?.nodes?.length || this.dataset?.nodes?.length || 0),
          datasetEdges: Number(state.dataset?.edges?.length || this.dataset?.edges?.length || 0),
          visibleNodes: Object.keys(this.nodes || {}).length,
          visibleEdges: visibleRecords.length,
          arrowCount: visibleRecords.filter(function (record) {
            return this.visualBudget?.arrowsForAll || this.focusEdgeIds.has(record.data.id);
          }, this).length,
          animatedFlowCount: Number(this.lastFlowCount || 0),
          focusEdgeCount: Number(this.focusEdgeObjects?.length || 0),
          selection: activeSelection ? Object.assign({}, activeSelection) : null,
          transitionActive: !!this.transition,
          transitionProgress: this.el.getAttribute('data-codexr-transition-progress') || null,
          layoutGeneration: Number(this.layoutGeneration || 0),
          detailOverride: this.visualBudget?.override || 'auto',
          densityProfile: this.visualBudget?.profile || 'unknown',
          effectiveProfile: this.visualBudget?.effectiveProfile || 'unknown'
        };
      }
    });
  }

  function numericGradient(value, maxValue) {
    var ratio = Math.max(0, Math.min(1, Number(value || 0) / Math.max(1, Number(maxValue || 1))));
    var red = Math.round(38 + (217 * ratio));
    var green = Math.round(198 - (110 * ratio));
    var blue = Math.round(218 - (174 * ratio));
    return '#' + [red, green, blue].map(function (part) {
      return part.toString(16).padStart(2, '0');
    }).join('');
  }

  function renderGraph() {
    if (!state.active || !state.dataset || !state.snapshot || state.snapshot.status !== 'ready') { return; }
    parkOriginal();
    if (refs.graph && !refs.graph.isConnected) {
      refs.graph = null;
    }
    if (!refs.graph) {
      refs.graph = entity('a-entity', {
        id: 'codexrDependencyGraph',
        position: '0 1.02 -18',
        'data-codexr-analysis-root': 'true',
        'data-codexr-analysis-mode': 'dependency-graph',
        'codexr-dependency-graph': ''
      });
      refs.graph.addEventListener('componentinitialized', function (event) {
        if (event?.detail?.name !== COMPONENT) { return; }
        renderCurrentGraphIfReady();
      });
      if (root.CodeXRAnalysisSurfaceRuntime?.mountRoot) {
        root.CodeXRAnalysisSurfaceRuntime.mountRoot('dependency-graph', refs.graph);
      } else {
        doc()?.querySelector('a-scene')?.appendChild(refs.graph);
      }
    } else {
      root.CodeXRAnalysisSurfaceRuntime?.mountRoot?.('dependency-graph', refs.graph);
    }
    var graph = filteredDataset();
    renderGraphWhenReady(graph, state.snapshot, state.viewGeneration, 0);
  }

  function renderCurrentGraphIfReady() {
    if (!state.active || !state.dataset || state.snapshot?.status !== 'ready') { return; }
    var component = refs.graph?.components?.[COMPONENT];
    if (!component?.setGraph) { return; }
    component.setGraph(filteredDataset(), state.snapshot);
  }

  function renderGraphWhenReady(graph, snapshot, viewGeneration, attempt) {
    if (!state.active || state.snapshot !== snapshot || state.viewGeneration !== viewGeneration) { return; }
    if (!refs.graph?.isConnected) {
      scheduleGraphRenderRetry(graph, snapshot, viewGeneration, attempt);
      return;
    }
    var component = refs.graph.components?.[COMPONENT];
    if (component?.setGraph) {
      component.setGraph(graph, snapshot);
      return;
    }
    scheduleGraphRenderRetry(graph, snapshot, viewGeneration, attempt);
  }

  function scheduleGraphRenderRetry(graph, snapshot, viewGeneration, attempt) {
    if (attempt >= 120) {
      setStatus('Dependency graph component could not be initialized.', true);
      return;
    }
    var timer = setTimeout(function () {
      state.retryTimers.delete(timer);
      renderGraphWhenReady(graph, snapshot, viewGeneration, attempt + 1);
    }, 50);
    state.retryTimers.add(timer);
  }

  function resetView() {
    if (state.transitionLocked) { return; }
    refs.graph?.components?.[COMPONENT]?.resetView?.();
    var rig = doc()?.getElementById('rig');
    rig?.setAttribute?.('position', '0.07 1.75 -10.75');
    rig?.setAttribute?.('rotation', '0 0 0');
    setStatus('View reset.', false);
  }

  async function applySharedState(snapshot) {
    snapshot = snapshot ? Object.assign({
      edgeEncoding: 'relation-type',
      scope: { kind: 'directory', relativePath: '' }
    }, snapshot) : snapshot;
    state.snapshot = snapshot;
    if (!snapshot) {
      renderControls();
      return;
    }
    if (!isDependencyModeActiveOrActivating()) {
      renderControls();
      return;
    }
    renderControls();
    if (snapshot.status !== 'ready' || !snapshot.datasetUrl) {
      setStatus(snapshot.message || 'Analyzing dependencies...', false);
      if (snapshot.status === 'error') {
        setTransitionLocked(false);
      }
      return;
    }
    try {
      var loadGeneration = ++state.datasetLoadGeneration;
      var viewGeneration = state.viewGeneration;
      var response = await fetch(snapshot.datasetUrl + '?revision=' + snapshot.revision, { cache: 'no-store' });
      if (!response.ok) { throw new Error('Dependency dataset could not be loaded.'); }
      var dataset = await response.json();
      if (
        loadGeneration !== state.datasetLoadGeneration
        || viewGeneration !== state.viewGeneration
        || state.snapshot !== snapshot
        || !state.active
      ) {
        return;
      }
      state.dataset = dataset;
      if (dataset.targetType === 'directory') {
        state.projectDataset = dataset;
      } else {
        var fileKey = normalizeRelativePath(
          dataset.targetRelativePath || snapshot.scope?.relativePath
        );
        state.fileDatasets[fileKey] = dataset;
      }
      if (snapshot.projectDatasetUrl) {
        var projectResponse = await fetch(
          snapshot.projectDatasetUrl + '?sourceRevision=' + Number(snapshot.sourceRevision || 0),
          { cache: 'no-store' }
        );
        if (
          projectResponse.ok
          && loadGeneration === state.datasetLoadGeneration
          && viewGeneration === state.viewGeneration
          && state.active
        ) {
          var projectDataset = await projectResponse.json();
          if (projectDataset?.targetType === 'directory') {
            state.projectDataset = projectDataset;
          }
        }
      }
      renderGraph();
      setTransitionLocked(false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error), true);
      setTransitionLocked(false);
    }
  }

  async function start() {
    if (state.availability !== 'enabled') {
      setStatus(state.unavailableReason, true);
      return;
    }
    if (state.transitionLocked) { return; }
    setTransitionLocked(true, 'Opening dependencies...');
    await root.CodeXRAnalysisModeRuntime?.transitionTo?.('selection', {
      reason: 'dependency-refresh'
    });
    client()?.sendMessage?.('dependency-graph-start', {});
  }
  async function reanalyze() {
    if (state.availability !== 'enabled' || state.transitionLocked) { return; }
    setTransitionLocked(true, 'Re-analyzing dependencies...');
    client()?.sendMessage?.('dependency-graph-start', { forceFull: true });
  }
  function selectDependencyMode() {
    if (state.dataset && state.snapshot?.datasetUrl) {
      root.console?.log?.('[CodeXR.Debug]: Dependency graph mode selected from visualization panel', {
        hasDataset: true,
        datasetUrl: state.snapshot.datasetUrl
      });
      client()?.sendMessage?.('analysis-mode-activate', {
        mode: 'dependency-graph'
      });
      void root.CodeXRAnalysisModeRuntime?.transitionTo?.('dependency-graph', {
        reason: 'local-dependency-mode-option',
        panelViewId: 'dependency-graph'
      });
      return;
    }
    root.console?.log?.('[CodeXR.Debug]: Dependency graph mode selected; starting dependency analysis', {
      hasDataset: !!state.dataset,
      availability: state.availability
    });
    void start();
  }
  async function openModeSelector() {
    return root.CodeXRAnalysisModeRuntime?.openSelector?.();
  }
  async function configureAvailability() {
    try {
      var info = await client()?.getSessionInfoAsync?.();
      state.availability = info?.capabilities?.dependencyGraph === true ? 'enabled' : 'disabled';
      state.unavailableReason = info?.capabilities?.dependencyGraphReason
        || 'Dependency graphs require an XR file, directory, or project analysis.';
    } catch {
      state.availability = 'disabled';
      state.unavailableReason = 'Dependency graph availability could not be checked.';
    }
  }
  function registerCollaboration() {
    var connection = client();
    state.disposables.push(connection?.onMessage?.('dependency-graph-progress', function (message) {
      setStatus(message?.payload?.message || 'Analyzing dependencies...', false);
    }));
    state.disposables.push(connection?.onMessage?.('dependency-graph-error', function (message) {
      setStatus(message?.payload?.message || 'Dependency analysis failed.', true);
      setTransitionLocked(false);
    }));
    connection?.registerEntityRuntime?.({
      entityKind: ENTITY_KIND,
      entityId: ENTITY_ID,
      applySharedState: applySharedState,
      publishInitialSharedState: function () {}
    });
  }
  function mount(attempt) {
    buildPanel();
    if (!state.unregisterLifecycle && root.CodeXRAnalysisModeRuntime?.register) {
      state.unregisterLifecycle = root.CodeXRAnalysisModeRuntime.register('dependency-graph', {
        activate: function () {
          state.active = true;
          state.viewGeneration += 1;
          parkOriginal();
          renderControls();
          if (state.dataset && state.snapshot?.status === 'ready') {
            renderGraph();
            setTransitionLocked(false);
            void applySharedState(state.snapshot);
            return;
          }
          if (state.snapshot) {
            return applySharedState(state.snapshot);
          }
        },
        deactivate: function () {
          disposeView();
        },
        disposeView: disposeView
      });
    }
    if (!state.unregisterMode && root.CodeXRAnalysisModeRuntime?.registerModeOption) {
      state.unregisterMode = root.CodeXRAnalysisModeRuntime.registerModeOption({
        id: 'dependency-graph',
        label: 'Dependency graph',
        color: '#7c3aed',
        onSelect: selectDependencyMode
      });
    }
    if ((!refs.controls || !state.unregisterMode || !state.unregisterLifecycle) && attempt < 30) {
      setTimeout(function () { mount(attempt + 1); }, 100);
    }
  }
  function autoInit() {
    if (state.initialized || !doc()) { return; }
    state.initialized = true;
    registerComponent();
    mount(0);
    registerCollaboration();
    void configureAvailability();
  }
  root.CodeXRDependencyGraphRuntime = {
    autoInit: autoInit,
    start: start,
    openModeSelector: openModeSelector,
    applySharedState: applySharedState,
    resetView: resetView,
    openDirectory: openDirectory,
    openFile: openFile,
    getState: function () { return state; },
    __testing: {
      computeNiceScale: computeNiceScale,
      buildMetricScales: buildMetricScales,
      nodeDetailModel: nodeDetailModel,
      edgeDetailModel: edgeDetailModel,
      intensityBucket: intensityBucket,
      edgeStyle: edgeStyle,
      graphDensityStats: graphDensityStats,
      buildExternalSummaryDataset: buildExternalSummaryDataset,
      projectDirectoryScope: projectDirectoryScope,
      projectFileScope: projectFileScope,
      normalizeRelativePath: normalizeRelativePath,
      symbolVisual: symbolVisual,
      selectDependencyMode: selectDependencyMode
    },
    destroy: function () {
      state.disposables.forEach(function (dispose) { dispose?.(); });
      state.unregisterMode?.();
      state.unregisterPanel?.();
      state.unregisterLifecycle?.();
      state.unregisterLifecycle = null;
      clearRenderRetries();
      disposeView();
      state.initialized = false;
    }
  };
  if (doc()) {
    if (doc().readyState === 'loading') { doc().addEventListener('DOMContentLoaded', autoInit, { once: true }); }
    else { autoInit(); }
  }
})(typeof window !== 'undefined' ? window : this);
