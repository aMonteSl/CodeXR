// == codeXrBoatsRuntime.js | part 80: building-rendering (assembled with its siblings; see COMPONENTS.md) ==
  function renderBuilding(component, parent, figure, options, snapshots, origin) {
    var localOrigin = origin || { x: 0, y: 0, z: 0 };
    var position = figure.x + ' ' + ((figure.yOffset || 0) + (figure.height * 0.5)) + ' ' + figure.z;
    figure.tooltipPosition = {
      x: localOrigin.x + figure.x,
      y: localOrigin.y + (figure.yOffset || 0) + figure.height,
      z: localOrigin.z + figure.z
    };
    var visualStyle = getVisualStyleRuntime();
    var profile = visualStyle.getTemporalStyleProfile(figure.temporalTier);
    var buildingOpacity = 0.001;
    var entity = createEntity('a-box', {
      width: figure.width,
      depth: figure.depth,
      height: figure.height,
      position: position,
      material: metricEnvelopeMaterial(),
      class: PRIMARY_CLASS + ' ' + RAYCAST_CLASS,
      'data-codexr-visible-body': 'metric-envelope'
    });
    setFigureMetadata(entity, figure, 'building');
    registerFigureElement(component, entity, figure);
    entity.babiaRawData = figure.raw;
    entity.setAttribute('data-codexr-base-opacity', buildingOpacity);
    entity.setAttribute('data-codexr-base-color', figure.color);
    entity.setAttribute('data-codexr-temporal-tier', figure.temporalTier || 'current');
    component.visiblePieceCount = (component.visiblePieceCount || 0) + renderVisibleBuildingPieces(entity, figure, profile, options);
    parent.appendChild(entity);

    if (options.legend) {
      entity.setAttribute('title', formatLegend(options.legendText, figure, options));
    }
    animateElement(entity, figure, options, snapshots, {
      position: position,
      parentOrigin: localOrigin,
      parentKey: localOrigin.parentKey || null,
      width: figure.width,
      height: figure.height,
      depth: figure.depth,
      color: figure.color,
      opacity: buildingOpacity
    });
    return entity;
  }

  function renderQuarter(parent, figure, options, depth, component, snapshots, origin) {
    var localOrigin = origin || { x: 0, y: 0, z: 0 };
    var groupPosition = (figure.x || 0) + ' ' + (figure.yOffset || 0) + ' ' + (figure.z || 0);
    var groupOrigin = {
      x: localOrigin.x + (figure.x || 0),
      y: localOrigin.y + (figure.yOffset || 0),
      z: localOrigin.z + (figure.z || 0)
    };
    var group = createEntity('a-entity', {
      position: groupPosition,
      'data-codexr-boats-kind': 'quarter',
      'data-codexr-boats-key': figure.key,
      'data-codexr-boats-name': figure.name,
      'data-codexr-boats-path': figure.path || figure.name
    });
    group.codexrBoatsFigure = figure;
    parent.appendChild(group);
    animateElement(group, figure, options, snapshots, {
      position: groupPosition,
      parentOrigin: localOrigin,
      parentKey: localOrigin.parentKey || null,
      snapshotRole: 'frame'
    });

    var baseHeight = Math.max(0.002, figure.thickness || figure.height);
    var basePosition = '0 ' + (baseHeight * 0.5) + ' 0';
    figure.tooltipPosition = {
      x: groupOrigin.x,
      y: groupOrigin.y + baseHeight,
      z: groupOrigin.z
    };
    var base = createEntity('a-box', {
      width: figure.width,
      depth: figure.depth,
      height: baseHeight,
      position: basePosition,
      material: 'color: ' + figure.color + '; opacity: ' + figure.alpha + '; transparent: ' + (figure.alpha < 1),
      class: PRIMARY_CLASS + ' ' + RAYCAST_CLASS
    });
    setFigureMetadata(base, figure, 'quarter-base');
    registerFigureElement(component, base, figure);
    base.setAttribute('data-codexr-base-opacity', figure.alpha);
    base.setAttribute('data-codexr-base-color', figure.color);
    group.appendChild(base);
    attachHoverHandlers(component, base, figure);
    animateElement(base, figure, options, snapshots, {
      position: basePosition,
      parentOrigin: groupOrigin,
      parentKey: figure.key,
      snapshotRole: 'visual',
      animatePosition: false,
      holdPlanarSize: true,
      width: figure.width,
      height: baseHeight,
      depth: figure.depth,
      color: figure.color,
      opacity: figure.alpha
    });

    if (options.legend && !options.hideQuarterBoxLegend && depth <= 1) {
      renderText(group, figure.name, '0 ' + Math.max(options.heightQuarterLegendBox, 0.08) + ' 0', Math.max(2.8, figure.width * 1.4), '#132118');
    }

    var childLayer = createEntity('a-entity', {
      position: '0 ' + baseHeight + ' 0',
      'data-codexr-boats-layer': 'children'
    });
    group.appendChild(childLayer);
    var childOrigin = {
      x: groupOrigin.x,
      y: groupOrigin.y + baseHeight,
      z: groupOrigin.z,
      parentKey: figure.key
    };

    figure.children.forEach(function (child) {
      if (child.kind === 'building') {
        var building = renderBuilding(component, childLayer, child, options, snapshots, childOrigin);
        attachHoverHandlers(component, building, child);
      } else {
        renderQuarter(childLayer, child, options, depth + 1, component, snapshots, childOrigin);
      }
    });
    return group;
  }

  function renderLayout(component, layout) {
    var el = component.el;
    var oldRenderRoots = collectRenderRoots(el);
    var activeRenderRoot = getActiveRenderRoot(component);
    var snapshots = collectElementSnapshots(activeRenderRoot);
    var snapshotKeys = Object.keys(snapshots);
    var animationDuration = component.options.animation && snapshotKeys.length
      ? Math.max(0, Number(component.options.animationDuration) || 0)
      : 0;
    component.animationState = {
      active: animationDuration > 0,
      startedAt: Date.now(),
      duration: animationDuration,
      stableKeys: snapshotKeys
    };
    component.hideTooltip();
    component.figureElements = {};
    component.visiblePieceCount = 0;
    var rootGroup = createEntity('a-entity', {
      class: 'codexr-boats-root',
      'data-codexr-boats-root': 'true'
    });
    component.pendingRenderRoot = rootGroup;
    el.appendChild(rootGroup);
    if (oldRenderRoots.length) {
      setRenderRootVisible(rootGroup, false);
    } else {
      component.activeRenderRoot = rootGroup;
      component.pendingRenderRoot = null;
    }
    component.ensureTooltip();
    layout.nodes.forEach(function (figure) {
      if (figure.kind === 'building') {
        var building = renderBuilding(component, rootGroup, figure, component.options, snapshots, { x: 0, y: 0, z: 0 });
        attachHoverHandlers(component, building, figure);
      } else {
        renderQuarter(rootGroup, figure, component.options, 0, component, snapshots, { x: 0, y: 0, z: 0 });
      }
    });
    component.layout = layout;
    component.refreshPinnedTooltips();
    state.charts[el.id || component.runtimeId] = {
      id: el.id || component.runtimeId,
      layout: layout,
      options: component.options,
      animation: component.animationState,
      bounds: layout.bounds,
      temporal: layout.stats && layout.stats.temporal,
      skinAssetCounts: layout.stats && layout.stats.temporal && layout.stats.temporal.skinCounts,
      shapeCounts: layout.stats && layout.stats.temporal && layout.stats.temporal.shapeCounts,
      visiblePieceCount: component.visiblePieceCount || 0,
      hoverableCount: el.querySelectorAll ? el.querySelectorAll('[data-codexr-boats-key]').length : 0,
      pinnedTooltipCount: Object.keys(component.pinnedTooltips || {}).length
    };
    if (component.animationTimer) {
      clearTimeout(component.animationTimer);
      component.animationTimer = null;
    }
    if (oldRenderRoots.length) {
      var swapRenderRoots = function () {
        setRenderRootVisible(rootGroup, true);
        component.activeRenderRoot = rootGroup;
        component.pendingRenderRoot = null;
        removeRenderRoots(oldRenderRoots.filter ? oldRenderRoots.filter(function (rootEl) {
          return rootEl !== rootGroup;
        }) : oldRenderRoots);
      };
      if (typeof root.requestAnimationFrame === 'function') {
        root.requestAnimationFrame(swapRenderRoots);
      } else {
        setTimeout(swapRenderRoots, 0);
      }
    }
    if (animationDuration > 0) {
      component.animationTimer = setTimeout(function () {
        component.animationTimer = null;
        component.animationState.active = false;
        if (state.charts[el.id || component.runtimeId]) {
          state.charts[el.id || component.runtimeId].animation = component.animationState;
        }
        el.emit?.('codexr-boats-rendered', {
          width: layout.width,
          depth: layout.depth,
          buildingCount: layout.stats.leafCount,
          animated: true
        });
      }, animationDuration);
    } else {
      el.emit?.('codexr-boats-rendered', {
        width: layout.width,
        depth: layout.depth,
        buildingCount: layout.stats.leafCount,
        animated: false
      });
    }
  }
