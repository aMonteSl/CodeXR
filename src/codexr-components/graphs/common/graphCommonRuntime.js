(function registerCodeXRGraphCommonRuntime(root) {
  'use strict';

  var RAYCAST_CLASS = 'babiaxraycasterclass';
  var DEFAULT_PALETTE = [
    '#22d3ee', '#60a5fa', '#a78bfa', '#f472b6', '#fb7185',
    '#f97316', '#facc15', '#34d399', '#2dd4bf', '#c084fc'
  ];

  function doc() {
    return root.document || null;
  }

  function createEntity(tagName, attributes) {
    var element = doc()?.createElement(tagName || 'a-entity');
    Object.keys(attributes || {}).forEach(function (key) {
      element.setAttribute(key, attributes[key]);
    });
    return element;
  }

  function text(value, position, width, color, align) {
    return createEntity('a-text', {
      value: value || '',
      position: position || '0 0 0',
      width: width || 3,
      align: align || 'center',
      color: color || '#f8fafc',
      'wrap-count': 46,
      side: 'double',
      shader: 'msdf'
    });
  }

  function compactText(value, maximum) {
    var normalized = String(value ?? '').replace(/\s+/g, ' ').trim();
    var limit = Math.max(4, Number(maximum) || 48);
    return normalized.length > limit ? normalized.slice(0, limit - 3) + '...' : normalized;
  }

  function normalizePath(value) {
    return String(value || '')
      .replace(/\\/g, '/')
      .replace(/\/+/g, '/')
      .replace(/^\.\//, '')
      .replace(/^\/+/, '')
      .trim();
  }

  function numberOr(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : (fallback || 0);
  }

  function hashColor(value, palette) {
    var key = String(value ?? 'unknown');
    var colors = Array.isArray(palette) && palette.length ? palette : DEFAULT_PALETTE;
    var hash = 0;
    for (var i = 0; i < key.length; i += 1) {
      hash = ((hash << 5) - hash) + key.charCodeAt(i);
      hash |= 0;
    }
    return colors[Math.abs(hash) % colors.length];
  }

  function lerp(a, b, ratio) {
    return a + (b - a) * ratio;
  }

  function colorFromGradient(ratio, from, to) {
    var start = from || [34, 211, 238];
    var end = to || [249, 115, 22];
    var clamped = Math.max(0, Math.min(1, Number(ratio) || 0));
    return '#' + [0, 1, 2].map(function (index) {
      return Math.round(lerp(start[index], end[index], clamped)).toString(16).padStart(2, '0');
    }).join('');
  }

  function attachEvents(target, handlers) {
    if (!target || !handlers) { return; }
    if (handlers.enter) { target.addEventListener('mouseenter', handlers.enter); }
    if (handlers.leave) { target.addEventListener('mouseleave', handlers.leave); }
    if (handlers.click) {
      target.addEventListener('click', function (event) {
        event.stopPropagation?.();
        handlers.click(event);
      });
    }
  }

  function hitboxGeometry(options) {
    var shape = String(options?.shape || 'sphere');
    var radius = Math.max(0.04, Number(options?.radius) || 0.12);
    var diameter = radius * 2.25;
    if (shape === 'box' || shape === 'portal' || shape === 'cube' || shape === 'district') {
      return 'primitive: box; width: ' + Math.max(diameter, Number(options?.width) || diameter)
        + '; height: ' + Math.max(diameter, Number(options?.height) || diameter)
        + '; depth: ' + Math.max(diameter, Number(options?.depth) || diameter);
    }
    if (shape === 'cylinder' || shape === 'short-cylinder') {
      return 'primitive: cylinder; radius: ' + (radius * 1.15)
        + '; height: ' + Math.max(diameter, Number(options?.height) || diameter)
        + '; segmentsRadial: 16';
    }
    return 'primitive: sphere; radius: ' + (radius * 1.35) + '; segmentsWidth: 16; segmentsHeight: 10';
  }

  function attachPickHitbox(parent, options) {
    if (!parent || !doc()) { return null; }
    var hitbox = createEntity('a-entity', {
      class: String(options?.className || RAYCAST_CLASS),
      'data-codexr-interactive': 'true',
      'data-codexr-role': 'hitbox',
      geometry: hitboxGeometry(options),
      material: 'color: #ffffff; opacity: 0.001; transparent: true; shader: flat; depthWrite: false'
    });
    if (options?.position) { hitbox.setAttribute('position', options.position); }
    attachEvents(hitbox, options?.handlers);
    parent.appendChild(hitbox);
    return hitbox;
  }

  function createTooltip(options) {
    var opts = options || {};
    var tooltipRoot = createEntity('a-entity', {
      visible: false,
      'data-codexr-role': 'tooltip'
    });
    var background = createEntity('a-plane', {
      width: opts.width || 3.25,
      height: opts.height || 1.42,
      material: 'color: #0f172a; opacity: .94; transparent: true; shader: flat; side: double'
    });
    var accent = createEntity('a-plane', {
      position: '0 .66 .014',
      width: opts.width || 3.25,
      height: .08,
      material: 'color: ' + (opts.accentColor || '#f59e0b') + '; shader: flat; side: double'
    });
    var title = text('', '0 .43 .018', 3, '#fcd34d', 'center');
    var subtitle = text('', '0 .15 .018', 2.95, '#cbd5e1', 'center');
    var primary = text('', '0 -.14 .018', 2.95, '#f8fafc', 'center');
    var secondary = text('', '0 -.41 .018', 2.95, '#94a3b8', 'center');
    tooltipRoot.appendChild(background);
    tooltipRoot.appendChild(accent);
    tooltipRoot.appendChild(title);
    tooltipRoot.appendChild(subtitle);
    tooltipRoot.appendChild(primary);
    tooltipRoot.appendChild(secondary);

    var api = {
      root: tooltipRoot,
      background: background,
      accent: accent,
      title: title,
      subtitle: subtitle,
      primary: primary,
      secondary: secondary,
      action: null,
      show: function (detail, position) {
        var model = detail || {};
        title.setAttribute('value', compactText(model.title, 42));
        subtitle.setAttribute('value', compactText(model.subtitle || model.body, 60));
        primary.setAttribute('value', compactText(model.primary || model.footer, 68));
        secondary.setAttribute('value', compactText(model.secondary || '', 68));
        if (model.accentColor) {
          accent.setAttribute('material', 'color: ' + model.accentColor + '; shader: flat; side: double');
        }
        if (position && root.THREE && typeof position.x === 'number') {
          tooltipRoot.object3D.position.copy(position);
        } else if (typeof position === 'string') {
          tooltipRoot.setAttribute('position', position);
        }
        tooltipRoot.setAttribute('visible', true);
      },
      hide: function () {
        tooltipRoot.setAttribute('visible', false);
      },
      faceCamera: function (camera) {
        if (!camera || !root.THREE || tooltipRoot.getAttribute('visible') === false) { return; }
        var cameraPosition = new root.THREE.Vector3();
        camera.getWorldPosition(cameraPosition);
        tooltipRoot.object3D.lookAt(cameraPosition);
      }
    };
    return api;
  }

  function resolveMetricScale(records, field, options) {
    var opts = options || {};
    var values = (Array.isArray(records) ? records : []).map(function (record) {
      return numberOr(record && record[field], NaN);
    }).filter(Number.isFinite);
    var min = Number.isFinite(opts.min) ? Number(opts.min) : Math.min.apply(Math, values.concat([0]));
    var max = Number.isFinite(opts.max) ? Number(opts.max) : Math.max.apply(Math, values.concat([1]));
    if (max <= min) { max = min + 1; }
    var range = max - min;
    return {
      field: field,
      min: min,
      max: max,
      range: range,
      normalize: function (value) {
        return Math.max(0, Math.min(1, (numberOr(value, min) - min) / range));
      },
      scale: function (value, outputMin, outputMax) {
        return lerp(numberOr(outputMin, 0), numberOr(outputMax, 1), this.normalize(value));
      }
    };
  }

  function animateTransform(element, target, options) {
    if (!element || !target) { return; }
    var opts = options || {};
    var duration = Number(opts.duration || 420);
    var easing = opts.easing || 'easeOutCubic';
    Object.keys(target).forEach(function (property) {
      var value = target[property];
      if (value === undefined || value === null) { return; }
      var name = 'animation__codexr_' + property.replace(/[^a-z0-9]/gi, '_');
      element.setAttribute(name, 'property: ' + property + '; to: ' + value + '; dur: ' + duration + '; easing: ' + easing);
    });
  }

  root.CodeXRGraphCommonRuntime = {
    createEntity: createEntity,
    entity: createEntity,
    attachPickHitbox: attachPickHitbox,
    createTooltip: createTooltip,
    createBillboardTooltip: createTooltip,
    resolveMetricScale: resolveMetricScale,
    animateTransform: animateTransform,
    compactText: compactText,
    normalizePath: normalizePath,
    hashColor: hashColor,
    colorFromGradient: colorFromGradient,
    palette: DEFAULT_PALETTE.slice(),
    __testing: {
      hitboxGeometry: hitboxGeometry,
      normalizePath: normalizePath,
      compactText: compactText,
      resolveMetricScale: resolveMetricScale,
      colorFromGradient: colorFromGradient
    }
  };
})(typeof window !== 'undefined' ? window : this);
