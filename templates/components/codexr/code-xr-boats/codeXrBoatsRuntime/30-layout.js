// == codeXrBoatsRuntime.js | part 30: layout (assembled with its siblings; see COMPONENTS.md) ==
  function createEmptyBounds() {
    return {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      minZ: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
      maxZ: Number.NEGATIVE_INFINITY
    };
  }

  function expandBounds(bounds, minX, minY, minZ, maxX, maxY, maxZ) {
    bounds.minX = Math.min(bounds.minX, minX);
    bounds.minY = Math.min(bounds.minY, minY);
    bounds.minZ = Math.min(bounds.minZ, minZ);
    bounds.maxX = Math.max(bounds.maxX, maxX);
    bounds.maxY = Math.max(bounds.maxY, maxY);
    bounds.maxZ = Math.max(bounds.maxZ, maxZ);
  }

  function measureFigureBounds(figure, origin, bounds) {
    var ox = origin.x + (figure.x || 0);
    var oy = origin.y;
    var oz = origin.z + (figure.z || 0);
    if (figure.kind === 'building') {
      expandBounds(
        bounds,
        ox - (figure.width * 0.5),
        oy,
        oz - (figure.depth * 0.5),
        ox + (figure.width * 0.5),
        oy + figure.height,
        oz + (figure.depth * 0.5)
      );
      return;
    }

    var quarterHeight = Math.max(0.002, figure.thickness || figure.height || 0);
    expandBounds(
      bounds,
      ox - (figure.width * 0.5),
      oy,
      oz - (figure.depth * 0.5),
      ox + (figure.width * 0.5),
      oy + quarterHeight,
      oz + (figure.depth * 0.5)
    );
    (figure.children || []).forEach(function (child) {
      measureFigureBounds(child, {
        x: ox,
        y: oy + quarterHeight,
        z: oz
      }, bounds);
    });
  }

  function finalizeBounds(bounds) {
    if (!Number.isFinite(bounds.minX) || !Number.isFinite(bounds.minY) || !Number.isFinite(bounds.minZ)) {
      return {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 0, y: 0, z: 0 },
        size: { x: 0, y: 0, z: 0 }
      };
    }
    return {
      min: { x: bounds.minX, y: bounds.minY, z: bounds.minZ },
      max: { x: bounds.maxX, y: bounds.maxY, z: bounds.maxZ },
      size: {
        x: bounds.maxX - bounds.minX,
        y: bounds.maxY - bounds.minY,
        z: bounds.maxZ - bounds.minZ
      }
    };
  }

  function computeLayoutBounds(nodes) {
    var bounds = createEmptyBounds();
    (nodes || []).forEach(function (figure) {
      measureFigureBounds(figure, { x: 0, y: 0, z: 0 }, bounds);
    });
    return finalizeBounds(bounds);
  }

  function shiftFigureY(figure, deltaY) {
    figure.yOffset = (figure.yOffset || 0) + deltaY;
    (figure.children || []).forEach(function (child) {
      shiftFigureY(child, deltaY);
    });
  }

  function shiftFigurePlanar(figure, deltaX, deltaZ) {
    figure.x = (figure.x || 0) + deltaX;
    figure.z = (figure.z || 0) + deltaZ;
  }

  function scaleFigurePlanar(figure, scaleX, scaleZ) {
    figure.x = (figure.x || 0) * scaleX;
    figure.z = (figure.z || 0) * scaleZ;
    figure.width = Math.max(0.001, figure.width * scaleX);
    figure.depth = Math.max(0.001, figure.depth * scaleZ);
    (figure.children || []).forEach(function (child) {
      scaleFigurePlanar(child, scaleX, scaleZ);
    });
  }

  function scaleFigureVertical(figure, scaleY) {
    figure.yOffset = (figure.yOffset || 0) * scaleY;
    figure.height = Math.max(0.001, figure.height * scaleY);
    if (Number.isFinite(figure.thickness)) {
      figure.thickness = Math.max(0.001, figure.thickness * scaleY);
    }
    (figure.children || []).forEach(function (child) {
      scaleFigureVertical(child, scaleY);
    });
  }

  function enforceBuildingHeightFloor(figure, minHeight) {
    if (!figure || !Number.isFinite(minHeight) || minHeight <= 0) {
      return;
    }
    if (figure.kind === 'building') {
      figure.height = Math.max(figure.height || 0, minHeight);
      return;
    }
    (figure.children || []).forEach(function (child) {
      enforceBuildingHeightFloor(child, minHeight);
    });
  }

  function applyFixedRootSlabs(nodes, rootWidth, rootDepth) {
    if (!Array.isArray(nodes) || nodes.length !== 1) {
      return false;
    }
    var rootFigure = nodes[0];
    if (!rootFigure || rootFigure.kind !== 'quarter') {
      return false;
    }
    rootFigure.width = Math.max(rootFigure.width || 0, rootWidth);
    rootFigure.depth = Math.max(rootFigure.depth || 0, rootDepth);
    rootFigure.fixedRootSlab = true;
    return true;
  }

  function normalizeLayoutFloor(nodes) {
    var bounds = computeLayoutBounds(nodes);
    if (bounds.min.y < -0.000001) {
      (nodes || []).forEach(function (figure) {
        shiftFigureY(figure, -bounds.min.y);
      });
      bounds = computeLayoutBounds(nodes);
    }
    return bounds;
  }

  function normalizeLayoutFixedBox(nodes, options) {
    var bounds = normalizeLayoutFloor(nodes);
    if (!options.fixedSize || !nodes || !nodes.length) {
      return bounds;
    }

    var padding = clamp(options.fixedPadding, 0, Math.min(options.fixedWidth, options.fixedDepth, options.fixedHeight) * 0.4);
    var targetWidth = Math.max(0.1, options.fixedWidth - padding * 2);
    var targetDepth = Math.max(0.1, options.fixedDepth - padding * 2);
    var targetHeight = Math.max(0.05, options.fixedHeight);

    var scaleX = bounds.size.x > 0.0001 ? targetWidth / bounds.size.x : 1;
    var scaleZ = bounds.size.z > 0.0001 ? targetDepth / bounds.size.z : 1;
    var scaleY = bounds.size.y > 0.0001 ? targetHeight / bounds.size.y : 1;

    nodes.forEach(function (figure) {
      scaleFigurePlanar(figure, scaleX, scaleZ);
      scaleFigureVertical(figure, scaleY);
    });

    var postScaleBuildingFloor = Math.min(options.minBuildingHeight, targetHeight * 0.5);
    nodes.forEach(function (figure) {
      enforceBuildingHeightFloor(figure, postScaleBuildingFloor);
    });

    bounds = normalizeLayoutFloor(nodes);
    var centerX = (bounds.min.x + bounds.max.x) * 0.5;
    var centerZ = (bounds.min.z + bounds.max.z) * 0.5;
    nodes.forEach(function (figure) {
      shiftFigurePlanar(figure, -centerX, -centerZ);
    });

    var rootSlabFixed = applyFixedRootSlabs(nodes, targetWidth, targetDepth);
    bounds = normalizeLayoutFloor(nodes);
    bounds.fixed = {
      enabled: true,
      width: options.fixedWidth,
      depth: options.fixedDepth,
      height: options.fixedHeight,
      padding: padding,
      contentWidth: targetWidth,
      contentDepth: targetDepth,
      rootWidth: rootSlabFixed ? targetWidth : null,
      rootDepth: rootSlabFixed ? targetDepth : null,
      scaleX: scaleX,
      scaleY: scaleY,
      scaleZ: scaleZ,
      buildingHeightFloor: postScaleBuildingFloor
    };
    return bounds;
  }

  function buildLayout(tree, options) {
    var roots = Array.isArray(tree) ? tree : [];
    var leaves = collectLeaves(roots, []);
    var heightValues = leaves.map(function (leaf) {
      return toFiniteNumber(leaf && leaf[options.heightField], 0);
    });
    var stats = {
      heightMin: heightValues.length ? Math.min.apply(Math, heightValues) : 0,
      heightMax: heightValues.length ? Math.max.apply(Math, heightValues) : 0,
      heightAvg: average(heightValues),
      heightP25: percentile(heightValues, 0.25),
      heightP50: percentile(heightValues, 0.5),
      leafCount: leaves.length,
      maxDepth: maxDepth(roots, 0),
      color: buildColorStats(leaves, options.colorField),
      temporal: getVisualStyleRuntime().buildTemporalStats(leaves),
      categoryColorMap: {}
    };
    var nodes = roots.map(function (node, index) {
      return normalizeNode(node, options, stats, 0, index, '');
    });
    var rootLayout = layoutChildren(nodes, options.separation * 1.25, options.border * options.extra);
    var bounds = normalizeLayoutFixedBox(nodes, options);
    return {
      nodes: nodes,
      width: options.fixedSize ? options.fixedWidth : rootLayout.width,
      depth: options.fixedSize ? options.fixedDepth : rootLayout.depth,
      bounds: bounds,
      stats: stats
    };
  }
