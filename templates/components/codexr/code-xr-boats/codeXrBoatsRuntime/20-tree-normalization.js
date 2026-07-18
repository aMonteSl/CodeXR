// == codeXrBoatsRuntime.js | part 20: tree-normalization (assembled with its siblings; see COMPONENTS.md) ==
  function formatModifiedAt(value) {
    if (!Number.isFinite(value)) {
      return 'Unknown';
    }
    try {
      return new Date(value).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
    } catch (error) {
      return 'Unknown';
    }
  }

  function average(values) {
    var numeric = (values || []).filter(Number.isFinite);
    if (!numeric.length) {
      return 0;
    }
    return numeric.reduce(function (sum, value) { return sum + value; }, 0) / numeric.length;
  }

  function percentile(values, ratio) {
    var numeric = (values || []).filter(Number.isFinite).slice().sort(function (a, b) { return a - b; });
    if (!numeric.length) {
      return 0;
    }
    var index = Math.floor((numeric.length - 1) * clamp(Number(ratio) || 0, 0, 1));
    return numeric[index];
  }

  function resolveBuildingColor(value, stats, options, indexHint) {
    if (stats && stats.color && stats.color.mode === 'numeric') {
      return gradientColor(value, stats.color.min, stats.color.max);
    }
    return pickColor(value, 'categoric', indexHint, stats && stats.categoryColorMap);
  }

  function resolveZoneColor(depth, stats, options) {
    var maxDepth = Math.max(1, Number(stats && stats.maxDepth) || 1);
    return mixHexColor(options.zoneBaseColor, options.zoneTopColor, clamp((Number(depth) || 0) / maxDepth, 0, 1));
  }

  function isLeaf(node) {
    return !(node && Array.isArray(node.children) && node.children.length);
  }

  function collectLeaves(nodes, leaves) {
    (nodes || []).forEach(function (node) {
      if (!node) {
        return;
      }
      if (isLeaf(node)) {
        leaves.push(node);
        return;
      }
      collectLeaves(node.children, leaves);
    });
    return leaves;
  }

  function maxDepth(nodes, depth) {
    return (nodes || []).reduce(function (max, node) {
      if (!node || isLeaf(node)) {
        return Math.max(max, depth);
      }
      return Math.max(max, maxDepth(node.children, depth + 1));
    }, depth);
  }

  function readNodeName(node, options, index, prefix) {
    return String((node && (node.name || node[options.field] || node.uid || node.fileName || node.functionName)) || ((prefix || 'item') + '-' + index));
  }

  function readNodePath(node, name, parentPath) {
    var rawPath = node && (node.treePath || node.filePath || node.path || node.relativePath || node.uid || node.longName);
    var path = rawPath ? String(rawPath) : (parentPath ? parentPath + '/' + name : name);
    return path.replace(/\\/g, '/');
  }

  function buildFigureKey(kind, path, name, index) {
    return kind + ':' + (path || name || index);
  }

  function normalizeLeaf(node, options, stats, index, parentPath) {
    var name = readNodeName(node, options, index, 'item');
    var path = readNodePath(node, name, parentPath);
    var areaValue = toFiniteNumber(node && node[options.areaField], 0);
    var rawSize = Math.sqrt(Math.max(0, areaValue || 0));
    var size = clamp(rawSize || 0.5, 0.45, 2.8);
    var heightValue = toFiniteNumber(node && node[options.heightField], 0);
    var height = clamp(
      normalizeHeightRange(heightValue, stats.heightMin, stats.heightMax, options.minBuildingHeight, options.maxBuildingHeight),
      options.minBuildingHeight,
      options.maxBuildingHeight
    );
    var visualStyle = getVisualStyleRuntime();
    var temporal = visualStyle.classifyTemporalTier(node, stats.temporal);
    var temporalProfile = visualStyle.getTemporalStyleProfile(temporal.tier);
    if (stats.temporal && stats.temporal.tierCounts && stats.temporal.tierCounts[temporal.tier] != null) {
      stats.temporal.tierCounts[temporal.tier] += 1;
    }
    if (stats.temporal && stats.temporal.skinCounts && stats.temporal.skinCounts[temporal.tier] != null) {
      stats.temporal.skinCounts[temporal.tier] += 1;
    }
    if (stats.temporal && stats.temporal.shapeCounts && stats.temporal.shapeCounts[temporal.tier] != null) {
      stats.temporal.shapeCounts[temporal.tier] += 1;
    }
    return {
      kind: 'building',
      name: name,
      path: path,
      key: buildFigureKey('building', path, name, index),
      raw: node || {},
      width: size,
      depth: size,
      height: height,
      color: resolveBuildingColor(node && node[options.colorField], stats, options, index),
      temporalTier: temporal.tier,
      temporalLabel: temporalProfile.label || temporal.tier,
      temporalRecency: temporal.recency,
      modifiedAtMs: temporal.modifiedAtMs,
      areaValue: areaValue,
      heightValue: heightValue,
      colorValue: node && node[options.colorField],
      children: []
    };
  }

  function layoutChildren(children, separation, extraPadding) {
    var count = Math.max(1, children.length);
    var cols = Math.ceil(Math.sqrt(count));
    var cursorX = 0;
    var cursorZ = 0;
    var rowDepth = 0;
    var maxWidth = 0;

    children.forEach(function (child, index) {
      if (index > 0 && index % cols === 0) {
        cursorX = 0;
        cursorZ += rowDepth + separation;
        rowDepth = 0;
      }
      child.x = cursorX + child.width * 0.5;
      child.z = cursorZ + child.depth * 0.5;
      cursorX += child.width + separation;
      rowDepth = Math.max(rowDepth, child.depth);
      maxWidth = Math.max(maxWidth, cursorX - separation);
    });

    var totalDepth = cursorZ + rowDepth;
    var width = Math.max(0.5, maxWidth + extraPadding * 2);
    var depth = Math.max(0.5, totalDepth + extraPadding * 2);
    children.forEach(function (child) {
      child.x = child.x - maxWidth * 0.5;
      child.z = child.z - totalDepth * 0.5;
    });
    return { width: width, depth: depth };
  }

  function normalizeNode(node, options, stats, depth, index, parentPath) {
    if (isLeaf(node)) {
      return normalizeLeaf(node, options, stats, index, parentPath);
    }
    var name = readNodeName(node, options, index, 'zone');
    var path = readNodePath(node, name, parentPath);
    var children = (node.children || []).map(function (child, childIndex) {
      return normalizeNode(child, options, stats, depth + 1, childIndex, path);
    });
    var layout = layoutChildren(children, options.separation, options.border * options.extra);
    var rise = options.zoneStepRise * Math.max(1, depth + 1);
    var thickness = Math.min(Math.max(0.002, options.zoneStepThickness), rise);
    return {
      kind: 'quarter',
      name: name,
      path: path,
      key: buildFigureKey('quarter', path, name, index),
      raw: node || {},
      width: layout.width,
      depth: layout.depth,
      height: rise,
      thickness: thickness,
      color: resolveZoneColor(depth, stats, options),
      alpha: options.baseAlpha,
      depthLevel: depth,
      children: children
    };
  }
