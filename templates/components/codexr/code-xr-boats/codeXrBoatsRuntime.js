(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory(root);
  } else {
    root.CodeXRBoatsRuntime = factory(root);
  }
})(typeof globalThis !== 'undefined'  globalThis : typeof self !== 'undefined'  self : this, function (root) {
  'use strict';

  var COMPONENT = 'codexr-boats';
  var PRIMARY_CLASS = 'codexr-boats-primary';
  var AUX_CLASS = 'codexr-boats-auxiliary';
  var RAYCAST_CLASS = 'babiaxraycasterclass';
  var POSITION_EPSILON = 0.000001;
  var DEFAULT_PALETTE = ['#511845', '#900c3f', '#c70039', '#ff5733'];
  var BABIAXR_NUMERIC_COLOR_LOW = '#13528a';
  var BABIAXR_NUMERIC_COLOR_HIGH = '#ff5e53';
  var BABIAXR_CATEGORIC_PALETTE = [
    '#ffb75f', '#8e009a', '#5c2800', '#ff95ff', '#a69fff', '#da8800',
    '#073479', '#ffff00', '#00d3ff', '#b60026', '#00a59d', '#7e0000'
  ];
  var PALETTES = {
    ubuntu: DEFAULT_PALETTE,
    categoric: BABIAXR_CATEGORIC_PALETTE,
    blues: ['#142850', '#27496d', '#00909e', '#dae1e7'],
    flat: ['#120136', '#035aa6', '#40bad5', '#fcbf1e']
  };

  var state = {
    charts: {}
  };

  function getDocument() {
    return root.document;
  }

  function toFiniteNumber(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed)  parsed : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeRange(value, min, max, outMin, outMax) {
    var numeric = toFiniteNumber(value, 0);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
      return outMax;
    }
    return outMin + ((numeric - min) / (max - min)) * (outMax - outMin);
  }

  function normalizeHeightRange(value, min, max, outMin, outMax) {
    var numeric = toFiniteNumber(value, 0);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
      return outMax;
    }
    var ratio = clamp((numeric - min) / (max - min), 0, 1);
    return outMin + Math.pow(ratio, 0.65) * (outMax - outMin);
  }

  function parseJson(value, fallback) {
    if (Array.isArray(value) || (value && typeof value === 'object')) {
      return value;
    }
    if (typeof value !== 'string' || !value.trim()) {
      return fallback;
    }
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function getPalette(name) {
    if (Array.isArray(name)) {
      return name.length  name : DEFAULT_PALETTE;
    }
    if (typeof name === 'string') {
      var parsed = parseJson(name, null);
      if (Array.isArray(parsed) && parsed.length) {
        return parsed;
      }
      if (PALETTES[name]) {
        return PALETTES[name];
      }
    }
    return DEFAULT_PALETTE;
  }

  function pickColor(value, paletteName, indexHint, categoryMap) {
    var palette = getPalette(paletteName);
    var text = String(value === undefined || value === null  indexHint : value);
    var map = categoryMap || {};
    if (Object.prototype.hasOwnProperty.call(map, text)) {
      return map[text];
    }
    var index = Object.keys(map).length % palette.length;
    map[text] = palette[index];
    return map[text];
  }

  function parseHexColor(value, fallback) {
    var text = String(value || '').trim();
    var match = text.match(/^#([0-9a-f]{6})$/i);
    if (!match) {
      return parseHexColor(fallback || '#98e690', '#98e690');
    }
    var hex = match[1];
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16)
    };
  }

  function toHexChannel(value) {
    return clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');
  }

  function mixHexColor(fromColor, toColor, ratio) {
    var from = parseHexColor(fromColor, '#4f9e54');
    var to = parseHexColor(toColor, '#b8f7b0');
    var t = clamp(Number(ratio) || 0, 0, 1);
    return '#' + [
      toHexChannel(from.r + ((to.r - from.r) * t)),
      toHexChannel(from.g + ((to.g - from.g) * t)),
      toHexChannel(from.b + ((to.b - from.b) * t))
    ].join('');
  }

  function gradientColor(value, min, max) {
    var numeric = Number(value);
    if (!Number.isFinite(numeric) || !Number.isFinite(min) || !Number.isFinite(max) || min === max) {
      return mixHexColor(BABIAXR_NUMERIC_COLOR_LOW, BABIAXR_NUMERIC_COLOR_HIGH, 0.5);
    }
    var t = clamp((numeric - min) / (max - min), 0, 1);
    return mixHexColor(BABIAXR_NUMERIC_COLOR_LOW, BABIAXR_NUMERIC_COLOR_HIGH, t);
  }

  function buildColorStats(leaves, colorField) {
    var values = (leaves || []).map(function (leaf) {
      return leaf && leaf[colorField];
    }).filter(function (value) {
      return value !== undefined && value !== null && value !== '';
    });
    var numericValues = values.map(Number).filter(Number.isFinite);
    var numeric = values.length > 0 && numericValues.length === values.length;
    return {
      mode: numeric  'numeric' : 'categorical',
      min: numericValues.length  Math.min.apply(Math, numericValues) : 0,
      max: numericValues.length  Math.max.apply(Math, numericValues) : 0,
      count: values.length
    };
  }

  function getVisualStyleRuntime() {
    return root.CodeXRVisualStyleRuntime || {
      buildTemporalStats: function () {
        return {
          available: false,
          oldest: null,
          newest: null,
          rangeMs: 0,
          tierCounts: { legacy: 0, aged: 0, current: 0, fresh: 0 },
          skinCounts: { legacy: 0, aged: 0, current: 0, fresh: 0 },
          shapeCounts: { legacy: 0, aged: 0, current: 0, fresh: 0 }
        };
      },
      classifyTemporalTier: function (record) {
        var value = record && (record.modifiedAtMs || record.modifiedAtIso || record.timestamp);
        return { tier: 'current', recency: 0.5, modifiedAtMs: Number(value) || null };
      },
      getTemporalStyleProfile: function () {
        return {
          tier: 'current',
          label: 'Current',
          skin: 'current',
          accent: '#e0f2fe',
          secondary: '#67e8f9',
          highlight: '#ffffff',
          opacity: 0.3,
          emissive: '#020617',
          shape: 'standard'
        };
      },
      buildMetricBodyMaterialString: function (color) {
        return 'color: ' + (color || '#ffffff') + '; opacity: 1; transparent: false; roughness: 0.68; metalness: 0.08; emissive: #000000';
      },
      buildSkinMaterialString: function (profile, alpha) {
        var resolved = profile || {};
        var opacity = Number.isFinite(alpha)  alpha : (resolved.opacity || 0.3);
        return 'color: ' + (resolved.accent || '#ffffff') + '; opacity: ' + opacity + '; transparent: true; shader: flat; depthWrite: false';
      },
      formatRelativeAge: function (recency) {
        return Number.isFinite(recency)  (Math.round(recency * 100) + '% recent') : 'Unknown';
      }
    };
  }

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
    var path = rawPath  String(rawPath) : (parentPath  parentPath + '/' + name : name);
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

    var scaleX = bounds.size.x > 0.0001  targetWidth / bounds.size.x : 1;
    var scaleZ = bounds.size.z > 0.0001  targetDepth / bounds.size.z : 1;
    var scaleY = bounds.size.y > 0.0001  targetHeight / bounds.size.y : 1;

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
      rootWidth: rootSlabFixed  targetWidth : null,
      rootDepth: rootSlabFixed  targetDepth : null,
      scaleX: scaleX,
      scaleY: scaleY,
      scaleZ: scaleZ,
      buildingHeightFloor: postScaleBuildingFloor
    };
    return bounds;
  }

  function buildLayout(tree, options) {
    var roots = Array.isArray(tree)  tree : [];
    var leaves = collectLeaves(roots, []);
    var heightValues = leaves.map(function (leaf) {
      return toFiniteNumber(leaf && leaf[options.heightField], 0);
    });
    var stats = {
      heightMin: heightValues.length  Math.min.apply(Math, heightValues) : 0,
      heightMax: heightValues.length  Math.max.apply(Math, heightValues) : 0,
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
      width: options.fixedSize  options.fixedWidth : rootLayout.width,
      depth: options.fixedSize  options.fixedDepth : rootLayout.depth,
      bounds: bounds,
      stats: stats
    };
  }

  function clearEntity(entity) {
    while (entity && entity.firstChild) {
      entity.removeChild(entity.firstChild);
    }
  }

  function collectRenderRoots(entity) {
    if (!entity || !entity.querySelectorAll) {
      return [];
    }
    return Array.prototype.slice.call(entity.querySelectorAll('[data-codexr-boats-root="true"]') || []);
  }

  function removeRenderRoots(roots) {
    (roots || []).forEach(function (rootEl) {
      if (rootEl && rootEl.parentNode && rootEl.parentNode.removeChild) {
        rootEl.parentNode.removeChild(rootEl);
      }
    });
  }

  function setRenderRootVisible(rootEl, visible) {
    if (!rootEl) {
      return;
    }
    rootEl.setAttribute.('visible', !!visible);
    if (rootEl.object3D) {
      rootEl.object3D.visible = !!visible;
    }
  }

  function createEntity(tagName, attributes) {
    var document = getDocument();
    var entity = document.createElement(tagName);
    Object.keys(attributes || {}).forEach(function (key) {
      entity.setAttribute(key, attributes[key]);
    });
    return entity;
  }

  function setOptionalClass(entity, className) {
    if (!entity || !className) {
      return;
    }
    entity.setAttribute('class', className);
  }

  function renderText(parent, value, position, width, color) {
    var label = createEntity('a-text', {
      value: String(value || ''),
      position: position,
      scale: '0.18 0.18 0.18',
      align: 'center',
      color: color || '#eaf4ff',
      width: width || 4,
      'wrap-count': 18,
      class: AUX_CLASS
    });
    parent.appendChild(label);
    return label;
  }

  function formatLegend(template, figure, options) {
    return String(template || '{name}')
      .replace(/\{name\}/g, figure.name)
      .replace(/\{fheight\}/g, options.heightField)
      .replace(/\{height\}/g, String(figure.heightValue  ''))
      .replace(/\{farea\}/g, options.areaField)
      .replace(/\{area\}/g, String(figure.areaValue  ''))
      .replace(/\{fcolor\}/g, options.colorField)
      .replace(/\{color\}/g, String(figure.colorValue  ''));
  }

  function formatVector(value) {
    return value.x + ' ' + value.y + ' ' + value.z;
  }

  function parseVectorAttribute(value, fallback) {
    if (typeof value !== 'string') {
      return fallback || { x: 0, y: 0, z: 0 };
    }
    var parts = value.trim().split(/\s+/).map(Number);
    return {
      x: Number.isFinite(parts[0])  parts[0] : (fallback  fallback.x : 0),
      y: Number.isFinite(parts[1])  parts[1] : (fallback  fallback.y : 0),
      z: Number.isFinite(parts[2])  parts[2] : (fallback  fallback.z : 0)
    };
  }

  function setFigureMetadata(entity, figure, kind) {
    entity.setAttribute('data-codexr-boats-kind', kind || figure.kind);
    entity.setAttribute('data-codexr-boats-name', figure.name);
    entity.setAttribute('data-codexr-boats-key', figure.key);
    entity.setAttribute('data-codexr-boats-path', figure.path || figure.name);
    entity.setAttribute('data-codexr-interactive', 'true');
    entity.codexrBoatsFigure = figure;
  }

  function parseVec3(value) {
    if (value && typeof value === 'object') {
      return {
        x: toFiniteNumber(value.x, 0),
        y: toFiniteNumber(value.y, 0),
        z: toFiniteNumber(value.z, 0)
      };
    }
    var parts = String(value || '0 0 0').trim().split(/\s+/);
    return {
      x: toFiniteNumber(parts[0], 0),
      y: toFiniteNumber(parts[1], 0),
      z: toFiniteNumber(parts[2], 0)
    };
  }

  function formatVec3(value) {
    var vector = parseVec3(value);
    return vector.x + ' ' + vector.y + ' ' + vector.z;
  }

  function addVec3(a, b) {
    return {
      x: (a && a.x || 0) + (b && b.x || 0),
      y: (a && a.y || 0) + (b && b.y || 0),
      z: (a && a.z || 0) + (b && b.z || 0)
    };
  }

  function subtractVec3(a, b) {
    return {
      x: (a && a.x || 0) - (b && b.x || 0),
      y: (a && a.y || 0) - (b && b.y || 0),
      z: (a && a.z || 0) - (b && b.z || 0)
    };
  }

  function distanceSqVec3(a, b) {
    var av = parseVec3(a);
    var bv = parseVec3(b);
    var dx = av.x - bv.x;
    var dy = av.y - bv.y;
    var dz = av.z - bv.z;
    return dx * dx + dy * dy + dz * dz;
  }

  function nearlySameVec3(a, b) {
    return distanceSqVec3(a, b) <= POSITION_EPSILON * POSITION_EPSILON;
  }

  function getLocalVisualPosition(entity) {
    if (entity && entity.object3D && entity.object3D.position) {
      return {
        x: toFiniteNumber(entity.object3D.position.x, 0),
        y: toFiniteNumber(entity.object3D.position.y, 0),
        z: toFiniteNumber(entity.object3D.position.z, 0)
      };
    }
    return parseVec3(entity && entity.getAttribute && entity.getAttribute('position'));
  }

  function getChartLocalPosition(entity, rootEl) {
    var position = { x: 0, y: 0, z: 0 };
    var current = entity;
    while (current && current !== rootEl) {
      position = addVec3(position, getLocalVisualPosition(current));
      current = current.parentNode;
    }
    return position;
  }

  function isVisibleRenderRoot(rootEl) {
    if (!rootEl) {
      return false;
    }
    if (rootEl.object3D && rootEl.object3D.visible === false) {
      return false;
    }
    if (rootEl.getAttribute) {
      var visibleAttr = rootEl.getAttribute('visible');
      if (visibleAttr === false || visibleAttr === 'false') {
        return false;
      }
    }
    if (rootEl.parentNode == null && rootEl.ownerDocument) {
      return false;
    }
    return true;
  }

  function getActiveRenderRoot(component) {
    var active = component && component.activeRenderRoot;
    if (active && active.parentNode && isVisibleRenderRoot(active)) {
      return active;
    }
    var roots = collectRenderRoots(component && component.el);
    for (var i = roots.length - 1; i >= 0; i -= 1) {
      if (isVisibleRenderRoot(roots[i])) {
        return roots[i];
      }
    }
    return null;
  }

  function collectElementSnapshots(rootEl) {
    var snapshots = {};
    if (!rootEl || !rootEl.querySelectorAll || !isVisibleRenderRoot(rootEl)) {
      return snapshots;
    }
    var elements = rootEl.querySelectorAll('[data-codexr-boats-key]');
    var resolveParentKey = function (el, selfKey) {
      var current = el && el.parentNode;
      while (current && current !== rootEl) {
        var kind = current.getAttribute && current.getAttribute('data-codexr-boats-kind');
        var key = current.getAttribute && current.getAttribute('data-codexr-boats-key');
        if (kind === 'quarter' && key && key !== selfKey) {
          return key;
        }
        current = current.parentNode;
      }
      return null;
    };
    var readSnapshot = function (el, key) {
      return {
        position: el.getAttribute('position') || '0 0 0',
        chartPosition: getChartLocalPosition(el, rootEl),
        parentKey: resolveParentKey(el, key),
        width: el.getAttribute('width'),
        height: el.getAttribute('height'),
        depth: el.getAttribute('depth'),
        material: el.getAttribute('material') || ''
      };
    };
    Array.prototype.forEach.call(elements || [], function (el) {
      var key = el.getAttribute && el.getAttribute('data-codexr-boats-key');
      if (!key) {
        return;
      }
      var kind = el.getAttribute && el.getAttribute('data-codexr-boats-kind');
      var snapshot = readSnapshot(el, key);
      snapshots[key] = snapshots[key] || {};
      if (kind === 'quarter') {
        snapshots[key].frame = snapshot;
      } else if (kind === 'quarter-base') {
        snapshots[key].visual = snapshot;
      } else {
        snapshots[key].visual = snapshot;
        Object.assign(snapshots[key], snapshot);
      }
    });
    return snapshots;
  }

  function resolveAnimationFromPosition(snapshot, target) {
    if (!snapshot || !target || !snapshot.position || !target.position || target.animatePosition === false) {
      return null;
    }
    var targetParentKey = target.parentKey || null;
    var snapshotParentKey = snapshot.parentKey || null;
    if (snapshotParentKey === targetParentKey) {
      return snapshot.position;
    }
    if (snapshot.chartPosition && target.parentOrigin) {
      return formatVec3(subtractVec3(snapshot.chartPosition, target.parentOrigin));
    }
    return snapshot.position;
  }

  function setAnimation(entity, name, property, from, to, duration) {
    if (!entity || !entity.setAttribute || from === undefined || to === undefined || String(from) === String(to)) {
      return false;
    }
    entity.setAttribute('animation__codexr_' + name, {
      property: property,
      from: from,
      to: to,
      dur: duration,
      easing: 'easeInOutCubic'
    });
    return true;
  }

  function resolveContainmentSafePlanarSize(snapshot, target) {
    var targetWidth = toFiniteNumber(target && target.width, null);
    var targetDepth = toFiniteNumber(target && target.depth, null);
    var previousWidth = toFiniteNumber(snapshot && snapshot.width, targetWidth);
    var previousDepth = toFiniteNumber(snapshot && snapshot.depth, targetDepth);
    var baseWidth = Math.max(targetWidth || 0, previousWidth || 0);
    var baseDepth = Math.max(targetDepth || 0, previousDepth || 0);
    var widthGuard = baseWidth > 0  clamp(baseWidth * 0.14, 0.06, 0.85) : 0;
    var depthGuard = baseDepth > 0  clamp(baseDepth * 0.14, 0.06, 0.85) : 0;
    var safeWidth = baseWidth + widthGuard;
    var safeDepth = baseDepth + depthGuard;
    return {
      width: safeWidth,
      depth: safeDepth,
      shouldHoldWidth: Number.isFinite(targetWidth) && safeWidth > targetWidth + 0.000001,
      shouldHoldDepth: Number.isFinite(targetDepth) && safeDepth > targetDepth + 0.000001
    };
  }

  function scheduleFinalAttribute(entity, attribute, value, duration) {
    if (!entity || !entity.setAttribute || value == null) {
      return false;
    }
    var applyFinalValue = function () {
      entity.setAttribute(attribute, value);
    };
    if (typeof root.setTimeout === 'function') {
      root.setTimeout(applyFinalValue, Math.max(0, Number(duration) || 0));
    } else {
      setTimeout(applyFinalValue, Math.max(0, Number(duration) || 0));
    }
    return true;
  }

  function scheduleFinalMaterialProperty(entity, property, value, duration) {
    if (!entity || value == null) {
      return false;
    }
    var applyFinalValue = function () {
      setMaterialProperty(entity, property, value);
    };
    if (typeof root.setTimeout === 'function') {
      root.setTimeout(applyFinalValue, Math.max(0, Number(duration) || 0));
    } else {
      setTimeout(applyFinalValue, Math.max(0, Number(duration) || 0));
    }
    return true;
  }

  function setMaterialProperty(entity, property, value) {
    if (!entity || !entity.setAttribute || value == null) {
      return false;
    }
    var material = entity.getAttribute('material') || '';
    if (typeof material === 'object') {
      var nextMaterial = Object.assign({}, material);
      nextMaterial[property] = value;
      entity.setAttribute('material', nextMaterial);
      return true;
    }
    var text = String(material || '');
    var pattern = new RegExp('(^|;)\\s*' + property + '\\s*:\\s*[^;]*', 'i');
    var replacement = (text.trim()  '; ' : '') + property + ': ' + value;
    if (pattern.test(text)) {
      entity.setAttribute('material', text.replace(pattern, function (match, prefix) {
        return (prefix || '') + ' ' + property + ': ' + value;
      }).trim().replace(/^;\s*/, ''));
    } else {
      entity.setAttribute('material', (text + replacement).trim().replace(/^;\s*/, ''));
    }
    return true;
  }

  function extractMaterialOpacity(material, fallback) {
    if (!material) {
      return fallback;
    }
    if (typeof material === 'object' && material.opacity != null) {
      return Number(material.opacity);
    }
    var match = String(material).match(/opacity:\s*([^;]+)/i);
    var value = match  Number(match[1]) : NaN;
    return Number.isFinite(value)  value : fallback;
  }

  function animateHover(entity, active) {
    if (!entity || !entity.setAttribute) {
      return;
    }
    if (entity.getAttribute && entity.getAttribute('data-codexr-visible-body') === 'metric-envelope') {
      return;
    }
    var baseOpacity = Number(entity.getAttribute('data-codexr-base-opacity'));
    if (!Number.isFinite(baseOpacity)) {
      baseOpacity = 1;
    }
    var baseColor = entity.getAttribute('data-codexr-base-color') || extractMaterialColor(entity.getAttribute('material')) || '#ffffff';
    entity.setAttribute('animation__codexr_hover_opacity', {
      property: 'material.opacity',
      to: active  1 : baseOpacity,
      dur: active  240 : 360,
      easing: 'easeOutQuad'
    });
    entity.setAttribute('animation__codexr_hover_color', {
      property: 'material.color',
      to: active  lightenHexColor(baseColor, 0.28) : baseColor,
      dur: active  260 : 420,
      easing: 'easeOutQuad'
    });
    entity.setAttribute('animation__codexr_hover_emissive', {
      property: 'material.emissive',
      to: active  '#d9fff2' : '#000000',
      dur: active  260 : 420,
      easing: 'easeOutQuad'
    });
  }

  function animateElement(entity, figure, options, snapshots, target) {
    if (!entity || !figure || !options.animation) {
      return false;
    }
    var duration = Math.max(0, Number(options.animationDuration) || 0);
    if (duration <= 0) {
      return false;
    }
    var snapshotEntry = snapshots && snapshots[figure.key];
    var snapshot = snapshotEntry && (
      target.snapshotRole === 'frame'
         snapshotEntry.frame
        : (snapshotEntry.visual || snapshotEntry)
    );
    if (snapshot) {
      var fromPosition = resolveAnimationFromPosition(snapshot, target);
      if (fromPosition && target.position) {
        if (nearlySameVec3(fromPosition, target.position)) {
          entity.setAttribute('position', target.position);
        } else {
          entity.setAttribute('position', fromPosition);
          setAnimation(entity, 'position', 'position', fromPosition, target.position, duration);
          scheduleFinalAttribute(entity, 'position', target.position, duration);
        }
      }
      if (snapshot.width != null) {
        entity.setAttribute('width', snapshot.width);
      }
      if (snapshot.height != null) {
        entity.setAttribute('height', snapshot.height);
      }
      if (snapshot.depth != null) {
        entity.setAttribute('depth', snapshot.depth);
      }
      var fromColor = extractMaterialColor(snapshot.material);
      if (fromColor) {
        setMaterialProperty(entity, 'color', fromColor);
      }
      var fromOpacity = extractMaterialOpacity(snapshot.material, null);
      if (fromOpacity != null && Number.isFinite(fromOpacity)) {
        setMaterialProperty(entity, 'opacity', fromOpacity);
      }
      if (target.holdPlanarSize) {
        var safePlanarSize = resolveContainmentSafePlanarSize(snapshot, target);
        if (Number.isFinite(safePlanarSize.width) && safePlanarSize.width > 0) {
          entity.setAttribute('width', safePlanarSize.width);
          if (safePlanarSize.shouldHoldWidth) {
            scheduleFinalAttribute(entity, 'width', target.width, duration);
          }
        }
        if (Number.isFinite(safePlanarSize.depth) && safePlanarSize.depth > 0) {
          entity.setAttribute('depth', safePlanarSize.depth);
          if (safePlanarSize.shouldHoldDepth) {
            scheduleFinalAttribute(entity, 'depth', target.depth, duration);
          }
        }
      } else {
        setAnimation(entity, 'width', 'width', snapshot.width, target.width, duration);
        setAnimation(entity, 'depth', 'depth', snapshot.depth, target.depth, duration);
        scheduleFinalAttribute(entity, 'width', target.width, duration);
        scheduleFinalAttribute(entity, 'depth', target.depth, duration);
      }
      setAnimation(entity, 'height', 'height', snapshot.height, target.height, duration);
      setAnimation(entity, 'color', 'material.color', fromColor, target.color, duration);
      scheduleFinalAttribute(entity, 'height', target.height, duration);
      scheduleFinalMaterialProperty(entity, 'color', target.color, duration);
      if (fromOpacity != null && Number.isFinite(fromOpacity)) {
        setAnimation(entity, 'opacity', 'material.opacity', fromOpacity, target.opacity  1, duration);
        scheduleFinalMaterialProperty(entity, 'opacity', target.opacity  1, duration);
      }
      return true;
    }
    setMaterialProperty(entity, 'opacity', 0);
    setAnimation(entity, 'opacity', 'material.opacity', 0, target.opacity  1, duration);
    scheduleFinalMaterialProperty(entity, 'opacity', target.opacity  1, duration);
    return true;
  }

  function extractMaterialColor(material) {
    if (!material) {
      return null;
    }
    if (typeof material === 'object' && material.color) {
      return material.color;
    }
    var match = String(material).match(/color:\s*([^;]+)/i);
    return match  match[1].trim() : null;
  }

  function lightenHexColor(color, amount) {
    var text = String(color || '').trim();
    var match = text.match(/^#([0-9a-f]{6})$/i);
    if (!match) {
      return color || '#ffffff';
    }
    var hex = match[1];
    var ratio = clamp(Number(amount) || 0.18, 0, 1);
    var parts = [0, 2, 4].map(function (start) {
      var channel = parseInt(hex.slice(start, start + 2), 16);
      return Math.round(channel + ((255 - channel) * ratio));
    });
    return '#' + parts.map(function (channel) {
      return channel.toString(16).padStart(2, '0');
    }).join('');
  }

  function resolveTooltipHost(chartEl) {
    return (chartEl && chartEl.sceneEl) || (chartEl && chartEl.parentNode) || chartEl || null;
  }

  function moveTooltipToHost(component, tooltip) {
    if (!component || !tooltip || !tooltip.root) {
      return false;
    }
    var host = resolveTooltipHost(component.el);
    if (!host || !host.appendChild) {
      return false;
    }
    if (tooltip.root.parentNode !== host) {
      if (tooltip.root.parentNode && tooltip.root.parentNode.removeChild) {
        tooltip.root.parentNode.removeChild(tooltip.root);
      }
      host.appendChild(tooltip.root);
    }
    return true;
  }

  function removeTooltipRoot(tooltip) {
    if (!tooltip || !tooltip.root) {
      return;
    }
    if (tooltip.connectorRoot && tooltip.connectorRoot.parentNode && tooltip.connectorRoot.parentNode.removeChild) {
      tooltip.connectorRoot.parentNode.removeChild(tooltip.connectorRoot);
    }
    if (tooltip.root.parentNode && tooltip.root.parentNode.removeChild) {
      tooltip.root.parentNode.removeChild(tooltip.root);
    }
  }

  function removeTooltip(component) {
    if (!component) {
      return;
    }
    removeTooltipRoot(component.tooltip);
    component.tooltip = null;
    Object.keys(component.pinnedTooltips || {}).forEach(function (key) {
      removeTooltipRoot(component.pinnedTooltips[key]);
      delete component.pinnedTooltips[key];
    });
  }

  function createBoatsTooltip(component, options) {
    if (!component || !root.CodeXRCommonRuntime.createTooltip) {
      return null;
    }
    var opts = options || {};
    var tooltip = root.CodeXRCommonRuntime.createTooltip({
      accentColor: opts.accentColor || '#22d3ee',
      width: opts.width || 3.75,
      height: opts.height || .96
    });
    if (!tooltip || !tooltip.root) {
      return null;
    }
    tooltip.root.setAttribute(
      'class',
      AUX_CLASS + ' codexr-boats-tooltip' + (opts.pinned  ' codexr-boats-tooltip-pinned' : '')
    );
    tooltip.root.setAttribute('data-codexr-role', opts.pinned  'tooltip overlay pinned' : 'tooltip overlay');
    tooltip.root.setAttribute('data-codexr-owner', component.el.id || component.runtimeId);
    if (opts.key) {
      tooltip.root.setAttribute('data-codexr-boats-tooltip-key', opts.key);
    }
    moveTooltipToHost(component, tooltip);
    return tooltip;
  }

  function collectBuildings(nodes, buildings) {
    (nodes || []).forEach(function (node) {
      if (!node) {
        return;
      }
      if (node.kind === 'building') {
        buildings.push(node);
        return;
      }
      collectBuildings(node.children, buildings);
    });
    return buildings;
  }

  function compactPath(value, maxLength) {
    var text = String(value || '');
    var limit = Math.max(12, Number(maxLength) || 54);
    if (text.length <= limit) {
      return text;
    }
    var parts = text.replace(/\\/g, '/').split('/').filter(Boolean);
    if (parts.length >= 3) {
      var tail = parts.slice(-3).join('/');
      if (tail.length <= limit - 4) {
        return '.../' + tail;
      }
    }
    return '...' + text.slice(Math.max(0, text.length - limit + 3));
  }

  function buildReadableTooltipDetail(figure, options) {
    if (!figure) {
      return null;
    }
    var path = compactPath(figure.path || figure.name, 48);
    if (figure.kind === 'quarter') {
      var children = figure.children || [];
      var buildingCount = collectBuildings(children, []).length;
      return {
        title: compactPath(figure.name, 30),
        subtitle: path,
        primary: 'Directory  |  children: ' + children.length + '  |  buildings: ' + buildingCount,
        secondary: 'Depth: ' + (figure.depthLevel || 0) + '  |  step: ' + toFiniteNumber(figure.thickness || figure.height, 0).toFixed(3),
        rows: [
          { label: 'Type', value: 'Directory / zone' },
          { label: 'Children', value: String(children.length) },
          { label: 'Buildings', value: String(buildingCount) },
          { label: 'Depth', value: String(figure.depthLevel || 0) }
        ]
      };
    }
    return {
      title: compactPath(figure.name, 30),
      subtitle: path,
      primary: options.areaField + ': ' + String(figure.areaValue  '') + '  |  ' + options.heightField + ': ' + String(figure.heightValue  ''),
      secondary: options.colorField + ': ' + String(figure.colorValue  '') + '  |  visual height: ' + toFiniteNumber(figure.height, 0).toFixed(3),
      rows: [
        { label: 'Type', value: 'Building' },
        { label: options.areaField, value: String(figure.areaValue  '') },
        { label: options.heightField, value: String(figure.heightValue  '') },
        { label: options.colorField, value: String(figure.colorValue  '') },
        { label: 'Modified', value: formatModifiedAt(figure.modifiedAtMs) },
        { label: 'Age tier', value: figure.temporalLabel || figure.temporalTier || 'Current' },
        { label: 'Recency', value: getVisualStyleRuntime().formatRelativeAge(figure.temporalRecency) },
        { label: 'Visual height', value: toFiniteNumber(figure.height, 0).toFixed(3) }
      ]
    };
  }

  function transformLocalChartPoint(component, point) {
    var three = root.THREE || (root.AFRAME && root.AFRAME.THREE);
    var object3D = component && component.el && component.el.object3D;
    if (!three || !three.Vector3 || !object3D || typeof object3D.localToWorld !== 'function') {
      return null;
    }
    if (typeof object3D.updateMatrixWorld === 'function') {
      object3D.updateMatrixWorld(true);
    }
    var world = new three.Vector3(point.x, point.y, point.z);
    object3D.localToWorld(world);
    return world;
  }

  function getTooltipAnchor(component, entity, figure, tooltipHeight) {
    var bounds = component && component.layout && component.layout.bounds;
    var peakY = bounds && Number.isFinite(bounds.max.y)  bounds.max.y : null;
    var centerZ = bounds && Number.isFinite(bounds.min.z) && Number.isFinite(bounds.max.z)
       (bounds.min.z + bounds.max.z) * 0.5
      : null;
    var height = Math.max(0.1, Number(tooltipHeight) || 1.4);
    var position = parseVectorAttribute(entity && entity.getAttribute  entity.getAttribute('position') : null, { x: 0, y: 0, z: 0 });
    var localAnchor = figure && figure.tooltipPosition
       {
        x: figure.tooltipPosition.x,
        y: Number.isFinite(peakY)  peakY : figure.tooltipPosition.y,
        z: Number.isFinite(centerZ)  centerZ : figure.tooltipPosition.z
      }
      : {
        x: position.x,
        y: Number.isFinite(peakY)  peakY : position.y + Math.max(0.24, Number(figure && figure.height) || 0.24),
        z: Number.isFinite(centerZ)  centerZ : position.z
      };
    var worldAnchor = transformLocalChartPoint(component, localAnchor);
    if (worldAnchor) {
      return {
        x: worldAnchor.x,
        y: worldAnchor.y + Math.max(0.72, height * 0.62),
        z: worldAnchor.z
      };
    }
    return {
      x: localAnchor.x,
      y: localAnchor.y + (height * 0.5) + 0.42,
      z: localAnchor.z
    };
  }

  function offsetPinnedTooltipPosition(position, index, tooltipHeight) {
    var slot = Math.max(0, Number(index) || 0);
    var height = Math.max(1.1, Number(tooltipHeight) || 1.2);
    return {
      x: position.x + ((slot % 2 === 0  -1 : 1) * Math.min(1.15, 0.34 + (height * 0.18))),
      y: position.y + (slot * (height + 0.22)),
      z: position.z + ((slot % 3) * 0.06)
    };
  }

  function offsetHoverTooltipPosition(position, pinnedCount) {
    var count = Math.max(0, Number(pinnedCount) || 0);
    if (!count) {
      return position;
    }
    return {
      x: position.x - Math.min(2.4, 1.65 + (count * 0.25)),
      y: position.y - 0.2,
      z: position.z + 0.16
    };
  }

  function getFigureWorldAnchor(component, entity, figure) {
    if (figure && figure.tooltipPosition) {
      var lifted = {
        x: figure.tooltipPosition.x,
        y: figure.tooltipPosition.y + 0.08,
        z: figure.tooltipPosition.z
      };
      return transformLocalChartPoint(component, lifted) || lifted;
    }
    var position = parseVectorAttribute(entity && entity.getAttribute  entity.getAttribute('position') : null, { x: 0, y: 0, z: 0 });
    var local = {
      x: position.x,
      y: position.y + Math.max(0.24, Number(figure && figure.height) || 0.24) + 0.08,
      z: position.z
    };
    return transformLocalChartPoint(component, local) || local;
  }

  function attachHoverHandlers(component, entity, figure) {
    if (!entity || !entity.addEventListener || !figure) {
      return;
    }
    entity.addEventListener('mouseenter', function () {
      animateHover(entity, true);
      if (!component.isTooltipPinned(figure.key)) {
        component.showTooltip(entity, figure);
      }
    });
    entity.addEventListener('mouseleave', function () {
      animateHover(entity, false);
      if (!component.isTooltipPinned(figure.key)) {
        component.hideTooltip();
      }
    });
    entity.addEventListener('click', function (event) {
      if (event && typeof event.stopPropagation === 'function') {
        event.stopPropagation();
      }
      component.togglePinnedTooltip(entity, figure);
    });
  }

  function registerFigureElement(component, entity, figure) {
    if (!component || !entity || !figure || !figure.key) {
      return;
    }
    component.figureElements = component.figureElements || {};
    component.figureElements[figure.key] = {
      entity: entity,
      figure: figure
    };
  }

  function updatePinnedTooltipRuntimeCount(component) {
    if (!component) {
      return;
    }
    var chartId = component.el && (component.el.id || component.runtimeId);
    if (chartId && state.charts[chartId]) {
      state.charts[chartId].pinnedTooltipCount = component.getPinnedKeys  component.getPinnedKeys().length : 0;
    }
  }

  function textureMaterial(textureUrl, opacity) {
    var safeOpacity = clamp(toFiniteNumber(opacity, 0.58), 0, 1);
    return [
      'src: url(' + textureUrl + ')',
      'color: #ffffff',
      'opacity: ' + safeOpacity,
      'transparent: true',
      'shader: flat',
      'side: double',
      'depthWrite: false'
    ].join('; ');
  }

  function skinAccentMaterial(profile, color, opacity) {
    var resolvedOpacity = Number.isFinite(opacity)  opacity : profile.opacity || 0.3;
    return [
      'color: ' + (color || profile.accent || '#ffffff'),
      'opacity: ' + resolvedOpacity,
      'transparent: true',
      'shader: flat',
      'depthWrite: false'
    ].join('; ');
  }

  function appendTemporalSkinBox(parent, figure, profile, name, dimensions, position, color, opacity) {
    parent.appendChild(createEntity('a-box', {
      width: Math.max(0.001, dimensions.width),
      depth: Math.max(0.001, dimensions.depth),
      height: Math.max(0.001, dimensions.height),
      position: position.x + ' ' + position.y + ' ' + position.z,
      material: skinAccentMaterial(profile, color, opacity),
      class: AUX_CLASS,
      'data-codexr-role': 'aux temporal-skin',
      'data-codexr-boats-skin': name,
      'data-codexr-temporal-tier': figure.temporalTier || 'current'
    }));
  }

  function shapeMaterial(profile, color, opacity) {
    return [
      'color: ' + (color || profile.accent || '#ffffff'),
      'opacity: ' + clamp(toFiniteNumber(opacity, 0.48), 0, 1),
      'transparent: true',
      'shader: flat',
      'depthWrite: false',
      'roughness: 0.72',
      'metalness: 0.04'
    ].join('; ');
  }

  function metricEnvelopeMaterial() {
    return [
      'color: #ffffff',
      'opacity: 0.001',
      'transparent: true',
      'shader: flat',
      'depthWrite: false'
    ].join('; ');
  }

  function visiblePieceMaterial(color) {
    var visualStyle = getVisualStyleRuntime();
    return visualStyle.buildMetricBodyMaterialString
       visualStyle.buildMetricBodyMaterialString(color || '#6b7280')
      : 'color: ' + (color || '#6b7280') + '; opacity: 1; transparent: false; roughness: 0.68; metalness: 0.08; emissive: #000000';
  }

  function buildTemporalShapeDescriptors(figure, profile) {
    if (!figure || !profile) {
      return [];
    }
    var shape = profile.shape || (profile.skin === 'fresh'  'modern' : profile.skin === 'legacy'  'heritage' : profile.skin === 'aged'  'ruin' : 'standard');
    var width = Math.max(0.001, figure.width);
    var depth = Math.max(0.001, figure.depth);
    var height = Math.max(0.001, figure.height);
    var halfWidth = width * 0.5;
    var halfDepth = depth * 0.5;
    var halfHeight = height * 0.5;
    var baseY = -halfHeight;
    var topY = halfHeight;
    var minUnit = Math.max(0.008, Math.min(width, depth, height) * 0.045);
    var descriptors = [];

    var addBox = function (name, dimensions, position, color, opacity) {
      var safeDimensions = {
        width: Math.max(0.001, Math.min(width, dimensions.width)),
        depth: Math.max(0.001, Math.min(depth, dimensions.depth)),
        height: Math.max(0.001, Math.min(height, dimensions.height))
      };
      var clampedPosition = {
        x: clamp(position.x, -halfWidth + safeDimensions.width * 0.5, halfWidth - safeDimensions.width * 0.5),
        y: clamp(position.y, baseY + safeDimensions.height * 0.5, topY - safeDimensions.height * 0.5),
        z: clamp(position.z, -halfDepth + safeDimensions.depth * 0.5, halfDepth - safeDimensions.depth * 0.5)
      };
      descriptors.push({
        tag: 'a-box',
        name: name,
        shape: shape,
        dimensions: safeDimensions,
        position: clampedPosition,
        attributes: {
          width: safeDimensions.width,
          depth: safeDimensions.depth,
          height: safeDimensions.height,
          position: clampedPosition.x + ' ' + clampedPosition.y + ' ' + clampedPosition.z,
          material: visiblePieceMaterial(figure.color || color || profile.accent),
          class: AUX_CLASS,
          'data-codexr-role': 'aux temporal-shape',
          'data-codexr-boats-shape': name,
          'data-codexr-temporal-tier': figure.temporalTier || 'current'
        },
        bounds: {
          minX: clampedPosition.x - safeDimensions.width * 0.5,
          maxX: clampedPosition.x + safeDimensions.width * 0.5,
          minY: clampedPosition.y - safeDimensions.height * 0.5,
          maxY: clampedPosition.y + safeDimensions.height * 0.5,
          minZ: clampedPosition.z - safeDimensions.depth * 0.5,
          maxZ: clampedPosition.z + safeDimensions.depth * 0.5
        }
      });
    };

    if (shape === 'ruin') {
      addBox('aged-ruin-main-low', { width: width * 0.68, depth: depth * 0.72, height: height * 0.58 }, { x: -width * 0.08, y: baseY + height * 0.29, z: depth * 0.03 }, profile.accent, 1);
      addBox('aged-ruin-rear-tower', { width: width * 0.34, depth: depth * 0.36, height: height * 0.82 }, { x: width * 0.22, y: baseY + height * 0.41, z: -depth * 0.23 }, profile.secondary, 1);
      addBox('aged-ruin-front-fragment', { width: width * 0.28, depth: depth * 0.28, height: height * 0.36 }, { x: -width * 0.31, y: baseY + height * 0.18, z: halfDepth - depth * 0.14 }, profile.highlight, 1);
      addBox('aged-ruin-broken-chimney', { width: Math.max(minUnit, width * 0.1), depth: Math.max(minUnit, depth * 0.12), height: height * 0.46 }, { x: halfWidth - width * 0.08, y: baseY + height * 0.23, z: -halfDepth + depth * 0.1 }, profile.secondary, 1);
      addBox('aged-ruin-offset-roof', { width: width * 0.5, depth: depth * 0.46, height: Math.max(minUnit, height * 0.08) }, { x: width * 0.04, y: baseY + height * 0.62, z: -depth * 0.08 }, profile.highlight, 1);
      return descriptors;
    }

    if (shape === 'heritage') {
      addBox('legacy-main-house', { width: width * 0.78, depth: depth * 0.78, height: height * 0.66 }, { x: 0, y: baseY + height * 0.33, z: 0 }, profile.accent, 1);
      addBox('legacy-front-annex', { width: width * 0.44, depth: depth * 0.34, height: height * 0.42 }, { x: -width * 0.12, y: baseY + height * 0.21, z: halfDepth - depth * 0.17 }, profile.secondary, 1);
      addBox('legacy-left-gable-roof', { width: width * 0.46, depth: depth * 0.9, height: Math.max(minUnit, height * 0.14) }, { x: -width * 0.13, y: baseY + height * 0.73, z: 0 }, profile.highlight, 1);
      addBox('legacy-right-gable-roof', { width: width * 0.46, depth: depth * 0.9, height: Math.max(minUnit, height * 0.14) }, { x: width * 0.13, y: baseY + height * 0.73, z: 0 }, profile.highlight, 1);
      addBox('legacy-wide-plinth', { width: width * 0.92, depth: depth * 0.9, height: height * 0.1 }, { x: 0, y: baseY + height * 0.05, z: 0 }, profile.secondary, 1);
      addBox('legacy-side-chimney', { width: Math.max(minUnit, width * 0.09), depth: Math.max(minUnit, depth * 0.12), height: height * 0.42 }, { x: halfWidth - width * 0.1, y: baseY + height * 0.52, z: -depth * 0.18 }, profile.accent, 1);
      return descriptors;
    }

    if (shape === 'modern') {
      addBox('fresh-central-tower', { width: width * 0.38, depth: depth * 0.58, height: height * 0.96 }, { x: width * 0.03, y: baseY + height * 0.48, z: 0 }, profile.secondary, 1);
      addBox('fresh-left-wing', { width: width * 0.34, depth: depth * 0.42, height: height * 0.56 }, { x: -width * 0.27, y: baseY + height * 0.28, z: depth * 0.08 }, profile.accent, 1);
      addBox('fresh-right-wing', { width: width * 0.28, depth: depth * 0.48, height: height * 0.68 }, { x: width * 0.31, y: baseY + height * 0.34, z: -depth * 0.06 }, profile.accent, 1);
      addBox('fresh-glass-crown', { width: width * 0.46, depth: depth * 0.64, height: height * 0.12 }, { x: width * 0.03, y: topY - height * 0.06, z: 0 }, profile.highlight, 1);
      addBox('fresh-left-fin', { width: Math.max(minUnit, width * 0.055), depth: depth * 0.74, height: height * 0.88 }, { x: -width * 0.19, y: baseY + height * 0.44, z: 0 }, profile.highlight, 1);
      addBox('fresh-right-fin', { width: Math.max(minUnit, width * 0.055), depth: depth * 0.74, height: height * 0.88 }, { x: width * 0.25, y: baseY + height * 0.44, z: 0 }, profile.highlight, 1);
      return descriptors;
    }

    addBox('current-main-block', { width: width * 0.72, depth: depth * 0.72, height: height * 0.82 }, { x: -width * 0.04, y: baseY + height * 0.41, z: 0 }, profile.accent, 1);
    addBox('current-service-side', { width: width * 0.22, depth: depth * 0.5, height: height * 0.58 }, { x: halfWidth - width * 0.11, y: baseY + height * 0.29, z: -depth * 0.04 }, profile.secondary, 1);
    addBox('current-entry-base', { width: width * 0.42, depth: Math.max(minUnit, depth * 0.18), height: height * 0.24 }, { x: -width * 0.08, y: baseY + height * 0.12, z: halfDepth - depth * 0.09 }, profile.highlight, 1);
    addBox('current-flat-parapet', { width: width * 0.78, depth: depth * 0.78, height: Math.max(minUnit, height * 0.07) }, { x: -width * 0.04, y: baseY + height * 0.855, z: 0 }, profile.secondary, 1);
    return descriptors;
  }

  function appendTemporalShapeDescriptor(parent, descriptor) {
    if (!descriptor || !descriptor.tag) {
      return;
    }
    parent.appendChild(createEntity(descriptor.tag, descriptor.attributes || {}));
  }

  function renderTemporalShape(parent, figure, profile) {
    buildTemporalShapeDescriptors(figure, profile).forEach(function (descriptor) {
      appendTemporalShapeDescriptor(parent, descriptor);
    });
  }

  function appendVisibleBuildingPiece(parent, descriptor, figure, profile, options) {
    if (!parent || !descriptor || !descriptor.tag || !descriptor.dimensions) {
      return null;
    }
    var piece = createEntity(descriptor.tag, descriptor.attributes || {});
    var pieceFigure = {
      width: descriptor.dimensions.width,
      depth: descriptor.dimensions.depth,
      height: descriptor.dimensions.height,
      temporalTier: figure.temporalTier || 'current'
    };
    buildTemporalSkinDescriptors(pieceFigure, profile, options && options.temporalSkinTextureBase).forEach(function (skinDescriptor) {
      if (!skinDescriptor || skinDescriptor.type === 'silhouette') {
        return;
      }
      appendTemporalSkinDescriptor(piece, skinDescriptor);
    });
    parent.appendChild(piece);
    return piece;
  }

  function renderVisibleBuildingPieces(parent, figure, profile, options) {
    var descriptors = buildTemporalShapeDescriptors(figure, profile);
    descriptors.forEach(function (descriptor) {
      appendVisibleBuildingPiece(parent, descriptor, figure, profile, options);
    });
    return descriptors.length;
  }

  function buildTemporalSkinDescriptors(figure, profile, textureBase) {
    if (!figure || !profile) {
      return [];
    }
    var visualStyle = getVisualStyleRuntime();
    var assets = visualStyle.getTemporalSkinAssets
       visualStyle.getTemporalSkinAssets(figure.temporalTier || profile.tier || 'current', textureBase)
      : {
        wall: (textureBase || './assets/codexr/code-xr-boats/temporal-skins') + '/' + (figure.temporalTier || 'current') + '-wall.svg',
        roof: (textureBase || './assets/codexr/code-xr-boats/temporal-skins') + '/' + (figure.temporalTier || 'current') + '-roof.svg',
        wallOpacity: 0.58,
        roofOpacity: 0.52,
        silhouette: profile.skin || 'current'
      };
    var descriptors = [];
    var skin = profile.skin || figure.temporalTier || 'current';
    var frontZ = (figure.depth * 0.5) + 0.003;
    var backZ = (-figure.depth * 0.5) - 0.003;
    var sideX = (figure.width * 0.5) + 0.003;
    var otherSideX = (-figure.width * 0.5) - 0.003;
    var topY = (figure.height * 0.5) + 0.003;
    var baseY = (-figure.height * 0.5) + Math.max(0.006, figure.height * 0.045);
    var lineWidth = clamp(figure.width * 0.045, 0.008, 0.035);
    var thinDepth = 0.006;
    var bandHeight = clamp(figure.height * 0.045, 0.008, 0.04);

    var addPlane = function (name, width, height, position, rotation, textureUrl, opacity) {
      descriptors.push({
        tag: 'a-plane',
        name: name,
        attributes: {
          width: Math.max(0.001, width),
          height: Math.max(0.001, height),
          position: position.x + ' ' + position.y + ' ' + position.z,
          rotation: rotation,
          material: textureMaterial(textureUrl, opacity),
          class: AUX_CLASS,
          'data-codexr-role': 'aux temporal-skin',
          'data-codexr-boats-skin': name,
          'data-codexr-temporal-tier': figure.temporalTier || 'current',
          'data-codexr-skin-asset': textureUrl
        }
      });
    };

    addPlane('wall-front', figure.width * 1.01, figure.height * 1.01, { x: 0, y: 0, z: frontZ }, '0 0 0', assets.wall, assets.wallOpacity);
    addPlane('wall-back', figure.width * 1.01, figure.height * 1.01, { x: 0, y: 0, z: backZ }, '0 180 0', assets.wall, assets.wallOpacity * 0.86);
    addPlane('wall-right', figure.depth * 1.01, figure.height * 1.01, { x: sideX, y: 0, z: 0 }, '0 90 0', assets.wall, assets.wallOpacity * 0.82);
    addPlane('wall-left', figure.depth * 1.01, figure.height * 1.01, { x: otherSideX, y: 0, z: 0 }, '0 -90 0', assets.wall, assets.wallOpacity * 0.82);
    addPlane('roof', figure.width * 1.01, figure.depth * 1.01, { x: 0, y: topY, z: 0 }, '-90 0 0', assets.roof, assets.roofOpacity);

    return descriptors.concat([{ type: 'silhouette', skin: skin, assets: assets, baseY: baseY, topY: topY, lineWidth: lineWidth, thinDepth: thinDepth, bandHeight: bandHeight, frontZ: frontZ, sideX: sideX }]);
  }

  function appendTemporalSkinDescriptor(parent, descriptor) {
    if (!descriptor || !descriptor.tag) {
      return;
    }
    parent.appendChild(createEntity(descriptor.tag, descriptor.attributes || {}));
  }

  function renderTemporalSkin(parent, figure, profile, options) {
    if (!parent || !figure || !profile) {
      return;
    }
    var descriptors = buildTemporalSkinDescriptors(figure, profile, options && options.temporalSkinTextureBase);
    descriptors.forEach(function (descriptor) {
      if (!descriptor || descriptor.type === 'silhouette') {
        return;
      }
      appendTemporalSkinDescriptor(parent, descriptor);
    });
    var silhouette = descriptors.find  descriptors.find(function (descriptor) { return descriptor && descriptor.type === 'silhouette'; }) : null;
    var skin = (silhouette && silhouette.skin) || profile.skin || figure.temporalTier || 'current';
    var frontZ = silhouette  silhouette.frontZ : ((figure.depth * 0.5) + 0.003);
    var sideX = silhouette  silhouette.sideX : ((figure.width * 0.5) + 0.003);
    var topY = silhouette  silhouette.topY : ((figure.height * 0.5) + 0.003);
    var baseY = silhouette  silhouette.baseY : ((-figure.height * 0.5) + Math.max(0.006, figure.height * 0.045));
    var lineWidth = silhouette  silhouette.lineWidth : clamp(figure.width * 0.045, 0.008, 0.035);
    var thinDepth = silhouette  silhouette.thinDepth : 0.006;
    var bandHeight = silhouette  silhouette.bandHeight : clamp(figure.height * 0.045, 0.008, 0.04);

    if (skin === 'legacy') {
      appendTemporalSkinBox(parent, figure, profile, 'legacy-plinth', {
        width: figure.width * 1.03,
        depth: thinDepth,
        height: bandHeight * 1.7
      }, { x: 0, y: baseY, z: frontZ }, profile.secondary, 0.52);
      appendTemporalSkinBox(parent, figure, profile, 'legacy-cornice', {
        width: figure.width * 1.05,
        depth: figure.depth * 1.05,
        height: bandHeight
      }, { x: 0, y: topY - bandHeight * 0.5, z: 0 }, profile.accent, 0.42);
      [-0.25, 0.04, 0.28].forEach(function (offset, index) {
        appendTemporalSkinBox(parent, figure, profile, 'legacy-crack-' + index, {
          width: lineWidth * (index === 1  0.72 : 1),
          depth: thinDepth,
          height: figure.height * (index === 1  0.58 : 0.76)
        }, { x: figure.width * offset, y: figure.height * (index === 1  -0.05 : 0.03), z: frontZ + 0.001 }, profile.accent, 0.5);
      });
      return;
    }

    if (skin === 'aged') {
      [-0.22, 0.05, 0.32].forEach(function (offset, index) {
        appendTemporalSkinBox(parent, figure, profile, 'aged-band-' + index, {
          width: figure.width * 1.02,
          depth: thinDepth,
          height: bandHeight
        }, { x: 0, y: figure.height * offset, z: frontZ }, index === 1  profile.secondary : profile.accent, 0.34);
      });
      appendTemporalSkinBox(parent, figure, profile, 'aged-top-edge', {
        width: figure.width * 0.86,
        depth: figure.depth * 0.86,
        height: bandHeight
      }, { x: 0, y: topY - bandHeight * 0.5, z: 0 }, profile.secondary, 0.38);
      return;
    }

    if (skin === 'fresh') {
      [-0.28, 0, 0.28].forEach(function (offset, index) {
        appendTemporalSkinBox(parent, figure, profile, 'fresh-light-' + index, {
          width: Math.max(0.006, lineWidth * 0.65),
          depth: thinDepth,
          height: figure.height * 0.86
        }, { x: figure.width * offset, y: 0, z: frontZ + 0.001 }, index === 1  profile.highlight : profile.secondary, index === 1  0.56 : 0.42);
      });
      appendTemporalSkinBox(parent, figure, profile, 'fresh-crown', {
        width: figure.width * 0.86,
        depth: figure.depth * 0.86,
        height: Math.max(0.01, bandHeight * 0.8)
      }, { x: 0, y: topY + bandHeight * 0.2, z: 0 }, profile.highlight, 0.44);
      return;
    }

    [-0.22, 0.22].forEach(function (offset, index) {
      appendTemporalSkinBox(parent, figure, profile, 'current-pane-' + index, {
        width: Math.max(0.01, figure.width * 0.18),
        depth: thinDepth,
        height: figure.height * 0.78
      }, { x: figure.width * offset, y: 0, z: frontZ }, index  profile.secondary : profile.accent, 0.3);
    });
    appendTemporalSkinBox(parent, figure, profile, 'current-side-pane', {
      width: thinDepth,
      depth: figure.depth * 0.52,
      height: figure.height * 0.72
    }, { x: sideX, y: 0, z: 0 }, profile.highlight, 0.18);
  }

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
       Math.max(0, Number(component.options.animationDuration) || 0)
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
      hoverableCount: el.querySelectorAll  el.querySelectorAll('[data-codexr-boats-key]').length : 0,
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
        removeRenderRoots(oldRenderRoots.filter  oldRenderRoots.filter(function (rootEl) {
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
        el.emit.('codexr-boats-rendered', {
          width: layout.width,
          depth: layout.depth,
          buildingCount: layout.stats.leafCount,
          animated: true
        });
      }, animationDuration);
    } else {
      el.emit.('codexr-boats-rendered', {
        width: layout.width,
        depth: layout.depth,
        buildingCount: layout.stats.leafCount,
        animated: false
      });
    }
  }

  function readSourceData(component) {
    var data = component.data || {};
    if (data.data) {
      return parseJson(data.data, []);
    }
    if (!data.from || !getDocument()) {
      return [];
    }
    var sourceEl = getDocument().getElementById(data.from);
    var sourceComponent = sourceEl && sourceEl.components && (
      sourceEl.components['babia-treebuilder']
      || sourceEl.components['babia-queryjson']
      || sourceEl.components['babia-filter']
    );
    if (sourceComponent && sourceComponent.notiBuffer && sourceComponent.notiBuffer.data !== undefined) {
      return sourceComponent.notiBuffer.data;
    }
    if (sourceComponent && sourceComponent.babiaData !== undefined) {
      return sourceComponent.babiaData;
    }
    return [];
  }

  function scheduleSourceRetry(component) {
    if (component.sourceRetryTimer || !component.data || !component.data.from) {
      return;
    }
    if (component.sourceRetryCount > 20) {
      return;
    }
    component.sourceRetryCount += 1;
    component.sourceRetryTimer = setTimeout(function () {
      component.sourceRetryTimer = null;
      subscribeToSource(component, {});
      component.processData(readSourceData(component));
    }, 100);
  }

  function subscribeToSource(component, oldData) {
    var data = component.data || {};
    if (component.prodComponent && component.notiBufferId !== undefined && oldData && oldData.from !== data.from) {
      component.prodComponent.notiBuffer.unregister.(component.notiBufferId);
      component.prodComponent = null;
      component.notiBufferId = undefined;
    }
    if (!data.from || component.prodComponent || !getDocument()) {
      return;
    }
    var sourceEl = getDocument().getElementById(data.from);
    var sourceComponent = sourceEl && sourceEl.components && (
      sourceEl.components['babia-treebuilder']
      || sourceEl.components['babia-queryjson']
      || sourceEl.components['babia-filter']
    );
    if (!sourceComponent || !sourceComponent.notiBuffer || typeof sourceComponent.notiBuffer.register !== 'function') {
      scheduleSourceRetry(component);
      return;
    }
    component.prodComponent = sourceComponent;
    component.sourceRetryCount = 0;
    component.notiBufferId = sourceComponent.notiBuffer.register(function (nextData) {
      component.processData(nextData);
    });
  }

  function buildOptions(data) {
    return {
      areaField: data.area || 'area',
      heightField: data.height || 'height',
      colorField: data.color || 'color',
      field: data.field || 'uid',
      palette: data.palette || 'ubuntu',
      border: Math.max(0, toFiniteNumber(data.border, 0.5)),
      extra: Math.max(0, toFiniteNumber(data.extra, 1)),
      separation: Math.max(0, toFiniteNumber(data.separation, 0.5)),
      zoneElevation: Math.max(0.001, toFiniteNumber(data.zone_elevation, 0.01)),
      zoneStepThickness: Math.max(0.001, toFiniteNumber(data.zone_step_thickness, 0.012)),
      zoneStepRise: Math.max(0.001, toFiniteNumber(data.zone_step_rise, 0.018)),
      minBuildingHeight: Math.max(0.001, toFiniteNumber(data.minBuildingHeight, 0.22)),
      maxBuildingHeight: Math.max(0.05, toFiniteNumber(data.maxBuildingHeight, 2)),
      baseColor: data.base_color || '#98e690',
      zoneBaseColor: data.zone_base_color || data.base_color || '#4f9e54',
      zoneTopColor: data.zone_top_color || '#b8f7b0',
      baseAlpha: clamp(toFiniteNumber(data.baseAlpha, 1), 0, 1),
      buildingAlpha: clamp(toFiniteNumber(data.buildingAlpha, 1), 0, 1),
      legend: data.legend !== false,
      legendText: data.legend_text || '{name}',
      legendScale: toFiniteNumber(data.legend_scale, 1),
      heightQuarterLegendBox: toFiniteNumber(data.height_quarter_legend_box, 0.01),
      heightQuarterLegendTitle: toFiniteNumber(data.height_quarter_legend_title, 2.5),
      hideQuarterBoxLegend: data.hideQuarterBoxLegend !== false,
      animation: data.animation !== false,
      animationDuration: Math.max(0, toFiniteNumber(data.animationDuration, 1200)),
      fixedSize: data.fixed_size !== false,
      fixedWidth: Math.max(0.5, toFiniteNumber(data.fixed_width, 17.8)),
      fixedDepth: Math.max(0.5, toFiniteNumber(data.fixed_depth, 6.3)),
      fixedHeight: Math.max(0.05, toFiniteNumber(data.fixed_height, 1.174)),
      fixedPadding: Math.max(0, toFiniteNumber(data.fixed_padding, 0.18)),
      temporalSkinTextureBase: data.temporalSkinTextureBase || './assets/codexr/code-xr-boats/temporal-skins'
    };
  }

  function getChartState(id) {
    if (!id) {
      return Object.keys(state.charts).map(function (key) { return state.charts[key]; });
    }
    return state.charts[id] || null;
  }

  function registerComponent(AFRAME) {
    if (!AFRAME || !AFRAME.registerComponent || AFRAME.components.[COMPONENT]) {
      return false;
    }
    AFRAME.registerComponent(COMPONENT, {
      schema: {
        data: { type: 'string' },
        from: { type: 'string' },
        border: { type: 'number', default: 0.5 },
        area: { type: 'string', default: 'area' },
        color: { type: 'string', default: 'color' },
        height: { type: 'string', default: 'height' },
        maxBuildingHeight: { type: 'number', default: 2 },
        minBuildingHeight: { type: 'number', default: 0.22 },
        zone_elevation: { type: 'number', default: 0.01 },
        zone_step_thickness: { type: 'number', default: 0.012 },
        zone_step_rise: { type: 'number', default: 0.018 },
        separation: { type: 'number', default: 0.5 },
        extra: { type: 'number', default: 1 },
        buildingAlpha: { type: 'number', default: 1 },
        base_color: { type: 'color', default: '#98e690' },
        zone_base_color: { type: 'color', default: '#4f9e54' },
        zone_top_color: { type: 'color', default: '#b8f7b0' },
        baseAlpha: { type: 'number', default: 1 },
        height_quarter_legend_box: { type: 'number', default: 0.01 },
        height_quarter_legend_title: { type: 'number', default: 2.5 },
        height_building_legend: { type: 'number', default: -0.5 },
        legend_scale: { type: 'number', default: 0.25 },
        legend_lookat: { type: 'string', default: '[laser-controls]' },
        legend_text: { type: 'string', default: '{name}' },
        legend: { type: 'boolean', default: true },
        hideQuarterBoxLegend: { type: 'boolean', default: true },
        animation: { type: 'boolean', default: true },
        animationDuration: { type: 'number', default: 1200 },
        fixed_size: { type: 'boolean', default: true },
        fixed_width: { type: 'number', default: 17.8 },
        fixed_depth: { type: 'number', default: 6.3 },
        fixed_height: { type: 'number', default: 1.174 },
        fixed_padding: { type: 'number', default: 0.18 },
        temporalSkinTextureBase: { type: 'string', default: './assets/codexr/code-xr-boats/temporal-skins' },
        field: { type: 'string', default: 'uid' },
        palette: { type: 'string', default: 'ubuntu' },
        title: { type: 'string' },
        axis_name: { type: 'boolean', default: true }
      },
      init: function () {
        this.runtimeId = 'codexr-boats-' + Date.now() + '-' + Math.round(Math.random() * 100000);
        this.layout = null;
        this.options = buildOptions(this.data || {});
        this.sourceRetryTimer = null;
        this.sourceRetryCount = 0;
        this.tooltip = null;
        this.pinnedTooltips = {};
        this.figureElements = {};
        this.activeRenderRoot = null;
        this.pendingRenderRoot = null;
        this.animationState = { active: false, startedAt: 0, duration: 0, stableKeys: [] };
        this.animationTimer = null;
      },
      update: function (oldData) {
        this.options = buildOptions(this.data || {});
        subscribeToSource(this, oldData || {});
        this.processData(readSourceData(this));
      },
      remove: function () {
        if (this.sourceRetryTimer) {
          clearTimeout(this.sourceRetryTimer);
          this.sourceRetryTimer = null;
        }
        if (this.animationTimer) {
          clearTimeout(this.animationTimer);
          this.animationTimer = null;
        }
        this.prodComponent.notiBuffer.unregister.(this.notiBufferId);
        removeTooltip(this);
        this.activeRenderRoot = null;
        this.pendingRenderRoot = null;
        delete state.charts[this.el.id || this.runtimeId];
      },
      tick: function () {
        if (this.tooltip && this.tooltip.root && root.CodeXRCommonRuntime.faceCamera) {
          root.CodeXRCommonRuntime.faceCamera(this.tooltip.root, this.el.sceneEl);
        }
        Object.keys(this.pinnedTooltips || {}).forEach(function (key) {
          var tooltip = this.pinnedTooltips[key];
          if (tooltip && tooltip.root && root.CodeXRCommonRuntime.faceCamera) {
            root.CodeXRCommonRuntime.faceCamera(tooltip.root, this.el.sceneEl);
          }
        }, this);
      },
      ensureTooltip: function () {
        if (this.tooltip && this.tooltip.root && this.tooltip.root.parentNode) {
          this.tooltip.root.setAttribute('class', AUX_CLASS + ' codexr-boats-tooltip');
          this.tooltip.root.setAttribute('data-codexr-role', 'tooltip overlay');
          this.tooltip.root.setAttribute('data-codexr-owner', this.el.id || this.runtimeId);
          moveTooltipToHost(this, this.tooltip);
          return this.tooltip;
        }
        this.tooltip = createBoatsTooltip(this, { accentColor: '#22d3ee', width: 3.65, height: .96 });
        return this.tooltip;
      },
      getPinnedKeys: function () {
        return Object.keys(this.pinnedTooltips || {});
      },
      isTooltipPinned: function (key) {
        return !!(key && this.pinnedTooltips && this.pinnedTooltips[key]);
      },
      updateTooltipEntity: function (tooltip, entity, figure, pinned, index) {
        if (!tooltip || !root.CodeXRCommonRuntime.updateTooltip || !figure) {
          return false;
        }
        var detail = buildReadableTooltipDetail(figure, this.options);
        var rowCount = Array.isArray(detail && detail.rows)  detail.rows.length : 0;
        var tooltipHeight = Math.max(.96, 0.66 + rowCount * 0.16);
        var position = getTooltipAnchor(this, entity, figure, tooltipHeight);
        if (pinned && Number.isFinite(index)) {
          position = offsetPinnedTooltipPosition(position, index, tooltipHeight);
        } else {
          position = offsetHoverTooltipPosition(position, this.getPinnedKeys  this.getPinnedKeys().length : 0);
        }
        return root.CodeXRCommonRuntime.updateTooltip(tooltip, detail, position, {
          width: pinned  3.78 : 3.65,
          minHeight: .96,
          titleLength: 28,
          subtitleLength: 42,
          primaryLength: 70,
          secondaryLength: 70,
          rowLabelLength: 13,
          rowValueLength: 34,
          connectorTarget: pinned  getFigureWorldAnchor(this, entity, figure) : null,
          connectorColor: figure.kind === 'quarter'  '#86efac' : '#f59e0b',
          animationDuration: pinned  220 : 260
        });
      },
      showTooltip: function (entity, figure) {
        var tooltip = this.ensureTooltip();
        return this.updateTooltipEntity(tooltip, entity, figure, false, 0);
      },
      hideTooltip: function () {
        if (this.tooltip && root.CodeXRCommonRuntime.hideTooltip) {
          root.CodeXRCommonRuntime.hideTooltip(this.tooltip);
          return true;
        }
        if (this.tooltip && this.tooltip.root) {
          this.tooltip.root.setAttribute('visible', false);
          return true;
        }
        return false;
      },
      clearTooltips: function () {
        removeTooltip(this);
        updatePinnedTooltipRuntimeCount(this);
        return true;
      },
      togglePinnedTooltip: function (entity, figure) {
        if (!figure || !figure.key) {
          return false;
        }
        if (this.pinnedTooltips[figure.key]) {
          removeTooltipRoot(this.pinnedTooltips[figure.key]);
          delete this.pinnedTooltips[figure.key];
          updatePinnedTooltipRuntimeCount(this);
          return true;
        }
        var tooltip = createBoatsTooltip(this, {
          accentColor: figure.kind === 'quarter'  '#86efac' : '#f59e0b',
          width: 3.78,
          height: 1.02,
          key: figure.key,
          pinned: true
        });
        if (!tooltip) {
          return false;
        }
        this.pinnedTooltips[figure.key] = tooltip;
        this.hideTooltip();
        var updated = this.updateTooltipEntity(tooltip, entity, figure, true, this.getPinnedKeys().length - 1);
        updatePinnedTooltipRuntimeCount(this);
        return updated;
      },
      refreshPinnedTooltips: function () {
        Object.keys(this.pinnedTooltips || {}).forEach(function (key, index) {
          var match = this.figureElements && this.figureElements[key];
          if (!match || !match.entity || !match.figure) {
            removeTooltipRoot(this.pinnedTooltips[key]);
            delete this.pinnedTooltips[key];
            return;
          }
          this.updateTooltipEntity(this.pinnedTooltips[key], match.entity, match.figure, true, index);
        }, this);
        updatePinnedTooltipRuntimeCount(this);
      },
      processData: function (data) {
        var tree = Array.isArray(data)  data : [];
        this.options = buildOptions(this.data || {});
        renderLayout(this, buildLayout(tree, this.options));
      }
    });
    return true;
  }

  var runtime = {
    registerComponent: registerComponent,
    getChartState: getChartState,
    __testing: {
      buildOptions: buildOptions,
      buildLayout: buildLayout,
      computeLayoutBounds: computeLayoutBounds,
      normalizeLayoutFixedBox: normalizeLayoutFixedBox,
      normalizeLayoutFloor: normalizeLayoutFloor,
      buildTooltipDetail: buildReadableTooltipDetail,
      buildTemporalShapeDescriptors: buildTemporalShapeDescriptors,
      renderVisibleBuildingPieces: renderVisibleBuildingPieces,
      metricEnvelopeMaterial: metricEnvelopeMaterial,
      visiblePieceMaterial: visiblePieceMaterial,
      compactPath: compactPath,
      getTooltipAnchor: getTooltipAnchor,
      collectBuildings: collectBuildings,
      collectLeaves: collectLeaves,
      normalizeRange: normalizeRange,
      mixHexColor: mixHexColor,
      resolveZoneColor: resolveZoneColor,
      pickColor: pickColor,
      gradientColor: gradientColor,
      buildColorStats: buildColorStats,
      resolveBuildingColor: resolveBuildingColor,
      getVisualStyleRuntime: getVisualStyleRuntime,
      formatModifiedAt: formatModifiedAt,
      buildTemporalSkinDescriptors: buildTemporalSkinDescriptors,
      getChartLocalPosition: getChartLocalPosition,
      collectElementSnapshots: collectElementSnapshots,
      getActiveRenderRoot: getActiveRenderRoot,
      nearlySameVec3: nearlySameVec3,
      resolveAnimationFromPosition: resolveAnimationFromPosition,
      resolveContainmentSafePlanarSize: resolveContainmentSafePlanarSize,
      POSITION_EPSILON: POSITION_EPSILON
    }
  };

  registerComponent(root.AFRAME);
  if (root.AFRAME && root.AFRAME.components && root.AFRAME.components[COMPONENT]) {
    root.CodeXRBoatsRuntime = runtime;
  }
  return runtime;
});
