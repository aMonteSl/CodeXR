// == analysisTableRuntime.js | tableDefinition (assembled per manifest.json; see COMPONENTS.md) ==
  var analysisTableDefinition = {
    schema: {
      mode: { default: 'single', oneOf: ['selection', 'single', 'historical-compare', 'project-evolution', 'dependency-graph'] },
      width: { type: 'number', default: 6.514 },
      depth: { type: 'number', default: 4.118 },
      anchorX: { type: 'number', default: DEFAULTS.anchorX },
      anchorY: { type: 'number', default: DEFAULTS.anchorY },
      anchorZ: { type: 'number', default: DEFAULTS.anchorZ },
      topThickness: { type: 'number', default: 0.14 },
      baseRadius: { type: 'number', default: 1.45 },
      baseHeight: { type: 'number', default: 0.78 }
    },

    init: function () {
      this.groupEl = root.document.createElement('a-entity');
      this.baseEl = root.document.createElement('a-cylinder');
      this.topEl = root.document.createElement('a-box');
      this.trimEl = root.document.createElement('a-box');
      this.leftZoneEl = root.document.createElement('a-box');
      this.rightZoneEl = root.document.createElement('a-box');
      this.dividerEl = root.document.createElement('a-box');
      this.anchorPlaneEl = root.document.createElement('a-plane');
      this.warningGroupEl = root.document.createElement('a-entity');
      this.warningTextEls = ['front', 'back', 'left', 'right'].map(function (edge) {
        var textEl = root.document.createElement('a-text');
        textEl.setAttribute('data-codexr-role', 'analysis-table-warning auxiliary');
        textEl.setAttribute('data-codexr-warning-edge', edge);
        textEl.setAttribute('align', 'center');
        textEl.setAttribute('baseline', 'center');
        textEl.setAttribute('width', 2.6);
        textEl.setAttribute('wrap-count', 28);
        return textEl;
      });

      this.groupEl.setAttribute('id', 'codexr-analysis-table-geometry');
      this.topEl.setAttribute('class', 'babiaxraycasterclass');
      this.baseEl.setAttribute('class', 'babiaxraycasterclass');
      this.anchorPlaneEl.setAttribute('id', 'codexr-analysis-table-anchor-plane');
      this.anchorPlaneEl.setAttribute('class', 'codexr-tabletop-anchor-plane codexr-analysis-table-debug');
      this.anchorPlaneEl.setAttribute('data-codexr-role', 'tabletop-anchor debug');
      this.anchorPlaneEl.setAttribute('visible', false);
      this.warningGroupEl.setAttribute('id', 'codexr-analysis-table-warning');
      this.warningGroupEl.setAttribute('data-codexr-role', 'analysis-table-warning auxiliary');
      this.warningGroupEl.setAttribute('visible', false);

      this.groupEl.appendChild(this.baseEl);
      this.groupEl.appendChild(this.trimEl);
      this.groupEl.appendChild(this.topEl);
      this.groupEl.appendChild(this.leftZoneEl);
      this.groupEl.appendChild(this.rightZoneEl);
      this.groupEl.appendChild(this.dividerEl);
      this.groupEl.appendChild(this.anchorPlaneEl);
      this.warningTextEls.forEach(function (textEl) {
        this.warningGroupEl.appendChild(textEl);
      }, this);
      this.groupEl.appendChild(this.warningGroupEl);
      this.el.appendChild(this.groupEl);

      this.refreshGeometry();
    },

    update: function () {
      this.refreshGeometry();
    },

    remove: function () {
      if (this.groupEl && this.groupEl.parentNode) {
        this.groupEl.parentNode.removeChild(this.groupEl);
      }
    },

    refreshGeometry: function () {
      if (!this.groupEl) {
        return;
      }
      var comparison = this.data.mode === 'historical-compare';
      var theme = MODE_THEME_BY_ID[this.data.mode] || MODE_THEME_BY_ID.single;
      var topY = this.data.anchorY - 0.15;
      var halfWidth = (this.data.width - 0.18) / 2;
      this.groupEl.setAttribute('position', this.data.anchorX + ' ' + topY + ' ' + this.data.anchorZ);

      this.topEl.setAttribute('width', this.data.width);
      this.topEl.setAttribute('height', this.data.topThickness);
      this.topEl.setAttribute('depth', this.data.depth);
      this.topEl.setAttribute(
        'material',
        theme.top
      );

      this.trimEl.setAttribute('width', this.data.width + 0.08);
      this.trimEl.setAttribute('height', 0.05);
      this.trimEl.setAttribute('depth', this.data.depth + 0.08);
      this.trimEl.setAttribute('position', '0 -0.085 0');
      this.trimEl.setAttribute(
        'material',
        theme.trim
      );

      this.baseEl.setAttribute('radius', this.data.baseRadius);
      this.baseEl.setAttribute('height', this.data.baseHeight);
      this.baseEl.setAttribute('position', '0 ' + (-(this.data.baseHeight / 2) - 0.07) + ' 0');
      this.baseEl.setAttribute(
        'material',
        theme.base
      );

      [
        { el: this.leftZoneEl, x: -(halfWidth / 2) - 0.045, color: '#256d85' },
        { el: this.rightZoneEl, x: (halfWidth / 2) + 0.045, color: '#2b8a66' }
      ].forEach(function (zone) {
        zone.el.setAttribute('visible', comparison);
        zone.el.setAttribute('width', halfWidth);
        zone.el.setAttribute('height', 0.018);
        zone.el.setAttribute('depth', Math.max(0.2, this.data.depth - 0.24));
        zone.el.setAttribute('position', zone.x + ' 0.082 0');
        zone.el.setAttribute('material', 'color: ' + zone.color + '; opacity: 0.42; transparent: true');
      }, this);

      this.dividerEl.setAttribute('visible', comparison);
      this.dividerEl.setAttribute('width', 0.05);
      this.dividerEl.setAttribute('height', 0.05);
      this.dividerEl.setAttribute('depth', this.data.depth - 0.18);
      this.dividerEl.setAttribute('position', '0 0.09 0');
      this.dividerEl.setAttribute('material', 'color: #b8f3ff; emissive: #246d7a; emissiveIntensity: 0.25');

      var anchorPlaneLocalY = getTableTopY({
        anchorY: this.data.anchorY,
        tableTopSurfaceOffsetY: DEFAULTS.tableTopSurfaceOffsetY,
        tabletopAnchorEpsilon: DEFAULTS.tabletopAnchorEpsilon
      }) - topY;
      this.anchorPlaneEl.setAttribute('position', '0 ' + anchorPlaneLocalY + ' 0');
      this.anchorPlaneEl.setAttribute('rotation', '-90 0 0');
      this.anchorPlaneEl.setAttribute('width', Math.max(0.01, this.data.width - 0.18));
      this.anchorPlaneEl.setAttribute('height', Math.max(0.01, this.data.depth - 0.18));
      this.anchorPlaneEl.setAttribute('material', 'color: #22d3ee; opacity: 0.26; transparent: true; side: double; shader: flat');

      var warningY = anchorPlaneLocalY + 0.085;
      var halfDepth = this.data.depth / 2;
      var halfWidth = this.data.width / 2;
      var warningPositions = {
        front: '0 ' + warningY + ' ' + (halfDepth - 0.18),
        back: '0 ' + warningY + ' ' + (-(halfDepth - 0.18)),
        left: (-(halfWidth - 0.18)) + ' ' + warningY + ' 0',
        right: (halfWidth - 0.18) + ' ' + warningY + ' 0'
      };
      var warningRotations = {
        front: '-35 0 0',
        back: '-35 180 0',
        left: '-35 90 0',
        right: '-35 -90 0'
      };
      this.warningTextEls.forEach(function (textEl) {
        var edge = textEl.getAttribute('data-codexr-warning-edge');
        textEl.setAttribute('position', warningPositions[edge] || warningPositions.front);
        textEl.setAttribute('rotation', warningRotations[edge] || warningRotations.front);
      });
    },

    setContainmentWarning: function (diagnostic) {
      if (!this.warningGroupEl || !this.warningTextEls) {
        return false;
      }
      var active = !!(diagnostic && diagnostic.level && diagnostic.level !== 'ok' && diagnostic.message);
      this.warningGroupEl.setAttribute('visible', active);
      if (!active) {
        return true;
      }
      var color = diagnostic.level === 'error' ? '#fecaca' : '#fde68a';
      var materialColor = diagnostic.level === 'error' ? '#dc2626' : '#d97706';
      this.warningTextEls.forEach(function (textEl) {
        textEl.setAttribute('value', diagnostic.message);
        textEl.setAttribute('color', color);
        textEl.setAttribute('material', 'color: ' + materialColor + '; opacity: 0.76; transparent: true; shader: flat');
      });
      return true;
    }
  };

  if (registerTable) {
    AFRAME.registerComponent(TABLE_COMPONENT_NAME, analysisTableDefinition);
  }
  if (registerContainment) {
    AFRAME.registerComponent(COMPONENT_NAME, componentDefinition);
  }
  function getContainmentCharts(doc) {
    if (!doc || !doc.querySelectorAll) {
      return [];
    }

    // Charts written in the generated HTML carry the component as a DOM
    // attribute; charts built at runtime (project evolution, historical
    // comparison) get it through setAttribute, which A-Frame does NOT mirror to
    // the DOM — those were invisible here, which is how a perfectly rendered
    // movie chart produced "No chart detected". applyContainmentProfile stamps
    // the data marker so both kinds are discoverable.
    var charts = doc.querySelectorAll('[' + COMPONENT_NAME + '], [' + CONTAINMENT_MARKER_ATTRIBUTE + ']');
    return Array.prototype.slice.call(charts || []);
  }

  function resolveContainmentComponentInfo(chartEl) {
    if (!chartEl) {
      return null;
    }

    var component = chartEl.components && chartEl.components[COMPONENT_NAME];
    if (!component) {
      return null;
    }

    return {
      chartEl: chartEl,
      component: component,
      attrName: COMPONENT_NAME,
      data: component.data || DEFAULTS
    };
  }
