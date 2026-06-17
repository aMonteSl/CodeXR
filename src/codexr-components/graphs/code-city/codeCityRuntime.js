(function registerCodeXRCodeCityRuntime(root) {
  'use strict';

  var COMPONENT = 'codexr-code-city';
  var RAYCAST_CLASS = 'babiaxraycasterclass';
  var CITY_WIDTH = 5.25;
  var CITY_DEPTH = 3.05;
  var CITY_MARGIN = 0.06;
  var CITY_BASE_HEIGHT = 0.055;
  var CITY_BASE_PADDING = 0.14;
  var DISTRICT_GAP = 0.07;
  var DISTRICT_INSET = 0.095;
  var DISTRICT_BASE_HEIGHT = 0.055;
  var DISTRICT_LEVEL_RISE = 0.078;
  var DISTRICT_TOP_PADDING = 0.014;
  var MIN_BUILDING_FOOTPRINT = 0.018;
  var MIN_BUILDING_HEIGHT = 0.12;
  var MAX_BUILDING_HEIGHT = 0.98;
  var BUILDING_ROOF_RATIO = 0.14;
  var GEOMETRY_EVENT = 'codexr-geometry-updated';
  var DEFAULT_PALETTE = [
    '#22d3ee', '#60a5fa', '#a78bfa', '#f472b6', '#fb7185',
    '#f97316', '#facc15', '#34d399', '#2dd4bf', '#c084fc'
  ];
  var DISTRICT_PALETTE = ['#0f766e', '#15803d', '#1d4ed8', '#7c3aed', '#be123c'];

  function common() {
    return root.CodeXRGraphCommonRuntime || {};
  }

  function doc() {
    return root.document || null;
  }

  function entity(tagName, attributes) {
    var factory = common().createEntity || common().entity;
    if (typeof factory === 'function') {
      return factory(tagName, attributes);
    }
    var element = doc()?.createElement(tagName || 'a-entity');
    Object.keys(attributes || {}).forEach(function (key) {
      element.setAttribute(key, attributes[key]);
    });
    return element;
  }

  function normalizePath(value) {
    var normalizer = common().normalizePath;
    if (typeof normalizer === 'function') { return normalizer(value); }
    return String(value || '').replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/+/, '').trim();
  }

  function compact(value, maximum) {
    var helper = common().compactText;
    if (typeof helper === 'function') { return helper(value, maximum); }
    var normalized = String(value || '').replace(/\s+/g, ' ').trim();
    var limit = Math.max(4, maximum || 48);
    return normalized.length > limit ? normalized.slice(0, limit - 3) + '...' : normalized;
  }

  function numeric(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : (fallback || 0);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function hexToRgb(color) {
    var normalized = String(color || '').replace('#', '').trim();
    if (normalized.length === 3) {
      normalized = normalized.split('').map(function (part) { return part + part; }).join('');
    }
    var value = parseInt(normalized, 16);
    if (!Number.isFinite(value)) { return [255, 255, 255]; }
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  }

  function rgbToHex(rgb) {
    return '#' + rgb.map(function (part) {
      return clamp(Math.round(part), 0, 255).toString(16).padStart(2, '0');
    }).join('');
  }

  function mixColor(color, target, ratio) {
    var source = hexToRgb(color);
    var destination = hexToRgb(target);
    var amount = clamp(Number(ratio) || 0, 0, 1);
    return rgbToHex(source.map(function (part, index) {
      return part + (destination[index] - part) * amount;
    }));
  }

  function districtCenterY(depth) {
    return CITY_BASE_HEIGHT / 2 + 0.01 + Math.max(0, depth || 0) * DISTRICT_LEVEL_RISE;
  }

  function districtTopY(depth) {
    return districtCenterY(depth) + DISTRICT_BASE_HEIGHT / 2;
  }

  function safeField(record, field) {
    return record && field ? record[field] : undefined;
  }

  function text(value, position, width, color, align) {
    return entity('a-text', {
      value: value || '',
      align: align || 'center',
      color: color || '#e0f2fe',
      width: width || 4,
      position: position || '0 0 0',
      'wrap-count': 28,
      'data-codexr-role': 'label',
      side: 'double'
    });
  }

  function pathPartsForRecord(record, mode) {
    if (mode === 'file') {
      var treePath = normalizePath(record.treePath || record.qualifiedName || record.name);
      if (treePath) { return treePath.split('/').filter(Boolean); }
      var fileName = record.fileName || (record.filePath ? normalizePath(record.filePath).split('/').pop() : 'file');
      var container = record.className || record.containerName || record.namespace || record.moduleName || 'module';
      var functionName = record.functionName || record.name || 'module-code';
      return [fileName || 'file', container || 'module', functionName || 'module-code'];
    }
    var relativePath = normalizePath(record.relativePath || record.filePath || record.fileName || record.name);
    return relativePath ? relativePath.split('/').filter(Boolean) : [record.fileName || record.name || 'file'];
  }

  function inferMode(records) {
    return records.some(function (record) {
      return record && (
        record.functionName
        || record.treePath
        || record.className
        || record.containerName
        || record.lineCount !== undefined
      );
    }) ? 'file' : 'directory';
  }

  function leafLabel(record, parts, mode) {
    if (mode === 'file') {
      return record.functionName || record.name || parts[parts.length - 1] || 'function';
    }
    return record.fileName || parts[parts.length - 1] || record.name || 'file';
  }

  function buildLeaves(records, mode) {
    return (Array.isArray(records) ? records : []).map(function (record, index) {
      var parts = pathPartsForRecord(record || {}, mode);
      var label = leafLabel(record || {}, parts, mode);
      var directories = mode === 'file'
        ? parts.slice(0, Math.max(1, parts.length - 1))
        : parts.slice(0, -1);
      if (!directories.length) {
        directories = [mode === 'file' ? '(module)' : '(project root)'];
      }
      var stablePath = parts.join('/');
      var explicitId = record.uid || record.id || record.stableId || record.symbolId || record.key;
      var rawId = explicitId || stablePath || label || ('item-' + index);
      var needsOrdinal = !explicitId && !stablePath;
      var stableId = 'leaf:' + normalizePath(rawId || '').replace(/[^a-zA-Z0-9_./:-]+/g, '-');
      return {
        id: stableId + (needsOrdinal ? ':' + index : ''),
        record: record || {},
        label: label,
        pathParts: parts,
        directoryParts: directories,
        path: stablePath,
        weight: Math.max(1, numeric(record.totalLines ?? record.lineCount ?? record.codeLines ?? record.parameters, 1))
      };
    });
  }

  function makeNode(label, path, depth) {
    return {
      label: label,
      path: path,
      depth: depth || 0,
      children: new Map(),
      leaves: [],
      leafCount: 0,
      childCount: 0,
      weight: 0
    };
  }

  function buildDistrictTree(leaves) {
    var rootNode = makeNode('Project', '', 0);
    leaves.forEach(function (leaf) {
      var node = rootNode;
      leaf.directoryParts.forEach(function (part, index) {
        var path = leaf.directoryParts.slice(0, index + 1).join('/');
        if (!node.children.has(part)) {
          node.children.set(part, makeNode(part, path, index + 1));
        }
        node = node.children.get(part);
      });
      node.leaves.push(leaf);
    });
    function compute(node) {
      var leafWeight = node.leaves.reduce(function (sum, leaf) { return sum + Math.max(1, leaf.weight || 1); }, 0);
      var childWeight = Array.from(node.children.values()).reduce(function (sum, child) { return sum + compute(child); }, 0);
      node.leafCount = node.leaves.length + Array.from(node.children.values()).reduce(function (sum, child) {
        return sum + (child.leafCount || 0);
      }, 0);
      node.childCount = node.children.size;
      node.weight = Math.max(1, leafWeight + childWeight);
      return node.weight;
    }
    compute(rootNode);
    return rootNode;
  }

  function insetRect(rect, inset) {
    var safeInset = Math.max(0, Math.min(
      Number(inset) || 0,
      Math.max(0, rect.width / 2 - 0.005),
      Math.max(0, rect.depthSize / 2 - 0.005)
    ));
    return {
      x: rect.x,
      z: rect.z,
      width: Math.max(0.01, rect.width - safeInset * 2),
      depthSize: Math.max(0.01, rect.depthSize - safeInset * 2)
    };
  }

  function layoutTreemap(items, rect) {
    if (!items.length) { return; }
    var totalWeight = items.reduce(function (sum, item) { return sum + Math.max(1, item.weight || 1); }, 0);
    var totalArea = Math.max(0.0001, rect.width * rect.depthSize);
    var queue = items.map(function (item, index) {
      return {
        item: item,
        area: totalArea * Math.max(1, item.weight || 1) / totalWeight,
        order: index
      };
    }).sort(function (a, b) {
      var weightDiff = Math.max(1, b.item.weight || 1) - Math.max(1, a.item.weight || 1);
      return weightDiff || a.order - b.order;
    });
    var results = [];

    function worst(row, side) {
      if (!row.length) { return Infinity; }
      var sum = row.reduce(function (value, entry) { return value + entry.area; }, 0);
      var max = Math.max.apply(Math, row.map(function (entry) { return entry.area; }));
      var min = Math.min.apply(Math, row.map(function (entry) { return entry.area; }));
      var sideSquared = Math.max(0.0001, side * side);
      var sumSquared = Math.max(0.0001, sum * sum);
      return Math.max((sideSquared * max) / sumSquared, sumSquared / (sideSquared * Math.max(0.0001, min)));
    }

    function consumeRow(row, remaining) {
      var sum = row.reduce(function (value, entry) { return value + entry.area; }, 0);
      if (remaining.width >= remaining.depthSize) {
        var rowWidth = Math.min(remaining.width, Math.max(0.01, sum / Math.max(0.01, remaining.depthSize)));
        var zCursor = remaining.z - remaining.depthSize / 2;
        var xMin = remaining.x - remaining.width / 2;
        row.forEach(function (entry) {
          var depthSize = Math.min(remaining.depthSize, Math.max(0.01, entry.area / rowWidth));
          results.push({
            item: entry.item,
            rect: {
              x: xMin + rowWidth / 2,
              z: zCursor + depthSize / 2,
              width: rowWidth,
              depthSize: depthSize
            }
          });
          zCursor += depthSize;
        });
        var nextWidth = Math.max(0.01, remaining.width - rowWidth);
        return {
          x: xMin + rowWidth + nextWidth / 2,
          z: remaining.z,
          width: nextWidth,
          depthSize: remaining.depthSize
        };
      }
      var rowDepth = Math.min(remaining.depthSize, Math.max(0.01, sum / Math.max(0.01, remaining.width)));
      var xCursor = remaining.x - remaining.width / 2;
      var zMin = remaining.z - remaining.depthSize / 2;
      row.forEach(function (entry) {
        var width = Math.min(remaining.width, Math.max(0.01, entry.area / rowDepth));
        results.push({
          item: entry.item,
          rect: {
            x: xCursor + width / 2,
            z: zMin + rowDepth / 2,
            width: width,
            depthSize: rowDepth
          }
        });
        xCursor += width;
      });
      var nextDepth = Math.max(0.01, remaining.depthSize - rowDepth);
      return {
        x: remaining.x,
        z: zMin + rowDepth + nextDepth / 2,
        width: remaining.width,
        depthSize: nextDepth
      };
    }

    var row = [];
    var remaining = Object.assign({}, rect);
    while (queue.length) {
      var candidate = queue[0];
      var side = Math.min(remaining.width, remaining.depthSize);
      if (!row.length || worst(row.concat([candidate]), side) <= worst(row, side)) {
        row.push(queue.shift());
      } else {
        remaining = consumeRow(row, remaining);
        row = [];
      }
    }
    if (row.length) { consumeRow(row, remaining); }
    results.sort(function (a, b) { return a.item.__order - b.item.__order; });
    return results;
  }

  function layoutGrid(items, rect) {
    if (!items.length) { return []; }
    var count = items.length;
    var aspect = Math.max(0.2, rect.width / Math.max(0.01, rect.depthSize));
    var columns = Math.max(1, Math.ceil(Math.sqrt(count * aspect)));
    var rows = Math.max(1, Math.ceil(count / columns));
    var cellWidth = rect.width / columns;
    var cellDepth = rect.depthSize / rows;
    return items.map(function (item, index) {
      var column = index % columns;
      var row = Math.floor(index / columns);
      return {
        item: item,
        rect: {
          x: rect.x - rect.width / 2 + cellWidth * column + cellWidth / 2,
          z: rect.z - rect.depthSize / 2 + cellDepth * row + cellDepth / 2,
          width: cellWidth,
          depthSize: cellDepth
        }
      };
    });
  }

  function layoutItems(items, rect, depth, out) {
    if (!items.length) { return; }
    var gap = items.length > 1 ? Math.min(DISTRICT_GAP, Math.min(rect.width, rect.depthSize) / Math.max(8, Math.sqrt(items.length) * 5)) : 0;
    var orderedItems = items.map(function (item, index) {
      return Object.assign({ __order: index }, item);
    });
    var slots = orderedItems.every(function (item) { return item.type === 'leaf'; }) && orderedItems.length > 2
      ? layoutGrid(orderedItems, rect)
      : layoutTreemap(orderedItems, rect);
    slots.forEach(function (slot) {
      var item = slot.item;
      var childRect = insetRect(slot.rect, gap / 2);
      if (item.type === 'leaf') {
        item.leaf.x = childRect.x;
        item.leaf.z = childRect.z;
        item.leaf.cellWidth = Math.max(0.01, childRect.width);
        item.leaf.cellDepth = Math.max(0.01, childRect.depthSize);
        item.leaf.containerPath = nodePathFromRectOwner(item.owner);
        item.leaf.bounds = {
          xMin: childRect.x - childRect.width / 2,
          xMax: childRect.x + childRect.width / 2,
          zMin: childRect.z - childRect.depthSize / 2,
          zMax: childRect.z + childRect.depthSize / 2
        };
        out.leaves.push(item.leaf);
      } else {
        out.districts.push({
          id: 'district:' + (item.node.path || item.node.label),
          label: item.node.label,
          path: item.node.path,
          depth: depth,
          x: childRect.x,
          z: childRect.z,
          width: Math.max(0.01, childRect.width),
          depthSize: Math.max(0.01, childRect.depthSize),
          bounds: {
            xMin: childRect.x - childRect.width / 2,
            xMax: childRect.x + childRect.width / 2,
            zMin: childRect.z - childRect.depthSize / 2,
            zMax: childRect.z + childRect.depthSize / 2
          },
          weight: item.node.weight,
          leafCount: item.node.leafCount || item.node.leaves.length,
          childCount: item.node.childCount || item.node.children.size
        });
        var insetX = Math.min(DISTRICT_INSET, Math.max(0, childRect.width * 0.18));
        var insetZ = Math.min(DISTRICT_INSET, Math.max(0, childRect.depthSize * 0.18));
        var inner = {
          x: childRect.x,
          z: childRect.z,
          width: Math.max(0.01, childRect.width - insetX * 2),
          depthSize: Math.max(0.01, childRect.depthSize - insetZ * 2)
        };
        layoutNode(item.node, inner, depth + 1, out);
      }
    });
  }

  function layoutNode(node, rect, depth, out) {
    var childItems = Array.from(node.children.values()).map(function (child) {
      return { type: 'district', node: child, weight: child.weight };
    });
    var leafItems = node.leaves.map(function (leaf) {
      return { type: 'leaf', leaf: leaf, weight: leaf.weight, owner: node };
    });
    layoutItems(childItems.concat(leafItems), rect, depth, out);
  }

  function nodePathFromRectOwner(node) {
    return node && typeof node.path === 'string' ? node.path : '';
  }

  function layoutLeaves(leaves, options) {
    var opts = options || {};
    var tree = buildDistrictTree(leaves);
    var out = { leaves: [], districts: [] };
    layoutNode(tree, {
      x: 0,
      z: 0,
      width: Number(opts.width) || CITY_WIDTH,
      depthSize: Number(opts.depth) || CITY_DEPTH
    }, 0, out);
    return out;
  }

  function resolveDataUrl(from) {
    var sourceId = String(from || 'data').replace(/^#/, '');
    var source = doc()?.getElementById(sourceId);
    var raw = source?.getAttribute?.('babia-queryjson');
    if (!raw) { return ''; }
    if (typeof raw === 'string') {
      var match = raw.match(/url\s*:\s*([^;]+)/);
      return match ? match[1].trim() : raw.trim();
    }
    return raw.url || '';
  }

  function withCacheBust(url) {
    var clean = String(url || '');
    if (!clean) { return clean; }
    return clean + (clean.indexOf('?') === -1 ? '?' : '&') + 't=' + Date.now();
  }

  function metricScale(records, field, min, max) {
    if (typeof common().resolveMetricScale === 'function') {
      return common().resolveMetricScale(records, field, { min: min, max: max });
    }
    var values = records.map(function (record) { return numeric(record && record[field], 0); });
    var low = Number.isFinite(min) ? min : Math.min.apply(Math, values.concat([0]));
    var high = Number.isFinite(max) ? max : Math.max.apply(Math, values.concat([1]));
    if (high <= low) { high = low + 1; }
    return {
      normalize: function (value) {
        return Math.max(0, Math.min(1, (numeric(value, low) - low) / (high - low)));
      }
    };
  }

  function colorForValue(value, records, field) {
    var numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      var scale = metricScale(records, field);
      var ratio = scale.normalize(numericValue);
      if (typeof common().colorFromGradient === 'function') {
        return common().colorFromGradient(ratio, [34, 211, 238], [249, 115, 22]);
      }
    }
    if (typeof common().hashColor === 'function') {
      return common().hashColor(value, DEFAULT_PALETTE);
    }
    return DEFAULT_PALETTE[Math.abs(String(value ?? '').length) % DEFAULT_PALETTE.length];
  }

  function resolveChangeState(record) {
    var status = String(record.status || record.changeStatus || '').toLowerCase();
    if (status.includes('add') || record.added === true) { return 'added'; }
    if (status.includes('mod') || record.modified === true || record.recentlyModified === true) { return 'modified'; }
    var dateValue = record.mtime || record.modifiedAt || record.lastModified || record.gitModifiedAt;
    var timestamp = Date.parse(dateValue);
    if (Number.isFinite(timestamp)) {
      var days = (Date.now() - timestamp) / 86400000;
      if (days < 7) { return 'recent'; }
      if (days > 365) { return 'old'; }
    }
    return 'neutral';
  }

  function roofColorForState(state) {
    if (state === 'added') { return '#34d399'; }
    if (state === 'modified' || state === 'recent') { return '#fde047'; }
    if (state === 'old') { return '#94a3b8'; }
    return '#e0f2fe';
  }

  function hasNumericValues(records, field) {
    if (!field) { return false; }
    return (Array.isArray(records) ? records : []).some(function (record) {
      return Number.isFinite(Number(record && record[field]));
    });
  }

  function computeCityBounds(base, districts, buildings) {
    var bounds = {
      minX: base.x - base.width / 2,
      maxX: base.x + base.width / 2,
      minZ: base.z - base.depthSize / 2,
      maxZ: base.z + base.depthSize / 2,
      minY: base.y - base.height / 2,
      maxY: base.y + base.height / 2
    };
    (districts || []).forEach(function (district) {
      bounds.minX = Math.min(bounds.minX, district.x - district.width / 2);
      bounds.maxX = Math.max(bounds.maxX, district.x + district.width / 2);
      bounds.minZ = Math.min(bounds.minZ, district.z - district.depthSize / 2);
      bounds.maxZ = Math.max(bounds.maxZ, district.z + district.depthSize / 2);
      bounds.maxY = Math.max(bounds.maxY, district.topY || (district.baseY + DISTRICT_BASE_HEIGHT / 2));
    });
    (buildings || []).forEach(function (building) {
      var halfFootprint = Math.max(building.footprint || 0, building.plotWidth || 0) / 2;
      var halfDepth = Math.max(building.footprint || 0, building.plotDepth || 0) / 2;
      bounds.minX = Math.min(bounds.minX, building.x - halfFootprint);
      bounds.maxX = Math.max(bounds.maxX, building.x + halfFootprint);
      bounds.minZ = Math.min(bounds.minZ, building.z - halfDepth);
      bounds.maxZ = Math.max(bounds.maxZ, building.z + halfDepth);
      bounds.maxY = Math.max(bounds.maxY, building.topY || 0);
    });
    bounds.width = bounds.maxX - bounds.minX;
    bounds.depthSize = bounds.maxZ - bounds.minZ;
    bounds.height = bounds.maxY - bounds.minY;
    return bounds;
  }

  function material(color, options) {
    var opts = options || {};
    var opacity = Number.isFinite(Number(opts.opacity)) ? Number(opts.opacity) : 1;
    var transparent = opacity < 1 || opts.transparent === true;
    return 'color: ' + color
      + '; opacity: ' + opacity
      + '; transparent: ' + transparent
      + '; shader: flat'
      + (opts.side ? '; side: ' + opts.side : '')
      + (opts.depthWrite === false ? '; depthWrite: false' : '');
  }

  function removeHitboxes(parent) {
    if (!parent || !parent.querySelectorAll) { return; }
    Array.from(parent.querySelectorAll('[data-codexr-role="hitbox"]')).forEach(function (hitbox) {
      hitbox.parentNode?.removeChild?.(hitbox);
    });
  }

  function animateOrSet(element, properties, duration) {
    if (!element || !properties) { return; }
    if (typeof common().animateTransform === 'function' && duration > 0) {
      common().animateTransform(element, properties, { duration: duration, easing: 'easeOutCubic' });
      return;
    }
    Object.keys(properties).forEach(function (key) {
      element.setAttribute(key, properties[key]);
    });
  }

  function setBoxGeometry(element, width, height, depth, duration) {
    if (!element) { return; }
    var safeWidth = Math.max(0.001, Number(width) || 0.001);
    var safeHeight = Math.max(0.001, Number(height) || 0.001);
    var safeDepth = Math.max(0.001, Number(depth) || 0.001);
    if (typeof common().animateTransform === 'function' && duration > 0) {
      common().animateTransform(element, {
        'geometry.width': safeWidth,
        'geometry.height': safeHeight,
        'geometry.depth': safeDepth
      }, { duration: duration, easing: 'easeOutCubic' });
      return;
    }
    element.setAttribute('geometry',
      'primitive: box; width: ' + safeWidth
      + '; height: ' + safeHeight
      + '; depth: ' + safeDepth);
  }

  function buildCityView(records, mode, data) {
    var safeRecords = Array.isArray(records) ? records : [];
    var areaField = data?.area || 'parameters';
    var heightField = data?.height || 'lineCount';
    var colorField = data?.color || 'complexity';
    if (safeRecords.length && (!hasNumericValues(safeRecords, areaField) || !hasNumericValues(safeRecords, heightField))) {
      return {
        valid: false,
        reason: 'invalid-numeric-mapping',
        message: 'Area and Height must use numeric fields.',
        areaField: areaField,
        heightField: heightField,
        colorField: colorField
      };
    }

    var leaves = buildLeaves(safeRecords, mode);
    var layout = layoutLeaves(leaves, {
      width: CITY_WIDTH - CITY_MARGIN * 2,
      depth: CITY_DEPTH - CITY_MARGIN * 2
    });
    var areaScale = metricScale(safeRecords, areaField);
    var heightScale = metricScale(safeRecords, heightField);
    var districtByPath = new Map();
    var districts = layout.districts.map(function (district) {
      var level = district.depth || 0;
      var baseY = districtCenterY(level);
      var topY = districtTopY(level);
      var color = DISTRICT_PALETTE[Math.min(DISTRICT_PALETTE.length - 1, level)];
      var edgeColor = level === 0 ? '#67e8f9' : '#bef264';
      var model = Object.assign({}, district, {
        baseY: baseY,
        topY: topY,
        terraceTopY: topY,
        color: color,
        edgeColor: edgeColor,
        detail: {
          title: district.label,
          subtitle: district.path || '(project root)',
          primary: 'District | ' + Math.round(district.leafCount || 0) + ' items | weight ' + Math.round(district.weight || 0),
          secondary: 'Depth ' + level + ' | ' + Math.round(district.childCount || 0) + ' subdistricts | click to pin',
          accentColor: edgeColor
        }
      });
      districtByPath.set(model.path || model.label, model);
      return model;
    });

    var buildings = layout.leaves.map(function (leaf) {
      var record = leaf.record || {};
      var areaValue = numeric(safeField(record, areaField), 0);
      var heightValue = numeric(safeField(record, heightField), 0);
      var areaRatio = Math.sqrt(areaScale.normalize(areaValue));
      var heightRatio = Math.sqrt(heightScale.normalize(heightValue));
      var cellMin = Math.max(0.01, Math.min(leaf.cellWidth || 0.01, leaf.cellDepth || 0.01));
      var maxFootprint = Math.max(0.008, cellMin * 0.58);
      var minFootprint = Math.min(maxFootprint, Math.max(0.008, Math.min(MIN_BUILDING_FOOTPRINT, cellMin * 0.34)));
      var footprint = minFootprint + Math.max(0, maxFootprint - minFootprint) * (0.28 + areaRatio * 0.72);
      footprint = Math.min(maxFootprint, Math.max(0.008, footprint));
      var buildingHeight = MIN_BUILDING_HEIGHT + heightRatio * MAX_BUILDING_HEIGHT;
      var containerDistrict = districtByPath.get(leaf.containerPath || '')
        || districtByPath.get(leaf.directoryParts.join('/'))
        || null;
      var terraceTopY = containerDistrict
        ? containerDistrict.terraceTopY
        : districtTopY(Math.max(0, leaf.directoryParts.length - 1));
      var baseY = terraceTopY + DISTRICT_TOP_PADDING;
      var color = colorForValue(record[colorField] ?? leaf.label, safeRecords, colorField);
      var changeState = resolveChangeState(record);
      var roofColor = roofColorForState(changeState);
      var roofHeight = Math.max(0.018, footprint * BUILDING_ROOF_RATIO);
      var topY = baseY + buildingHeight + roofHeight;
      var plotWidth = Math.max(footprint * 1.28, Math.min(leaf.cellWidth || footprint, Math.max(0.012, (leaf.cellWidth || footprint) * 0.82)));
      var plotDepth = Math.max(footprint * 1.28, Math.min(leaf.cellDepth || footprint, Math.max(0.012, (leaf.cellDepth || footprint) * 0.82)));
      plotWidth = Math.min(Math.max(0.012, leaf.cellWidth || plotWidth), plotWidth);
      plotDepth = Math.min(Math.max(0.012, leaf.cellDepth || plotDepth), plotDepth);
      return Object.assign({}, leaf, {
        areaField: areaField,
        heightField: heightField,
        colorField: colorField,
        areaValue: areaValue,
        heightValue: heightValue,
        footprint: footprint,
        plotWidth: plotWidth,
        plotDepth: plotDepth,
        roofHeight: roofHeight,
        buildingHeight: buildingHeight,
        baseY: baseY,
        terraceTopY: terraceTopY,
        color: color,
        changeState: changeState,
        roofColor: roofColor,
        topY: topY,
        detail: {
          title: leaf.label,
          subtitle: leaf.path,
          primary: areaField + ' ' + areaValue + ' | ' + heightField + ' ' + heightValue,
          secondary: colorField + ' ' + String(record[colorField] ?? '') + ' | '
            + (record.language || record.type || mode) + ' | ' + changeState,
          accentColor: roofColor
        }
      });
    });
    var base = {
      x: 0,
      z: 0,
      y: -CITY_BASE_HEIGHT / 2,
      width: CITY_WIDTH + CITY_BASE_PADDING * 2,
      depthSize: CITY_DEPTH + CITY_BASE_PADDING * 2,
      height: CITY_BASE_HEIGHT
    };
    var bounds = computeCityBounds(base, districts, buildings);
    districts.forEach(function (district) {
      district.tooltipY = Math.max(bounds.maxY + 0.72, district.topY + 0.72);
    });

    return {
      valid: true,
      records: safeRecords,
      base: base,
      districts: districts,
      buildings: buildings,
      bounds: bounds,
      maxY: bounds.maxY,
      titleY: Math.max(1.42, bounds.maxY + 0.58),
      tooltipY: Math.max(1.3, bounds.maxY + 0.72),
      areaField: areaField,
      heightField: heightField,
      colorField: colorField
    };
  }

  function registerComponent() {
    if (!root.AFRAME?.registerComponent || root.AFRAME.components[COMPONENT]) { return; }
    root.AFRAME.registerComponent(COMPONENT, {
      schema: {
        from: { default: 'data' },
        title: { default: 'CodeXR Code City' },
        palette: { default: 'ubuntu' },
        area: { default: 'parameters' },
        height: { default: 'lineCount' },
        color: { default: 'complexity' },
        animationDuration: { default: 520 }
      },
      init: function () {
        this.records = [];
        this.mode = 'directory';
        this.tooltip = null;
        this.pinned = null;
        this.sourceEntity = null;
        this.sourceListener = this.refreshData.bind(this);
        this.generation = 0;
        this.cityRoot = null;
        this.cityBase = null;
        this.titleEntity = null;
        this.emptyNotice = null;
        this.visuals = {
          districts: new Map(),
          buildings: new Map()
        };
        this.currentView = null;
        this.geometryState = 'rebuilding';
        this.stabilizeTimer = null;
        this.el.setAttribute('data-codexr-code-city-root', 'true');
        this.el.setAttribute('data-codexr-normal-visualization', 'true');
        this.el.setAttribute('data-codexr-geometry-state', this.geometryState);
        this.el.classList?.add(RAYCAST_CLASS);
        this.ensureTooltip();
        this.bindSource();
        this.refreshData();
      },
      update: function (oldData) {
        if (!oldData) { return; }
        if (oldData.from !== this.data.from) {
          this.bindSource();
          this.refreshData();
          return;
        }
        if (oldData.area !== this.data.area || oldData.height !== this.data.height || oldData.color !== this.data.color) {
          this.renderCity({ reason: 'mapping-update', preserveOnInvalid: true });
        }
      },
      remove: function () {
        this.unbindSource();
        this.clearCity();
        if (this.stabilizeTimer) {
          clearTimeout(this.stabilizeTimer);
          this.stabilizeTimer = null;
        }
      },
      tick: function () {
        this.tooltip?.faceCamera?.(this.el.sceneEl?.camera);
      },
      bindSource: function () {
        this.unbindSource();
        var sourceId = String(this.data.from || 'data').replace(/^#/, '');
        this.sourceEntity = doc()?.getElementById(sourceId) || null;
        this.sourceEntity?.addEventListener?.('data-loaded', this.sourceListener);
      },
      unbindSource: function () {
        this.sourceEntity?.removeEventListener?.('data-loaded', this.sourceListener);
        this.sourceEntity = null;
      },
      ensureTooltip: function () {
        if (this.tooltip?.root?.parentNode) { return this.tooltip; }
        if (typeof common().createTooltip !== 'function') { return null; }
        this.tooltip = common().createTooltip({ accentColor: '#22d3ee' });
        this.tooltip.root.setAttribute('data-codexr-code-city-tooltip', 'true');
        (this.el.sceneEl || this.el).appendChild(this.tooltip.root);
        return this.tooltip;
      },
      refreshData: function () {
        var self = this;
        var url = resolveDataUrl(this.data.from);
        var generation = ++this.generation;
        if (!url || typeof root.fetch !== 'function') {
          this.setData([]);
          return Promise.resolve([]);
        }
        return root.fetch(withCacheBust(url))
          .then(function (response) { return response.ok ? response.json() : []; })
          .then(function (payload) {
            if (generation !== self.generation) { return []; }
            self.setData(Array.isArray(payload) ? payload : []);
            return self.records;
          })
          .catch(function (error) {
            console.warn('[CodeXR.CodeCity] Unable to refresh data:', error);
            if (generation === self.generation) { self.setData([]); }
            return [];
          });
      },
      setData: function (records) {
        this.records = Array.isArray(records) ? records.slice() : [];
        this.mode = inferMode(this.records);
        this.renderCity({ reason: 'data-update', preserveOnInvalid: false });
      },
      clearCity: function () {
        this.pinned = null;
        if (this.stabilizeTimer) {
          clearTimeout(this.stabilizeTimer);
          this.stabilizeTimer = null;
        }
        while (this.el.firstChild) {
          this.el.removeChild(this.el.firstChild);
        }
        this.tooltip?.root?.parentNode?.removeChild?.(this.tooltip.root);
        this.tooltip = null;
        this.cityRoot = null;
        this.cityBase = null;
        this.titleEntity = null;
        this.emptyNotice = null;
        this.visuals = {
          districts: new Map(),
          buildings: new Map()
        };
        this.currentView = null;
      },
      ensureCityRoot: function () {
        if (this.cityRoot?.parentNode === this.el) { return this.cityRoot; }
        this.ensureTooltip();
        this.cityRoot = entity('a-entity', {
          'data-codexr-code-city-content': 'true'
        });
        this.el.appendChild(this.cityRoot);
        return this.cityRoot;
      },
      setGeometryState: function (state, details) {
        this.geometryState = state;
        this.el.setAttribute('data-codexr-geometry-state', state);
        this.el.emit?.(GEOMETRY_EVENT, {
          component: COMPONENT,
          state: state,
          details: details || null
        }, false);
      },
      scheduleStabilized: function () {
        var self = this;
        if (this.stabilizeTimer) {
          clearTimeout(this.stabilizeTimer);
        }
        this.stabilizeTimer = setTimeout(function () {
          self.stabilizeTimer = null;
          if (self.geometryState !== 'invalid') {
            self.setGeometryState('stabilized');
          }
        }, Math.max(120, Number(this.data.animationDuration || 520) + 90));
      },
      renderCity: function (options) {
        var opts = options || {};
        var records = this.records || [];
        var view = buildCityView(records, this.mode, this.data);
        if (!view.valid) {
          this.setGeometryState('invalid', view);
          console.warn('[CodeXR.CodeCity] Invalid mapping, keeping last valid city:', view);
          if (!opts.preserveOnInvalid || !this.currentView) {
            this.ensureCityRoot();
            this.renderEmptyNotice(view.message || 'Invalid CodeXR city mapping', '#fca5a5');
          }
          return false;
        }
        this.ensureCityRoot();
        this.setGeometryState('rebuilding', { reason: opts.reason || 'render' });
        if (!records.length) {
          this.updateCityBase(view);
          this.reconcileDistricts([]);
          this.reconcileBuildings([]);
          this.renderEmptyNotice('No CodeXR city data available', '#fca5a5');
          this.updateTitle({ titleY: 1.1, maxY: 0.75 });
          this.currentView = view;
          this.setGeometryState('valid');
          this.scheduleStabilized();
          return true;
        }
        this.removeEmptyNotice();
        this.updateCityBase(view);
        this.reconcileDistricts(view.districts);
        this.reconcileBuildings(view.buildings);
        this.updateTitle(view);
        this.currentView = view;
        this.updatePinnedTooltip(view);
        this.setGeometryState('valid');
        this.scheduleStabilized();
        return true;
      },
      updateCityBase: function (view) {
        var model = view?.base || {
          x: 0,
          z: 0,
          y: -CITY_BASE_HEIGHT / 2,
          width: CITY_WIDTH + CITY_BASE_PADDING * 2,
          depthSize: CITY_DEPTH + CITY_BASE_PADDING * 2,
          height: CITY_BASE_HEIGHT
        };
        if (!this.cityBase?.group?.parentNode) {
          var group = entity('a-entity', { 'data-codexr-role': 'code-city-base' });
          var slab = entity('a-box', {});
          var glow = entity('a-box', {});
          var rails = [entity('a-box', {}), entity('a-box', {}), entity('a-box', {}), entity('a-box', {})];
          group.appendChild(slab);
          group.appendChild(glow);
          rails.forEach(function (rail) { group.appendChild(rail); });
          this.cityRoot?.appendChild?.(group);
          this.cityBase = { group: group, slab: slab, glow: glow, rails: rails };
        }
        var base = this.cityBase;
        base.group.setAttribute('position', model.x + ' ' + model.y + ' ' + model.z);
        base.slab.setAttribute('geometry',
          'primitive: box; width: ' + model.width
          + '; height: ' + model.height
          + '; depth: ' + model.depthSize);
        base.slab.setAttribute('material', material('#08111f', { opacity: 1 }));
        base.glow.setAttribute('geometry',
          'primitive: box; width: ' + (model.width + 0.025)
          + '; height: 0.01'
          + '; depth: ' + (model.depthSize + 0.025));
        base.glow.setAttribute('position', '0 ' + (model.height / 2 + 0.008) + ' 0');
        base.glow.setAttribute('material', material('#67e8f9', { opacity: 0.16, transparent: true, depthWrite: false }));
        var railHeight = 0.026;
        var railThickness = 0.028;
        var railY = model.height / 2 + railHeight / 2 + 0.01;
        base.rails[0].setAttribute('geometry', 'primitive: box; width: ' + model.width + '; height: ' + railHeight + '; depth: ' + railThickness);
        base.rails[0].setAttribute('position', '0 ' + railY + ' ' + (-model.depthSize / 2));
        base.rails[1].setAttribute('geometry', 'primitive: box; width: ' + model.width + '; height: ' + railHeight + '; depth: ' + railThickness);
        base.rails[1].setAttribute('position', '0 ' + railY + ' ' + (model.depthSize / 2));
        base.rails[2].setAttribute('geometry', 'primitive: box; width: ' + railThickness + '; height: ' + railHeight + '; depth: ' + model.depthSize);
        base.rails[2].setAttribute('position', (-model.width / 2) + ' ' + railY + ' 0');
        base.rails[3].setAttribute('geometry', 'primitive: box; width: ' + railThickness + '; height: ' + railHeight + '; depth: ' + model.depthSize);
        base.rails[3].setAttribute('position', (model.width / 2) + ' ' + railY + ' 0');
        base.rails.forEach(function (rail) {
          rail.setAttribute('material', material('#facc15', { opacity: 0.92, transparent: true }));
        });
      },
      renderEmptyNotice: function (message, color) {
        this.removeEmptyNotice();
        this.emptyNotice = text(message, '0 0.82 0', 4.5, color || '#fca5a5');
        this.emptyNotice.setAttribute('scale', '0.32 0.32 0.32');
        this.cityRoot?.appendChild?.(this.emptyNotice);
      },
      removeEmptyNotice: function () {
        if (this.emptyNotice?.parentNode) {
          this.emptyNotice.parentNode.removeChild(this.emptyNotice);
        }
        this.emptyNotice = null;
      },
      updateTitle: function (view) {
        var titleValue = this.data.title || 'CodeXR Code City';
        if (!this.titleEntity?.parentNode) {
          this.titleEntity = entity('a-entity', {
            'data-codexr-role': 'code-city-title'
          });
          var back = entity('a-plane', {
            width: 4.2,
            height: 0.34,
            material: material('#0f172a', { opacity: 0.9, transparent: true, side: 'double' })
          });
          var label = text(titleValue, '0 0 .018', 4, '#bae6fd');
          label.setAttribute('scale', '0.42 0.42 0.42');
          this.titleEntity.appendChild(back);
          this.titleEntity.appendChild(label);
          this.titleEntity.__codexrLabel = label;
          this.cityRoot?.appendChild?.(this.titleEntity);
        }
        this.titleEntity.__codexrLabel?.setAttribute?.('value', titleValue);
        animateOrSet(this.titleEntity, {
          position: '0 ' + Number(view.titleY || 1.2).toFixed(3) + ' ' + (-CITY_DEPTH / 2 - 0.24).toFixed(3)
        }, Number(this.data.animationDuration || 520));
      },
      updatePinnedTooltip: function (view) {
        if (!this.pinned || !view) { return; }
        var building = view.buildings.find(function (item) { return item.id === this.pinned.id; }, this);
        if (building) {
          this.pinned.detail = building.detail;
          this.pinned.anchor = { x: building.x, y: Math.max(view.tooltipY, building.topY + 0.72), z: building.z };
          this.showTooltip(building.detail, this.pinned.anchor, building.id);
          return;
        }
        var district = view.districts.find(function (item) { return item.id === this.pinned.id; }, this);
        if (district) {
          this.pinned.detail = district.detail;
          this.pinned.anchor = { x: district.x, y: Math.max(view.tooltipY, district.baseY + 0.42), z: district.z };
          this.showTooltip(district.detail, this.pinned.anchor, district.id);
          return;
        }
        this.pinned = null;
        this.tooltip?.hide?.();
      },
      showTooltip: function (detail, anchor, pinnedId) {
        var tooltip = this.ensureTooltip();
        if (!tooltip || !root.THREE) { return; }
        var position = new root.THREE.Vector3(anchor.x, anchor.y, anchor.z);
        if (tooltip.root?.parentNode !== this.el && this.el.object3D?.localToWorld) {
          this.el.object3D.localToWorld(position);
        }
        tooltip.show(detail, position);
        this.pinned = pinnedId ? { id: pinnedId, detail: detail, anchor: position } : this.pinned;
      },
      hideTooltip: function (id) {
        if (this.pinned && this.pinned.id !== id) { return; }
        if (!this.pinned) { this.tooltip?.hide?.(); }
      },
      togglePin: function (id, detail, anchor) {
        if (this.pinned && this.pinned.id === id) {
          this.pinned = null;
          this.tooltip?.hide?.();
          return;
        }
        this.pinned = { id: id, detail: detail, anchor: anchor };
        this.showTooltip(detail, anchor, id);
      },
      createDistrictEntry: function (district) {
        var group = entity('a-entity', {
          'data-codexr-code-city-district': district.id
        });
        var platform = entity('a-box', { 'data-codexr-role': 'district-platform' });
        var surface = entity('a-box', { 'data-codexr-role': 'district-surface' });
        var north = entity('a-box', {});
        var south = entity('a-box', {});
        var west = entity('a-box', {});
        var east = entity('a-box', {});
        var label = text('', '0 0 0', 2.2, '#cffafe');
        label.setAttribute('scale', '0.18 0.18 0.18');
        group.appendChild(platform);
        group.appendChild(surface);
        group.appendChild(north);
        group.appendChild(south);
        group.appendChild(west);
        group.appendChild(east);
        group.appendChild(label);
        this.cityRoot.appendChild(group);
        return {
          group: group,
          platform: platform,
          surface: surface,
          rails: [north, south, west, east],
          label: label
        };
      },
      updateDistrictEntry: function (entry, district, isNew) {
        var duration = isNew ? 0 : Number(this.data.animationDuration || 520);
        var railColor = district.edgeColor;
        var topTint = district.depth === 0 ? '#123b4a' : district.color;
        var sideTint = mixColor(topTint, '#020617', 0.55);
        animateOrSet(entry.group, {
          position: district.x + ' ' + district.baseY + ' ' + district.z,
          scale: '1 1 1'
        }, duration);
        setBoxGeometry(entry.platform, Math.max(0.01, district.width), DISTRICT_BASE_HEIGHT, Math.max(0.01, district.depthSize), duration);
        entry.platform.setAttribute('material', material(sideTint, { opacity: 1 }));
        setBoxGeometry(entry.surface, Math.max(0.01, district.width - 0.035), 0.01, Math.max(0.01, district.depthSize - 0.035), duration);
        entry.surface.setAttribute('position', '0 ' + (DISTRICT_BASE_HEIGHT / 2 + 0.007) + ' 0');
        entry.surface.setAttribute('material', material(topTint, { opacity: 1 }));
        var railHeight = 0.032;
        var railThickness = 0.018;
        setBoxGeometry(entry.rails[0], district.width, railHeight, railThickness, duration);
        entry.rails[0].setAttribute('position', '0 ' + (DISTRICT_BASE_HEIGHT / 2 + railHeight / 2) + ' ' + (-district.depthSize / 2));
        setBoxGeometry(entry.rails[1], district.width, railHeight, railThickness, duration);
        entry.rails[1].setAttribute('position', '0 ' + (DISTRICT_BASE_HEIGHT / 2 + railHeight / 2) + ' ' + (district.depthSize / 2));
        setBoxGeometry(entry.rails[2], railThickness, railHeight, district.depthSize, duration);
        entry.rails[2].setAttribute('position', (-district.width / 2) + ' ' + (DISTRICT_BASE_HEIGHT / 2 + railHeight / 2) + ' 0');
        setBoxGeometry(entry.rails[3], railThickness, railHeight, district.depthSize, duration);
        entry.rails[3].setAttribute('position', (district.width / 2) + ' ' + (DISTRICT_BASE_HEIGHT / 2 + railHeight / 2) + ' 0');
        entry.rails.forEach(function (rail) {
          rail.setAttribute('material', material(railColor, { opacity: 1 }));
        });
        entry.label.setAttribute('value', district.width > 0.42 && district.depthSize > 0.26 ? compact(district.label, 20) : '');
        entry.label.setAttribute('position', '0 ' + (DISTRICT_BASE_HEIGHT + 0.035) + ' ' + (-district.depthSize / 2 + 0.075));
        removeHitboxes(entry.group);
        var self = this;
        function anchor() {
          return { x: district.x, y: district.tooltipY || Math.max(self.currentView?.tooltipY || 0.9, district.baseY + 0.42), z: district.z };
        }
        function enter() { self.showTooltip(district.detail, anchor(), null); }
        function leave() { if (!self.pinned) { self.tooltip?.hide?.(); } }
        function click() { self.togglePin(district.id, district.detail, anchor()); }
        root.CodeXRGraphCommonRuntime?.attachPickHitbox?.(entry.group, {
          shape: 'district',
          radius: 0.018,
          width: Math.max(0.04, district.width),
          height: 0.22,
          depth: Math.max(0.04, district.depthSize),
          position: '0 ' + (DISTRICT_BASE_HEIGHT + 0.08) + ' 0',
          className: RAYCAST_CLASS,
          handlers: { enter: enter, leave: leave, click: click }
        });
      },
      reconcileDistricts: function (districts) {
        var self = this;
        var nextIds = new Set();
        districts.sort(function (a, b) { return a.depth - b.depth; }).forEach(function (district) {
          nextIds.add(district.id);
          var entry = self.visuals.districts.get(district.id);
          var isNew = !entry;
          if (!entry) {
            entry = self.createDistrictEntry(district);
            self.visuals.districts.set(district.id, entry);
            entry.group.setAttribute('scale', '0.01 0.01 0.01');
          }
          self.updateDistrictEntry(entry, district, isNew);
          if (isNew) {
            animateOrSet(entry.group, { scale: '1 1 1' }, Number(self.data.animationDuration || 520));
          }
        });
        Array.from(this.visuals.districts.entries()).forEach(function (entryPair) {
          var id = entryPair[0];
          var entry = entryPair[1];
          if (nextIds.has(id)) { return; }
          self.visuals.districts.delete(id);
          animateOrSet(entry.group, { scale: '0.01 0.01 0.01' }, Number(self.data.animationDuration || 520));
          setTimeout(function () {
            entry.group.parentNode?.removeChild?.(entry.group);
          }, Number(self.data.animationDuration || 520) + 40);
        });
      },
      createBuildingEntry: function (leaf) {
        var building = entity('a-entity', {
          'data-codexr-code-city-node': leaf.id,
          class: RAYCAST_CLASS
        });
        var plot = entity('a-box', { 'data-codexr-role': 'building-plot' });
        var plotAccent = entity('a-box', { 'data-codexr-role': 'building-plot-accent' });
        var baseTrim = entity('a-box', { 'data-codexr-role': 'building-base-trim' });
        var body = entity('a-box', {});
        var roof = entity('a-box', {});
        var frontWindows = entity('a-box', {});
        var sideWindows = entity('a-box', {});
        var frontBand = entity('a-box', { 'data-codexr-role': 'building-front-band' });
        var sideBand = entity('a-box', { 'data-codexr-role': 'building-side-band' });
        var ageMark = entity('a-box', { 'data-codexr-role': 'building-age-mark' });
        building.appendChild(plot);
        building.appendChild(plotAccent);
        building.appendChild(baseTrim);
        building.appendChild(body);
        building.appendChild(roof);
        building.appendChild(frontWindows);
        building.appendChild(sideWindows);
        building.appendChild(frontBand);
        building.appendChild(sideBand);
        building.appendChild(ageMark);
        this.cityRoot.appendChild(building);
        return {
          group: building,
          plot: plot,
          plotAccent: plotAccent,
          baseTrim: baseTrim,
          body: body,
          roof: roof,
          frontWindows: frontWindows,
          sideWindows: sideWindows,
          frontBand: frontBand,
          sideBand: sideBand,
          ageMark: ageMark
        };
      },
      updateBuildingEntry: function (entry, leaf, isNew) {
        var duration = isNew ? 0 : Number(this.data.animationDuration || 520);
        var footprint = leaf.footprint;
        var buildingHeight = leaf.buildingHeight;
        var roofHeight = leaf.roofHeight || Math.max(0.018, footprint * BUILDING_ROOF_RATIO);
        var plotWidth = Math.max(footprint * 1.2, Math.min(leaf.cellWidth || footprint, leaf.plotWidth || footprint * 1.5));
        var plotDepth = Math.max(footprint * 1.2, Math.min(leaf.cellDepth || footprint, leaf.plotDepth || footprint * 1.5));
        animateOrSet(entry.group, {
          position: leaf.x + ' ' + leaf.baseY + ' ' + leaf.z,
          scale: '1 1 1'
        }, duration);
        setBoxGeometry(entry.plot, plotWidth, 0.018, plotDepth, duration);
        entry.plot.setAttribute('position', '0 -0.006 0');
        entry.plot.setAttribute('material', material('#0b1220', { opacity: 1 }));
        setBoxGeometry(entry.plotAccent, Math.max(0.008, plotWidth * 0.72), 0.012, Math.max(0.006, Math.min(0.018, plotDepth * 0.16)), duration);
        entry.plotAccent.setAttribute('position', '0 0.009 ' + (-plotDepth / 2 + Math.max(0.006, Math.min(0.018, plotDepth * 0.16)) / 2));
        entry.plotAccent.setAttribute('material', material(leaf.roofColor, { opacity: 1 }));
        setBoxGeometry(entry.baseTrim, footprint * 1.18, Math.max(0.018, footprint * 0.18), footprint * 1.18, duration);
        entry.baseTrim.setAttribute('position', '0 ' + Math.max(0.011, footprint * 0.09) + ' 0');
        entry.baseTrim.setAttribute('material', material(mixColor(leaf.color, '#020617', 0.44), { opacity: 1 }));
        setBoxGeometry(entry.body, footprint, buildingHeight, footprint, duration);
        entry.body.setAttribute('position', '0 ' + (buildingHeight / 2) + ' 0');
        entry.body.setAttribute('material', material(mixColor(leaf.color, '#ffffff', 0.07), { opacity: 1 }));
        setBoxGeometry(entry.roof, footprint * 1.12, roofHeight, footprint * 1.12, duration);
        entry.roof.setAttribute('position', '0 ' + (buildingHeight + roofHeight / 2) + ' 0');
        entry.roof.setAttribute('material', material(leaf.roofColor, { opacity: 1 }));
        var showFacade = buildingHeight > 0.22 && footprint > 0.026;
        var facadeColor = mixColor(leaf.color, '#dbeafe', 0.56);
        var shadowColor = mixColor(leaf.color, '#020617', 0.32);
        setBoxGeometry(entry.frontWindows, footprint * 0.58, Math.min(0.18, buildingHeight * 0.46), 0.006, duration);
        entry.frontWindows.setAttribute('position', '0 ' + Math.max(0.08, buildingHeight * 0.55) + ' ' + (-footprint / 2 - 0.004));
        entry.frontWindows.setAttribute('material', material(facadeColor, { opacity: 1 }));
        entry.frontWindows.setAttribute('visible', showFacade);
        setBoxGeometry(entry.sideWindows, 0.006, Math.min(0.16, buildingHeight * 0.42), footprint * 0.58, duration);
        entry.sideWindows.setAttribute('position', (footprint / 2 + 0.004) + ' ' + Math.max(0.08, buildingHeight * 0.55) + ' 0');
        entry.sideWindows.setAttribute('material', material(facadeColor, { opacity: 1 }));
        entry.sideWindows.setAttribute('visible', showFacade);
        setBoxGeometry(entry.frontBand, footprint * 0.82, Math.max(0.01, Math.min(0.028, buildingHeight * 0.08)), 0.007, duration);
        entry.frontBand.setAttribute('position', '0 ' + Math.max(0.055, buildingHeight * 0.27) + ' ' + (-footprint / 2 - 0.006));
        entry.frontBand.setAttribute('material', material(shadowColor, { opacity: 1 }));
        entry.frontBand.setAttribute('visible', showFacade);
        setBoxGeometry(entry.sideBand, 0.007, Math.max(0.01, Math.min(0.028, buildingHeight * 0.08)), footprint * 0.82, duration);
        entry.sideBand.setAttribute('position', (footprint / 2 + 0.006) + ' ' + Math.max(0.055, buildingHeight * 0.31) + ' 0');
        entry.sideBand.setAttribute('material', material(shadowColor, { opacity: 1 }));
        entry.sideBand.setAttribute('visible', showFacade);
        setBoxGeometry(entry.ageMark, Math.max(0.006, footprint * 0.2), Math.max(0.02, buildingHeight * 0.18), 0.008, duration);
        entry.ageMark.setAttribute('position', (-footprint / 2 - 0.005) + ' ' + Math.max(0.08, buildingHeight * 0.7) + ' 0');
        entry.ageMark.setAttribute('material', material(leaf.roofColor, { opacity: 1 }));
        entry.ageMark.setAttribute('visible', leaf.changeState !== 'neutral' && showFacade);
        removeHitboxes(entry.group);
        var self = this;
        function anchor() {
          return { x: leaf.x, y: Math.max(self.currentView?.tooltipY || 1.55, leaf.topY + 0.72), z: leaf.z };
        }
        function enter() {
          entry.body.setAttribute('material', material('#fef08a', { opacity: 1 }));
          entry.plotAccent.setAttribute('material', material('#facc15', { opacity: 1 }));
          self.showTooltip(leaf.detail, anchor(), null);
        }
        function leave() {
          if (!self.pinned || self.pinned.id !== leaf.id) {
            entry.body.setAttribute('material', material(mixColor(leaf.color, '#ffffff', 0.07), { opacity: 1 }));
            entry.plotAccent.setAttribute('material', material(leaf.roofColor, { opacity: 1 }));
          }
          if (!self.pinned) { self.tooltip?.hide?.(); }
        }
        function click() {
          self.togglePin(leaf.id, leaf.detail, anchor());
        }
        root.CodeXRGraphCommonRuntime?.attachPickHitbox?.(entry.group, {
          shape: 'box',
          radius: 0.018,
          width: footprint * 1.55,
          height: buildingHeight + 0.26,
          depth: footprint * 1.55,
          position: '0 ' + (buildingHeight / 2) + ' 0',
          className: RAYCAST_CLASS,
          handlers: { enter: enter, leave: leave, click: click }
        });
      },
      reconcileBuildings: function (leaves) {
        var self = this;
        var nextIds = new Set();
        leaves.forEach(function (leaf) {
          nextIds.add(leaf.id);
          var entry = self.visuals.buildings.get(leaf.id);
          var isNew = !entry;
          if (!entry) {
            entry = self.createBuildingEntry(leaf);
            self.visuals.buildings.set(leaf.id, entry);
            entry.group.setAttribute('scale', '0.01 0.01 0.01');
          }
          self.updateBuildingEntry(entry, leaf, isNew);
          if (isNew) {
            animateOrSet(entry.group, { scale: '1 1 1' }, Number(self.data.animationDuration || 520));
          }
        });
        Array.from(this.visuals.buildings.entries()).forEach(function (entryPair) {
          var id = entryPair[0];
          var entry = entryPair[1];
          if (nextIds.has(id)) { return; }
          self.visuals.buildings.delete(id);
          animateOrSet(entry.group, { scale: '0.01 0.01 0.01' }, Number(self.data.animationDuration || 520));
          setTimeout(function () {
            entry.group.parentNode?.removeChild?.(entry.group);
          }, Number(self.data.animationDuration || 520) + 40);
        });
      },
      getDebugSnapshot: function () {
        return {
          component: COMPONENT,
          mode: this.mode,
          records: this.records.length,
          area: this.data.area,
          height: this.data.height,
          color: this.data.color,
          districts: this.cityRoot?.querySelectorAll?.('[data-codexr-code-city-district]')?.length || 0
        };
      }
    });
  }

  registerComponent();
  root.CodeXRCodeCityRuntime = {
    componentName: COMPONENT,
    refreshAll: function () {
      doc()?.querySelectorAll?.('[' + COMPONENT + ']').forEach(function (element) {
        element.components?.[COMPONENT]?.refreshData?.();
      });
    },
    __testing: {
      inferMode: inferMode,
      pathPartsForRecord: pathPartsForRecord,
      buildLeaves: buildLeaves,
      buildDistrictTree: buildDistrictTree,
      layoutLeaves: layoutLeaves,
      buildCityView: buildCityView,
      computeCityBounds: computeCityBounds,
      districtTopY: districtTopY,
      colorForValue: colorForValue,
      resolveChangeState: resolveChangeState,
      withCacheBust: withCacheBust
    }
  };
})(typeof window !== 'undefined' ? window : this);
