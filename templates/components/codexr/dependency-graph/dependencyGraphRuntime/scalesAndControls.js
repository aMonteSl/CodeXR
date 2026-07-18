// == dependencyGraphRuntime.js | scalesAndControls (assembled per manifest.json; see COMPONENTS.md) ==
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
    if (refs.controls || !root.CodeXRMappingUiRuntime?.registerPanelView) { return; }
    if (!root.CodeXRMappingUiRuntime.isPanelReady?.()) {
      // Event-driven: register as soon as the controller panel exists.
      if (!refs.panelMountQueued) {
        refs.panelMountQueued = true;
        root.CodeXRMappingUiRuntime.whenPanelReady?.(function () {
          refs.panelMountQueued = false;
          buildPanel();
        });
      }
      return;
    }
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
