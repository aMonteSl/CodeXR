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

  // Immersive-entry adapter for CodeXR scenes: two small, independent jobs.
  //
  // 1. Fly automatically in VR and AR. Desktop stays ground-based (WASD via
  //    movement-controls' own keyboard behaviour); entering any immersive
  //    session turns `fly` on for movement-controls (native aframe-extras:
  //    left stick walks, right stick turns, both by quaternion), and exiting
  //    restores whatever `fly` was before.
  //
  // 2. Recenter in AR only. The virtual room is far bigger than a physical
  //    one, and the desktop spawn point sits several metres from the
  //    pedestal — in AR that lands the table across, or through, a real
  //    wall. Entering AR moves the rig to (arX, arZ) facing it (`local-floor`
  //    orients -Z to wherever the user is looking when the session starts, so
  //    yaw 0 means "in front of me"); exiting restores the exact desktop
  //    pose. VR is untouched: the whole room is the point there.
  //
  // Eye height is deliberately NOT this component's concern, or anyone's at
  // runtime: the scene template puts it on the rig once, and nothing here —
  // or in A-Frame — ever moves the rig vertically. WebXR only ever touches
  // the CAMERA entity's local transform (look-controls zeroes it for a real
  // session and restores it on exit), so a height set on the RIG survives
  // every enter-vr/exit-vr untouched.

  function registerComponent(AFRAME) {
    if (!AFRAME || AFRAME.components['codexr-immersive-rig']) {
      return;
    }

    AFRAME.registerComponent('codexr-immersive-rig', {
      schema: {
        arX: { type: 'number', default: 0 },
        arZ: { type: 'number', default: 0 },
        arRecenter: { type: 'boolean', default: true },
        autoFly: { type: 'boolean', default: true },
      },

      init: function () {
        this.savedPose = null;
        this.savedFly = null;
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
        const inAR = typeof sceneEl.is === 'function' && sceneEl.is('ar-mode');

        // Guard against a second enter-vr without an exit in between (headset
        // visibility blips re-fire it): saved state must stay whatever it was
        // BEFORE entering, never an already-adapted one.
        if (this.data.autoFly && this.savedFly === null) {
          const movement = this.el.getAttribute('movement-controls') || {};
          this.savedFly = !!movement.fly;
          this.el.setAttribute('movement-controls', 'fly', true);
        }

        if (inAR && this.data.arRecenter && !this.savedPose) {
          this.savedPose = {
            position: object3D.position.clone(),
            rotation: object3D.rotation.clone(),
          };
          object3D.position.set(this.data.arX, object3D.position.y, this.data.arZ);
          object3D.rotation.set(0, 0, 0);
        }
      },

      onExitVR: function () {
        const object3D = this.el.object3D;

        if (this.savedFly !== null) {
          this.el.setAttribute('movement-controls', 'fly', this.savedFly);
          this.savedFly = null;
        }

        if (object3D && this.savedPose) {
          object3D.position.copy(this.savedPose.position);
          object3D.rotation.copy(this.savedPose.rotation);
          this.savedPose = null;
        }
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
