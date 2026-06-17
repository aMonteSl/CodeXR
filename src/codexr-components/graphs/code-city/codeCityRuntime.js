(function registerCodeXRCodeCityRuntime(root) {
  'use strict';

  var COMPONENT = 'codexr-code-city';
  var RAYCAST_CLASS = 'babiaxraycasterclass';
  var CITY_WIDTH = 5.25;
  var CITY_DEPTH = 3.05;
  var CITY_MARGIN = 0.06;
  var DISTRICT_GAP = 0.055;
  var DISTRICT_INSET = 0.08;
  var DISTRICT_BASE_HEIGHT = 0.048;
  var DISTRICT_LEVEL_Y = 0.042;
  var MIN_BUILDING_FOOTPRINT = 0.052;
  var MIN_BUILDING_HEIGHT = 0.12;
  var MAX_BUILDING_HEIGHT = 1.18;
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
      node.weight = Math.max(1, leafWeight + childWeight);
      return node.weight;
    }
    compute(rootNode);
    return rootNode;
  }

  function layoutItems(items, rect, depth, out) {
    if (!items.length) { return; }
    var totalWeight = items.reduce(function (sum, item) { return sum + Math.max(1, item.weight || 1); }, 0);
    var horizontal = rect.width >= rect.depthSize;
    var cursor = horizontal ? rect.x - rect.width / 2 : rect.z - rect.depthSize / 2;
    items.forEach(function (item, index) {
      var ratio = Math.max(1, item.weight || 1) / totalWeight;
      var available = horizontal ? rect.width : rect.depthSize;
      var size = Math.max(0.16, available * ratio - (items.length > 1 ? DISTRICT_GAP : 0));
      var center = cursor + size / 2;
      var childRect = horizontal
        ? { x: center, z: rect.z, width: size, depthSize: rect.depthSize }
        : { x: rect.x, z: center, width: rect.width, depthSize: size };
      if (item.type === 'leaf') {
        item.leaf.x = childRect.x;
        item.leaf.z = childRect.z;
        item.leaf.cellWidth = Math.max(0.14, childRect.width);
        item.leaf.cellDepth = Math.max(0.14, childRect.depthSize);
        out.leaves.push(item.leaf);
      } else {
        out.districts.push({
          id: 'district:' + (item.node.path || item.node.label),
          label: item.node.label,
          path: item.node.path,
          depth: depth,
          x: childRect.x,
          z: childRect.z,
          width: Math.max(0.18, childRect.width),
          depthSize: Math.max(0.18, childRect.depthSize),
          weight: item.node.weight
        });
        var inner = {
          x: childRect.x,
          z: childRect.z,
          width: Math.max(0.12, childRect.width - DISTRICT_INSET * 2),
          depthSize: Math.max(0.12, childRect.depthSize - DISTRICT_INSET * 2)
        };
        layoutNode(item.node, inner, depth + 1, out);
      }
      cursor += size + (index < items.length - 1 ? DISTRICT_GAP : 0);
    });
  }

  function layoutNode(node, rect, depth, out) {
    var childItems = Array.from(node.children.values()).map(function (child) {
      return { type: 'district', node: child, weight: child.weight };
    });
    var leafItems = node.leaves.map(function (leaf) {
      return { type: 'leaf', leaf: leaf, weight: leaf.weight };
    });
    layoutItems(childItems.concat(leafItems), rect, depth, out);
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
    var maxY = 0.48;
    var districts = layout.districts.map(function (district) {
      var level = district.depth || 0;
      var baseY = DISTRICT_BASE_HEIGHT / 2 + level * DISTRICT_LEVEL_Y;
      var color = DISTRICT_PALETTE[Math.min(DISTRICT_PALETTE.length - 1, level)];
      var edgeColor = level === 0 ? '#67e8f9' : '#bef264';
      maxY = Math.max(maxY, baseY + DISTRICT_BASE_HEIGHT + 0.12);
      return Object.assign({}, district, {
        baseY: baseY,
        color: color,
        edgeColor: edgeColor,
        detail: {
          title: district.label,
          subtitle: district.path || '(project root)',
          primary: 'District | weight ' + Math.round(district.weight || 0),
          secondary: 'Depth ' + level + ' | click to pin',
          accentColor: edgeColor
        }
      });
    });

    var buildings = layout.leaves.map(function (leaf) {
      var record = leaf.record || {};
      var areaValue = numeric(safeField(record, areaField), 0);
      var heightValue = numeric(safeField(record, heightField), 0);
      var areaRatio = Math.sqrt(areaScale.normalize(areaValue));
      var heightRatio = Math.sqrt(heightScale.normalize(heightValue));
      var cellMin = Math.max(0.075, Math.min(leaf.cellWidth || 0.16, leaf.cellDepth || 0.16));
      var maxFootprint = Math.max(MIN_BUILDING_FOOTPRINT, cellMin * 0.58);
      var footprint = Math.max(MIN_BUILDING_FOOTPRINT, maxFootprint * (0.42 + areaRatio * 0.58));
      var buildingHeight = MIN_BUILDING_HEIGHT + heightRatio * MAX_BUILDING_HEIGHT;
      var baseY = 0.09 + Math.max(0, leaf.directoryParts.length - 1) * DISTRICT_LEVEL_Y;
      var color = colorForValue(record[colorField] ?? leaf.label, safeRecords, colorField);
      var changeState = resolveChangeState(record);
      var roofColor = roofColorForState(changeState);
      var topY = baseY + buildingHeight + Math.max(0.026, footprint * 0.18);
      maxY = Math.max(maxY, topY + 0.18);
      return Object.assign({}, leaf, {
        areaField: areaField,
        heightField: heightField,
        colorField: colorField,
        areaValue: areaValue,
        heightValue: heightValue,
        footprint: footprint,
        buildingHeight: buildingHeight,
        baseY: baseY,
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
    districts.forEach(function (district) {
      district.tooltipY = Math.max(0.95, maxY + 0.18, district.baseY + 0.42);
    });

    return {
      valid: true,
      records: safeRecords,
      districts: districts,
      buildings: buildings,
      maxY: maxY,
      titleY: Math.max(1.05, maxY + 0.32),
      tooltipY: Math.max(0.95, maxY + 0.22),
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
        this.el.appendChild(this.tooltip.root);
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
        this.tooltip = null;
        this.cityRoot = null;
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
        this.reconcileDistricts(view.districts);
        this.reconcileBuildings(view.buildings);
        this.updateTitle(view);
        this.currentView = view;
        this.updatePinnedTooltip(view);
        this.setGeometryState('valid');
        this.scheduleStabilized();
        return true;
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
          this.pinned.anchor = { x: building.x, y: building.topY + 0.3, z: building.z };
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
        var north = entity('a-box', {});
        var south = entity('a-box', {});
        var west = entity('a-box', {});
        var east = entity('a-box', {});
        var label = text('', '0 0 0', 2.2, '#cffafe');
        label.setAttribute('scale', '0.18 0.18 0.18');
        group.appendChild(platform);
        group.appendChild(north);
        group.appendChild(south);
        group.appendChild(west);
        group.appendChild(east);
        group.appendChild(label);
        this.cityRoot.appendChild(group);
        return {
          group: group,
          platform: platform,
          rails: [north, south, west, east],
          label: label
        };
      },
      updateDistrictEntry: function (entry, district, isNew) {
        var duration = isNew ? 0 : Number(this.data.animationDuration || 520);
        var railColor = district.edgeColor;
        var topTint = district.depth === 0 ? '#123b4a' : district.color;
        animateOrSet(entry.group, {
          position: district.x + ' ' + district.baseY + ' ' + district.z,
          scale: '1 1 1'
        }, duration);
        entry.platform.setAttribute('geometry',
          'primitive: box; width: ' + Math.max(0.08, district.width)
          + '; height: ' + DISTRICT_BASE_HEIGHT
          + '; depth: ' + Math.max(0.08, district.depthSize));
        entry.platform.setAttribute('material', material(topTint, { opacity: 0.88, transparent: true }));
        var railHeight = 0.032;
        var railThickness = 0.018;
        entry.rails[0].setAttribute('geometry', 'primitive: box; width: ' + district.width + '; height: ' + railHeight + '; depth: ' + railThickness);
        entry.rails[0].setAttribute('position', '0 ' + (DISTRICT_BASE_HEIGHT / 2 + railHeight / 2) + ' ' + (-district.depthSize / 2));
        entry.rails[1].setAttribute('geometry', 'primitive: box; width: ' + district.width + '; height: ' + railHeight + '; depth: ' + railThickness);
        entry.rails[1].setAttribute('position', '0 ' + (DISTRICT_BASE_HEIGHT / 2 + railHeight / 2) + ' ' + (district.depthSize / 2));
        entry.rails[2].setAttribute('geometry', 'primitive: box; width: ' + railThickness + '; height: ' + railHeight + '; depth: ' + district.depthSize);
        entry.rails[2].setAttribute('position', (-district.width / 2) + ' ' + (DISTRICT_BASE_HEIGHT / 2 + railHeight / 2) + ' 0');
        entry.rails[3].setAttribute('geometry', 'primitive: box; width: ' + railThickness + '; height: ' + railHeight + '; depth: ' + district.depthSize);
        entry.rails[3].setAttribute('position', (district.width / 2) + ' ' + (DISTRICT_BASE_HEIGHT / 2 + railHeight / 2) + ' 0');
        entry.rails.forEach(function (rail) {
          rail.setAttribute('material', material(railColor, { opacity: 0.95, transparent: true }));
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
          width: Math.max(0.16, district.width),
          height: 0.22,
          depth: Math.max(0.16, district.depthSize),
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
        var halo = entity('a-ring', {
          rotation: '-90 0 0'
        });
        var body = entity('a-box', {});
        var roof = entity('a-box', {});
        var frontWindows = entity('a-box', {});
        var sideWindows = entity('a-box', {});
        building.appendChild(halo);
        building.appendChild(body);
        building.appendChild(roof);
        building.appendChild(frontWindows);
        building.appendChild(sideWindows);
        this.cityRoot.appendChild(building);
        return {
          group: building,
          body: body,
          roof: roof,
          halo: halo,
          frontWindows: frontWindows,
          sideWindows: sideWindows
        };
      },
      updateBuildingEntry: function (entry, leaf, isNew) {
        var duration = isNew ? 0 : Number(this.data.animationDuration || 520);
        var footprint = leaf.footprint;
        var buildingHeight = leaf.buildingHeight;
        var roofHeight = Math.max(0.026, footprint * 0.18);
        animateOrSet(entry.group, {
          position: leaf.x + ' ' + leaf.baseY + ' ' + leaf.z,
          scale: '1 1 1'
        }, duration);
        entry.body.setAttribute('geometry',
          'primitive: box; width: ' + footprint
          + '; height: ' + buildingHeight
          + '; depth: ' + footprint);
        entry.body.setAttribute('position', '0 ' + (buildingHeight / 2) + ' 0');
        entry.body.setAttribute('material', material(leaf.color, { opacity: 1 }));
        entry.roof.setAttribute('geometry',
          'primitive: box; width: ' + (footprint * 1.12)
          + '; height: ' + roofHeight
          + '; depth: ' + (footprint * 1.12));
        entry.roof.setAttribute('position', '0 ' + (buildingHeight + roofHeight / 2) + ' 0');
        entry.roof.setAttribute('material', material(leaf.roofColor, { opacity: 0.96, transparent: true }));
        entry.halo.setAttribute('geometry',
          'primitive: ring; radiusInner: ' + (footprint * 0.68)
          + '; radiusOuter: ' + (footprint * 0.86)
          + '; segmentsTheta: 24');
        entry.halo.setAttribute('position', '0 0.014 0');
        entry.halo.setAttribute('material', material(leaf.roofColor, {
          opacity: leaf.changeState === 'neutral' ? 0.2 : 0.58,
          transparent: true,
          side: 'double',
          depthWrite: false
        }));
        var windowOpacity = buildingHeight > 0.24 ? 0.42 : 0.12;
        entry.frontWindows.setAttribute('geometry',
          'primitive: box; width: ' + (footprint * 0.7)
          + '; height: ' + Math.min(0.16, buildingHeight * 0.42)
          + '; depth: 0.006');
        entry.frontWindows.setAttribute('position', '0 ' + Math.max(0.08, buildingHeight * 0.55) + ' ' + (-footprint / 2 - 0.004));
        entry.frontWindows.setAttribute('material', material('#dbeafe', { opacity: windowOpacity, transparent: true }));
        entry.sideWindows.setAttribute('geometry',
          'primitive: box; width: 0.006'
          + '; height: ' + Math.min(0.16, buildingHeight * 0.42)
          + '; depth: ' + (footprint * 0.7));
        entry.sideWindows.setAttribute('position', (footprint / 2 + 0.004) + ' ' + Math.max(0.08, buildingHeight * 0.55) + ' 0');
        entry.sideWindows.setAttribute('material', material('#dbeafe', { opacity: windowOpacity, transparent: true }));
        removeHitboxes(entry.group);
        var self = this;
        function anchor() {
          return { x: leaf.x, y: leaf.topY + 0.3, z: leaf.z };
        }
        function enter() {
          entry.body.setAttribute('material', material('#fef08a', { opacity: 1 }));
          self.showTooltip(leaf.detail, anchor(), null);
        }
        function leave() {
          if (!self.pinned || self.pinned.id !== leaf.id) {
            entry.body.setAttribute('material', material(leaf.color, { opacity: 1 }));
          }
          if (!self.pinned) { self.tooltip?.hide?.(); }
        }
        function click() {
          self.togglePin(leaf.id, leaf.detail, anchor());
        }
        root.CodeXRGraphCommonRuntime?.attachPickHitbox?.(entry.group, {
          shape: 'box',
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
      colorForValue: colorForValue,
      resolveChangeState: resolveChangeState,
      withCacheBust: withCacheBust
    }
  };
})(typeof window !== 'undefined' ? window : this);
