// == virtualScreenRuntime.js | part 80: pointer-and-drag (assembled with its siblings; see COMPONENTS.md) ==
    function getRaycasterIntersection(entity, pointerEl) {
      const raycaster = pointerEl?.components?.raycaster;
      if (!raycaster || typeof raycaster.getIntersection !== 'function') {
        return null;
      }
      return raycaster.getIntersection(entity);
    }

    function getPointerRay(pointerEl) {
      const raycasterComponent = pointerEl?.components?.raycaster;
      const raycaster = raycasterComponent?.raycaster;
      if (!raycaster?.ray) {
        return null;
      }
      return raycaster.ray;
    }

    function getPointerEntity(evt) {
      return evt?.detail?.cursorEl || evt?.detail?.raycasterEl || null;
    }

    function getPointerType(pointerEl) {
      if (!pointerEl) {
        return 'unknown';
      }
      const cursorData = pointerEl.components?.cursor?.data;
      if (cursorData?.rayOrigin === 'mouse') {
        return 'mouse';
      }
      const cursorAttr = typeof pointerEl.getAttribute === 'function' ? pointerEl.getAttribute('cursor') : null;
      if (cursorAttr?.rayOrigin === 'mouse') {
        return 'mouse';
      }
      return 'controller';
    }

    function getWorldPointFromEvent(evt, pointerEl) {
      if (evt?.detail?.intersection?.point && typeof evt.detail.intersection.point.clone === 'function') {
        return evt.detail.intersection.point.clone();
      }
      const raycasterIntersection = getRaycasterIntersection(refs.interactionPlane, pointerEl);
      if (raycasterIntersection?.point && typeof raycasterIntersection.point.clone === 'function') {
        return raycasterIntersection.point.clone();
      }
      return null;
    }

    function worldToParentLocal(worldPoint) {
      if (!refs.root?.object3D?.parent || !worldPoint?.clone) {
        return null;
      }
      const localPoint = worldPoint.clone();
      refs.root.object3D.parent.worldToLocal(localPoint);
      return localPoint;
    }

    function getDragPlaneNormal() {
      if (!global.THREE) {
        return null;
      }
      const referenceQuaternion = getCameraWorldQuaternion() || getWorldQuaternion(refs.root);
      if (!referenceQuaternion?.clone) {
        return null;
      }
      return new global.THREE.Vector3(0, 0, -1).applyQuaternion(referenceQuaternion.clone()).normalize();
    }

    function buildDragPlane(worldPoint, planeNormal) {
      if (!global.THREE || !worldPoint?.clone) {
        return null;
      }
      const normal = planeNormal?.clone ? planeNormal.clone() : getDragPlaneNormal();
      if (!normal?.clone) {
        return null;
      }
      return new global.THREE.Plane().setFromNormalAndCoplanarPoint(normal, worldPoint.clone());
    }

    function getDragDepthAxis(rootWorldPosition) {
      if (!global.THREE || !rootWorldPosition?.clone) {
        return null;
      }
      const cameraWorldPosition = getCameraWorldPosition();
      if (!cameraWorldPosition?.clone) {
        return null;
      }
      const axis = rootWorldPosition.clone().sub(cameraWorldPosition);
      if (axis.lengthSq() === 0) {
        return null;
      }
      return axis.normalize();
    }

    function getSurfaceIntersection(pointerEl) {
      if (state.drag?.plane && global.THREE) {
        const ray = getPointerRay(pointerEl);
        if (ray?.intersectPlane) {
          const worldPoint = new global.THREE.Vector3();
          const hit = ray.intersectPlane(state.drag.plane, worldPoint);
          if (hit) {
            return worldPoint.clone();
          }
          console.log('VIRTUAL_SCREEN: drag intersection missing');
          return null;
        }
      }

      const intersection = getRaycasterIntersection(refs.interactionPlane, pointerEl);
      if (intersection?.point && typeof intersection.point.clone === 'function') {
        return intersection.point.clone();
      }
      return null;
    }

    function applyResize(intersectionPoint) {
      if (!refs.root?.object3D || !global.THREE || !intersectionPoint?.clone) {
        return;
      }
      const localPoint = refs.root.object3D.worldToLocal(intersectionPoint.clone());
      const targetWidth = Math.max(
        Math.abs(localPoint.x) * 2,
        Math.abs(localPoint.y) * 2 * refs.config.aspectRatio,
      );
      state.screenWidth = clamp(targetWidth, refs.config.minWidth, refs.config.maxWidth);
      state.sizeIndex = findClosestSizeIndex(state.screenWidth);
      layout();
      refreshUi();
      publishSharedScreenState();
    }

    function applyDragRootWorldPosition(worldPosition) {
      const localPosition = worldToParentLocal(worldPosition);
      if (!localPosition) {
        return false;
      }
      refs.root.object3D.position.copy(localPosition);
      return true;
    }

    function applyMove(intersectionPoint) {
      if (!state.drag || !intersectionPoint?.clone) {
        return;
      }
      const referencePoint = state.drag.currentStartPoint || state.drag.startPoint;
      const referenceRootPosition = state.drag.currentStartRootWorldPosition || state.drag.startRootWorldPosition;
      const targetWorldPosition = intersectionPoint.clone().sub(referencePoint).add(referenceRootPosition);
      if (!applyDragRootWorldPosition(targetWorldPosition)) {
        return;
      }
      if (!state.follow && state.lookAtCameraEnabled) {
        applyFaceCameraOrientation();
      }
      if (updateLegendSide()) {
        layout();
      }
      console.log('VIRTUAL_SCREEN: move update', {
        x: refs.root.object3D.position.x,
        y: refs.root.object3D.position.y,
        z: refs.root.object3D.position.z,
        handle: state.drag?.handleKey || 'unknown',
      });
      publishSharedTransform(false);
    }

    function adjustDragDepth(delta) {
      if (!state.drag || state.drag.kind !== 'move' || !state.drag.depthAxis?.clone) {
        return;
      }
      state.drag.targetDepthOffset += delta;
      console.log('VIRTUAL_SCREEN: depth update', {
        delta,
        target: state.drag.targetDepthOffset,
        current: state.drag.currentDepthOffset,
      });
    }

    function updateDragDepthSmoothing() {
      if (!state.drag || state.drag.kind !== 'move' || !state.drag.depthAxis?.clone) {
        return;
      }
      const depthDelta = state.drag.targetDepthOffset - state.drag.currentDepthOffset;
      if (Math.abs(depthDelta) < 0.0005) {
        state.drag.currentDepthOffset = state.drag.targetDepthOffset;
      } else {
        state.drag.currentDepthOffset += depthDelta * 0.18;
      }

      const currentDepthVector = state.drag.depthAxis.clone().multiplyScalar(state.drag.currentDepthOffset);
      state.drag.currentStartPoint = state.drag.startPoint.clone().add(currentDepthVector);
      state.drag.currentStartRootWorldPosition = state.drag.startRootWorldPosition.clone().add(currentDepthVector);
      state.drag.plane = buildDragPlane(state.drag.currentStartPoint, state.drag.planeNormal);
    }

    function handleWheelDuringDrag(evt) {
      if (!state.drag || state.drag.kind !== 'move' || state.drag.pointerType !== 'mouse') {
        return;
      }
      const direction = Math.sign(evt.deltaY || 0);
      if (!direction) {
        return;
      }
      evt.preventDefault?.();
      adjustDragDepth(direction * refs.config.dragDepthStep);
    }

    function handleThumbstickDuringDrag(evt) {
      if (!state.drag || state.drag.kind !== 'move' || state.drag.pointerType !== 'controller') {
        return;
      }
      const pointerEl = state.drag.pointerEl;
      if (pointerEl?.id && evt.currentTarget?.id && evt.currentTarget.id !== pointerEl.id) {
        return;
      }
      const axisY = typeof evt.detail?.y === 'number'
        ? evt.detail.y
        : Array.isArray(evt.detail?.axis) && typeof evt.detail.axis[1] === 'number'
          ? evt.detail.axis[1]
          : null;
      if (typeof axisY !== 'number' || Math.abs(axisY) < 0.15) {
        return;
      }
      evt.preventDefault?.();
      evt.stopPropagation?.();
      adjustDragDepth(axisY * refs.config.controllerDepthStep);
    }

    function updateDrag() {
      if (!state.drag) {
        state.dragLoopActive = false;
        return;
      }
      updateDragDepthSmoothing();
      const intersectionPoint = getSurfaceIntersection(state.drag.pointerEl);
      if (!intersectionPoint) {
        scheduleAnimationFrame(updateDrag);
        return;
      }
      if (state.drag.kind === 'resize') {
        applyResize(intersectionPoint);
      } else {
        applyMove(intersectionPoint);
      }
      scheduleAnimationFrame(updateDrag);
    }

    function startDrag(kind, handleKey, evt) {
      if ((isMinimized() && kind === 'resize') || !global.THREE || !refs.root?.object3D) {
        return;
      }
      if (state.follow) {
        disableFollow();
      }
      const collaborationClient = getCollaborationClient();
      state.gestureOwnerPeerId = collaborationClient?.getPeerId?.() || state.gestureOwnerPeerId || null;
      collaborationClient?.lockEntity?.('screen', getScreenId());
      const pointerEl = getPointerEntity(evt);
      const startPoint = getWorldPointFromEvent(evt, pointerEl);
      const rootWorldPosition = getWorldPosition(refs.root);
      const planeNormal = getDragPlaneNormal();
      if (!pointerEl || !startPoint || !rootWorldPosition) {
        return;
      }
      state.drag = {
        kind,
        handleKey,
        pointerEl,
        pointerType: getPointerType(pointerEl),
        startPoint,
        startRootWorldPosition: rootWorldPosition,
        currentStartPoint: startPoint.clone(),
        currentStartRootWorldPosition: rootWorldPosition.clone(),
        planeNormal,
        plane: buildDragPlane(startPoint, planeNormal),
        depthAxis: kind === 'move' ? getDragDepthAxis(rootWorldPosition) : null,
        currentDepthOffset: 0,
        targetDepthOffset: 0,
      };
      console.log('VIRTUAL_SCREEN: drag start', {
        kind,
        handleKey,
        pointerType: state.drag.pointerType,
        startPoint: { x: startPoint.x, y: startPoint.y, z: startPoint.z },
      });
      if (!state.dragLoopActive) {
        state.dragLoopActive = true;
        scheduleAnimationFrame(updateDrag);
      }
      showChrome();
      setEntityVisible(refs.dragPlane, true);
      updateStatus(kind === 'resize' ? refs.config.labels.resize : refs.config.labels.move);
    }

    function endDrag() {
      if (!state.drag) {
        return;
      }
      console.log('VIRTUAL_SCREEN: drag end');
      state.drag = null;
      setEntityVisible(refs.dragPlane, false);
      if (!state.follow && state.lookAtCameraEnabled) {
        applyFaceCameraOrientation();
        ensureFaceCameraLoop();
      }
      updateStatus(state.currentSourceLabel || (isMinimized() ? refs.config.labels.minimized : refs.config.labels.idle));
      scheduleChromeHide();
      getCollaborationClient()?.unlockEntity?.('screen', getScreenId());
      state.gestureOwnerPeerId = null;
      publishSharedScreenState();
      publishSharedTransform(true);
    }
