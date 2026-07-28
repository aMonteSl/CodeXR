// == virtualScreenRuntime.js | pointerAndDrag (assembled per manifest.json; see COMPONENTS.md) ==
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
      const nextWidth = clamp(targetWidth, refs.config.minWidth, refs.config.maxWidth);
      // Collision bumper: growing must not push an edge into a wall or
      // another screen (shrinking only pulls edges inward — always fine).
      if (nextWidth > state.screenWidth) {
        const worldPosition = getWorldPosition(refs.root);
        const worldQuaternion = getWorldQuaternion(refs.root);
        if (worldPosition && worldQuaternion
          && violatesCollision(collectScreenSamplePoints(worldPosition, worldQuaternion, nextWidth))) {
          return;
        }
      }
      state.screenWidth = nextWidth;
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
      // Collision bumper: motion into a wall/screen stops, parallel motion
      // keeps sliding along it.
      const targetWorldPosition = constrainPosition(
        intersectionPoint.clone().sub(referencePoint).add(referenceRootPosition),
      );
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
      let target = state.drag.targetDepthOffset + delta;
      // The collision bumper is a physical stop, not a clamp: without a lead
      // limit the target kept growing while the screen sat pinned against a
      // wall, and reversing the input had to unwind it all before the screen
      // moved again.
      const maxLead = refs.config.dragDepthMaxLead ?? 1.2;
      const current = state.drag.currentDepthOffset;
      target = Math.min(Math.max(target, current - maxLead), current + maxLead);
      // Pulling stops before the screen reaches the user's head. The grab
      // distance is measured once at startDrag; close enough, since the depth
      // axis is frozen there too.
      if (typeof state.drag.startDepthDistance === 'number') {
        const minDistance = refs.config.dragDepthMinDistance ?? 0.6;
        target = Math.max(target, minDistance - state.drag.startDepthDistance);
      }
      state.drag.targetDepthOffset = target;
    }

    function adjustDragLateral(delta) {
      if (!state.drag || state.drag.kind !== 'move' || !state.drag.lateralAxis?.clone) {
        return;
      }
      // Same lead clamp as depth: the bumpers stop the screen at walls and
      // other screens, and the target must not run away while it is pinned.
      const maxLead = refs.config.dragDepthMaxLead ?? 1.2;
      const current = state.drag.currentLateralOffset;
      const target = state.drag.targetLateralOffset + delta;
      state.drag.targetLateralOffset = Math.min(Math.max(target, current - maxLead), current + maxLead);
    }

    // Reach from the grabbing controller's thumbstick, applied every frame of
    // the drag loop: thumbstickmoved only fires when an axis CHANGES, so the
    // handler merely records the deflection and this converts it into motion
    // for as long as the stick is held. Stick forward (negative y) pushes the
    // screen away — the Quest convention — and stick right (positive x)
    // slides it to the user's right, both at the same speed.
    function applyStickDepth() {
      if (!state.drag) {
        return;
      }
      const now = global.performance?.now ? global.performance.now() : Date.now();
      const last = state.drag.lastDepthTick ?? now;
      state.drag.lastDepthTick = now;
      const deflectionY = state.drag.depthStickY || 0;
      const deflectionX = state.drag.depthStickX || 0;
      if (!deflectionY && !deflectionX) {
        return;
      }
      const dtSeconds = Math.min(Math.max(now - last, 0), 50) / 1000;
      const speed = refs.config.controllerDepthSpeed ?? 1.8;
      if (deflectionY) {
        adjustDragDepth(-deflectionY * speed * dtSeconds);
      }
      if (deflectionX) {
        adjustDragLateral(deflectionX * speed * dtSeconds);
      }
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
      const lateralDelta = state.drag.targetLateralOffset - state.drag.currentLateralOffset;
      if (Math.abs(lateralDelta) < 0.0005) {
        state.drag.currentLateralOffset = state.drag.targetLateralOffset;
      } else {
        state.drag.currentLateralOffset += lateralDelta * 0.18;
      }

      // Depth moves the interaction PLANE (so the ray's intersection slides
      // along the ray — that is what makes push/pull work). Lateral must NOT
      // touch the plane: shifting a plane parallel to itself leaves the
      // ray-plane intersection where it was, so an in-plane offset would only
      // move the screen by its tiny out-of-plane residual (observed live as
      // "slow and coupled to depth"). Instead it shifts only the screen's
      // reference position, which applyMove translates 1:1.
      const currentDepthVector = state.drag.depthAxis.clone().multiplyScalar(state.drag.currentDepthOffset);
      const rootOffsetVector = currentDepthVector.clone();
      if (state.drag.lateralAxis?.clone && state.drag.currentLateralOffset) {
        rootOffsetVector.add(state.drag.lateralAxis.clone().multiplyScalar(state.drag.currentLateralOffset));
      }
      state.drag.currentStartPoint = state.drag.startPoint.clone().add(currentDepthVector);
      state.drag.currentStartRootWorldPosition = state.drag.startRootWorldPosition.clone().add(rootOffsetVector);
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
      // Only the stick of the hand that GRABBED drives the depth; the other
      // hand keeps its locomotion role.
      const pointerEl = state.drag.pointerEl;
      if (pointerEl?.id && evt.currentTarget?.id && evt.currentTarget.id !== pointerEl.id) {
        return;
      }
      const axisY = typeof evt.detail?.y === 'number'
        ? evt.detail.y
        : Array.isArray(evt.detail?.axis) && typeof evt.detail.axis[1] === 'number'
          ? evt.detail.axis[1]
          : null;
      const axisX = typeof evt.detail?.x === 'number'
        ? evt.detail.x
        : Array.isArray(evt.detail?.axis) && typeof evt.detail.axis[0] === 'number'
          ? evt.detail.axis[0]
          : null;
      if (typeof axisY !== 'number' && typeof axisX !== 'number') {
        return;
      }
      // Record only — applyStickDepth turns this into per-frame motion.
      // Recording is idempotent, so the double listener (scene + controller,
      // see wireDepthInputHandlers) needs no stopPropagation games.
      if (typeof axisY === 'number') {
        state.drag.depthStickY = Math.abs(axisY) < 0.15 ? 0 : axisY;
      }
      if (typeof axisX === 'number') {
        state.drag.depthStickX = Math.abs(axisX) < 0.15 ? 0 : axisX;
      }
    }

    function updateDrag() {
      if (!state.drag) {
        state.dragLoopActive = false;
        return;
      }
      applyStickDepth();
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
        lateralAxis: null,
        currentDepthOffset: 0,
        targetDepthOffset: 0,
        currentLateralOffset: 0,
        targetLateralOffset: 0,
        depthStickY: 0,
        depthStickX: 0,
        lastDepthTick: null,
        startDepthDistance: null,
        gateHand: null,
        ownsSceneDragState: false,
      };
      if (state.drag.depthAxis && global.THREE) {
        // The stick's x axis slides the screen sideways: horizontal, and
        // perpendicular to the camera->screen depth axis. depth x up = the
        // user's right. Degenerates when the screen is straight overhead —
        // then there is no meaningful "sideways" and it stays off.
        const lateral = state.drag.depthAxis.clone()
          .cross(new global.THREE.Vector3(0, 1, 0));
        if (lateral.lengthSq() > 1e-6) {
          state.drag.lateralAxis = lateral.normalize();
        }
      }
      if (state.drag.depthAxis) {
        const cameraWorldPosition = getCameraWorldPosition();
        if (cameraWorldPosition?.clone) {
          state.drag.startDepthDistance = rootWorldPosition.clone().sub(cameraWorldPosition).length();
        }
      }
      if (state.drag.pointerType === 'controller') {
        // The grabbing hand's thumbstick belongs to the drag now: claim it so
        // aframe-extras' gamepad locomotion ignores that stick (the OTHER
        // hand keeps walking/turning), and mark the scene so
        // codexr-pointer-policy does not hand the laser away mid-grab.
        state.drag.gateHand = pointerEl?.id === 'leftController'
          ? 'left'
          : pointerEl?.id === 'rightController' ? 'right' : null;
        if (state.drag.gateHand) {
          global.CodeXRStickGateRuntime?.claim?.(state.drag.gateHand);
        }
        const sceneEl = getScene();
        if (sceneEl?.addState) {
          sceneEl.addState('codexr-screen-drag');
          state.drag.ownsSceneDragState = true;
        }
      }
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
      setInteractive(refs.dragPlane, true);
      updateStatus(kind === 'resize' ? refs.config.labels.resize : refs.config.labels.move);
    }

    function endDrag() {
      if (!state.drag) {
        return;
      }
      console.log('VIRTUAL_SCREEN: drag end');
      // Give the sticks back: release the locomotion claim and the
      // pointer-hold scene state this drag took (and only if THIS instance
      // took them — endDrag also fires globally on window mouseup/blur).
      if (state.drag.gateHand) {
        global.CodeXRStickGateRuntime?.release?.(state.drag.gateHand);
      }
      if (state.drag.ownsSceneDragState) {
        getScene()?.removeState?.('codexr-screen-drag');
      }
      state.drag = null;
      setInteractive(refs.dragPlane, false);
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
