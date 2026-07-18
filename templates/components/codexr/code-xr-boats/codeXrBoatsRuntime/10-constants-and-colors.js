// == codeXrBoatsRuntime.js | part 10: constants-and-colors (assembled with its siblings; see COMPONENTS.md) ==
(function (root, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory(root);
  } else {
    root.CodeXRBoatsRuntime = factory(root);
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function (root) {
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
    return Number.isFinite(parsed) ? parsed : fallback;
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
      return name.length ? name : DEFAULT_PALETTE;
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
    var text = String(value === undefined || value === null ? indexHint : value);
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
      mode: numeric ? 'numeric' : 'categorical',
      min: numericValues.length ? Math.min.apply(Math, numericValues) : 0,
      max: numericValues.length ? Math.max.apply(Math, numericValues) : 0,
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
        var opacity = Number.isFinite(alpha) ? alpha : (resolved.opacity || 0.3);
        return 'color: ' + (resolved.accent || '#ffffff') + '; opacity: ' + opacity + '; transparent: true; shader: flat; depthWrite: false';
      },
      formatRelativeAge: function (recency) {
        return Number.isFinite(recency) ? (Math.round(recency * 100) + '% recent') : 'Unknown';
      }
    };
  }
