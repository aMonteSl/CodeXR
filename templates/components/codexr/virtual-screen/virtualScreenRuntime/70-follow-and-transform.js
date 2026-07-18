// == virtualScreenRuntime.js | part 70: follow-and-transform (assembled with its siblings; see COMPONENTS.md) ==
    function setAnchoredTransform() {
      if (!refs.root) {
        return;
      }
      refs.root.setAttribute('position', formatVector(refs.config.anchoredPosition));
      refs.root.setAttribute('rotation', formatVector(refs.config.anchoredRotation));
    }

    function scheduleAnimationFrame(callback) {
      const nextFrame = win.requestAnimationFrame || global.requestAnimationFrame || function (cb) { return setTimeout(cb, 16); };
      nextFrame(callback);
    }

    function enableFollow() {
      if (state.follow) {
        return;
      }
      const followTransform = captureFollowTransformFromCamera();
      if (!followTransform) {
        return;
      }
      state.followTransform = followTransform;
      state.follow = true;
      updateLegendSide();
      layout();
      ensureFollowLoop();
      showChrome();
      console.log('VIRTUAL_SCREEN: follow enabled', {
        position: state.followTransform?.position
          ? { x: state.followTransform.position.x, y: state.followTransform.position.y, z: state.followTransform.position.z }
          : null,
      });
      updateStatus(state.currentSourceLabel || 'Virtual screen follows the user.');
    }

    function disableFollow() {
      if (!state.follow) {
        return;
      }
      state.follow = false;
      state.followTransform = null;
      updateLegendSide();
      layout();
      if (state.lookAtCameraEnabled) {
        ensureFaceCameraLoop();
      }
      showChrome();
      console.log('VIRTUAL_SCREEN: follow disabled');
      updateStatus(state.currentSourceLabel || 'Virtual screen anchored in the scene.');
    }

    function toggleFollow() {
      if (state.follow) {
        disableFollow();
      } else {
        enableFollow();
      }
      publishSharedScreenState();
    }

    function recenter() {
      if (!refs.root) {
        return;
      }
      if (state.follow) {
        state.followTransform = captureFollowTransformFromCamera();
        applyFollowTransform();
      } else {
        const scene = getScene();
        if (scene) {
          scene.appendChild(refs.root);
        }
        setAnchoredTransform();
        if (state.lookAtCameraEnabled) {
          applyFaceCameraOrientation();
        }
      }
      showChrome();
      updateStatus(state.currentSourceLabel || 'Virtual screen recentered.');
      publishSharedScreenState();
      publishSharedTransform(true);
    }

    function buildFrontOfUserFollowTransform() {
      if (!global.THREE) {
        console.log('[CodeXR][VirtualScreen] buildFrontOfUserFollowTransform failed: THREE unavailable', {
          screenId: getScreenId(),
        });
        return null;
      }
      const followOffset = refs.config.followOffset || DEFAULT_CONFIG.followOffset;
      const position = new global.THREE.Vector3(
        Number(followOffset.x) || 0,
        Number(followOffset.y) || 0,
        Number(followOffset.z) || 0,
      );
      console.log('[CodeXR][VirtualScreen] buildFrontOfUserFollowTransform', {
        screenId: getScreenId(),
        followOffset: {
          x: position.x,
          y: position.y,
          z: position.z,
        },
        followAnchorSelector: refs.config.followAnchorSelector,
      });
      return {
        position,
        distance: position.length(),
      };
    }

    function placeInFrontOfUser(options) {
      if (!refs.root) {
        console.log('[CodeXR][VirtualScreen] placeInFrontOfUser failed: root missing', {
          screenId: getScreenId(),
        });
        return false;
      }
      const followTransform = buildFrontOfUserFollowTransform();
      if (!followTransform) {
        console.log('[CodeXR][VirtualScreen] placeInFrontOfUser failed: follow transform missing', {
          screenId: getScreenId(),
        });
        return false;
      }
      state.follow = false;
      state.followTransform = followTransform;
      if (!applyFollowTransform()) {
        console.log('[CodeXR][VirtualScreen] placeInFrontOfUser failed: applyFollowTransform returned false', {
          screenId: getScreenId(),
          followTransform: {
            position: {
              x: followTransform.position.x,
              y: followTransform.position.y,
              z: followTransform.position.z,
            },
            distance: followTransform.distance,
          },
          rootPosition: refs.root?.object3D?.position
            ? {
              x: refs.root.object3D.position.x,
              y: refs.root.object3D.position.y,
              z: refs.root.object3D.position.z,
            }
            : null,
        });
        return false;
      }
      if (state.lookAtCameraEnabled) {
        applyFaceCameraOrientation();
      }
      layout();
      refreshUi();
      if (options?.showChrome !== false) {
        showChrome();
      }
      if (options?.updateStatus !== false) {
        updateStatus(state.currentSourceLabel || 'Virtual screen moved in front of you.');
      }
      if (options?.publishState === true) {
        publishSharedScreenState();
      }
      if (options?.publishTransform === true) {
        publishSharedTransform(true);
      }
      const rootWorldPosition = getWorldPosition(refs.root);
      console.log('[CodeXR][VirtualScreen] placeInFrontOfUser success', {
        screenId: getScreenId(),
        rootLocalPosition: refs.root?.object3D?.position
          ? {
            x: refs.root.object3D.position.x,
            y: refs.root.object3D.position.y,
            z: refs.root.object3D.position.z,
          }
          : null,
        rootWorldPosition: rootWorldPosition?.clone
          ? {
            x: rootWorldPosition.x,
            y: rootWorldPosition.y,
            z: rootWorldPosition.z,
          }
          : null,
      });
      return true;
    }

    function adjustSize(direction) {
      const nextIndex = clamp(findClosestSizeIndex(state.screenWidth) + direction, 0, refs.config.sizeSteps.length - 1);
      state.sizeIndex = nextIndex;
      state.screenWidth = refs.config.sizeSteps[nextIndex];
      layout();
      refreshUi();
      showChrome();
      updateStatus(state.currentSourceLabel || 'Virtual screen size updated.');
      publishSharedScreenState();
    }

    function setScreenWidth(width, options) {
      const nextWidth = clamp(Number(width || state.screenWidth), refs.config.minWidth, refs.config.maxWidth);
      state.screenWidth = nextWidth;
      state.sizeIndex = findClosestSizeIndex(nextWidth);
      layout();
      refreshUi();
      if (!options?.silent) {
        showChrome();
        updateStatus(state.currentSourceLabel || 'Virtual screen size updated.');
        publishSharedScreenState();
      }
      return state.screenWidth;
    }

    function setDisplayName(name) {
      if (typeof name === 'string' && name.trim().length > 0) {
        state.displayName = name.trim();
        if (state.mode === 'idle') {
          updateStatus(name.trim());
        }
        publishSharedScreenState();
      }
    }

    function minimize() {
      state.presentationMode = 'minimized';
      layout();
      refreshUi();
      updateStatus(refs.config.labels.minimized);
      publishSharedScreenState();
    }

    function expand() {
      state.presentationMode = 'expanded';
      layout();
      refreshUi();
      updateStatus(state.currentSourceLabel || refs.config.labels.idle);
      showChrome();
      publishSharedScreenState();
    }

    function getWorldPosition(entity) {
      if (!entity?.object3D || !global.THREE) {
        return null;
      }
      const vector = new global.THREE.Vector3();
      entity.object3D.getWorldPosition(vector);
      return vector;
    }

    function getCameraWorldPosition() {
      if (!global.THREE) {
        return null;
      }
      const scene = getScene();
      if (scene?.camera?.getWorldPosition) {
        const vector = new global.THREE.Vector3();
        scene.camera.getWorldPosition(vector);
        return vector;
      }
      const cameraEntity = getDocument()?.querySelector('a-camera, [camera]');
      return getWorldPosition(cameraEntity) || getWorldPosition(getFollowAnchor());
    }

    function getWorldQuaternion(entity) {
      if (!entity?.object3D || !global.THREE) {
        return null;
      }
      const quaternion = new global.THREE.Quaternion();
      entity.object3D.getWorldQuaternion(quaternion);
      return quaternion;
    }

    function applyWorldTransform(entity, worldPosition, worldQuaternion) {
      if (!entity?.object3D?.parent || !global.THREE || !worldPosition?.clone || !worldQuaternion?.clone) {
        return false;
      }
      const parent = entity.object3D.parent;
      parent.updateMatrixWorld?.(true);

      const localPosition = worldPosition.clone();
      parent.worldToLocal(localPosition);

      const parentQuaternion = new global.THREE.Quaternion();
      parent.getWorldQuaternion(parentQuaternion);
      const localQuaternion = parentQuaternion.clone().invert().multiply(worldQuaternion.clone());

      entity.object3D.position.copy(localPosition);
      entity.object3D.quaternion.copy(localQuaternion);
      return true;
    }

    function updateLegendSide() {
      if (!refs.root?.object3D || !global.THREE) {
        return false;
      }
      const cameraWorldPosition = getCameraWorldPosition();
      const cameraWorldQuaternion = getCameraWorldQuaternion();
      const rootWorldPosition = getWorldPosition(refs.root);
      if (!cameraWorldPosition?.clone || !cameraWorldQuaternion?.clone || !rootWorldPosition?.clone) {
        return false;
      }

      const screenInViewSpace = rootWorldPosition.clone()
        .sub(cameraWorldPosition)
        .applyQuaternion(cameraWorldQuaternion.clone().invert());
      const legendSwitchThreshold = 0.28;
      const desiredSide = screenInViewSpace.x > legendSwitchThreshold
        ? 'left'
        : screenInViewSpace.x < -legendSwitchThreshold
          ? 'right'
          : state.legendSide;

      if (desiredSide === state.legendSide) {
        return false;
      }
      state.legendSide = desiredSide;
      return true;
    }

    function applyFaceCameraOrientation() {
      if (!refs.root?.object3D || !global.THREE) {
        return false;
      }
      const cameraWorldPosition = getCameraWorldPosition();
      const rootWorldPosition = getWorldPosition(refs.root);
      if (!cameraWorldPosition?.clone || !rootWorldPosition?.clone) {
        return false;
      }
      const targetWorldQuaternion = computeFaceUserQuaternion(rootWorldPosition, cameraWorldPosition);
      if (!targetWorldQuaternion?.clone) {
        return false;
      }
      const applied = applyWorldTransform(refs.root, rootWorldPosition, targetWorldQuaternion);
      if (applied && updateLegendSide()) {
        layout();
      }
      return applied;
    }

    function computeFaceUserQuaternion(screenWorldPosition, cameraWorldPosition) {
      if (!global.THREE || !screenWorldPosition?.clone || !cameraWorldPosition?.clone) {
        return null;
      }

      const forward = cameraWorldPosition.clone().sub(screenWorldPosition);
      if (forward.lengthSq() < 0.000001) {
        return getWorldQuaternion(refs.root);
      }
      forward.normalize();

      let referenceUp = new global.THREE.Vector3(0, 1, 0);
      let right = new global.THREE.Vector3().crossVectors(referenceUp, forward);
      if (right.lengthSq() < 0.000001) {
        referenceUp = new global.THREE.Vector3(1, 0, 0);
        right = new global.THREE.Vector3().crossVectors(referenceUp, forward);
      }
      if (right.lengthSq() < 0.000001) {
        referenceUp = new global.THREE.Vector3(0, 0, 1);
        right = new global.THREE.Vector3().crossVectors(referenceUp, forward);
      }
      right.normalize();

      const up = new global.THREE.Vector3().crossVectors(forward, right).normalize();
      const basis = new global.THREE.Matrix4().makeBasis(right, up, forward);
      return new global.THREE.Quaternion().setFromRotationMatrix(basis);
    }

    function captureFollowTransformFromCamera() {
      if (!refs.root?.object3D || !global.THREE) {
        return null;
      }
      const cameraWorldPosition = getCameraWorldPosition();
      const cameraWorldQuaternion = getCameraWorldQuaternion();
      const rootWorldPosition = getWorldPosition(refs.root);
      if (!cameraWorldPosition?.clone || !cameraWorldQuaternion?.clone || !rootWorldPosition?.clone) {
        return null;
      }

      const inverseCameraQuaternion = cameraWorldQuaternion.clone().invert();
      return {
        position: rootWorldPosition.clone().sub(cameraWorldPosition).applyQuaternion(inverseCameraQuaternion.clone()),
        distance: rootWorldPosition.distanceTo(cameraWorldPosition),
      };
    }

    function applyFollowTransform() {
      if (!state.followTransform?.position?.clone) {
        console.log('[CodeXR][VirtualScreen] applyFollowTransform failed: missing followTransform position', {
          screenId: getScreenId(),
        });
        return false;
      }
      const cameraWorldPosition = getCameraWorldPosition();
      const cameraWorldQuaternion = getCameraWorldQuaternion();
      if (!cameraWorldPosition?.clone || !cameraWorldQuaternion?.clone) {
        console.log('[CodeXR][VirtualScreen] applyFollowTransform failed: camera transform unavailable', {
          screenId: getScreenId(),
          hasCameraWorldPosition: !!cameraWorldPosition?.clone,
          hasCameraWorldQuaternion: !!cameraWorldQuaternion?.clone,
          followAnchorSelector: refs.config.followAnchorSelector,
          followAnchorConnected: !!getFollowAnchor()?.isConnected,
          sceneHasCamera: !!getScene()?.camera,
        });
        return false;
      }

      const targetWorldPosition = state.followTransform.position.clone()
        .applyQuaternion(cameraWorldQuaternion.clone())
        .add(cameraWorldPosition.clone());
      const targetWorldQuaternion = computeFaceUserQuaternion(targetWorldPosition, cameraWorldPosition);
      const applied = applyWorldTransform(refs.root, targetWorldPosition, targetWorldQuaternion);
      console.log('[CodeXR][VirtualScreen] applyFollowTransform', {
        screenId: getScreenId(),
        applied,
        cameraWorldPosition: {
          x: cameraWorldPosition.x,
          y: cameraWorldPosition.y,
          z: cameraWorldPosition.z,
        },
        targetWorldPosition: {
          x: targetWorldPosition.x,
          y: targetWorldPosition.y,
          z: targetWorldPosition.z,
        },
      });
      if (applied && updateLegendSide()) {
        layout();
      }
      return applied;
    }

    function updateFollow() {
      if (!state.follow || !state.followTransform) {
        state.followLoopActive = false;
        return;
      }
      applyFollowTransform();
      scheduleAnimationFrame(updateFollow);
    }

    function ensureFollowLoop() {
      if (state.followLoopActive) {
        return;
      }
      state.followLoopActive = true;
      scheduleAnimationFrame(updateFollow);
    }

    function updateFaceCamera() {
      if (state.follow || !state.lookAtCameraEnabled || !refs.root?.isConnected) {
        state.faceCameraLoopActive = false;
        return;
      }
      applyFaceCameraOrientation();
      scheduleAnimationFrame(updateFaceCamera);
    }

    function ensureFaceCameraLoop() {
      if (state.faceCameraLoopActive || !state.lookAtCameraEnabled) {
        return;
      }
      state.faceCameraLoopActive = true;
      scheduleAnimationFrame(updateFaceCamera);
    }
