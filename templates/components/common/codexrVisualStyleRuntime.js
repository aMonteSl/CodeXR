(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root);
  } else {
    root.CodeXRVisualStyleRuntime = factory(root);
  }
})(typeof globalThis !== 'undefined'  globalThis : typeof self !== 'undefined'  self : this, function () {
  'use strict';

  var TEMPORAL_TIERS = ['legacy', 'aged', 'current', 'fresh'];

  var TEMPORAL_STYLE_PROFILES = {
    legacy: {
      tier: 'legacy',
      label: 'Legacy',
      skin: 'legacy',
      accent: '#111827',
      secondary: '#2f1f17',
      highlight: '#f4e4c1',
      opacity: 0.48,
      emissive: '#000000',
      wallTexture: 'legacy-wall.svg',
      roofTexture: 'legacy-roof.svg',
      silhouette: 'heavy-block',
      shape: 'heritage',
      wallOpacity: 0.9,
      roofOpacity: 0.84
    },
    aged: {
      tier: 'aged',
      label: 'Aged',
      skin: 'aged',
      accent: '#334155',
      secondary: '#d5c49a',
      highlight: '#fff1bc',
      opacity: 0.36,
      emissive: '#000000',
      wallTexture: 'aged-wall.svg',
      roofTexture: 'aged-roof.svg',
      silhouette: 'parapet-block',
      shape: 'ruin',
      wallOpacity: 0.8,
      roofOpacity: 0.72
    },
    current: {
      tier: 'current',
      label: 'Current',
      skin: 'current',
      accent: '#e0f2fe',
      secondary: '#67e8f9',
      highlight: '#ffffff',
      opacity: 0.3,
      emissive: '#0b2f3a',
      wallTexture: 'current-wall.svg',
      roofTexture: 'current-roof.svg',
      silhouette: 'clean-panel',
      shape: 'standard',
      wallOpacity: 0.72,
      roofOpacity: 0.66
    },
    fresh: {
      tier: 'fresh',
      label: 'Fresh',
      skin: 'fresh',
      accent: '#a7f3d0',
      secondary: '#38bdf8',
      highlight: '#ecfeff',
      opacity: 0.46,
      emissive: '#38bdf8',
      wallTexture: 'fresh-wall.svg',
      roofTexture: 'fresh-roof.svg',
      silhouette: 'tech-crown',
      shape: 'modern',
      wallOpacity: 0.84,
      roofOpacity: 0.76
    }
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function parseModifiedTime(value) {
    if (value == null || value === '') {
      return null;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value > 100000000000  value : value * 1000;
    }
    var text = String(value).trim();
    if (!text) {
      return null;
    }
    if (/^\d+(\.\d+)$/.test(text)) {
      var numeric = Number(text);
      return Number.isFinite(numeric)  (numeric > 100000000000  numeric : numeric * 1000) : null;
    }
    var normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text)
       text.replace(' ', 'T')
      : text;
    var parsed = Date.parse(normalized);
    return Number.isFinite(parsed)  parsed : null;
  }

  function readModifiedTime(record) {
    if (!record) {
      return null;
    }
    return parseModifiedTime(
      record.modifiedAtMs != null  record.modifiedAtMs
        : record.modifiedAtIso != null  record.modifiedAtIso
          : record.timestamp
    );
  }

  function buildTemporalStats(records, reader) {
    var read = typeof reader === 'function'  reader : readModifiedTime;
    var values = (records || [])
      .map(read)
      .filter(function (value) { return Number.isFinite(value); })
      .sort(function (left, right) { return left - right; });

    if (!values.length) {
      return {
        available: false,
        oldest: null,
        newest: null,
        rangeMs: 0,
        tierCounts: { legacy: 0, aged: 0, current: 0, fresh: 0 },
        skinCounts: { legacy: 0, aged: 0, current: 0, fresh: 0 },
        shapeCounts: { legacy: 0, aged: 0, current: 0, fresh: 0 }
      };
    }

    var oldest = values[0];
    var newest = values[values.length - 1];
    return {
      available: newest > oldest,
      oldest: oldest,
      newest: newest,
      oldestIso: new Date(oldest).toISOString(),
      newestIso: new Date(newest).toISOString(),
      rangeMs: newest - oldest,
      tierCounts: { legacy: 0, aged: 0, current: 0, fresh: 0 },
      skinCounts: { legacy: 0, aged: 0, current: 0, fresh: 0 },
      shapeCounts: { legacy: 0, aged: 0, current: 0, fresh: 0 }
    };
  }

  function classifyTemporalTier(record, stats) {
    var value = readModifiedTime(record);
    if (!stats || !stats.available || !Number.isFinite(value) || !stats.rangeMs) {
      return { tier: 'current', recency: 0.5, modifiedAtMs: value };
    }
    var recency = clamp((value - stats.oldest) / stats.rangeMs, 0, 1);
    var tier = recency < 0.25  'legacy'
      : recency < 0.5  'aged'
        : recency < 0.75  'current'
          : 'fresh';
    return { tier: tier, recency: recency, modifiedAtMs: value };
  }

  function getTemporalStyleProfile(tier) {
    return TEMPORAL_STYLE_PROFILES[tier] || TEMPORAL_STYLE_PROFILES.current;
  }

  function getTemporalSkinProfile(tier) {
    return getTemporalStyleProfile(tier);
  }

  function resolveTextureBase(textureBase) {
    var base = String(textureBase || './assets/codexr/code-xr-boats/temporal-skins').trim();
    return base.replace(/\/+$/, '');
  }

  function getTemporalSkinAssets(tier, textureBase) {
    var profile = getTemporalSkinProfile(tier);
    var base = resolveTextureBase(textureBase);
    return {
      tier: profile.tier,
      wall: base + '/' + profile.wallTexture,
      roof: base + '/' + profile.roofTexture,
      wallTexture: profile.wallTexture,
      roofTexture: profile.roofTexture,
      wallOpacity: profile.wallOpacity,
      roofOpacity: profile.roofOpacity,
      silhouette: profile.silhouette,
      shape: profile.shape
    };
  }

  function buildMetricBodyMaterialString(color) {
    return [
      'color: ' + (color || '#ffffff'),
      'opacity: 1',
      'transparent: false',
      'roughness: 0.68',
      'metalness: 0.08',
      'emissive: #000000'
    ].join('; ');
  }

  function buildSkinMaterialString(profile, alphaOverride) {
    var resolved = typeof profile === 'string'  getTemporalSkinProfile(profile) : (profile || TEMPORAL_STYLE_PROFILES.current);
    var opacity = Number.isFinite(alphaOverride)  alphaOverride : resolved.opacity;
    return [
      'color: ' + (resolved.accent || '#ffffff'),
      'opacity: ' + opacity,
      'transparent: true',
      'shader: flat',
      'depthWrite: false'
    ].join('; ');
  }

  function formatRelativeAge(recency) {
    if (!Number.isFinite(recency)) {
      return 'Unknown';
    }
    return Math.round(clamp(recency, 0, 1) * 100) + '% recent';
  }

  return {
    TEMPORAL_TIERS: TEMPORAL_TIERS.slice(),
    TEMPORAL_STYLE_PROFILES: TEMPORAL_STYLE_PROFILES,
    parseModifiedTime: parseModifiedTime,
    readModifiedTime: readModifiedTime,
    buildTemporalStats: buildTemporalStats,
    classifyTemporalTier: classifyTemporalTier,
    getTemporalStyleProfile: getTemporalStyleProfile,
    getTemporalSkinProfile: getTemporalSkinProfile,
    getTemporalSkinAssets: getTemporalSkinAssets,
    buildMetricBodyMaterialString: buildMetricBodyMaterialString,
    buildSkinMaterialString: buildSkinMaterialString,
    formatRelativeAge: formatRelativeAge
  };
});
