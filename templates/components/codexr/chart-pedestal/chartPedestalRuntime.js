(function registerCodeXRChartPedestalComponent(root) {
  'use strict';

  var AFRAME = root.AFRAME;
  var COMPONENT_NAME = 'codexr-chart-pedestal';
  var LEGACY_COMPONENT_NAME = 'codexr-boats-pedestal';
  var RUNTIME_GLOBAL_NAME = 'CodeXRChartPedestalRuntime';
  var LEGACY_RUNTIME_GLOBAL_NAME = 'CodeXRBoatsPedestalRuntime';
  var DEBUG_GLOBAL_NAME = 'CodeXRChartDebugBands';
  var LEGACY_DEBUG_GLOBAL_NAME = 'CodeXRBoatsDebugBands';
  if (!AFRAME || !AFRAME.registerComponent || AFRAME.components[COMPONENT_NAME]) {
    return;
  }

  var DEFAULTS = {
    targetWidth: 5.614,
    targetHeight: 1.8,
    targetDepth: 3.218,
    anchorX: 0,
    anchorY: 1,
    anchorZ: -18,
    revealOffsetY: 0.03,
    retries: 45,
    retryDelayMs: 90,
    pedestalYOffset: -0.12,
    pedestalTopPadding: 0.9,
    pedestalTopThickness: 0.14,
    pedestalBaseRadius: 1.45,
    pedestalBaseHeight: 0.78,
    uiDockEnabled: false,
    uiDockWidth: 1.46,
    uiDockDepth: 0.82,
    uiDockHeight: 0.05,
    uiDockOffsetX: 3.35,
    uiDockOffsetY: 0.2,
    uiDockOffsetZ: 2.22,
    uiDockColor: '#11253a',
    uiDockTrimColor: '#1f6a9b',
    pedestalColorTop: '#eadfc9',
    pedestalColorBase: '#5f5243',
    pedestalColorTrim: '#cdbb9a',
    minPlanarOccupancyRatio: 0.62,
    minHeightOccupancyRatio: 0.45,
    heightBandMinRatio: 0.38,
    heightBandMaxRatio: 0.72,
    buildingHeightBandEnabled: false,
    buildingHeightMinTarget: 0,
    buildingHeightMaxTarget: 0,
    buildingHeightToleranceRatio: 0.08,
    yScaleMin: 0.01,
    yScaleMax: 4,
    containmentToleranceRatio: 0.018,
    containmentDamping: 0.985,
    containmentMaxIterations: 8,
    containmentCheckMs: 700,
    periodicContainmentEnabled: false,
    renormalizeDebounceMs: 280,
    stabilizationCheckMs: 140,
    stabilizationMaxChecks: 14,
    stabilizationStablePasses: 3
  };

  var DEBUG_STATE = {
    enabled: false
  };

  var AUXILIARY_TOKEN_PATTERN = /(legend|label|title|axis|tick|grid|mapping|debug|tooltip)/i;
  var TEXT_COMPONENT_KEYS = ['text', 'troika-text'];

  function toFixedNumber(value) {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Number(value.toFixed(3));
  }

  function clamp(value, minValue, maxValue) {
    return Math.max(minValue, Math.min(maxValue, value));
  }

  function isFiniteVector3Like(value) {
    return !!value
      && Number.isFinite(value.x)
      && Number.isFinite(value.y)
      && Number.isFinite(value.z);
  }

  function isFiniteBoundsInfo(boundsInfo) {
    return !!boundsInfo
      && !!boundsInfo.bounds
      && !!boundsInfo.bounds.min
      && !!boundsInfo.bounds.max
      && isFiniteVector3Like(boundsInfo.size)
      && isFiniteVector3Like(boundsInfo.center)
      && isFiniteVector3Like(boundsInfo.bounds.min)
      && isFiniteVector3Like(boundsInfo.bounds.max);
  }

  function cloneScale(object3D) {
    return {
      x: object3D.scale.x,
      y: object3D.scale.y,
      z: object3D.scale.z
    };
  }

  function buildBounds(three, object3D) {
    var bounds = new three.Box3();
    var size = new three.Vector3();
    var center = new three.Vector3();
    bounds.setFromObject(object3D);
    bounds.getSize(size);
    bounds.getCenter(center);
    if (!isFiniteVector3Like(size) || !isFiniteVector3Like(center) || !isFiniteVector3Like(bounds.min) || !isFiniteVector3Like(bounds.max)) {
      return null;
    }
    return {
      bounds: bounds,
      size: size,
      center: center
    };
  }

  function debugLog() {
    if (!DEBUG_STATE.enabled) {
      return;
    }
    var args = Array.prototype.slice.call(arguments);
    args.unshift('[CodeXR][ChartPedestal]');
    console.log.apply(console, args);
  }

  function debugTable(label, payload) {
    if (!DEBUG_STATE.enabled || typeof console.table !== 'function') {
      return;
    }
    console.log('[CodeXR][ChartPedestal] ' + label);
    console.table(payload);
  }

  function findOwningEntity(node) {
    var current = node;
    while (current) {
      if (current.el) {
        return current.el;
      }
      current = current.parent;
    }
    return null;
  }

  function collectNodeMeta(node) {
    var ownerEntity = findOwningEntity(node);
    var classAttr = ownerEntity && ownerEntity.getAttribute ? ownerEntity.getAttribute('class') : '';

    return {
      id: ownerEntity && ownerEntity.id ? ownerEntity.id : '',
      className: typeof classAttr === 'string' ? classAttr : '',
      tagName: ownerEntity && ownerEntity.tagName ? ownerEntity.tagName : '',
      name: ownerEntity && ownerEntity.getAttribute ? (ownerEntity.getAttribute('data-name') || ownerEntity.getAttribute('name') || '') : '',
      dataName: ownerEntity && ownerEntity.getAttribute ? (ownerEntity.getAttribute('data-codexr-role') || '') : '',
      nodeName: node && node.name ? String(node.name) : '',
      hasTextComponent: !!(ownerEntity && ownerEntity.hasAttribute && TEXT_COMPONENT_KEYS.some(function (key) {
        return ownerEntity.hasAttribute(key);
      }))
    };
  }

  function matchesIgnoredBoundsMeta(meta) {
    if (!meta) {
      return false;
    }

    var tagName = String(meta.tagName || '').toLowerCase();
    if (tagName === 'a-text') {
      return true;
    }

    if (meta.hasTextComponent) {
      return true;
    }

    var combined = [
      meta.id || '',
      meta.className || '',
      meta.name || '',
      meta.dataName || '',
      meta.nodeName || ''
    ].join(' ');

    return AUXILIARY_TOKEN_PATTERN.test(combined);
  }

  function shouldIgnoreNodeForContentBounds(node) {
    if (!node) {
      return false;
    }
    return matchesIgnoredBoundsMeta(collectNodeMeta(node));
  }

  function buildBoundsFromNodes(three, nodes) {
    if (!three || !three.Box3 || !three.Vector3 || !Array.isArray(nodes) || nodes.length === 0) {
      return null;
    }

    var aggregate = new three.Box3();
    var firstBounds = null;

    nodes.forEach(function (node) {
      if (!node || !node.geometry) {
        return;
      }

      if (!node.geometry.boundingBox && typeof node.geometry.computeBoundingBox === 'function') {
        node.geometry.computeBoundingBox();
      }

      if (!node.geometry.boundingBox || typeof node.geometry.boundingBox.clone !== 'function') {
        return;
      }

      var worldBounds = node.geometry.boundingBox.clone();
      if (typeof worldBounds.applyMatrix4 === 'function' && node.matrixWorld) {
        worldBounds.applyMatrix4(node.matrixWorld);
      }

      if (!isFiniteVector3Like(worldBounds.min) || !isFiniteVector3Like(worldBounds.max)) {
        return;
      }

      if (!firstBounds) {
        firstBounds = worldBounds;
        if (typeof aggregate.copy === 'function') {
          aggregate.copy(worldBounds);
        } else {
          aggregate.min.copy(worldBounds.min);
          aggregate.max.copy(worldBounds.max);
        }
      } else if (typeof aggregate.union === 'function') {
        aggregate.union(worldBounds);
      }
    });

    if (!firstBounds) {
      return null;
    }

    var size = new three.Vector3();
    var center = new three.Vector3();
    aggregate.getSize(size);
    aggregate.getCenter(center);
    if (!isFiniteVector3Like(size) || !isFiniteVector3Like(center)) {
      return null;
    }

    return {
      bounds: aggregate,
      size: size,
      center: center
    };
  }

  function buildContentBounds(three, object3D) {
    if (!three || !object3D || typeof object3D.traverse !== 'function') {
      return null;
    }

    var nodes = [];
    object3D.updateMatrixWorld(true);
    object3D.traverse(function (node) {
      if (!node || node.visible === false || !node.geometry) {
        return;
      }
      if (shouldIgnoreNodeForContentBounds(node)) {
        return;
      }
      nodes.push(node);
    });

    return buildBoundsFromNodes(three, nodes);
  }

  function shouldUseContentBounds(contentBounds, fullBounds) {
    if (!isFiniteBoundsInfo(contentBounds) || !isFiniteBoundsInfo(fullBounds)) {
      return !!contentBounds;
    }

    if (contentBounds.size.x <= 0.05 || contentBounds.size.y <= 0.01 || contentBounds.size.z <= 0.05) {
      return false;
    }

    var widthRatio = contentBounds.size.x / Math.max(fullBounds.size.x, 0.0001);
    var depthRatio = contentBounds.size.z / Math.max(fullBounds.size.z, 0.0001);

    if (widthRatio < 0.015 && depthRatio < 0.015) {
      return false;
    }

    return true;
  }

  function computePlanarFitFactor(size, targetWidth, targetDepth) {
    if (!size || !Number.isFinite(size.x) || !Number.isFinite(size.z) || size.x <= 0 || size.z <= 0) {
      return null;
    }

    var fitX = targetWidth / size.x;
    var fitZ = targetDepth / size.z;
    var planarFactor = Math.min(fitX, fitZ);
    if (!Number.isFinite(planarFactor) || planarFactor <= 0) {
      return null;
    }

    return planarFactor;
  }

  function resolveHeightBandTargets(data) {
    var legacyMin = Number.isFinite(data.buildingHeightMinTarget) && data.buildingHeightMinTarget > 0
      ? data.buildingHeightMinTarget
      : null;
    var legacyMax = Number.isFinite(data.buildingHeightMaxTarget) && data.buildingHeightMaxTarget > 0
      ? data.buildingHeightMaxTarget
      : null;

    if (legacyMin && legacyMax && legacyMax > legacyMin) {
      return {
        minHeight: legacyMin,
        maxHeight: legacyMax,
        minRatio: legacyMin / Math.max(data.targetHeight, 0.0001),
        maxRatio: legacyMax / Math.max(data.targetHeight, 0.0001)
      };
    }

    var minRatio = clamp(
      Number.isFinite(data.heightBandMinRatio) ? data.heightBandMinRatio : DEFAULTS.heightBandMinRatio,
      0.05,
      0.95
    );
    var maxRatio = clamp(
      Number.isFinite(data.heightBandMaxRatio) ? data.heightBandMaxRatio : DEFAULTS.heightBandMaxRatio,
      minRatio + 0.01,
      0.99
    );

    return {
      minHeight: data.targetHeight * minRatio,
      maxHeight: data.targetHeight * maxRatio,
      minRatio: minRatio,
      maxRatio: maxRatio
    };
  }

  function computeHeightBandScale(currentHeight, currentScaleY, bandTargets, yScaleMin, yScaleMax) {
    if (!Number.isFinite(currentHeight) || currentHeight <= 0 || !Number.isFinite(currentScaleY) || !bandTargets) {
      return null;
    }

    var targetY = currentScaleY;

    if (currentHeight < bandTargets.minHeight) {
      targetY = currentScaleY * (bandTargets.minHeight / currentHeight);
    } else if (currentHeight > bandTargets.maxHeight) {
      targetY = currentScaleY * (bandTargets.maxHeight / currentHeight);
    }

    targetY = clamp(targetY, yScaleMin, yScaleMax);

    return {
      changed: Math.abs(targetY - currentScaleY) > 0.0001,
      targetY: targetY
    };
  }

  function buildMeasurementSignature(measurements, object3D) {
    if (!measurements || !measurements.primary || !object3D) {
      return null;
    }

    var primary = measurements.primary;
    var full = measurements.full || primary;

    return [
      toFixedNumber(primary.size.x),
      toFixedNumber(primary.size.y),
      toFixedNumber(primary.size.z),
      toFixedNumber(full.size.x),
      toFixedNumber(full.size.y),
      toFixedNumber(full.size.z),
      toFixedNumber(object3D.scale.x),
      toFixedNumber(object3D.scale.y),
      toFixedNumber(object3D.scale.z),
      toFixedNumber(object3D.position.x),
      toFixedNumber(object3D.position.y),
      toFixedNumber(object3D.position.z)
    ].join('|');
  }

  function softenFactor(factor, damping) {
    if (!Number.isFinite(factor) || factor <= 0) {
      return 1;
    }
    if (Math.abs(factor - 1) <= 0.0005) {
      return 1;
    }
    if (factor > 1) {
      return 1 + ((factor - 1) * 0.65);
    }
    return 1 - ((1 - factor) * damping);
  }

  function computeAnchorOffset(measurements, data) {
    if (!measurements || !isFiniteBoundsInfo(measurements.full) || !isFiniteBoundsInfo(measurements.primary) || !data) {
      return null;
    }

    return {
      deltaX: data.anchorX - measurements.primary.center.x,
      deltaY: (data.anchorY + data.revealOffsetY) - measurements.full.bounds.min.y,
      deltaZ: data.anchorZ - measurements.primary.center.z
    };
  }

  var componentDefinition = {
    schema: {
      enabled: { default: true },
      targetWidth: { type: 'number', default: DEFAULTS.targetWidth },
      targetHeight: { type: 'number', default: DEFAULTS.targetHeight },
      targetDepth: { type: 'number', default: DEFAULTS.targetDepth },
      anchorX: { type: 'number', default: DEFAULTS.anchorX },
      anchorY: { type: 'number', default: DEFAULTS.anchorY },
      anchorZ: { type: 'number', default: DEFAULTS.anchorZ },
      revealOffsetY: { type: 'number', default: DEFAULTS.revealOffsetY },
      retries: { type: 'int', default: DEFAULTS.retries },
      retryDelayMs: { type: 'int', default: DEFAULTS.retryDelayMs },
      pedestalYOffset: { type: 'number', default: DEFAULTS.pedestalYOffset },
      pedestalTopPadding: { type: 'number', default: DEFAULTS.pedestalTopPadding },
      pedestalTopThickness: { type: 'number', default: DEFAULTS.pedestalTopThickness },
      pedestalBaseRadius: { type: 'number', default: DEFAULTS.pedestalBaseRadius },
      pedestalBaseHeight: { type: 'number', default: DEFAULTS.pedestalBaseHeight },
      uiDockEnabled: { default: DEFAULTS.uiDockEnabled },
      uiDockWidth: { type: 'number', default: DEFAULTS.uiDockWidth },
      uiDockDepth: { type: 'number', default: DEFAULTS.uiDockDepth },
      uiDockHeight: { type: 'number', default: DEFAULTS.uiDockHeight },
      uiDockOffsetX: { type: 'number', default: DEFAULTS.uiDockOffsetX },
      uiDockOffsetY: { type: 'number', default: DEFAULTS.uiDockOffsetY },
      uiDockOffsetZ: { type: 'number', default: DEFAULTS.uiDockOffsetZ },
      uiDockColor: { default: DEFAULTS.uiDockColor },
      uiDockTrimColor: { default: DEFAULTS.uiDockTrimColor },
      pedestalColorTop: { default: DEFAULTS.pedestalColorTop },
      pedestalColorBase: { default: DEFAULTS.pedestalColorBase },
      pedestalColorTrim: { default: DEFAULTS.pedestalColorTrim },
      minPlanarOccupancyRatio: { type: 'number', default: DEFAULTS.minPlanarOccupancyRatio },
      minHeightOccupancyRatio: { type: 'number', default: DEFAULTS.minHeightOccupancyRatio },
      heightBandMinRatio: { type: 'number', default: DEFAULTS.heightBandMinRatio },
      heightBandMaxRatio: { type: 'number', default: DEFAULTS.heightBandMaxRatio },
      buildingHeightBandEnabled: { default: DEFAULTS.buildingHeightBandEnabled },
      buildingHeightMinTarget: { type: 'number', default: DEFAULTS.buildingHeightMinTarget },
      buildingHeightMaxTarget: { type: 'number', default: DEFAULTS.buildingHeightMaxTarget },
      buildingHeightToleranceRatio: { type: 'number', default: DEFAULTS.buildingHeightToleranceRatio },
      yScaleMin: { type: 'number', default: DEFAULTS.yScaleMin },
      yScaleMax: { type: 'number', default: DEFAULTS.yScaleMax },
      containmentToleranceRatio: { type: 'number', default: DEFAULTS.containmentToleranceRatio },
      containmentDamping: { type: 'number', default: DEFAULTS.containmentDamping },
      containmentMaxIterations: { type: 'int', default: DEFAULTS.containmentMaxIterations },
      containmentCheckMs: { type: 'int', default: DEFAULTS.containmentCheckMs },
      periodicContainmentEnabled: { default: DEFAULTS.periodicContainmentEnabled },
      renormalizeDebounceMs: { type: 'int', default: DEFAULTS.renormalizeDebounceMs },
      stabilizationCheckMs: { type: 'int', default: DEFAULTS.stabilizationCheckMs },
      stabilizationMaxChecks: { type: 'int', default: DEFAULTS.stabilizationMaxChecks },
      stabilizationStablePasses: { type: 'int', default: DEFAULTS.stabilizationStablePasses }
    },

    init: function () {
      this.retryCount = 0;
      this.retryTimer = null;
      this.stabilizationTimer = null;
      this.stabilizationChecksRemaining = 0;
      this.stabilizationStableCount = 0;
      this.lastMeasurementSignature = null;
      this.lastRenormalizeRequestAt = 0;
      this.nextContainmentCheckAt = 0;
      this.baseScale = null;
      this.normalized = false;
      this.pedestalEl = null;
      this.uiDockEl = null;
      this.nextInvalidTransformWarnAt = 0;
      this.nextMinimumCompromisedWarnAt = 0;
      this.onComponentChangedBound = this.onComponentChanged.bind(this);

      if (!this.data.enabled) {
        return;
      }

      this.ensureInitialPlacement();
      this.ensurePedestal();
      this.el.addEventListener('componentchanged', this.onComponentChangedBound);

      if (this.el.object3D) {
        this.el.object3D.visible = false;
      }

      this.tryNormalize('init');
    },

    warnInvalidTransform: function (reason, details) {
      var now = Date.now();
      if (now < this.nextInvalidTransformWarnAt) {
        return;
      }
      this.nextInvalidTransformWarnAt = now + 2000;
      console.warn('[CodeXR][ChartPedestal] Skipping invalid transform state:', {
        reason: reason,
        details: details || null
      });
    },

    warnMinimumCompromised: function (details) {
      var now = Date.now();
      if (now < this.nextMinimumCompromisedWarnAt) {
        return;
      }
      this.nextMinimumCompromisedWarnAt = now + 4000;
      console.warn('[CodeXR][ChartPedestal] Minimum occupancy relaxed to preserve containment:', details || null);
    },

    requestRenormalize: function (reason) {
      var now = Date.now();
      var debounceMs = Math.max(80, this.data.renormalizeDebounceMs || DEFAULTS.renormalizeDebounceMs);
      if ((now - this.lastRenormalizeRequestAt) < debounceMs) {
        return;
      }
      this.lastRenormalizeRequestAt = now;
      this.renormalize(reason || 'componentchanged');
    },

    onComponentChanged: function (event) {
      if (!event || !event.detail || !this.data.enabled || !this.el || event.target !== this.el) {
        return;
      }
      var name = event.detail.name || '';
      if (typeof name !== 'string') {
        return;
      }
      if (name.indexOf('babia-') === 0 && name !== 'babia-queryjson') {
        this.requestRenormalize('chart-componentchanged:' + name);
      }
    },

    update: function (oldData) {
      if (!oldData) {
        return;
      }

      if (!this.data.enabled) {
        this.stopStabilizationLoop();
        return;
      }

      if (
        oldData.targetWidth !== this.data.targetWidth
        || oldData.targetHeight !== this.data.targetHeight
        || oldData.targetDepth !== this.data.targetDepth
        || oldData.anchorX !== this.data.anchorX
        || oldData.anchorY !== this.data.anchorY
        || oldData.anchorZ !== this.data.anchorZ
        || oldData.minPlanarOccupancyRatio !== this.data.minPlanarOccupancyRatio
        || oldData.minHeightOccupancyRatio !== this.data.minHeightOccupancyRatio
        || oldData.heightBandMinRatio !== this.data.heightBandMinRatio
        || oldData.heightBandMaxRatio !== this.data.heightBandMaxRatio
        || oldData.yScaleMin !== this.data.yScaleMin
        || oldData.yScaleMax !== this.data.yScaleMax
        || oldData.containmentToleranceRatio !== this.data.containmentToleranceRatio
        || oldData.stabilizationCheckMs !== this.data.stabilizationCheckMs
        || oldData.stabilizationMaxChecks !== this.data.stabilizationMaxChecks
        || oldData.stabilizationStablePasses !== this.data.stabilizationStablePasses
      ) {
        this.normalized = false;
        this.retryCount = 0;
        this.stopStabilizationLoop();
        this.ensureInitialPlacement();
        this.refreshPedestalGeometry();
        if (this.el.object3D) {
          this.el.object3D.visible = false;
        }
        this.tryNormalize('update');
      }

      this.refreshUiDock();
    },

    tick: function (time) {
      if (!this.data.enabled || !this.normalized || !this.el || !this.el.object3D || !this.data.periodicContainmentEnabled) {
        return;
      }

      if (!isFiniteVector3Like(this.el.object3D.position) || !isFiniteVector3Like(this.el.object3D.scale)) {
        this.warnInvalidTransform('tick-non-finite-object3d', {
          position: this.el.object3D.position,
          scale: this.el.object3D.scale
        });
        this.renormalize('tick-non-finite-object3d');
        return;
      }

      if (time < this.nextContainmentCheckAt) {
        return;
      }

      this.nextContainmentCheckAt = time + Math.max(120, this.data.containmentCheckMs);
      this.runMaintenancePass('tick');
    },

    remove: function () {
      if (this.onComponentChangedBound && this.el && this.el.removeEventListener) {
        this.el.removeEventListener('componentchanged', this.onComponentChangedBound);
      }

      if (this.retryTimer) {
        clearTimeout(this.retryTimer);
        this.retryTimer = null;
      }

      this.stopStabilizationLoop();

      if (this.pedestalEl && this.pedestalEl.parentNode) {
        this.pedestalEl.parentNode.removeChild(this.pedestalEl);
      }
      this.pedestalEl = null;

      if (this.uiDockEl && this.uiDockEl.parentNode) {
        this.uiDockEl.parentNode.removeChild(this.uiDockEl);
      }
      this.uiDockEl = null;
    },

    ensureInitialPlacement: function () {
      this.el.setAttribute('position', this.data.anchorX + ' ' + this.data.anchorY + ' ' + this.data.anchorZ);
    },

    ensurePedestal: function () {
      if (this.pedestalEl) {
        this.refreshPedestalGeometry();
        return;
      }

      var sceneEl = this.el.sceneEl;
      if (!sceneEl || (!sceneEl.parentNode && sceneEl !== this.el.parentNode)) {
        return;
      }

      var document = this.el.ownerDocument;
      var pedestal = document.createElement('a-entity');
      var top = document.createElement('a-box');
      var trim = document.createElement('a-ring');
      var base = document.createElement('a-cylinder');

      pedestal.setAttribute('id', (this.el.id || 'boats-chart') + '-pedestal');

      top.setAttribute('position', '0 0 0');
      top.setAttribute('class', 'babiaxraycasterclass');

      trim.setAttribute('position', '0 0.005 0');
      trim.setAttribute('rotation', '-90 0 0');
      trim.setAttribute('radius-inner', '0.8');
      trim.setAttribute('radius-outer', '1');

      base.setAttribute('position', '0 -0.45 0');
      base.setAttribute('class', 'babiaxraycasterclass');

      pedestal.appendChild(base);
      pedestal.appendChild(top);
      pedestal.appendChild(trim);

      sceneEl.appendChild(pedestal);
      this.pedestalEl = pedestal;
      this.refreshPedestalGeometry();
      this.refreshUiDock();
    },

    shouldRenderUiDock: function () {
      if (!this.data.uiDockEnabled) {
        return false;
      }

      var document = this.el.ownerDocument;
      return !!document.getElementById('codexr-tooling-config-xr-mapping-ui');
    },

    ensureUiDock: function () {
      if (this.uiDockEl) {
        return;
      }

      var sceneEl = this.el.sceneEl;
      if (!sceneEl) {
        return;
      }

      var document = this.el.ownerDocument;
      var dock = document.createElement('a-entity');
      var plate = document.createElement('a-box');
      var trim = document.createElement('a-box');

      dock.setAttribute('id', (this.el.id || 'boats-chart') + '-pedestal-ui-dock');
      dock.setAttribute('hide-on-enter-ar', '');

      plate.setAttribute('class', 'babiaxraycasterclass');
      trim.setAttribute('class', 'babiaxraycasterclass');

      dock.appendChild(plate);
      dock.appendChild(trim);
      sceneEl.appendChild(dock);
      this.uiDockEl = dock;
    },

    refreshUiDock: function () {
      if (!this.shouldRenderUiDock()) {
        if (this.uiDockEl && this.uiDockEl.parentNode) {
          this.uiDockEl.parentNode.removeChild(this.uiDockEl);
        }
        this.uiDockEl = null;
        return;
      }

      this.ensureUiDock();
      if (!this.uiDockEl) {
        return;
      }

      var plate = this.uiDockEl.children[0];
      var trim = this.uiDockEl.children[1];
      var baseY = this.data.anchorY + this.data.pedestalYOffset + this.data.uiDockOffsetY;

      this.uiDockEl.setAttribute(
        'position',
        this.data.anchorX + this.data.uiDockOffsetX + ' '
          + baseY + ' '
          + (this.data.anchorZ + this.data.uiDockOffsetZ)
      );

      plate.setAttribute('width', this.data.uiDockWidth);
      plate.setAttribute('height', this.data.uiDockHeight);
      plate.setAttribute('depth', this.data.uiDockDepth);
      plate.setAttribute('position', '0 0 0');
      plate.setAttribute('material', 'color: ' + this.data.uiDockColor + '; metalness: 0.22; roughness: 0.72');

      trim.setAttribute('width', this.data.uiDockWidth + 0.03);
      trim.setAttribute('height', this.data.uiDockHeight + 0.02);
      trim.setAttribute('depth', this.data.uiDockDepth + 0.03);
      trim.setAttribute('position', '0 -0.005 -0.003');
      trim.setAttribute('material', 'color: ' + this.data.uiDockTrimColor + '; opacity: 0.42; transparent: true; metalness: 0.35; roughness: 0.4');
    },

    refreshPedestalGeometry: function () {
      if (!this.pedestalEl) {
        return;
      }

      var top = this.pedestalEl.children[1];
      var trim = this.pedestalEl.children[2];
      var base = this.pedestalEl.children[0];
      var topWidth = this.data.targetWidth + this.data.pedestalTopPadding;
      var topDepth = this.data.targetDepth + this.data.pedestalTopPadding;
      var baseRadius = this.data.pedestalBaseRadius;

      this.pedestalEl.setAttribute('position', this.data.anchorX + ' ' + (this.data.anchorY + this.data.pedestalYOffset - this.data.revealOffsetY) + ' ' + this.data.anchorZ);

      top.setAttribute('width', topWidth);
      top.setAttribute('height', this.data.pedestalTopThickness);
      top.setAttribute('depth', topDepth);
      top.setAttribute('material', 'color: ' + this.data.pedestalColorTop + '; metalness: 0.05; roughness: 0.88');

      trim.setAttribute('radius-inner', Math.max(0.15, Math.min(topWidth, topDepth) * 0.38));
      trim.setAttribute('radius-outer', Math.max(0.2, Math.min(topWidth, topDepth) * 0.46));
      trim.setAttribute('material', 'color: ' + this.data.pedestalColorTrim + '; metalness: 0.22; roughness: 0.45');

      base.setAttribute('radius', baseRadius);
      base.setAttribute('height', this.data.pedestalBaseHeight);
      base.setAttribute('position', '0 ' + (-(this.data.pedestalBaseHeight / 2) - (this.data.pedestalTopThickness / 2)) + ' 0');
      base.setAttribute('material', 'color: ' + this.data.pedestalColorBase + '; metalness: 0.28; roughness: 0.7');

      this.refreshUiDock();
    },

    ensureBaseScale: function () {
      var object3D = this.el && this.el.object3D;
      if (!object3D || !object3D.scale) {
        return;
      }

      if (!this.baseScale) {
        this.baseScale = cloneScale(object3D);
      }
    },

    resetToBaseScale: function () {
      var object3D = this.el && this.el.object3D;
      if (!object3D || !object3D.scale || !this.baseScale) {
        return false;
      }

      object3D.scale.set(this.baseScale.x, this.baseScale.y, this.baseScale.z);
      object3D.updateMatrixWorld(true);
      return true;
    },

    measureBounds: function () {
      var three = root.THREE || (root.AFRAME && root.AFRAME.THREE);
      var object3D = this.el && this.el.object3D;
      if (!object3D || !three || !three.Box3 || !three.Vector3) {
        return null;
      }

      var full = buildBounds(three, object3D);
      if (!isFiniteBoundsInfo(full)) {
        return null;
      }

      var content = buildContentBounds(three, object3D);
      var primary = shouldUseContentBounds(content, full) ? content : full;

      return {
        full: full,
        content: content,
        primary: primary
      };
    },

    applyAnchorPlacement: function (measurements) {
      var object3D = this.el && this.el.object3D;
      if (!object3D || !measurements || !isFiniteBoundsInfo(measurements.full) || !isFiniteBoundsInfo(measurements.primary)) {
        return false;
      }

      var offset = computeAnchorOffset(measurements, this.data);
      if (!offset) {
        return false;
      }

      if (!Number.isFinite(offset.deltaX) || !Number.isFinite(offset.deltaY) || !Number.isFinite(offset.deltaZ)) {
        this.warnInvalidTransform('non-finite-anchor-target', {
          deltaX: offset.deltaX,
          deltaY: offset.deltaY,
          deltaZ: offset.deltaZ
        });
        return false;
      }

      var moved = Math.abs(offset.deltaX) > 0.0005
        || Math.abs(offset.deltaY) > 0.0005
        || Math.abs(offset.deltaZ) > 0.0005;

      if (!moved) {
        return false;
      }

      object3D.position.set(
        object3D.position.x + offset.deltaX,
        object3D.position.y + offset.deltaY,
        object3D.position.z + offset.deltaZ
      );
      object3D.updateMatrixWorld(true);
      return true;
    },

    syncTransformAttributes: function () {
      var object3D = this.el && this.el.object3D;
      if (!object3D) {
        return;
      }

      if (!isFiniteVector3Like(object3D.position) || !isFiniteVector3Like(object3D.scale)) {
        this.warnInvalidTransform('sync-transform-non-finite', {
          position: object3D.position,
          scale: object3D.scale
        });
        return;
      }

      this.el.setAttribute(
        'position',
        toFixedNumber(object3D.position.x) + ' '
          + toFixedNumber(object3D.position.y) + ' '
          + toFixedNumber(object3D.position.z)
      );
      this.el.setAttribute(
        'scale',
        toFixedNumber(object3D.scale.x) + ' '
          + toFixedNumber(object3D.scale.y) + ' '
          + toFixedNumber(object3D.scale.z)
      );
    },

    applyScaleFactors: function (xzFactor, yFactor) {
      var object3D = this.el && this.el.object3D;
      if (!object3D) {
        return false;
      }

      var nextX = object3D.scale.x * xzFactor;
      var nextY = clamp(object3D.scale.y * yFactor, Math.max(0.001, this.data.yScaleMin), Math.max(this.data.yScaleMin + 0.001, this.data.yScaleMax));
      var nextZ = object3D.scale.z * xzFactor;

      if (!Number.isFinite(nextX) || !Number.isFinite(nextY) || !Number.isFinite(nextZ) || nextX <= 0 || nextY <= 0 || nextZ <= 0) {
        this.warnInvalidTransform('apply-scale-invalid-target', {
          nextX: nextX,
          nextY: nextY,
          nextZ: nextZ,
          xzFactor: xzFactor,
          yFactor: yFactor
        });
        return false;
      }

      var changed = Math.abs(nextX - object3D.scale.x) > 0.0001
        || Math.abs(nextY - object3D.scale.y) > 0.0001
        || Math.abs(nextZ - object3D.scale.z) > 0.0001;

      if (!changed) {
        return false;
      }

      object3D.scale.set(nextX, nextY, nextZ);
      object3D.updateMatrixWorld(true);
      return true;
    },

    enforceHeightBand: function (source) {
      var object3D = this.el && this.el.object3D;
      if (!object3D) {
        return false;
      }

      var measurements = this.measureBounds();
      if (!measurements || !isFiniteBoundsInfo(measurements.primary)) {
        return false;
      }

      var bandTargets = resolveHeightBandTargets(this.data);
      var result = computeHeightBandScale(
        measurements.primary.size.y,
        object3D.scale.y,
        bandTargets,
        Math.max(0.001, this.data.yScaleMin),
        Math.max(this.data.yScaleMin + 0.001, this.data.yScaleMax)
      );

      if (!result || !result.changed) {
        return false;
      }

      object3D.scale.y = result.targetY;
      object3D.updateMatrixWorld(true);

      var nextMeasurements = this.measureBounds();
      if (nextMeasurements) {
        this.applyAnchorPlacement(nextMeasurements);
      }
      this.syncTransformAttributes();
      debugLog('height-band-adjusted', {
        source: source || 'unknown',
        minHeight: toFixedNumber(bandTargets.minHeight),
        maxHeight: toFixedNumber(bandTargets.maxHeight),
        currentHeight: nextMeasurements && nextMeasurements.primary ? toFixedNumber(nextMeasurements.primary.size.y) : null,
        yScale: toFixedNumber(object3D.scale.y)
      });
      return true;
    },

    enforceEnvelope: function (source) {
      var object3D = this.el && this.el.object3D;
      if (!object3D) {
        return false;
      }

      var toleranceRatio = Math.max(0.001, this.data.containmentToleranceRatio);
      var damping = clamp(this.data.containmentDamping, 0.8, 0.999);
      var maxIterations = Math.max(1, this.data.containmentMaxIterations);
      var minPlanar = clamp(this.data.minPlanarOccupancyRatio, 0.05, 0.98);
      var minHeight = clamp(this.data.minHeightOccupancyRatio, 0.05, 0.95);
      var changed = false;

      for (var i = 0; i < maxIterations; i += 1) {
        var measurements = this.measureBounds();
        if (!measurements || !isFiniteBoundsInfo(measurements.primary) || !isFiniteBoundsInfo(measurements.full)) {
          this.warnInvalidTransform('envelope-invalid-bounds', { source: source || 'unknown', iteration: i });
          return changed;
        }

        var primary = measurements.primary;
        var full = measurements.full;
        if (primary.size.x <= 0 || primary.size.y <= 0 || primary.size.z <= 0) {
          return changed;
        }

        var xRatio = primary.size.x / this.data.targetWidth;
        var zRatio = primary.size.z / this.data.targetDepth;
        var yRatio = primary.size.y / this.data.targetHeight;
        var planarRatio = Math.min(xRatio, zRatio);
        var fullWidthLimit = this.data.targetWidth + this.data.pedestalTopPadding;
        var fullDepthLimit = this.data.targetDepth + this.data.pedestalTopPadding;
        var xzFactor = 1;
        var yFactor = 1;
        var desiredUpscale = 1;
        var maxSafeUpscale = Math.min(
          full.size.x > 0 ? fullWidthLimit / full.size.x : Number.POSITIVE_INFINITY,
          full.size.z > 0 ? fullDepthLimit / full.size.z : Number.POSITIVE_INFINITY
        );

        if (planarRatio < (minPlanar - toleranceRatio)) {
          desiredUpscale = minPlanar / Math.max(planarRatio, 0.00001);
        }

        var primaryPlanarOverflow = Math.max(
          primary.size.x / Math.max(this.data.targetWidth, 0.00001),
          primary.size.z / Math.max(this.data.targetDepth, 0.00001)
        );
        var fullPlanarOverflow = Math.max(
          full.size.x / Math.max(fullWidthLimit, 0.00001),
          full.size.z / Math.max(fullDepthLimit, 0.00001)
        );

        if (primaryPlanarOverflow > (1 + toleranceRatio) || fullPlanarOverflow > (1 + toleranceRatio)) {
          xzFactor = Math.min(
            this.data.targetWidth / Math.max(primary.size.x, 0.00001),
            this.data.targetDepth / Math.max(primary.size.z, 0.00001),
            fullWidthLimit / Math.max(full.size.x, 0.00001),
            fullDepthLimit / Math.max(full.size.z, 0.00001)
          );
        } else if (desiredUpscale > 1.0005) {
          if (desiredUpscale > (maxSafeUpscale + toleranceRatio)) {
            this.warnMinimumCompromised({
              source: source || 'unknown',
              desiredUpscale: toFixedNumber(desiredUpscale),
              maxSafeUpscale: toFixedNumber(maxSafeUpscale),
              primaryWidth: toFixedNumber(primary.size.x),
              primaryDepth: toFixedNumber(primary.size.z),
              fullWidth: toFixedNumber(full.size.x),
              fullDepth: toFixedNumber(full.size.z)
            });
          }
          xzFactor = Math.min(desiredUpscale, Math.max(1, maxSafeUpscale));
        }

        if (yRatio > (1 + toleranceRatio)) {
          yFactor = this.data.targetHeight / Math.max(primary.size.y, 0.00001);
        } else if (yRatio < (minHeight - toleranceRatio)) {
          yFactor = (this.data.targetHeight * minHeight) / Math.max(primary.size.y, 0.00001);
        }

        xzFactor = softenFactor(xzFactor, damping);
        yFactor = softenFactor(yFactor, damping);

        var localChanged = false;
        if (Math.abs(xzFactor - 1) > 0.0005 || Math.abs(yFactor - 1) > 0.0005) {
          localChanged = this.applyScaleFactors(
            clamp(xzFactor, 0.2, 4),
            clamp(yFactor, 0.2, 4)
          );
        }

        var nextMeasurements = this.measureBounds();
        var moved = nextMeasurements ? this.applyAnchorPlacement(nextMeasurements) : false;
        changed = changed || localChanged || moved;

        if (!localChanged && !moved) {
          break;
        }
      }

      if (changed) {
        object3D.updateMatrixWorld(true);
        this.syncTransformAttributes();
        debugTable('envelope-adjusted', [{
          source: source || 'unknown',
          scaleX: toFixedNumber(object3D.scale.x),
          scaleY: toFixedNumber(object3D.scale.y),
          scaleZ: toFixedNumber(object3D.scale.z)
        }]);
      }

      return changed;
    },

    runMaintenancePass: function (source) {
      var changedHeight = this.enforceHeightBand(source);
      var changedEnvelope = this.enforceEnvelope(source);
      var measurements = this.measureBounds();
      var moved = measurements ? this.applyAnchorPlacement(measurements) : false;
      if (changedHeight || changedEnvelope || moved) {
        this.syncTransformAttributes();
      }
      return changedHeight || changedEnvelope || moved;
    },

    stopStabilizationLoop: function () {
      if (this.stabilizationTimer) {
        clearTimeout(this.stabilizationTimer);
        this.stabilizationTimer = null;
      }
      this.stabilizationChecksRemaining = 0;
      this.stabilizationStableCount = 0;
    },

    startStabilizationWindow: function (reason) {
      this.stopStabilizationLoop();
      this.stabilizationChecksRemaining = Math.max(1, this.data.stabilizationMaxChecks || DEFAULTS.stabilizationMaxChecks);
      this.stabilizationStableCount = 0;
      this.scheduleStabilizationStep(reason || 'normalize');
    },

    scheduleStabilizationStep: function (reason) {
      var self = this;
      if (this.stabilizationChecksRemaining <= 0) {
        return;
      }
      this.stabilizationTimer = setTimeout(function () {
        self.stabilizationTimer = null;
        self.runStabilizationStep(reason || 'stabilization');
      }, Math.max(50, this.data.stabilizationCheckMs || DEFAULTS.stabilizationCheckMs));
    },

    runStabilizationStep: function (reason) {
      if (!this.data.enabled || !this.normalized || !this.el || !this.el.object3D) {
        this.stopStabilizationLoop();
        return;
      }

      var changed = this.runMaintenancePass(reason || 'stabilization');
      var measurements = this.measureBounds();
      var signature = measurements ? buildMeasurementSignature(measurements, this.el.object3D) : null;

      if (changed || !signature || signature !== this.lastMeasurementSignature) {
        this.stabilizationStableCount = 0;
      } else {
        this.stabilizationStableCount += 1;
      }

      this.lastMeasurementSignature = signature;
      this.stabilizationChecksRemaining -= 1;

      debugLog('stabilization-step', {
        reason: reason || 'stabilization',
        changed: changed,
        remaining: this.stabilizationChecksRemaining,
        stableCount: this.stabilizationStableCount
      });

      if (this.stabilizationChecksRemaining <= 0 || this.stabilizationStableCount >= Math.max(1, this.data.stabilizationStablePasses || DEFAULTS.stabilizationStablePasses)) {
        this.stopStabilizationLoop();
        return;
      }

      this.scheduleStabilizationStep(reason || 'stabilization');
    },

    renormalize: function (reason) {
      this.normalized = false;
      this.retryCount = 0;
      this.stopStabilizationLoop();
      if (this.el && this.el.object3D) {
        this.el.object3D.visible = false;
      }
      this.tryNormalize(reason || 'manual-renormalize');
    },

    tryNormalize: function (reason) {
      var el = this.el;
      var three = root.THREE || (root.AFRAME && root.AFRAME.THREE);
      if (!el || !el.object3D || !three || !three.Box3 || !three.Vector3) {
        this.scheduleRetry('missing-three-or-object');
        return;
      }

      if (!el.object3D.children || !el.object3D.children.length) {
        this.scheduleRetry('waiting-object3d-children');
        return;
      }

      if (this.retryTimer) {
        clearTimeout(this.retryTimer);
        this.retryTimer = null;
      }

      this.ensureBaseScale();
      this.resetToBaseScale();

      var initialMeasurements = this.measureBounds();
      if (!initialMeasurements || !isFiniteBoundsInfo(initialMeasurements.primary) || initialMeasurements.primary.size.x <= 0 || initialMeasurements.primary.size.y <= 0 || initialMeasurements.primary.size.z <= 0) {
        this.scheduleRetry('non-positive-size');
        return;
      }

      var planarFactor = computePlanarFitFactor(initialMeasurements.primary.size, this.data.targetWidth, this.data.targetDepth);
      if (!Number.isFinite(planarFactor) || planarFactor <= 0) {
        this.scheduleRetry('invalid-planar-factor');
        return;
      }

      el.object3D.scale.set(
        this.baseScale.x * planarFactor,
        this.baseScale.y * planarFactor,
        this.baseScale.z * planarFactor
      );
      el.object3D.updateMatrixWorld(true);

      var fittedMeasurements = this.measureBounds();
      if (!fittedMeasurements || !isFiniteBoundsInfo(fittedMeasurements.primary)) {
        this.scheduleRetry('invalid-fitted-bounds');
        return;
      }

      if (fittedMeasurements.primary.size.y > this.data.targetHeight) {
        var heightFactor = this.data.targetHeight / Math.max(fittedMeasurements.primary.size.y, 0.00001);
        if (!Number.isFinite(heightFactor) || heightFactor <= 0) {
          this.scheduleRetry('invalid-y-factor');
          return;
        }
        el.object3D.scale.y = clamp(
          el.object3D.scale.y * heightFactor,
          Math.max(0.001, this.data.yScaleMin),
          Math.max(this.data.yScaleMin + 0.001, this.data.yScaleMax)
        );
        el.object3D.updateMatrixWorld(true);
        fittedMeasurements = this.measureBounds();
        if (!fittedMeasurements || !isFiniteBoundsInfo(fittedMeasurements.primary)) {
          this.scheduleRetry('invalid-fitted-bounds-after-y');
          return;
        }
      }

      this.applyAnchorPlacement(fittedMeasurements);

      for (var pass = 0; pass < 4; pass += 1) {
        var changed = this.runMaintenancePass('normalize:' + pass);
        if (!changed) {
          break;
        }
      }

      if (!isFiniteVector3Like(el.object3D.position) || !isFiniteVector3Like(el.object3D.scale)) {
        this.scheduleRetry('invalid-final-transform');
        return;
      }

      this.syncTransformAttributes();
      this.normalized = true;
      this.nextContainmentCheckAt = 0;
      this.lastMeasurementSignature = buildMeasurementSignature(this.measureBounds(), el.object3D);
      el.object3D.visible = true;

      var finalMeasurements = this.measureBounds();
      if (finalMeasurements) {
        debugTable('normalized-chart', [{
          reason: reason || 'normalize',
          primaryWidth: toFixedNumber(finalMeasurements.primary.size.x),
          primaryHeight: toFixedNumber(finalMeasurements.primary.size.y),
          primaryDepth: toFixedNumber(finalMeasurements.primary.size.z),
          fullWidth: toFixedNumber(finalMeasurements.full.size.x),
          fullHeight: toFixedNumber(finalMeasurements.full.size.y),
          fullDepth: toFixedNumber(finalMeasurements.full.size.z),
          targetWidth: this.data.targetWidth,
          targetHeight: this.data.targetHeight,
          targetDepth: this.data.targetDepth
        }]);
      }

      this.startStabilizationWindow(reason || 'normalize');
    },

    scheduleRetry: function (reason) {
      this.retryCount += 1;
      if (this.retryCount > this.data.retries) {
        if (this.el.object3D) {
          this.el.object3D.visible = true;
        }
        console.warn('[CodeXR][ChartPedestal] Could not normalize after retries:', {
          reason: reason,
          retries: this.retryCount - 1,
          approxWaitMs: (this.retryCount - 1) * this.data.retryDelayMs
        });
        return;
      }

      if (this.retryTimer) {
        clearTimeout(this.retryTimer);
      }

      var self = this;
      var backoffDelay = Math.min(
        this.data.retryDelayMs + (this.retryCount * 20),
        Math.max(this.data.retryDelayMs, 420)
      );
      debugLog('retry-normalize', {
        reason: reason,
        retryCount: this.retryCount,
        delayMs: backoffDelay
      });
      this.retryTimer = setTimeout(function () {
        self.tryNormalize(reason);
      }, backoffDelay);
    }
  };

  AFRAME.registerComponent(COMPONENT_NAME, componentDefinition);
  if (!AFRAME.components[LEGACY_COMPONENT_NAME]) {
    AFRAME.registerComponent(LEGACY_COMPONENT_NAME, componentDefinition);
  }

  root[RUNTIME_GLOBAL_NAME] = root[RUNTIME_GLOBAL_NAME] || {};
  root[RUNTIME_GLOBAL_NAME].renormalizeAll = function (reason) {
    var doc = root.document;
    if (!doc || !doc.querySelectorAll) {
      return 0;
    }

    var charts = doc.querySelectorAll('[' + COMPONENT_NAME + '],[' + LEGACY_COMPONENT_NAME + ']');
    var count = 0;
    charts.forEach(function (chartEl) {
      var component = chartEl.components && (chartEl.components[COMPONENT_NAME] || chartEl.components[LEGACY_COMPONENT_NAME]);
      if (component && typeof component.renormalize === 'function') {
        component.renormalize(reason || 'runtime-request');
        count += 1;
      }
    });
    return count;
  };
  root[RUNTIME_GLOBAL_NAME].enableDebug = function () {
    DEBUG_STATE.enabled = true;
    return true;
  };
  root[RUNTIME_GLOBAL_NAME].disableDebug = function () {
    DEBUG_STATE.enabled = false;
    return true;
  };
  root[RUNTIME_GLOBAL_NAME].setDebug = function (enabled) {
    DEBUG_STATE.enabled = !!enabled;
    return DEBUG_STATE.enabled;
  };
  root[RUNTIME_GLOBAL_NAME].isDebugEnabled = function () {
    return !!DEBUG_STATE.enabled;
  };
  root[RUNTIME_GLOBAL_NAME].__testing = {
    matchesIgnoredBoundsMeta: matchesIgnoredBoundsMeta,
    computePlanarFitFactor: computePlanarFitFactor,
    resolveHeightBandTargets: resolveHeightBandTargets,
    computeHeightBandScale: computeHeightBandScale,
    buildMeasurementSignature: buildMeasurementSignature,
    computeAnchorOffset: computeAnchorOffset
  };
  root[LEGACY_RUNTIME_GLOBAL_NAME] = root[RUNTIME_GLOBAL_NAME];

  root[DEBUG_GLOBAL_NAME] = root[DEBUG_GLOBAL_NAME] || {
    _els: [],

    _cleanup: function () {
      this._els.forEach(function (el) {
        if (el && el.parentNode) {
          el.parentNode.removeChild(el);
        }
      });
      this._els = [];
    },

    _mk: function (parent, tag, attrs) {
      var el = root.document.createElement(tag);
      Object.keys(attrs).forEach(function (key) {
        el.setAttribute(key, attrs[key]);
      });
      parent.appendChild(el);
      this._els.push(el);
      return el;
    },

    show: function (target) {
      this._cleanup();

      var selector = target || '[' + COMPONENT_NAME + ']';
      var chart = typeof selector === 'string' ? root.document.querySelector(selector) : selector;
      if (!chart) {
        console.warn('[CodeXR][ChartBands] Chart not found for target:', selector);
        return null;
      }

      var component = chart.components && (chart.components[COMPONENT_NAME] || chart.components[LEGACY_COMPONENT_NAME]);
      if (!component) {
        console.warn('[CodeXR][ChartBands] chart pedestal component not found on target.');
        return null;
      }

      var measurements = component.measureBounds();
      if (!measurements) {
        console.warn('[CodeXR][ChartBands] Could not measure chart bounds.');
        return null;
      }

      var d = component.data;
      var scene = chart.sceneEl || root.document.querySelector('a-scene');
      if (!scene) {
        console.warn('[CodeXR][ChartBands] Scene not found.');
        return null;
      }

      var tableBottomY = d.anchorY + d.revealOffsetY;
      var bandTargets = resolveHeightBandTargets(d);

      this._mk(scene, 'a-box', {
        position: d.anchorX + ' ' + (tableBottomY + (d.targetHeight / 2)) + ' ' + d.anchorZ,
        width: d.targetWidth,
        height: d.targetHeight,
        depth: d.targetDepth,
        material: 'color: #2bb3ff; opacity: 0.12; transparent: true; wireframe: true',
        'class': 'babiaxraycasterclass'
      });

      this._mk(scene, 'a-plane', {
        position: d.anchorX + ' ' + (tableBottomY + bandTargets.minHeight) + ' ' + d.anchorZ,
        rotation: '-90 0 0',
        width: d.targetWidth,
        height: d.targetDepth,
        material: 'color: #22c55e; opacity: 0.22; transparent: true; side: double',
        'class': 'babiaxraycasterclass'
      });

      this._mk(scene, 'a-plane', {
        position: d.anchorX + ' ' + (tableBottomY + bandTargets.maxHeight) + ' ' + d.anchorZ,
        rotation: '-90 0 0',
        width: d.targetWidth,
        height: d.targetDepth,
        material: 'color: #ef4444; opacity: 0.22; transparent: true; side: double',
        'class': 'babiaxraycasterclass'
      });

      this._mk(scene, 'a-box', {
        position: measurements.primary.center.x + ' ' + measurements.primary.center.y + ' ' + measurements.primary.center.z,
        width: Math.max(0.01, measurements.primary.size.x),
        height: Math.max(0.01, measurements.primary.size.y),
        depth: Math.max(0.01, measurements.primary.size.z),
        material: 'color: #4ade80; opacity: 0.1; transparent: true; wireframe: true',
        'class': 'babiaxraycasterclass'
      });

      this._mk(scene, 'a-box', {
        position: measurements.full.center.x + ' ' + measurements.full.center.y + ' ' + measurements.full.center.z,
        width: Math.max(0.01, measurements.full.size.x),
        height: Math.max(0.01, measurements.full.size.y),
        depth: Math.max(0.01, measurements.full.size.z),
        material: 'color: #f59e0b; opacity: 0.1; transparent: true; wireframe: true',
        'class': 'babiaxraycasterclass'
      });

      console.table({
        chartId: chart.id || '(no-id)',
        targetWidth: d.targetWidth,
        targetDepth: d.targetDepth,
        targetHeight: d.targetHeight,
        primaryWidth: toFixedNumber(measurements.primary.size.x),
        primaryHeight: toFixedNumber(measurements.primary.size.y),
        primaryDepth: toFixedNumber(measurements.primary.size.z),
        fullWidth: toFixedNumber(measurements.full.size.x),
        fullHeight: toFixedNumber(measurements.full.size.y),
        fullDepth: toFixedNumber(measurements.full.size.z),
        bandMin: toFixedNumber(bandTargets.minHeight),
        bandMax: toFixedNumber(bandTargets.maxHeight),
        yScale: chart.object3D && chart.object3D.scale ? toFixedNumber(chart.object3D.scale.y) : null
      });

      return {
        chart: chart,
        measurements: measurements,
        band: bandTargets,
        envelope: { width: d.targetWidth, depth: d.targetDepth, height: d.targetHeight }
      };
    },

    hide: function () {
      this._cleanup();
      return true;
    }
  };
  root[LEGACY_DEBUG_GLOBAL_NAME] = root[DEBUG_GLOBAL_NAME];
})(typeof window !== 'undefined' ? window : this);
