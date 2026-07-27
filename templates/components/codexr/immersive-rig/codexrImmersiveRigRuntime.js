(function (factory) {
  const root = typeof globalThis !== 'undefined'
    ? globalThis
    : typeof self !== 'undefined'
      ? self
      : typeof window !== 'undefined'
        ? window
        : this;

  factory(root);
})(function (root) {
  'use strict';

  // Immersive rig adapter for CodeXR scenes.
  //
  // The camera rig carries a desktop eye-height offset (y = 1.75 in the
  // analysis scene, 1.6 in the DOM scene) because on a flat screen the camera
  // entity sits at the rig origin. In immersive WebXR that offset becomes a
  // bug: A-Frame requests the `local-floor` reference space (systems/webxr.js,
  // default), so the headset pose already carries the user's real height above
  // their physical floor, and three.js replaces the camera entity's local
  // transform with that pose every frame — the rig's y is ADDED on top,
  // leaving the user standing ~1.75 m above the virtual floor. A-Frame 1.7
  // has no userHeight compensation (the camera component dropped it), so the
  // rig has to adapt itself:
  //
  //   - entering ANY immersive session (VR or AR): rig y drops to 0 so the
  //     virtual floor meets the real one;
  //   - entering AR specifically: the rig also recenters at `arPosition` and
  //     faces -Z (yaw 0), so the pedestal, its controller and the screens
  //     appear right in front of the user, in their own room, instead of
  //     7 m away behind a real wall. `local-floor` orients -Z to wherever
  //     the user is facing at session start, so yaw 0 means "in front";
  //   - exiting: the exact desktop pose (position AND rotation) is restored.
  //
  // movement-controls stays active throughout, so the user can still adjust
  // with the thumbstick afterwards; we only choose the entry pose.

  function registerComponent(AFRAME) {
    if (!AFRAME || AFRAME.components['codexr-immersive-rig']) {
      return;
    }

    AFRAME.registerComponent('codexr-immersive-rig', {
      schema: {
        // Rig pose while an AR session is active (y is a floor offset and
        // should stay 0 — the headset provides the user's real height).
        arPosition: { type: 'vec3', default: { x: 0, y: 0, z: 0 } },
        // Recenter the rig at arPosition (and reset yaw) while in AR.
        arRecenter: { type: 'boolean', default: true },
        // Drop the rig to floor level (y = 0) in any immersive session.
        alignFloor: { type: 'boolean', default: true },
      },

      init: function () {
        this.savedPose = null;
        this.onEnterVR = this.onEnterVR.bind(this);
        this.onExitVR = this.onExitVR.bind(this);
        const sceneEl = this.el.sceneEl;
        if (!sceneEl) {
          return;
        }
        sceneEl.addEventListener('enter-vr', this.onEnterVR);
        sceneEl.addEventListener('exit-vr', this.onExitVR);
      },

      remove: function () {
        const sceneEl = this.el.sceneEl;
        if (sceneEl) {
          sceneEl.removeEventListener('enter-vr', this.onEnterVR);
          sceneEl.removeEventListener('exit-vr', this.onExitVR);
        }
      },

      onEnterVR: function () {
        const sceneEl = this.el.sceneEl;
        const object3D = this.el.object3D;
        if (!sceneEl || !object3D) {
          return;
        }
        // Guard against a second enter-vr without an exit in between (headset
        // visibility blips re-fire it): the saved pose must stay the DESKTOP
        // pose, never an already-adapted one.
        if (!this.savedPose) {
          this.savedPose = {
            position: object3D.position.clone(),
            rotation: object3D.rotation.clone(),
          };
        }

        const inAR = typeof sceneEl.is === 'function' && sceneEl.is('ar-mode');
        if (inAR && this.data.arRecenter) {
          object3D.position.set(
            this.data.arPosition.x,
            this.data.alignFloor ? 0 : this.data.arPosition.y,
            this.data.arPosition.z,
          );
          object3D.rotation.set(0, 0, 0);
        } else if (this.data.alignFloor) {
          object3D.position.y = 0;
        }
      },

      onExitVR: function () {
        const object3D = this.el.object3D;
        if (!object3D || !this.savedPose) {
          return;
        }
        object3D.position.copy(this.savedPose.position);
        object3D.rotation.copy(this.savedPose.rotation);
        this.savedPose = null;
      },
    });
  }

  if (root.AFRAME) {
    registerComponent(root.AFRAME);
  } else {
    root.addEventListener('load', function () {
      registerComponent(root.AFRAME);
    });
  }
});
