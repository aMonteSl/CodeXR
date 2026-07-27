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

  // AR recenter for CodeXR scenes.
  //
  // Eye height is NOT this component's business: the scene templates put the
  // rig on the floor (y = 0) and the eye offset on the camera entity, which is
  // the split A-Frame is built around — look-controls zeroes the camera's
  // local position when a real headset session starts and restores it on exit
  // (components/look-controls.js), so the `local-floor` pose, which already
  // carries the user's real height, replaces the desktop offset instead of
  // stacking on top of it. Nothing here needs to touch y, and it must not:
  // moving the rig vertically is what puts the user's eyes on the floor.
  //
  // What DOES need help is where you stand in AR. The virtual room is far
  // bigger than a physical one, and the desktop spawn sits ~7 m from the
  // pedestal — in AR that lands the table across (or through) a real wall.
  // On entering AR the rig moves next to the pedestal and faces it; the
  // `local-floor` space orients -Z to wherever the user is looking when the
  // session starts, so yaw 0 means "in front of me". Exiting restores the
  // desktop pose exactly. VR is left alone: the whole room is the point there.
  //
  // movement-controls stays live throughout — this only chooses the entry
  // pose, the thumbstick still adjusts it.

  function registerComponent(AFRAME) {
    if (!AFRAME || AFRAME.components['codexr-immersive-rig']) {
      return;
    }

    AFRAME.registerComponent('codexr-immersive-rig', {
      schema: {
        // Rig pose while an AR session is active. y stays 0: the rig IS the
        // floor, and the headset supplies the height above it.
        arPosition: { type: 'vec3', default: { x: 0, y: 0, z: 0 } },
        arRecenter: { type: 'boolean', default: true },
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
        if (!sceneEl || !object3D || !this.data.arRecenter) {
          return;
        }
        if (typeof sceneEl.is !== 'function' || !sceneEl.is('ar-mode')) {
          return;
        }
        // Guard against a second enter-vr without an exit in between (headset
        // visibility blips re-fire it): the saved pose must stay the DESKTOP
        // pose, never an already-recentered one.
        if (!this.savedPose) {
          this.savedPose = {
            position: object3D.position.clone(),
            rotation: object3D.rotation.clone(),
          };
        }
        object3D.position.set(this.data.arPosition.x, 0, this.data.arPosition.z);
        object3D.rotation.set(0, 0, 0);
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
