// == codexrLogoRuntime.js | codexrLogo (assembled per manifest.json; see COMPONENTS.md) ==
//
// The CodeXR mark, extruded in 3D, floating over the analysis table while the
// table is EMPTY — the `selection` mode the scene sits in between analyses
// (and during the transit hop while a heavy analysis is being prepared).
//
// It is decoration, and behaves like it: it carries no raycaster class so it
// can never swallow a click meant for the table, it lives outside
// #codexrAnalysisSurface so the selection sweep does not own it, and it goes
// completely still when the render budget says the frame rate (or the user's
// reduced-motion preference) cannot afford motion.

  var COMPONENT_NAME = 'codexr-logo';
  var TABLE_COMPONENT_NAME = 'codexr-analysis-table';
  var ANIMATION_PREFIX = 'animation__codexr_logo_';
  // Per-frame delta guard: a backgrounded tab resumes with a huge delta, and
  // an unclamped one would teleport the spin.
  var MAX_FRAME_DELTA_MS = 50;

  function getThree(root) {
    return (root.AFRAME && root.AFRAME.THREE) || root.THREE || null;
  }

  // Contours are flat [x0, y0, x1, y1, ...] lists normalized to width 1.
  function traceContour(target, contour, scale) {
    target.moveTo(contour[0] * scale, contour[1] * scale);
    for (var i = 2; i < contour.length; i += 2) {
      target.lineTo(contour[i] * scale, contour[i + 1] * scale);
    }
    target.closePath();
  }

  function buildShape(THREE, piece, scale) {
    var shape = new THREE.Shape();
    traceContour(shape, piece.outline, scale);
    (piece.holes || []).forEach(function (hole) {
      var path = new THREE.Path();
      traceContour(path, hole, scale);
      shape.holes.push(path);
    });
    return shape;
  }

  function buildPieceGeometry(THREE, piece, scale, thickness) {
    var geometry = new THREE.ExtrudeGeometry(buildShape(THREE, piece, scale), {
      depth: thickness,
      bevelEnabled: true,
      bevelThickness: thickness * 0.18,
      bevelSize: thickness * 0.12,
      bevelOffset: 0,
      bevelSegments: 2
    });
    // Extrude grows along +Z from the plane: recentre so the mark's own plane
    // stays at the entity origin and the assembly animation reads symmetric.
    geometry.translate(0, 0, -thickness / 2);
    return geometry;
  }

  function buildMaterials(THREE, data) {
    // ExtrudeGeometry emits two material groups: 0 = the caps, 1 = the walls
    // and bevel. That split is exactly the finish we want — graphite body,
    // brand-cyan edge catching the light.
    return [
      new THREE.MeshStandardMaterial({
        color: data.bodyColor,
        roughness: 0.45,
        metalness: 0.15
      }),
      new THREE.MeshStandardMaterial({
        color: data.accentColor,
        emissive: data.accentColor,
        emissiveIntensity: 0.6,
        roughness: 0.35,
        metalness: 0.1
      })
    ];
  }

  function registerComponent(AFRAME, root) {
    if (!AFRAME || AFRAME.components[COMPONENT_NAME]) {
      return;
    }

    AFRAME.registerComponent(COMPONENT_NAME, {
      schema: {
        // Same anchor the analysis table uses, so the mark tracks the table
        // instead of being positioned against the room.
        anchorX: { type: 'number', default: 0 },
        anchorY: { type: 'number', default: 1.58 },
        anchorZ: { type: 'number', default: -18 },
        width: { type: 'number', default: 1.8 },
        thickness: { type: 'number', default: 0.045 },
        bodyColor: { type: 'color', default: '#0b1220' },
        accentColor: { type: 'color', default: '#22d3ee' },
        // The table mode that means "no analysis loaded".
        activeMode: { type: 'string', default: 'selection' },
        tableSelector: { type: 'string', default: '#codexrAnalysisTable' },
        spinSpeed: { type: 'number', default: 0.18 },
        floatAmplitude: { type: 'number', default: 0.02 },
        floatSpeed: { type: 'number', default: 0.9 },
        assembleMs: { type: 'number', default: 280 }
      },

      init: function () {
        this.pieces = [];
        this.active = false;
        this.motionEnabled = true;
        this.elapsed = 0;
        this.hideTimer = null;
        this.tableEl = null;
        this.unsubscribeBudget = null;
        this.onTableComponentChanged = this.handleTableComponentChanged.bind(this);

        this.buildPieces();
        this.applyAnchor();
        this.el.setAttribute('visible', false);
        this.bindRenderBudget();
        this.bindTable();
        this.setActive(this.readTableMode() === this.data.activeMode, true);
      },

      update: function (oldData) {
        if (!oldData || !Object.keys(oldData).length) {
          return;
        }
        var rebuildKeys = ['width', 'thickness', 'bodyColor', 'accentColor'];
        var self = this;
        var needsRebuild = rebuildKeys.some(function (key) {
          return oldData[key] !== self.data[key];
        });
        if (needsRebuild) {
          this.disposePieces();
          this.buildPieces();
        }
        this.applyAnchor();
      },

      buildPieces: function () {
        var THREE = getThree(root);
        if (!THREE || !THREE.ExtrudeGeometry) {
          console.warn('[CodeXR][Logo] three.js is unavailable; the brand logo stays hidden.');
          return;
        }
        var data = this.data;
        var self = this;
        LOGO_PIECE_ORDER.forEach(function (name) {
          var contours = LOGO_CONTOURS[name];
          if (!contours) {
            return;
          }
          var geometry = buildPieceGeometry(THREE, contours, data.width, data.thickness);
          var materials = buildMaterials(THREE, data);
          var mesh = new THREE.Mesh(geometry, materials);
          var pieceEl = document.createElement('a-entity');
          pieceEl.setAttribute('data-codexr-logo-piece', name);
          self.el.appendChild(pieceEl);
          // setObject3D has to wait for A-Frame to give the entity its own
          // object3D; appendChild does that synchronously for a loaded scene,
          // but not while the scene is still initializing.
          if (pieceEl.hasLoaded) {
            pieceEl.setObject3D('mesh', mesh);
          } else {
            pieceEl.addEventListener('loaded', function () {
              pieceEl.setObject3D('mesh', mesh);
            }, { once: true });
          }
          self.pieces.push({ name: name, el: pieceEl, mesh: mesh });
        });
      },

      applyAnchor: function () {
        this.el.object3D.position.set(this.data.anchorX, this.data.anchorY, this.data.anchorZ);
      },

      getPiece: function (name) {
        for (var i = 0; i < this.pieces.length; i += 1) {
          if (this.pieces[i].name === name) {
            return this.pieces[i];
          }
        }
        return null;
      },

      // ── Table mode ──────────────────────────────────────────────────────
      // The table runtime writes its mode onto the table entity, and only on a
      // real change (analysisTableRuntime setMode), so A-Frame's own
      // componentchanged event is a precise, poll-free trigger.

      bindTable: function () {
        var table = document.querySelector(this.data.tableSelector);
        if (!table) {
          // The table entity is declared before this one, but a scene still
          // loading can hand us nothing: retry once the scene is up.
          var scene = this.el.sceneEl;
          var self = this;
          if (scene && !scene.hasLoaded) {
            scene.addEventListener('loaded', function () {
              self.bindTable();
              self.setActive(self.readTableMode() === self.data.activeMode, true);
            }, { once: true });
          }
          return;
        }
        this.tableEl = table;
        table.addEventListener('componentchanged', this.onTableComponentChanged);
      },

      handleTableComponentChanged: function (event) {
        if (!event || !event.detail || event.detail.name !== TABLE_COMPONENT_NAME) {
          return;
        }
        this.setActive(this.readTableMode() === this.data.activeMode, false);
      },

      readTableMode: function () {
        var table = this.tableEl || document.querySelector(this.data.tableSelector);
        if (!table || typeof table.getAttribute !== 'function') {
          return '';
        }
        var value = table.getAttribute(TABLE_COMPONENT_NAME);
        if (value && typeof value === 'object') {
          return String(value.mode || '');
        }
        // Before the table component initializes, the attribute is still the
        // raw declaration string.
        var match = /(?:^|;)\s*mode\s*:\s*([\w-]+)/.exec(String(value || ''));
        return match ? match[1] : '';
      },

      // ── Show / hide ─────────────────────────────────────────────────────

      setActive: function (active, immediate) {
        var next = !!active;
        if (next === this.active && !immediate) {
          return next;
        }
        this.active = next;
        this.clearHideTimer();
        this.clearAnimations();

        if (next) {
          this.el.setAttribute('visible', true);
          this.elapsed = 0;
          this.el.object3D.rotation.set(0, 0, 0);
          this.applyAnchor();
          this.assemble(immediate === true);
        } else if (immediate === true || !this.motionEnabled) {
          this.el.setAttribute('visible', false);
        } else {
          this.disassemble();
        }
        return next;
      },

      // Entry: the frame pops in and the letters slide into the visor from
      // either side. With motion disabled everything simply lands in place.
      assemble: function (immediate) {
        var frame = this.getPiece('frame');
        var offset = this.data.width * 0.9;

        this.setPiecePosition('x', 0, 0, 0);
        this.setPiecePosition('r', 0, 0, 0);
        if (frame) {
          frame.el.object3D.scale.set(1, 1, 1);
        }
        if (immediate || !this.motionEnabled) {
          return;
        }

        if (frame) {
          frame.el.object3D.scale.set(0.82, 0.82, 0.82);
          frame.el.setAttribute(ANIMATION_PREFIX + 'frame', {
            property: 'scale',
            from: '0.82 0.82 0.82',
            to: '1 1 1',
            dur: Math.round(this.data.assembleMs * 0.93),
            easing: 'easeOutCubic'
          });
        }
        this.animatePiece('x', -offset, 60);
        this.animatePiece('r', offset, 150);
      },

      // Exit: the same gesture, reversed, then the entity goes away.
      disassemble: function () {
        var frame = this.getPiece('frame');
        var offset = this.data.width * 0.9;
        var duration = Math.round(this.data.assembleMs * 0.75);
        var self = this;

        if (frame) {
          frame.el.setAttribute(ANIMATION_PREFIX + 'frame', {
            property: 'scale',
            from: '1 1 1',
            to: '0.82 0.82 0.82',
            dur: duration,
            easing: 'easeInCubic'
          });
        }
        this.animatePieceOut('x', -offset, duration);
        this.animatePieceOut('r', offset, duration);

        this.hideTimer = setTimeout(function () {
          self.hideTimer = null;
          self.el.setAttribute('visible', false);
          self.clearAnimations();
          // Park the pieces back at rest: a hidden object3D still reports its
          // bounds, and leaving the letters flung apart made the logo measure
          // three times its real width.
          self.setPiecePosition('x', 0, 0, 0);
          self.setPiecePosition('r', 0, 0, 0);
          var frameAtRest = self.getPiece('frame');
          if (frameAtRest) {
            frameAtRest.el.object3D.scale.set(1, 1, 1);
          }
        }, duration + 40);
      },

      animatePiece: function (name, fromX, delay) {
        var piece = this.getPiece(name);
        if (!piece) {
          return;
        }
        piece.el.object3D.position.set(fromX, 0, 0);
        piece.el.setAttribute(ANIMATION_PREFIX + name, {
          property: 'position',
          from: fromX + ' 0 0',
          to: '0 0 0',
          dur: this.data.assembleMs,
          delay: delay,
          easing: 'easeOutBack'
        });
      },

      animatePieceOut: function (name, toX, duration) {
        var piece = this.getPiece(name);
        if (!piece) {
          return;
        }
        piece.el.setAttribute(ANIMATION_PREFIX + name, {
          property: 'position',
          from: '0 0 0',
          to: toX + ' 0 0',
          dur: duration,
          easing: 'easeInCubic'
        });
      },

      setPiecePosition: function (name, x, y, z) {
        var piece = this.getPiece(name);
        if (piece) {
          piece.el.object3D.position.set(x, y, z);
        }
      },

      // ── Idle motion ─────────────────────────────────────────────────────

      tick: function (time, timeDelta) {
        if (!this.active || !this.motionEnabled) {
          return;
        }
        var delta = Math.min(MAX_FRAME_DELTA_MS, Math.max(0, timeDelta || 0)) / 1000;
        if (!delta) {
          return;
        }
        this.elapsed += delta;
        var object3D = this.el.object3D;
        object3D.rotation.y += this.data.spinSpeed * delta;
        object3D.position.y = this.data.anchorY
          + (Math.sin(this.elapsed * this.data.floatSpeed) * this.data.floatAmplitude);
      },

      bindRenderBudget: function () {
        var budget = root.CodeXRRenderBudgetRuntime;
        if (!budget || typeof budget.subscribe !== 'function') {
          return;
        }
        var self = this;
        // 'static' is both the low-frame-rate verdict and how the render
        // budget reports prefers-reduced-motion. Either way: no motion.
        this.unsubscribeBudget = budget.subscribe(function (snapshot) {
          var enabled = !snapshot || snapshot.quality !== 'static';
          if (enabled === self.motionEnabled) {
            return;
          }
          self.motionEnabled = enabled;
          if (!enabled && self.active) {
            self.clearAnimations();
            self.assemble(true);
            self.el.object3D.rotation.set(0, 0, 0);
            self.applyAnchor();
          }
        });
      },

      // ── Teardown ────────────────────────────────────────────────────────

      clearHideTimer: function () {
        if (this.hideTimer) {
          clearTimeout(this.hideTimer);
          this.hideTimer = null;
        }
      },

      clearAnimations: function () {
        this.pieces.forEach(function (piece) {
          if (piece.el && piece.el.removeAttribute) {
            piece.el.removeAttribute(ANIMATION_PREFIX + piece.name);
          }
        });
      },

      disposePieces: function () {
        this.clearAnimations();
        this.pieces.forEach(function (piece) {
          if (piece.el && piece.el.removeObject3D) {
            piece.el.removeObject3D('mesh');
          }
          if (piece.mesh) {
            if (piece.mesh.geometry) {
              piece.mesh.geometry.dispose();
            }
            var materials = Array.isArray(piece.mesh.material)
              ? piece.mesh.material
              : [piece.mesh.material];
            materials.forEach(function (material) {
              if (material && material.dispose) {
                material.dispose();
              }
            });
          }
          if (piece.el && piece.el.parentNode) {
            piece.el.parentNode.removeChild(piece.el);
          }
        });
        this.pieces = [];
      },

      remove: function () {
        this.clearHideTimer();
        if (this.tableEl && this.tableEl.removeEventListener) {
          this.tableEl.removeEventListener('componentchanged', this.onTableComponentChanged);
        }
        if (typeof this.unsubscribeBudget === 'function') {
          this.unsubscribeBudget();
          this.unsubscribeBudget = null;
        }
        this.disposePieces();
      }
    });
  }

  if (root.AFRAME) {
    registerComponent(root.AFRAME, root);
  } else if (root.addEventListener) {
    root.addEventListener('load', function () {
      registerComponent(root.AFRAME, root);
    });
  }

  // Test surface: the contour data and the pure geometry helpers, so the
  // shapes can be checked without a browser.
  root.CodeXRLogoRuntime = {
    __testing: {
      LOGO_CONTOURS: LOGO_CONTOURS,
      LOGO_PIECE_ORDER: LOGO_PIECE_ORDER,
      COMPONENT_NAME: COMPONENT_NAME,
      buildShape: buildShape,
      registerComponent: registerComponent
    }
  };
})(typeof window !== 'undefined' ? window : this);
