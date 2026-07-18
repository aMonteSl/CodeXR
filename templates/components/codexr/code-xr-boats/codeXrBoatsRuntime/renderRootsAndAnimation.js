// == codeXrBoatsRuntime.js | renderRootsAndAnimation (assembled per manifest.json; see COMPONENTS.md) ==
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
    rootEl.setAttribute?.('visible', !!visible);
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
      .replace(/\{height\}/g, String(figure.heightValue || ''))
      .replace(/\{farea\}/g, options.areaField)
      .replace(/\{area\}/g, String(figure.areaValue || ''))
      .replace(/\{fcolor\}/g, options.colorField)
      .replace(/\{color\}/g, String(figure.colorValue || ''));
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
      x: Number.isFinite(parts[0]) ? parts[0] : (fallback ? fallback.x : 0),
      y: Number.isFinite(parts[1]) ? parts[1] : (fallback ? fallback.y : 0),
      z: Number.isFinite(parts[2]) ? parts[2] : (fallback ? fallback.z : 0)
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
    var widthGuard = baseWidth > 0 ? clamp(baseWidth * 0.14, 0.06, 0.85) : 0;
    var depthGuard = baseDepth > 0 ? clamp(baseDepth * 0.14, 0.06, 0.85) : 0;
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
    var replacement = (text.trim() ? '; ' : '') + property + ': ' + value;
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
    var value = match ? Number(match[1]) : NaN;
    return Number.isFinite(value) ? value : fallback;
  }
