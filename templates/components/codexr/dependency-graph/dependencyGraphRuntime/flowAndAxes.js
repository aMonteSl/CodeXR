// == dependencyGraphRuntime.js | flowAndAxes (assembled per manifest.json; see COMPONENTS.md) ==
      ensureFlowLayer: function (capacity) {
        if (!root.THREE || capacity < 1) { return; }
        if (this.flowPositions && this.flowPositions.length >= capacity * 3) { return; }
        this.disposeFlowLayer();
        this.flowPositions = new Float32Array(capacity * 3);
        this.flowColors = new Float32Array(capacity * 3);
        this.flowGeometry = new root.THREE.BufferGeometry();
        this.flowGeometry.setAttribute('position', new root.THREE.BufferAttribute(this.flowPositions, 3));
        this.flowGeometry.setAttribute('color', new root.THREE.BufferAttribute(this.flowColors, 3));
        this.flowPoints = new root.THREE.Points(this.flowGeometry, new root.THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          vertexColors: true,
          uniforms: {
            pointSize: { value: this.visualBudget?.effectiveProfile === 'dense' ? 3 : 5 },
            pointScale: { value: 1 },
            opacity: { value: .88 }
          },
          vertexShader: [
            'varying vec3 vColor;',
            'uniform float pointSize;',
            'uniform float pointScale;',
            'void main() {',
            '  vColor = color;',
            '  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);',
            // True perspective attenuation for this scene's 2-15 unit viewing
            // range: base size at ~6 units, growing nearer / shrinking farther,
            // clamped in pixels so close-up particles stay tasteful. (The old
            // `80/max(40,dist)` was tuned for a far larger scale — below 40
            // units it pinned a constant pixel size, which read as particles
            // shrinking on approach relative to the perspective-scaled graph.)
            '  gl_PointSize = clamp(pointSize * pointScale * (6.0 / max(0.5, -mvPosition.z)), 1.0, 28.0);',
            '  gl_Position = projectionMatrix * mvPosition;',
            '}'
          ].join('\n'),
          fragmentShader: [
            'varying vec3 vColor;',
            'uniform float opacity;',
            'void main() {',
            '  vec2 p = gl_PointCoord - vec2(0.5);',
            '  float radial = 1.0 - smoothstep(0.16, 0.5, length(vec2(p.x * 0.72, p.y)));',
            '  float tail = smoothstep(-0.5, 0.42, p.x);',
            '  float alpha = radial * (0.3 + 0.7 * tail) * opacity;',
            '  if (alpha < 0.02) discard;',
            '  gl_FragColor = vec4(vColor, alpha);',
            '}'
          ].join('\n')
        }));
        this.flowPoints.frustumCulled = false;
        this.el.object3D.add(this.flowPoints);
      },
      disposeFlowLayer: function () {
        if (this.flowPoints) {
          this.flowPoints.parent?.remove?.(this.flowPoints);
          this.flowPoints.material?.dispose?.();
        }
        this.flowGeometry?.dispose?.();
        this.flowPoints = this.flowGeometry = this.flowPositions = this.flowColors = null;
      },
      activeFlowEdges: function () {
        if (this.flowQuality === 'static') { return []; }
        var records = Object.values(this.edgeRecords).filter(function (record) {
          return !record.remove && record.batch;
        });
        var active = records.filter(function (record) {
          return record.highlighted || this.isEdgeActive(record.data);
        }, this).sort(function (left, right) {
          return Number(right.data.occurrences || 1) - Number(left.data.occurrences || 1);
        });
        var effectiveProfile = this.visualBudget?.effectiveProfile || 'balanced';
        var limit = Number(this.visualBudget?.flowLimit || 40);
        if (effectiveProfile === 'dense' || this.visualBudget?.override === 'focus') {
          return active.slice(0, limit);
        }
        var ranked = records.slice().sort(function (left, right) {
          return Number(right.data.occurrences || 1) - Number(left.data.occurrences || 1);
        });
        var preferred = active.concat(ranked.filter(function (record) {
          return !active.includes(record);
        }));
        return preferred.slice(0, limit);
      },
      updateFlowVisibility: function () {
        if (this.flowPoints) {
          this.flowPoints.visible = this.flowQuality !== 'static';
          if (this.flowPoints.material?.uniforms?.pointSize) {
            this.flowPoints.material.uniforms.pointSize.value =
              this.visualBudget?.effectiveProfile === 'dense' ? 3
                : this.visualBudget?.effectiveProfile === 'balanced' ? 4 : 5;
          }
        }
        Object.values(this.edgeRecords).forEach(function (record) {
          if (!record.remove) { this.updateEdgeGeometry(record); }
        }, this);
        this.flushEdgeBatches();
      },
      updateFlow: function (timeDelta) {
        if (!root.THREE) { return; }
        var records = this.activeFlowEdges();
        if (!records.length) {
          if (this.flowGeometry) { this.flowGeometry.setDrawRange(0, 0); }
          this.lastFlowCount = 0;
          return;
        }
        this.ensureFlowLayer(records.length);
        // Room-shared particle preferences (validated by the server, defaults
        // applied in applySharedState). The phase clock accumulates with the
        // frame delta so a speed change re-paces the particles smoothly instead
        // of teleporting them (an absolute-time phase would jump).
        this.flowPoints.material.uniforms.pointScale.value =
          flowSizeOption(this.view?.flowSize).scale;
        this.flowClock = ((this.flowClock || 0)
          + (Math.max(0, Number(timeDelta) || 16) / 1000)
            * FLOW_BASE_SPEED
            * flowSpeedOption(this.view?.flowSpeed).multiplier) % 1;
        var selection = this.primarySelection ? this.primarySelection() : null;
        var count = 0;
        records.forEach(function (record, index) {
          var source = this.nodes[record.data.source]?.el?.object3D?.position;
          var target = this.nodes[record.data.target]?.el?.object3D?.position;
          if (!source || !target) { return; }
          var phase = (this.flowClock + ((index * .137) % 1)) % 1;
          var position = source.clone().lerp(target, phase);
          this.flowPositions[count * 3] = position.x;
          this.flowPositions[count * 3 + 1] = position.y;
          this.flowPositions[count * 3 + 2] = position.z;
          var color = new root.THREE.Color(record.style?.color || '#fcd34d');
          if (selection?.type === 'node') {
            color.set(record.data.source === selection.id ? '#22d3ee' : '#fbbf24');
          }
          this.flowColors[count * 3] = color.r;
          this.flowColors[count * 3 + 1] = color.g;
          this.flowColors[count * 3 + 2] = color.b;
          count += 1;
        }, this);
        this.flowGeometry.setDrawRange(0, count);
        this.flowGeometry.getAttribute('position').needsUpdate = true;
        this.flowGeometry.getAttribute('color').needsUpdate = true;
        this.flowPoints.visible = count > 0;
        this.lastFlowCount = count;
      },
      updateTransition: function (time, forceComplete) {
        if (!this.transition || !root.THREE) { return; }
        if (this.transition.startedAt === null) {
          this.transition.startedAt = time;
        }
        var duration = Math.max(0, Number(this.transition.duration || 0));
        var raw = forceComplete || duration === 0
          ? 1
          : Math.min(1, Math.max(0, (time - this.transition.startedAt) / duration));
        this.el.setAttribute('data-codexr-transition-progress', raw.toFixed(3));
        var progress = raw * raw * (3 - (2 * raw));
        this.graphTopY = GRAPH_BASE_Y + GRAPH_HEIGHT;
        this.transition.nodes.forEach(function (item) {
          item.record.el.object3D.position.lerpVectors(item.fromPosition, item.toPosition, progress);
          var scale = item.fromScale + ((item.toScale - item.fromScale) * progress);
          item.record.el.object3D.scale.setScalar(scale);
          var opacity = item.fromOpacity + ((item.toOpacity - item.fromOpacity) * progress);
          var color = item.fromColor.clone().lerp(item.toColor, progress);
          item.record.el.setAttribute('material', 'opacity', opacity);
          item.record.el.setAttribute('material', 'color', '#' + color.getHexString());
          item.record.el.setAttribute('material', 'transparent', opacity < 1);
          this.graphTopY = Math.max(
            this.graphTopY,
            item.record.el.object3D.position.y + Number(item.record.targetRadius || item.record.radius || 0)
          );
        }, this);
        Object.keys(this.edgeRecords).forEach(function (edgeId) {
          var record = this.edgeRecords[edgeId];
          this.updateEdgeGeometry(record);
        }, this);
        this.flushEdgeBatches();
        this.positionPinnedTooltip();
        if (raw < 1) {
          this.scheduleTransitionFrame();
          return;
        }

        this.transition.nodes.filter(function (item) { return item.remove; }).forEach(function (item) {
          item.record.el.remove?.();
          delete this.nodes[item.id];
        }, this);
        this.transition.nodes.filter(function (item) { return !item.remove; }).forEach(function (item) {
          var targetRadius = item.record.targetRadius || item.record.radius;
          if (item.record.shape === 'box' || item.record.shape === 'portal') {
            item.record.el.setAttribute('width', item.record.shape === 'portal' ? targetRadius * 2.8 : targetRadius * 1.7);
            item.record.el.setAttribute('height', item.record.shape === 'portal' ? targetRadius * 1.8 : targetRadius * 1.7);
            item.record.el.setAttribute('depth', item.record.shape === 'portal' ? targetRadius * .6 : targetRadius * 1.7);
          } else {
            item.record.el.setAttribute('radius', targetRadius);
          }
          item.record.radius = targetRadius;
          item.record.targetRadius = null;
          item.record.el.object3D.scale.setScalar(1);
        });
        Object.keys(this.edgeRecords).forEach(function (edgeId) {
          var record = this.edgeRecords[edgeId];
          if (!record.remove) { return; }
          record.el.remove?.();
          record.hitMesh.geometry?.dispose?.();
          record.hitMesh.material?.dispose?.();
          delete this.edgeRecords[edgeId];
        }, this);
        this.edgeObjects = Object.values(this.edgeRecords).flatMap(function (record) {
          return [record.hitMesh];
        });
        this.clearAxes();
        this.drawAxes();
        if (this.hasActiveSelection()) {
          // Nodes/edges may have vanished in the new layout; drop those pins and
          // re-place the surviving legends into their slots.
          this.prunePinnedSelections();
          this.relayoutLegends();
        }
        this.transition = null;
        this.transitionFrame = null;
        this.el.removeAttribute('data-codexr-transition-progress');
      },
      clearAxes: function () {
        (this.axisObjects || []).forEach(function (object) {
          object.parent?.remove?.(object);
          object.geometry?.dispose?.();
          object.material?.dispose?.();
        });
        this.axisObjects = [];
        this.axesRoot?.remove?.();
        this.axesRoot = null;
      },
      addAxisLine: function (start, end, color) {
        var geometry = new root.THREE.BufferGeometry().setFromPoints([start, end]);
        var line = new root.THREE.Line(geometry, new root.THREE.LineBasicMaterial({
          color: color, transparent: true, opacity: .9
        }));
        this.el.object3D.add(line);
        this.axisObjects.push(line);
        return line;
      },
      addAxisArrow: function (position, direction, color) {
        var geometry = new root.THREE.ConeGeometry(.055, .18, 8);
        var material = new root.THREE.MeshBasicMaterial({ color: color });
        var arrow = new root.THREE.Mesh(geometry, material);
        arrow.position.copy(position);
        arrow.quaternion.setFromUnitVectors(
          new root.THREE.Vector3(0, 1, 0),
          direction.clone().normalize()
        );
        this.el.object3D.add(arrow);
        this.axisObjects.push(arrow);
        return arrow;
      },
      addAxisLabel: function (value, position, color, width, align) {
        var label = text(value, position.x + ' ' + position.y + ' ' + position.z, width || 1.2, color, align || 'center');
        label.setAttribute('wrap-count', 24);
        this.axesRoot.appendChild(label);
        return label;
      },
      drawAxes: function () {
        if (!root.THREE) { return; }
        this.axesRoot = entity('a-entity', { 'data-codexr-dependency-axes': 'true' });
        this.el.appendChild(this.axesRoot);
        var origin = new root.THREE.Vector3(-GRAPH_WIDTH / 2, .035, -GRAPH_DEPTH / 2);
        var xEnd = new root.THREE.Vector3(GRAPH_WIDTH / 2, .035, -GRAPH_DEPTH / 2);
        var zEnd = new root.THREE.Vector3(-GRAPH_WIDTH / 2, .035, GRAPH_DEPTH / 2);
        var yEnd = new root.THREE.Vector3(-GRAPH_WIDTH / 2, GRAPH_BASE_Y + GRAPH_HEIGHT, -GRAPH_DEPTH / 2);
        var self = this;
        var drawTicks = function (axis, scale, metric, color) {
          scale.ticks.forEach(function (value) {
            var ratio = value / Math.max(1, scale.maximum);
            var position;
            if (axis === 'x') {
              position = new root.THREE.Vector3(origin.x + GRAPH_WIDTH * ratio, origin.y, origin.z);
              self.addAxisLine(
                position.clone().add(new root.THREE.Vector3(0, 0, -.035)),
                position.clone().add(new root.THREE.Vector3(0, 0, .035)),
                color
              );
              self.addAxisLabel(formatAxisValue(value), position.clone().add(new root.THREE.Vector3(0, .08, -.11)), color, .72);
            } else if (axis === 'z') {
              position = new root.THREE.Vector3(origin.x, origin.y, origin.z + GRAPH_DEPTH * ratio);
              self.addAxisLine(
                position.clone().add(new root.THREE.Vector3(-.035, 0, 0)),
                position.clone().add(new root.THREE.Vector3(.035, 0, 0)),
                color
              );
              self.addAxisLabel(formatAxisValue(value), position.clone().add(new root.THREE.Vector3(-.13, .08, 0)), color, .72, 'right');
            } else {
              position = new root.THREE.Vector3(origin.x, GRAPH_BASE_Y + GRAPH_HEIGHT * ratio, origin.z);
              self.addAxisLine(
                position.clone().add(new root.THREE.Vector3(-.035, 0, 0)),
                position.clone().add(new root.THREE.Vector3(.035, 0, 0)),
                color
              );
              self.addAxisLabel(formatAxisValue(value), position.clone().add(new root.THREE.Vector3(-.14, 0, 0)), color, .72, 'right');
            }
          });
          var end = axis === 'x' ? xEnd : axis === 'z' ? zEnd : yEnd;
          var offset = axis === 'x'
            ? new root.THREE.Vector3(-.25, .2, -.05)
            : axis === 'z'
              ? new root.THREE.Vector3(-.2, .2, -.12)
              : new root.THREE.Vector3(.15, .12, 0);
          self.addAxisLabel(axis.toUpperCase() + ': ' + metric, end.clone().add(offset), color, 1.7, axis === 'y' ? 'left' : 'center');
        };
        this.addAxisLine(origin, yEnd, 0x4ade80);
        this.addAxisArrow(yEnd, new root.THREE.Vector3(0, 1, 0), 0x4ade80);
        drawTicks('y', this.metricScales.y, this.view.mapping?.height || 'fanIn', '#4ade80');
        if (this.view.layout === 'metric-space') {
          this.addAxisLine(origin, xEnd, 0xfb7185);
          this.addAxisLine(origin, zEnd, 0x60a5fa);
          this.addAxisArrow(xEnd, new root.THREE.Vector3(1, 0, 0), 0xfb7185);
          this.addAxisArrow(zEnd, new root.THREE.Vector3(0, 0, 1), 0x60a5fa);
          drawTicks('x', this.metricScales.x, this.view.mapping?.x || 'fanOut', '#fb7185');
          drawTicks('z', this.metricScales.z, this.view.mapping?.z || 'fanIn', '#60a5fa');
        }
      },