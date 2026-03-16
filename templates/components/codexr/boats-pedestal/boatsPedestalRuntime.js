(function registerCodeXRBoatsPedestalComponent(root) {
  'use strict';

  var AFRAME = root.AFRAME;
  if (!AFRAME || !AFRAME.registerComponent || AFRAME.components['codexr-boats-pedestal']) {
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
    minPlanarOccupancyRatio: 0.82,
    minHeightOccupancyRatio: 0.68,
    buildingHeightBandEnabled: true,
    buildingHeightMinTarget: 0.42,
    buildingHeightMaxTarget: 1.22,
    buildingHeightToleranceRatio: 0.08,
    yScaleMin: 0.03,
    yScaleMax: 0.16,
    containmentToleranceRatio: 0.018,
    containmentDamping: 0.985,
    containmentMaxIterations: 8,
    containmentCheckMs: 700
  };

  function toFixedNumber(value) {
    return Number(value.toFixed(3));
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
    return {
      bounds: bounds,
      size: size,
      center: center
    };
  }

  function isBoatEntityNode(node) {
    return !!(node && typeof node.id === 'string' && node.id.indexOf('boat-') === 0);
  }

  function hasBoatDescendants(node) {
    if (!node || !node.querySelector) {
      return false;
    }
    return !!node.querySelector('[id^="boat-"]');
  }

  function clamp(value, minValue, maxValue) {
    return Math.max(minValue, Math.min(maxValue, value));
  }

  AFRAME.registerComponent('codexr-boats-pedestal', {
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
      buildingHeightBandEnabled: { default: DEFAULTS.buildingHeightBandEnabled },
      buildingHeightMinTarget: { type: 'number', default: DEFAULTS.buildingHeightMinTarget },
      buildingHeightMaxTarget: { type: 'number', default: DEFAULTS.buildingHeightMaxTarget },
      buildingHeightToleranceRatio: { type: 'number', default: DEFAULTS.buildingHeightToleranceRatio },
      yScaleMin: { type: 'number', default: DEFAULTS.yScaleMin },
      yScaleMax: { type: 'number', default: DEFAULTS.yScaleMax },
      containmentToleranceRatio: { type: 'number', default: DEFAULTS.containmentToleranceRatio },
      containmentDamping: { type: 'number', default: DEFAULTS.containmentDamping },
      containmentMaxIterations: { type: 'int', default: DEFAULTS.containmentMaxIterations },
      containmentCheckMs: { type: 'int', default: DEFAULTS.containmentCheckMs }
    },

    init: function () {
      this.retryCount = 0;
      this.retryTimer = null;
      this.pedestalEl = null;
      this.uiDockEl = null;
      this.normalized = false;
      this.nextContainmentCheckAt = 0;
      this.baseScale = null;
      this.nextMissingBandStatsWarnAt = 0;

      if (!this.data.enabled) {
        return;
      }

      this.ensureInitialPlacement();
      this.ensurePedestal();

      // Hide until final footprint normalization is done to avoid visible snapping.
      if (this.el.object3D) {
        this.el.object3D.visible = false;
      }

      this.tryNormalize();
    },

    update: function (oldData) {
      if (!oldData || !this.data.enabled) {
        return;
      }

      if (
        oldData.targetWidth !== this.data.targetWidth
        || oldData.targetHeight !== this.data.targetHeight
        || oldData.targetDepth !== this.data.targetDepth
        || oldData.anchorX !== this.data.anchorX
        || oldData.anchorY !== this.data.anchorY
        || oldData.anchorZ !== this.data.anchorZ
        || oldData.buildingHeightBandEnabled !== this.data.buildingHeightBandEnabled
        || oldData.buildingHeightMinTarget !== this.data.buildingHeightMinTarget
        || oldData.buildingHeightMaxTarget !== this.data.buildingHeightMaxTarget
        || oldData.buildingHeightToleranceRatio !== this.data.buildingHeightToleranceRatio
        || oldData.yScaleMin !== this.data.yScaleMin
        || oldData.yScaleMax !== this.data.yScaleMax
      ) {
        this.normalized = false;
        this.retryCount = 0;
        this.ensureInitialPlacement();
        this.refreshPedestalGeometry();
        if (this.el.object3D) {
          this.el.object3D.visible = false;
        }
        this.tryNormalize();
      }

      this.refreshUiDock();
    },

    tick: function (time) {
      if (!this.data.enabled || !this.normalized || !this.el || !this.el.object3D) {
        return;
      }

      if (time < this.nextContainmentCheckAt) {
        return;
      }

      this.nextContainmentCheckAt = time + Math.max(120, this.data.containmentCheckMs);
      this.enforceEnvelope('tick');
      if (this.enforceBuildingHeightBand('tick')) {
        this.enforceEnvelope('tick');
      }
    },

    remove: function () {
      if (this.retryTimer) {
        clearTimeout(this.retryTimer);
        this.retryTimer = null;
      }

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
      if (!sceneEl || !sceneEl.parentNode && sceneEl !== this.el.parentNode) {
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

    applyAnchorPlacement: function (boundsInfo) {
      var object3D = this.el && this.el.object3D;
      if (!object3D || !boundsInfo || !boundsInfo.center || !boundsInfo.bounds) {
        return false;
      }

      var centeredX = this.data.anchorX - boundsInfo.center.x;
      var centeredZ = this.data.anchorZ - boundsInfo.center.z;
      var seatedY = (this.data.anchorY + this.data.revealOffsetY) - boundsInfo.bounds.min.y;

      if (Math.abs(centeredX) < 0.0005 && Math.abs(centeredZ) < 0.0005 && Math.abs(seatedY) < 0.0005) {
        return false;
      }

      object3D.position.set(
        object3D.position.x + centeredX,
        object3D.position.y + seatedY,
        object3D.position.z + centeredZ
      );
      object3D.updateMatrixWorld(true);
      return true;
    },

    syncTransformAttributes: function () {
      var object3D = this.el && this.el.object3D;
      if (!object3D) {
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

    collectBuildingHeightStats: function () {
      var el = this.el;
      var three = root.THREE || (root.AFRAME && root.AFRAME.THREE);
      if (!el || !three || !three.Box3 || !three.Vector3 || !el.querySelectorAll) {
        return null;
      }

      var candidates = [];
      var allBoatNodes = el.querySelectorAll('[id^="boat-"]');
      allBoatNodes.forEach(function (node) {
        if (!isBoatEntityNode(node) || !node.object3D) {
          return;
        }
        if (!hasBoatDescendants(node)) {
          candidates.push(node);
        }
      });

      if (!candidates.length) {
        allBoatNodes.forEach(function (node) {
          if (isBoatEntityNode(node) && node.object3D) {
            candidates.push(node);
          }
        });
      }

      if (!candidates.length) {
        return null;
      }

      var minHeight = Number.POSITIVE_INFINITY;
      var maxHeight = 0;
      var inBandCount = 0;
      var minTarget = Math.max(0.01, this.data.buildingHeightMinTarget);
      var maxTarget = Math.max(minTarget + 0.01, this.data.buildingHeightMaxTarget);
      var tolerance = clamp(this.data.buildingHeightToleranceRatio, 0.0, 0.45);
      var bandMin = minTarget * (1 - tolerance);
      var bandMax = maxTarget * (1 + tolerance);

      for (var i = 0; i < candidates.length; i += 1) {
        var boundsInfo = buildBounds(three, candidates[i].object3D);
        var height = boundsInfo.size.y;
        if (!(height > 0)) {
          continue;
        }

        minHeight = Math.min(minHeight, height);
        maxHeight = Math.max(maxHeight, height);

        if (height >= bandMin && height <= bandMax) {
          inBandCount += 1;
        }
      }

      if (!isFinite(minHeight) || maxHeight <= 0) {
        return null;
      }

      return {
        minHeight: minHeight,
        maxHeight: maxHeight,
        inBandCount: inBandCount,
        candidateCount: candidates.length
      };
    },

    enforceBuildingHeightBand: function (source) {
      if (!this.data.buildingHeightBandEnabled || !this.el || !this.el.object3D) {
        return false;
      }

      var three = root.THREE || (root.AFRAME && root.AFRAME.THREE);
      if (!three || !three.Box3 || !three.Vector3) {
        return false;
      }

      var stats = this.collectBuildingHeightStats();
      if (!stats) {
        var now = Date.now();
        if (source !== 'tick' || now >= this.nextMissingBandStatsWarnAt) {
          console.warn('[CodeXR][BoatsPedestal] Missing building stats for band enforcement:', source || 'unknown');
          this.nextMissingBandStatsWarnAt = now + 5000;
        }
        return false;
      }

      var object3D = this.el.object3D;
      var minTarget = Math.max(0.01, this.data.buildingHeightMinTarget);
      var maxTarget = Math.max(minTarget + 0.01, this.data.buildingHeightMaxTarget);
      var tolerance = clamp(this.data.buildingHeightToleranceRatio, 0.0, 0.45);
      var yMin = Math.max(0.005, this.data.yScaleMin);
      var yMax = Math.max(yMin + 0.001, this.data.yScaleMax);
      var upperLimit = maxTarget * (1 + tolerance);
      var lowerLimit = minTarget * (1 - tolerance);
      var changed = false;
      var targetY = object3D.scale.y;

      if (stats.maxHeight > upperLimit) {
        var overRatio = stats.maxHeight / maxTarget;
        var desiredDown = 1 / Math.max(overRatio, 1.00001);
        var downStep = 1 - ((1 - desiredDown) * 0.75);
        targetY = object3D.scale.y * downStep;
      } else if (stats.inBandCount === 0 && stats.maxHeight < lowerLimit) {
        var requiredUpToBand = lowerLimit / Math.max(stats.maxHeight, 0.00001);
        var maxSafeUp = upperLimit / Math.max(stats.maxHeight, 0.00001);
        var desiredUp = Math.max(1, Math.min(requiredUpToBand, maxSafeUp));
        var conservativeUpscaleFloor = 1.015;
        var effectiveUp = Math.max(desiredUp, conservativeUpscaleFloor);
        if (effectiveUp > 1.001) {
          var upStep = 1 + ((effectiveUp - 1) * 0.65);
          targetY = object3D.scale.y * upStep;
        }
      }

      targetY = clamp(targetY, yMin, yMax);

      if (Math.abs(targetY - object3D.scale.y) > 0.0001) {
        object3D.scale.y = targetY;
        object3D.updateMatrixWorld(true);
        this.applyAnchorPlacement(buildBounds(three, object3D));
        changed = true;
      }

      if (source === 'tick' && changed) {
        console.log('[CodeXR][BoatsPedestal] Adjusted building height band:', {
          minBuildingHeight: toFixedNumber(stats.minHeight),
          maxBuildingHeight: toFixedNumber(stats.maxHeight),
          inBand: stats.inBandCount,
          yScale: toFixedNumber(object3D.scale.y)
        });
      }

      return changed;
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

    enforceEnvelope: function (source) {
      var el = this.el;
      var three = root.THREE || (root.AFRAME && root.AFRAME.THREE);
      if (!el || !el.object3D || !three || !three.Box3 || !three.Vector3) {
        return false;
      }

      var toleranceRatio = Math.max(0.001, this.data.containmentToleranceRatio);
      var damping = Math.min(0.999, Math.max(0.8, this.data.containmentDamping));
      var maxIterations = Math.max(1, this.data.containmentMaxIterations);
      var minPlanar = Math.max(0.05, Math.min(0.99, this.data.minPlanarOccupancyRatio));
      var minHeight = Math.max(0.05, Math.min(0.99, this.data.minHeightOccupancyRatio));
      var changed = false;

      for (var i = 0; i < maxIterations; i += 1) {
        var boundsInfo = buildBounds(three, el.object3D);
        var size = boundsInfo.size;
        if (size.x <= 0 || size.y <= 0 || size.z <= 0) {
          return changed;
        }

        var ratioX = size.x / this.data.targetWidth;
        var ratioY = size.y / this.data.targetHeight;
        var ratioZ = size.z / this.data.targetDepth;
        var worstRatio = Math.max(ratioX, ratioY, ratioZ);
        var smallestPlanarRatio = Math.min(ratioX, ratioZ);
        var overLimit = worstRatio > (1 + toleranceRatio);
        var underPlanarLimit = smallestPlanarRatio < (minPlanar - toleranceRatio);
        var underHeightLimit = ratioY < (minHeight - toleranceRatio);
        var underLimit = !overLimit && (underPlanarLimit || underHeightLimit);

        if (overLimit) {
          var correction = (1 / worstRatio) * damping;
          el.object3D.scale.set(
            el.object3D.scale.x * correction,
            el.object3D.scale.y * correction,
            el.object3D.scale.z * correction
          );
          el.object3D.updateMatrixWorld(true);
          changed = true;
        } else if (underLimit) {
          var planarTargetFactor = underPlanarLimit ? (minPlanar / Math.max(0.00001, smallestPlanarRatio)) : 1;
          var heightTargetFactor = underHeightLimit ? (minHeight / Math.max(0.00001, ratioY)) : 1;
          var desiredUpscale = Math.max(planarTargetFactor, heightTargetFactor, 1);
          var maxSafeUpscale = 1 / Math.max(worstRatio, 0.00001);
          var cappedUpscale = Math.min(desiredUpscale, maxSafeUpscale);
          var smoothUpscale = 1 + ((Math.max(1, cappedUpscale) - 1) * 0.6);

          if (smoothUpscale > 1.0005) {
            el.object3D.scale.set(
              el.object3D.scale.x * smoothUpscale,
              el.object3D.scale.y * smoothUpscale,
              el.object3D.scale.z * smoothUpscale
            );
            el.object3D.updateMatrixWorld(true);
            changed = true;
          }
        }

        var moved = this.applyAnchorPlacement((overLimit || underLimit) ? buildBounds(three, el.object3D) : boundsInfo);
        changed = changed || moved;

        if (!overLimit && !underLimit && !moved) {
          break;
        }
      }

      if (changed) {
        el.object3D.updateMatrixWorld(true);
        this.syncTransformAttributes();
      }

      if (source === 'tick' && changed) {
        var finalBounds = buildBounds(three, el.object3D);
        console.log('[CodeXR][BoatsPedestal] Recontained chart on periodic check:', {
          width: toFixedNumber(finalBounds.size.x),
          height: toFixedNumber(finalBounds.size.y),
          depth: toFixedNumber(finalBounds.size.z)
        });
      }

      return changed;
    },

    renormalize: function (reason) {
      this.normalized = false;
      this.retryCount = 0;
      if (this.el && this.el.object3D) {
        this.el.object3D.visible = false;
      }
      this.tryNormalize(reason || 'manual-renormalize');
    },

    tryNormalize: function () {
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

      this.ensureBaseScale();
      this.resetToBaseScale();

      var firstBounds = buildBounds(three, el.object3D);
      if (firstBounds.size.x <= 0 || firstBounds.size.y <= 0 || firstBounds.size.z <= 0) {
        this.scheduleRetry('non-positive-size');
        return;
      }

      var scaleSnapshot = cloneScale(el.object3D);
      var fitX = this.data.targetWidth / firstBounds.size.x;
      var fitZ = this.data.targetDepth / firstBounds.size.z;
      var planarFactor = Math.min(fitX, fitZ);

      el.object3D.scale.set(
        scaleSnapshot.x * planarFactor,
        scaleSnapshot.y * planarFactor,
        scaleSnapshot.z * planarFactor
      );
      el.object3D.updateMatrixWorld(true);

      var secondBounds = buildBounds(three, el.object3D);
      if (secondBounds.size.y > this.data.targetHeight) {
        var yFactor = this.data.targetHeight / secondBounds.size.y;
        el.object3D.scale.y = el.object3D.scale.y * yFactor;
        el.object3D.updateMatrixWorld(true);
        secondBounds = buildBounds(three, el.object3D);
      }

      this.applyAnchorPlacement(secondBounds);

      for (var pass = 0; pass < 3; pass += 1) {
        var changedBand = this.enforceBuildingHeightBand('normalize');
        var changedEnvelope = this.enforceEnvelope('normalize');
        var moved = this.applyAnchorPlacement(buildBounds(three, el.object3D));
        if (!changedBand && !changedEnvelope && !moved) {
          break;
        }
      }

      this.syncTransformAttributes();

      this.normalized = true;
      this.nextContainmentCheckAt = 0;
      el.object3D.visible = true;

      var finalBounds = buildBounds(three, el.object3D);
      console.log('[CodeXR][BoatsPedestal] Normalized boats chart footprint:', {
        width: toFixedNumber(finalBounds.size.x),
        height: toFixedNumber(finalBounds.size.y),
        depth: toFixedNumber(finalBounds.size.z),
        targetWidth: this.data.targetWidth,
        targetHeight: this.data.targetHeight,
        targetDepth: this.data.targetDepth
      });
    },

    scheduleRetry: function (reason) {
      this.retryCount += 1;
      if (this.retryCount > this.data.retries) {
        if (this.el.object3D) {
          this.el.object3D.visible = true;
        }
        console.warn('[CodeXR][BoatsPedestal] Could not normalize after retries:', {
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
      this.retryTimer = setTimeout(function () {
        self.tryNormalize();
      }, backoffDelay);
    }
  });

  root.CodeXRBoatsPedestalRuntime = root.CodeXRBoatsPedestalRuntime || {
    renormalizeAll: function (reason) {
      var doc = root.document;
      if (!doc || !doc.querySelectorAll) {
        return 0;
      }

      var charts = doc.querySelectorAll('[codexr-boats-pedestal]');
      var count = 0;
      charts.forEach(function (chartEl) {
        var component = chartEl.components && chartEl.components['codexr-boats-pedestal'];
        if (component && typeof component.renormalize === 'function') {
          component.renormalize(reason || 'runtime-request');
          count += 1;
        }
      });
      return count;
    }
  };

  root.CodeXRBoatsDebugBands = root.CodeXRBoatsDebugBands || {
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
      Object.keys(attrs).forEach(function (k) {
        el.setAttribute(k, attrs[k]);
      });
      parent.appendChild(el);
      this._els.push(el);
      return el;
    },

    _collectLeafBoatHeights: function (chartEl, three) {
      var nodes = chartEl.querySelectorAll('[id^="boat-"]');
      var leaves = [];

      nodes.forEach(function (n) {
        if (!n.querySelector('[id^="boat-"]')) {
          leaves.push(n);
        }
      });

      var candidates = leaves.length ? leaves : Array.prototype.slice.call(nodes);
      var box = new three.Box3();
      var size = new three.Vector3();
      var heights = [];

      candidates.forEach(function (n) {
        if (!n.object3D) {
          return;
        }
        box.setFromObject(n.object3D);
        box.getSize(size);
        if (size.y > 0) {
          heights.push(size.y);
        }
      });

      return heights;
    },

    show: function (target) {
      this._cleanup();

      var selector = target || '[codexr-boats-pedestal]';
      var chart = typeof selector === 'string' ? root.document.querySelector(selector) : selector;
      if (!chart) {
        console.warn('[CodeXR][BoatsBands] Chart not found for target:', selector);
        return null;
      }

      var component = chart.components && chart.components['codexr-boats-pedestal'];
      if (!component) {
        console.warn('[CodeXR][BoatsBands] codexr-boats-pedestal component not found on target.');
        return null;
      }

      var three = root.THREE || (root.AFRAME && root.AFRAME.THREE);
      if (!three || !three.Box3 || !three.Vector3) {
        console.warn('[CodeXR][BoatsBands] THREE not available.');
        return null;
      }

      var d = component.data;
      var scene = chart.sceneEl || root.document.querySelector('a-scene');
      if (!scene) {
        console.warn('[CodeXR][BoatsBands] Scene not found.');
        return null;
      }

      var ax = d.anchorX;
      var ay = d.anchorY;
      var az = d.anchorZ;
      var tableBottomY = ay + d.revealOffsetY;

      this._mk(scene, 'a-box', {
        position: ax + ' ' + (tableBottomY + (d.targetHeight / 2)) + ' ' + az,
        width: d.targetWidth,
        height: d.targetHeight,
        depth: d.targetDepth,
        material: 'color: #2bb3ff; opacity: 0.12; transparent: true; wireframe: true',
        'class': 'babiaxraycasterclass'
      });

      var hMin = Math.max(0.01, d.buildingHeightMinTarget || 0.42);
      var hMax = Math.max(hMin + 0.01, d.buildingHeightMaxTarget || 1.22);
      var tol = Math.max(0, Math.min(0.45, d.buildingHeightToleranceRatio || 0.08));
      var bandMin = hMin * (1 - tol);
      var bandMax = hMax * (1 + tol);

      this._mk(scene, 'a-plane', {
        position: ax + ' ' + (tableBottomY + bandMin) + ' ' + az,
        rotation: '-90 0 0',
        width: d.targetWidth,
        height: d.targetDepth,
        material: 'color: #22c55e; opacity: 0.22; transparent: true; side: double',
        'class': 'babiaxraycasterclass'
      });

      this._mk(scene, 'a-plane', {
        position: ax + ' ' + (tableBottomY + bandMax) + ' ' + az,
        rotation: '-90 0 0',
        width: d.targetWidth,
        height: d.targetDepth,
        material: 'color: #ef4444; opacity: 0.22; transparent: true; side: double',
        'class': 'babiaxraycasterclass'
      });

      var heights = this._collectLeafBoatHeights(chart, three);
      var minB = heights.length ? Math.min.apply(null, heights) : null;
      var maxB = heights.length ? Math.max.apply(null, heights) : null;
      var inBand = heights.filter(function (h) {
        return h >= bandMin && h <= bandMax;
      }).length;

      console.table({
        chartId: chart.id || '(no-id)',
        targetWidth: d.targetWidth,
        targetDepth: d.targetDepth,
        targetHeight: d.targetHeight,
        buildingHeightMinTarget: hMin,
        buildingHeightMaxTarget: hMax,
        buildingTolerance: tol,
        bandMin: bandMin,
        bandMax: bandMax,
        measuredMinBuildingHeight: minB,
        measuredMaxBuildingHeight: maxB,
        measuredInBandCount: inBand,
        measuredTotal: heights.length,
        yScale: chart.object3D && chart.object3D.scale ? chart.object3D.scale.y : null
      });

      return {
        chart: chart,
        measured: { minB: minB, maxB: maxB, inBand: inBand, total: heights.length },
        band: { bandMin: bandMin, bandMax: bandMax },
        envelope: { width: d.targetWidth, depth: d.targetDepth, height: d.targetHeight }
      };
    },

    hide: function () {
      this._cleanup();
      return true;
    }
  };
})(typeof window !== 'undefined' ? window : this);
