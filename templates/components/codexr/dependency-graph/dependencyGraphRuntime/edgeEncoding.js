// == dependencyGraphRuntime.js | edgeEncoding (assembled per manifest.json; see COMPONENTS.md) ==
  // Single source of truth for the edge visual-encoding domain: palettes,
  // occurrence buckets, per-edge styling, the encoding catalogue shown on the
  // "Edges:" cycle button, and the declarative legend each mode renders.

  var EDGE_ENCODINGS = ['relation-type', 'intensity-color', 'intensity-width', 'intensity-combined'];
  var RELATION_COLORS = {
    import: '#67e8f9', include: '#22d3ee', require: '#60a5fa',
    inheritance: '#e879f9', implementation: '#c084fc', call: '#f59e0b',
    contains: '#a3e635'
  };
  // Compact forms that fit under a legend swatch chip.
  var RELATION_SHORT_LABELS = {
    import: 'import', include: 'include', require: 'require',
    inheritance: 'inherit', implementation: 'implem', call: 'call',
    contains: 'contain'
  };
  var INTENSITY_COLORS = ['#67e8f9', '#38bdf8', '#818cf8', '#f59e0b', '#f97316'];
  var INTENSITY_BUCKET_LABELS = ['1', '2-3', '4-7', '8-15', '16+'];
  var FALLBACK_INTENSITY_WIDTHS = [.006, .009, .013, .018, .024];
  var FALLBACK_CONFIDENCE_OPACITY = { exact: .78, probable: .52, ambiguous: .28 };

  var EDGE_ENCODING_DEFS = {
    'relation-type': {
      label: 'Relation type',
      help: 'Edge colour identifies the relation kind (see the filter chips); width is constant.'
    },
    'intensity-color': {
      label: 'Intensity color',
      help: 'Edge colour encodes how often the relation occurs.'
    },
    'intensity-width': {
      label: 'Intensity width',
      help: 'Edge width encodes occurrences; colour still identifies the relation kind.'
    },
    'intensity-combined': {
      label: 'Color + width',
      help: 'Colour and width both encode how often the relation occurs.'
    }
  };

  function intensityBucket(occurrences) {
    var value = Math.max(1, Number(occurrences || 1));
    return value >= 16 ? 4 : value >= 8 ? 3 : value >= 4 ? 2 : value >= 2 ? 1 : 0;
  }

  function edgeStyle(edge, encoding, visualBudget) {
    var bucket = intensityBucket(edge?.occurrences);
    var useIntensityColor = encoding === 'intensity-color' || encoding === 'intensity-combined';
    var useIntensityWidth = encoding === 'intensity-width' || encoding === 'intensity-combined';
    var widths = visualBudget?.widths || FALLBACK_INTENSITY_WIDTHS;
    var defaultWidth = widths[1] || widths[0] || .006;
    return {
      bucket: bucket,
      color: useIntensityColor
        ? INTENSITY_COLORS[bucket]
        : (RELATION_COLORS[edge?.kind] || RELATION_COLORS.import),
      width: useIntensityWidth ? widths[bucket] : defaultWidth,
      opacity: root.CodeXRDependencyVisualBudgetRuntime?.opacityFor?.(
        visualBudget?.effectiveProfile || 'balanced',
        edge?.confidence || 'probable',
        false
      ) || FALLBACK_CONFIDENCE_OPACITY[edge?.confidence] || FALLBACK_CONFIDENCE_OPACITY.probable
    };
  }

  // Declarative legend for the active encoding. Modes that colour by relation
  // kind (relation-type, intensity-width) show one swatch per kind; the
  // intensity-coloured modes show the 5-bucket occurrence ramp with bars that
  // grow like the widths do.
  function edgeEncodingLegend(encoding) {
    if (encoding === 'intensity-color' || encoding === 'intensity-combined') {
      return {
        type: 'ramp',
        entries: INTENSITY_COLORS.map(function (color, index) {
          return {
            color: color,
            label: INTENSITY_BUCKET_LABELS[index],
            barHeight: .035 + (index * .018)
          };
        })
      };
    }
    return {
      type: 'swatches',
      entries: RELATIONS.map(function (kind) {
        return {
          color: RELATION_COLORS[kind] || RELATION_COLORS.import,
          label: RELATION_SHORT_LABELS[kind] || kind,
          barHeight: .07
        };
      })
    };
  }
