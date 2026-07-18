// == dependencyGraphRuntime.js | edgesAndHighlights (assembled per manifest.json; see COMPONENTS.md) ==
      disposeEdgeBatches: function () {
        (this.edgeBatchObjects || []).forEach(function (object) {
          object.parent?.remove?.(object);
          object.geometry?.dispose?.();
          object.material?.dispose?.();
        });
        this.edgeBatches = {};
        this.edgeBatchObjects = [];
      },
      disposeFocusEdges: function () {
        (this.focusEdgeObjects || []).forEach(function (record) {
          [record.body, record.arrow].forEach(function (object) {
            object?.parent?.remove?.(object);
            object?.geometry?.dispose?.();
            object?.material?.dispose?.();
          });
        });
        this.focusEdgeObjects = [];
        this.focusEdgeIds = new Set();
      },
      rebuildFocusEdges: function () {
        this.disposeFocusEdges();
        if (!root.THREE || !(this.pinnedSelection || this.hoveredSelection)) { return; }
        var records = Object.values(this.edgeRecords).filter(function (record) {
          return !record.remove && (record.highlighted || this.isEdgeActive(record.data));
        }, this).sort(function (left, right) {
          return Number(right.data.occurrences || 1) - Number(left.data.occurrences || 1);
        }).slice(0, 40);
        records.forEach(function (record) {
          this.focusEdgeIds.add(record.data.id);
          var opacity = root.CodeXRDependencyVisualBudgetRuntime?.opacityFor?.(
            this.visualBudget?.effectiveProfile || 'balanced',
            record.data.confidence || 'probable',
            true
          ) || .94;
          var material = new root.THREE.MeshBasicMaterial({
            color: record.style?.color || '#fcd34d',
            transparent: true,
            opacity: opacity,
            depthWrite: false
          });
          var body = new root.THREE.Mesh(
            new root.THREE.CylinderGeometry(.01, .01, 1, 8),
            material
          );
          var arrow = new root.THREE.Mesh(
            new root.THREE.ConeGeometry(.026, .085, 8),
            material.clone()
          );
          body.frustumCulled = false;
          arrow.frustumCulled = false;
          this.el.object3D.add(body);
          this.el.object3D.add(arrow);
          this.focusEdgeObjects.push({ record: record, body: body, arrow: arrow });
        }, this);
        this.updateFocusEdges();
      },
      updateFocusEdges: function () {
        if (!root.THREE) { return; }
        (this.focusEdgeObjects || []).forEach(function (focus) {
          var source = this.nodes[focus.record.data.source]?.el?.object3D?.position;
          var target = this.nodes[focus.record.data.target]?.el?.object3D?.position;
          if (!source || !target) {
            focus.body.visible = false;
            focus.arrow.visible = false;
            return;
          }
          var direction = target.clone().sub(source);
          var length = Math.max(.001, direction.length());
          var normalized = direction.clone().normalize();
          var midpoint = source.clone().add(target).multiplyScalar(.5);
          var width = Math.max(.009, Number(focus.record.style?.width || .006) * 1.85);
          focus.body.visible = true;
          focus.body.position.copy(midpoint);
          focus.body.quaternion.setFromUnitVectors(new root.THREE.Vector3(0, 1, 0), normalized);
          focus.body.scale.set(width / .01, length, width / .01);
          focus.arrow.visible = true;
          focus.arrow.position.copy(target).addScaledVector(normalized, -.075);
          focus.arrow.quaternion.setFromUnitVectors(new root.THREE.Vector3(0, 1, 0), normalized);
          focus.arrow.scale.setScalar(Math.max(.9, width / .012));
        }, this);
      },
      createEdgeBatch: function (confidence, count) {
        if (!root.THREE || count < 1) { return null; }
        var opacity = root.CodeXRDependencyVisualBudgetRuntime?.opacityFor?.(
          this.visualBudget?.effectiveProfile || 'balanced',
          confidence,
          false
        ) || FALLBACK_CONFIDENCE_OPACITY[confidence] || FALLBACK_CONFIDENCE_OPACITY.probable;
        var body = new root.THREE.InstancedMesh(
          new root.THREE.CylinderGeometry(.01, .01, 1, 6),
          new root.THREE.MeshBasicMaterial({
            color: 0xffffff, vertexColors: true, transparent: true,
            opacity: opacity, depthWrite: false
          }),
          count
        );
        var arrows = new root.THREE.InstancedMesh(
          new root.THREE.ConeGeometry(.026, .085, 6),
          new root.THREE.MeshBasicMaterial({
            color: 0xffffff, vertexColors: true, transparent: true,
            opacity: Math.min(1, opacity + .12), depthWrite: false
          }),
          count
        );
        body.instanceMatrix.setUsage?.(root.THREE.DynamicDrawUsage);
        arrows.instanceMatrix.setUsage?.(root.THREE.DynamicDrawUsage);
        body.frustumCulled = false;
        arrows.frustumCulled = false;
        this.el.object3D.add(body);
        this.el.object3D.add(arrows);
        this.edgeBatchObjects.push(body, arrows);
        return { body: body, arrows: arrows, nextIndex: 0 };
      },
      createEdgeRecord: function (edge) {
        if (!root.THREE) { return null; }
        var self = this;
        var hitMesh = new root.THREE.Mesh(
          new root.THREE.CylinderGeometry(.018, .018, 1, 6),
          new root.THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            depthWrite: false,
            colorWrite: false,
            visible: false
          })
        );
        var edgeEl = entity('a-entity', {
          class: RAYCAST_CLASS,
          'data-edge-id': edge.id,
          'data-codexr-interactive': 'true'
        });
        edgeEl.setObject3D('edge-hit-target', hitMesh);
        edgeEl.addEventListener('mouseenter', function () {
          self.showTransientSelection({ type: 'edge', id: edge.id });
        });
        edgeEl.addEventListener('mouseleave', function () {
          self.hideTransientSelection({ type: 'edge', id: edge.id });
        });
        edgeEl.addEventListener('click', function (clickEvent) {
          clickEvent.stopPropagation?.();
          self.togglePinnedSelection({ type: 'edge', id: edge.id });
        });
        this.el.appendChild(edgeEl);
        this.edgeObjects.push(hitMesh);
        return {
          el: edgeEl,
          data: edge,
          hitMesh: hitMesh,
          midpoint: new root.THREE.Vector3(),
          style: edgeStyle(edge, this.view?.edgeEncoding || 'relation-type', this.visualBudget),
          batch: null,
          instanceIndex: -1,
          remove: false
        };
      },
      reconcileEdges: function (nextEdges, nextView) {
        var self = this;
        var nextIds = new Set();
        this.disposeEdgeBatches();
        var confidenceCounts = {};
        nextEdges.forEach(function (edge) {
          var key = edge.confidence || 'probable';
          confidenceCounts[key] = Number(confidenceCounts[key] || 0) + 1;
        });
        Object.keys(confidenceCounts).forEach(function (confidence) {
          self.edgeBatches[confidence] = self.createEdgeBatch(confidence, confidenceCounts[confidence]);
        });
        nextEdges.forEach(function (edge) {
          nextIds.add(edge.id);
          var record = self.edgeRecords[edge.id];
          if (!record) {
            record = self.createEdgeRecord(edge);
            if (!record) { return; }
            self.edgeRecords[edge.id] = record;
          }
          record.data = edge;
          record.style = edgeStyle(
            edge,
            nextView?.edgeEncoding || self.view?.edgeEncoding || 'relation-type',
            self.visualBudget
          );
          record.batch = self.edgeBatches[edge.confidence || 'probable'];
          record.instanceIndex = record.batch ? record.batch.nextIndex++ : -1;
          record.remove = false;
        });
        Object.keys(this.edgeRecords).forEach(function (edgeId) {
          if (nextIds.has(edgeId)) { return; }
          var record = self.edgeRecords[edgeId];
          record.batch = null;
          record.instanceIndex = -1;
          record.hitMesh.visible = false;
          record.remove = true;
        });
      },
      updateEdgeGeometry: function (record) {
        if (!root.THREE) { return; }
        var source = this.nodes[record.data.source]?.el?.object3D?.position;
        var target = this.nodes[record.data.target]?.el?.object3D?.position;
        if (!source || !target || !record.batch || record.instanceIndex < 0) {
          record.hitMesh.visible = false;
          return;
        }
        record.hitMesh.visible = true;
        record.midpoint.copy(source).add(target).multiplyScalar(.5);
        var direction = target.clone().sub(source);
        var length = Math.max(.001, direction.length());
        record.hitMesh.position.copy(record.midpoint);
        record.hitMesh.scale.set(1, length, 1);
        record.hitMesh.quaternion.setFromUnitVectors(
          new root.THREE.Vector3(0, 1, 0),
          direction.clone().normalize()
        );
        var style = record.style || edgeStyle(
          record.data,
          this.view?.edgeEncoding || 'relation-type',
          this.visualBudget
        );
        var normalizedDirection = direction.clone().normalize();
        this.edgeTransform.position.copy(record.midpoint);
        this.edgeTransform.quaternion.setFromUnitVectors(
          new root.THREE.Vector3(0, 1, 0),
          normalizedDirection
        );
        this.edgeTransform.scale.set(style.width / .01, length, style.width / .01);
        this.edgeTransform.updateMatrix();
        record.batch.body.setMatrixAt(record.instanceIndex, this.edgeTransform.matrix);
        record.batch.body.setColorAt(record.instanceIndex, new root.THREE.Color(style.color));

        var showArrow = this.visualBudget?.arrowsForAll || this.focusEdgeIds.has(record.data.id);
        this.edgeTransform.position.copy(target).addScaledVector(normalizedDirection, -.075);
        this.edgeTransform.quaternion.setFromUnitVectors(
          new root.THREE.Vector3(0, 1, 0),
          normalizedDirection
        );
        this.edgeTransform.scale.setScalar(showArrow ? Math.max(.75, style.width / .012) : 0);
        this.edgeTransform.updateMatrix();
        record.batch.arrows.setMatrixAt(record.instanceIndex, this.edgeTransform.matrix);
        record.batch.arrows.setColorAt(record.instanceIndex, new root.THREE.Color(style.color));
      },
      flushEdgeBatches: function () {
        Object.values(this.edgeBatches || {}).forEach(function (batch) {
          if (!batch) { return; }
          batch.body.instanceMatrix.needsUpdate = true;
          batch.arrows.instanceMatrix.needsUpdate = true;
          if (batch.body.instanceColor) { batch.body.instanceColor.needsUpdate = true; }
          if (batch.arrows.instanceColor) { batch.arrows.instanceColor.needsUpdate = true; }
        });
      },
      isEdgeActive: function (edge) {
        var selection = this.pinnedSelection || this.hoveredSelection;
        if (!selection) { return false; }
        if (selection.type === 'edge') { return selection.id === edge.id; }
        return edge.source === selection.id || edge.target === selection.id;
      },
      refreshEdgeColors: function (selection) {
        if (!root.THREE) { return; }
        this.visibleArrowCount = 0;
        Object.keys(this.edgeRecords).forEach(function (edgeId) {
          var record = this.edgeRecords[edgeId];
          if (!record.batch || record.instanceIndex < 0) { return; }
          var active = !selection || record.highlighted;
          var color = new root.THREE.Color(record.style?.color || '#67e8f9');
          if (!active) { color.multiplyScalar(.42); }
          this.updateEdgeGeometry(record);
          record.batch.body.setColorAt(record.instanceIndex, color);
          record.batch.arrows.setColorAt(record.instanceIndex, color);
        }, this);
        this.flushEdgeBatches();
      },
      updateHighlightTransition: function () {
        Object.keys(this.nodes).forEach(function (nodeId) {
          var record = this.nodes[nodeId];
          var material = record.el.getAttribute('material') || {};
          var current = Number(material.opacity ?? 1);
          var target = Number(record.highlightTarget ?? 1);
          if (Math.abs(current - target) < .01) { current = target; }
          else { current += (target - current) * .16; }
          record.el.setAttribute('material', 'opacity', current);
          record.el.setAttribute('material', 'transparent', current < .999);
          if (root.THREE && record.baseColor) {
            var targetColor = new root.THREE.Color(record.baseColor);
            if (record.highlightColor) {
              targetColor.lerp(new root.THREE.Color('#ffffff'), .28);
            }
            var currentColor = new root.THREE.Color(material.color || record.baseColor);
            currentColor.lerp(targetColor, .18);
            record.el.setAttribute('material', 'color', '#' + currentColor.getHexString());
          }
        }, this);
      },
      ensureSelectionHalo: function (selection) {
        this.disposeSelectionHalo();
        if (!root.THREE || selection.type !== 'node' || !this.nodes[selection.id]) { return; }
        var radius = Math.max(.09, Number(this.nodes[selection.id].radius || .1)) * 1.5;
        this.selectionHalo = new root.THREE.Mesh(
          new root.THREE.SphereGeometry(radius, 12, 8),
          new root.THREE.MeshBasicMaterial({
            color: 0xfcd34d, transparent: true, opacity: .42,
            wireframe: true, depthWrite: false
          })
        );
        this.selectionHalo.userData.nodeId = selection.id;
        this.el.object3D.add(this.selectionHalo);
      },
      updateSelectionHalo: function (time) {
        if (!this.selectionHalo) { return; }
        var node = this.nodes[this.selectionHalo.userData.nodeId];
        if (!node) {
          this.disposeSelectionHalo();
          return;
        }
        this.selectionHalo.position.copy(node.el.object3D.position);
        var pulse = this.flowQuality === 'static' ? 1 : 1 + Math.sin(time * .005) * .08;
        this.selectionHalo.scale.setScalar(pulse);
      },
      disposeSelectionHalo: function () {
        if (!this.selectionHalo) { return; }
        this.selectionHalo.parent?.remove?.(this.selectionHalo);
        this.selectionHalo.geometry?.dispose?.();
        this.selectionHalo.material?.dispose?.();
        this.selectionHalo = null;
      },