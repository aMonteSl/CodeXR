(function registerCodeXRCodeCityRuntime(root) {
  'use strict';

  var COMPONENT = 'codexr-code-city';
  var RAYCAST_CLASS = 'babiaxraycasterclass';
  var CITY_WIDTH = 5.25;
  var CITY_DEPTH = 3.05;
  var CITY_MARGIN = 0.06;
  var DISTRICT_GAP = 0.055;
  var DISTRICT_INSET = 0.08;
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
      return {
        id: String(record.uid || record.id || stablePath || label) + ':' + index,
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
        this.el.setAttribute('data-codexr-code-city-root', 'true');
        this.el.setAttribute('data-codexr-normal-visualization', 'true');
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
          this.renderCity(true);
        }
      },
      remove: function () {
        this.unbindSource();
        this.clearCity();
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
        this.renderCity(false);
      },
      clearCity: function () {
        this.pinned = null;
        while (this.el.firstChild) {
          this.el.removeChild(this.el.firstChild);
        }
        this.tooltip = null;
        this.cityRoot = null;
      },
      renderCity: function (mappingOnly) {
        this.clearCity();
        this.ensureTooltip();
        var records = this.records || [];
        this.cityRoot = entity('a-entity', {
          'data-codexr-code-city-content': 'true'
        });
        this.el.appendChild(this.cityRoot);
        if (!records.length) {
          this.cityRoot.appendChild(text('No CodeXR city data available', '0 0.55 0', 4.5, '#fca5a5'));
          return;
        }
        var leaves = buildLeaves(records, this.mode);
        var layout = layoutLeaves(leaves, { width: CITY_WIDTH, depth: CITY_DEPTH });
        this.renderDistricts(layout.districts);
        this.renderBuildings(layout.leaves, records, mappingOnly);
        var title = text(this.data.title || 'CodeXR Code City', '0 1.78 ' + (-CITY_DEPTH / 2 - 0.22), 5.2, '#bae6fd');
        title.setAttribute('scale', '0.42 0.42 0.42');
        this.cityRoot.appendChild(title);
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
      renderDistricts: function (districts) {
        var self = this;
        districts.sort(function (a, b) { return a.depth - b.depth; }).forEach(function (district) {
          var level = district.depth || 0;
          var baseY = 0.018 + level * 0.032;
          var color = DISTRICT_PALETTE[Math.min(DISTRICT_PALETTE.length - 1, level)];
          var group = entity('a-entity', {
            position: district.x + ' ' + baseY + ' ' + district.z,
            'data-codexr-code-city-district': district.id
          });
          var platform = entity('a-box', {
            width: Math.max(0.08, district.width),
            height: 0.036,
            depth: Math.max(0.08, district.depthSize),
            material: 'color: ' + color + '; opacity: 0.28; transparent: true; shader: flat',
            'data-codexr-role': 'district-platform'
          });
          var edgeColor = level === 0 ? '#67e8f9' : '#bef264';
          var north = entity('a-box', {
            width: district.width,
            height: 0.028,
            depth: 0.018,
            position: '0 0.028 ' + (-district.depthSize / 2),
            material: 'color: ' + edgeColor + '; opacity: 0.8; transparent: true; shader: flat'
          });
          var south = entity('a-box', {
            width: district.width,
            height: 0.028,
            depth: 0.018,
            position: '0 0.028 ' + (district.depthSize / 2),
            material: 'color: ' + edgeColor + '; opacity: 0.8; transparent: true; shader: flat'
          });
          var west = entity('a-box', {
            width: 0.018,
            height: 0.028,
            depth: district.depthSize,
            position: (-district.width / 2) + ' 0.028 0',
            material: 'color: ' + edgeColor + '; opacity: 0.8; transparent: true; shader: flat'
          });
          var east = entity('a-box', {
            width: 0.018,
            height: 0.028,
            depth: district.depthSize,
            position: (district.width / 2) + ' 0.028 0',
            material: 'color: ' + edgeColor + '; opacity: 0.8; transparent: true; shader: flat'
          });
          group.appendChild(platform);
          group.appendChild(north);
          group.appendChild(south);
          group.appendChild(west);
          group.appendChild(east);
          if (district.width > 0.42 && district.depthSize > 0.26) {
            var label = text(compact(district.label, 20), '0 0.065 ' + (-district.depthSize / 2 + 0.075), 2.2, '#cffafe');
            label.setAttribute('scale', '0.18 0.18 0.18');
            group.appendChild(label);
          }
          var detail = {
            title: district.label,
            subtitle: district.path || '(project root)',
            primary: 'District | weight ' + Math.round(district.weight || 0),
            secondary: 'Depth ' + level + ' | click to pin',
            accentColor: edgeColor
          };
          function anchor() {
            return { x: district.x, y: 0.52 + level * 0.05, z: district.z };
          }
          function enter() { self.showTooltip(detail, anchor(), null); }
          function leave() { if (!self.pinned) { self.tooltip?.hide?.(); } }
          function click() { self.togglePin(district.id, detail, anchor()); }
          root.CodeXRGraphCommonRuntime?.attachPickHitbox?.(group, {
            shape: 'district',
            width: Math.max(0.16, district.width),
            height: 0.18,
            depth: Math.max(0.16, district.depthSize),
            position: '0 0.08 0',
            className: RAYCAST_CLASS,
            handlers: { enter: enter, leave: leave, click: click }
          });
          self.cityRoot.appendChild(group);
        });
      },
      renderBuildings: function (leaves, records, mappingOnly) {
        var self = this;
        var areaField = this.data.area || 'parameters';
        var heightField = this.data.height || 'lineCount';
        var colorField = this.data.color || 'complexity';
        var areaScale = metricScale(records, areaField);
        var heightScale = metricScale(records, heightField);
        leaves.forEach(function (leaf) {
          var record = leaf.record || {};
          var areaValue = numeric(safeField(record, areaField), 0);
          var heightValue = numeric(safeField(record, heightField), 0);
          var maxFootprint = Math.max(0.08, Math.min(leaf.cellWidth || 0.18, leaf.cellDepth || 0.18) * 0.62);
          var footprint = Math.max(0.055, maxFootprint * (0.45 + areaScale.normalize(areaValue) * 0.55));
          var buildingHeight = 0.09 + heightScale.normalize(heightValue) * 1.42;
          var baseY = 0.07 + Math.max(0, leaf.directoryParts.length - 1) * 0.032;
          var color = colorForValue(record[colorField], records, colorField);
          var changeState = resolveChangeState(record);
          var roofColor = roofColorForState(changeState);
          var building = entity('a-entity', {
            position: leaf.x + ' ' + baseY + ' ' + leaf.z,
            'data-codexr-code-city-node': leaf.id,
            class: RAYCAST_CLASS
          });
          var body = entity('a-box', {
            width: footprint,
            height: buildingHeight,
            depth: footprint,
            position: '0 ' + (buildingHeight / 2) + ' 0',
            material: 'color: ' + color + '; shader: flat; roughness: 0.72; metalness: 0.02'
          });
          var roof = entity('a-box', {
            width: footprint * 1.12,
            height: Math.max(0.026, footprint * 0.2),
            depth: footprint * 1.12,
            position: '0 ' + (buildingHeight + Math.max(0.018, footprint * 0.1)) + ' 0',
            material: 'color: ' + roofColor + '; opacity: 0.92; transparent: true; shader: flat'
          });
          var halo = entity('a-ring', {
            radiusInner: footprint * 0.68,
            radiusOuter: footprint * 0.82,
            rotation: '-90 0 0',
            position: '0 0.012 0',
            material: 'color: ' + roofColor + '; opacity: ' + (changeState === 'neutral' ? 0.18 : 0.5)
              + '; transparent: true; shader: flat; side: double'
          });
          building.appendChild(halo);
          building.appendChild(body);
          building.appendChild(roof);
          building.setAttribute('scale', mappingOnly ? '0.92 0.92 0.92' : '0.01 0.01 0.01');
          building.setAttribute(
            'animation__appear',
            'property: scale; to: 1 1 1; dur: ' + Number(self.data.animationDuration || 520) + '; easing: easeOutCubic'
          );
          var detail = {
            title: leaf.label,
            subtitle: leaf.path,
            primary: areaField + ' ' + areaValue + ' | ' + heightField + ' ' + heightValue,
            secondary: colorField + ' ' + String(record[colorField] ?? '') + ' | '
              + (record.language || record.type || self.mode) + ' | ' + changeState,
            accentColor: roofColor
          };
          function anchor() {
            return { x: leaf.x, y: baseY + buildingHeight + 0.36, z: leaf.z };
          }
          function enter() {
            body.setAttribute('material', 'color: #fef08a; shader: flat; roughness: 0.58');
            self.showTooltip(detail, anchor(), null);
          }
          function leave() {
            if (!self.pinned || self.pinned.id !== leaf.id) {
              body.setAttribute('material', 'color: ' + color + '; shader: flat; roughness: 0.72; metalness: 0.02');
            }
            if (!self.pinned) { self.tooltip?.hide?.(); }
          }
          function click() {
            self.togglePin(leaf.id, detail, anchor());
          }
          root.CodeXRGraphCommonRuntime?.attachPickHitbox?.(building, {
            shape: 'box',
            width: footprint * 1.5,
            height: buildingHeight + 0.22,
            depth: footprint * 1.5,
            position: '0 ' + (buildingHeight / 2) + ' 0',
            className: RAYCAST_CLASS,
            handlers: { enter: enter, leave: leave, click: click }
          });
          self.cityRoot.appendChild(building);
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
      colorForValue: colorForValue,
      resolveChangeState: resolveChangeState,
      withCacheBust: withCacheBust
    }
  };
})(typeof window !== 'undefined' ? window : this);
