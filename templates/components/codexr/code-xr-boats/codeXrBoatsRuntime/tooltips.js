// == codeXrBoatsRuntime.js | tooltips (assembled per manifest.json; see COMPONENTS.md) ==
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
      AUX_CLASS + ' codexr-boats-tooltip' + (opts.pinned ? ' codexr-boats-tooltip-pinned' : '')
    );
    tooltip.root.setAttribute('data-codexr-role', opts.pinned ? 'tooltip overlay pinned' : 'tooltip overlay');
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
      primary: options.areaField + ': ' + String(figure.areaValue || '') + '  |  ' + options.heightField + ': ' + String(figure.heightValue || ''),
      secondary: options.colorField + ': ' + String(figure.colorValue || '') + '  |  visual height: ' + toFiniteNumber(figure.height, 0).toFixed(3),
      rows: [
        { label: 'Type', value: 'Building' },
        { label: options.areaField, value: String(figure.areaValue || '') },
        { label: options.heightField, value: String(figure.heightValue || '') },
        { label: options.colorField, value: String(figure.colorValue || '') },
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
    var peakY = bounds && Number.isFinite(bounds.max.y) ? bounds.max.y : null;
    var centerZ = bounds && Number.isFinite(bounds.min.z) && Number.isFinite(bounds.max.z)
      ? (bounds.min.z + bounds.max.z) * 0.5
      : null;
    var height = Math.max(0.1, Number(tooltipHeight) || 1.4);
    var position = parseVectorAttribute(entity && entity.getAttribute ? entity.getAttribute('position') : null, { x: 0, y: 0, z: 0 });
    var localAnchor = figure && figure.tooltipPosition
      ? {
        x: figure.tooltipPosition.x,
        y: Number.isFinite(peakY) ? peakY : figure.tooltipPosition.y,
        z: Number.isFinite(centerZ) ? centerZ : figure.tooltipPosition.z
      }
      : {
        x: position.x,
        y: Number.isFinite(peakY) ? peakY : position.y + Math.max(0.24, Number(figure && figure.height) || 0.24),
        z: Number.isFinite(centerZ) ? centerZ : position.z
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
      x: position.x + ((slot % 2 === 0 ? -1 : 1) * Math.min(1.15, 0.34 + (height * 0.18))),
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
    var position = parseVectorAttribute(entity && entity.getAttribute ? entity.getAttribute('position') : null, { x: 0, y: 0, z: 0 });
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
      state.charts[chartId].pinnedTooltipCount = component.getPinnedKeys ? component.getPinnedKeys().length : 0;
    }
  }
