// == analysisTableRuntime.js | geometryUtils (assembled per manifest.json; see COMPONENTS.md) ==
  function toFixedNumber(value) {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Number(value.toFixed(3));
  }

  function toTransformNumber(value) {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Number(value.toFixed(6));
  }

  function clamp(value, minValue, maxValue) {
    return Math.max(minValue, Math.min(maxValue, value));
  }

  // True when the entity is actually on screen: its own object3D is visible and
  // so is every ancestor (a parked analysis root hides the whole subtree).
  function isObject3DVisibleInScene(el) {
    var object3D = el && el.object3D;
    if (!object3D) {
      return false;
    }
    for (var node = object3D; node; node = node.parent) {
      if (node.visible === false) {
        return false;
      }
    }
    return true;
  }

  function midpoint(minValue, maxValue) {
    return minValue + ((maxValue - minValue) / 2);
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

  function hasPositiveSize(size) {
    return !!size
      && Number.isFinite(size.x)
      && Number.isFinite(size.y)
      && Number.isFinite(size.z)
      && size.x > 0
      && size.y > 0
      && size.z > 0;
  }

  function hasUsableMeasurements(measurements) {
    return !!measurements
      && isFiniteBoundsInfo(measurements.primary)
      && isFiniteBoundsInfo(measurements.containment)
      && isFiniteBoundsInfo(measurements.full)
      && hasPositiveSize(measurements.primary.size);
  }

  function cloneScale(object3D) {
    return {
      x: object3D.scale.x,
      y: object3D.scale.y,
      z: object3D.scale.z
    };
  }

  function cloneTransform(object3D) {
    if (!object3D || !isFiniteVector3Like(object3D.position) || !isFiniteVector3Like(object3D.scale)) {
      return null;
    }

    return {
      position: {
        x: object3D.position.x,
        y: object3D.position.y,
        z: object3D.position.z
      },
      scale: {
        x: object3D.scale.x,
        y: object3D.scale.y,
        z: object3D.scale.z
      },
      visible: object3D.visible !== false
    };
  }

  function formatVector3Like(value) {
    return toTransformNumber(value.x) + ' ' + toTransformNumber(value.y) + ' ' + toTransformNumber(value.z);
  }

  function transformsDiffer(a, b) {
    if (!a || !b || !isFiniteVector3Like(a.position) || !isFiniteVector3Like(a.scale) || !isFiniteVector3Like(b.position) || !isFiniteVector3Like(b.scale)) {
      return false;
    }
    return Math.abs(a.position.x - b.position.x) > 0.0005
      || Math.abs(a.position.y - b.position.y) > 0.0005
      || Math.abs(a.position.z - b.position.z) > 0.0005
      || Math.abs(a.scale.x - b.scale.x) > 0.0005
      || Math.abs(a.scale.y - b.scale.y) > 0.0005
      || Math.abs(a.scale.z - b.scale.z) > 0.0005;
  }

  function restoreTransform(object3D, snapshot) {
    if (!object3D || !snapshot || !isFiniteVector3Like(snapshot.position) || !isFiniteVector3Like(snapshot.scale)) {
      return false;
    }

    object3D.position.set(snapshot.position.x, snapshot.position.y, snapshot.position.z);
    object3D.scale.set(snapshot.scale.x, snapshot.scale.y, snapshot.scale.z);
    object3D.visible = snapshot.visible !== false;
    object3D.updateMatrixWorld(true);
    return true;
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
    args.unshift('[CodeXR][AnalysisTable]');
    console.log.apply(console, args);
  }

  function debugTable(label, payload) {
    if (!DEBUG_STATE.enabled || typeof console.table !== 'function') {
      return;
    }
    console.log('[CodeXR][AnalysisTable] ' + label);
    console.table(payload);
  }

  function resizeTrace(label, payload) {
    if (!DEBUG_STATE.enabled) {
      return;
    }
    if (payload !== undefined) {
      console.log('[Re-size] ' + label, payload);
      return;
    }
    console.log('[Re-size] ' + label);
  }

  function collectNonFiniteValueIssues(value, path, issues, depth) {
    var targetIssues = issues || [];
    if (targetIssues.length >= 8 || depth > 4 || value === null || value === undefined) {
      return targetIssues;
    }

    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        targetIssues.push({
          path: path || 'value',
          value: String(value)
        });
      }
      return targetIssues;
    }

    if (typeof value === 'string') {
      if (/infinity|nan/i.test(value)) {
        targetIssues.push({
          path: path || 'value',
          value: value
        });
      }
      return targetIssues;
    }

    if (Array.isArray(value)) {
      value.slice(0, 12).forEach(function (item, index) {
        collectNonFiniteValueIssues(item, (path || 'value') + '[' + index + ']', targetIssues, depth + 1);
      });
      return targetIssues;
    }

    if (typeof value === 'object') {
      Object.keys(value).slice(0, 16).forEach(function (key) {
        collectNonFiniteValueIssues(value[key], (path ? path + '.' : '') + key, targetIssues, depth + 1);
      });
    }

    return targetIssues;
  }

  function inspectAxisAttributeValue(axisEl, attrName) {
    if (!axisEl || !attrName) {
      return null;
    }

    var attrValue = axisEl.getAttribute ? axisEl.getAttribute(attrName) : null;
    var issues = collectNonFiniteValueIssues(attrValue, attrName, [], 0);
    if ((!issues || issues.length === 0) && axisEl.components && axisEl.components[attrName]) {
      issues = collectNonFiniteValueIssues(axisEl.components[attrName].data, attrName + '.data', [], 0);
    }

    if (!issues || issues.length === 0) {
      return null;
    }

    return {
      reason: 'invalid-axis-length',
      attribute: attrName,
      elementId: axisEl.id || '',
      issues: issues
    };
  }

  function inspectInvalidAxisState(chartEl) {
    if (!chartEl || !chartEl.querySelectorAll) {
      return null;
    }

    var axisSelectors = ['babia-axis-x', 'babia-axis-y', 'babia-axis-z'];
    for (var selectorIndex = 0; selectorIndex < axisSelectors.length; selectorIndex += 1) {
      var attrName = axisSelectors[selectorIndex];
      var matches = chartEl.querySelectorAll('[' + attrName + ']');
      for (var matchIndex = 0; matchIndex < matches.length; matchIndex += 1) {
        var issue = inspectAxisAttributeValue(matches[matchIndex], attrName);
        if (issue) {
          return issue;
        }
      }
    }

    return null;
  }

  function entityMetaString(entity) {
    var classAttr = entity.getAttribute ? entity.getAttribute('class') : '';
    var attributeNames = entity.getAttributeNames ? entity.getAttributeNames() : [];
    return [
      entity.id || '',
      typeof classAttr === 'string' ? classAttr : '',
      entity.getAttribute ? (entity.getAttribute('data-name') || entity.getAttribute('name') || '') : '',
      entity.getAttribute ? (entity.getAttribute('data-codexr-role') || '') : '',
      Array.isArray(attributeNames) ? attributeNames.join(' ') : ''
    ].join(' ');
  }

  // Meta of the mesh's WHOLE ancestor entity chain up to (excluding) the chart
  // root. Babia nests its chrome: the legend container carries the
  // `babiaxrLegend` class, but its background plane is an anonymous child
  // entity — judging only the immediate owner let those meshes into the
  // measurement, and a `legend_lookat` billboard changes its world AABB as the
  // camera turns, which kept nudging the fit while the user moved around.
  function collectNodeMeta(node) {
    var parts = [];
    var tagName = '';
    var hasTextComponent = false;
    var current = node;
    var lastEntity = null;
    while (current) {
      var entity = current.el;
      if (entity && entity !== lastEntity) {
        if (
          (entity.components && entity.components[COMPONENT_NAME])
          || entity.tagName === 'A-SCENE'
        ) {
          break;
        }
        parts.push(entityMetaString(entity));
        if (!tagName && entity.tagName) {
          tagName = entity.tagName;
        }
        hasTextComponent = hasTextComponent || !!(entity.hasAttribute && TEXT_COMPONENT_KEYS.some(function (key) {
          return entity.hasAttribute(key);
        }));
        lastEntity = entity;
      }
      current = current.parent;
    }

    return {
      tagName: tagName,
      combined: parts.join(' '),
      nodeName: node && node.name ? String(node.name) : '',
      hasTextComponent: hasTextComponent
    };
  }

  function matchesAuxiliaryPattern(meta, pattern) {
    if (!meta) {
      return false;
    }

    if (String(meta.tagName || '').toLowerCase() === 'a-text') {
      return true;
    }

    if (meta.hasTextComponent) {
      return true;
    }

    return pattern.test([meta.combined || '', meta.nodeName || ''].join(' '));
  }

  function matchesIgnoredBoundsMeta(meta) {
    return matchesAuxiliaryPattern(meta, CONTENT_AUXILIARY_TOKEN_PATTERN);
  }

  function matchesIgnoredContainmentBoundsMeta(meta) {
    return matchesAuxiliaryPattern(meta, CONTAINMENT_AUXILIARY_TOKEN_PATTERN);
  }

  function shouldIgnoreNodeForContentBounds(node) {
    if (!node) {
      return false;
    }
    return matchesIgnoredBoundsMeta(collectNodeMeta(node));
  }

  function shouldIgnoreNodeForContainmentBounds(node) {
    if (!node) {
      return false;
    }
    return matchesIgnoredContainmentBoundsMeta(collectNodeMeta(node));
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

  function buildFilteredBounds(three, object3D, shouldIgnoreNode) {
    if (!three || !object3D || typeof object3D.traverse !== 'function') {
      return null;
    }

    var nodes = [];
    object3D.updateMatrixWorld(true);
    object3D.traverse(function (node) {
      if (!node || node.visible === false || !node.geometry) {
        return;
      }
      if (shouldIgnoreNode && shouldIgnoreNode(node)) {
        return;
      }
      nodes.push(node);
    });

    return buildBoundsFromNodes(three, nodes);
  }

  function buildContentBounds(three, object3D) {
    return buildFilteredBounds(three, object3D, shouldIgnoreNodeForContentBounds);
  }

  function buildContainmentBounds(three, object3D) {
    return buildFilteredBounds(three, object3D, shouldIgnoreNodeForContainmentBounds);
  }

  function buildRenderableBounds(three, object3D) {
    return buildFilteredBounds(three, object3D, null);
  }

  function shouldUseDerivedBounds(derivedBounds, referenceBounds) {
    if (!isFiniteBoundsInfo(derivedBounds) || !isFiniteBoundsInfo(referenceBounds)) {
      return !!derivedBounds;
    }

    if (derivedBounds.size.x <= 0.05 || derivedBounds.size.y <= 0.01 || derivedBounds.size.z <= 0.05) {
      return false;
    }

    var widthRatio = derivedBounds.size.x / Math.max(referenceBounds.size.x, 0.0001);
    var depthRatio = derivedBounds.size.z / Math.max(referenceBounds.size.z, 0.0001);

    if (widthRatio < 0.015 && depthRatio < 0.015) {
      return false;
    }

    return true;
  }

  function shouldUseContentBounds(contentBounds, fullBounds) {
    return shouldUseDerivedBounds(contentBounds, fullBounds);
  }

  function resolveHeightBandTargets(data) {
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

  function getTableTopY(data) {
    var surfaceOffset = Number.isFinite(data.tableTopSurfaceOffsetY)
      ? data.tableTopSurfaceOffsetY
      : DEFAULTS.tableTopSurfaceOffsetY;
    var epsilon = Number.isFinite(data.tabletopAnchorEpsilon)
      ? data.tabletopAnchorEpsilon
      : DEFAULTS.tabletopAnchorEpsilon;
    return (data.anchorY || 0) + surfaceOffset + Math.max(0, epsilon);
  }
